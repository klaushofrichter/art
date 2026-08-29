import { Router, Request, Response } from 'express';
import { Room, findWork } from '../content';
import { renderBuy } from '../views/buy';

export function buyRouter(rooms: () => Room[]): Router {
  const router = Router();
  router.get('/buy/:room/:slug', (req: Request, res: Response) => {
    const found = findWork(rooms(), req.params.room, req.params.slug);
    if (!found) {
      res.status(404).type('html').send(
        '<!DOCTYPE html><meta charset="utf-8"><title>Not found</title>' +
        '<body style="background:#0B1017;color:#EDE7DA;font-family:system-ui;padding:12vh 8vw">' +
        '<h1 style="font-weight:400">That picture is not here.</h1>' +
        '<p><a style="color:#C9A227" href="/">Back to the gallery</a></p>'
      );
      return;
    }
    // index.json may point a work at somewhere else entirely. The gallery
    // always links to this canonical path, so the redirect lives here rather
    // than in the browser — the client never handles a URL from content.
    const canonical = `/buy/${found.room.id}/${found.work.slug}`;
    if (found.work.purchaseUrl && found.work.purchaseUrl !== canonical) {
      res.redirect(302, found.work.purchaseUrl);
      return;
    }
    res.status(200).type('html').send(renderBuy(found.room, found.work));
  });
  return router;
}
