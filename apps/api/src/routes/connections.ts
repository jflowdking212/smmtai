import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage } from '../middleware/usage.js';
import { connectionService } from '../services/connection.service.js';
import { config } from '../config/index.js';
import type { PlatformType } from '@ee-postmind/shared';

export const connectionRouter = Router();

// List all connections
connectionRouter.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const connections = await connectionService.listConnections(req.workspaceId);
      res.json({ success: true, data: connections });
    } catch (err) {
      next(err);
    }
  },
);

// Initiate OAuth connection
connectionRouter.post(
  '/:platform/auth',
  authenticate,
  checkUsage('social_accounts'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const platform = req.params.platform as PlatformType;
      const authUrl = await connectionService.initiateConnection(req.workspaceId, platform);
      res.json({ success: true, data: { authUrl } });
    } catch (err) {
      next(err);
    }
  },
);

// OAuth callback
connectionRouter.get(
  '/:platform/callback',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const platform = req.params.platform as PlatformType;
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        return res.redirect(`${config.frontend.url}/connections?error=missing_params`);
      }

      // Decode workspace from state
      let workspaceId: string;
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
        workspaceId = parsed.workspaceId;
      } catch {
        return res.redirect(`${config.frontend.url}/connections?error=invalid_state`);
      }

      await connectionService.completeConnection(workspaceId, platform, code);
      res.redirect(`${config.frontend.url}/connections?connected=${platform}`);
    } catch (err) {
      res.redirect(`${config.frontend.url}/connections?error=connection_failed`);
    }
  },
);

// Manual connection (Bluesky, Telegram, WoWonder, Sngine)
connectionRouter.post(
  '/:platform/connect',
  authenticate,
  checkUsage('social_accounts'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const platform = req.params.platform as PlatformType;
      const { credentials } = req.body;
      if (!credentials) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_CREDENTIALS', message: 'Credentials required' } });
      }

      const connection = await connectionService.manualConnect(req.workspaceId, platform, credentials);
      res.status(201).json({ success: true, data: connection });
    } catch (err) {
      next(err);
    }
  },
);

// Disconnect
connectionRouter.delete(
  '/:connectionId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      await connectionService.disconnect(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: { message: 'Disconnected' } });
    } catch (err) {
      next(err);
    }
  },
);
