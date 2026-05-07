import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

export const facebookRouter = Router();

interface SignedRequestPayload {
  user_id: string;
  algorithm: string;
  issued_at: number;
}

/**
 * Parse and verify a Facebook signed_request.
 * See: https://developers.facebook.com/docs/games/gamesonfacebook/login#parsingsr
 */
function parseSignedRequest(signedRequest: string, secret: string): SignedRequestPayload {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  if (!encodedSig || !payload) {
    throw new AppError('Malformed signed_request', 400, 'INVALID_SIGNED_REQUEST');
  }

  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    throw new AppError('Invalid signed_request signature', 403, 'INVALID_SIGNATURE');
  }

  const decoded = JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
  ) as SignedRequestPayload;

  if (decoded.algorithm?.toUpperCase() !== 'HMAC-SHA256') {
    throw new AppError('Unsupported signing algorithm', 400, 'UNSUPPORTED_ALGORITHM');
  }

  return decoded;
}

// Facebook Data Deletion Request Callback
facebookRouter.post(
  '/data-deletion',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signedRequest = req.body?.signed_request as string | undefined;
      if (!signedRequest) {
        throw new AppError('Missing signed_request', 400, 'MISSING_SIGNED_REQUEST');
      }

      const secret = config.oauth.facebook.clientSecret;
      if (!secret) {
        throw new AppError('Facebook app secret not configured', 500, 'CONFIG_ERROR');
      }

      const data = parseSignedRequest(signedRequest, secret);
      const facebookUserId = data.user_id;

      const { prisma } = await import('../config/database.js');

      // Find user linked to this Facebook account
      const oauthAccount = await prisma.oAuthAccount.findUnique({
        where: { provider_providerId: { provider: 'facebook', providerId: facebookUserId } },
        select: { userId: true },
      });

      if (oauthAccount) {
        // Delete the user and all cascaded data
        await prisma.user.delete({ where: { id: oauthAccount.userId } });
      }

      const confirmationCode = crypto.randomUUID();
      const statusUrl = `${config.frontend.url}/data-deletion?code=${confirmationCode}`;

      res.json({ url: statusUrl, confirmation_code: confirmationCode });
    } catch (err) {
      next(err);
    }
  },
);
