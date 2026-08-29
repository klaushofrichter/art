import { Router, Request, Response } from 'express';

/** The page is rendered when the content changes, not per request — but it
 *  is read through a getter so a reload is picked up. */
export function indexRouter(html: () => string): Router {
  const router = Router();
  router.get('/', (_req: Request, res: Response) => {
    res.status(200).type('html').send(html());
  });
  return router;
}
