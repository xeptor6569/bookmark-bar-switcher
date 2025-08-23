# Bookmarks Bar Switcher

A professional Chrome extension for switching between different bookmark bar states (Personal, Work, Development, etc.) with automatic saving capabilities.

## 🚀 Features

- **State Management**: Create and switch between different bookmark bar configurations
- **Auto-Save**: Automatic saving with configurable intervals
- **Cross-Device Sync**: Chrome sync integration for seamless experience
- **Export/Import**: Backup and restore your bookmark states
- **Smart Recovery**: Automatic state recovery and corruption detection
- **First-Time Setup**: User-friendly onboarding experience

## ⌨️ Keyboard Shortcuts

The extension provides convenient keyboard shortcuts for quick access to common actions:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+→` | Next State | Switch to the next bookmark bar state |
| `Ctrl+Shift+←` | Previous State | Switch to the previous bookmark bar state |
| `Ctrl+Shift+S` | Quick Save | Quickly save the current bookmark bar state |
| `Ctrl+Shift+B` | Show Popup | Show the Bookmarks Bar Switcher popup |

**Note**: On macOS, use `Cmd` instead of `Ctrl`.

### Using Keyboard Shortcuts

1. **Navigate States**: Use `Ctrl+Shift+→` and `Ctrl+Shift+←` to cycle through your saved states
2. **Quick Save**: Press `Ctrl+Shift+S` to instantly save your current bookmarks bar
3. **Access Popup**: Use `Ctrl+Shift+B` to show the Bookmarks Bar Switcher popup

Keyboard shortcuts work globally across all tabs and provide desktop notifications for feedback.

## 🏗️ Project Structure

```
bookmark-bar-switcher/
├── src/                    # Source code
│   ├── manifest.json      # Extension manifest
│   ├── popup/            # Popup interface
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── styles.css
│   ├── background/       # Background scripts
│   │   └── background.js
│   ├── icons/           # Extension icons
│   └── utils/           # Utility functions
├── dist/                 # Built files (generated during build)
├── builds/               # Packaged extensions (generated)
├── tests/                # Test files
├── scripts/              # Build scripts
└── docs/                 # Documentation
```

## 🛠️**Development** Setup

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** 8.0.0 or higher
- **Chrome** browser for testing

> **💡 Quick Install**: If you just want to install and use the extension, jump to [Manual Installation](#-manual-installation) below.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bookmark-bar-switcher

# Install dependencies
npm install

# Install Git hooks (husky)
npm run postinstall
```

**Note**: The build process automatically handles missing directories gracefully. If you need to add custom assets, create an `assets/` directory in the project root.

## 📦 Build Commands

### Development

```bash
# Build for development
npm run build

# Clean build artifacts
npm run clean
```

### Production

```bash
# Build for Chrome
npm run build
```

### Package Management

```bash
# Clean build artifacts
npm run clean

# Package extension for distribution
npm run package
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests**: Individual function testing
- **Integration Tests**: API interaction testing
- **Mock Chrome APIs**: Simulated extension environment

## 🔍 Code Quality

### Linting

```bash
# Check code quality
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Formatting

```bash
# Format all code
npm run format
```

### Validation

```bash
# Run all quality checks
npm run validate
```

## 📱 Browser Compatibility

### Supported Browsers

- **Chrome** 88+
- **Edge** 88+ (Chromium-based)
- **Opera** 74+ (Chromium-based)

## 🚀 Distribution

### Chrome Web Store

1. Build the extension: `npm run build`
2. Upload `builds/chrome.zip` to Chrome Web Store
3. Complete store listing and submit for review

### Manual Installation

1. Build the extension: `npm run build`
2. Open Chrome/Firefox extensions page
3. Enable Developer mode
4. Choose one of these options:
   - **Development**: Load unpacked extension from `dist/` folder
   - **Distribution**: Use the packaged `builds/chrome.zip` file

## 🔧 Development Workflow

### 1. Development

```bash
# Build for development
npm run build

# Make changes to source files
# Rebuild after changes: npm run build
```

### 2. Testing

```bash
# Run tests after changes
npm test

# Check code quality
npm run lint
```

### 3. Building

```bash
# Build for testing
npm run build

# Package for distribution
npm run package
```

### 4. Deployment

```bash
# Build extension
npm run build

# Upload to Chrome Web Store
```

## 📋 Development Checklist

### Before Committing

- [ ] Code passes linting: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] Code is formatted: `npm run format`
- [ ] Build succeeds: `npm run build`

### Before Release

- [ ] All tests pass with coverage: `npm run test:coverage`
- [ ] Build succeeds: `npm run build`
- [ ] Extension loads without errors
- [ ] All features work as expected
- [ ] Documentation is updated

## 🐛 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build
```

#### Test Failures

```bash
# Clear Jest cache
npx jest --clearCache
npm test
```

#### Linting Errors

```bash
# Auto-fix issues
npm run lint:fix

# Check specific files
npx eslint src/popup/popup.js
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run build

# Run tests with detailed output
npm run test -- --verbose
```

## 📚 Documentation

- **API Reference**: See inline code comments
- **Chrome Extensions**: [Official Documentation](https://developer.chrome.com/docs/extensions/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Chrome Extensions team for the excellent API
- Mozilla for WebExtensions standardization
- Community contributors and testers

---

**Happy coding! 🚀**