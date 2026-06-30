import type { Express } from 'express';
import { createApp } from '../server';

let app: Express | null = null;

function getApp(): Express {
  if (!app) {
    app = createApp();
  }
  return app;
}

function normalizeApiUrl(req: { url?: string }) {
  const rawUrl = req.url || '/';
  const queryIndex = rawUrl.indexOf('?');
  const pathname = queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl;
  const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';

  if (!pathname.startsWith('/api')) {
    req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`;
  }
}

export default async function handler(req: any, res: any) {
  try {
    normalizeApiUrl(req);
    const expressApp = getApp();

    await new Promise<void>((resolve, reject) => {
      expressApp(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    console.error('[api] handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'API error'
      });
    }
  }
}
