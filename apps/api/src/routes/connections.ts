import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkUsage } from '../middleware/usage.js';
import { connectionService } from '../services/connection.service.js';
import { config } from '../config/index.js';
import { getGlobalCredentialsForPlatform, getPlatformCredentials } from '../services/admin-settings.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { getPlatformAdapter } from '../services/platforms/index.js';
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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readCredentialAliases(payload: Record<string, unknown>) {
  const accessToken = normalizeString(payload.accessToken) || normalizeString(payload.token) || normalizeString(payload.access_token);
  const apiKey = normalizeString(payload.apiKey) || normalizeString(payload.api_key) || normalizeString(payload.clientId) || normalizeString(payload.client_id);
  const apiSecret = normalizeString(payload.apiSecret)
    || normalizeString(payload.api_secret)
    || normalizeString(payload.clientSecret)
    || normalizeString(payload.client_secret)
    || normalizeString(payload.serverKey)
    || normalizeString(payload.server_key);
  const usernameEmail = normalizeString(payload.usernameEmail)
    || normalizeString(payload.username_email)
    || normalizeString(payload.email)
    || normalizeString(payload.username);
  const password = normalizeString(payload.password);
  return {
    accessToken,
    apiKey,
    apiSecret,
    usernameEmail,
    password,
  };
}

async function enrichSngineManualCredentials(
  platform: PlatformType,
  rawCredentials: string,
): Promise<string> {
  if (platform !== 'iohah' && platform !== 'chrxstians') return rawCredentials;
  const trimmed = rawCredentials.trim();
  if (!trimmed.startsWith('{')) return rawCredentials;

  let parsed: Record<string, unknown>;
  try {
    const parsedValue = JSON.parse(trimmed);
    const parsedRecord = asRecord(parsedValue);
    if (!parsedRecord) return rawCredentials;
    parsed = parsedRecord;
  } catch {
    return rawCredentials;
  }

  const credentials = readCredentialAliases(parsed);
  if (credentials.apiKey && credentials.apiSecret) return rawCredentials;
  if (!credentials.usernameEmail || !credentials.password) return rawCredentials;

  const envApiKey = platform === 'iohah'
    ? normalizeString(process.env.IOHAH_API_KEY)
    : normalizeString(process.env.CHRXSTIANS_API_KEY);
  const envApiSecret = platform === 'iohah'
    ? normalizeString(process.env.IOHAH_API_SECRET)
    : normalizeString(process.env.CHRXSTIANS_API_SECRET);

  let resolvedApiKey = credentials.apiKey || envApiKey;
  let resolvedApiSecret = credentials.apiSecret || envApiSecret;

  if (!resolvedApiKey || !resolvedApiSecret) {
    const platformCreds = await getPlatformCredentials();
    const entry = platformCreds[platform];
    if (entry) {
      resolvedApiKey = resolvedApiKey || normalizeString(entry.client_id) || normalizeString(entry.access_token);
      resolvedApiSecret = resolvedApiSecret || normalizeString(entry.client_secret) || normalizeString(entry.server_key);
    }
  }

  if (!resolvedApiKey || !resolvedApiSecret) {
    throw new AppError(
      `${platform} API credentials are not configured. Admin must set API key and secret in Admin Settings > Platform Credentials.`,
      400,
      'GLOBAL_PLATFORM_CREDENTIALS_MISSING',
    );
  }

  return JSON.stringify({
    ...parsed,
    apiKey: resolvedApiKey,
    apiSecret: resolvedApiSecret,
  });
}

function normalizeManualCredentials(platform: PlatformType, rawCredentials: string): string {
  if (platform !== 'entreprenrs' && platform !== 'iohah' && platform !== 'chrxstians') return rawCredentials;

  if (platform === 'chrxstians') {
    const envApiKey = (process.env.CHRXSTIANS_API_KEY || '').trim();
    const envApiSecret = (process.env.CHRXSTIANS_API_SECRET || '').trim();
    const envAccessToken = (process.env.CHRXSTIANS_ACCESS_TOKEN || '').trim();
    if (!rawCredentials || !rawCredentials.trim()) {
      if (!envApiKey || !envApiSecret || !envAccessToken) return rawCredentials;
      return JSON.stringify({
        accessToken: envAccessToken,
        apiKey: envApiKey,
        apiSecret: envApiSecret,
      });
    }

    const input = rawCredentials.trim();
    if (!input.startsWith('{')) return rawCredentials;

    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      const accessToken = typeof parsed.accessToken === 'string'
        ? parsed.accessToken.trim()
        : typeof parsed.token === 'string'
          ? parsed.token.trim()
          : '';
      const apiKey = typeof parsed.apiKey === 'string'
        ? parsed.apiKey.trim()
        : typeof parsed.api_key === 'string'
          ? parsed.api_key.trim()
          : '';
      const apiSecret = typeof parsed.apiSecret === 'string'
        ? parsed.apiSecret.trim()
        : typeof parsed.api_secret === 'string'
          ? parsed.api_secret.trim()
          : typeof parsed.serverKey === 'string'
            ? parsed.serverKey.trim()
            : typeof parsed.server_key === 'string'
              ? parsed.server_key.trim()
              : '';
      const usernameEmail = typeof parsed.usernameEmail === 'string'
        ? parsed.usernameEmail.trim()
        : typeof parsed.username_email === 'string'
          ? parsed.username_email.trim()
          : typeof parsed.email === 'string'
            ? parsed.email.trim()
            : typeof parsed.username === 'string'
              ? parsed.username.trim()
              : '';
      const password = typeof parsed.password === 'string' ? parsed.password : '';

      const resolvedApiKey = apiKey || envApiKey;
      const resolvedApiSecret = apiSecret || envApiSecret;
      if (!resolvedApiKey || !resolvedApiSecret) return rawCredentials;

      if (accessToken) {
        return JSON.stringify({
          accessToken,
          apiKey: resolvedApiKey,
          apiSecret: resolvedApiSecret,
        });
      }

      if (usernameEmail && password) {
        return JSON.stringify({
          usernameEmail,
          password,
          apiKey: resolvedApiKey,
          apiSecret: resolvedApiSecret,
        });
      }

      return rawCredentials;
    } catch {
      return rawCredentials;
    }
  }

  if (platform === 'iohah') {
    const envApiKey = (process.env.IOHAH_API_KEY || '').trim();
    const envApiSecret = (process.env.IOHAH_API_SECRET || '').trim();
    const envAccessToken = (process.env.IOHAH_ACCESS_TOKEN || '').trim();
    if (!rawCredentials || !rawCredentials.trim()) {
      if (!envApiKey || !envApiSecret || !envAccessToken) return rawCredentials;
      return JSON.stringify({
        accessToken: envAccessToken,
        apiKey: envApiKey,
        apiSecret: envApiSecret,
      });
    }

    const input = rawCredentials.trim();
    if (!input.startsWith('{')) return rawCredentials;

    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      const accessToken = typeof parsed.accessToken === 'string'
        ? parsed.accessToken.trim()
        : typeof parsed.token === 'string'
          ? parsed.token.trim()
          : '';
      const apiKey = typeof parsed.apiKey === 'string'
        ? parsed.apiKey.trim()
        : typeof parsed.api_key === 'string'
          ? parsed.api_key.trim()
          : '';
      const apiSecret = typeof parsed.apiSecret === 'string'
        ? parsed.apiSecret.trim()
        : typeof parsed.api_secret === 'string'
          ? parsed.api_secret.trim()
          : typeof parsed.serverKey === 'string'
            ? parsed.serverKey.trim()
            : typeof parsed.server_key === 'string'
              ? parsed.server_key.trim()
              : '';
      const usernameEmail = typeof parsed.usernameEmail === 'string'
        ? parsed.usernameEmail.trim()
        : typeof parsed.username_email === 'string'
          ? parsed.username_email.trim()
          : typeof parsed.email === 'string'
            ? parsed.email.trim()
            : typeof parsed.username === 'string'
              ? parsed.username.trim()
              : '';
      const password = typeof parsed.password === 'string' ? parsed.password : '';

      const resolvedApiKey = apiKey || envApiKey;
      const resolvedApiSecret = apiSecret || envApiSecret;
      if (!resolvedApiKey || !resolvedApiSecret) return rawCredentials;

      if (accessToken) {
        return JSON.stringify({
          accessToken,
          apiKey: resolvedApiKey,
          apiSecret: resolvedApiSecret,
        });
      }

      if (usernameEmail && password) {
        return JSON.stringify({
          usernameEmail,
          password,
          apiKey: resolvedApiKey,
          apiSecret: resolvedApiSecret,
        });
      }

      return rawCredentials;
    } catch {
      return rawCredentials;
    }
  }

  const envAccessToken = (process.env.ENTREPRENRS_ACCESS_TOKEN || '').trim();
  const envServerKey = (process.env.ENTREPRENRS_SERVER_KEY || '').trim();
  if (!rawCredentials || !rawCredentials.trim()) {
    if (!envAccessToken || !envServerKey) return rawCredentials;
    return JSON.stringify({ accessToken: envAccessToken, serverKey: envServerKey });
  }

  const input = rawCredentials.trim();
  if (!input.startsWith('{')) return rawCredentials;

  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    const accessToken = typeof parsed.accessToken === 'string'
      ? parsed.accessToken.trim()
      : typeof parsed.token === 'string'
        ? parsed.token.trim()
        : '';
    const serverKey = typeof parsed.serverKey === 'string'
      ? parsed.serverKey.trim()
      : typeof parsed.server_key === 'string'
        ? parsed.server_key.trim()
        : '';
    const rawUserId = typeof parsed.userId === 'string' || typeof parsed.userId === 'number'
      ? parsed.userId
      : typeof parsed.user_id === 'string' || typeof parsed.user_id === 'number'
        ? parsed.user_id
        : undefined;
    const userId = typeof rawUserId === 'string'
      ? rawUserId.trim()
      : typeof rawUserId === 'number'
        ? rawUserId.toString()
        : '';
    const resolvedAccessToken = accessToken || envAccessToken;
    const resolvedServerKey = serverKey || envServerKey;
    const username = typeof parsed.username === 'string' ? parsed.username.trim() : '';
    const password = typeof parsed.password === 'string' ? parsed.password.trim() : '';
    if (!resolvedServerKey) return rawCredentials;
    if (resolvedAccessToken) {
      return JSON.stringify({
        accessToken: resolvedAccessToken,
        serverKey: resolvedServerKey,
        ...(userId ? { userId } : {}),
      });
    }
    if (username && password) {
      return JSON.stringify({
        username,
        password,
        serverKey: resolvedServerKey,
      });
    }
    return rawCredentials;
  } catch {
    return rawCredentials;
  }
}

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

// Exchange Entreprenrs username/password for access token
connectionRouter.post(
  '/entreprenrs/access-token',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const providedServerKey = typeof req.body?.serverKey === 'string' ? req.body.serverKey.trim() : '';
      const serverKey = providedServerKey || (process.env.ENTREPRENRS_SERVER_KEY || '').trim();

      if (!username || !password || !serverKey) {
        throw new AppError(
          'Username and password are required, and server key must be provided or configured in server env',
          400,
          'INVALID_INPUT',
        );
      }

      const adapter = getPlatformAdapter('entreprenrs');
      const tokens = await adapter.exchangeCode(JSON.stringify({ username, password, serverKey }));
      const parsedTokenPayload = JSON.parse(tokens.accessToken) as {
        accessToken?: string;
        serverKey?: string;
        userId?: string | number;
        user_id?: string | number;
      };
      const accessToken = typeof parsedTokenPayload.accessToken === 'string'
        ? parsedTokenPayload.accessToken.trim()
        : '';
      const normalizedServerKey = typeof parsedTokenPayload.serverKey === 'string'
        ? parsedTokenPayload.serverKey.trim()
        : serverKey;
      const rawUserId = typeof parsedTokenPayload.userId === 'string' || typeof parsedTokenPayload.userId === 'number'
        ? parsedTokenPayload.userId
        : typeof parsedTokenPayload.user_id === 'string' || typeof parsedTokenPayload.user_id === 'number'
          ? parsedTokenPayload.user_id
          : undefined;
      const normalizedUserId = typeof rawUserId === 'string'
        ? rawUserId.trim()
        : typeof rawUserId === 'number'
          ? rawUserId.toString()
          : '';

      if (!accessToken) {
        throw new AppError('Failed to retrieve access token', 400, 'TOKEN_EXCHANGE_FAILED');
      }

      res.json({
        success: true,
        data: {
          accessToken,
          serverKey: normalizedServerKey,
          ...(normalizedUserId ? { userId: normalizedUserId } : {}),
        },
      });
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      if (err instanceof Error) {
        return next(new AppError(err.message, 400, 'TOKEN_EXCHANGE_FAILED'));
      }
      return next(new AppError('Failed to exchange access token', 400, 'TOKEN_EXCHANGE_FAILED'));
    }
  },
);

// Exchange Chrxstians username/password for access token
connectionRouter.post(
  '/chrxstians/access-token',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const usernameEmail = typeof req.body?.usernameEmail === 'string'
        ? req.body.usernameEmail.trim()
        : typeof req.body?.username === 'string'
          ? req.body.username.trim()
          : typeof req.body?.email === 'string'
            ? req.body.email.trim()
            : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const providedApiKey = typeof req.body?.apiKey === 'string'
        ? req.body.apiKey.trim()
        : typeof req.body?.api_key === 'string'
          ? req.body.api_key.trim()
          : '';
      const providedApiSecret = typeof req.body?.apiSecret === 'string'
        ? req.body.apiSecret.trim()
        : typeof req.body?.api_secret === 'string'
          ? req.body.api_secret.trim()
          : typeof req.body?.serverKey === 'string'
            ? req.body.serverKey.trim()
            : '';
      const apiKey = providedApiKey || (process.env.CHRXSTIANS_API_KEY || '').trim();
      const apiSecret = providedApiSecret || (process.env.CHRXSTIANS_API_SECRET || '').trim();

      if (!usernameEmail || !password || !apiKey || !apiSecret) {
        throw new AppError(
          'usernameEmail, password, apiKey and apiSecret are required (or configure CHRXSTIANS_API_KEY / CHRXSTIANS_API_SECRET in server env)',
          400,
          'INVALID_INPUT',
        );
      }

      const adapter = getPlatformAdapter('chrxstians');
      const tokens = await adapter.exchangeCode(JSON.stringify({
        usernameEmail,
        password,
        apiKey,
        apiSecret,
      }));

      const parsedTokenPayload = JSON.parse(tokens.accessToken) as {
        accessToken?: string;
        token?: string;
        apiKey?: string;
        apiSecret?: string;
        accountId?: string | number;
        accountName?: string;
      };
      const accessToken = typeof parsedTokenPayload.accessToken === 'string'
        ? parsedTokenPayload.accessToken.trim()
        : typeof parsedTokenPayload.token === 'string'
          ? parsedTokenPayload.token.trim()
          : '';
      const normalizedApiKey = typeof parsedTokenPayload.apiKey === 'string'
        ? parsedTokenPayload.apiKey.trim()
        : apiKey;
      const normalizedApiSecret = typeof parsedTokenPayload.apiSecret === 'string'
        ? parsedTokenPayload.apiSecret.trim()
        : apiSecret;
      const rawAccountId = typeof parsedTokenPayload.accountId === 'string' || typeof parsedTokenPayload.accountId === 'number'
        ? parsedTokenPayload.accountId
        : undefined;
      const accountId = typeof rawAccountId === 'string'
        ? rawAccountId.trim()
        : typeof rawAccountId === 'number'
          ? rawAccountId.toString()
          : '';
      const accountName = typeof parsedTokenPayload.accountName === 'string'
        ? parsedTokenPayload.accountName.trim()
        : '';

      if (!accessToken) {
        throw new AppError('Failed to retrieve access token', 400, 'TOKEN_EXCHANGE_FAILED');
      }

      res.json({
        success: true,
        data: {
          accessToken,
          apiKey: normalizedApiKey,
          apiSecret: normalizedApiSecret,
          ...(accountId ? { accountId } : {}),
          ...(accountName ? { accountName } : {}),
        },
      });
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      if (err instanceof Error) {
        return next(new AppError(err.message, 400, 'TOKEN_EXCHANGE_FAILED'));
      }
      return next(new AppError('Failed to exchange access token', 400, 'TOKEN_EXCHANGE_FAILED'));
    }
  },
);

// Exchange Iohah username/password for access token (Sngine signed API)
connectionRouter.post(
  '/iohah/access-token',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const usernameEmail = typeof req.body?.usernameEmail === 'string'
        ? req.body.usernameEmail.trim()
        : typeof req.body?.username === 'string'
          ? req.body.username.trim()
          : typeof req.body?.email === 'string'
            ? req.body.email.trim()
            : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const providedApiKey = typeof req.body?.apiKey === 'string'
        ? req.body.apiKey.trim()
        : typeof req.body?.api_key === 'string'
          ? req.body.api_key.trim()
          : '';
      const providedApiSecret = typeof req.body?.apiSecret === 'string'
        ? req.body.apiSecret.trim()
        : typeof req.body?.api_secret === 'string'
          ? req.body.api_secret.trim()
          : typeof req.body?.serverKey === 'string'
            ? req.body.serverKey.trim()
            : '';
      const apiKey = providedApiKey || (process.env.IOHAH_API_KEY || '').trim();
      const apiSecret = providedApiSecret || (process.env.IOHAH_API_SECRET || '').trim();

      if (!usernameEmail || !password || !apiKey || !apiSecret) {
        throw new AppError(
          'usernameEmail, password, apiKey and apiSecret are required (or configure IOHAH_API_KEY / IOHAH_API_SECRET in server env)',
          400,
          'INVALID_INPUT',
        );
      }

      const adapter = getPlatformAdapter('iohah');
      const tokens = await adapter.exchangeCode(JSON.stringify({
        usernameEmail,
        password,
        apiKey,
        apiSecret,
      }));

      const parsedTokenPayload = JSON.parse(tokens.accessToken) as {
        accessToken?: string;
        token?: string;
        apiKey?: string;
        apiSecret?: string;
        accountId?: string | number;
        accountName?: string;
      };
      const accessToken = typeof parsedTokenPayload.accessToken === 'string'
        ? parsedTokenPayload.accessToken.trim()
        : typeof parsedTokenPayload.token === 'string'
          ? parsedTokenPayload.token.trim()
          : '';
      const normalizedApiKey = typeof parsedTokenPayload.apiKey === 'string'
        ? parsedTokenPayload.apiKey.trim()
        : apiKey;
      const normalizedApiSecret = typeof parsedTokenPayload.apiSecret === 'string'
        ? parsedTokenPayload.apiSecret.trim()
        : apiSecret;
      const rawAccountId = typeof parsedTokenPayload.accountId === 'string' || typeof parsedTokenPayload.accountId === 'number'
        ? parsedTokenPayload.accountId
        : undefined;
      const accountId = typeof rawAccountId === 'string'
        ? rawAccountId.trim()
        : typeof rawAccountId === 'number'
          ? rawAccountId.toString()
          : '';
      const accountName = typeof parsedTokenPayload.accountName === 'string'
        ? parsedTokenPayload.accountName.trim()
        : '';

      if (!accessToken) {
        throw new AppError('Failed to retrieve access token', 400, 'TOKEN_EXCHANGE_FAILED');
      }

      res.json({
        success: true,
        data: {
          accessToken,
          apiKey: normalizedApiKey,
          apiSecret: normalizedApiSecret,
          ...(accountId ? { accountId } : {}),
          ...(accountName ? { accountName } : {}),
        },
      });
    } catch (err) {
      if (err instanceof AppError) {
        return next(err);
      }
      if (err instanceof Error) {
        return next(new AppError(err.message, 400, 'TOKEN_EXCHANGE_FAILED'));
      }
      return next(new AppError('Failed to exchange access token', 400, 'TOKEN_EXCHANGE_FAILED'));
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

      const mode = req.body?.mode as string | undefined;
      const authUrl = await connectionService.initiateConnection(req.workspaceId, platform, mode);
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
      const rawScopes = (() => {
        if (typeof req.query.scopes === 'string') return req.query.scopes;
        if (Array.isArray(req.query.scopes)) return req.query.scopes.join(' ');
        if (typeof req.query.scope === 'string') return req.query.scope;
        if (Array.isArray(req.query.scope)) return req.query.scope.join(' ');
        return '';
      })();
      const callbackScopes = rawScopes
        .split(/[,\s]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);

      if (!code || !state) {
        return res.redirect(`${config.frontend.url}/connections?error=missing_params`);
      }

      if (platform === 'tiktok' && callbackScopes.length > 0) {
        const grantedScopes = new Set(callbackScopes);
        if (!grantedScopes.has('video.publish')) {
          const reason = [
            `TikTok granted scopes [${callbackScopes.join(', ')}] but missing required video.publish.`,
            'Enable Content Posting API scope video.publish in TikTok Developer Portal and reconnect.',
          ].join(' ');
          return res.redirect(
            `${config.frontend.url}/connections?error=connection_failed&reason=${encodeURIComponent(reason)}`,
          );
        }
      }

      if (platform === 'pinterest' && callbackScopes.length > 0) {
        const grantedScopes = new Set(callbackScopes);
        const requiredScopes = ['user_accounts:read', 'boards:read', 'boards:write', 'pins:read', 'pins:write'];
        const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
        if (missingScopes.length > 0) {
          const reason = [
            `Pinterest granted scopes [${callbackScopes.join(', ')}] but missing required scopes [${missingScopes.join(', ')}].`,
            'Update Pinterest app scopes and reconnect.',
          ].join(' ');
          return res.redirect(
            `${config.frontend.url}/connections?error=connection_failed&reason=${encodeURIComponent(reason)}`,
          );
        }
      }

      let stateResult: { workspaceId: string; mode?: string };
      try {
        stateResult = connectionService.getWorkspaceIdFromState(platform, state);
      } catch {
        return res.redirect(`${config.frontend.url}/connections?error=invalid_state`);
      }

      await connectionService.completeConnection(stateResult.workspaceId, platform, code, state, stateResult.mode);
      res.redirect(`${config.frontend.url}/connections?connected=${platform}`);
    } catch (err) {
      console.error('[Connection Callback Error]', req.params.platform, err);
      const reason = err instanceof Error && err.message ? err.message : 'Could not complete OAuth connection';
      res.redirect(
        `${config.frontend.url}/connections?error=connection_failed&reason=${encodeURIComponent(reason)}`,
      );
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

      const enrichedCredentials = await enrichSngineManualCredentials(platform, credentials);
      const normalizedCredentials = normalizeManualCredentials(platform, enrichedCredentials);
      const connection = await connectionService.manualConnect(req.workspaceId, platform, normalizedCredentials);
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

// List Facebook Pages for a connection
connectionRouter.get(
  '/:connectionId/facebook-pages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const pages = await connectionService.listFacebookPages(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },
);

// List Entreprenrs pages for a connection
connectionRouter.get(
  '/:connectionId/entreprenrs-pages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const pages = await connectionService.listEntreprenrsPages(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },
);

// List Chrxstians pages for a connection
connectionRouter.get(
  '/:connectionId/chrxstians-pages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const pages = await connectionService.listChrxstiansPages(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },
);

// List Chrxstians groups for a connection
connectionRouter.get(
  '/:connectionId/chrxstians-groups',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const groups = await connectionService.listChrxstiansGroups(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: groups });
    } catch (err) {
      next(err);
    }
  },
);

// List Iohah pages for a connection
connectionRouter.get(
  '/:connectionId/iohah-pages',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const pages = await connectionService.listIohahPages(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  },
);

// List Iohah groups for a connection
connectionRouter.get(
  '/:connectionId/iohah-groups',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, error: { code: 'NO_WORKSPACE', message: 'Workspace required' } });
      }
      const groups = await connectionService.listIohahGroups(req.workspaceId, req.params.connectionId as string);
      res.json({ success: true, data: groups });
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
