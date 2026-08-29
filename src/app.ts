import express, { Express } from 'express';
import { ASSETS_DIR, Room, loadRooms } from './content';
import { PUBLIC_DIR } from './fingerprint';
import { healthRouter } from './routes/health';
import { indexRouter } from './routes/index';
import { buyRouter } from './routes/buy';

export function createApp(rooms: Room[] = loadRooms()): Express {
  const app = express();
  app.disable('x-powered-by');

  const works = rooms.reduce((n, r) => n + r.works.length, 0);
  app.use(healthRouter({ rooms: rooms.length, works }));

  // The pictures and the client bundle are immutable for the life of an
  // image — a new deploy is a new container, so caching them hard is safe.
  // Not in development, where the files change under a running process and
  // a year-long cache would hide every edit.
  const oneYear = process.env.NODE_ENV === 'production'
    ? ({ maxAge: '365d', immutable: true } as const)
    : ({ maxAge: 0, etag: true } as const);
  app.use('/assets', express.static(ASSETS_DIR, oneYear));
  app.use(express.static(PUBLIC_DIR, oneYear));

  app.use(buyRouter(rooms));
  app.use(indexRouter(rooms));
  return app;
}
