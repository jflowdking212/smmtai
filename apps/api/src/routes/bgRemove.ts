import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const bgRemoveRouter = Router();

/**
 * Proxy endpoint for background removal.
 * Forwards the uploaded image to remove.bg and returns the result.
 * Requires REMOVEBG_API_KEY in environment.
 */
bgRemoveRouter.post(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const apiKey = process.env.REMOVEBG_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          success: false,
          error: { code: 'NOT_CONFIGURED', message: 'Background removal API key not configured' },
        });
      }

      // Forward the multipart body to remove.bg
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const body = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || 'application/octet-stream';

          const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
              'X-Api-Key': apiKey,
              'Content-Type': contentType,
            },
            body,
          });

          if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
              success: false,
              error: { code: 'BG_REMOVAL_FAILED', message: errorText },
            });
          }

          const resultBuffer = Buffer.from(await response.arrayBuffer());
          res.set('Content-Type', 'image/png');
          res.send(resultBuffer);
        } catch (err) {
          next(err);
        }
      });
    } catch (err) {
      next(err);
    }
  },
);
