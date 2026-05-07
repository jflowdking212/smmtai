import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockAdapter, getPlatformAdapterMock, encryptMock, decryptMock } = vi.hoisted(() => ({
  mockPrisma: {
    socialConnection: {
      findFirst: vi.fn(),
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

describe('ConnectionService listEntreprenrsPages', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns pages from get-community endpoint when available', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'entreprenrs',
      isActive: true,
      accessToken: 'enc:{"accessToken":"access-token","serverKey":"server-key","userId":"42"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          api_status: 200,
          pages: [{ page_id: '11', page_name: 'Alpha Page' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const pages = await connectionService.listEntreprenrsPages('workspace_1', 'connection_1');

    expect(pages).toEqual([{ id: '11', name: 'Alpha Page' }]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://entreprenrs.com/api/get-community');
    expect(requestUrl.searchParams.get('fetch')).toBe('pages');
  });

  it('falls back to get-user-data liked_pages when get-community aliases are missing', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'entreprenrs',
      isActive: true,
      accessToken: 'enc:{"accessToken":"access-token","serverKey":"server-key","userId":"42"}',
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            api_status: 400,
            errors: { error_text: 'Error: 404 API Type Not Found' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            api_status: 400,
            errors: { error_text: 'Error: 404 API Type Not Found' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            api_status: 200,
            liked_pages: [{ id: '22', name: 'Fallback Page' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const pages = await connectionService.listEntreprenrsPages('workspace_1', 'connection_1');

    expect(pages).toEqual([{ id: '22', name: 'Fallback Page' }]);
    const thirdRequestUrl = new URL(fetchMock.mock.calls[2]?.[0] as string);
    expect(`${thirdRequestUrl.origin}${thirdRequestUrl.pathname}`).toBe('https://entreprenrs.com/api/get-user-data');
    expect(thirdRequestUrl.searchParams.get('fetch')).toBe('liked_pages');
  });

  it('surfaces credential errors from Entreprenrs page lookup', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'entreprenrs',
      isActive: true,
      accessToken: 'enc:{"accessToken":"access-token","serverKey":"server-key","userId":"42"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          api_status: 401,
          errors: { error_text: 'Invalid access token' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      connectionService.listEntreprenrsPages('workspace_1', 'connection_1'),
    ).rejects.toMatchObject({
      code: 'PLATFORM_REQUEST_FAILED',
      message: 'Invalid access token',
    });
  });
});

describe('ConnectionService listIohahResources', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns pages from data/load get=pages', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'iohah',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          pages: [{ page_id: '11', page_name: 'Alpha Page' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const pages = await connectionService.listIohahPages('workspace_1', 'connection_1');

    expect(pages).toEqual([{ id: '11', name: 'Alpha Page' }]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://iohah.com/apis/php/data/load');
    expect(requestUrl.searchParams.get('get')).toBe('pages');
  });

  it('falls back to next get value when first lookup returns invalid parameters', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'iohah',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'error',
            message: 'Invalid parameters',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            my_pages: [{ id: '22', name: 'Fallback Page' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const pages = await connectionService.listIohahPages('workspace_1', 'connection_1');

    expect(pages).toEqual([{ id: '22', name: 'Fallback Page' }]);
    const secondRequestUrl = new URL(fetchMock.mock.calls[1]?.[0] as string);
    expect(secondRequestUrl.searchParams.get('get')).toBe('my_pages');
  });

  it('returns groups from data/load get=groups', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_2',
      workspaceId: 'workspace_1',
      platform: 'iohah',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          groups: [{ group_id: '7', group_name: 'Core Group' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const groups = await connectionService.listIohahGroups('workspace_1', 'connection_2');

    expect(groups).toEqual([{ id: '7', name: 'Core Group' }]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('get')).toBe('groups');
  });

  it('surfaces credential errors from Iohah lookup', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_3',
      workspaceId: 'workspace_1',
      platform: 'iohah',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          message: 'You are not logged in',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      connectionService.listIohahPages('workspace_1', 'connection_3'),
    ).rejects.toMatchObject({
      code: 'PLATFORM_REQUEST_FAILED',
      message: 'You are not logged in',
    });
  });
});

describe('ConnectionService listChrxstiansResources', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns pages from data/load get=pages', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      workspaceId: 'workspace_1',
      platform: 'chrxstians',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          pages: [{ page_id: '11', page_name: 'Alpha Page' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const pages = await connectionService.listChrxstiansPages('workspace_1', 'connection_1');

    expect(pages).toEqual([{ id: '11', name: 'Alpha Page' }]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://chrxstians.com/apis/php/data/load');
    expect(requestUrl.searchParams.get('get')).toBe('pages');
  });

  it('returns groups from data/load get=groups', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_2',
      workspaceId: 'workspace_1',
      platform: 'chrxstians',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          groups: [{ group_id: '7', group_name: 'Core Group' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const groups = await connectionService.listChrxstiansGroups('workspace_1', 'connection_2');

    expect(groups).toEqual([{ id: '7', name: 'Core Group' }]);
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.searchParams.get('get')).toBe('groups');
  });

  it('surfaces credential errors from Chrxstians lookup', async () => {
    mockPrisma.socialConnection.findFirst.mockResolvedValue({
      id: 'connection_3',
      workspaceId: 'workspace_1',
      platform: 'chrxstians',
      isActive: true,
      accessToken: 'enc:{"accessToken":"jwt-token","apiKey":"api-key","apiSecret":"api-secret","apiPath":"apis","apiStack":"php"}',
    });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          message: 'You are not logged in',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      connectionService.listChrxstiansPages('workspace_1', 'connection_3'),
    ).rejects.toMatchObject({
      code: 'PLATFORM_REQUEST_FAILED',
      message: 'You are not logged in',
    });
  });
});
