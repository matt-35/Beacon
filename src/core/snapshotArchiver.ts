import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { fetchPageHtml } from './metadataFetcher';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFragment(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;

  for (const el of doc.querySelectorAll('script, iframe, object, embed, form')) {
    el.remove();
  }

  for (const el of doc.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      if (
        (attr.name === 'href' || attr.name === 'src') &&
        attr.value.trim().toLowerCase().startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}

export function extractReadableSnapshot(url: string, rawHtml: string): string {
  const dom = new JSDOM(rawHtml, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title?.trim() || dom.window.document.title?.trim() || url;
  const byline = article?.byline?.trim() ? `<p class="byline">${escapeHtml(article.byline)}</p>` : '';
  const bodyHtml = article?.content
    ? sanitizeFragment(article.content)
    : sanitizeFragment(dom.window.document.body?.innerHTML ?? '<p>No readable content extracted.</p>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      max-width: 720px;
      margin: 2rem auto;
      padding: 0 1.25rem;
      color: #1f2937;
      background: #ffffff;
    }
    h1 { font-size: 1.85rem; line-height: 1.25; margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.9rem; margin-bottom: 1.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
    .byline { margin: 0.25rem 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    pre, code { background: #f3f4f6; padding: 0.15rem 0.35rem; border-radius: 4px; overflow-x: auto; }
    pre { padding: 0.85rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      ${byline}
      <div>Saved from <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div>
    </div>
    ${bodyHtml}
  </article>
</body>
</html>`;
}

export async function archiveUrlSnapshot(url: string): Promise<string> {
  const html = await fetchPageHtml(url);
  return extractReadableSnapshot(url, html);
}

