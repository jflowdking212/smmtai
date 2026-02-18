import express from 'express';
import type { Router } from 'express';
import { errorHandler } from '../../middleware/errorHandler.js';

export function createTestApp(basePath: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  app.use(errorHandler);
  return app;
}
