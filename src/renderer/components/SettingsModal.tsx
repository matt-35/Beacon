import React, { useState } from 'react';
import { Copy, Download, FolderOpen, Upload, X } from 'lucide-react';
import type { AppConfig } from '../../core/types';

interface SettingsModalProps {
  config: AppConfig;
  onClose: () => void;
  onConfigUpdated: (next: AppConfig) => void;
  onBookmarksChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onClose,
  onConfigUpdated,
  onBookmarksChanged
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleChangeDirectory = async () => {
    const picked = await window.bookmarkApi.pickSyncDirectory();
    if (!picked) return;
    const updated = await window.bookmarkApi.setSyncDirectory(picked);
    onConfigUpdated(updated);
    onBookmarksChanged();
    setStatusMessage(`Sync directory switched to ${picked}`);
  };

  const handleThemeChange = async (theme: AppConfig['theme']) => {
    const updated = await window.bookmarkApi.setTheme(theme);
    onConfigUpdated(updated);
  };

  const handleImport = async () => {
    const result = await window.bookmarkApi.importBookmarksDialog();
    if (result) {
      onBookmarksChanged();
      setStatusMessage(
        `Imported ${result.importedBookmarks} bookmarks and ${result.importedFolders} folders.`
      );
    }
  };

  const handleExport = async (format: 'html' | 'json') => {
    const savedPath = await window.bookmarkApi.exportBookmarksDialog(format);
    if (savedPath) {
      setStatusMessage(`Exported bookmarks to ${savedPath}`);
    }
  };

  const handleCopyToken = async () => {
    await navigator.clipboard.writeText(config.apiToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="form-field">
          <label>Sync Data Directory (OneDrive, Google Drive, Dropbox, etc.)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" readOnly value={config.syncDirectory ?? ''} />
            <button className="btn" onClick={handleChangeDirectory}>
              <FolderOpen size={14} />
              Change
            </button>
          </div>
        </div>

        <div className="form-field">
          <label>Appearance</label>
          <select
            value={config.theme}
            onChange={(e) => void handleThemeChange(e.target.value as AppConfig['theme'])}
          >
            <option value="system">System Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="form-field">
          <label>Browser Extension Bridge (127.0.0.1:{config.apiPort})</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" readOnly value={config.apiToken} />
            <button className="btn" onClick={handleCopyToken}>
              <Copy size={14} />
              {copiedToken ? 'Copied' : 'Copy Token'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Global quick-add shortcut: <code>Cmd/Ctrl + Shift + B</code>
          </div>
        </div>

        <div className="form-field">
          <label>Import & Export</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleImport}>
              <Upload size={14} />
              Import HTML / JSON
            </button>
            <button className="btn" onClick={() => void handleExport('html')}>
              <Download size={14} />
              Export HTML
            </button>
            <button className="btn" onClick={() => void handleExport('json')}>
              <Download size={14} />
              Export JSON
            </button>
          </div>
        </div>

        {statusMessage && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)' }}>{statusMessage}</div>
        )}

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

