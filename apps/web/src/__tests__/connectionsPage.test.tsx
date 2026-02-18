import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../test/render';
import { ConnectionsPage } from '../pages/ConnectionsPage';

const mockApi = vi.hoisted(() => ({
  connections: {
    list: vi.fn(),
    initiateOAuth: vi.fn(),
    manualConnect: vi.fn(),
    healthCheck: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi, ApiError: class ApiError extends Error {} }));

describe('ConnectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
