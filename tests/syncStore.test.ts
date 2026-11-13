import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { SyncStore } from '../src/core/syncStore';
import type { BookmarkItem, FolderItem } from '../src/core/types';

function makeBookmark(overrides: Partial<BookmarkItem> = {}): BookmarkItem {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    url: 'https://example.com',
    title: 'Example',
    description: 'Example description',
    tags: ['dev'],
    folderId: null,
    faviconPath: null,
    thumbnailUrl: null,
    isFavorite: false,
    isReadLater: false,
    hasSnapshot: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: 'device-a',
    ...overrides
  };
}

describe('SyncStore', () => {
  let tempDir: string;
  let store: SyncStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bm-sync-test-'));
    store = new SyncStore(tempDir, 'device-a');
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('initializes manifest, items, folders, snapshots, and assets directories', async () => {
    const manifestRaw = await fs.readFile(path.join(tempDir, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.app).toBe('Beacon');
  });

  it('writes and loads bookmarks and folders atomically', async () => {
    const folder: FolderItem = {
      id: uuidv4(),
      name: 'Reading',
      parentId: null,
      color: '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      deviceId: 'device-a'
    };
    const bm = makeBookmark({ folderId: folder.id, title: 'Atomic Test' });

    await store.writeFolder(folder);
    await store.writeBookmark(bm);

    const loaded = await store.loadAll();
    expect(loaded.folders).toHaveLength(1);
    expect(loaded.folders[0].name).toBe('Reading');
    expect(loaded.bookmarks).toHaveLength(1);
    expect(loaded.bookmarks[0].title).toBe('Atomic Test');
  });

  it('heals cloud sync conflict copies by keeping the newer updatedAt version', async () => {
    const id = uuidv4();
    const older = makeBookmark({
      id,
      title: 'Older Title',
      updatedAt: '2026-01-01T10:00:00.000Z',
      deviceId: 'device-a'
    });
    const newer = makeBookmark({
      id,
      title: 'Newer Conflict Title',
      updatedAt: '2026-01-01T12:00:00.000Z',
      deviceId: 'device-b'
    });

    await store.writeBookmark(older);
    const conflictPath = path.join(store.itemsDir, `${id} (1).json`);
    await fs.writeFile(conflictPath, JSON.stringify(newer, null, 2));

    const loaded = await store.loadAll();
    expect(loaded.bookmarks).toHaveLength(1);
    expect(loaded.bookmarks[0].title).toBe('Newer Conflict Title');

    // Conflict file should have been cleaned up
    await expect(fs.access(conflictPath)).rejects.toThrow();
  });

  it('saves and reads offline snapshots and deduplicates content-addressed assets', async () => {
    const id = uuidv4();
    await store.saveSnapshot(id, '<html><body>Hello Offline</body></html>');
    const html = await store.readSnapshot(id);
    expect(html).toContain('Hello Offline');

    const buf = Buffer.from('fake-png-bytes');
    const file1 = await store.saveAsset(buf, 'png');
    const file2 = await store.saveAsset(buf, '.PNG');
    expect(file1).toBe(file2);
  });

  it('detects external file additions via chokidar watcher', async () => {
    const events: string[] = [];
    store.watch((ev) => {
      events.push(`${ev.kind}:${ev.action}:${ev.id}`);
    });

    // Give chokidar a moment to bind
    await new Promise((r) => setTimeout(r, 200));

    const remoteBm = makeBookmark({ title: 'Synced From OneDrive', deviceId: 'device-b' });
    await fs.writeFile(
      path.join(store.itemsDir, `${remoteBm.id}.json`),
      JSON.stringify(remoteBm, null, 2)
    );

    await new Promise((r) => setTimeout(r, 600));
    expect(events).toContain(`bookmark:upsert:${remoteBm.id}`);
  });
});

