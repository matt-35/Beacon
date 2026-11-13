import type { BookmarkApi } from '../../electron/preload';

declare global {
  interface Window {
    bookmarkApi: BookmarkApi;
  }
}

export {};

