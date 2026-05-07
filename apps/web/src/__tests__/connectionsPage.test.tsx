import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../test/render';
import { ConnectionsPage } from '../pages/ConnectionsPage';

const mockApi = vi.hoisted(() => ({
  billing: {
    status: vi.fn(),
    getLimits: vi.fn(),
  },
  connections: {
    list: vi.fn(),
    getGlobalPlatforms: vi.fn(),
    initiateOAuth: vi.fn(),
    manualConnect: vi.fn(),
    getEntreprenrsAccessToken: vi.fn(),
    getChrxstiansAccessToken: vi.fn(),
    getIohahAccessToken: vi.fn(),
    healthCheck: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi, ApiError: class ApiError extends Error {} }));

describe('ConnectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.billing.status.mockResolvedValue({ success: true, data: { tier: 'basic' } });
    mockApi.billing.getLimits.mockResolvedValue({
      success: true,
      data: {
        socialAccounts: 10,
        postsPerMonth: 100,
        aiGenerationsPerMonth: 100,
        templatesPerMonth: 100,
        teamMembers: 5,
        analyticsDays: 30,
      },
    });
    mockApi.connections.getGlobalPlatforms.mockResolvedValue({ success: true, data: [] });
  });

  it('shows reconnect action for unhealthy connections and opens manual reconnect flow', async () => {
    mockApi.connections.list.mockResolvedValue({
      success: true,
      data: [{
        id: 'conn-1',
        platform: 'iohah',
        accountName: 'Iohah Org',
        accountId: 'acct-1',
        isActive: false,
        tokenExpired: false,
        lastSyncAt: null,
      }],
    });

    renderWithRouter(<ConnectionsPage />);

    const reconnectButton = await screen.findByRole('button', { name: /Reconnect/i });
    expect(screen.queryByRole('button', { name: /Check/i })).toBeNull();

    fireEvent.click(reconnectButton);

    expect(await screen.findByText('Connect Iohah')).toBeTruthy();
  });

  it('shows health check action for healthy connections', async () => {
    mockApi.connections.list.mockResolvedValue({
      success: true,
      data: [{
        id: 'conn-2',
        platform: 'facebook',
        accountName: 'Acme FB',
        accountId: 'acct-2',
        isActive: true,
        tokenExpired: false,
        lastSyncAt: null,
      }],
    });

    renderWithRouter(<ConnectionsPage />);

    expect(await screen.findByRole('button', { name: /Check/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reconnect/i })).toBeNull();
  });
});
