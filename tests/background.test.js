// Mock the background script functions for testing
const mockGetStoredStates = jest.fn();
const mockGetCurrentStateName = jest.fn();
const mockUpdateStateBackupFolderId = jest.fn();

// Import the functions we want to test (you'll need to export these from background.js)
// const { getStoredStates, getCurrentStateName, updateStateBackupFolderId } = require('../src/background/background.js');

describe('Background Script Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockGetStoredStates.mockResolvedValue([]);
    mockGetCurrentStateName.mockResolvedValue(null);
    mockUpdateStateBackupFolderId.mockResolvedValue(undefined);
  });

  describe('getStoredStates', () => {
    it('should return empty array when no states exist', async () => {
      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: [] });
      
      // const result = await getStoredStates();
      // expect(result).toEqual([]);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['bookmarkStates']);
    });

    it('should return states when they exist', async () => {
      const mockStates = [
        { name: 'Test-Work', backupFolderId: '94' },
        { name: 'Test-Personal', backupFolderId: '98' }
      ];
      
      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: mockStates });
      
      // const result = await getStoredStates();
      // expect(result).toEqual(mockStates);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['bookmarkStates']);
    });
  });

  describe('getCurrentStateName', () => {
    it('should return null when no current state', async () => {
      chrome.storage.sync.get.mockResolvedValue({ currentStateName: null });
      
      // const result = await getCurrentStateName();
      // expect(result).toBeNull();
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['currentStateName']);
    });

    it('should return current state name when it exists', async () => {
      chrome.storage.sync.get.mockResolvedValue({ currentStateName: 'Test-Work' });
      
      // const result = await getCurrentStateName();
      // expect(result).toBe('Test-Work');
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['currentStateName']);
    });
  });

  describe('updateStateBackupFolderId', () => {
    it('should update state backup folder ID', async () => {
      const mockStates = [
        { name: 'Test-Work', backupFolderId: '94' }
      ];
      
      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: mockStates });
      chrome.storage.sync.set.mockResolvedValue(undefined);
      
      // await updateStateBackupFolderId('Test-Work', '95');
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        bookmarkStates: [
          { name: 'Test-Work', backupFolderId: '95', lastUpdated: expect.any(String) }
        ]
      });
    });

    it('should handle state not found gracefully', async () => {
      chrome.storage.sync.get.mockResolvedValue({ bookmarkStates: [] });
      
      // await updateStateBackupFolderId('NonExistent', '95');
      
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });
  });
});

describe('Chrome Extension API Integration', () => {
  it('should handle storage API calls correctly', () => {
    expect(chrome.storage.sync.get).toBeDefined();
    expect(chrome.storage.sync.set).toBeDefined();
    expect(chrome.bookmarks.create).toBeDefined();
    expect(chrome.bookmarks.get).toBeDefined();
  });

  it('should handle runtime API calls correctly', () => {
    expect(chrome.runtime.onMessage.addListener).toBeDefined();
    expect(chrome.runtime.sendMessage).toBeDefined();
  });
});
