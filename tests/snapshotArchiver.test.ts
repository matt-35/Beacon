import { describe, it, expect } from 'vitest';
import { extractReadableSnapshot } from '../src/core/snapshotArchiver';

describe('snapshotArchiver', () => {
  it('extracts readable article HTML and strips script tags and inline handlers', () => {
    const rawHtml = `
      <!doctype html>
      <html>
        <head><title>Offline Article</title></head>
        <body>
          <article>
            <h1>Offline Article</h1>
            <p onclick="alert('xss')">This is a long enough paragraph for readability to extract properly as the main content of the page. Adding extra words ensures Readability treats it as an article.</p>
            <script>window.evil = true;</script>
          </article>
        </body>
      </html>
    `;

    const snapshot = extractReadableSnapshot('https://example.com/article', rawHtml);
    expect(snapshot).toContain('Offline Article');
    expect(snapshot).toContain('long enough paragraph');
    expect(snapshot).not.toContain('<script>');
    expect(snapshot).not.toContain('onclick=');
  });
});

