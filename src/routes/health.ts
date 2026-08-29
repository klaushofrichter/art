import { Router, Request, Response } from 'express';
import { appVersion } from '../version';

export function healthRouter(counts: { rooms: number; works: number }): Router {
  const router = Router();
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'art',
      version: appVersion(),
      rooms: counts.rooms,
      works: counts.works,
    });
  });
  return router;
}
