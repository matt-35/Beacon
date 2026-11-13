import http from 'node:http';
import type { BookmarkInput, BookmarkItem, FolderItem } from '../src/core/types';

export interface LocalApiHandlers {
  onAddBookmark: (input: BookmarkInput) => Promise<BookmarkItem>;
  getFolders: () => FolderItem[];
}

export class LocalApiServer {
  private server: http.Server | null = null;
  public activePort = 0;

  constructor(
    private readonly token: string,
    private readonly preferredPort: number,
    private readonly handlers: LocalApiHandlers
  ) {}

  async start(): Promise<number> {
    if (this.server) return this.activePort;

    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const authHeader = req.headers.authorization ?? '';
      if (authHeader !== `Bearer ${this.token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'GET' && req.url === '/api/folders') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ folders: this.handlers.getFolders() }));
        return;
      }

      if (req.method === 'POST' && req.url === '/api/bookmarks') {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as BookmarkInput;
          if (!body.url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'url is required' }));
            return;
          }
          const created = await this.handlers.onAddBookmark(body);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ bookmark: created }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Failed to create bookmark'
            })
          );
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server = server;

    return new Promise<number>((resolve, reject) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && this.preferredPort !== 0) {
          server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            this.activePort = typeof addr === 'object' && addr ? addr.port : 0;
            resolve(this.activePort);
          });
        } else {
          reject(err);
        }
      });

      server.listen(this.preferredPort, '127.0.0.1', () => {
        const addr = server.address();
        this.activePort = typeof addr === 'object' && addr ? addr.port : this.preferredPort;
        resolve(this.activePort);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.server = null;
    this.activePort = 0;
  }
}

