// Background service worker for Bookmarks Bar Switcher

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'saveCurrentState':
      saveCurrentState(request.stateName)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

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
  }
});

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

    await chrome.storage.local.set({ bookmarkStates: states });

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

    await chrome.storage.local.set({ bookmarkStates: states });

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

    // First, backup current bookmarks bar
    const currentStateName = await getCurrentStateName();
    if (currentStateName && currentStateName !== stateName) {
      console.log(`Backing up current state: ${currentStateName}`);
      await saveCurrentState(currentStateName);
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
    await chrome.storage.local.set({ currentStateName: stateName });

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
    await chrome.storage.local.set({ bookmarkStates: states });

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
  const result = await chrome.storage.local.get(['bookmarkStates']);
  return result.bookmarkStates || [];
}

// Helper function to get current state name
async function getCurrentStateName() {
  const result = await chrome.storage.local.get(['currentStateName']);
  return result.currentStateName || null;
}
