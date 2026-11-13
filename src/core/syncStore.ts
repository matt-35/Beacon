import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import chokidar, { type FSWatcher } from 'chokidar';
import type { BookmarkItem, FolderItem, SyncEvent, SyncManifest } from './types';

const UUID_CANONICAL_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i;
const UUID_PREFIX_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*\.json$/i;

export function compareEntityVersion<T extends { updatedAt: string; deviceId: string }>(a: T, b: T): number {
  const timeA = Date.parse(a.updatedAt) || 0;
  const timeB = Date.parse(b.updatedAt) || 0;
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.deviceId.localeCompare(b.deviceId);
}

async function writeFileAtomic(targetPath: string, data: string | Buffer, deviceId: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const nonce = crypto.randomBytes(4).toString('hex');
  const tempPath = path.join(dir, `.${base}.tmp.${deviceId}.${nonce}`);
  await fs.writeFile(tempPath, data);
  await fs.rename(tempPath, targetPath);
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class SyncStore {
  public readonly rootDir: string;
  public readonly deviceId: string;
  private watcher: FSWatcher | null = null;
  private selfWritePaths = new Set<string>();

  constructor(rootDir: string, deviceId: string) {
    this.rootDir = path.resolve(rootDir);
    this.deviceId = deviceId;
  }

  get itemsDir(): string {
    return path.join(this.rootDir, 'items');
  }

  get foldersDir(): string {
    return path.join(this.rootDir, 'folders');
  }

  get snapshotsDir(): string {
    return path.join(this.rootDir, 'snapshots');
  }

  get assetsDir(): string {
    return path.join(this.rootDir, 'assets');
  }

  get manifestPath(): string {
    return path.join(this.rootDir, 'manifest.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.itemsDir, { recursive: true });
    await fs.mkdir(this.foldersDir, { recursive: true });
    await fs.mkdir(this.snapshotsDir, { recursive: true });
    await fs.mkdir(this.assetsDir, { recursive: true });

    try {
      await fs.access(this.manifestPath);
    } catch {
      const manifest: SyncManifest = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        app: 'Beacon'
      };
      await writeFileAtomic(this.manifestPath, JSON.stringify(manifest, null, 2), this.deviceId);
    }
  }

  private markSelfWrite(filePath: string): void {
    this.selfWritePaths.add(filePath);
    setTimeout(() => {
      this.selfWritePaths.delete(filePath);
    }, 2000);
  }

  async writeBookmark(bookmark: BookmarkItem): Promise<void> {
    const targetPath = path.join(this.itemsDir, `${bookmark.id}.json`);
    this.markSelfWrite(targetPath);
    await writeFileAtomic(targetPath, JSON.stringify(bookmark, null, 2), this.deviceId);
  }

  async writeFolder(folder: FolderItem): Promise<void> {
    const targetPath = path.join(this.foldersDir, `${folder.id}.json`);
    this.markSelfWrite(targetPath);
    await writeFileAtomic(targetPath, JSON.stringify(folder, null, 2), this.deviceId);
  }

  async saveSnapshot(bookmarkId: string, html: string): Promise<void> {
    const targetPath = path.join(this.snapshotsDir, `${bookmarkId}.html`);
    await writeFileAtomic(targetPath, html, this.deviceId);
  }

  async readSnapshot(bookmarkId: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(this.snapshotsDir, `${bookmarkId}.html`), 'utf-8');
    } catch {
      return null;
    }
  }

  async saveAsset(buffer: Buffer, ext: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'png';
    const fileName = `${hash}.${cleanExt}`;
    const targetPath = path.join(this.assetsDir, fileName);
    try {
      await fs.access(targetPath);
    } catch {
      await writeFileAtomic(targetPath, buffer, this.deviceId);
    }
    return fileName;
  }

  resolveAssetPath(fileName: string): string {
    return path.join(this.assetsDir, path.basename(fileName));
  }

  async loadAll(): Promise<{ bookmarks: BookmarkItem[]; folders: FolderItem[] }> {
    await this.init();
    const bookmarks = await this.loadEntitiesFromDir<BookmarkItem>(this.itemsDir);
    const folders = await this.loadEntitiesFromDir<FolderItem>(this.foldersDir);
    return { bookmarks, folders };
  }

  private async loadEntitiesFromDir<T extends { id: string; updatedAt: string; deviceId: string }>(
    dir: string
  ): Promise<T[]> {
    const entries = await fs.readdir(dir);
    const byId = new Map<string, T>();
    const conflictFiles: Array<{ id: string; filePath: string }> = [];

    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const canonicalMatch = UUID_CANONICAL_RE.exec(entry);
      const filePath = path.join(dir, entry);

      if (canonicalMatch) {
        const entity = await readJsonSafe<T>(filePath);
        if (entity && entity.id) {
          byId.set(entity.id, entity);
        }
        continue;
      }

      const conflictMatch = UUID_PREFIX_RE.exec(entry);
      if (conflictMatch) {
        conflictFiles.push({ id: conflictMatch[1], filePath });
      }
    }

    // Heal any cloud-sync conflict copies (e.g. "<uuid> (1).json")
    for (const conflict of conflictFiles) {
      const candidate = await readJsonSafe<T>(conflict.filePath);
      if (candidate && candidate.id) {
        const existing = byId.get(candidate.id);
        if (!existing || compareEntityVersion(candidate, existing) > 0) {
          byId.set(candidate.id, candidate);
          const canonicalPath = path.join(dir, `${candidate.id}.json`);
          this.markSelfWrite(canonicalPath);
          await writeFileAtomic(canonicalPath, JSON.stringify(candidate, null, 2), this.deviceId);
        }
      }
      await fs.unlink(conflict.filePath).catch(() => {});
    }

    return Array.from(byId.values());
  }

  watch(onEvent: (event: SyncEvent) => void): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch([this.itemsDir, this.foldersDir], {
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100
      }
    });

    const handleFile = async (filePath: string, removed: boolean) => {
      if (this.selfWritePaths.has(filePath)) {
        return;
      }

      const fileName = path.basename(filePath);
      const dir = path.dirname(filePath);
      const kind: 'bookmark' | 'folder' | null =
        dir === this.itemsDir ? 'bookmark' : dir === this.foldersDir ? 'folder' : null;
      if (!kind) return;

      const canonicalMatch = UUID_CANONICAL_RE.exec(fileName);
      if (removed) {
        if (canonicalMatch) {
          onEvent({ kind, action: 'remove', id: canonicalMatch[1] });
        }
        return;
      }

      if (canonicalMatch) {
        const item = await readJsonSafe<BookmarkItem | FolderItem>(filePath);
        if (item && item.id) {
          onEvent({ kind, action: 'upsert', id: item.id, item });
        }
        return;
      }

      // Live conflict copy appeared from cloud sync client
      const conflictMatch = UUID_PREFIX_RE.exec(fileName);
      if (conflictMatch) {
        const canonicalPath = path.join(dir, `${conflictMatch[1]}.json`);
        const candidate = await readJsonSafe<BookmarkItem | FolderItem>(filePath);
        const existing = await readJsonSafe<BookmarkItem | FolderItem>(canonicalPath);

        if (candidate && candidate.id) {
          if (!existing || compareEntityVersion(candidate, existing) > 0) {
            this.markSelfWrite(canonicalPath);
            await writeFileAtomic(canonicalPath, JSON.stringify(candidate, null, 2), this.deviceId);
            onEvent({ kind, action: 'upsert', id: candidate.id, item: candidate });
          }
        }
        await fs.unlink(filePath).catch(() => {});
      }
    };

    this.watcher.on('add', (p) => void handleFile(p, false));
    this.watcher.on('change', (p) => void handleFile(p, false));
    this.watcher.on('unlink', (p) => void handleFile(p, true));
  }

  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

