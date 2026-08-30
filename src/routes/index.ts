import { Router, Request, Response } from 'express';

/** The gallery. Pages are rendered when the content changes, not per request,
 *  but they are read through a getter so a reload is picked up.
 *
 *  `?id=` is a permalink to a room or a picture. The browser resolves it
 *  itself; the server resolves it too, only so that a link preview shows what
 *  was actually shared. An unknown id falls back to the gallery, which is what
 *  the client does with it as well. */
export function indexRouter(gallery: (uid?: string) => string): Router {
  const router = Router();
  router.get('/', (req: Request, res: Response) => {
    const id = req.query.id;
    res.status(200).type('html').send(gallery(typeof id === 'string' ? id : undefined));
  });
  return router;
}
