// Background service worker for Bookmarks Bar Switcher with Auto-save

let autoSaveEnabled = false;
let autoSaveInterval = 5;
let currentStateName = null;
const autoSaveAlarmName = 'bookmarksAutoSave';

// Initialize auto-save settings on startup
chrome.runtime.onStartup.addListener(async () => {
  await loadAutoSaveSettings();
  // Temporarily disable aggressive validation on startup to prevent state loss
  // await validateAndCleanupStates();
  console.log('Startup validation disabled - use manual cleanup if needed');
  setupAutoSave();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadAutoSaveSettings();
  // Temporarily disable aggressive validation on install to prevent state loss
  // await validateAndCleanupStates();
  console.log('Install validation disabled - use manual cleanup if needed');
  setupAutoSave();
});

// Load auto-save settings from storage
async function loadAutoSaveSettings() {
  try {
    // Try to load from sync storage first
    let result = await chrome.storage.sync.get([
      'autoSaveEnabled',
      'autoSaveIntervalMinutes',
      'currentStateName',
    ]);

    // If no data in sync, try to migrate from local storage
    if (!result.autoSaveEnabled && !result.currentStateName) {
      console.log('No sync data found, checking for local data to migrate...');
      const localResult = await chrome.storage.local.get([
        'autoSaveEnabled',
        'autoSaveIntervalMinutes',
        'currentStateName',
      ]);

      if (localResult.autoSaveEnabled || localResult.currentStateName) {
        console.log('Found local data, migrating to sync storage...');
        await migrateToSyncStorage(localResult);
        result = localResult;
      }
    }

    autoSaveEnabled = result.autoSaveEnabled || false;
    autoSaveInterval = result.autoSaveIntervalMinutes || 5;
    currentStateName = result.currentStateName || null;

    console.log('Loaded settings:', {
      autoSaveEnabled,
      autoSaveInterval,
      currentStateName,
    });
  } catch (error) {
    console.error('Error loading auto-save settings:', error);
  }
}

// Migrate data from local storage to sync storage
async function migrateToSyncStorage(localData) {
  try {
    // Migrate settings
    await chrome.storage.sync.set({
      autoSaveEnabled: localData.autoSaveEnabled || false,
      autoSaveIntervalMinutes: localData.autoSaveIntervalMinutes || 5,
      currentStateName: localData.currentStateName || null,
    });

    // Migrate bookmark states if they exist
    const localStates = await chrome.storage.local.get(['bookmarkStates']);
    if (localStates.bookmarkStates) {
      await chrome.storage.sync.set({
        bookmarkStates: localStates.bookmarkStates,
      });
      console.log('Migrated bookmark states to sync storage');
    }

    // Clear local storage after successful migration
    await chrome.storage.local.clear();
    console.log('Successfully migrated from local to sync storage');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Find state folder using hybrid approach (ID first, then name)
async function findStateFolder(state) {
  try {
    console.log(
      `Finding folder for state "${state.name}": backupFolderId=${state.backupFolderId}, backupFolderName=${state.backupFolderName}`
    );

    // Try ID first (fast)
    if (state.backupFolderId) {
      try {
        const folders = await chrome.bookmarks.get(state.backupFolderId);
        console.log(
          `chrome.bookmarks.get(${state.backupFolderId}) returned:`,
          folders
        );

        if (folders && folders.length > 0) {
          const folder = folders[0]; // chrome.bookmarks.get returns an array
          console.log(`Found folder by ID: ${folder.title} (ID: ${folder.id})`);
          return folder;
        } else {
          console.log(`Folder with ID ${state.backupFolderId} not found`);
        }
      } catch (error) {
        console.warn(
          `Failed to find folder by ID ${state.backupFolderId}:`,
          error
        );
      }
    }

    // Fallback to name (reliable)
    if (state.backupFolderName) {
      try {
        console.log(
          `Searching for folder by name: "${state.backupFolderName}"`
        );
        const otherBookmarks = await chrome.bookmarks.getChildren('2');
        console.log(`Found ${otherBookmarks.length} items in Other Bookmarks`);
        const folder = otherBookmarks.find(
          f => f.title === state.backupFolderName
        );
        if (folder) {
          console.log(
            `Found folder by name: ${folder.title} (ID: ${folder.id})`
          );
          return folder;
        } else {
          console.log(`No folder found with name: "${state.backupFolderName}"`);
        }
      } catch (error) {
        console.warn(
          `Failed to find folder by name ${state.backupFolderName}:`,
          error
        );
      }
    }

    // If we still can't find it, try to recreate it
    if (state.backupFolderName) {
      console.log(
        `Attempting to recreate missing folder for state: ${state.name}`
      );
      try {
        const newFolder = await chrome.bookmarks.create({
          parentId: '2', // Other Bookmarks
          title: state.backupFolderName,
        });

        console.log(
          `Recreated folder: ${newFolder.title} (ID: ${newFolder.id})`
        );

        // Update the stored ID
        await updateStateBackupFolderId(state.name, newFolder.id);

        return newFolder;
      } catch (error) {
        console.error(
          `Failed to recreate folder for state ${state.name}:`,
          error
        );
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding folder for state ${state.name}:`, error);
    return null;
  }
}

// Update state backup folder ID
async function updateStateBackupFolderId(stateName, newFolderId) {
  try {
    const states = await getStoredStates();
    const stateIndex = states.findIndex(s => s.name === stateName);

    if (stateIndex >= 0) {
      states[stateIndex].backupFolderId = newFolderId;
      states[stateIndex].lastUpdated = new Date().toISOString();
      await chrome.storage.sync.set({ bookmarkStates: states });
      console.log(
        `Updated backup folder ID for state "${stateName}" to ${newFolderId}`
      );
    }
  } catch (error) {
    console.error(
      `Failed to update backup folder ID for state "${stateName}":`,
      error
    );
  }
}

// Validate and cleanup corrupted states
async function validateAndCleanupStates() {
  try {
    const states = await getStoredStates();
    if (!states || states.length === 0) {
      console.log('No states to validate');
      return;
    }

    console.log(`Validating ${states.length} states...`);
    console.log('Current states:', JSON.stringify(states, null, 2));

    const validStates = [];
    let corruptedCount = 0;
    let recoveredCount = 0;

    for (const state of states) {
      try {
        // Try to find the backup folder
        console.log(
          `Validating state "${state.name}" with backupFolderId: ${state.backupFolderId}, backupFolderName: ${state.backupFolderName}`
        );
        const backupFolder = await findStateFolder(state);
        if (backupFolder) {
          // Update the state with the correct ID if it changed
          if (backupFolder.id !== state.backupFolderId) {
            state.backupFolderId = backupFolder.id;
            state.lastUpdated = new Date().toISOString();
            recoveredCount++;
          }
          validStates.push(state);
          console.log(`State "${state.name}" is valid`);
        } else {
          // Don't immediately mark as corrupted - try to recreate the folder
          if (state.backupFolderName) {
            console.log(
              `Attempting to recreate folder for state "${state.name}" during validation...`
            );
            try {
              const newFolder = await chrome.bookmarks.create({
                parentId: '2', // Other Bookmarks
                title: state.backupFolderName,
              });

              console.log(
                `Recreated folder during validation: ${newFolder.title} (ID: ${newFolder.id})`
              );

              // Update the state with the new folder
              state.backupFolderId = newFolder.id;
              state.lastUpdated = new Date().toISOString();
              recoveredCount++;
              validStates.push(state);
              console.log(`State "${state.name}" recovered during validation`);
            } catch (error) {
              console.error(
                `Failed to recreate folder for state "${state.name}" during validation:`,
                error
              );
              console.warn(
                `State "${state.name}" has no valid backup folder and could not be recreated`
              );
              corruptedCount++;
            }
          } else if (state.backupFolderId) {
            // For existing states without backupFolderName, try to use the ID and add the name
            console.log(
              `State "${state.name}" has no backup folder name, attempting to add it...`
            );
            try {
              const folder = await chrome.bookmarks.get(state.backupFolderId);
              if (folder) {
                // Add the missing backupFolderName
                state.backupFolderName = folder.title;
                state.lastUpdated = new Date().toISOString();
                recoveredCount++;
                validStates.push(state);
                console.log(
                  `State "${state.name}" recovered by adding missing backupFolderName: ${folder.title}`
                );
              } else {
                // Folder doesn't exist, try to recreate with state name
                console.log(
                  `Attempting to recreate folder for state "${state.name}" using state name...`
                );
                try {
                  const newFolder = await chrome.bookmarks.create({
                    parentId: '2', // Other Bookmarks
                    title: state.name,
                  });

                  console.log(
                    `Recreated folder using state name: ${newFolder.title} (ID: ${newFolder.id})`
                  );

                  // Update the state with the new folder and name
                  state.backupFolderId = newFolder.id;
                  state.backupFolderName = newFolder.title;
                  state.lastUpdated = new Date().toISOString();
                  recoveredCount++;
                  validStates.push(state);
                  console.log(
                    `State "${state.name}" recovered by recreating folder`
                  );
                } catch (error) {
                  console.error(
                    `Failed to recreate folder for state "${state.name}":`,
                    error
                  );
                  corruptedCount++;
                }
              }
            } catch (error) {
              console.warn(
                `Error checking folder for state "${state.name}":`,
                error
              );
              corruptedCount++;
            }
          } else {
            console.warn(
              `State "${state.name}" has no backup folder ID or name and cannot be recovered`
            );
            corruptedCount++;
          }
        }
      } catch (error) {
        console.warn(`Error validating state "${state.name}":`, error);
        corruptedCount++;
      }
    }

    // Update storage with validated states
    if (corruptedCount > 0 || recoveredCount > 0) {
      console.log(
        `Found ${corruptedCount} corrupted states and recovered ${recoveredCount} states, updating...`
      );
      await chrome.storage.sync.set({ bookmarkStates: validStates });

      // If current state is corrupted, clear it
      const currentStateName = await getCurrentStateName();
      if (
        currentStateName &&
        !validStates.find(s => s.name === currentStateName)
      ) {
        console.log(
          `Current state "${currentStateName}" is corrupted, clearing...`
        );
        await chrome.storage.sync.set({ currentStateName: null });
      }

      let message = '';
      if (corruptedCount > 0) {
        message += `Removed ${corruptedCount} corrupted states. `;
      }
      if (recoveredCount > 0) {
        message += `Recovered ${recoveredCount} states. `;
      }
      message += `${validStates.length} valid states remaining.`;

      console.log(
        `Cleanup complete. ${validStates.length} valid states remaining.`
      );
      return message;
    } else {
      console.log('All states are valid');
      return 'All states are valid. No cleanup needed.';
    }
  } catch (error) {
    console.error('State validation failed:', error);
  }
}

// Setup auto-save based on current settings
async function setupAutoSave() {
  if (autoSaveEnabled) {
    await createAutoSaveAlarm();
  } else {
    await clearAutoSaveAlarm();
  }
}

// Create auto-save alarm
async function createAutoSaveAlarm() {
  try {
    await chrome.alarms.clear(autoSaveAlarmName);
    await chrome.alarms.create(autoSaveAlarmName, {
      delayInMinutes: autoSaveInterval,
      periodInMinutes: autoSaveInterval,
    });
    console.log(
      `Auto-save alarm created with ${autoSaveInterval} minute interval`
    );
  } catch (error) {
    console.error('Error creating auto-save alarm:', error);
  }
}

// Clear auto-save alarm
async function clearAutoSaveAlarm() {
  try {
    await chrome.alarms.clear(autoSaveAlarmName);
    console.log('Auto-save alarm cleared');
  } catch (error) {
    console.error('Error clearing auto-save alarm:', error);
  }
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === autoSaveAlarmName && autoSaveEnabled && currentStateName) {
    console.log('Auto-save alarm triggered, saving current state...');
    await autoSaveCurrentState();
  }
});

// Auto-save current state
async function autoSaveCurrentState() {
  try {
    if (!currentStateName) {
      console.log('No current state name, skipping auto-save');
      return;
    }

    console.log(`Auto-saving state: ${currentStateName}`);
    await saveCurrentState(currentStateName);
    console.log('Auto-save completed successfully');
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'saveCurrentState':
      saveCurrentState(request.stateName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'createNewState':
      createNewState(request.stateName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'switchToState':
      switchToState(request.stateName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'deleteState':
      deleteState(request.stateName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getSavedStates':
      getSavedStates()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'updateAutoSave':
      updateAutoSave(request.enabled, request.interval)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'cleanupStates':
      validateAndCleanupStates()
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'restoreStates':
      restoreStatesFromStorage()
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'checkStorage':
      checkStorageContents()
        .then(result =>
          sendResponse({
            success: true,
            message: result.message,
            data: result.data,
          })
        )
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'recoverOrphaned':
      scanAndRecoverOrphanedStates()
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'fixStates':
      fixImportedStates()
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'validateStates':
      validateAndCleanupStates()
        .then(result => sendResponse({ success: true, message: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'debugStates':
      debugStates()
        .then(result =>
          sendResponse({
            success: true,
            message: result.message,
            data: result.data,
          })
        )
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'renameState':
      renameState(request.oldName, request.newName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'popOut':
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 450,
        height: 700,
        focused: true
      }).then(window => {
        // Send response to close the popup
        sendResponse({ success: true, windowId: window.id });
      }).catch(error => {
        console.error('Error creating pop-out window:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response

    // Handle rename state request
  }
});

// Update auto-save settings
async function updateAutoSave(enabled, interval) {
  try {
    autoSaveEnabled = enabled;
    autoSaveInterval = interval;

    if (enabled) {
      await createAutoSaveAlarm();
    } else {
      await clearAutoSaveAlarm();
    }

    return { success: true, message: 'Auto-save settings updated' };
  } catch (error) {
    console.error('Error updating auto-save:', error);
    throw new Error('Failed to update auto-save settings');
  }
}

// Save current bookmarks bar as a state
async function saveCurrentState(stateName) {
  try {
    console.log(`Saving current state: ${stateName}`);

    // Get current bookmarks bar items
    const bookmarksBar = await chrome.bookmarks.getChildren('1');
    console.log(
      `Bookmarks bar has ${bookmarksBar.length} items:`,
      bookmarksBar.map(b => ({
        title: b.title,
        url: b.url,
        hasChildren: !!b.children,
      }))
    );

    // Check if a folder with this state name already exists in Other Bookmarks
    const otherBookmarks = await chrome.bookmarks.getChildren('2');
    let stateFolder = otherBookmarks.find(folder => folder.title === stateName);

    if (stateFolder) {
      console.log(`Found existing state folder: ${stateFolder.id}`);
      // Clear existing content
      const existingChildren = await chrome.bookmarks.getChildren(
        stateFolder.id
      );
      for (const child of existingChildren) {
        await chrome.bookmarks.removeTree(child.id);
      }
    } else {
      // Create a new state folder in "Other Bookmarks"
      stateFolder = await chrome.bookmarks.create({
        parentId: '2', // Other Bookmarks
        title: stateName,
      });
      console.log(`Created new state folder: ${stateFolder.id}`);
    }

    // Copy all bookmarks bar items to the state folder
    for (const bookmark of bookmarksBar) {
      if (bookmark.url) {
        // It's a bookmark
        console.log(`Saving bookmark: ${bookmark.title}`);
        await chrome.bookmarks.create({
          parentId: stateFolder.id,
          title: bookmark.title,
          url: bookmark.url,
        });
      } else {
        // It's a folder - check if it has children
        console.log(`Saving folder: ${bookmark.title}`);
        const newFolder = await chrome.bookmarks.create({
          parentId: stateFolder.id,
          title: bookmark.title,
        });

        // Get the children and recursively copy folder contents
        const folderChildren = await chrome.bookmarks.getChildren(bookmark.id);
        if (folderChildren && folderChildren.length > 0) {
          console.log(
            `Folder ${bookmark.title} has ${folderChildren.length} children`
          );
          await copyBookmarkTree(bookmark, newFolder.id);
        } else {
          console.log(`Folder ${bookmark.title} is empty`);
        }
      }
    }

    // Store state info
    const states = await getStoredStates();
    const existingStateIndex = states.findIndex(s => s.name === stateName);

    if (existingStateIndex >= 0) {
      states[existingStateIndex].backupFolderId = stateFolder.id;
      states[existingStateIndex].backupFolderName = stateFolder.title;
      states[existingStateIndex].lastUpdated = new Date().toISOString();
    } else {
      states.push({
        name: stateName,
        backupFolderId: stateFolder.id,
        backupFolderName: stateFolder.title,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }

    await chrome.storage.sync.set({ bookmarkStates: states });

    return {
      success: true,
      message: `State "${stateName}" saved successfully`,
    };
  } catch (error) {
    console.error('Error saving current state:', error);
    throw new Error('Failed to save current state');
  }
}

// Create a new empty state
async function createNewState(stateName) {
  try {
    // Ensure state name is unique
    const uniqueStateName = await ensureUniqueStateName(stateName);

    // Check if state already exists (shouldn't happen with unique names, but safety check)
    const states = await getStoredStates();
    if (states.find(s => s.name === uniqueStateName)) {
      throw new Error('State with this name already exists');
    }

    // Create an empty state folder in Other Bookmarks
    const stateFolder = await chrome.bookmarks.create({
      parentId: '2', // Other Bookmarks
      title: stateName,
    });

    // Add to states list
    states.push({
      name: stateName,
      backupFolderId: stateFolder.id,
      backupFolderName: stateFolder.title,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });

    await chrome.storage.sync.set({ bookmarkStates: states });

    return {
      success: true,
      message: `New state "${stateName}" created successfully`,
    };
  } catch (error) {
    console.error('Error creating new state:', error);
    throw error;
  }
}

// Switch to a specific state
async function switchToState(stateName) {
  try {
    console.log(`Switching to state: ${stateName}`);

    const states = await getStoredStates();
    console.log('Available states:', states);

    const targetState = states.find(s => s.name === stateName);

    if (!targetState) {
      throw new Error('State not found');
    }

    console.log('Target state details:', JSON.stringify(targetState, null, 2));

    if (!targetState.backupFolderId) {
      console.error(`State "${stateName}" has no backupFolderId:`, targetState);
      throw new Error('State backup folder not found');
    }

    console.log('Target state:', targetState);

    // First, auto-save current bookmarks bar if auto-save is enabled
    try {
      const existingStateName = await getCurrentStateName();
      if (
        autoSaveEnabled &&
        existingStateName &&
        existingStateName !== stateName
      ) {
        console.log(`Auto-saving current state: ${existingStateName}`);
        await saveCurrentState(existingStateName);
      }
    } catch (autoSaveError) {
      console.warn(
        'Auto-save failed, continuing with state switch:',
        autoSaveError
      );
    }

    // Clear current bookmarks bar
    const bookmarksBar = await chrome.bookmarks.getChildren('1');
    for (const bookmark of bookmarksBar) {
      try {
        // Use removeTree for everything - it handles both bookmarks and folders safely
        await chrome.bookmarks.removeTree(bookmark.id);
        console.log(`Removed: ${bookmark.title}`);
      } catch (error) {
        console.error(`Failed to remove bookmark ${bookmark.title}:`, error);
        throw new Error(`Failed to clear bookmarks bar: ${error.message}`);
      }
    }

    // Restore the target state
    console.log(`Restoring from backup folder: ${targetState.backupFolderId}`);

    // Find the backup folder using hybrid approach (ID first, then name)
    const backupFolder = await findStateFolder(targetState);
    if (!backupFolder) {
      throw new Error(
        `Backup folder for state "${stateName}" could not be found. The state may have been corrupted.`
      );
    }

    console.log(
      'Backup folder found:',
      backupFolder.title,
      'with ID:',
      backupFolder.id
    );

    // Update the stored ID if it changed
    if (backupFolder.id !== targetState.backupFolderId) {
      console.log(
        `Backup folder ID changed from ${targetState.backupFolderId} to ${backupFolder.id}, updating...`
      );
      await updateStateBackupFolderId(targetState.name, backupFolder.id);
      // Update the local reference for the rest of the function
      targetState.backupFolderId = backupFolder.id;
    }

    // Validate that we have a valid folder ID before proceeding
    if (!backupFolder.id) {
      throw new Error(`Backup folder for state "${stateName}" has no valid ID`);
    }

    // Get the children of the backup folder using the validated folder
    const backupChildren = await chrome.bookmarks.getChildren(backupFolder.id);
    console.log('Backup children:', backupChildren);

    if (backupChildren && backupChildren.length > 0) {
      console.log(`Restoring ${backupChildren.length} items to bookmarks bar`);

      for (const bookmark of backupChildren) {
        if (bookmark.url) {
          // It's a bookmark
          console.log(`Creating bookmark: ${bookmark.title}`);
          await chrome.bookmarks.create({
            parentId: '1', // Bookmarks Bar
            title: bookmark.title,
            url: bookmark.url,
          });
        } else {
          // It's a folder
          console.log(
            `Creating folder: ${bookmark.title} (ID: ${bookmark.id})`
          );
          const newFolder = await chrome.bookmarks.create({
            parentId: '1', // Bookmarks Bar
            title: bookmark.title,
          });

          console.log(
            `Created new folder: ${newFolder.title} (ID: ${newFolder.id})`
          );

          // Recursively copy folder contents
          console.log(
            `Copying contents from folder ${bookmark.title} to ${newFolder.title}`
          );
          await copyBookmarkTree(bookmark, newFolder.id);
        }
      }
    } else {
      console.log('No items to restore from backup folder');
    }

    // Update current state name
    await chrome.storage.sync.set({ currentStateName: stateName });
    currentStateName = stateName;
    console.log(`Updated current state name to: ${stateName}`);

    return {
      success: true,
      message: `Switched to "${stateName}" state successfully`,
    };
  } catch (error) {
    console.error('Error switching state:', error);
    throw new Error('Failed to switch state');
  }
}

// Delete a state
async function deleteState(stateName) {
  try {
    const states = await getStoredStates();
    const stateIndex = states.findIndex(s => s.name === stateName);

    if (stateIndex === -1) {
      throw new Error('State not found');
    }

    const state = states[stateIndex];

    // Remove the state folder
    if (state.backupFolderId) {
      try {
        await chrome.bookmarks.removeTree(state.backupFolderId);
        console.log(`Removed state folder: ${stateName}`);
      } catch (e) {
        console.warn('Could not remove state folder:', e);
      }
    }

    // Remove from states list
    states.splice(stateIndex, 1);
    await chrome.storage.sync.set({ bookmarkStates: states });

    return {
      success: true,
      message: `State "${stateName}" deleted successfully`,
    };
  } catch (error) {
    console.error('Error deleting state:', error);
    throw new Error('Failed to delete state');
  }
}

// Rename a state
async function renameState(oldName, newName) {
  try {
    console.log(`Renaming state from "${oldName}" to "${newName}"`);

    // Validate new name
    if (!newName || newName.trim().length === 0) {
      throw new Error('New state name cannot be empty');
    }

    if (newName.length > 50) {
      throw new Error('State name cannot exceed 50 characters');
    }

    const states = await getStoredStates();
    const stateIndex = states.findIndex(s => s.name === oldName);

    if (stateIndex === -1) {
      throw new Error('State not found');
    }

    // Check if new name already exists
    const existingState = states.find(s => s.name === newName);
    if (existingState && existingState.name !== oldName) {
      throw new Error('State with this name already exists');
    }

    const state = states[stateIndex];
    const oldFolderName = state.backupFolderName;

    // Rename the backup folder
    if (state.backupFolderId) {
      try {
        await chrome.bookmarks.update(state.backupFolderId, { title: newName });
        console.log(`Renamed backup folder from "${oldFolderName}" to "${newName}"`);
      } catch (e) {
        console.warn('Could not rename backup folder:', e);
      }
    }

    // Update state information
    state.name = newName;
    state.backupFolderName = newName;
    state.lastUpdated = new Date().toISOString();

    // Update storage
    await chrome.storage.sync.set({ bookmarkStates: states });

    // Update current state name if it was renamed
    const currentStateName = await getCurrentStateName();
    if (currentStateName === oldName) {
      await chrome.storage.sync.set({ currentStateName: newName });
      console.log(`Updated current state name from "${oldName}" to "${newName}"`);
    }

    return {
      success: true,
      message: `State renamed from "${oldName}" to "${newName}" successfully`,
    };
  } catch (error) {
    console.error('Error renaming state:', error);
    throw new Error(`Failed to rename state: ${error.message}`);
  }
}

// Get all saved states
async function getSavedStates() {
  try {
    const states = await getStoredStates();
    return { success: true, states: states };
  } catch (error) {
    console.error('Error getting saved states:', error);
    throw new Error('Failed to get saved states');
  }
}

// Helper function to copy bookmark tree recursively
async function copyBookmarkTree(sourceBookmark, targetParentId) {
  try {
    console.log(
      `copyBookmarkTree: source=${sourceBookmark.title} (${sourceBookmark.id}), target=${targetParentId}`
    );

    // Get the children of the source bookmark
    const children = await chrome.bookmarks.getChildren(sourceBookmark.id);
    console.log(
      `Found ${children.length} children in ${sourceBookmark.title}:`,
      children.map(c => ({
        title: c.title,
        url: c.url,
        hasChildren: !!c.children,
      }))
    );

    if (children && children.length > 0) {
      for (const child of children) {
        if (child.url) {
          // It's a bookmark
          console.log(
            `Copying bookmark: ${child.title} to parent ${targetParentId}`
          );
          await chrome.bookmarks.create({
            parentId: targetParentId,
            title: child.title,
            url: child.url,
          });
        } else {
          // It's a folder
          console.log(
            `Copying folder: ${child.title} to parent ${targetParentId}`
          );
          const newFolder = await chrome.bookmarks.create({
            parentId: targetParentId,
            title: child.title,
          });

          console.log(
            `Created nested folder: ${newFolder.title} (${newFolder.id})`
          );

          // Recursively copy folder contents
          await copyBookmarkTree(child, newFolder.id);
        }
      }
    } else {
      console.log(`No children found in ${sourceBookmark.title}`);
    }
  } catch (error) {
    console.error('Error copying bookmark tree:', error);
    throw error;
  }
}

// Helper function to get stored states
async function getStoredStates() {
  const result = await chrome.storage.sync.get(['bookmarkStates']);
  return result.bookmarkStates || [];
}

// Helper function to get current state name
async function getCurrentStateName() {
  const result = await chrome.storage.sync.get(['currentStateName']);
  return result.currentStateName || null;
}

// Ensure state name is unique
async function ensureUniqueStateName(proposedName) {
  const states = await getStoredStates();
  let counter = 1;
  let uniqueName = proposedName;

  while (states.find(s => s.name === uniqueName)) {
    uniqueName = `${proposedName} (${counter})`;
    counter++;
  }

  if (uniqueName !== proposedName) {
    console.log(
      `State name "${proposedName}" already exists, using "${uniqueName}" instead`
    );
  }

  return uniqueName;
}

// Restore states from storage backup
async function restoreStatesFromStorage() {
  try {
    console.log('Attempting to restore states from storage...');

    // Check what's actually in storage
    const allStorage = await chrome.storage.sync.get(null);
    console.log('All storage contents:', JSON.stringify(allStorage, null, 2));

    // Check if we have any states in storage
    const result = await chrome.storage.sync.get(['bookmarkStates']);
    console.log(
      'Bookmark states from storage:',
      JSON.stringify(result, null, 2)
    );

    if (!result.bookmarkStates || result.bookmarkStates.length === 0) {
      console.log('No states found in sync storage to restore');

      // Check if there are any states in local storage that we can recover
      console.log('Checking local storage for backup...');
      const localResult = await chrome.storage.local.get(['bookmarkStates']);
      if (localResult.bookmarkStates && localResult.bookmarkStates.length > 0) {
        console.log(
          `Found ${localResult.bookmarkStates.length} states in local storage, attempting to restore...`
        );

        // Try to restore from local storage
        let restoredCount = 0;
        let failedCount = 0;

        for (const state of localResult.bookmarkStates) {
          try {
            if (state.backupFolderName || state.name) {
              // Try to create the backup folder
              const folderName = state.backupFolderName || state.name;
              const newFolder = await chrome.bookmarks.create({
                parentId: '2', // Other Bookmarks
                title: folderName,
              });

              console.log(
                `Recreated backup folder for state "${state.name}": ${newFolder.title} (ID: ${newFolder.id})`
              );

              // Update the state with the new folder ID and name
              state.backupFolderId = newFolder.id;
              state.backupFolderName = folderName;
              state.lastUpdated = new Date().toISOString();
              restoredCount++;
            } else {
              console.warn(
                `State "${state.name}" has no backup folder name, cannot restore`
              );
              failedCount++;
            }
          } catch (error) {
            console.error(`Failed to restore state "${state.name}":`, error);
            failedCount++;
          }
        }

        // Save the restored states to sync storage
        if (restoredCount > 0) {
          await chrome.storage.sync.set({
            bookmarkStates: localResult.bookmarkStates,
          });
          console.log(
            `Successfully restored ${restoredCount} states from local storage`
          );
          return `Restored ${restoredCount} states from local storage backup${
            failedCount > 0 ? `, ${failedCount} failed` : ''
          }`;
        }
      }

      return 'No states found in storage to restore';
    }

    console.log(`Found ${result.bookmarkStates.length} states in storage`);

    // Try to restore each state by recreating its backup folder
    let restoredCount = 0;
    let failedCount = 0;

    for (const state of result.bookmarkStates) {
      try {
        if (state.backupFolderName) {
          // Try to create the backup folder
          const newFolder = await chrome.bookmarks.create({
            parentId: '2', // Other Bookmarks
            title: state.backupFolderName,
          });

          console.log(
            `Recreated backup folder for state "${state.name}": ${newFolder.title} (ID: ${newFolder.id})`
          );

          // Update the state with the new folder ID
          state.backupFolderId = newFolder.id;
          state.lastUpdated = new Date().toISOString();
          restoredCount++;
        } else {
          console.warn(
            `State "${state.name}" has no backup folder name, cannot restore`
          );
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to restore state "${state.name}":`, error);
        failedCount++;
      }
    }

    // Update storage with the restored states
    if (restoredCount > 0) {
      await chrome.storage.sync.set({ bookmarkStates: result.bookmarkStates });
      console.log(`Successfully restored ${restoredCount} states`);
    }

    const message = `Restored ${restoredCount} states${
      failedCount > 0 ? `, ${failedCount} failed` : ''
    }`;
    console.log(message);
    return message;
  } catch (error) {
    console.error('Failed to restore states from storage:', error);
    throw new Error('Failed to restore states from storage');
  }
}

// Debug states and their folder mappings
async function debugStates() {
  try {
    console.log('Debugging states...');

    const states = await getStoredStates();
    if (!states || states.length === 0) {
      return { message: 'No states found', data: null };
    }

    console.log(`Debugging ${states.length} states...`);

    const debugResults = [];

    for (const state of states) {
      console.log(`\n--- Debugging state: ${state.name} ---`);
      const stateDebug = {
        name: state.name,
        backupFolderId: state.backupFolderId,
        backupFolderName: state.backupFolderName,
        created: state.created,
        lastUpdated: state.lastUpdated,
      };

      // Check if backupFolderId exists
      if (state.backupFolderId) {
        try {
          const folders = await chrome.bookmarks.get(state.backupFolderId);
          if (folders && folders.length > 0) {
            const folder = folders[0];
            stateDebug.folderFound = true;
            stateDebug.folderTitle = folder.title;
            stateDebug.folderId = folder.id;
            stateDebug.folderUrl = folder.url;
            console.log(
              `✓ Folder found by ID: ${folder.title} (ID: ${folder.id})`
            );
          } else {
            stateDebug.folderFound = false;
            stateDebug.folderError = 'No folder returned by ID';
            console.log(`✗ No folder found by ID: ${state.backupFolderId}`);
          }
        } catch (error) {
          stateDebug.folderFound = false;
          stateDebug.folderError = error.message;
          console.log(`✗ Error finding folder by ID: ${error.message}`);
        }
      } else {
        stateDebug.folderFound = false;
        stateDebug.folderError = 'No backupFolderId';
        console.log(`✗ No backupFolderId for state`);
      }

      // Check if folder exists by name
      if (state.backupFolderName) {
        try {
          const otherBookmarks = await chrome.bookmarks.getChildren('2');
          const matchingFolder = otherBookmarks.find(
            f => f.title === state.backupFolderName
          );
          if (matchingFolder) {
            stateDebug.nameMatchFound = true;
            stateDebug.nameMatchTitle = matchingFolder.title;
            stateDebug.nameMatchId = matchingFolder.id;
            console.log(
              `✓ Folder found by name: ${matchingFolder.title} (ID: ${matchingFolder.id})`
            );
          } else {
            stateDebug.nameMatchFound = false;
            console.log(
              `✗ No folder found by name: "${state.backupFolderName}"`
            );
          }
        } catch (error) {
          stateDebug.nameMatchFound = false;
          stateDebug.nameMatchError = error.message;
          console.log(`✗ Error finding folder by name: ${error.message}`);
        }
      } else {
        stateDebug.nameMatchFound = false;
        stateDebug.nameMatchError = 'No backupFolderName';
        console.log(`✗ No backupFolderName for state`);
      }

      debugResults.push(stateDebug);
    }

    const message = `Debugged ${states.length} states`;
    console.log(`\n=== Debug Summary ===`);
    console.log(JSON.stringify(debugResults, null, 2));

    return { message, data: debugResults };
  } catch (error) {
    console.error('Failed to debug states:', error);
    throw new Error('Failed to debug states');
  }
}

// Check storage contents for debugging
async function checkStorageContents() {
  try {
    console.log('Checking storage contents...');

    // Check sync storage
    const syncStorage = await chrome.storage.sync.get(null);
    console.log('Sync storage contents:', syncStorage);

    // Check local storage
    const localStorage = await chrome.storage.local.get(null);
    console.log('Local storage contents:', localStorage);

    // Check Other Bookmarks folder contents
    console.log('Checking Other Bookmarks folder...');
    const otherBookmarks = await chrome.bookmarks.getChildren('2');
    console.log(
      'Other Bookmarks contents:',
      otherBookmarks.map(f => ({ id: f.id, title: f.title, url: f.url }))
    );

    // Check if there are any bookmark states anywhere
    const hasSyncStates =
      syncStorage.bookmarkStates && syncStorage.bookmarkStates.length > 0;
    const hasLocalStates =
      localStorage.bookmarkStates && localStorage.bookmarkStates.length > 0;

    let message = '';
    const data = {
      sync: syncStorage,
      local: localStorage,
      otherBookmarks: otherBookmarks.map(f => ({
        id: f.id,
        title: f.title,
        url: f.url,
      })),
    };

    if (hasSyncStates) {
      message = `Found ${syncStorage.bookmarkStates.length} states in sync storage`;
    } else if (hasLocalStates) {
      message = `Found ${localStorage.bookmarkStates.length} states in local storage (sync empty)`;
    } else {
      message = 'No states found in any storage';
    }

    return { message, data };
  } catch (error) {
    console.error('Failed to check storage contents:', error);
    throw new Error('Failed to check storage contents');
  }
}

// Fix imported states by adding missing backupFolderName
async function fixImportedStates() {
  try {
    console.log('Fixing imported states...');

    const states = await getStoredStates();
    if (!states || states.length === 0) {
      console.log('No states to fix');
      return 'No states to fix';
    }

    let fixedCount = 0;
    let failedCount = 0;

    for (const state of states) {
      try {
        if (!state.backupFolderName) {
          console.log(
            `State "${state.name}" is missing backupFolderName, attempting to fix...`
          );

          // Try to find the folder by ID first
          if (state.backupFolderId) {
            try {
              const folder = await chrome.bookmarks.get(state.backupFolderId);
              if (folder) {
                state.backupFolderName = folder.title;
                state.lastUpdated = new Date().toISOString();
                fixedCount++;
                console.log(
                  `Fixed state "${state.name}" with folder: ${folder.title}`
                );
                continue;
              }
            } catch (error) {
              console.warn(
                `Could not find folder with ID ${state.backupFolderId} for state "${state.name}"`
              );
            }
          }

          // If ID didn't work, try to find by name in Other Bookmarks
          const otherBookmarks = await chrome.bookmarks.getChildren('2');
          const matchingFolder = otherBookmarks.find(
            f => f.title === state.name
          );

          if (matchingFolder) {
            state.backupFolderId = matchingFolder.id;
            state.backupFolderName = matchingFolder.title;
            state.lastUpdated = new Date().toISOString();
            fixedCount++;
            console.log(
              `Fixed state "${state.name}" by matching folder name: ${matchingFolder.title}`
            );
          } else {
            console.warn(`Could not find folder for state "${state.name}"`);
            failedCount++;
          }
        }
      } catch (error) {
        console.error(`Error fixing state "${state.name}":`, error);
        failedCount++;
      }
    }

    // Update storage with fixed states
    if (fixedCount > 0) {
      await chrome.storage.sync.set({ bookmarkStates: states });
      console.log(`Successfully fixed ${fixedCount} states`);
    }

    const message = `Fixed ${fixedCount} states${
      failedCount > 0 ? `, ${failedCount} failed` : ''
    }`;
    console.log(message);
    return message;
  } catch (error) {
    console.error('Failed to fix imported states:', error);
    throw new Error('Failed to fix imported states');
  }
}

// Scan Other Bookmarks folder and recover orphaned states
async function scanAndRecoverOrphanedStates() {
  try {
    console.log('Scanning Other Bookmarks folder for orphaned states...');

    // Get all items in Other Bookmarks
    const otherBookmarks = await chrome.bookmarks.getChildren('2');
    console.log(
      `Found ${otherBookmarks.length} items in Other Bookmarks:`,
      otherBookmarks.map(f => f.title)
    );

    // Get current states from storage
    const currentStates = await getStoredStates();
    const currentStateNames = currentStates.map(s => s.name);
    const currentFolderNames = currentStates
      .map(s => s.backupFolderName)
      .filter(Boolean);

    console.log('Current state names:', currentStateNames);
    console.log('Current folder names:', currentFolderNames);

    // Find orphaned folders (folders that exist but aren't in storage)
    const orphanedFolders = otherBookmarks.filter(
      folder =>
        folder.url === undefined && // It's a folder, not a bookmark
        !currentFolderNames.includes(folder.title) && // Not in current states
        !currentStateNames.includes(folder.title) // Not a state name either
    );

    console.log(
      'Orphaned folders found:',
      orphanedFolders.map(f => f.title)
    );

    if (orphanedFolders.length === 0) {
      return 'No orphaned states found to recover';
    }

    // Recover each orphaned folder as a new state
    let recoveredCount = 0;
    let failedCount = 0;

    for (const folder of orphanedFolders) {
      try {
        // Create a new state entry
        const newState = {
          name: folder.title,
          backupFolderId: folder.id,
          backupFolderName: folder.title,
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };

        // Add to current states
        currentStates.push(newState);
        recoveredCount++;

        console.log(
          `Recovered orphaned state: ${folder.title} (ID: ${folder.id})`
        );
      } catch (error) {
        console.error(
          `Failed to recover orphaned state ${folder.title}:`,
          error
        );
        failedCount++;
      }
    }

    // Update storage with recovered states
    if (recoveredCount > 0) {
      await chrome.storage.sync.set({ bookmarkStates: currentStates });
      console.log(`Successfully recovered ${recoveredCount} orphaned states`);
    }

    const message = `Recovered ${recoveredCount} orphaned states${
      failedCount > 0 ? `, ${failedCount} failed` : ''
    }`;
    console.log(message);
    return message;
  } catch (error) {
    console.error('Failed to scan and recover orphaned states:', error);
    throw new Error('Failed to scan and recover orphaned states');
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  try {
    console.log(`Keyboard shortcut triggered: ${command}`);
    
    switch (command) {
      case 'switch-to-next-state':
        await switchToNextState();
        break;
      case 'switch-to-previous-state':
        await switchToPreviousState();
        break;
      case 'quick-save-current-state':
        await quickSaveCurrentState();
        break;
      case 'show-popup':
        // This will be handled by the browser automatically
        console.log('Show popup command triggered');
        break;
      default:
        console.warn(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);
  }
});

// Switch to next state in the list
async function switchToNextState() {
  try {
    const states = await getStoredStates();
    if (states.length === 0) {
      console.log('No states available for switching');
      await showNotification('No states available for switching', 'warning');
      return;
    }

    const currentStateName = await getCurrentStateName();
    let nextStateIndex = 0;

    if (currentStateName) {
      const currentIndex = states.findIndex(s => s.name === currentStateName);
      if (currentIndex >= 0) {
        nextStateIndex = (currentIndex + 1) % states.length;
      }
    }

    const nextState = states[nextStateIndex];
    console.log(`Switching to next state: ${nextState.name}`);
    
    await switchToState(nextState.name);
    
    // Show notification
    await showNotification(`Switched to "${nextState.name}" state`);
    
  } catch (error) {
    console.error('Error switching to next state:', error);
    await showNotification('Failed to switch to next state', 'error');
  }
}

// Switch to previous state in the list
async function switchToPreviousState() {
  try {
    const states = await getStoredStates();
    if (states.length === 0) {
      console.log('No states available for switching');
      await showNotification('No states available for switching', 'warning');
      return;
    }

    const currentStateName = await getCurrentStateName();
    let prevStateIndex = 0;

    if (currentStateName) {
      const currentIndex = states.findIndex(s => s.name === currentStateName);
      if (currentIndex >= 0) {
        prevStateIndex = currentIndex === 0 ? states.length - 1 : currentIndex - 1;
      }
    }

    const prevState = states[prevStateIndex];
    console.log(`Switching to previous state: ${prevState.name}`);
    
    await switchToState(prevState.name);
    
    // Show notification
    await showNotification(`Switched to "${prevState.name}" state`);
    
  } catch (error) {
    console.error('Error switching to previous state:', error);
    await showNotification('Failed to switch to previous state', 'error');
  }
}

// Quick save current state with current name
async function quickSaveCurrentState() {
  try {
    const currentStateName = await getCurrentStateName();
    if (!currentStateName) {
      console.log('No current state name set, cannot quick save');
      await showNotification('Please set a state name first', 'warning');
      return;
    }

    console.log(`Quick saving current state: ${currentStateName}`);
    
    await saveCurrentState(currentStateName);
    
    // Show notification
    await showNotification(`Quick saved "${currentStateName}" state`);
    
  } catch (error) {
    console.error('Error quick saving current state:', error);
    await showNotification('Failed to quick save state', 'error');
  }
}

// Show notification to user
async function showNotification(message, type = 'info') {
  try {
    // Try to use chrome.notifications if available
    if (chrome.notifications) {
      const notificationId = `bookmark-switcher-${Date.now()}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/bbs3_48.png',
        title: 'Bookmarks Bar Switcher',
        message: message,
        priority: type === 'error' ? 2 : type === 'warning' ? 1 : 0
      });
      
      // Auto-remove notification after 3 seconds
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 3000);
    } else {
      // Fallback to console logging
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  } catch (error) {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
