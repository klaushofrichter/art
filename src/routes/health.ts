import { Router, Request, Response } from 'express';
import { Room } from '../content';
import { appVersion } from '../version';

/** Reads the rooms through a getter rather than a snapshot, so the counts
 *  stay true after content is reloaded under a running server. */
export function healthRouter(rooms: () => Room[]): Router {
  const router = Router();
  router.get('/health', (_req: Request, res: Response) => {
    const current = rooms();
    res.status(200).json({
      status: 'ok',
      service: 'art',
      version: appVersion(),
      rooms: current.length,
      works: current.reduce((n, r) => n + r.works.length, 0),
    });
  });
  return router;
}
