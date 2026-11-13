import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { BookmarkInput, BookmarkItem, BookmarkPatch, FolderItem } from '../../core/types';

interface BookmarkModalProps {
  initialBookmark?: BookmarkItem | null;
  prefillUrl?: string;
  folders: FolderItem[];
  onClose: () => void;
  onCreate: (input: BookmarkInput) => Promise<void>;
  onUpdate: (id: string, patch: BookmarkPatch) => Promise<void>;
}

export const BookmarkModal: React.FC<BookmarkModalProps> = ({
  initialBookmark,
  prefillUrl = '',
  folders,
  onClose,
  onCreate,
  onUpdate
}) => {
  const isEditing = Boolean(initialBookmark);
  const [url, setUrl] = useState(initialBookmark?.url ?? prefillUrl);
  const [title, setTitle] = useState(initialBookmark?.title ?? '');
  const [description, setDescription] = useState(initialBookmark?.description ?? '');
  const [tagsText, setTagsText] = useState(initialBookmark?.tags.join(', ') ?? '');
  const [folderId, setFolderId] = useState<string>(initialBookmark?.folderId ?? '');
  const [isFavorite, setIsFavorite] = useState(initialBookmark?.isFavorite ?? false);
  const [isReadLater, setIsReadLater] = useState(initialBookmark?.isReadLater ?? false);
  const [saveSnapshot, setSaveSnapshot] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFetchMeta = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const meta = await window.bookmarkApi.fetchUrlMetadata(url.trim());
      if (meta.title && !title) setTitle(meta.title);
      if (meta.description && !description) setDescription(meta.description);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEditing && initialBookmark) {
        await onUpdate(initialBookmark.id, {
          url: url.trim(),
          title: title.trim() || url.trim(),
          description: description.trim(),
          tags,
          folderId: folderId || null,
          isFavorite,
          isReadLater
        });
      } else {
        await onCreate({
          url: url.trim(),
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          tags,
          folderId: folderId || null,
          isFavorite,
          isReadLater,
          fetchMetadata: true,
          saveSnapshot
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                required
                autoFocus
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={handleFetchMeta}
                disabled={fetching || !url.trim()}
                title="Fetch page title & description"
              >
                <RefreshCw size={14} />
                {fetching ? '...' : 'Fetch'}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label>Title (auto-fetched if blank)</label>
            <input
              type="text"
              placeholder="Page title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Description</label>
            <textarea
              rows={3}
              placeholder="Optional notes or summary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Folder</label>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="dev, reading, reference"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
              />
              Favorite
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={isReadLater}
                onChange={(e) => setIsReadLater(e.target.checked)}
              />
              Read Later
            </label>
            {!isEditing && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={saveSnapshot}
                  onChange={(e) => setSaveSnapshot(e.target.checked)}
                />
                Save Offline Snapshot
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Bookmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

