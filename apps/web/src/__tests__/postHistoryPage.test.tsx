import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../test/render';
import { PostHistoryPage } from '../pages/PostHistoryPage';

const mockApi = vi.hoisted(() => ({
  posts: {
    list: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

describe('PostHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders post rows with per-platform outcomes', async () => {
    mockApi.posts.list.mockResolvedValue({
      success: true,
      data: {
        posts: [
          {
            id: 'post-1',
            content: 'Launch update',
            status: 'partial',
            createdAt: '2030-01-01T10:00:00.000Z',
            scheduledAt: null,
            publishedAt: null,
            media: [{ id: 'm-1' }],
            platformPosts: [
              { id: 'pp-1', platform: 'facebook', status: 'published', platformPostId: 'fb-1', publishedAt: null, error: null },
              { id: 'pp-2', platform: 'twitter', status: 'failed', platformPostId: null, publishedAt: null, error: 'Rate limit' },
            ],
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      },
    });

    renderWithRouter(<PostHistoryPage />);

    expect(await screen.findByText('Launch update')).toBeTruthy();
    expect(screen.getByText('Published platforms: 1')).toBeTruthy();
    expect(screen.getByText('Failed platforms: 1')).toBeTruthy();
    expect(screen.getByText('Rate limit')).toBeTruthy();
  });

  it('requests filtered results when status filter changes', async () => {
    mockApi.posts.list
      .mockResolvedValueOnce({
        success: true,
        data: { posts: [], total: 0, page: 1, limit: 20, pages: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { posts: [], total: 0, page: 1, limit: 20, pages: 1 },
      });

    renderWithRouter(<PostHistoryPage />);
    await waitFor(() => expect(mockApi.posts.list).toHaveBeenCalledWith({ page: '1', limit: '20' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'published' } });

    await waitFor(() => {
      expect(mockApi.posts.list).toHaveBeenLastCalledWith({
        status: 'published',
        page: '1',
        limit: '20',
      });
    });
  });

  it('loads next page when pagination advances', async () => {
    mockApi.posts.list
      .mockResolvedValueOnce({
        success: true,
        data: {
          posts: [{
            id: 'post-page-1',
            content: 'Page one content',
            status: 'draft',
            createdAt: '2030-01-01T10:00:00.000Z',
            scheduledAt: null,
            publishedAt: null,
            media: [],
            platformPosts: [],
          }],
          total: 30,
          page: 1,
          limit: 20,
          pages: 2,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          posts: [{
            id: 'post-page-2',
            content: 'Page two content',
            status: 'draft',
            createdAt: '2030-01-01T10:00:00.000Z',
            scheduledAt: null,
            publishedAt: null,
            media: [],
            platformPosts: [],
          }],
          total: 30,
          page: 2,
          limit: 20,
          pages: 2,
        },
      });

    renderWithRouter(<PostHistoryPage />);
    expect(await screen.findByText('Page one content')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    await waitFor(() => expect(mockApi.posts.list).toHaveBeenLastCalledWith({ page: '2', limit: '20' }));
    expect(await screen.findByText('Page two content')).toBeTruthy();
  });
});
