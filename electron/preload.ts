import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  BookmarkInput,
  BookmarkItem,
  BookmarkPatch,
  CloudDriveSuggestion,
  FetchedMetadata,
  FolderItem,
  SearchQuery
} from '../src/core/types';

export interface BookmarkApi {
  getConfig: () => Promise<AppConfig>;
  detectCloudDrives: () => Promise<CloudDriveSuggestion[]>;
  pickSyncDirectory: () => Promise<string | null>;
  setSyncDirectory: (dirPath: string) => Promise<AppConfig>;
  setTheme: (theme: AppConfig['theme']) => Promise<AppConfig>;

  searchBookmarks: (query: SearchQuery) => Promise<BookmarkItem[]>;
  getAllTags: () => Promise<Array<{ tag: string; count: number }>>;
  getFolders: () => Promise<FolderItem[]>;
  createFolder: (name: string, parentId?: string | null, color?: string | null) => Promise<FolderItem>;
  deleteFolder: (id: string) => Promise<void>;

  addBookmark: (input: BookmarkInput) => Promise<BookmarkItem>;
  updateBookmark: (id: string, patch: BookmarkPatch) => Promise<BookmarkItem | null>;
  deleteBookmark: (id: string, permanent?: boolean) => Promise<void>;
  restoreBookmark: (id: string) => Promise<BookmarkItem | null>;

  fetchUrlMetadata: (url: string) => Promise<Omit<FetchedMetadata, 'faviconBuffer' | 'faviconExt'>>;
  saveBookmarkSnapshot: (id: string) => Promise<BookmarkItem | null>;
  readBookmarkSnapshot: (id: string) => Promise<string | null>;

  importBookmarksDialog: () => Promise<{ importedBookmarks: number; importedFolders: number } | null>;
  exportBookmarksDialog: (format: 'html' | 'json') => Promise<string | null>;
  openExternalUrl: (url: string) => Promise<void>;

  onDataChanged: (cb: () => void) => () => void;
  onQuickAdd: (cb: (prefillUrl: string) => void) => () => void;
}

const api: BookmarkApi = {
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  detectCloudDrives: () => ipcRenderer.invoke('app:detectCloudDrives'),
  pickSyncDirectory: () => ipcRenderer.invoke('app:pickSyncDirectory'),
  setSyncDirectory: (dirPath) => ipcRenderer.invoke('app:setSyncDirectory', dirPath),
  setTheme: (theme) => ipcRenderer.invoke('app:setTheme', theme),

  searchBookmarks: (query) => ipcRenderer.invoke('bookmarks:search', query),
  getAllTags: () => ipcRenderer.invoke('bookmarks:getTags'),
  getFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name, parentId = null, color = null) =>
    ipcRenderer.invoke('folders:create', { name, parentId, color }),
  deleteFolder: (id) => ipcRenderer.invoke('folders:delete', id),

  addBookmark: (input) => ipcRenderer.invoke('bookmarks:add', input),
  updateBookmark: (id, patch) => ipcRenderer.invoke('bookmarks:update', { id, patch }),
  deleteBookmark: (id, permanent = false) =>
    ipcRenderer.invoke('bookmarks:delete', { id, permanent }),
  restoreBookmark: (id) => ipcRenderer.invoke('bookmarks:restore', id),

  fetchUrlMetadata: (url) => ipcRenderer.invoke('bookmarks:fetchMetadata', url),
  saveBookmarkSnapshot: (id) => ipcRenderer.invoke('bookmarks:saveSnapshot', id),
  readBookmarkSnapshot: (id) => ipcRenderer.invoke('bookmarks:readSnapshot', id),

  importBookmarksDialog: () => ipcRenderer.invoke('bookmarks:importDialog'),
  exportBookmarksDialog: (format) => ipcRenderer.invoke('bookmarks:exportDialog', format),
  openExternalUrl: (url) => ipcRenderer.invoke('app:openExternal', url),

  onDataChanged: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('sync:dataChanged', listener);
    return () => ipcRenderer.removeListener('sync:dataChanged', listener);
  },
  onQuickAdd: (cb) => {
    const listener = (_ev: Electron.IpcRendererEvent, url: string) => cb(url);
    ipcRenderer.on('app:quickAdd', listener);
    return () => ipcRenderer.removeListener('app:quickAdd', listener);
  }
};

contextBridge.exposeInMainWorld('bookmarkApi', api);

