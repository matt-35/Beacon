import React, { useState } from 'react';
import {
  Bookmark,
  Clock,
  Folder,
  FolderPlus,
  Hash,
  Star,
  Tag,
  Trash2
} from 'lucide-react';
import type { FolderItem, SearchQuery } from '../../core/types';

interface SidebarProps {
  activeView: NonNullable<SearchQuery['view']>;
  activeFolderId: string | null;
  activeTag: string | null;
  folders: FolderItem[];
  tags: Array<{ tag: string; count: number }>;
  syncDirectory: string;
  onSelectView: (view: NonNullable<SearchQuery['view']>) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  activeFolderId,
  activeTag,
  folders,
  tags,
  syncDirectory,
  onSelectView,
  onSelectFolder,
  onSelectTag,
  onCreateFolder,
  onDeleteFolder
}) => {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setCreatingFolder(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Bookmark size={18} color="var(--accent)" />
        <span>Bookmark Manager</span>
      </div>

      <button
        className={`nav-item ${activeView === 'all' && !activeFolderId && !activeTag ? 'active' : ''}`}
        onClick={() => onSelectView('all')}
      >
        <span className="nav-item-left">
          <Bookmark size={15} />
          <span className="nav-item-label">All Bookmarks</span>
        </span>
      </button>

      <button
        className={`nav-item ${activeView === 'readLater' ? 'active' : ''}`}
        onClick={() => onSelectView('readLater')}
      >
        <span className="nav-item-left">
          <Clock size={15} />
          <span className="nav-item-label">Read Later</span>
        </span>
      </button>

      <button
        className={`nav-item ${activeView === 'favorites' ? 'active' : ''}`}
        onClick={() => onSelectView('favorites')}
      >
        <span className="nav-item-left">
          <Star size={15} />
          <span className="nav-item-label">Favorites</span>
        </span>
      </button>

      <button
        className={`nav-item ${activeView === 'untagged' ? 'active' : ''}`}
        onClick={() => onSelectView('untagged')}
      >
        <span className="nav-item-left">
          <Tag size={15} />
          <span className="nav-item-label">Untagged</span>
        </span>
      </button>

      <button
        className={`nav-item ${activeView === 'trash' ? 'active' : ''}`}
        onClick={() => onSelectView('trash')}
      >
        <span className="nav-item-left">
          <Trash2 size={15} />
          <span className="nav-item-label">Trash</span>
        </span>
      </button>

      <div className="sidebar-section-title">
        <span>Folders</span>
        <button
          className="btn-icon"
          title="New Folder"
          onClick={() => setCreatingFolder((v) => !v)}
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {creatingFolder && (
        <form onSubmit={handleCreateFolder} style={{ padding: '0 6px 8px' }}>
          <input
            type="text"
            autoFocus
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg)'
            }}
          />
        </form>
      )}

      {folders.map((folder) => (
        <div
          key={folder.id}
          className={`nav-item ${activeFolderId === folder.id ? 'active' : ''}`}
          onClick={() => onSelectFolder(folder.id)}
          role="button"
          tabIndex={0}
        >
          <span className="nav-item-left">
            <Folder size={15} />
            <span className="nav-item-label">{folder.name}</span>
          </span>
          <button
            className="btn-icon"
            title="Delete Folder"
            onClick={(e) => {
              e.stopPropagation();
              void onDeleteFolder(folder.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <div className="sidebar-section-title">
        <span>Tags</span>
      </div>

      {tags.map((t) => (
        <button
          key={t.tag}
          className={`nav-item ${activeTag === t.tag ? 'active' : ''}`}
          onClick={() => onSelectTag(activeTag === t.tag ? null : t.tag)}
        >
          <span className="nav-item-left">
            <Hash size={14} />
            <span className="nav-item-label">{t.tag}</span>
          </span>
          <span className="badge-count">{t.count}</span>
        </button>
      ))}

      <div className="sync-footer">
        <div className="sync-pill" title={syncDirectory}>
          <span className="sync-dot" />
          <span className="sync-path">{syncDirectory}</span>
        </div>
      </div>
    </aside>
  );
};

