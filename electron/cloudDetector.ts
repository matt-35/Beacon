import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CloudDriveSuggestion } from '../src/core/types';

async function existsDir(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function detectCloudDrives(): Promise<CloudDriveSuggestion[]> {
  const home = os.homedir();
  const suggestions: CloudDriveSuggestion[] = [];
  const seen = new Set<string>();

  const addIfExists = async (provider: string, label: string, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    if (seen.has(resolved)) return;
    if (await existsDir(resolved)) {
      seen.add(resolved);
      suggestions.push({
        provider,
        label,
        path: resolved,
        recommendedDataPath: path.join(resolved, 'Beacon')
      });
    }
  };

  if (process.platform === 'darwin') {
    const cloudStorage = path.join(home, 'Library', 'CloudStorage');
    if (await existsDir(cloudStorage)) {
      try {
        const entries = await fs.readdir(cloudStorage);
        for (const entry of entries) {
          const full = path.join(cloudStorage, entry);
          if (entry.startsWith('OneDrive')) {
            await addIfExists('OneDrive', `OneDrive (${entry})`, full);
          } else if (entry.startsWith('GoogleDrive')) {
            const myDrive = path.join(full, 'My Drive');
            if (await existsDir(myDrive)) {
              await addIfExists('Google Drive', 'Google Drive (My Drive)', myDrive);
            } else {
              await addIfExists('Google Drive', `Google Drive (${entry})`, full);
            }
          } else if (entry.startsWith('Dropbox')) {
            await addIfExists('Dropbox', 'Dropbox', full);
          }
        }
      } catch {
        // ignore permission errors
      }
    }

    await addIfExists(
      'iCloud Drive',
      'iCloud Drive',
      path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
    );
  }

  if (process.platform === 'win32') {
    if (process.env.OneDrive) {
      await addIfExists('OneDrive', 'OneDrive', process.env.OneDrive);
    }
    if (process.env.OneDriveCommercial) {
      await addIfExists('OneDrive', 'OneDrive (Work)', process.env.OneDriveCommercial);
    }
  }

  // Common fallback paths across macOS, Windows, and Linux
  await addIfExists('OneDrive', 'OneDrive', path.join(home, 'OneDrive'));
  await addIfExists('Google Drive', 'Google Drive', path.join(home, 'Google Drive'));
  await addIfExists('Dropbox', 'Dropbox', path.join(home, 'Dropbox'));
  await addIfExists('Syncthing', 'Syncthing', path.join(home, 'Sync'));

  return suggestions;
}

