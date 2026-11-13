import { JSDOM } from 'jsdom';
import { v4 as uuidv4 } from 'uuid';
import type { BookmarkItem, FolderItem } from './types';

export interface ImportedBookmarkData {
  folders: FolderItem[];
  bookmarks: BookmarkItem[];
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseNetscapeHtml(html: string, deviceId: string): ImportedBookmarkData {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const folders: FolderItem[] = [];
  const bookmarks: BookmarkItem[] = [];
  const now = new Date().toISOString();

  function walkDl(dl: Element, parentFolderId: string | null): void {
    const children = Array.from(dl.children);
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (el.tagName !== 'DT') continue;

      const h3 = el.querySelector(':scope > H3');
      if (h3) {
        const folderId = uuidv4();
        const folderName = h3.textContent?.trim() || 'Untitled Folder';
        folders.push({
          id: folderId,
          name: folderName,
          parentId: parentFolderId,
          color: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          deviceId
        });

        // Netscape HTML puts nested <DL> either inside <DT> or as the next sibling
        const nestedDl =
          el.querySelector(':scope > DL') ??
          (children[i + 1]?.tagName === 'DL' ? children[i + 1] : null);
        if (nestedDl) {
          walkDl(nestedDl, folderId);
        }
        continue;
      }

      const anchor = el.querySelector(':scope > A');
      if (anchor) {
        const url = anchor.getAttribute('href')?.trim();
        if (!url) continue;

        const addDateRaw = anchor.getAttribute('add_date');
        const createdAt =
          addDateRaw && /^\d+$/.test(addDateRaw)
            ? new Date(Number(addDateRaw) * 1000).toISOString()
            : now;

        const tagsAttr = anchor.getAttribute('tags') ?? '';
        const tags = tagsAttr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        bookmarks.push({
          id: uuidv4(),
          url,
          title: anchor.textContent?.trim() || url,
          description: '',
          tags,
          folderId: parentFolderId,
          faviconPath: null,
          thumbnailUrl: null,
          isFavorite: false,
          isReadLater: false,
          hasSnapshot: false,
          createdAt,
          updatedAt: now,
          deletedAt: null,
          deviceId
        });
      }
    }
  }

  const rootDl = doc.querySelector('DL');
  if (rootDl) {
    walkDl(rootDl, null);
  }

  return { folders, bookmarks };
}

export function serializeNetscapeHtml(
  bookmarks: BookmarkItem[],
  folders: FolderItem[]
): string {
  const activeBookmarks = bookmarks.filter((b) => !b.deletedAt);
  const activeFolders = folders.filter((f) => !f.deletedAt);

  const foldersByParent = new Map<string | null, FolderItem[]>();
  for (const folder of activeFolders) {
    const key = folder.parentId ?? null;
    const list = foldersByParent.get(key) ?? [];
    list.push(folder);
    foldersByParent.set(key, list);
  }

  const bookmarksByFolder = new Map<string | null, BookmarkItem[]>();
  for (const bm of activeBookmarks) {
    const key = bm.folderId ?? null;
    const list = bookmarksByFolder.get(key) ?? [];
    list.push(bm);
    bookmarksByFolder.set(key, list);
  }

  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];

  function renderFolderContents(parentId: string | null, indent: string): void {
    const childFolders = foldersByParent.get(parentId) ?? [];
    for (const folder of childFolders) {
      const addDate = Math.floor(Date.parse(folder.createdAt) / 1000) || 0;
      lines.push(`${indent}<DT><H3 ADD_DATE="${addDate}">${escapeHtmlAttr(folder.name)}</H3>`);
      lines.push(`${indent}<DL><p>`);
      renderFolderContents(folder.id, indent + '    ');
      lines.push(`${indent}</DL><p>`);
    }

    const childBookmarks = bookmarksByFolder.get(parentId) ?? [];
    for (const bm of childBookmarks) {
      const addDate = Math.floor(Date.parse(bm.createdAt) / 1000) || 0;
      const tagsAttr = bm.tags.length > 0 ? ` TAGS="${escapeHtmlAttr(bm.tags.join(','))}"` : '';
      lines.push(
        `${indent}<DT><A HREF="${escapeHtmlAttr(bm.url)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeHtmlAttr(bm.title)}</A>`
      );
    }
  }

  renderFolderContents(null, '    ');
  lines.push('</DL><p>');
  return lines.join('\n');
}

