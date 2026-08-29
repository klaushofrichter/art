import { Router, Request, Response } from 'express';
import { Room } from '../content';
import { renderGallery } from '../views/gallery';

export function indexRouter(rooms: Room[]): Router {
  const router = Router();
  // Rendered once at boot: the content only changes when the image is
  // rebuilt, so there is nothing to recompute per request.
  const html = renderGallery(rooms);
  router.get('/', (_req: Request, res: Response) => {
    res.status(200).type('html').send(html);
  });
  return router;
}
