# Beacon

A standalone, cross-platform desktop bookmark manager (**macOS, Windows, Linux**) that syncs across devices by storing data in any folder you choose—such as **OneDrive, Google Drive, Dropbox, iCloud Drive, or Syncthing**. No proprietary cloud account or server required.

## Key Features

- **Conflict-Free Folder Sync**: Stores each bookmark and folder as an atomic per-entity JSON file (`items/<uuid>.json`, `folders/<uuid>.json`) with tombstone soft-deletes and automatic cloud conflict-copy healing.
- **Instant Full-Text Search**: Local `MiniSearch` index across titles, URLs, descriptions, and tags (`Cmd/Ctrl+K`).
- **Auto-Metadata & Favicons**: Automatically fetches page title, description, OpenGraph tags, and caches favicons in `assets/`.
- **Offline Read-Later & Reader View**: Archives clean, script-free article HTML into `snapshots/<id>.html` for offline reading.
- **Import & Export**: Supports Netscape Bookmark HTML (Chrome, Firefox, Safari, Edge) and JSON.
- **Quick-Add & Browser Extension**: Global shortcut (`Cmd/Ctrl+Shift+B`) plus a Manifest V3 companion extension in `browser-extension/`.

## Development

```bash
npm install
npm test
npm run build
```

To run the desktop app from the built bundle:
```bash
npx electron .
```

To package installers:
```bash
npm run package:mac
npm run package:win
npm run package:linux
```

## Companion Browser Extension

1. Open the desktop app **Settings** and copy your **API Token** (and note the local port, default `48123`).
2. In Chrome/Edge/Brave, open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked** pointing to `browser-extension/`.
3. Paste the token once under **Desktop App Connection** in the extension popup.

