import { expect, test, type Page, type Route } from '@playwright/test';

type ConnectionRecord = {
  id: string;
  platform: string;
  accountName: string;
  accountId: string;
  isActive: boolean;
  tokenExpired: boolean;
  lastSyncAt: string | null;
};

type PostRecord = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  designData: Record<string, unknown>;
  media: Array<{ id: string; url: string; type: 'image' | 'video' }>;
  platformPosts: Array<{ id: string; platform: string; socialConnectionId: string; status: string }>;
};

type ApiState = {
  user: { id: string; name: string; email: string; avatar: string | null; timezone: string; emailVerified: boolean } | null;
  workspaceId: string;
  connections: ConnectionRecord[];
  drafts: PostRecord[];
  posts: PostRecord[];
  nextPostId: number;
};

function createInitialState(): ApiState {
  return {
    user: null,
    workspaceId: 'ws-e2e',
    connections: [],
    drafts: [],
    posts: [],
    nextPostId: 1,
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function handleApiRoute(route: Route, state: ApiState) {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path === '/api/v1/auth/register' && method === 'POST') {
    const payload = JSON.parse(request.postData() || '{}') as { name?: string; email?: string };
    state.user = {
      id: 'user-e2e',
      name: payload.name || 'E2E User',
      email: payload.email || 'e2e@example.com',
      avatar: null,
      timezone: 'UTC',
      emailVerified: true,
    };
    return json(route, {
      success: true,
      data: {
        user: state.user,
        workspaceId: state.workspaceId,
        accessToken: 'token-e2e',
      },
    });
  }

  if (path === '/api/v1/auth/me' && method === 'GET') {
    return json(route, {
      success: true,
      data: {
        user: state.user || {
          id: 'user-e2e',
          name: 'E2E User',
          email: 'e2e@example.com',
          avatar: null,
          timezone: 'UTC',
          emailVerified: true,
        },
        workspaceId: state.workspaceId,
      },
    });
  }

  if (path === '/api/v1/connections' && method === 'GET') {
    return json(route, { success: true, data: state.connections });
  }

  const manualConnectMatch = path.match(/^\/api\/v1\/connections\/([^/]+)\/connect$/);
  if (manualConnectMatch && method === 'POST') {
    const platform = manualConnectMatch[1];
    const existing = state.connections.find((connection) => connection.platform === platform);
    if (!existing) {
      const now = new Date().toISOString();
      state.connections.push({
        id: `conn-${platform}`,
        platform,
        accountName: platform === 'bluesky' ? 'mock.bsky.social' : `${platform}-account`,
        accountId: `acct-${platform}`,
        isActive: true,
        tokenExpired: false,
        lastSyncAt: now,
      });
    }
    return json(route, { success: true, data: state.connections.find((connection) => connection.platform === platform) });
  }

  if (path === '/api/v1/posts' && method === 'GET') {
    const status = url.searchParams.get('status');
    if (status === 'draft') {
      return json(route, {
        success: true,
        data: { posts: state.drafts, total: state.drafts.length, page: 1, limit: 50, pages: 1 },
      });
    }
    if (status === 'pending_approval') {
      return json(route, {
        success: true,
        data: { posts: [], total: 0, page: 1, limit: 20, pages: 1 },
      });
    }
    return json(route, {
      success: true,
      data: { posts: state.posts, total: state.posts.length, page: 1, limit: 20, pages: 1 },
    });
  }

  if (path === '/api/v1/posts' && method === 'POST') {
    const payload = JSON.parse(request.postData() || '{}') as {
      content?: string;
      isDraft?: boolean;
      scheduledAt?: string;
      platforms?: Array<{ connectionId: string; platform: string }>;
    };
    const postId = `post-${state.nextPostId++}`;
    const now = new Date().toISOString();
    const nextPost: PostRecord = {
      id: postId,
      content: payload.content || '',
      status: payload.isDraft ? 'draft' : payload.scheduledAt ? 'scheduled' : 'pending',
      createdAt: now,
      updatedAt: now,
      scheduledAt: payload.scheduledAt || null,
      publishedAt: null,
      designData: {},
      media: [],
      platformPosts: (payload.platforms || []).map((platform, index) => ({
        id: `${postId}-platform-${index + 1}`,
        platform: platform.platform,
        socialConnectionId: platform.connectionId,
        status: payload.isDraft ? 'draft' : payload.scheduledAt ? 'scheduled' : 'pending',
      })),
    };

    if (payload.isDraft) {
      state.drafts = [nextPost, ...state.drafts];
    } else {
      state.posts = [nextPost, ...state.posts];
    }

    return json(route, { success: true, data: { id: postId } }, 201);
  }

  const postMatch = path.match(/^\/api\/v1\/posts\/([^/]+)$/);
  if (postMatch && method === 'GET') {
    const postId = postMatch[1];
    const draft = state.drafts.find((item) => item.id === postId);
    if (!draft) {
      return json(route, { success: false, error: { code: 'POST_NOT_FOUND', message: 'Post not found' } }, 404);
    }
    return json(route, { success: true, data: draft });
  }

  if (postMatch && method === 'PUT') {
    const postId = postMatch[1];
    const payload = JSON.parse(request.postData() || '{}') as {
      content?: string;
      scheduledAt?: string;
      platforms?: Array<{ connectionId: string; platform: string }>;
    };
    state.drafts = state.drafts.map((draft) => (
      draft.id === postId
        ? {
          ...draft,
          content: payload.content ?? draft.content,
          updatedAt: new Date().toISOString(),
          scheduledAt: payload.scheduledAt ?? draft.scheduledAt,
          platformPosts: (payload.platforms || []).map((platform, index) => ({
            id: `${postId}-platform-${index + 1}`,
            platform: platform.platform,
            socialConnectionId: platform.connectionId,
            status: 'draft',
          })),
        }
        : draft
    ));
    return json(route, { success: true, data: { id: postId } });
  }

  const scheduleMatch = path.match(/^\/api\/v1\/schedule\/([^/]+)\/schedule$/);
  if (scheduleMatch && method === 'POST') {
    const postId = scheduleMatch[1];
    state.posts = [
      {
        id: postId,
        content: state.drafts.find((draft) => draft.id === postId)?.content || '',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        publishedAt: null,
        designData: {},
        media: [],
        platformPosts: [],
      },
      ...state.posts.filter((post) => post.id !== postId),
    ];
    return json(route, {
      success: true,
      data: {
        jobId: `job-${postId}`,
        scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });
  }

  if (path === '/api/v1/analytics/overview' && method === 'GET') {
    return json(route, {
      success: true,
      data: {
        totalPosts: state.posts.length,
        publishedPosts: state.posts.filter((post) => post.status === 'published').length,
        connectedAccounts: state.connections.length,
        engagementRate: 4.8,
        metrics: {
          impressions: 1200,
          reach: 980,
          likes: 76,
          comments: 12,
          shares: 5,
          clicks: 18,
          saves: 9,
        },
        postsPerDay: {},
        platformBreakdown: { bluesky: state.posts.length },
        recentPosts: [],
      },
    });
  }

  if (path === '/api/v1/analytics/top-posts' && method === 'GET') {
    return json(route, { success: true, data: [] });
  }

  if (path === '/api/v1/analytics/insights' && method === 'GET') {
    return json(route, {
      success: true,
      data: {
        periodDays: 30,
        generatedAt: new Date().toISOString(),
        insights: [
          {
            id: 'insight-1',
            severity: 'success',
            title: 'Posting cadence looks steady',
            description: 'Your upcoming schedule is balanced for the next week.',
          },
        ],
      },
    });
  }

  return json(route, { success: true, data: {} });
}

async function setupMockApi(page: Page) {
  const state = createInitialState();
  await page.route('**/api/v1/**', async (route) => {
    await handleApiRoute(route, state);
  });
}

test('sign up, connect account, schedule post, and view analytics', async ({ page }) => {
  await setupMockApi(page);

  await page.goto('/auth/register');
  await page.getByLabel('Full Name').fill('E2E User');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Password').fill('StrongPass1');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: 'Connections' }).click();
  await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();

  const blueskyCard = page.locator('div').filter({ hasText: 'Bluesky' }).filter({ hasText: 'Not connected' }).first();
  await blueskyCard.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByRole('heading', { name: 'Connect Bluesky' })).toBeVisible();
  await page.getByLabel('Handle or email').fill('mock.bsky.social');
  await page.getByLabel('App password').fill('app-password-123');
  await page.getByRole('button', { name: 'Connect account' }).click();
  await expect(page.getByText('Bluesky connected successfully.')).toBeVisible();

  await page.getByRole('link', { name: 'Compose' }).click();
  await expect(page.getByRole('heading', { name: 'Compose Post' })).toBeVisible();
  await page.getByPlaceholder('What do you want to share?').fill('E2E scheduled post content');
  await page.getByRole('button', { name: /mock\.bsky\.social/i }).click();

  const futureDate = new Date(Date.now() + 60 * 60 * 1000);
  futureDate.setSeconds(0, 0);
  const localFutureValue = new Date(futureDate.getTime() - (futureDate.getTimezoneOffset() * 60 * 1000))
    .toISOString()
    .slice(0, 16);
  await page.locator('input[type="datetime-local"]').first().fill(localFutureValue);

  await page.getByRole('button', { name: 'Schedule' }).click();
  await expect(page.getByText('Post scheduled!')).toBeVisible();

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Posting cadence looks steady')).toBeVisible();
});
