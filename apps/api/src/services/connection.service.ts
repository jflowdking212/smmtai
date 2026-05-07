import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getPlatformAdapter } from './platforms/index.js';
import type { PlatformAccount, PlatformTokens } from './platforms/base.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PlatformType } from '@ee-postmind/shared';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

type ConnectionStatePayload = {
  workspaceId: string;
  platform: PlatformType;
  nonce: string;
  mode?: string;
};

type ConnectionSummary = {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  isActive: boolean;
  lastSyncAt: Date | null;
  tokenExpiry: Date | null;
};

type ConnectionMonitorFailure = {
  connectionId: string;
  workspaceId: string;
  code: string;
  message: string;
};

const ENTREPRENRS_API_BASE = 'https://entreprenrs.com';

type EntreprenrsPage = {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
};

type IohahResourceKind = 'page' | 'group';

type IohahResource = {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  url?: string | null;
};

type IohahConnectionCredentials = {
  accessToken: string;
  apiKey: string;
  apiSecret: string;
  apiPath: string;
  apiStack: string;
};

type IohahLookupRequest = {
  path: string;
  query?: Record<string, string>;
};

const IOHAH_RESOURCE_LOOKUP_VALUES: Record<IohahResourceKind, string[]> = {
  page: ['pages', 'my_pages', 'managed_pages', 'liked_pages', 'new_pages', 'user_pages'],
  group: ['groups', 'my_groups', 'managed_groups', 'joined_groups', 'new_groups', 'user_groups'],
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return '';
}

function normalizeApiStatus(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildIohahApiBase(apiPath: string, apiStack: string): string {
  const trimmedBase = (process.env.IOHAH_BASE_URL || 'https://iohah.com').trim().replace(/\/+$/g, '');
  const normalizedApiPath = (apiPath || 'apis').replace(/^\/+|\/+$/g, '') || 'apis';
  const normalizedApiStack = (apiStack || 'php').replace(/^\/+|\/+$/g, '') || 'php';
  return `${trimmedBase}/${normalizedApiPath}/${normalizedApiStack}`;
}

function buildChrxstiansApiBase(apiPath: string, apiStack: string): string {
  const trimmedBase = (process.env.CHRXSTIANS_BASE_URL || 'https://chrxstians.com').trim().replace(/\/+$/g, '');
  const normalizedApiPath = (apiPath || 'apis').replace(/^\/+|\/+$/g, '') || 'apis';
  const normalizedApiStack = (apiStack || 'php').replace(/^\/+|\/+$/g, '') || 'php';
  return `${trimmedBase}/${normalizedApiPath}/${normalizedApiStack}`;
}

function buildIohahSignedHeaders(credentials: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
}): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', credentials.apiSecret).update(timestamp).digest('hex');
  return {
    'x-api-key': credentials.apiKey,
    'x-timestamp': timestamp,
    'x-signature': signature,
    'x-auth-token': credentials.accessToken,
    'Content-Type': 'application/json',
  };
}

function buildChrxstiansSignedHeaders(credentials: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
}): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', credentials.apiSecret).update(timestamp).digest('hex');
  return {
    'x-api-key': credentials.apiKey,
    'x-timestamp': timestamp,
    'x-signature': signature,
    'x-auth-token': credentials.accessToken,
    'Content-Type': 'application/json',
  };
}

function isApiTypeNotFoundError(errorText: string): boolean {
  return /api\s*type\s*not\s*found/i.test(errorText);
}

function isCredentialError(errorText: string): boolean {
  return /(invalid|missing).*(access|token|server|key|user|session)|unauthori[sz]ed|not logged in|user not found/i.test(errorText);
}

function isTwitterProjectBindingError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('failed to fetch x account profile')
    && normalized.includes('http 403')
    && normalized.includes('attached to a project');
}

function extractApiErrorText(payload: Record<string, unknown>): string {
  const errors = isJsonRecord(payload.errors) ? payload.errors : null;
  const candidates = [
    normalizeString(errors?.error_text),
    normalizeString(errors?.error),
    normalizeString(payload.error),
    normalizeString(payload.api_text),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.toLowerCase() === 'success') continue;
    return candidate;
  }

  return '';
}

function isIohahLookupRetryableError(statusCode: number, errorText: string): boolean {
  if (statusCode === 404) return true;
  if (isApiTypeNotFoundError(errorText)) return true;
  return /(404\s*not\s*found|invalid parameters?)/i.test(errorText);
}

function readNestedRecordValue(source: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isJsonRecord(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function parseIohahResources(value: unknown, kind: IohahResourceKind): IohahResource[] {
  const rows = Array.isArray(value)
    ? value.map((row) => ({ row, fallbackId: '' }))
    : isJsonRecord(value)
      ? Object.entries(value).map(([key, row]) => ({ row, fallbackId: key }))
      : [];
  const resources: IohahResource[] = [];
  const seenIds = new Set<string>();

  const idCandidates = kind === 'page'
    ? ['page_id', 'id', 'pageId']
    : ['group_id', 'id', 'groupId'];
  const nameCandidates = kind === 'page'
    ? ['page_name', 'page_title', 'name', 'title']
    : ['group_name', 'group_title', 'name', 'title'];
  const descriptionCandidates = kind === 'page'
    ? ['description', 'about', 'page_description', 'page_about']
    : ['description', 'about', 'group_description', 'group_about'];
  const avatarCandidates = kind === 'page'
    ? ['avatar', 'profile_picture', 'page_avatar', 'page_picture', 'picture', 'image']
    : ['avatar', 'profile_picture', 'group_avatar', 'group_picture', 'picture', 'image'];

  for (const entry of rows) {
    const row = entry.row;
    if (!isJsonRecord(row)) continue;

    const id = idCandidates.reduce((acc, key) => acc || normalizeString(row[key]), '')
      || normalizeString(entry.fallbackId);
    if (!id || seenIds.has(id)) continue;

    const name = nameCandidates.reduce((acc, key) => acc || normalizeString(row[key]), '')
      || `${kind === 'page' ? 'Page' : 'Group'} ${id}`;
    const description = descriptionCandidates.reduce((acc, key) => acc || normalizeString(row[key]), '');
    const avatar = avatarCandidates.reduce((acc, key) => acc || normalizeString(row[key]), '');
    const url = normalizeString(row.url)
      || normalizeString(row.link)
      || normalizeString(row.permalink);

    resources.push({
      id,
      name,
      ...(description ? { description } : {}),
      ...(avatar ? { avatar } : {}),
      ...(url ? { url } : {}),
    });
    seenIds.add(id);
  }

  return resources;
}

function collectIohahResources(payload: Record<string, unknown>, kind: IohahResourceKind): IohahResource[] {
  const plural = kind === 'page' ? 'pages' : 'groups';
  const singular = kind === 'page' ? 'page' : 'group';
  const sources: unknown[] = [
    payload[plural],
    payload[`my_${plural}`],
    payload[`managed_${plural}`],
    payload[`liked_${plural}`],
    payload[`joined_${plural}`],
    payload[`${singular}_data`],
    payload[`${plural}_data`],
    payload.data,
    payload.result,
    readNestedRecordValue(payload, ['data', plural]),
    readNestedRecordValue(payload, ['data', `${singular}_data`]),
    readNestedRecordValue(payload, ['data', `${plural}_data`]),
    readNestedRecordValue(payload, ['data', 'items']),
    readNestedRecordValue(payload, ['user_data', plural]),
    readNestedRecordValue(payload, ['user_data', `my_${plural}`]),
    readNestedRecordValue(payload, ['user_data', `managed_${plural}`]),
    readNestedRecordValue(payload, ['result', plural]),
  ];

  const resourcesById = new Map<string, IohahResource>();
  sources.forEach((source) => {
    const parsed = parseIohahResources(source, kind);
    parsed.forEach((resource) => {
      if (!resourcesById.has(resource.id)) {
        resourcesById.set(resource.id, resource);
      }
    });
  });

  return Array.from(resourcesById.values());
}

function parseEntreprenrsPages(value: unknown): EntreprenrsPage[] {
  const rows = Array.isArray(value)
    ? value.map((row) => ({ row, fallbackId: '' }))
    : isJsonRecord(value)
      ? Object.entries(value).map(([key, row]) => ({ row, fallbackId: key }))
      : [];
  const pages: EntreprenrsPage[] = [];
  const seenIds = new Set<string>();

  for (const entry of rows) {
    const row = entry.row;
    if (!isJsonRecord(row)) continue;
    const id = normalizeString(row.page_id)
      || normalizeString(row.id)
      || normalizeString(row.pageId)
      || normalizeString(entry.fallbackId);
    if (!id || seenIds.has(id)) continue;

    const name = normalizeString(row.page_name)
      || normalizeString(row.page_title)
      || normalizeString(row.name)
      || normalizeString(row.page_name_v)
      || `Page ${id}`;

    const description = normalizeString(row.about) || normalizeString(row.description) || '';
    const avatar = normalizeString(row.avatar)
      || normalizeString(row.profile_picture)
      || normalizeString(row.avatar_org)
      || normalizeString(row.page_avatar)
      || '';

    pages.push({
      id,
      name,
      ...(description ? { description } : {}),
      ...(avatar ? { avatar } : {}),
    });
    seenIds.add(id);
  }

  return pages;
}

function collectEntreprenrsPages(payload: Record<string, unknown>): EntreprenrsPage[] {
  const sources: unknown[] = [
    payload.pages,
    payload.liked_pages,
    payload.my_pages,
    payload.managed_pages,
    payload.page_data,
    readNestedRecordValue(payload, ['data', 'pages']),
    readNestedRecordValue(payload, ['data', 'liked_pages']),
    readNestedRecordValue(payload, ['user_data', 'pages']),
    readNestedRecordValue(payload, ['user_data', 'liked_pages']),
    readNestedRecordValue(payload, ['user_data', 'my_pages']),
    readNestedRecordValue(payload, ['user_data', 'managed_pages']),
  ];

  const pagesById = new Map<string, EntreprenrsPage>();
  sources.forEach((source) => {
    const parsed = parseEntreprenrsPages(source);
    parsed.forEach((page) => {
      if (!pagesById.has(page.id)) {
        pagesById.set(page.id, page);
      }
    });
  });

  return Array.from(pagesById.values());
}

const connectionSummarySelect = {
  id: true,
  platform: true,
  accountName: true,
  accountId: true,
  isActive: true,
  lastSyncAt: true,
  tokenExpiry: true,
} as const;

export class ConnectionService {
  private toConnectionResponse(connection: ConnectionSummary) {
    return {
      ...connection,
      tokenExpired: connection.tokenExpiry ? connection.tokenExpiry < new Date() : false,
    };
  }

  private normalizeConnectionError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    const message = error instanceof Error && error.message ? error.message : 'Could not connect account';
    return new AppError(message, 400, 'CONNECTION_FAILED');
  }

  private async markConnectionInactive(connectionId: string) {
    await prisma.socialConnection.update({
      where: { id: connectionId },
      data: { isActive: false },
    });
  }

  // Initiate OAuth flow — returns authorization URL
  async initiateConnection(workspaceId: string, platform: PlatformType, mode?: string): Promise<string> {
    const adapter = getPlatformAdapter(platform, mode);
    const statePayload: ConnectionStatePayload = {
      workspaceId,
      platform,
      nonce: crypto.randomBytes(16).toString('hex'),
      mode,
    };
    const state = jwt.sign(statePayload, config.jwt.secret, { expiresIn: '10m' });
    return adapter.getAuthUrl(state);
  }

  getWorkspaceIdFromState(platform: PlatformType, state: string): { workspaceId: string; mode?: string } {
    try {
      const decoded = jwt.verify(state, config.jwt.secret);
      if (!decoded || typeof decoded !== 'object') {
        throw new AppError('Invalid connection state', 400, 'INVALID_CONNECTION_STATE');
      }
      const payload = decoded as Partial<ConnectionStatePayload>;
      if (
        payload.platform !== platform
        || typeof payload.workspaceId !== 'string'
        || payload.workspaceId.length === 0
      ) {
        throw new AppError('Invalid connection state', 400, 'INVALID_CONNECTION_STATE');
      }
      return { workspaceId: payload.workspaceId, mode: payload.mode };
    } catch {
      throw new AppError('Invalid or expired connection state', 400, 'INVALID_CONNECTION_STATE');
    }
  }

  // Complete OAuth callback — exchange code for tokens and save
  async completeConnection(
    workspaceId: string,
    platform: PlatformType,
    code: string,
    oauthState?: string,
    mode?: string,
  ) {
    const adapter = getPlatformAdapter(platform, mode);

    let tokens: PlatformTokens;
    try {
      tokens = await adapter.exchangeCode(code, oauthState ? { state: oauthState } : undefined);
    } catch (error) {
      throw this.normalizeConnectionError(error);
    }

    if (!tokens?.accessToken) {
      throw new AppError('Platform token exchange failed', 400, 'INVALID_PLATFORM_RESPONSE');
    }

    let account: PlatformAccount | undefined;
    let accountLookupError: AppError | null = null;
    try {
      account = await adapter.getAccountInfo(tokens.accessToken);
    } catch (error) {
      accountLookupError = this.normalizeConnectionError(error);
    }

    // Fallback for Instagram-via-Facebook: if me/accounts returned empty,
    // try using existing Facebook connection's token to find IG business account
    if (!account?.id && platform === 'instagram' && mode === 'facebook') {
      console.log('[Instagram FB Fallback] Trying existing Facebook connection tokens...');
      const fbConnections = await prisma.socialConnection.findMany({
        where: { workspaceId, platform: 'facebook', isActive: true },
      });
      for (const fbConn of fbConnections) {
        try {
          const fbToken = decrypt(fbConn.accessToken);
          account = await adapter.getAccountInfo(fbToken);
          if (account?.id) {
            console.log('[Instagram FB Fallback] Found IG account via Facebook connection:', account.name);
            tokens = { accessToken: fbToken, expiresAt: fbConn.tokenExpiry ?? undefined };
            break;
          }
        } catch (err) {
          console.error('[Instagram FB Fallback] Failed with FB connection:', fbConn.accountName, err);
        }
      }
    }

    const allowTwitterProfileFallback = platform === 'twitter'
      && !!accountLookupError
      && isTwitterProjectBindingError(accountLookupError.message);
    const twitterFallbackAccountId = `twitter_unverified_${workspaceId}`;

    if (!account?.id && !allowTwitterProfileFallback && accountLookupError) {
      throw accountLookupError;
    }

    if (!account?.id && !allowTwitterProfileFallback) {
      throw new AppError('Could not verify account', 400, 'INVALID_ACCOUNT_RESPONSE');
    }

    const resolvedAccountId = account?.id || twitterFallbackAccountId;
    const accountName = account?.name?.trim() || (allowTwitterProfileFallback ? 'X Account (Unverified)' : resolvedAccountId);

    // For Instagram Direct, suffix accountId so it can coexist with Facebook-linked Instagram
    const storedAccountId = (platform === 'instagram' && mode === 'direct')
      ? `${resolvedAccountId}_direct`
      : resolvedAccountId;

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

    const connectionMetadata: Record<string, unknown> = mode ? { mode } : {};
    if (allowTwitterProfileFallback && accountLookupError) {
      connectionMetadata.profileUnverified = true;
      connectionMetadata.profileError = accountLookupError.message;
    }
    const metadataJson = Object.keys(connectionMetadata).length > 0
      ? connectionMetadata as Prisma.InputJsonValue
      : undefined;

    const connection = await prisma.socialConnection.upsert({
      where: {
        workspaceId_platform_accountId: {
          workspaceId,
          platform,
          accountId: storedAccountId,
        },
      },
      create: {
        workspaceId,
        platform,
        accountName,
        accountId: storedAccountId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiresAt,
        isActive: true,
        lastSyncAt: new Date(),
        metadata: metadataJson,
      },
      update: {
        accountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiresAt,
        isActive: true,
        lastSyncAt: new Date(),
        metadata: metadataJson,
      },
    });

    return {
      id: connection.id,
      platform: connection.platform,
      accountName: connection.accountName,
      accountId: connection.accountId,
      isActive: connection.isActive,
    };
  }

  // Manual connection for platforms without OAuth (Bluesky, Telegram, WoWonder, Sngine)
  async manualConnect(
    workspaceId: string,
    platform: PlatformType,
    credentials: string,
  ) {
    const adapter = getPlatformAdapter(platform);
    let tokens: PlatformTokens;
    let account: PlatformAccount;
    try {
      tokens = await adapter.exchangeCode(credentials);
      if (!tokens?.accessToken) {
        throw new AppError('Platform credential verification failed', 400, 'INVALID_PLATFORM_RESPONSE');
      }
      account = await adapter.getAccountInfo(tokens.accessToken);
    } catch (error) {
      throw this.normalizeConnectionError(error);
    }

    if (!account.id) {
      throw new AppError('Could not verify credentials', 400, 'INVALID_CREDENTIALS');
    }
    const accountName = account.name?.trim() || account.id;

    const encryptedToken = encrypt(tokens.accessToken);

    const connection = await prisma.socialConnection.upsert({
      where: {
        workspaceId_platform_accountId: {
          workspaceId,
          platform,
          accountId: account.id,
        },
      },
      create: {
        workspaceId,
        platform,
        accountName,
        accountId: account.id,
        accessToken: encryptedToken,
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: {
        accountName,
        accessToken: encryptedToken,
        isActive: true,
        lastSyncAt: new Date(),
      },
    });

    return {
      id: connection.id,
      platform: connection.platform,
      accountName: connection.accountName,
      accountId: connection.accountId,
      isActive: connection.isActive,
    };
  }

  // List all connections for a workspace
  async listConnections(workspaceId: string) {
    const connections = await prisma.socialConnection.findMany({
      where: { workspaceId, isActive: true },
      select: connectionSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return connections.map((connection) => this.toConnectionResponse(connection));
  }

  async monitorConnectionHealth(workspaceId?: string) {
    const connections = await prisma.socialConnection.findMany({
      where: {
        isActive: true,
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: {
        id: true,
        workspaceId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let healthy = 0;
    let unhealthy = 0;
    const failures: ConnectionMonitorFailure[] = [];

    for (const connection of connections) {
      const health = await this.checkConnectionHealth(connection.workspaceId, connection.id);
      if (health.healthy) {
        healthy += 1;
        continue;
      }

      unhealthy += 1;
      if (health.error) {
        failures.push({
          connectionId: connection.id,
          workspaceId: connection.workspaceId,
          code: health.error.code,
          message: health.error.message,
        });
      }
    }

    return {
      total: connections.length,
      healthy,
      unhealthy,
      failures,
    };
  }

  async checkConnectionHealth(workspaceId: string, connectionId: string) {
    const existingConnection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId },
      select: {
        id: true,
        platform: true,
        accountName: true,
        metadata: true,
      },
    });

    if (!existingConnection) {
      throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    const mode = (existingConnection.metadata as any)?.mode as string | undefined;
    const adapter = getPlatformAdapter(existingConnection.platform as PlatformType, mode);

    try {
      const accessToken = await this.getAccessToken(existingConnection.id);
      const account = await adapter.getAccountInfo(accessToken);
      if (!account?.id) {
        throw new AppError('Could not verify account health', 400, 'INVALID_ACCOUNT_RESPONSE');
      }

      const accountName = account.name?.trim() || existingConnection.accountName || account.id;
      const updatedConnection = await prisma.socialConnection.update({
        where: { id: existingConnection.id },
        data: {
          accountName,
          isActive: true,
          lastSyncAt: new Date(),
        },
        select: connectionSummarySelect,
      });

      return {
        ...this.toConnectionResponse(updatedConnection),
        healthy: true,
        error: undefined,
      };
    } catch (error) {
      const normalizedError = this.normalizeConnectionError(error);
      const metadata = (existingConnection.metadata as any) || {};
      const allowTwitterProfileFallback = existingConnection.platform === 'twitter'
        && metadata.profileUnverified === true
        && isTwitterProjectBindingError(normalizedError.message);

      if (allowTwitterProfileFallback) {
        const updatedConnection = await prisma.socialConnection.update({
          where: { id: existingConnection.id },
          data: {
            isActive: true,
            lastSyncAt: new Date(),
          },
          select: connectionSummarySelect,
        });

        return {
          ...this.toConnectionResponse(updatedConnection),
          healthy: true,
          error: undefined,
        };
      }

      const updatedConnection = await prisma.socialConnection.update({
        where: { id: existingConnection.id },
        data: {
          isActive: false,
        },
        select: connectionSummarySelect,
      });

      return {
        ...this.toConnectionResponse(updatedConnection),
        healthy: false,
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
        },
      };
    }
  }

  // Disconnect a platform
  async disconnect(workspaceId: string, connectionId: string) {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    // Check for linked platform posts — soft-delete if references exist
    const linkedPosts = await prisma.platformPost.count({ where: { socialConnectionId: connectionId } });
    if (linkedPosts > 0) {
      await prisma.socialConnection.update({
        where: { id: connectionId },
        data: { isActive: false, accessToken: '', refreshToken: null, tokenExpiry: null },
      });
    } else {
      await prisma.socialConnection.delete({ where: { id: connectionId } });
    }
  }

  // List Facebook Pages the user has access to via a connection
  async listFacebookPages(workspaceId: string, connectionId: string) {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId, platform: 'facebook' },
    });
    if (!connection) throw new AppError('Facebook connection not found', 404, 'CONNECTION_NOT_FOUND');

    let token: string;
    try {
      token = decrypt(connection.accessToken);
    } catch {
      throw new AppError('Connection token is invalid', 401, 'CONNECTION_TOKEN_INVALID');
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture&access_token=${token}`);
    const data = await res.json() as any;
    if (!res.ok || !data.data) return [];

    return data.data.map((page: any) => ({
      id: page.id,
      name: page.name,
      picture: page.picture?.data?.url || null,
      accessToken: page.access_token,
    }));
  }

  // List Entreprenrs pages associated with a connection token
  async listEntreprenrsPages(workspaceId: string, connectionId: string): Promise<EntreprenrsPage[]> {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId, platform: 'entreprenrs', isActive: true },
    });
    if (!connection) throw new AppError('Entreprenrs connection not found', 404, 'CONNECTION_NOT_FOUND');

    let decryptedToken: string;
    try {
      decryptedToken = decrypt(connection.accessToken);
    } catch {
      throw new AppError('Connection token is invalid', 401, 'CONNECTION_TOKEN_INVALID');
    }

    let parsedToken: Record<string, unknown> = {};
    try {
      parsedToken = JSON.parse(decryptedToken) as Record<string, unknown>;
    } catch {
      throw new AppError('Stored Entreprenrs token payload is invalid', 400, 'CONNECTION_TOKEN_INVALID');
    }

    const accessToken = normalizeString(parsedToken.accessToken) || normalizeString(parsedToken.token);
    const serverKey = normalizeString(parsedToken.serverKey) || normalizeString(parsedToken.server_key);
    const userId = normalizeString(parsedToken.userId) || normalizeString(parsedToken.user_id);

    if (!accessToken || !serverKey || !userId) {
      throw new AppError('Entreprenrs credentials are incomplete. Reconnect account.', 400, 'CONNECTION_CREDENTIALS_INVALID');
    }

    const baseParams = {
      access_token: accessToken,
      server_key: serverKey,
      user_id: userId,
    };
    const endpointCandidates: Array<{ path: string; fetch: string }> = [
      { path: 'get-community', fetch: 'pages' },
      { path: 'get_community', fetch: 'pages' },
      { path: 'get-user-data', fetch: 'liked_pages' },
      { path: 'get-user-data', fetch: 'user_data' },
    ];

    for (const candidate of endpointCandidates) {
      const params = new URLSearchParams({
        ...baseParams,
        fetch: candidate.fetch,
      });
      const requestUrl = new URL(`${ENTREPRENRS_API_BASE}/api/${candidate.path}`);
      params.forEach((value, key) => requestUrl.searchParams.set(key, value));

      const response = await fetch(requestUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const apiStatus = normalizeApiStatus(data.api_status);
      const statusIndicatesFailure = !response.ok || (apiStatus !== null && apiStatus !== 200);
      const errorText = extractApiErrorText(data) || (statusIndicatesFailure ? normalizeString(data.message) : '');
      const hasError = statusIndicatesFailure || Boolean(errorText);

      if (hasError) {
        if (isApiTypeNotFoundError(errorText) || response.status === 404) {
          continue;
        }
        if (errorText && isCredentialError(errorText)) {
          throw new AppError(errorText, 400, 'PLATFORM_REQUEST_FAILED');
        }
        continue;
      }

      const pages = collectEntreprenrsPages(data);
      if (pages.length > 0) return pages;
    }

    return [];
  }

  private async resolveChrxstiansConnectionCredentials(
    workspaceId: string,
    connectionId: string,
  ): Promise<IohahConnectionCredentials> {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId, platform: 'chrxstians', isActive: true },
    });
    if (!connection) throw new AppError('Chrxstians connection not found', 404, 'CONNECTION_NOT_FOUND');

    let decryptedToken: string;
    try {
      decryptedToken = decrypt(connection.accessToken);
    } catch {
      throw new AppError('Connection token is invalid', 401, 'CONNECTION_TOKEN_INVALID');
    }

    let parsedToken: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(decryptedToken);
      if (!isJsonRecord(parsed)) {
        throw new Error('invalid');
      }
      parsedToken = parsed;
    } catch {
      throw new AppError('Stored Chrxstians token payload is invalid', 400, 'CONNECTION_TOKEN_INVALID');
    }

    const accessToken = normalizeString(parsedToken.accessToken) || normalizeString(parsedToken.token);
    const apiKey = normalizeString(parsedToken.apiKey)
      || normalizeString(parsedToken.api_key)
      || normalizeString(parsedToken.client_id)
      || normalizeString(process.env.CHRXSTIANS_API_KEY);
    const apiSecret = normalizeString(parsedToken.apiSecret)
      || normalizeString(parsedToken.api_secret)
      || normalizeString(parsedToken.serverKey)
      || normalizeString(parsedToken.server_key)
      || normalizeString(parsedToken.client_secret)
      || normalizeString(process.env.CHRXSTIANS_API_SECRET);
    const apiPath = normalizeString(parsedToken.apiPath) || normalizeString(parsedToken.api_path) || 'apis';
    const apiStack = normalizeString(parsedToken.apiStack) || normalizeString(parsedToken.api_stack) || 'php';

    if (!accessToken || !apiKey || !apiSecret) {
      throw new AppError(
        'Chrxstians credentials are incomplete. Reconnect account or configure CHRXSTIANS_API_KEY / CHRXSTIANS_API_SECRET.',
        400,
        'CONNECTION_CREDENTIALS_INVALID',
      );
    }

    return {
      accessToken,
      apiKey,
      apiSecret,
      apiPath,
      apiStack,
    };
  }

  private async resolveIohahConnectionCredentials(
    workspaceId: string,
    connectionId: string,
  ): Promise<IohahConnectionCredentials> {
    const connection = await prisma.socialConnection.findFirst({
      where: { id: connectionId, workspaceId, platform: 'iohah', isActive: true },
    });
    if (!connection) throw new AppError('Iohah connection not found', 404, 'CONNECTION_NOT_FOUND');

    let decryptedToken: string;
    try {
      decryptedToken = decrypt(connection.accessToken);
    } catch {
      throw new AppError('Connection token is invalid', 401, 'CONNECTION_TOKEN_INVALID');
    }

    let parsedToken: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(decryptedToken);
      if (!isJsonRecord(parsed)) {
        throw new Error('invalid');
      }
      parsedToken = parsed;
    } catch {
      throw new AppError('Stored Iohah token payload is invalid', 400, 'CONNECTION_TOKEN_INVALID');
    }

    const accessToken = normalizeString(parsedToken.accessToken) || normalizeString(parsedToken.token);
    const apiKey = normalizeString(parsedToken.apiKey)
      || normalizeString(parsedToken.api_key)
      || normalizeString(parsedToken.client_id)
      || normalizeString(process.env.IOHAH_API_KEY);
    const apiSecret = normalizeString(parsedToken.apiSecret)
      || normalizeString(parsedToken.api_secret)
      || normalizeString(parsedToken.serverKey)
      || normalizeString(parsedToken.server_key)
      || normalizeString(parsedToken.client_secret)
      || normalizeString(process.env.IOHAH_API_SECRET);
    const apiPath = normalizeString(parsedToken.apiPath) || normalizeString(parsedToken.api_path) || 'apis';
    const apiStack = normalizeString(parsedToken.apiStack) || normalizeString(parsedToken.api_stack) || 'php';

    if (!accessToken || !apiKey || !apiSecret) {
      throw new AppError(
        'Iohah credentials are incomplete. Reconnect account or configure IOHAH_API_KEY / IOHAH_API_SECRET.',
        400,
        'CONNECTION_CREDENTIALS_INVALID',
      );
    }

    return {
      accessToken,
      apiKey,
      apiSecret,
      apiPath,
      apiStack,
    };
  }

  private buildChrxstiansLookupRequests(kind: IohahResourceKind): IohahLookupRequest[] {
    return this.buildIohahLookupRequests(kind);
  }

  private buildIohahLookupRequests(kind: IohahResourceKind): IohahLookupRequest[] {
    const plural = kind === 'page' ? 'pages' : 'groups';
    const loadRequests = IOHAH_RESOURCE_LOOKUP_VALUES[kind].map((lookupValue) => ({
      path: '/data/load',
      query: {
        get: lookupValue,
        offset: '0',
        ...(lookupValue.startsWith('new_') ? { random: 'true' } : {}),
      },
    }));

    return [
      ...loadRequests,
      { path: `/data/${plural}`, query: { offset: '0' } },
      { path: `/user/${plural}`, query: { offset: '0' } },
      { path: `/${plural}`, query: { offset: '0' } },
      { path: `/${plural}/manage` },
      { path: `/${kind}/manage` },
      { path: `/user/${plural}/manage` },
      { path: `/data/${plural}/manage` },
    ];
  }

  private async listIohahResources(
    workspaceId: string,
    connectionId: string,
    kind: IohahResourceKind,
  ): Promise<IohahResource[]> {
    const credentials = await this.resolveIohahConnectionCredentials(workspaceId, connectionId);
    const apiBase = buildIohahApiBase(credentials.apiPath, credentials.apiStack);
    const headers = buildIohahSignedHeaders(credentials);
    const requests = this.buildIohahLookupRequests(kind);

    for (const request of requests) {
      const url = new URL(`${apiBase}${request.path}`);
      Object.entries(request.query || {}).forEach(([key, value]) => {
        if (value !== '') url.searchParams.set(key, value);
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const status = normalizeString(data.status).toLowerCase();
      const explicitError = data.error === true || status === 'error';
      const errorText = extractApiErrorText(data) || (explicitError ? normalizeString(data.message) : '');
      const hasError = !response.ok || explicitError || Boolean(errorText);

      if (hasError) {
        if (errorText && isCredentialError(errorText)) {
          throw new AppError(errorText, 400, 'PLATFORM_REQUEST_FAILED');
        }
        if (isIohahLookupRetryableError(response.status, errorText)) {
          continue;
        }
        continue;
      }

      const resources = collectIohahResources(data, kind);
      if (resources.length > 0) return resources;
    }

    return [];
  }

  private async listChrxstiansResources(
    workspaceId: string,
    connectionId: string,
    kind: IohahResourceKind,
  ): Promise<IohahResource[]> {
    const credentials = await this.resolveChrxstiansConnectionCredentials(workspaceId, connectionId);
    const apiBase = buildChrxstiansApiBase(credentials.apiPath, credentials.apiStack);
    const headers = buildChrxstiansSignedHeaders(credentials);
    const requests = this.buildChrxstiansLookupRequests(kind);

    for (const request of requests) {
      const url = new URL(`${apiBase}${request.path}`);
      Object.entries(request.query || {}).forEach(([key, value]) => {
        if (value !== '') url.searchParams.set(key, value);
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const status = normalizeString(data.status).toLowerCase();
      const explicitError = data.error === true || status === 'error';
      const errorText = extractApiErrorText(data) || (explicitError ? normalizeString(data.message) : '');
      const hasError = !response.ok || explicitError || Boolean(errorText);

      if (hasError) {
        if (errorText && isCredentialError(errorText)) {
          throw new AppError(errorText, 400, 'PLATFORM_REQUEST_FAILED');
        }
        if (isIohahLookupRetryableError(response.status, errorText)) {
          continue;
        }
        continue;
      }

      const resources = collectIohahResources(data, kind);
      if (resources.length > 0) return resources;
    }

    return [];
  }

  async listChrxstiansPages(workspaceId: string, connectionId: string): Promise<IohahResource[]> {
    return this.listChrxstiansResources(workspaceId, connectionId, 'page');
  }

  async listChrxstiansGroups(workspaceId: string, connectionId: string): Promise<IohahResource[]> {
    return this.listChrxstiansResources(workspaceId, connectionId, 'group');
  }

  async listIohahPages(workspaceId: string, connectionId: string): Promise<IohahResource[]> {
    return this.listIohahResources(workspaceId, connectionId, 'page');
  }

  async listIohahGroups(workspaceId: string, connectionId: string): Promise<IohahResource[]> {
    return this.listIohahResources(workspaceId, connectionId, 'group');
  }

  // Get decrypted access token for a connection (used by publishing engine)
  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await prisma.socialConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');

    let token: string;
    try {
      token = decrypt(connection.accessToken);
    } catch {
      await this.markConnectionInactive(connectionId);
      throw new AppError('Stored connection token is invalid. Reconnect account.', 401, 'CONNECTION_TOKEN_INVALID');
    }

    // Auto-refresh if expired
    if (connection.tokenExpiry && connection.tokenExpiry < new Date()) {
      if (!connection.refreshToken) {
        await this.markConnectionInactive(connectionId);
        throw new AppError('Connection token expired. Reconnect account.', 401, 'CONNECTION_TOKEN_EXPIRED');
      }

      let decryptedRefresh: string;
      try {
        decryptedRefresh = decrypt(connection.refreshToken);
      } catch {
        await this.markConnectionInactive(connectionId);
        throw new AppError('Stored refresh token is invalid. Reconnect account.', 401, 'CONNECTION_REFRESH_INVALID');
      }

      const adapter = getPlatformAdapter(connection.platform as PlatformType);
      let newTokens: PlatformTokens;
      try {
        newTokens = await adapter.refreshAccessToken(decryptedRefresh);
      } catch {
        await this.markConnectionInactive(connectionId);
        throw new AppError('Connection token refresh failed. Reconnect account.', 401, 'CONNECTION_REFRESH_FAILED');
      }
      if (!newTokens?.accessToken) {
        await this.markConnectionInactive(connectionId);
        throw new AppError('Connection token refresh failed. Reconnect account.', 401, 'CONNECTION_REFRESH_FAILED');
      }

      await prisma.socialConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : connection.refreshToken,
          tokenExpiry: newTokens.expiresAt,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });

      token = newTokens.accessToken;
    }

    return token;
  }

  async getConnectionMeta(connectionId: string): Promise<{
    token: string;
    mode?: string;
    profileUnverified?: boolean;
    profileError?: string;
  }> {
    const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
    const token = await this.getAccessToken(connectionId);
    const meta = connection.metadata as any;
    return {
      token,
      mode: meta?.mode,
      profileUnverified: meta?.profileUnverified === true,
      profileError: typeof meta?.profileError === 'string' ? meta.profileError : undefined,
    };
  }
}

export const connectionService = new ConnectionService();
