const titleEl = document.getElementById('title');
const urlEl = document.getElementById('url');
const tagsEl = document.getElementById('tags');
const readLaterEl = document.getElementById('readLater');
const saveSnapshotEl = document.getElementById('saveSnapshot');
const portEl = document.getElementById('port');
const tokenEl = document.getElementById('token');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    titleEl.value = tab.title || '';
    urlEl.value = tab.url || '';
  }

  const stored = await chrome.storage.local.get(['apiPort', 'apiToken']);
  if (stored.apiPort) portEl.value = stored.apiPort;
  if (stored.apiToken) tokenEl.value = stored.apiToken;
}

saveBtn.addEventListener('click', async () => {
  const port = Number(portEl.value) || 48123;
  const token = tokenEl.value.trim();

  await chrome.storage.local.set({ apiPort: port, apiToken: token });

  if (!token) {
    statusEl.textContent = 'Paste your API token in Desktop App Connection.';
    statusEl.className = 'status err';
    return;
  }

  saveBtn.disabled = true;
  statusEl.textContent = 'Saving...';
  statusEl.className = 'status';

  try {
    const tags = tagsEl.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(`http://127.0.0.1:${port}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        url: urlEl.value.trim(),
        title: titleEl.value.trim(),
        tags,
        isReadLater: readLaterEl.checked,
        saveSnapshot: saveSnapshotEl.checked,
        fetchMetadata: true
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    statusEl.textContent = 'Saved to Bookmark Manager!';
    statusEl.className = 'status ok';
    setTimeout(() => window.close(), 900);
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : 'Failed to connect to app';
    statusEl.className = 'status err';
  } finally {
    saveBtn.disabled = false;
  }
});

init();

