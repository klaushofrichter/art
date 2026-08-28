import { Router, Request, Response } from 'express';
import { renderPage } from '../views/page';

export const indexRouter = Router();

indexRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).type('html').send(renderPage());
});
