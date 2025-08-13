document.addEventListener('DOMContentLoaded', function() {
  const currentStateNameInput = document.getElementById('currentStateName');
  const saveCurrentStateBtn = document.getElementById('saveCurrentState');
  const createNewStateBtn = document.getElementById('createNewState');
  const refreshStatesBtn = document.getElementById('refreshStates');
  const statesList = document.getElementById('statesList');
  const status = document.getElementById('status');
  const autoSaveToggle = document.getElementById('autoSaveToggle');
  const autoSaveInterval = document.getElementById('autoSaveInterval');
  const exportStatesBtn = document.getElementById('exportStates');
  const importStatesBtn = document.getElementById('importStates');
  const importFileInput = document.getElementById('importFileInput');
  const syncIndicator = document.getElementById('syncIndicator');
  const syncText = document.getElementById('syncText');

  // Load current state name and settings from storage
  chrome.storage.sync.get(['currentStateName', 'autoSaveEnabled', 'autoSaveIntervalMinutes'], function(result) {
    if (result.currentStateName) {
      currentStateNameInput.value = result.currentStateName;
    }
    
    if (result.autoSaveEnabled !== undefined) {
      autoSaveToggle.checked = result.autoSaveEnabled;
    }
    
    if (result.autoSaveIntervalMinutes) {
      autoSaveInterval.value = result.autoSaveIntervalMinutes;
    }
  });

  // Check sync storage status
  checkSyncStatus();

  // Auto-save toggle handler
  autoSaveToggle.addEventListener('change', function() {
    const enabled = this.checked;
    const interval = parseInt(autoSaveInterval.value);
    
    chrome.storage.sync.set({ 
      autoSaveEnabled: enabled,
      autoSaveIntervalMinutes: interval
    }, () => {
      if (chrome.runtime.lastError) {
        showStatus(`Failed to save settings: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      // Send message to background script to update auto-save
      chrome.runtime.sendMessage({
        action: 'updateAutoSave',
        enabled: enabled,
        interval: interval
      });
      
      showStatus(`Auto-save ${enabled ? 'enabled' : 'disabled'}`, 'info');
      checkSyncStatus();
    });
  });

  // Auto-save interval handler
  autoSaveInterval.addEventListener('change', function() {
    const interval = parseInt(this.value);
    const enabled = autoSaveToggle.checked;
    
    chrome.storage.sync.set({ autoSaveIntervalMinutes: interval }, () => {
      if (chrome.runtime.lastError) {
        showStatus(`Failed to save interval: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (enabled) {
        chrome.runtime.sendMessage({
          action: 'updateAutoSave',
          enabled: true,
          interval: interval
        });
        
        showStatus(`Auto-save interval updated to ${interval} minute${interval > 1 ? 's' : ''}`, 'info');
      }
      
      checkSyncStatus();
    });
  });

  // Save current state
  saveCurrentStateBtn.addEventListener('click', function() {
    const stateName = currentStateNameInput.value.trim();
    if (!stateName) {
      showStatus('Please enter a state name', 'error');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'saveCurrentState',
      stateName: stateName
    }, function(response) {
      if (response.success) {
        showStatus(`Current state saved as "${stateName}"`, 'success');
        chrome.storage.sync.set({ currentStateName: stateName }, () => {
          if (chrome.runtime.lastError) {
            showStatus(`Failed to save state name: ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          loadSavedStates();
          checkSyncStatus();
        });
      } else {
        showStatus(response.error || 'Failed to save current state', 'error');
      }
    });
  });

  // Create new state
  createNewStateBtn.addEventListener('click', function() {
    const stateName = prompt('Enter a name for the new state:');
    if (stateName && stateName.trim()) {
      chrome.runtime.sendMessage({
        action: 'createNewState',
        stateName: stateName.trim()
      }, function(response) {
        if (response.success) {
          showStatus(`New state "${stateName}" created`, 'success');
          loadSavedStates();
        } else {
          showStatus(response.error || 'Failed to create new state', 'error');
        }
      });
    }
  });

  // Refresh states
  refreshStatesBtn.addEventListener('click', function() {
    loadSavedStates();
    showStatus('States refreshed', 'info');
  });

  // Load saved states
  function loadSavedStates() {
    chrome.runtime.sendMessage({
      action: 'getSavedStates'
    }, function(response) {
      if (response.success) {
        displayStates(response.states);
      } else {
        showStatus('Failed to load states', 'error');
      }
    });
  }

  // Display states in the list
  function displayStates(states) {
    statesList.innerHTML = '';
    
    if (states.length === 0) {
      statesList.innerHTML = '<div class="empty-state">No saved states yet</div>';
      return;
    }

    states.forEach(state => {
      const stateItem = document.createElement('div');
      stateItem.className = 'state-item';
      
      stateItem.innerHTML = `
        <span class="state-name">${state.name}</span>
        <div class="state-actions">
          <button class="switch-btn" data-state-name="${state.name}">Switch To</button>
          <button class="delete-btn danger" data-state-name="${state.name}">Delete</button>
        </div>
      `;

      // Add event listeners
      const switchBtn = stateItem.querySelector('.switch-btn');
      const deleteBtn = stateItem.querySelector('.delete-btn');

      switchBtn.addEventListener('click', function() {
        const stateName = this.getAttribute('data-state-name');
        switchToState(stateName);
      });

      deleteBtn.addEventListener('click', function() {
        const stateName = this.getAttribute('data-state-name');
        deleteState(stateName);
      });

      statesList.appendChild(stateItem);
    });
  }

  // Switch to a specific state
  function switchToState(stateName) {
    showStatus(`Switching to "${stateName}" state...`, 'info');
    
    chrome.runtime.sendMessage({
      action: 'switchToState',
      stateName: stateName
    }, function(response) {
      if (response.success) {
        showStatus(`Switched to "${stateName}" state`, 'success');
        currentStateNameInput.value = stateName;
        chrome.storage.local.set({ currentStateName: stateName });
        loadSavedStates();
      } else {
        console.error('Switch state error:', response.error);
        showStatus(`Failed to switch state: ${response.error}`, 'error');
      }
    });
  }

  // Delete a state
  function deleteState(stateName) {
    if (confirm(`Are you sure you want to delete the "${stateName}" state?`)) {
      chrome.runtime.sendMessage({
        action: 'deleteState',
        stateName: stateName
      }, function(response) {
        if (response.success) {
          showStatus(`State "${stateName}" deleted`, 'success');
          loadSavedStates();
        } else {
          showStatus(response.error || 'Failed to delete state', 'error');
        }
      });
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
  exportStatesBtn.addEventListener('click', exportStates);

  // Import states
  importStatesBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', handleImportFile);

  // Check sync storage status
  function checkSyncStatus() {
    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
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
  function exportStates() {
    chrome.storage.sync.get(['bookmarkStates', 'currentStateName', 'autoSaveEnabled', 'autoSaveIntervalMinutes'], (data) => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: data
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookmarks-bar-switcher-${new Date().toISOString().split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showStatus('States exported successfully', 'success');
    });
  }

  // Handle import file selection
  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        
        if (!importData.data || !importData.version) {
          throw new Error('Invalid export file format');
        }
        
        // Confirm import
        if (confirm('This will replace all existing states. Are you sure?')) {
          importStates(importData.data);
        }
      } catch (error) {
        showStatus(`Import failed: ${error.message}`, 'error');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }

  // Import states from data
  function importStates(data) {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        showStatus(`Import failed: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      showStatus('States imported successfully', 'success');
      loadSavedStates();
      checkSyncStatus();
      
      // Update UI with imported data
      if (data.currentStateName) {
        currentStateNameInput.value = data.currentStateName;
      }
      
      if (data.autoSaveEnabled !== undefined) {
        autoSaveToggle.checked = data.autoSaveEnabled;
      }
      
      if (data.autoSaveIntervalMinutes) {
        autoSaveInterval.value = data.autoSaveIntervalMinutes;
      }
    });
  }

  // Load saved states on popup open
  loadSavedStates();
});
