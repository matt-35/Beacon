import { JSDOM } from 'jsdom';
import type { FetchedMetadata } from './types';

const FETCH_TIMEOUT_MS = 8000;

function pickMetaContent(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const content = el?.getAttribute('content')?.trim();
    if (content) return content;
  }
  return '';
}

function resolveUrlSafe(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function inferImageExt(contentType: string | null, url: string): string {
  if (contentType) {
    if (contentType.includes('svg')) return 'svg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('icon') || contentType.includes('ico')) return 'ico';
  }
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.svg')) return 'svg';
  if (cleanUrl.endsWith('.png')) return 'png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'jpg';
  if (cleanUrl.endsWith('.webp')) return 'webp';
  return 'ico';
}

export async function fetchPageHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookmarkManager/1.0)',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMetadata(url: string, preloadedHtml?: string): Promise<FetchedMetadata> {
  const html = preloadedHtml ?? (await fetchPageHtml(url));
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const ogTitle = pickMetaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']);
  const docTitle = doc.title?.trim() ?? '';
  const title = ogTitle || docTitle || new URL(url).hostname;

  const description = pickMetaContent(doc, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]'
  ]);

  const rawThumb = pickMetaContent(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  const thumbnailUrl = resolveUrlSafe(rawThumb, url);

  const iconHref =
    doc.querySelector('link[rel="icon"]')?.getAttribute('href') ??
    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ??
    doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');

  const faviconUrl = resolveUrlSafe(iconHref, url) ?? `${new URL(url).origin}/favicon.ico`;

  let faviconBuffer: Buffer | null = null;
  let faviconExt: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const iconRes = await fetch(faviconUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (iconRes.ok) {
      const arrayBuf = await iconRes.arrayBuffer();
      if (arrayBuf.byteLength > 0 && arrayBuf.byteLength < 512 * 1024) {
        faviconBuffer = Buffer.from(arrayBuf);
        faviconExt = inferImageExt(iconRes.headers.get('content-type'), faviconUrl);
      }
    }
  } catch {
    // Favicon fetch is best-effort
  }

  return {
    title,
    description,
    thumbnailUrl,
    faviconBuffer,
    faviconExt
  };
}

