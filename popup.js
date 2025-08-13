document.addEventListener('DOMContentLoaded', function() {
  const currentStateNameInput = document.getElementById('currentStateName');
  const saveCurrentStateBtn = document.getElementById('saveCurrentState');
  const createNewStateBtn = document.getElementById('createNewState');
  const refreshStatesBtn = document.getElementById('refreshStates');
  const statesList = document.getElementById('statesList');
  const status = document.getElementById('status');

  // Load current state name from storage
  chrome.storage.local.get(['currentStateName'], function(result) {
    if (result.currentStateName) {
      currentStateNameInput.value = result.currentStateName;
    }
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
        chrome.storage.local.set({ currentStateName: stateName });
        loadSavedStates();
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

  // Load saved states on popup open
  loadSavedStates();
});
