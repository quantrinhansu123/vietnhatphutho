import type { Express } from 'express';
import { createApp } from '../server';

let app: Express | null = null;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      app = await createApp();
    }
    return app(req, res);
  } catch (error) {
    console.error('[API] Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Lỗi server API.' });
    }
  }
}
