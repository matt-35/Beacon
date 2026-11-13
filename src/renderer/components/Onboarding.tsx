import React, { useEffect, useState } from 'react';
import { FolderOpen, Cloud } from 'lucide-react';
import type { CloudDriveSuggestion } from '../../core/types';

interface OnboardingProps {
  onSelectDirectory: (dirPath: string) => Promise<void>;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onSelectDirectory }) => {
  const [suggestions, setSuggestions] = useState<CloudDriveSuggestion[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.bookmarkApi.detectCloudDrives().then(setSuggestions);
  }, []);

  const handleChooseCustom = async () => {
    const picked = await window.bookmarkApi.pickSyncDirectory();
    if (picked) {
      setBusy(true);
      try {
        await onSelectDirectory(picked);
      } finally {
        setBusy(false);
      }
    }
  };

  const handleUseSuggested = async (dirPath: string) => {
    setBusy(true);
    try {
      await onSelectDirectory(dirPath);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Choose Your Sync Data Directory</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Your bookmarks are stored as conflict-free JSON files inside any folder you choose—such as
          OneDrive, Google Drive, Dropbox, iCloud Drive, or Syncthing. No account required.
        </p>

        {suggestions.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              DETECTED CLOUD DRIVES
            </div>
            <div className="drive-list">
              {suggestions.map((s) => (
                <button
                  key={s.path}
                  className="drive-option"
                  disabled={busy}
                  onClick={() => handleUseSuggested(s.recommendedDataPath)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Cloud size={18} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.recommendedDataPath}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Use</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" disabled={busy} onClick={handleChooseCustom}>
          <FolderOpen size={16} />
          Browse for Any Folder...
        </button>
      </div>
    </div>
  );
};

