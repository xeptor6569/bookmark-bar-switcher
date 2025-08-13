# Bookmarks Bar Switcher

A Chrome extension that allows you to create and switch between different bookmark bar states (e.g., Personal, Work, Development) with **automatic saving** capabilities.

## ✨ Features

- **Save Current State**: Save your current bookmarks bar as a named state
- **Create New States**: Create empty states to start fresh
- **Switch Between States**: Easily switch between different bookmark configurations
- **Automatic Saving**: Auto-save at configurable intervals and when switching states
- **State Management**: View, rename, and delete saved states
- **Clean Organization**: State folders are visible in "Other Bookmarks" for easy navigation

## 🚀 New Auto-Save Features

### **Smart Auto-Saving**
- **Interval-based**: Automatically save every 1, 5, 10, 15, or 30 minutes
- **State-switch saving**: Automatically save current state when switching to another state
- **Configurable**: Toggle auto-save on/off and adjust intervals
- **Efficient**: Only saves when there are actual changes, not on every bookmark modification

### **How Auto-Save Works**
1. **Interval Saving**: Saves your current bookmarks bar at the specified interval
2. **Switch Saving**: When you switch states, your current configuration is automatically saved
3. **Manual Override**: You can still manually save anytime with the "Save Current State" button
4. **Smart Detection**: Only saves when there's a current state name set

## 📁 How It Works

The extension works by:

1. **State Folders**: Creates clean, named folders in "Other Bookmarks" (e.g., "Personal", "Work", "Dev")
2. **Visible Structure**: You can see all your inactive states in "Other Bookmarks" and navigate to them
3. **Clean Switching**: When switching states, the current bookmarks bar is saved to its state folder, and the target state is restored
4. **Automatic Backup**: Your current configuration is automatically saved based on your settings

## 🛠️ Installation

### Method 1: Load as Unpacked Extension (Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

### Method 2: Build and Install

1. Clone this repository
2. Run `npm install` (if you have Node.js installed)
3. Build the extension using your preferred build tool
4. Follow the "Load as Unpacked Extension" steps above

## 📖 Usage

### Getting Started

1. Click the Bookmarks Bar Switcher extension icon in your Chrome toolbar
2. Enter a name for your current bookmarks bar state (e.g., "Personal")
3. Click "Save Current State" to save your current configuration

### Auto-Save Configuration

1. **Enable Auto-Save**: Toggle the switch to enable automatic saving
2. **Set Interval**: Choose how often to auto-save (1, 5, 10, 15, or 30 minutes)
3. **Monitor Status**: Check the console for auto-save activity

### Creating New States

1. Click "Create New State" in the extension popup
2. Enter a name for the new state
3. The new state will be created with an empty bookmarks bar

### Switching Between States

1. In the "Saved States" section, click "Switch To" next to any state
2. Your current bookmarks bar will be automatically saved (if auto-save is enabled)
3. The selected state will be restored to your bookmarks bar

### Managing States

- **View States**: All saved states are listed in the popup
- **Delete States**: Click the "Delete" button to remove unwanted states
- **Refresh**: Use the "Refresh" button to update the states list

## ⚙️ Settings

### Auto-Save Options

- **Toggle**: Enable/disable automatic saving
- **Interval**: Choose from 1, 5, 10, 15, or 30 minutes
- **Smart Saving**: Automatically saves when switching states

### Manual Override

- **Save Current State**: Manually save anytime
- **Immediate Control**: Override auto-save settings when needed

## 📁 File Structure

```
tabs-manager/
├── manifest.json          # Extension configuration with alarms permission
├── popup.html            # Popup interface with settings
├── popup.js              # Popup functionality and auto-save controls
├── background.js         # Background service worker with auto-save logic
├── styles.css            # Styling including toggle switch
├── README.md            # This file
└── icons/               # Icon files
```

## 🔐 Permissions

This extension requires the following permissions:

- **`bookmarks`**: To read, create, and modify bookmarks
- **`storage`**: To save extension data and settings locally
- **`alarms`**: To schedule automatic saving at intervals

## 🌐 Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers

## 🔧 Troubleshooting

### Common Issues

1. **Extension not working**: Make sure you've enabled Developer mode and loaded the extension correctly
2. **Bookmarks not switching**: Check that you have the necessary permissions enabled
3. **States not saving**: Verify that Chrome has permission to access bookmarks
4. **Auto-save not working**: Check that auto-save is enabled and you have a current state name set

### Data Location

- **State Folders**: Located in "Other Bookmarks" with clean names
- **Extension Data**: Stored in Chrome's local storage (not synced across devices)
- **Auto-save Settings**: Stored locally and persist between sessions

### Console Logging

The extension provides detailed console logging for debugging:
- Auto-save events and timing
- State switching operations
- Bookmark operations and errors

## 🚀 Development

### Building

To build the extension for distribution:

1. Ensure all files are present and properly configured
2. Test the extension thoroughly, especially auto-save functionality
3. Package the extension using Chrome's extension packaging tools

### Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

This extension was inspired by the original "Bookmarks Bar Switcher" extension by Jiajia Wang, which is no longer available on the Chrome Web Store. The auto-save functionality is a new enhancement that makes the extension even more powerful and user-friendly.
