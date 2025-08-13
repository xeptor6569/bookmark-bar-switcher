// Background service worker for Bookmarks Bar Switcher with Auto-save

let autoSaveEnabled = false;
let autoSaveInterval = 5;
let currentStateName = null;
let autoSaveAlarmName = 'bookmarksAutoSave';

// Initialize auto-save settings on startup
chrome.runtime.onStartup.addListener(async () => {
  await loadAutoSaveSettings();
  await validateAndCleanupStates();
  setupAutoSave();
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadAutoSaveSettings();
  await validateAndCleanupStates();
  setupAutoSave();
});

// Load auto-save settings from storage
async function loadAutoSaveSettings() {
  try {
    // Try to load from sync storage first
    let result = await chrome.storage.sync.get(['autoSaveEnabled', 'autoSaveIntervalMinutes', 'currentStateName']);
    
    // If no data in sync, try to migrate from local storage
    if (!result.autoSaveEnabled && !result.currentStateName) {
      console.log('No sync data found, checking for local data to migrate...');
      const localResult = await chrome.storage.local.get(['autoSaveEnabled', 'autoSaveIntervalMinutes', 'currentStateName']);
      
      if (localResult.autoSaveEnabled || localResult.currentStateName) {
        console.log('Found local data, migrating to sync storage...');
        await migrateToSyncStorage(localResult);
        result = localResult;
      }
    }
    
    autoSaveEnabled = result.autoSaveEnabled || false;
    autoSaveInterval = result.autoSaveIntervalMinutes || 5;
    currentStateName = result.currentStateName || null;
    
    console.log('Loaded settings:', { autoSaveEnabled, autoSaveInterval, currentStateName });
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
      currentStateName: localData.currentStateName || null
    });
    
    // Migrate bookmark states if they exist
    const localStates = await chrome.storage.local.get(['bookmarkStates']);
    if (localStates.bookmarkStates) {
      await chrome.storage.sync.set({ bookmarkStates: localStates.bookmarkStates });
      console.log('Migrated bookmark states to sync storage');
    }
    
    // Clear local storage after successful migration
    await chrome.storage.local.clear();
    console.log('Successfully migrated from local to sync storage');
  } catch (error) {
    console.error('Migration failed:', error);
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
    const validStates = [];
    let corruptedCount = 0;

    for (const state of states) {
      try {
        // Check if backup folder exists
        if (state.backupFolderId) {
          const backupFolder = await chrome.bookmarks.get(state.backupFolderId);
          if (backupFolder) {
            validStates.push(state);
            console.log(`State "${state.name}" is valid`);
          } else {
            console.warn(`State "${state.name}" has invalid backup folder ID: ${state.backupFolderId}`);
            corruptedCount++;
          }
        } else {
          console.warn(`State "${state.name}" has no backup folder ID`);
          corruptedCount++;
        }
      } catch (error) {
        console.warn(`Error validating state "${state.name}":`, error);
        corruptedCount++;
      }
    }

    // Update storage with only valid states
    if (corruptedCount > 0) {
      console.log(`Found ${corruptedCount} corrupted states, cleaning up...`);
      await chrome.storage.sync.set({ bookmarkStates: validStates });
      
      // If current state is corrupted, clear it
      const currentStateName = await getCurrentStateName();
      if (currentStateName && !validStates.find(s => s.name === currentStateName)) {
        console.log(`Current state "${currentStateName}" is corrupted, clearing...`);
        await chrome.storage.sync.set({ currentStateName: null });
      }
      
      const message = `Removed ${corruptedCount} corrupted states. ${validStates.length} valid states remaining.`;
      console.log(`Cleanup complete. ${validStates.length} valid states remaining.`);
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
      periodInMinutes: autoSaveInterval
    });
    console.log(`Auto-save alarm created with ${autoSaveInterval} minute interval`);
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
chrome.alarms.onAlarm.addListener(async (alarm) => {
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
    console.log(`Bookmarks bar has ${bookmarksBar.length} items:`, bookmarksBar.map(b => ({ title: b.title, url: b.url, hasChildren: !!b.children })));
    
    // Check if a folder with this state name already exists in Other Bookmarks
    const otherBookmarks = await chrome.bookmarks.getChildren('2');
    let stateFolder = otherBookmarks.find(folder => folder.title === stateName);
    
    if (stateFolder) {
      console.log(`Found existing state folder: ${stateFolder.id}`);
      // Clear existing content
      const existingChildren = await chrome.bookmarks.getChildren(stateFolder.id);
      for (const child of existingChildren) {
        await chrome.bookmarks.removeTree(child.id);
      }
    } else {
      // Create a new state folder in "Other Bookmarks"
      stateFolder = await chrome.bookmarks.create({
        parentId: '2', // Other Bookmarks
        title: stateName
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
          url: bookmark.url
        });
      } else {
        // It's a folder - check if it has children
        console.log(`Saving folder: ${bookmark.title}`);
        const newFolder = await chrome.bookmarks.create({
          parentId: stateFolder.id,
          title: bookmark.title
        });
        
        // Get the children and recursively copy folder contents
        const folderChildren = await chrome.bookmarks.getChildren(bookmark.id);
        if (folderChildren && folderChildren.length > 0) {
          console.log(`Folder ${bookmark.title} has ${folderChildren.length} children`);
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
      states[existingStateIndex].lastUpdated = new Date().toISOString();
    } else {
      states.push({
        name: stateName,
        backupFolderId: stateFolder.id,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    await chrome.storage.sync.set({ bookmarkStates: states });

    return { success: true, message: `State "${stateName}" saved successfully` };
  } catch (error) {
    console.error('Error saving current state:', error);
    throw new Error('Failed to save current state');
  }
}

// Create a new empty state
async function createNewState(stateName) {
  try {
    // Check if state already exists
    const states = await getStoredStates();
    if (states.find(s => s.name === stateName)) {
      throw new Error('State with this name already exists');
    }

    // Create an empty state folder in Other Bookmarks
    const stateFolder = await chrome.bookmarks.create({
      parentId: '2', // Other Bookmarks
      title: stateName
    });

    // Add to states list
    states.push({
      name: stateName,
      backupFolderId: stateFolder.id,
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    await chrome.storage.sync.set({ bookmarkStates: states });

    return { success: true, message: `New state "${stateName}" created successfully` };
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
    
    if (!targetState.backupFolderId) {
      throw new Error('State backup folder not found');
    }
    
    console.log('Target state:', targetState);

    // First, auto-save current bookmarks bar if auto-save is enabled
    try {
      const existingStateName = await getCurrentStateName();
      if (autoSaveEnabled && existingStateName && existingStateName !== stateName) {
        console.log(`Auto-saving current state: ${existingStateName}`);
        await saveCurrentState(existingStateName);
      }
    } catch (autoSaveError) {
      console.warn('Auto-save failed, continuing with state switch:', autoSaveError);
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
    
    // Validate that the backup folder still exists
    try {
      const backupFolder = await chrome.bookmarks.get(targetState.backupFolderId);
      if (!backupFolder) {
        throw new Error(`Backup folder ${targetState.backupFolderId} not found`);
      }
      console.log('Backup folder validated:', backupFolder.title);
    } catch (error) {
      console.error('Backup folder validation failed:', error);
      throw new Error(`Backup folder for state "${stateName}" is missing. The state may have been corrupted.`);
    }
    
    // Get the children of the backup folder directly
    const backupChildren = await chrome.bookmarks.getChildren(targetState.backupFolderId);
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
            url: bookmark.url
          });
        } else {
          // It's a folder
          console.log(`Creating folder: ${bookmark.title} (ID: ${bookmark.id})`);
          const newFolder = await chrome.bookmarks.create({
            parentId: '1', // Bookmarks Bar
            title: bookmark.title
          });
          
          console.log(`Created new folder: ${newFolder.title} (ID: ${newFolder.id})`);
          
          // Recursively copy folder contents
          console.log(`Copying contents from folder ${bookmark.title} to ${newFolder.title}`);
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

    return { success: true, message: `Switched to "${stateName}" state successfully` };
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

    return { success: true, message: `State "${stateName}" deleted successfully` };
  } catch (error) {
    console.error('Error deleting state:', error);
    throw new Error('Failed to delete state');
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
    console.log(`copyBookmarkTree: source=${sourceBookmark.title} (${sourceBookmark.id}), target=${targetParentId}`);
    
    // Get the children of the source bookmark
    const children = await chrome.bookmarks.getChildren(sourceBookmark.id);
    console.log(`Found ${children.length} children in ${sourceBookmark.title}:`, children.map(c => ({ title: c.title, url: c.url, hasChildren: !!c.children })));
    
    if (children && children.length > 0) {
      for (const child of children) {
        if (child.url) {
          // It's a bookmark
          console.log(`Copying bookmark: ${child.title} to parent ${targetParentId}`);
          await chrome.bookmarks.create({
            parentId: targetParentId,
            title: child.title,
            url: child.url
          });
        } else {
          // It's a folder
          console.log(`Copying folder: ${child.title} to parent ${targetParentId}`);
          const newFolder = await chrome.bookmarks.create({
            parentId: targetParentId,
            title: child.title
          });
          
          console.log(`Created nested folder: ${newFolder.title} (${newFolder.id})`);
          
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
