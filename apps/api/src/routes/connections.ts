import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage } from '../middleware/usage.js';
import { connectionService } from '../services/connection.service.js';
import { config } from '../config/index.js';
import { getGlobalCredentialsForPlatform } from '../services/admin-settings.service.js';
import {
  MANUAL_CONNECTION_PLATFORMS,
  OAUTH_PLATFORMS,
  GLOBAL_CREDENTIAL_PLATFORMS,
  isPlatformType,
  type PlatformType,
} from '@ee-postmind/shared';

export const connectionRouter = Router();
const oauthPlatforms = new Set<PlatformType>(OAUTH_PLATFORMS);
const manualPlatforms = new Set<PlatformType>(MANUAL_CONNECTION_PLATFORMS);
const globalCredPlatforms = new Set<PlatformType>(GLOBAL_CREDENTIAL_PLATFORMS);

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

// Check which custom platforms have global credentials configured
connectionRouter.get(
  '/global-platforms',
  authenticate,
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const available: string[] = [];
      for (const platform of GLOBAL_CREDENTIAL_PLATFORMS) {
        const creds = await getGlobalCredentialsForPlatform(platform);
        if (creds) available.push(platform);
      }
      res.json({ success: true, data: available });
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
      const rawPlatform = req.params.platform as string;
      if (!isPlatformType(rawPlatform)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PLATFORM', message: 'Unsupported platform' } });
      }
      const platform = rawPlatform as PlatformType;
      if (!oauthPlatforms.has(platform)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_OAUTH_PLATFORM',
            message: 'This platform uses manual connection',
          },
        });
      }

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
  async (req: AuthRequest, res: Response) => {
    try {
      const rawPlatform = req.params.platform as string;
      if (!isPlatformType(rawPlatform)) {
        return res.redirect(`${config.frontend.url}/connections?error=invalid_platform`);
      }
      const platform = rawPlatform as PlatformType;
      if (!oauthPlatforms.has(platform)) {
        return res.redirect(`${config.frontend.url}/connections?error=invalid_connection_mode`);
      }

      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code || !state) {
        return res.redirect(`${config.frontend.url}/connections?error=missing_params`);
      }

      let workspaceId: string;
      try {
        workspaceId = connectionService.getWorkspaceIdFromState(platform, state);
      } catch {
        return res.redirect(`${config.frontend.url}/connections?error=invalid_state`);
      }

      await connectionService.completeConnection(workspaceId, platform, code, state);
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
      const rawPlatform = req.params.platform as string;
      if (!isPlatformType(rawPlatform)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PLATFORM', message: 'Unsupported platform' } });
      }
      const platform = rawPlatform as PlatformType;
      if (!manualPlatforms.has(platform)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MANUAL_PLATFORM',
            message: 'This platform requires OAuth connection',
          },
        });
      }

      let { credentials } = req.body;

      // If no credentials provided, try global credentials for custom platforms
      if ((!credentials || typeof credentials !== 'string') && globalCredPlatforms.has(platform)) {
        const globalCreds = await getGlobalCredentialsForPlatform(platform);
        if (globalCreds) {
          credentials = globalCreds;
        }
      }

      if (!credentials || typeof credentials !== 'string') {
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

// Connection health check
connectionRouter.post(
  '/:connectionId/health-check',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const health = await connectionService.checkConnectionHealth(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: health });
    } catch (err) {
      next(err);
    }
  },
);
