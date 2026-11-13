import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  FileDown,
  Globe,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Trash2
} from 'lucide-react';
import type {
  AppConfig,
  BookmarkInput,
  BookmarkItem,
  BookmarkPatch,
  FolderItem,
  SearchQuery
} from '../core/types';
import { Onboarding } from './components/Onboarding';
import { Sidebar } from './components/Sidebar';
import { BookmarkModal } from './components/BookmarkModal';
import { ReaderModal } from './components/ReaderModal';
import { SettingsModal } from './components/SettingsModal';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([]);

  const [searchText, setSearchText] = useState('');
  const [activeView, setActiveView] = useState<NonNullable<SearchQuery['view']>>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<NonNullable<SearchQuery['sortBy']>>('updatedAt');

  const [showAddModal, setShowAddModal] = useState(false);
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [editingBookmark, setEditingBookmark] = useState<BookmarkItem | null>(null);
  const [readingBookmark, setReadingBookmark] = useState<BookmarkItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(async () => {
    const [bms, flds, tgs] = await Promise.all([
      window.bookmarkApi.searchBookmarks({
        text: searchText,
        view: activeView,
        folderId: activeFolderId,
        tag: activeTag ?? undefined,
        sortBy: searchText.trim() ? undefined : sortBy,
        sortOrder: sortBy === 'title' ? 'asc' : 'desc'
      }),
      window.bookmarkApi.getFolders(),
      window.bookmarkApi.getAllTags()
    ]);
    setBookmarks(bms);
    setFolders(flds);
    setTags(tgs);
  }, [searchText, activeView, activeFolderId, activeTag, sortBy]);

  useEffect(() => {
    void window.bookmarkApi.getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (!config?.syncDirectory) return;
    void refreshData();
  }, [config?.syncDirectory, refreshData]);

  useEffect(() => {
    const theme = config?.theme ?? 'system';
    if (theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [config?.theme]);

  useEffect(() => {
    const unsubData = window.bookmarkApi.onDataChanged(() => {
      void refreshData();
    });
    const unsubQuick = window.bookmarkApi.onQuickAdd((url) => {
      setQuickAddUrl(url);
      setEditingBookmark(null);
      setShowAddModal(true);
    });
    return () => {
      unsubData();
      unsubQuick();
    };
  }, [refreshData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setQuickAddUrl('');
        setEditingBookmark(null);
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!config) {
    return null;
  }

  if (!config.syncDirectory) {
    return (
      <Onboarding
        onSelectDirectory={async (dirPath) => {
          const updated = await window.bookmarkApi.setSyncDirectory(dirPath);
          setConfig(updated);
        }}
      />
    );
  }

  const handleCreateBookmark = async (input: BookmarkInput) => {
    await window.bookmarkApi.addBookmark({
      ...input,
      folderId: input.folderId ?? activeFolderId
    });
    await refreshData();
  };

  const handleUpdateBookmark = async (id: string, patch: BookmarkPatch) => {
    await window.bookmarkApi.updateBookmark(id, patch);
    await refreshData();
  };

  const handleArchiveSnapshot = async (id: string) => {
    setArchivingId(id);
    try {
      await window.bookmarkApi.saveBookmarkSnapshot(id);
      await refreshData();
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        activeFolderId={activeFolderId}
        activeTag={activeTag}
        folders={folders}
        tags={tags}
        syncDirectory={config.syncDirectory}
        onSelectView={(v) => {
          setActiveView(v);
          setActiveFolderId(null);
          setActiveTag(null);
        }}
        onSelectFolder={(fId) => {
          setActiveView('all');
          setActiveFolderId(fId);
          setActiveTag(null);
        }}
        onSelectTag={(t) => {
          setActiveView('all');
          setActiveFolderId(null);
          setActiveTag(t);
        }}
        onCreateFolder={async (name) => {
          await window.bookmarkApi.createFolder(name);
          await refreshData();
        }}
        onDeleteFolder={async (id) => {
          await window.bookmarkApi.deleteFolder(id);
          if (activeFolderId === id) setActiveFolderId(null);
          await refreshData();
        }}
      />

      <main className="main-pane">
        <header className="toolbar">
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search bookmarks, URLs, descriptions, or tags (Cmd/Ctrl+K)..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <select
            className="btn"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as NonNullable<SearchQuery['sortBy']>)}
          >
            <option value="updatedAt">Recently Updated</option>
            <option value="createdAt">Date Added</option>
            <option value="title">Title (A-Z)</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={() => {
              setQuickAddUrl('');
              setEditingBookmark(null);
              setShowAddModal(true);
            }}
          >
            <Plus size={16} />
            Add Bookmark
          </button>

          <button className="btn-icon" title="Settings" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
          </button>
        </header>

        <div className="content-scroll">
          {bookmarks.length === 0 ? (
            <div className="empty-state">
              <p>No bookmarks match this view yet.</p>
              {activeView !== 'trash' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setQuickAddUrl('');
                    setEditingBookmark(null);
                    setShowAddModal(true);
                  }}
                >
                  <Plus size={16} />
                  Add Your First Bookmark
                </button>
              )}
            </div>
          ) : (
            <div className="bookmark-grid">
              {bookmarks.map((bm) => (
                <article key={bm.id} className="bookmark-card">
                  <div className="card-header">
                    {bm.faviconPath ? (
                      <img
                        className="favicon"
                        src={`bm-asset://assets/${bm.faviconPath}`}
                        alt=""
                      />
                    ) : (
                      <Globe size={18} className="favicon" color="var(--text-muted)" />
                    )}
                    <div className="card-title-wrap">
                      <div
                        className="card-title"
                        onClick={() => void window.bookmarkApi.openExternalUrl(bm.url)}
                        title={bm.url}
                      >
                        {bm.title}
                      </div>
                      <div className="card-domain">{getDomain(bm.url)}</div>
                    </div>
                  </div>

                  {bm.description && <div className="card-desc">{bm.description}</div>}

                  {bm.tags.length > 0 && (
                    <div className="card-tags">
                      {bm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="tag-chip"
                          onClick={() => {
                            setActiveView('all');
                            setActiveFolderId(null);
                            setActiveTag(tag);
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-actions">
                    <div className="card-actions-group">
                      <button
                        className="btn-icon"
                        title="Toggle Favorite"
                        onClick={() =>
                          void handleUpdateBookmark(bm.id, { isFavorite: !bm.isFavorite })
                        }
                      >
                        <Star
                          size={15}
                          fill={bm.isFavorite ? 'var(--warn)' : 'none'}
                          color={bm.isFavorite ? 'var(--warn)' : 'currentColor'}
                        />
                      </button>

                      <button
                        className="btn-icon"
                        title="Toggle Read Later"
                        onClick={() =>
                          void handleUpdateBookmark(bm.id, { isReadLater: !bm.isReadLater })
                        }
                      >
                        <Clock
                          size={15}
                          color={bm.isReadLater ? 'var(--accent)' : 'currentColor'}
                        />
                      </button>

                      {bm.hasSnapshot ? (
                        <button
                          className="btn-icon"
                          title="Open Offline Reader View"
                          onClick={() => setReadingBookmark(bm)}
                        >
                          <BookOpen size={15} color="var(--success)" />
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          title="Save Offline Snapshot"
                          disabled={archivingId === bm.id}
                          onClick={() => void handleArchiveSnapshot(bm.id)}
                        >
                          <FileDown size={15} />
                        </button>
                      )}
                    </div>

                    <div className="card-actions-group">
                      <button
                        className="btn-icon"
                        title="Open in Browser"
                        onClick={() => void window.bookmarkApi.openExternalUrl(bm.url)}
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Copy URL"
                        onClick={() => void navigator.clipboard.writeText(bm.url)}
                      >
                        <Copy size={14} />
                      </button>

                      {activeView === 'trash' ? (
                        <>
                          <button
                            className="btn-icon"
                            title="Restore"
                            onClick={() =>
                              void window.bookmarkApi.restoreBookmark(bm.id).then(refreshData)
                            }
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            title="Delete Permanently"
                            onClick={() =>
                              void window.bookmarkApi
                                .deleteBookmark(bm.id, true)
                                .then(refreshData)
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-icon"
                            title="Edit"
                            onClick={() => {
                              setEditingBookmark(bm);
                              setShowAddModal(true);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Move to Trash"
                            onClick={() =>
                              void window.bookmarkApi
                                .deleteBookmark(bm.id, false)
                                .then(refreshData)
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <BookmarkModal
          initialBookmark={editingBookmark}
          prefillUrl={quickAddUrl}
          folders={folders}
          onClose={() => {
            setShowAddModal(false);
            setEditingBookmark(null);
            setQuickAddUrl('');
          }}
          onCreate={handleCreateBookmark}
          onUpdate={handleUpdateBookmark}
        />
      )}

      {readingBookmark && (
        <ReaderModal bookmark={readingBookmark} onClose={() => setReadingBookmark(null)} />
      )}

      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onConfigUpdated={setConfig}
          onBookmarksChanged={() => void refreshData()}
        />
      )}
    </div>
  );
};

