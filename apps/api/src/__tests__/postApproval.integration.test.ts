import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, connectionServiceMock, getPlatformAdapterMock } = vi.hoisted(() => ({
  mockPrisma: {
    post: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    platformPost: {
      update: vi.fn(),
    },
  },
  connectionServiceMock: {
    getAccessToken: vi.fn(),
  },
  getPlatformAdapterMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../services/connection.service.js', () => ({
  connectionService: connectionServiceMock,
}));

vi.mock('../services/platforms/index.js', () => ({
  getPlatformAdapter: getPlatformAdapterMock,
}));

import { postService } from '../services/post.service.js';

describe('PostService approval workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits a draft post for approval', async () => {
    mockPrisma.post.findFirst.mockResolvedValue({
      id: 'post_1',
      workspaceId: 'workspace_test',
      authorId: 'user_test',
      status: 'draft',
    });
    mockPrisma.post.update.mockResolvedValue({ id: 'post_1', status: 'pending_approval' });

    const post = await postService.submitForApproval('post_1', 'workspace_test', 'user_test');

    expect(post.status).toBe('pending_approval');
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: expect.objectContaining({
          status: 'pending_approval',
        }),
      }),
    );
  });

  it('approves a pending approval post', async () => {
    mockPrisma.post.findFirst.mockResolvedValue({
      id: 'post_1',
      workspaceId: 'workspace_test',
      status: 'pending_approval',
    });
    mockPrisma.post.update.mockResolvedValue({ id: 'post_1', status: 'approved' });

    const post = await postService.approvePost('post_1', 'workspace_test');

    expect(post.status).toBe('approved');
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: { status: 'approved' },
      }),
    );
  });

  it('rejects a pending approval post', async () => {
    mockPrisma.post.findFirst.mockResolvedValue({
      id: 'post_1',
      workspaceId: 'workspace_test',
      status: 'pending_approval',
    });
    mockPrisma.post.update.mockResolvedValue({ id: 'post_1', status: 'rejected' });

    const post = await postService.rejectPost('post_1', 'workspace_test');

    expect(post.status).toBe('rejected');
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post_1' },
        data: expect.objectContaining({
          status: 'rejected',
          scheduledAt: null,
        }),
      }),
    );
  });

  it('blocks publishing while post is pending approval', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'post_1',
      status: 'pending_approval',
      platformPosts: [],
      media: [],
    });

    await expect(postService.publishPost('post_1')).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    expect(mockPrisma.post.update).not.toHaveBeenCalled();
  });
});
