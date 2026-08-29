import { Router, Request, Response } from 'express';
import { LEGAL_DOCS } from '../legal';
import { renderLegal } from '../views/legal';

/** /terms and /privacy. They are fixed documents, so they are rendered once
 *  at startup rather than per request — unlike the gallery, nothing on the
 *  content volume can change them. */
export function legalRouter(): Router {
  const router = Router();
  for (const doc of LEGAL_DOCS) {
    const html = renderLegal(doc);
    router.get(doc.path, (_req: Request, res: Response) => {
      res.status(200).type('html').send(html);
    });
  }
  return router;
}
