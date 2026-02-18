import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getPlatformAdapter } from './platforms/index.js';
import type { PlatformAccount, PlatformTokens } from './platforms/base.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PlatformType } from '@ee-postmind/shared';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

type ConnectionStatePayload = {
  workspaceId: string;
  platform: PlatformType;
  nonce: string;
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
  async initiateConnection(workspaceId: string, platform: PlatformType): Promise<string> {
    const adapter = getPlatformAdapter(platform);
    const statePayload: ConnectionStatePayload = {
      workspaceId,
      platform,
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    const state = jwt.sign(statePayload, config.jwt.secret, { expiresIn: '10m' });
    return adapter.getAuthUrl(state);
  }

  getWorkspaceIdFromState(platform: PlatformType, state: string): string {
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
      return payload.workspaceId;
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
  ) {
    const adapter = getPlatformAdapter(platform);

    let tokens: PlatformTokens;
    let account: PlatformAccount;
    try {
      tokens = await adapter.exchangeCode(code, oauthState ? { state: oauthState } : undefined);
      if (!tokens?.accessToken) {
        throw new AppError('Platform token exchange failed', 400, 'INVALID_PLATFORM_RESPONSE');
      }
      account = await adapter.getAccountInfo(tokens.accessToken);
    } catch (error) {
      throw this.normalizeConnectionError(error);
    }

    if (!account?.id) {
      throw new AppError('Could not verify account', 400, 'INVALID_ACCOUNT_RESPONSE');
    }
    const accountName = account.name?.trim() || account.id;

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;

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
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiresAt,
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: {
        accountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiresAt,
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
      where: { workspaceId },
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
      },
    });

    if (!existingConnection) {
      throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    const adapter = getPlatformAdapter(existingConnection.platform as PlatformType);

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

    await prisma.socialConnection.delete({ where: { id: connectionId } });
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
}

export const connectionService = new ConnectionService();
