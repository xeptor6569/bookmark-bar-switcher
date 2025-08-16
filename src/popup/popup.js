document.addEventListener('DOMContentLoaded', function () {
  // First-time setup elements
  const firstTimeSetup = document.getElementById('firstTimeSetup');
  const mainInterface = document.getElementById('mainInterface');
  const firstStateNameInput = document.getElementById('firstStateName');
  const createFirstStateBtn = document.getElementById('createFirstState');
  const skipSetupBtn = document.getElementById('skipSetup');

  // Main interface elements
  const saveCurrentStateBtn = document.getElementById('saveCurrentState');
  const createNewStateBtn = document.getElementById('createNewState');
  const refreshStatesBtn = document.getElementById('refreshStates');
  const statesList = document.getElementById('statesList');
  const status = document.getElementById('status');
  const autoSaveToggle = document.getElementById('autoSaveToggle');
  const autoSaveInterval = document.getElementById('autoSaveInterval');
  const exportStatesBtn = document.getElementById('exportStates');
  const performExportBtn = document.getElementById('performExport');
  const importStatesBtn = document.getElementById('importStates');
  const cleanupStatesBtn = document.getElementById('cleanupStates');
  const importFileInput = document.getElementById('importFileInput');
  const syncIndicator = document.getElementById('syncIndicator');
  const syncText = document.getElementById('syncText');
  const exportOptions = document.getElementById('exportOptions');
  const includeBookmarksCheckbox = document.getElementById('includeBookmarks');
  const privacyOptions = document.getElementById('privacyOptions');
  const privacyLevelSelect = document.getElementById('privacyLevel');

  // Load current state name and settings from storage
  chrome.storage.sync.get(
    ['currentStateName', 'autoSaveEnabled', 'autoSaveIntervalMinutes'],
    function (result) {
      if (result.currentStateName) {
        // Store the current state name globally so displayStates can access it
        window.currentStateName = result.currentStateName;
      }

      if (result.autoSaveEnabled !== undefined) {
        autoSaveToggle.checked = result.autoSaveEnabled;
      }

      if (result.autoSaveIntervalMinutes) {
        autoSaveInterval.value = result.autoSaveIntervalMinutes;
      }
    }
  );

  // Check if this is first-time setup
  chrome.storage.sync.get(['bookmarkStates'], function (result) {
    if (!result.bookmarkStates || result.bookmarkStates.length === 0) {
      // First time - show setup screen
      firstTimeSetup.style.display = 'block';
      mainInterface.style.display = 'none';
    } else {
      // Has existing states - show main interface
      firstTimeSetup.style.display = 'none';
      mainInterface.style.display = 'block';
      loadSavedStates();
    }
  });

  // Check sync storage status
  checkSyncStatus();

  // First-time setup event listeners
  createFirstStateBtn.addEventListener('click', function () {
    const stateName = firstStateNameInput.value.trim();
    if (!stateName) {
      showStatus('Please enter a state name', 'error');
      return;
    }

    showStatus('Creating your first state...', 'info');

    chrome.runtime.sendMessage(
      {
        action: 'saveCurrentState',
        stateName: stateName,
      },
      function (response) {
        if (response && response.success) {
          showStatus('First state created successfully!', 'success');

          // Hide setup, show main interface
          firstTimeSetup.style.display = 'none';
          mainInterface.style.display = 'block';

          // Set the current state name
          // This line is no longer needed as currentStateNameInput is removed
          // currentStateNameInput.value = stateName;

          // Load the states list
          loadSavedStates();
        } else {
          showStatus('Failed to create first state', 'error');
        }
      }
    );
  });

  skipSetupBtn.addEventListener('click', function () {
    // Hide setup, show main interface
    firstTimeSetup.style.display = 'none';
    mainInterface.style.display = 'block';

    // Load empty states list
    loadSavedStates();
  });

  // Auto-save toggle handler
  autoSaveToggle.addEventListener('change', function () {
    const enabled = this.checked;
    const interval = parseInt(autoSaveInterval.value);

    chrome.storage.sync.set(
      {
        autoSaveEnabled: enabled,
        autoSaveIntervalMinutes: interval,
      },
      () => {
        if (chrome.runtime.lastError) {
          showStatus(
            `Failed to save settings: ${chrome.runtime.lastError.message}`,
            'error'
          );
          return;
        }

        // Send message to background script to update auto-save
        chrome.runtime.sendMessage({
          action: 'updateAutoSave',
          enabled: enabled,
          interval: interval,
        });

        showStatus(`Auto-save ${enabled ? 'enabled' : 'disabled'}`, 'info');
        checkSyncStatus();
      }
    );
  });

  // Auto-save interval handler
  autoSaveInterval.addEventListener('change', function () {
    const interval = parseInt(this.value);
    const enabled = autoSaveToggle.checked;

    chrome.storage.sync.set({ autoSaveIntervalMinutes: interval }, () => {
      if (chrome.runtime.lastError) {
        showStatus(
          `Failed to save interval: ${chrome.runtime.lastError.message}`,
          'error'
        );
        return;
      }

      if (enabled) {
        chrome.runtime.sendMessage({
          action: 'updateAutoSave',
          enabled: true,
          interval: interval,
        });

        showStatus(
          `Auto-save interval updated to ${interval} minute${
            interval > 1 ? 's' : ''
          }`,
          'info'
        );
      }

      checkSyncStatus();
    });
  });

  // Save current state
  saveCurrentStateBtn.addEventListener('click', function () {
    // Get the currently active state name from the highlighted state in the list
    const activeStateItem = document.querySelector('.state-item.active-state');
    if (!activeStateItem) {
      showStatus('No active state to save', 'error');
      return;
    }
    
    const stateName = activeStateItem.querySelector('.state-name').textContent;
    
    // Save the current bookmark bar state to the active state
    chrome.runtime.sendMessage(
      {
        action: 'saveCurrentState',
        stateName: stateName,
      },
      function (response) {
        if (response.success) {
          showStatus(`Current state saved to "${stateName}"`, 'success');
          loadSavedStates(); // Refresh the display
        } else {
          showStatus(response.error || 'Failed to save current state', 'error');
        }
      }
    );
  });

  // Create new state
  createNewStateBtn.addEventListener('click', function () {
    const stateName = prompt('Enter a name for the new state:');
    if (stateName && stateName.trim()) {
      chrome.runtime.sendMessage(
        {
          action: 'createNewState',
          stateName: stateName.trim(),
        },
        function (response) {
          if (response.success) {
            showStatus(`New state "${stateName}" created`, 'success');
            loadSavedStates();
          } else {
            showStatus(response.error || 'Failed to create new state', 'error');
          }
        }
      );
    }
  });

  // Refresh states
  refreshStatesBtn.addEventListener('click', function () {
    loadSavedStates();
    showStatus('States refreshed', 'info');
  });

  // Load saved states
  function loadSavedStates() {
    chrome.runtime.sendMessage(
      {
        action: 'getSavedStates',
      },
      function (response) {
        if (response.success) {
          displayStates(response.states);
        } else {
          showStatus('Failed to load states', 'error');
        }
      }
    );
  }

  // Display states in the list
  function displayStates(states) {
    statesList.innerHTML = '';

    if (states.length === 0) {
      statesList.innerHTML =
        '<div class="empty-state">No saved states yet</div>';
      return;
    }

    states.forEach(state => {
      const stateItem = document.createElement('div');
      stateItem.className = 'state-item';
      
      // Check if this is the current active state
      const currentStateName = getCurrentStateNameFromStorage();
      const isActive = state.name === currentStateName;
      if (isActive) {
        stateItem.classList.add('active-state');
      }

      stateItem.innerHTML = `
        <div class="state-info">
          <div class="state-header">
            <span class="state-name ${isActive ? 'active' : ''}">${state.name}</span>
            ${isActive ? '<span class="active-indicator">✓ Active</span>' : ''}
          </div>
          <div class="state-meta">
            <small class="state-date">Last updated: ${formatDate(state.lastUpdated)}</small>
          </div>
        </div>
        <div class="state-actions">
          <button class="rename-btn" data-state-name="${state.name}" title="Rename state">✏️</button>
          <button class="switch-btn" data-state-name="${state.name}">Switch To</button>
          <button class="delete-btn danger" data-state-name="${state.name}">Delete</button>
        </div>
      `;

      // Add event listeners
      const switchBtn = stateItem.querySelector('.switch-btn');
      const deleteBtn = stateItem.querySelector('.delete-btn');
      const renameBtn = stateItem.querySelector('.rename-btn');

      switchBtn.addEventListener('click', function () {
        const stateName = this.getAttribute('data-state-name');
        switchToState(stateName);
      });

      deleteBtn.addEventListener('click', function () {
        const stateName = this.getAttribute('data-state-name');
        deleteState(stateName);
      });

      renameBtn.addEventListener('click', function () {
        const stateName = this.getAttribute('data-state-name');
        startRenameState(stateName, stateItem);
      });

      statesList.appendChild(stateItem);
    });
  }

  // Switch to a specific state
  function switchToState(stateName) {
    showStatus(`Switching to "${stateName}" state...`, 'info');

    chrome.runtime.sendMessage(
      {
        action: 'switchToState',
        stateName: stateName,
      },
      function (response) {
        if (response.success) {
          showStatus(`Switched to "${stateName}" state`, 'success');
          // Update the global current state name
          window.currentStateName = stateName;
          // Save to storage
          chrome.storage.sync.set({ currentStateName: stateName });
          loadSavedStates();
        } else {
          console.error('Switch state error:', response.error);
          showStatus(`Failed to switch state: ${response.error}`, 'error');
        }
      }
    );
  }

  // Delete a state
  function deleteState(stateName) {
    if (confirm(`Are you sure you want to delete the "${stateName}" state?`)) {
      chrome.runtime.sendMessage(
        {
          action: 'deleteState',
          stateName: stateName,
        },
        function (response) {
          if (response.success) {
            showStatus(`State "${stateName}" deleted`, 'success');
            loadSavedStates();
          } else {
            showStatus(response.error || 'Failed to delete state', 'error');
          }
        }
      );
    }
  }

  // Show status message
  function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      status.textContent = '';
      status.className = 'status';
    }, 3000);
  }

  // Export states
  exportStatesBtn.addEventListener('click', () => {
    exportOptions.style.display = 'block';
    performExportBtn.style.display = 'block';
  });

  // Perform export
  performExportBtn.addEventListener('click', performExport);

  // Cleanup states
  cleanupStatesBtn.addEventListener('click', cleanupStates);

  // Debug mode toggle
  const debugModeToggle = document.getElementById('debugModeToggle');
  const debugOptions = document.getElementById('debugOptions');

  debugModeToggle.addEventListener('change', function() {
    debugOptions.style.display = this.checked ? 'block' : 'none';
    
    // Save debug mode preference
    chrome.storage.sync.set({ debugModeEnabled: this.checked });
  });

  // Load debug mode preference
  chrome.storage.sync.get(['debugModeEnabled'], function(result) {
    if (result.debugModeEnabled) {
      debugModeToggle.checked = true;
      debugOptions.style.display = 'block';
    }
  });

  // Validate states
  document.getElementById('validateStates').addEventListener('click', async () => {
    try {
      showStatus('Validating states...', 'info');
      const response = await chrome.runtime.sendMessage({
        action: 'validateStates',
      });
      if (response && response.success) {
        showStatus(response.message, 'success');
        await loadSavedStates(); // Refresh the states list
      } else {
        showStatus('Failed to validate states', 'error');
      }
    } catch (error) {
      console.error('Error handling response:', error);
      showStatus('Error during state validation', 'error');
    }
  });

  // Check storage
  document.getElementById('checkStorage').addEventListener('click', async () => {
    try {
      showStatus('Checking storage...', 'info');
      const response = await chrome.runtime.sendMessage({
        action: 'checkStorage',
      });
      if (response && response.success) {
        showStatus(response.message, 'success');
        console.log('Storage contents:', response.data);
      } else {
        showStatus('Failed to check storage', 'error');
      }
    } catch (error) {
      console.error('Error handling response:', error);
      showStatus('Error during storage check', 'error');
    }
  });

  // Recover orphaned states
  document.getElementById('recoverOrphaned').addEventListener('click', async () => {
    try {
      showStatus('Recovering orphaned states...', 'info');
      const response = await chrome.runtime.sendMessage({
        action: 'recoverOrphaned',
      });
      if (response && response.success) {
        showStatus(response.message, 'success');
        await loadSavedStates(); // Refresh the states list
      } else {
        showStatus('Failed to recover orphaned states', 'error');
      }
    } catch (error) {
      console.error('Error handling response:', error);
      showStatus('Error during orphaned state recovery', 'error');
    }
  });

  // Reset to setup
  document.getElementById('resetToSetup').addEventListener('click', async () => {
    if (
      confirm(
        'This will clear all states and reset to first-time setup. Are you sure?'
      )
    ) {
      try {
        showStatus('Resetting to setup...', 'info');

        // Clear all states from storage
        await chrome.storage.sync.remove([
          'bookmarkStates',
          'currentStateName',
        ]);

        // Show setup screen
        firstTimeSetup.style.display = 'block';
        mainInterface.style.display = 'none';

        // Clear the first state name input
        firstStateNameInput.value = '';

        showStatus('Reset to setup complete', 'success');
      } catch (error) {
        console.error('Error during reset:', error);
        showStatus('Error during reset', 'error');
      }
    }
  });

  // Handle export options
  includeBookmarksCheckbox.addEventListener('change', function () {
    privacyOptions.style.display = this.checked ? 'block' : 'none';

    // Update export button text
    if (this.checked) {
      const privacyLevel = privacyLevelSelect.value;
      const privacyText =
        privacyLevel === 'hidden'
          ? '🔒'
          : privacyLevel === 'domain'
          ? '🌐'
          : '📖';
      performExportBtn.textContent = `Export with Bookmarks ${privacyText}`;
    } else {
      performExportBtn.textContent = 'Export States Only';
    }
  });

  // Handle privacy level change
  privacyLevelSelect.addEventListener('change', function () {
    // Update the export button text based on privacy level
    const privacyText =
      this.value === 'hidden' ? '🔒' : this.value === 'domain' ? '🌐' : '📖';
    exportStatesBtn.textContent = `Export States ${privacyText}`;
  });

  // Import states
  importStatesBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', handleImportFile);

  // Check sync storage status
  function checkSyncStatus() {
    chrome.storage.sync.getBytesInUse(null, bytesInUse => {
      if (chrome.runtime.lastError) {
        updateSyncStatus('error', 'Sync not available');
        return;
      }

      const maxBytes = 100 * 1024; // 100KB limit for sync storage
      const usagePercent = Math.round((bytesInUse / maxBytes) * 100);

      if (usagePercent > 90) {
        updateSyncStatus('warning', `Storage: ${usagePercent}% used`);
      } else {
        updateSyncStatus('synced', `Storage: ${usagePercent}% used`);
      }
    });
  }

  // Update sync status display
  function updateSyncStatus(type, text) {
    syncIndicator.className = `sync-indicator ${type}`;
    syncText.textContent = text;

    if (type === 'synced') {
      syncIndicator.textContent = '✅';
    } else if (type === 'error') {
      syncIndicator.textContent = '❌';
    } else if (type === 'warning') {
      syncIndicator.textContent = '⚠️';
    } else {
      syncIndicator.textContent = '🔄';
    }
  }

  // Export states to JSON file
  async function performExport() {
    try {
      showStatus('Preparing export...', 'info');

      const includeBookmarks = includeBookmarksCheckbox.checked;
      const privacyLevel = privacyLevelSelect.value;

      // Get basic state data
      const data = await chrome.storage.sync.get([
        'bookmarkStates',
        'currentStateName',
        'autoSaveEnabled',
        'autoSaveIntervalMinutes',
      ]);

      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportOptions: {
          includeBookmarks: includeBookmarks,
          privacyLevel: privacyLevel,
        },
        data: {
          ...data,
          // Ensure backup folder names are included for reliability
          bookmarkStates: data.bookmarkStates
            ? data.bookmarkStates.map(state => ({
                ...state,
                backupFolderName: state.backupFolderName || state.name, // Fallback to state name if missing
              }))
            : [],
        },
      };

      // If including bookmarks, fetch the actual bookmark content
      if (includeBookmarks && data.bookmarkStates) {
        exportData.data.bookmarkStates = await Promise.all(
          data.bookmarkStates.map(async state => {
            const enhancedState = { ...state };

            try {
              // Get the backup folder for this state
              const backupFolder = await chrome.bookmarks.get(
                state.backupFolderId
              );
              if (backupFolder) {
                // Get all bookmarks in the backup folder
                const bookmarks = await chrome.bookmarks.getChildren(
                  state.backupFolderId
                );
                enhancedState.bookmarks = await processBookmarksForExport(
                  bookmarks,
                  privacyLevel
                );
              }
            } catch (error) {
              console.warn(
                `Could not fetch bookmarks for state ${state.name}:`,
                error
              );
              enhancedState.bookmarks = [];
            }

            return enhancedState;
          })
        );
      }

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookmarks-bar-switcher-${
        new Date().toISOString().split('T')[0]
      }.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Hide export options after successful export
      exportOptions.style.display = 'none';
      performExportBtn.style.display = 'none';

      showStatus('Export completed successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showStatus(`Export failed: ${error.message}`, 'error');
    }
  }

  // Process bookmarks for export based on privacy level
  async function processBookmarksForExport(bookmarks, privacyLevel) {
    const processedBookmarks = [];

    for (const bookmark of bookmarks) {
      const processedBookmark = {
        title: bookmark.title,
        type: bookmark.url ? 'bookmark' : 'folder',
      };

      if (bookmark.url) {
        // It's a bookmark - handle URL based on privacy level
        switch (privacyLevel) {
          case 'hidden':
            processedBookmark.url = '[HIDDEN]';
            break;
          case 'domain':
            try {
              const url = new URL(bookmark.url);
              processedBookmark.url = url.hostname;
            } catch {
              processedBookmark.url = '[INVALID_URL]';
            }
            break;
          case 'full':
            processedBookmark.url = bookmark.url;
            break;
        }
      } else {
        // It's a folder - recursively process children
        try {
          const children = await chrome.bookmarks.getChildren(bookmark.id);
          if (children && children.length > 0) {
            processedBookmark.children = await processBookmarksForExport(
              children,
              privacyLevel
            );
          }
        } catch (error) {
          console.warn(
            `Could not fetch children for folder ${bookmark.title}:`,
            error
          );
          processedBookmark.children = [];
        }
      }

      processedBookmarks.push(processedBookmark);
    }

    return processedBookmarks;
  }

  // Handle import file selection
  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const importData = JSON.parse(e.target.result);

        if (!importData.data || !importData.version) {
          throw new Error('Invalid export file format');
        }

        // Check if this is an enhanced export with bookmarks
        const hasBookmarks =
          importData.data.bookmarkStates &&
          importData.data.bookmarkStates.some(state => state.bookmarks);

        let confirmMessage = 'This will replace all existing states.';
        if (hasBookmarks) {
          confirmMessage +=
            '\n\nThis export includes bookmark content and will restore the complete bookmark structure.';
        }
        confirmMessage += '\n\nAre you sure?';

        // Confirm import
        if (confirm(confirmMessage)) {
          importStates(importData.data, hasBookmarks);
        }
      } catch (error) {
        showStatus(`Import failed: ${error.message}`, 'error');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }

  // Import states from data
  async function importStates(data, hasBookmarks = false) {
    try {
      if (hasBookmarks) {
        // Enhanced import with bookmark content
        await importStatesWithBookmarks(data);
      } else {
        // Basic import - just settings and state metadata
        await chrome.storage.sync.set(data);
      }

      showStatus('States imported successfully', 'success');
      loadSavedStates();
      checkSyncStatus();

      // Update UI with imported data
      // This line is no longer needed as currentStateNameInput is removed
      // if (data.currentStateName) {
      //   currentStateNameInput.value = data.currentStateName;
      // }

      if (data.autoSaveEnabled !== undefined) {
        autoSaveToggle.checked = data.autoSaveEnabled;
      }

      if (data.autoSaveIntervalMinutes) {
        autoSaveInterval.value = data.autoSaveIntervalMinutes;
      }
    } catch (error) {
      console.error('Import failed:', error);
      showStatus(`Import failed: ${error.message}`, 'error');
    }
  }

  // Import states with bookmark content
  async function importStatesWithBookmarks(data) {
    // First, import the basic data
    await chrome.storage.sync.set(data);

    // Then restore bookmark content for each state
    if (data.bookmarkStates) {
      for (const state of data.bookmarkStates) {
        if (state.bookmarks) {
          try {
            // Find or create the backup folder
            let backupFolderId = state.backupFolderId;

            if (!backupFolderId && state.backupFolderName) {
              // Try to find existing folder by name
              const otherBookmarks = await chrome.bookmarks.getChildren('2');
              const existingFolder = otherBookmarks.find(
                f => f.title === state.backupFolderName
              );

              if (existingFolder) {
                backupFolderId = existingFolder.id;
                console.log(
                  `Found existing folder for state "${state.name}": ${existingFolder.title}`
                );
              } else {
                // Create new folder
                const newFolder = await chrome.bookmarks.create({
                  parentId: '2', // Other Bookmarks
                  title: state.backupFolderName,
                });
                backupFolderId = newFolder.id;
                console.log(
                  `Created new folder for state "${state.name}": ${newFolder.title}`
                );
              }
            }

            if (backupFolderId) {
              // Clear existing content in the backup folder
              const existingChildren = await chrome.bookmarks.getChildren(
                backupFolderId
              );
              for (const child of existingChildren) {
                await chrome.bookmarks.removeTree(child.id);
              }

              // Restore bookmarks from the export
              await restoreBookmarksFromExport(state.bookmarks, backupFolderId);

              console.log(`Restored bookmarks for state: ${state.name}`);
            } else {
              console.warn(
                `No backup folder ID or name for state: ${state.name}`
              );
            }
          } catch (error) {
            console.warn(
              `Failed to restore bookmarks for state ${state.name}:`,
              error
            );
          }
        }
      }
    }
  }

  // Restore bookmarks from export data
  async function restoreBookmarksFromExport(bookmarks, parentId) {
    for (const bookmark of bookmarks) {
      if (
        bookmark.type === 'bookmark' &&
        bookmark.url &&
        bookmark.url !== '[HIDDEN]'
      ) {
        // Create bookmark (only if URL is not hidden)
        try {
          await chrome.bookmarks.create({
            parentId: parentId,
            title: bookmark.title,
            url: bookmark.url,
          });
        } catch (error) {
          console.warn(`Failed to create bookmark ${bookmark.title}:`, error);
        }
      } else if (bookmark.type === 'folder') {
        // Create folder
        try {
          const newFolder = await chrome.bookmarks.create({
            parentId: parentId,
            title: bookmark.title,
          });

          // Recursively restore children
          if (bookmark.children && bookmark.children.length > 0) {
            await restoreBookmarksFromExport(bookmark.children, newFolder.id);
          }
        } catch (error) {
          console.warn(`Failed to create folder ${bookmark.title}:`, error);
        }
      }
    }
  }

  // Cleanup corrupted states
  async function cleanupStates() {
    try {
      showStatus('Cleaning up states...', 'info');

      // Send message to background script to perform cleanup
      chrome.runtime.sendMessage(
        {
          action: 'cleanupStates',
        },
        function (response) {
          if (response.success) {
            showStatus(`Cleanup complete: ${response.message}`, 'success');
            loadSavedStates();
            checkSyncStatus();
          } else {
            showStatus(`Cleanup failed: ${response.error}`, 'error');
          }
        }
      );
    } catch (error) {
      console.error('Cleanup failed:', error);
      showStatus(`Cleanup failed: ${error.message}`, 'error');
    }
  }

  // Load saved states on popup open
  loadSavedStates();

  // Helper function to format dates
  function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Today';
      if (diffDays === 2) return 'Yesterday';
      if (diffDays <= 7) return `${diffDays - 1} days ago`;
      
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  }

  // Start renaming a state
  function startRenameState(stateName, stateItem) {
    const stateInfo = stateItem.querySelector('.state-info');
    const stateActions = stateItem.querySelector('.state-actions');
    
    // Create editing interface
    const editInterface = `
      <div class="edit-state-interface">
        <div class="edit-header">
          <span class="edit-label">Rename State</span>
        </div>
        <div class="edit-input-container">
          <input type="text" class="rename-input" value="${stateName}" maxlength="50" />
        </div>
        <div class="edit-actions">
          <button class="save-rename-btn primary">Save</button>
          <button class="cancel-rename-btn secondary">Cancel</button>
        </div>
      </div>
    `;
    
    // Hide normal state and show editing interface
    stateInfo.style.display = 'none';
    stateActions.style.display = 'none';
    
    // Insert editing interface
    stateItem.insertAdjacentHTML('beforeend', editInterface);
    
    // Get references to new elements
    const editInterfaceElement = stateItem.querySelector('.edit-state-interface');
    const input = editInterfaceElement.querySelector('.rename-input');
    const saveBtn = editInterfaceElement.querySelector('.save-rename-btn');
    const cancelBtn = editInterfaceElement.querySelector('.cancel-rename-btn');
    
    // Focus and select input
    input.focus();
    input.select();
    
    // Handle save button
    saveBtn.addEventListener('click', () => {
      const newName = input.value.trim();
      if (newName && newName !== stateName) {
        renameState(stateName, newName);
      } else if (newName === stateName) {
        // No changes made
        cancelRename();
      } else {
        showStatus('State name cannot be empty', 'error');
        input.focus();
      }
    });
    
    // Handle cancel button
    cancelBtn.addEventListener('click', cancelRename);
    
    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      } else if (e.key === 'Escape') {
        cancelRename();
      }
    });
    
    // Handle input validation
    input.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      saveBtn.disabled = !value || value === stateName;
    });
    
    // Function to cancel and restore original state
    function cancelRename() {
      editInterfaceElement.remove();
      stateInfo.style.display = 'block';
      stateActions.style.display = 'flex';
    }
  }

  // Rename a state
  async function renameState(oldName, newName) {
    try {
      // Validate input
      if (!newName || newName.trim().length === 0) {
        showStatus('State name cannot be empty', 'error');
        return;
      }

      if (newName.length > 50) {
        showStatus('State name cannot exceed 50 characters', 'error');
        return;
      }

      if (newName === oldName) {
        showStatus('No changes made', 'info');
        return;
      }

      showStatus(`Renaming state "${oldName}" to "${newName}"...`, 'info');
      
      // Send message to background script to rename state
      const response = await chrome.runtime.sendMessage({
        action: 'renameState',
        oldName: oldName,
        newName: newName
      });
      
      if (response && response.success) {
        showStatus(`State renamed to "${newName}"`, 'success');
        
        // Update current state name if it was renamed
        // This line is no longer needed as currentStateNameInput is removed
        // if (currentStateNameInput.value === oldName) {
        //   currentStateNameInput.value = newName;
        // }
        
        // Refresh the states list
        loadSavedStates();
      } else {
        showStatus(response.error || 'Failed to rename state', 'error');
        // Refresh states list to restore original state
        loadSavedStates();
      }
    } catch (error) {
      console.error('Error renaming state:', error);
      showStatus('Failed to rename state', 'error');
      // Refresh states list to restore original state
      loadSavedStates();
    }
  }

  // Get current state name from storage
  function getCurrentStateNameFromStorage() {
    // This function needs to be async to properly get from storage
    // For now, we'll use a global variable that gets set when loading
    return window.currentStateName || null;
  }

  // Check if this is first-time setup
  chrome.storage.sync.get(['bookmarkStates'], function (result) {
    if (!result.bookmarkStates || result.bookmarkStates.length === 0) {
      // First time - show setup screen
      firstTimeSetup.style.display = 'block';
      mainInterface.style.display = 'none';
    } else {
      // Has existing states - show main interface
      firstTimeSetup.style.display = 'none';
      mainInterface.style.display = 'block';
      loadSavedStates();
    }
  });
});
