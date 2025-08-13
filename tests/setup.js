// Mock Chrome extension APIs for testing
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onStartup: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  bookmarks: {
    create: jest.fn(),
    get: jest.fn(),
    getChildren: jest.fn(),
    remove: jest.fn(),
    removeTree: jest.fn(),
    move: jest.fn(),
    update: jest.fn(),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
  },
};

// Chrome extension APIs only

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  onload: null,
  result: null,
}));

// Mock Blob
global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  options,
  size: JSON.stringify(content).length,
  type: options?.type || 'application/json',
}));

// Mock document.createElement for DOM testing
global.document.createElement = jest.fn((tagName) => ({
  tagName: tagName.toUpperCase(),
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  setAttribute: jest.fn(),
  getAttribute: jest.fn(),
  click: jest.fn(),
  style: {},
  innerHTML: '',
  textContent: '',
}));

// Mock window.location
global.window.location = {
  href: 'chrome-extension://mock-id/popup.html',
  origin: 'chrome-extension://mock-id',
  protocol: 'chrome-extension:',
  host: 'mock-id',
  pathname: '/popup.html',
};
