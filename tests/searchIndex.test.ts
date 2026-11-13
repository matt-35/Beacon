import { describe, it, expect } from 'vitest';
import { SearchIndex } from '../src/core/searchIndex';
import type { BookmarkItem } from '../src/core/types';

function makeItem(id: string, overrides: Partial<BookmarkItem> = {}): BookmarkItem {
  return {
    id,
    url: `https://example.com/${id}`,
    title: `Title ${id}`,
    description: '',
    tags: [],
    folderId: null,
    faviconPath: null,
    thumbnailUrl: null,
    isFavorite: false,
    isReadLater: false,
    hasSnapshot: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    deviceId: 'd1',
    ...overrides
  };
}

describe('SearchIndex', () => {
  it('indexes and searches by title, url, description, and tags', () => {
    const idx = new SearchIndex();
    idx.rebuild([
      makeItem('1', { title: 'TypeScript Handbook', tags: ['ts', 'docs'] }),
      makeItem('2', { title: 'Rust Book', description: 'Systems programming', tags: ['rust'] }),
      makeItem('3', { title: 'Deleted Item', deletedAt: '2026-01-02T00:00:00.000Z' })
    ]);

    expect(idx.search({ text: 'typescript' }).map((b) => b.id)).toEqual(['1']);
    expect(idx.search({ text: 'systems' }).map((b) => b.id)).toEqual(['2']);
    expect(idx.search({ text: 'Deleted' })).toHaveLength(0);
    expect(idx.search({ view: 'trash' }).map((b) => b.id)).toEqual(['3']);
  });

  it('filters by favorites, readLater, untagged, folderId, and tag', () => {
    const idx = new SearchIndex();
    idx.rebuild([
      makeItem('1', { isFavorite: true, folderId: 'f1', tags: ['news'] }),
      makeItem('2', { isReadLater: true, folderId: 'f1', tags: [] }),
      makeItem('3', { folderId: 'f2', tags: ['news', 'tech'] })
    ]);

    expect(idx.search({ view: 'favorites' }).map((b) => b.id)).toEqual(['1']);
    expect(idx.search({ view: 'readLater' }).map((b) => b.id)).toEqual(['2']);
    expect(idx.search({ view: 'untagged' }).map((b) => b.id)).toEqual(['2']);
    expect(idx.search({ folderId: 'f1' })).toHaveLength(2);
    expect(idx.search({ tag: 'news' })).toHaveLength(2);
    expect(idx.getAllTags()).toEqual([
      { tag: 'news', count: 2 },
      { tag: 'tech', count: 1 }
    ]);
  });
});

