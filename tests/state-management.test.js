// Test state management functionality including renaming and validation
describe('State Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Chrome APIs
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      },
      runtime: {
        sendMessage: jest.fn()
      }
    };
  });

  describe('State Renaming', () => {
    it('should validate new state names correctly', () => {
      const validateStateName = (name) => {
        if (!name || name.trim().length === 0) {
          return { valid: false, error: 'State name cannot be empty' };
        }
        if (name.length > 50) {
          return { valid: false, error: 'State name cannot exceed 50 characters' };
        }
        return { valid: true };
      };

      // Test empty name
      expect(validateStateName('')).toEqual({
        valid: false,
        error: 'State name cannot be empty'
      });

      // Test whitespace only
      expect(validateStateName('   ')).toEqual({
        valid: false,
        error: 'State name cannot be empty'
      });

      // Test too long name
      const longName = 'a'.repeat(51);
      expect(validateStateName(longName)).toEqual({
        valid: false,
        error: 'State name cannot exceed 50 characters'
      });

      // Test valid name
      expect(validateStateName('Work Projects')).toEqual({
        valid: true
      });

      // Test edge case - exactly 50 characters
      const exactName = 'a'.repeat(50);
      expect(validateStateName(exactName)).toEqual({
        valid: true
      });
    });

    it('should handle state name conflicts correctly', () => {
      const existingStates = [
        { name: 'Personal' },
        { name: 'Work' },
        { name: 'Development' }
      ];

      const checkNameConflict = (newName, oldName, states) => {
        const existingState = states.find(s => s.name === newName);
        return !!(existingState && existingState.name !== oldName);
      };

      // Test renaming to existing name
      expect(checkNameConflict('Work', 'Personal', existingStates)).toBe(true);

      // Test renaming to same name (no conflict)
      expect(checkNameConflict('Personal', 'Personal', existingStates)).toBe(false);

      // Test renaming to new name
      expect(checkNameConflict('Projects', 'Personal', existingStates)).toBe(false);
    });

    it('should update current state name when active state is renamed', async () => {
      const oldName = 'Work';
      const newName = 'Work Projects';
      const currentStateName = 'Work';

      // Mock storage operations
      chrome.storage.sync.set.mockResolvedValue();

      // Simulate the rename logic
      let updatedCurrentState = currentStateName;
      if (currentStateName === oldName) {
        updatedCurrentState = newName;
        await chrome.storage.sync.set({ currentStateName: newName });
      }

      expect(updatedCurrentState).toBe('Work Projects');
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ currentStateName: 'Work Projects' });
    });

    it('should not update current state name when non-active state is renamed', async () => {
      const oldName = 'Personal';
      const newName = 'Personal Projects';
      const currentStateName = 'Work';

      // Mock storage operations
      chrome.storage.sync.set.mockResolvedValue();

      // Simulate the rename logic
      let updatedCurrentState = currentStateName;
      if (currentStateName === oldName) {
        updatedCurrentState = newName;
        await chrome.storage.sync.set({ currentStateName: newName });
      }

      expect(updatedCurrentState).toBe('Work');
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });

  describe('State Deletion', () => {
    it('should clear current state when active state is deleted', async () => {
      const deletedStateName = 'Work';
      const currentStateName = 'Work';

      // Mock storage operations
      chrome.storage.sync.remove.mockResolvedValue();

      // Simulate deletion logic
      let updatedCurrentState = currentStateName;
      if (currentStateName === deletedStateName) {
        updatedCurrentState = null;
        await chrome.storage.sync.remove(['currentStateName']);
      }

      expect(updatedCurrentState).toBe(null);
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(['currentStateName']);
    });

    it('should not affect current state when non-active state is deleted', async () => {
      const deletedStateName = 'Personal';
      const currentStateName = 'Work';

      // Mock storage operations
      chrome.storage.sync.remove.mockResolvedValue();

      // Simulate deletion logic
      let updatedCurrentState = currentStateName;
      if (currentStateName === deletedStateName) {
        updatedCurrentState = null;
        await chrome.storage.sync.remove(['currentStateName']);
      }

      expect(updatedCurrentState).toBe('Work');
      expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
    });
  });

  describe('State Loading', () => {
    it('should handle empty states list correctly', async () => {
      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: [] });

      const result = await chrome.storage.sync.get(['bookmarkStates']);
      const states = result.bookmarkStates || [];

      expect(states).toEqual([]);
      expect(states.length).toBe(0);
    });

    it('should handle missing bookmarkStates property', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      const result = await chrome.storage.sync.get(['bookmarkStates']);
      const states = result.bookmarkStates || [];

      expect(states).toEqual([]);
      expect(states.length).toBe(0);
    });

    it('should load states correctly', async () => {
      const mockStates = [
        { name: 'Personal', backupFolderId: '123', lastUpdated: '2023-01-01' },
        { name: 'Work', backupFolderId: '456', lastUpdated: '2023-01-02' }
      ];

      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: mockStates });

      const result = await chrome.storage.sync.get(['bookmarkStates']);
      const states = result.bookmarkStates || [];

      expect(states).toEqual(mockStates);
      expect(states.length).toBe(2);
      expect(states[0].name).toBe('Personal');
      expect(states[1].name).toBe('Work');
    });
  });

  describe('First-Time User Experience', () => {
    it('should show welcome message for new users', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bookmarkStates: [{ name: 'Personal' }],
        hasSeenWelcome: false
      });

      const result = await chrome.storage.sync.get(['bookmarkStates', 'hasSeenWelcome']);
      
      let shouldShowWelcome = false;
      if (result.bookmarkStates && result.bookmarkStates.length > 0 && !result.hasSeenWelcome) {
        shouldShowWelcome = true;
      }

      expect(shouldShowWelcome).toBe(true);
    });

    it('should not show welcome message for returning users', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bookmarkStates: [{ name: 'Personal' }],
        hasSeenWelcome: true
      });

      const result = await chrome.storage.sync.get(['bookmarkStates', 'hasSeenWelcome']);
      
      let shouldShowWelcome = false;
      if (result.bookmarkStates && result.bookmarkStates.length > 0 && !result.hasSeenWelcome) {
        shouldShowWelcome = true;
      }

      expect(shouldShowWelcome).toBe(false);
    });

    it('should not show welcome message for first-time setup', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bookmarkStates: [],
        hasSeenWelcome: false
      });

      const result = await chrome.storage.sync.get(['bookmarkStates', 'hasSeenWelcome']);
      
      let shouldShowWelcome = false;
      if (result.bookmarkStates && result.bookmarkStates.length > 0 && !result.hasSeenWelcome) {
        shouldShowWelcome = true;
      }

      expect(shouldShowWelcome).toBe(false);
    });
  });

  describe('State Data Integrity', () => {
    it('should handle corrupt state data gracefully', () => {
      const corruptState = { name: null, backupFolderId: undefined };
      
      const isStateValid = (state) => {
        return !!(state && 
               typeof state.name === 'string' && 
               state.name.length > 0 &&
               state.backupFolderId);
      };

      expect(isStateValid(corruptState)).toBe(false);
    });

    it('should validate complete state objects', () => {
      const validState = {
        name: 'Personal',
        backupFolderId: '123',
        lastUpdated: '2023-01-01',
        backupFolderName: 'Personal Bookmarks'
      };
      
      const isStateValid = (state) => {
        return !!(state && 
               typeof state.name === 'string' && 
               state.name.length > 0 &&
               state.backupFolderId);
      };

      expect(isStateValid(validState)).toBe(true);
    });

    it('should handle missing required properties', () => {
      const incompleteState = { name: 'Personal' }; // missing backupFolderId
      
      const isStateValid = (state) => {
        return !!(state && 
               typeof state.name === 'string' && 
               state.name.length > 0 &&
               state.backupFolderId);
      };

      expect(isStateValid(incompleteState)).toBe(false);
    });
  });
});
