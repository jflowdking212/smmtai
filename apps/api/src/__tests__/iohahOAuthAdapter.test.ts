import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IohahAdapter } from '../services/platforms/custom.js';

describe('IohahAdapter auth flow', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const adapter = new IohahAdapter();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses manual setup URL instead of OAuth authorize endpoint', () => {
    expect(adapter.getAuthUrl('ignored-state')).toBe('/connections/iohah/setup');
  });

  it('verifies credentials during exchange and stores normalized payload', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'acct_1',
          name: 'Iohah Account',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.exchangeCode(
      JSON.stringify({
        accessToken: ' bearer-token ',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://iohah.com/api/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer bearer-token' },
      }),
    );
    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'bearer-token',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('surfaces iohah credential verification errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Invalid token',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      adapter.exchangeCode(
        JSON.stringify({
          accessToken: 'bad-token',
        }),
      ),
    ).rejects.toThrow('Invalid token');
  });

  it('revalidates refresh payload and returns normalized credentials', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 101,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await adapter.refreshAccessToken(
      JSON.stringify({
        token: ' bearer-token ',
      }),
    );

    expect(JSON.parse(tokens.accessToken)).toEqual({
      accessToken: 'bearer-token',
    });
    expect(tokens.refreshToken).toBe(tokens.accessToken);
  });

  it('rejects malformed credential payloads before API calls', async () => {
    await expect(adapter.exchangeCode('bearer-token')).rejects.toThrow(
      'Provide iohah credentials as JSON: {"accessToken":"token"}',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
