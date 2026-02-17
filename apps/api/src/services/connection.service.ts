import { prisma } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getPlatformAdapter } from './platforms/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PlatformType } from '@ee-postmind/shared';
import crypto from 'crypto';

export class ConnectionService {
  // Initiate OAuth flow — returns authorization URL
  async initiateConnection(workspaceId: string, platform: PlatformType): Promise<string> {
    const adapter = getPlatformAdapter(platform);
    const state = crypto.randomBytes(16).toString('hex');

    // Store state for verification (in production, use Redis with TTL)
    // For now, encode workspaceId in state
    const statePayload = Buffer.from(JSON.stringify({ workspaceId, nonce: state })).toString('base64url');

    return adapter.getAuthUrl(statePayload);
  }

  // Complete OAuth callback — exchange code for tokens and save
  async completeConnection(
    workspaceId: string,
    platform: PlatformType,
    code: string,
  ) {
    const adapter = getPlatformAdapter(platform);

    const tokens = await adapter.exchangeCode(code);
    const account = await adapter.getAccountInfo(tokens.accessToken);

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
        accountName: account.name,
        accountId: account.id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry: tokens.expiresAt,
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: {
        accountName: account.name,
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

    const tokens = await adapter.exchangeCode(credentials);
    const account = await adapter.getAccountInfo(tokens.accessToken);

    if (!account.id) {
      throw new AppError('Could not verify credentials', 400, 'INVALID_CREDENTIALS');
    }

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
        accountName: account.name,
        accountId: account.id,
        accessToken: encryptedToken,
        isActive: true,
        lastSyncAt: new Date(),
      },
      update: {
        accountName: account.name,
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
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountId: true,
        isActive: true,
        lastSyncAt: true,
        tokenExpiry: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return connections.map((c: any) => ({
      ...c,
      tokenExpired: c.tokenExpiry ? c.tokenExpiry < new Date() : false,
    }));
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

    let token = decrypt(connection.accessToken);

    // Auto-refresh if expired
    if (connection.tokenExpiry && connection.tokenExpiry < new Date() && connection.refreshToken) {
      const adapter = getPlatformAdapter(connection.platform as PlatformType);
      const decryptedRefresh = decrypt(connection.refreshToken);
      const newTokens = await adapter.refreshAccessToken(decryptedRefresh);

      await prisma.socialConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : connection.refreshToken,
          tokenExpiry: newTokens.expiresAt,
          lastSyncAt: new Date(),
        },
      });

      token = newTokens.accessToken;
    }

    return token;
  }
}

export const connectionService = new ConnectionService();
