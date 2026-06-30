import type { Express } from 'express';
import { createApp } from '../server';

let app: Express | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = createApp();
    }

    const originalUrl = req.url || '/';
    if (!originalUrl.startsWith('/api')) {
      req.url = originalUrl.startsWith('/') ? `/api${originalUrl}` : `/api/${originalUrl}`;
    }

    return app(req, res);
  } catch (error) {
    console.error('[API] Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Lỗi server API.' });
    }
  }
}
