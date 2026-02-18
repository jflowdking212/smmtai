import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers/testApp.js';

const { usageMocks, fetchMock } = vi.hoisted(() => ({
  usageMocks: {
    checkUsage: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    incrementUsage: vi.fn(),
  },
  fetchMock: vi.fn<typeof fetch>(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user_test';
    req.workspaceId = 'workspace_test';
    next();
  },
}));

vi.mock('../middleware/usage.js', () => ({
  checkUsage: usageMocks.checkUsage,
  incrementUsage: usageMocks.incrementUsage,
}));

import { aiRouter } from '../routes/ai.js';

const aiApp = createTestApp('/ai', aiRouter);

describe('AI route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    usageMocks.incrementUsage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('proxies caption requests and increments AI usage', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          caption: 'Launch day update',
          character_count: 17,
          platform_limit: 63206,
          hashtags: ['growth'],
          cta: 'Learn more',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await request(aiApp)
      .post('/ai/caption')
      .send({ topic: 'Launch day update', platform: 'facebook' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.caption).toBe('Launch day update');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/ai/caption');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-api-key': expect.any(String),
    });
    expect(options.body).toBe(JSON.stringify({ topic: 'Launch day update', platform: 'facebook' }));
    expect(usageMocks.incrementUsage).toHaveBeenCalledWith('workspace_test', 'ai_generations');
  });

  it('returns AI_SERVICE_ERROR when upstream returns a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Upstream unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await request(aiApp)
      .post('/ai/hashtags')
      .send({ topic: 'Launch day update', platform: 'facebook' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual({
      code: 'AI_SERVICE_ERROR',
      message: 'Upstream unavailable',
    });
    expect(usageMocks.incrementUsage).not.toHaveBeenCalled();
  });

  it.each([
    {
      path: '/ai/compliance',
      payload: { content: 'This is a product update.', platform: 'facebook' },
      body: { is_safe: true, score: 0.02, issues: [], suggestions: [] },
      expectedKey: 'is_safe',
    },
    {
      path: '/ai/best-times',
      payload: { platform: 'facebook' },
      body: { times: [{ day: 'Monday', time: '09:00', score: 0.8 }] },
      expectedKey: 'times',
    },
    {
      path: '/ai/trending',
      payload: { platform: 'facebook' },
      body: { topics: [{ topic: 'Launch', relevance: 0.9 }] },
      expectedKey: 'topics',
    },
  ])('increments usage for $path requests', async ({ path, payload, body, expectedKey }) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(body),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await request(aiApp)
      .post(path)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[expectedKey]).toBeDefined();
    expect(usageMocks.incrementUsage).toHaveBeenCalledWith('workspace_test', 'ai_generations');
  });
});
