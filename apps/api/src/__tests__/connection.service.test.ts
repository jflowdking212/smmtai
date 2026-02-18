import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockAdapter, getPlatformAdapterMock, encryptMock, decryptMock } = vi.hoisted(() => ({
  mockPrisma: {
    socialConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockAdapter: {
    refreshAccessToken: vi.fn(),
  },
  getPlatformAdapterMock: vi.fn(),
  encryptMock: vi.fn((value: string) => `enc:${value}`),
  decryptMock: vi.fn((value: string) => value.replace(/^enc:/, '')),
}));

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/platforms/index.js', () => ({
  getPlatformAdapter: getPlatformAdapterMock,
}));

vi.mock('../utils/encryption.js', () => ({
  encrypt: encryptMock,
  decrypt: decryptMock,
}));

import { connectionService } from '../services/connection.service.js';

describe('ConnectionService getAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlatformAdapterMock.mockReturnValue(mockAdapter);
  });

  it('refreshes expired access tokens and persists new credentials', async () => {
    mockPrisma.socialConnection.findUnique.mockResolvedValue({
      id: 'connection_1',
      platform: 'twitter',
      accessToken: 'enc:stale-access-token',
      refreshToken: 'enc:refresh-token',
      tokenExpiry: new Date(Date.now() - 60_000),
    });
    mockAdapter.refreshAccessToken.mockResolvedValue({
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const token = await connectionService.getAccessToken('connection_1');

    expect(token).toBe('fresh-access-token');
    expect(mockAdapter.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
    expect(mockPrisma.socialConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'connection_1' },
        data: expect.objectContaining({
          accessToken: 'enc:fresh-access-token',
          refreshToken: 'enc:fresh-refresh-token',
          isActive: true,
          lastSyncAt: expect.any(Date),
        }),
      }),
    );
  });

  it('marks connection inactive when token is expired and no refresh token exists', async () => {
    mockPrisma.socialConnection.findUnique.mockResolvedValue({
      id: 'connection_2',
      platform: 'twitter',
      accessToken: 'enc:expired-access-token',
      refreshToken: null,
      tokenExpiry: new Date(Date.now() - 60_000),
    });
    mockPrisma.socialConnection.update.mockResolvedValue(undefined);

    await expect(connectionService.getAccessToken('connection_2')).rejects.toMatchObject({
      code: 'CONNECTION_TOKEN_EXPIRED',
    });
    expect(mockPrisma.socialConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection_2' },
      data: { isActive: false },
    });
    expect(mockAdapter.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('marks connection inactive when token refresh fails', async () => {
    mockPrisma.socialConnection.findUnique.mockResolvedValue({
      id: 'connection_3',
      platform: 'twitter',
      accessToken: 'enc:expired-access-token',
      refreshToken: 'enc:refresh-token',
      tokenExpiry: new Date(Date.now() - 60_000),
    });
    mockPrisma.socialConnection.update.mockResolvedValue(undefined);
    mockAdapter.refreshAccessToken.mockRejectedValue(new Error('refresh failed'));

    await expect(connectionService.getAccessToken('connection_3')).rejects.toMatchObject({
      code: 'CONNECTION_REFRESH_FAILED',
    });
    expect(mockPrisma.socialConnection.update).toHaveBeenCalledWith({
      where: { id: 'connection_3' },
      data: { isActive: false },
    });
  });
});
