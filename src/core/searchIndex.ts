import MiniSearch from 'minisearch';
import type { BookmarkItem, SearchQuery } from './types';

interface IndexedDoc {
  id: string;
  title: string;
  url: string;
  description: string;
  tagsText: string;
}

export class SearchIndex {
  private mini: MiniSearch<IndexedDoc>;
  private items = new Map<string, BookmarkItem>();

  constructor() {
    this.mini = new MiniSearch<IndexedDoc>({
      fields: ['title', 'url', 'description', 'tagsText'],
      storeFields: ['id'],
      searchOptions: {
        boost: { title: 3, tagsText: 2, url: 1.5, description: 1 },
        prefix: true,
        fuzzy: 0.2
      }
    });
  }

  rebuild(bookmarks: BookmarkItem[]): void {
    this.items.clear();
    this.mini.removeAll();
    const docs: IndexedDoc[] = [];
    for (const item of bookmarks) {
      this.items.set(item.id, item);
      docs.push(this.toDoc(item));
    }
    this.mini.addAll(docs);
  }

  upsert(bookmark: BookmarkItem): void {
    if (this.items.has(bookmark.id)) {
      this.mini.discard(bookmark.id);
    }
    this.items.set(bookmark.id, bookmark);
    this.mini.add(this.toDoc(bookmark));
  }

  remove(id: string): void {
    if (this.items.has(id)) {
      this.mini.discard(id);
      this.items.delete(id);
    }
  }

  get(id: string): BookmarkItem | undefined {
    return this.items.get(id);
  }

  getAll(includeDeleted = false): BookmarkItem[] {
    const all = Array.from(this.items.values());
    return includeDeleted ? all : all.filter((b) => !b.deletedAt);
  }

  getAllTags(): Array<{ tag: string; count: number }> {
    const counts = new Map<string, number>();
    for (const item of this.items.values()) {
      if (item.deletedAt) continue;
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  search(query: SearchQuery = {}): BookmarkItem[] {
    const view = query.view ?? 'all';
    const text = query.text?.trim() ?? '';

    let candidates: BookmarkItem[];
    if (text.length > 0) {
      const hits = this.mini.search(text);
      candidates = hits
        .map((hit) => this.items.get(hit.id))
        .filter((b): b is BookmarkItem => Boolean(b));
    } else {
      candidates = Array.from(this.items.values());
    }

    const filtered = candidates.filter((item) => {
      if (view === 'trash') {
        if (!item.deletedAt) return false;
      } else {
        if (item.deletedAt) return false;
      }

      if (view === 'favorites' && !item.isFavorite) return false;
      if (view === 'readLater' && !item.isReadLater) return false;
      if (view === 'untagged' && item.tags.length > 0) return false;

      if (query.folderId !== undefined && query.folderId !== null) {
        if (item.folderId !== query.folderId) return false;
      }

      if (query.tag) {
        if (!item.tags.includes(query.tag)) return false;
      }

      return true;
    });

    // If user typed a search query without explicit sort override, preserve relevance order
    if (text.length > 0 && !query.sortBy) {
      return filtered;
    }

    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const dir = sortOrder === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title) * dir;
      }
      const valA = Date.parse(a[sortBy]) || 0;
      const valB = Date.parse(b[sortBy]) || 0;
      return (valA - valB) * dir;
    });
  }

  private toDoc(item: BookmarkItem): IndexedDoc {
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      tagsText: item.tags.join(' ')
    };
  }
}

