import { Router, Request, Response } from 'express';
import { Room, findWork } from '../content';
import { renderBuy } from '../views/buy';

export function buyRouter(rooms: Room[]): Router {
  const router = Router();
  router.get('/buy/:room/:slug', (req: Request, res: Response) => {
    const found = findWork(rooms, req.params.room, req.params.slug);
    if (!found) {
      res.status(404).type('html').send(
        '<!DOCTYPE html><meta charset="utf-8"><title>Not found</title>' +
        '<body style="background:#0B1017;color:#EDE7DA;font-family:system-ui;padding:12vh 8vw">' +
        '<h1 style="font-weight:400">That picture is not here.</h1>' +
        '<p><a style="color:#C9A227" href="/">Back to the gallery</a></p>'
      );
      return;
    }
    res.status(200).type('html').send(renderBuy(found.room, found.work));
  });
  return router;
}
