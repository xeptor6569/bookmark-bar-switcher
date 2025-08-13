# Bookmarks Bar Switcher

A Chrome extension that allows you to create and switch between different bookmark bar states (e.g., Personal, Work, Development).

## Features

- **Save Current State**: Save your current bookmarks bar as a named state
- **Create New States**: Create empty states to start fresh
- **Switch Between States**: Easily switch between different bookmark configurations
- **Automatic Backup**: Your current bookmarks are automatically backed up when switching
- **State Management**: View, rename, and delete saved states

## Installation

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

## Usage

### Getting Started

1. Click the Bookmarks Bar Switcher extension icon in your Chrome toolbar
2. Enter a name for your current bookmarks bar state (e.g., "Personal")
3. Click "Save Current State" to save your current configuration

### Creating New States

1. Click "Create New State" in the extension popup
2. Enter a name for the new state
3. The new state will be created with an empty bookmarks bar

### Switching Between States

1. In the "Saved States" section, click "Switch To" next to any state
2. Your current bookmarks bar will be automatically backed up
3. The selected state will be restored to your bookmarks bar

### Managing States

- **View States**: All saved states are listed in the popup
- **Delete States**: Click the "Delete" button to remove unwanted states
- **Refresh**: Use the "Refresh" button to update the states list

## How It Works

The extension works by:

1. **Backup Creation**: When you save a state, it creates a backup folder in "Other Bookmarks" containing all your current bookmarks bar items
2. **State Storage**: State information (names, backup folder IDs, timestamps) is stored in Chrome's local storage
3. **Switching**: When switching states, your current bookmarks bar is cleared and replaced with the contents of the selected state's backup folder
4. **Automatic Backup**: Your current configuration is automatically backed up before switching to prevent data loss

## File Structure

```
tabs-manager/
├── manifest.json          # Extension configuration
├── popup.html            # Popup interface
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── styles.css            # Styling
└── README.md            # This file
```

## Permissions

This extension requires the following permissions:

- **`bookmarks`**: To read, create, and modify bookmarks
- **`storage`**: To save extension data locally

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers

## Troubleshooting

### Common Issues

1. **Extension not working**: Make sure you've enabled Developer mode and loaded the extension correctly
2. **Bookmarks not switching**: Check that you have the necessary permissions enabled
3. **States not saving**: Verify that Chrome has permission to access bookmarks

### Data Location

- **Backup Folders**: Located in "Other Bookmarks" with `[BACKUP]` prefix
- **Extension Data**: Stored in Chrome's local storage (not synced across devices)

## Development

### Building

To build the extension for distribution:

1. Ensure all files are present and properly configured
2. Test the extension thoroughly
3. Package the extension using Chrome's extension packaging tools

### Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

## License

This project is open source and available under the MIT License.

## Acknowledgments

This extension was inspired by the original "Bookmarks Bar Switcher" extension by Jiajia Wang, which is no longer available on the Chrome Web Store.
