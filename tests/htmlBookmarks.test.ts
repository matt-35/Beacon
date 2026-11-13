import { describe, it, expect } from 'vitest';
import { parseNetscapeHtml, serializeNetscapeHtml } from '../src/core/htmlBookmarks';

describe('htmlBookmarks', () => {
  it('round-trips nested folders, bookmarks, and tags in Netscape HTML format', () => {
    const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
      <TITLE>Bookmarks</TITLE>
      <H1>Bookmarks</H1>
      <DL><p>
        <DT><H3 ADD_DATE="1700000000">Work</H3>
        <DL><p>
          <DT><A HREF="https://github.com" ADD_DATE="1700000001" TAGS="git,code">GitHub</A>
        </DL><p>
        <DT><A HREF="https://news.ycombinator.com" ADD_DATE="1700000002">Hacker News</A>
      </DL><p>
    `;

    const parsed = parseNetscapeHtml(sample, 'device-test');
    expect(parsed.folders).toHaveLength(1);
    expect(parsed.folders[0].name).toBe('Work');
    expect(parsed.bookmarks).toHaveLength(2);
    expect(parsed.bookmarks[0].folderId).toBe(parsed.folders[0].id);
    expect(parsed.bookmarks[0].tags).toEqual(['git', 'code']);

    const exported = serializeNetscapeHtml(parsed.bookmarks, parsed.folders);
    const reparsed = parseNetscapeHtml(exported, 'device-test');
    expect(reparsed.folders).toHaveLength(1);
    expect(reparsed.bookmarks).toHaveLength(2);
    expect(reparsed.bookmarks[0].url).toBe('https://github.com');
  });
});

