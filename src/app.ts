import express, { Express } from 'express';
import compression from 'compression';
import { ASSETS_DIR, Room, loadRooms } from './content';
import { PUBLIC_DIR } from './fingerprint';
import { renderGallery } from './views/gallery';
import { shareVariants } from './views/shares';
import { healthRouter } from './routes/health';
import { indexRouter } from './routes/index';
import { buyRouter } from './routes/buy';
import { legalRouter } from './routes/legal';
import { TRUSTED_PROXIES, galleryLimiter } from './ratelimit';

export type GalleryApp = Express & {
  /** Re-read the content from disk. Returns false and keeps what it has if
   *  the new content will not load — a bad edit must never blank a gallery
   *  that is already serving. Unlike at boot, where throwing is right because
   *  there is nothing to fall back to. */
  reloadContent(): boolean;
  /** What the app is serving right now. The watcher used to answer that by
   *  reading the directory a second time, which put a `loadRooms` outside
   *  the try/catch above — the one place a bad edit was guaranteed to be
   *  caught — and threw for its trouble if the content changed again in
   *  between. */
  rooms(): Room[];
};

export function createApp(
  rooms?: Room[],
  assetsDir: string = ASSETS_DIR,
): GalleryApp {
  // Defaulting to loadRooms() would read ASSETS_DIR even when a caller named
  // a different directory, and then the pages and the /assets route would
  // disagree about which content they are serving.
  let current = rooms ?? loadRooms(assetsDir);
  let html = renderGallery(current);
  // One pre-rendered page per permalink, so a shared ?id= previews the
  // picture it names. Twenty-odd copies of a 12KB page; built with the
  // content, never per request.
  let shares = shareVariants(current);

  const app = express() as GalleryApp;
  app.disable('x-powered-by');

  // Nothing reaches this process directly: Traefik hands to Kourier, Kourier
  // to the queue-proxy sidecar, and only then to us. Without this, `req.ip`
  // is that sidecar — one in-cluster address shared by every visitor on the
  // site. See ratelimit.ts for why the list is CIDRs and not a hop count.
  app.set('trust proxy', TRUSTED_PROXIES);

  // The pages, the stylesheet and the script are text and were going out raw —
  // about 72KB on a cold visit. `compression` skips types that are already
  // compressed, so the pictures are left alone.
  app.use(compression());

  app.rooms = () => current;

  app.reloadContent = () => {
    try {
      const next = loadRooms(assetsDir);
      if (!next.length) {
        console.warn('content: reload found no rooms — keeping what is loaded');
        return false;
      }
      current = next;
      html = renderGallery(current);
      shares = shareVariants(current);
      return true;
    } catch (err) {
      console.warn(`content: reload failed, keeping what is loaded — ${err}`);
      return false;
    }
  };

  // Ahead of the limiter on purpose. The readiness probe polls /health from
  // inside the cluster for the life of the pod; a 429 there marks the pod
  // unready and Knative restarts it, so the probe must not share a budget
  // with anything. Being mounted first, it never reaches the limiter at all.
  app.use(healthRouter(() => current));

  // Everything a visitor actually fetches — pages, pictures, the bundle —
  // is counted, which is what the sizing in ratelimit.ts is measured against.
  app.use(galleryLimiter());

  const production = process.env.NODE_ENV === 'production';

  // A room directory holds more than pictures. `index.json` sits in it — the
  // whole manifest, including every uid and purchase_url, the contact
  // address, and the prices of sold work that views/gallery.ts deliberately
  // never serialises into the page. Serving the pictures out of that
  // directory was serving all of that with them.
  //
  // An allowlist rather than a rule about index.json, because the directory
  // is filled by a content sync rather than by this repository: an editor
  // backup, a stray note, a spreadsheet of prices, anything that happens to
  // be in the folder when someone runs the script. None of it becomes public
  // by being copied next to a picture.
  const PICTURE = /\.(?:jpe?g|png|webp)$/i;
  app.use('/assets', (req, res, next) => {
    if (PICTURE.test(req.path)) return next();
    // 404 rather than 403: whether a particular file is there is not
    // something a refusal should confirm.
    res.status(404).type('txt').send('Not found');
  });

  // The pictures are replaced without a deploy — a sync writes them straight
  // onto the volume, and make-derivatives.sh rewrites a derivative in place
  // under the same filename. Their URLs therefore do not change when their
  // contents do, so they cannot be pinned: a year of immutable caching left
  // a re-shot picture unreachable for anyone who had seen the old one. An
  // hour, and a week during which a stale copy may be shown while a fresh
  // one is fetched behind it, keeps repeat browsing free without that.
  //
  // The client bundle is the opposite case and keeps the year: its URL
  // carries a content hash (src/fingerprint.ts), so a new build is a new URL
  // and a returning visitor is never stuck on the old one.
  const pictures = production
    ? {
        setHeaders(res: express.Response) {
          res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=604800');
        },
      }
    : ({ maxAge: 0, etag: true } as const);
  const fingerprinted = production
    ? ({ maxAge: '365d', immutable: true } as const)
    : ({ maxAge: 0, etag: true } as const);
  app.use('/assets', express.static(assetsDir, pictures));
  app.use(express.static(PUBLIC_DIR, fingerprinted));

  // A page carries the fingerprinted URLs of the assets it needs, so it must
  // never be served from cache without checking first. A stale page points at
  // stale assets, and those are immutable for a year — a visitor would be
  // stuck on an old build with no way to reload out of it. "no-cache" still
  // caches; it just requires revalidation, which the ETag makes a cheap 304.
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    next();
  });

  app.use(legalRouter());
  app.use(buyRouter(() => current));
  app.use(indexRouter((uid) => (uid && shares.get(uid)) || html));
  return app;
}
