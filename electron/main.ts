import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  net,
  protocol,
  shell
} from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { SyncStore } from '../src/core/syncStore';
import { SearchIndex } from '../src/core/searchIndex';
import { fetchMetadata } from '../src/core/metadataFetcher';
import { archiveUrlSnapshot } from '../src/core/snapshotArchiver';
import { parseNetscapeHtml, serializeNetscapeHtml } from '../src/core/htmlBookmarks';
import type {
  AppConfig,
  BookmarkInput,
  BookmarkItem,
  BookmarkPatch,
  FolderItem,
  SearchQuery
} from '../src/core/types';
import { detectCloudDrives } from './cloudDetector';
import { LocalApiServer } from './localApiServer';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bm-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
]);

let mainWindow: BrowserWindow | null = null;
let syncStore: SyncStore | null = null;
let apiServer: LocalApiServer | null = null;
const searchIndex = new SearchIndex();
const foldersMap = new Map<string, FolderItem>();

let appConfig: AppConfig = {
  syncDirectory: null,
  deviceId: uuidv4(),
  apiToken: crypto.randomBytes(24).toString('hex'),
  apiPort: 48123,
  theme: 'system',
  recentDirectories: []
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

async function loadConfig(): Promise<void> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    appConfig = {
      ...appConfig,
      ...parsed
    };
  } catch {
    await saveConfig();
  }
}

async function saveConfig(): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(appConfig, null, 2));
}

function notifyRendererDataChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync:dataChanged');
  }
}

async function initializeSyncDirectory(dirPath: string): Promise<void> {
  if (syncStore) {
    await syncStore.close();
  }

  const store = new SyncStore(dirPath, appConfig.deviceId);
  await store.init();
  const { bookmarks, folders } = await store.loadAll();

  foldersMap.clear();
  for (const folder of folders) {
    foldersMap.set(folder.id, folder);
  }
  searchIndex.rebuild(bookmarks);

  store.watch((ev) => {
    if (ev.kind === 'bookmark') {
      if (ev.action === 'remove') {
        searchIndex.remove(ev.id);
      } else if (ev.item) {
        searchIndex.upsert(ev.item as BookmarkItem);
      }
    } else if (ev.kind === 'folder') {
      if (ev.action === 'remove') {
        foldersMap.delete(ev.id);
      } else if (ev.item) {
        foldersMap.set(ev.id, ev.item as FolderItem);
      }
    }
    notifyRendererDataChanged();
  });

  syncStore = store;
  appConfig.syncDirectory = path.resolve(dirPath);
  if (!appConfig.recentDirectories.includes(appConfig.syncDirectory)) {
    appConfig.recentDirectories = [appConfig.syncDirectory, ...appConfig.recentDirectories].slice(0, 5);
  }
  await saveConfig();
  notifyRendererDataChanged();
}

async function createBookmarkFromInput(input: BookmarkInput): Promise<BookmarkItem> {
  if (!syncStore) {
    throw new Error('Sync directory is not configured');
  }

  const now = new Date().toISOString();
  const id = uuidv4();
  let title = input.title?.trim() || '';
  let description = input.description?.trim() || '';
  let thumbnailUrl: string | null = null;
  let faviconPath: string | null = null;

  if (input.fetchMetadata !== false) {
    try {
      const meta = await fetchMetadata(input.url);
      if (!title) title = meta.title;
      if (!description) description = meta.description;
      thumbnailUrl = meta.thumbnailUrl;
      if (meta.faviconBuffer && meta.faviconExt) {
        faviconPath = await syncStore.saveAsset(meta.faviconBuffer, meta.faviconExt);
      }
    } catch {
      // Metadata fetch is best-effort
    }
  }

  if (!title) {
    try {
      title = new URL(input.url).hostname;
    } catch {
      title = input.url;
    }
  }

  let hasSnapshot = false;
  if (input.saveSnapshot) {
    try {
      const snapshotHtml = await archiveUrlSnapshot(input.url);
      await syncStore.saveSnapshot(id, snapshotHtml);
      hasSnapshot = true;
    } catch {
      // Snapshot archiving is best-effort
    }
  }

  const item: BookmarkItem = {
    id,
    url: input.url.trim(),
    title,
    description,
    tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))),
    folderId: input.folderId ?? null,
    faviconPath,
    thumbnailUrl,
    isFavorite: Boolean(input.isFavorite),
    isReadLater: Boolean(input.isReadLater),
    hasSnapshot,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: appConfig.deviceId
  };

  await syncStore.writeBookmark(item);
  searchIndex.upsert(item);
  notifyRendererDataChanged();
  return item;
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:getConfig', () => ({ ...appConfig }));
  ipcMain.handle('app:detectCloudDrives', () => detectCloudDrives());

  ipcMain.handle('app:pickSyncDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose Sync Data Directory (OneDrive, Google Drive, Dropbox, etc.)'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('app:setSyncDirectory', async (_ev, dirPath: string) => {
    await initializeSyncDirectory(dirPath);
    return { ...appConfig };
  });

  ipcMain.handle('app:setTheme', async (_ev, theme: AppConfig['theme']) => {
    appConfig.theme = theme;
    await saveConfig();
    return { ...appConfig };
  });

  ipcMain.handle('app:openExternal', async (_ev, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('bookmarks:search', (_ev, query: SearchQuery) => searchIndex.search(query));
  ipcMain.handle('bookmarks:getTags', () => searchIndex.getAllTags());
  ipcMain.handle('folders:list', () =>
    Array.from(foldersMap.values())
      .filter((f) => !f.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  ipcMain.handle(
    'folders:create',
    async (_ev, payload: { name: string; parentId?: string | null; color?: string | null }) => {
      if (!syncStore) throw new Error('Sync directory is not configured');
      const now = new Date().toISOString();
      const folder: FolderItem = {
        id: uuidv4(),
        name: payload.name.trim() || 'Untitled Folder',
        parentId: payload.parentId ?? null,
        color: payload.color ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deviceId: appConfig.deviceId
      };
      await syncStore.writeFolder(folder);
      foldersMap.set(folder.id, folder);
      notifyRendererDataChanged();
      return folder;
    }
  );

  ipcMain.handle('folders:delete', async (_ev, id: string) => {
    if (!syncStore) return;
    const folder = foldersMap.get(id);
    if (!folder) return;
    const updated: FolderItem = {
      ...folder,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceId: appConfig.deviceId
    };
    await syncStore.writeFolder(updated);
    foldersMap.set(id, updated);

    // Move bookmarks in deleted folder to root
    for (const bm of searchIndex.getAll(false)) {
      if (bm.folderId === id) {
        const nextBm: BookmarkItem = {
          ...bm,
          folderId: null,
          updatedAt: new Date().toISOString(),
          deviceId: appConfig.deviceId
        };
        await syncStore.writeBookmark(nextBm);
        searchIndex.upsert(nextBm);
      }
    }
    notifyRendererDataChanged();
  });

  ipcMain.handle('bookmarks:add', (_ev, input: BookmarkInput) => createBookmarkFromInput(input));

  ipcMain.handle(
    'bookmarks:update',
    async (_ev, payload: { id: string; patch: BookmarkPatch }) => {
      if (!syncStore) return null;
      const existing = searchIndex.get(payload.id);
      if (!existing) return null;

      const updated: BookmarkItem = {
        ...existing,
        ...payload.patch,
        updatedAt: new Date().toISOString(),
        deviceId: appConfig.deviceId
      };
      await syncStore.writeBookmark(updated);
      searchIndex.upsert(updated);
      notifyRendererDataChanged();
      return updated;
    }
  );

  ipcMain.handle(
    'bookmarks:delete',
    async (_ev, payload: { id: string; permanent?: boolean }) => {
      if (!syncStore) return;
      const existing = searchIndex.get(payload.id);
      if (!existing) return;
      const now = new Date().toISOString();
      const updated: BookmarkItem = {
        ...existing,
        deletedAt: payload.permanent ? '1970-01-01T00:00:00.000Z' : now,
        updatedAt: now,
        deviceId: appConfig.deviceId
      };
      await syncStore.writeBookmark(updated);
      if (payload.permanent) {
        searchIndex.remove(payload.id);
      } else {
        searchIndex.upsert(updated);
      }
      notifyRendererDataChanged();
    }
  );

  ipcMain.handle('bookmarks:restore', async (_ev, id: string) => {
    if (!syncStore) return null;
    const existing = searchIndex.get(id);
    if (!existing) return null;
    const updated: BookmarkItem = {
      ...existing,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
      deviceId: appConfig.deviceId
    };
    await syncStore.writeBookmark(updated);
    searchIndex.upsert(updated);
    notifyRendererDataChanged();
    return updated;
  });

  ipcMain.handle('bookmarks:fetchMetadata', async (_ev, url: string) => {
    const meta = await fetchMetadata(url);
    return {
      title: meta.title,
      description: meta.description,
      thumbnailUrl: meta.thumbnailUrl
    };
  });

  ipcMain.handle('bookmarks:saveSnapshot', async (_ev, id: string) => {
    if (!syncStore) return null;
    const existing = searchIndex.get(id);
    if (!existing) return null;
    const html = await archiveUrlSnapshot(existing.url);
    await syncStore.saveSnapshot(id, html);
    const updated: BookmarkItem = {
      ...existing,
      hasSnapshot: true,
      updatedAt: new Date().toISOString(),
      deviceId: appConfig.deviceId
    };
    await syncStore.writeBookmark(updated);
    searchIndex.upsert(updated);
    notifyRendererDataChanged();
    return updated;
  });

  ipcMain.handle('bookmarks:readSnapshot', async (_ev, id: string) => {
    if (!syncStore) return null;
    return syncStore.readSnapshot(id);
  });

  ipcMain.handle('bookmarks:importDialog', async () => {
    if (!syncStore) throw new Error('Sync directory is not configured');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Bookmarks (HTML / JSON)', extensions: ['html', 'htm', 'json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const raw = await fs.readFile(filePath, 'utf-8');

    let importedFolders: FolderItem[] = [];
    let importedBookmarks: BookmarkItem[] = [];

    if (filePath.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(raw) as {
        bookmarks?: BookmarkItem[];
        folders?: FolderItem[];
      };
      importedFolders = parsed.folders ?? [];
      importedBookmarks = parsed.bookmarks ?? [];
    } else {
      const parsed = parseNetscapeHtml(raw, appConfig.deviceId);
      importedFolders = parsed.folders;
      importedBookmarks = parsed.bookmarks;
    }

    for (const folder of importedFolders) {
      await syncStore.writeFolder(folder);
      foldersMap.set(folder.id, folder);
    }
    for (const bm of importedBookmarks) {
      await syncStore.writeBookmark(bm);
      searchIndex.upsert(bm);
    }

    notifyRendererDataChanged();
    return {
      importedBookmarks: importedBookmarks.length,
      importedFolders: importedFolders.length
    };
  });

  ipcMain.handle('bookmarks:exportDialog', async (_ev, format: 'html' | 'json') => {
    const defaultName = format === 'html' ? 'bookmarks.html' : 'bookmarks.json';
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        format === 'html'
          ? { name: 'Netscape Bookmark HTML', extensions: ['html'] }
          : { name: 'JSON', extensions: ['json'] }
      ]
    });
    if (result.canceled || !result.filePath) return null;

    const bookmarks = searchIndex.getAll(false);
    const folders = Array.from(foldersMap.values()).filter((f) => !f.deletedAt);

    const content =
      format === 'html'
        ? serializeNetscapeHtml(bookmarks, folders)
        : JSON.stringify({ exportedAt: new Date().toISOString(), folders, bookmarks }, null, 2);

    await fs.writeFile(result.filePath, content, 'utf-8');
    return result.filePath;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 880,
    minHeight: 580,
    title: 'Bookmark Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  protocol.handle('bm-asset', (request) => {
    if (!syncStore) {
      return new Response('Not found', { status: 404 });
    }
    const url = new URL(request.url);
    const fileName = path.basename(url.hostname || url.pathname);
    const fullPath = syncStore.resolveAssetPath(fileName);
    return net.fetch(pathToFileURL(fullPath).toString());
  });

  await loadConfig();
  if (appConfig.syncDirectory) {
    try {
      await initializeSyncDirectory(appConfig.syncDirectory);
    } catch {
      appConfig.syncDirectory = null;
      await saveConfig();
    }
  }

  registerIpcHandlers();

  apiServer = new LocalApiServer(appConfig.apiToken, appConfig.apiPort, {
    onAddBookmark: createBookmarkFromInput,
    getFolders: () => Array.from(foldersMap.values()).filter((f) => !f.deletedAt)
  });
  const boundPort = await apiServer.start();
  if (boundPort !== appConfig.apiPort) {
    appConfig.apiPort = boundPort;
    await saveConfig();
  }

  createWindow();

  globalShortcut.register('CommandOrControl+Shift+B', () => {
    if (!mainWindow) createWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      const clip = clipboard.readText().trim();
      const prefill = clip.startsWith('http://') || clip.startsWith('https://') ? clip : '';
      mainWindow.webContents.send('app:quickAdd', prefill);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  await apiServer?.stop();
  await syncStore?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

