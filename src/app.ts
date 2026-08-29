import express, { Express } from 'express';
import { ASSETS_DIR, Room, loadRooms } from './content';
import { PUBLIC_DIR } from './fingerprint';
import { renderGallery } from './views/gallery';
import { healthRouter } from './routes/health';
import { indexRouter } from './routes/index';
import { buyRouter } from './routes/buy';

export type GalleryApp = Express & {
  /** Re-read the content from disk. Returns false and keeps what it has if
   *  the new content will not load — a bad edit must never blank a gallery
   *  that is already serving. Unlike at boot, where throwing is right because
   *  there is nothing to fall back to. */
  reloadContent(): boolean;
};

export function createApp(
  rooms: Room[] = loadRooms(),
  assetsDir: string = ASSETS_DIR,
): GalleryApp {
  let current = rooms;
  let html = renderGallery(current);

  const app = express() as GalleryApp;
  app.disable('x-powered-by');

  app.reloadContent = () => {
    try {
      const next = loadRooms(assetsDir);
      if (!next.length) {
        console.warn('content: reload found no rooms — keeping what is loaded');
        return false;
      }
      current = next;
      html = renderGallery(current);
      return true;
    } catch (err) {
      console.warn(`content: reload failed, keeping what is loaded — ${err}`);
      return false;
    }
  };

  app.use(healthRouter(() => current));

  // The pictures and the client bundle are immutable for the life of an
  // image — a new deploy is a new container, so caching them hard is safe.
  // Not in development, where the files change under a running process and
  // a year-long cache would hide every edit.
  const oneYear = process.env.NODE_ENV === 'production'
    ? ({ maxAge: '365d', immutable: true } as const)
    : ({ maxAge: 0, etag: true } as const);
  app.use('/assets', express.static(assetsDir, oneYear));
  app.use(express.static(PUBLIC_DIR, oneYear));

  // A page carries the fingerprinted URLs of the assets it needs, so it must
  // never be served from cache without checking first. A stale page points at
  // stale assets, and those are immutable for a year — a visitor would be
  // stuck on an old build with no way to reload out of it. "no-cache" still
  // caches; it just requires revalidation, which the ETag makes a cheap 304.
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  app.use(buyRouter(() => current));
  app.use(indexRouter(() => html));
  return app;
}
