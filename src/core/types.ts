export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  folderId: string | null;
  faviconPath: string | null;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  isReadLater: boolean;
  hasSnapshot: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
}

export interface SyncManifest {
  schemaVersion: number;
  createdAt: string;
  app: string;
}

export interface AppConfig {
  syncDirectory: string | null;
  deviceId: string;
  apiToken: string;
  apiPort: number;
  theme: 'system' | 'light' | 'dark';
  recentDirectories: string[];
}

export interface CloudDriveSuggestion {
  provider: string;
  label: string;
  path: string;
  recommendedDataPath: string;
}

export interface SearchQuery {
  text?: string;
  folderId?: string | null;
  tag?: string;
  view?: 'all' | 'favorites' | 'readLater' | 'untagged' | 'trash';
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface BookmarkInput {
  url: string;
  title?: string;
  description?: string;
  tags?: string[];
  folderId?: string | null;
  isFavorite?: boolean;
  isReadLater?: boolean;
  fetchMetadata?: boolean;
  saveSnapshot?: boolean;
}

export interface BookmarkPatch {
  url?: string;
  title?: string;
  description?: string;
  tags?: string[];
  folderId?: string | null;
  faviconPath?: string | null;
  thumbnailUrl?: string | null;
  isFavorite?: boolean;
  isReadLater?: boolean;
  hasSnapshot?: boolean;
  deletedAt?: string | null;
}

export interface SyncEvent {
  kind: 'bookmark' | 'folder';
  action: 'upsert' | 'remove';
  id: string;
  item?: BookmarkItem | FolderItem;
}

export interface FetchedMetadata {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  faviconBuffer: Buffer | null;
  faviconExt: string | null;
}

