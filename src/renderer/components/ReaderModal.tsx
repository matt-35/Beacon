import React, { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { BookmarkItem } from '../../core/types';

interface ReaderModalProps {
  bookmark: BookmarkItem;
  onClose: () => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({ bookmark, onClose }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void window.bookmarkApi
      .readBookmarkSnapshot(bookmark.id)
      .then((content) => setHtml(content))
      .finally(() => setLoading(false));
  }, [bookmark.id]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bookmark.title}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn"
              onClick={() => void window.bookmarkApi.openExternalUrl(bookmark.url)}
            >
              <ExternalLink size={14} />
              Open Original
            </button>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading offline snapshot...</div>
        ) : html ? (
          <iframe
            className="reader-iframe"
            title={bookmark.title}
            sandbox="allow-same-origin"
            srcDoc={html}
          />
        ) : (
          <div className="empty-state">No offline snapshot found for this bookmark.</div>
        )}
      </div>
    </div>
  );
};

