const API_BASE = '/api/v1';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const method = (options?.method || 'GET').toUpperCase();
  const csrfToken = UNSAFE_METHODS.has(method) ? getCookieValue('csrfToken') : null;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Try token refresh on 401
    if (res.status === 401) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return request<T>(url, options);
      }
      useAuthStore.getState().logout();
    }
    throw new ApiError(data.error?.message || 'Request failed', data.error?.code, res.status);
  }

  return data;
}

async function refreshTokens(): Promise<boolean> {
  try {
    const csrfToken = getCookieValue('csrfToken');
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    useAuthStore.getState().setAccessToken(data.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'UNKNOWN', status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// API methods
export const api = {
  auth: {
    oauthUrl: (provider: 'google' | 'github' | 'facebook', next = '/') =>
      `${API_BASE}/auth/oauth/${provider}?next=${encodeURIComponent(next)}`,
    register: (body: { name: string; email: string; password: string }) =>
      request<{ success: true; data: { user: any; workspaceId: string; accessToken: string } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    login: (body: { email: string; password: string }) =>
      request<{ success: true; data: { user: any; workspaceId: string; accessToken: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ success: true; data: { user: any; workspaceId: string } }>('/auth/me'),
    forgotPassword: (email: string) =>
      request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
    verifyEmail: (token: string) =>
      request('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  },
  users: {
    getProfile: () => request<{ success: true; data: any }>('/users/profile'),
    updateProfile: (body: { name?: string; bio?: string; timezone?: string }) =>
      request<{ success: true; data: any }>('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    getNotificationPreferences: () =>
      request<{
        success: true;
        data: {
          postPublished: boolean;
          postFailed: boolean;
          upcomingScheduled: boolean;
          weeklyAnalyticsDigest: boolean;
          monthlyAnalyticsDigest: boolean;
        };
      }>('/users/notifications/preferences'),
    updateNotificationPreferences: (
      body: {
        postPublished?: boolean;
        postFailed?: boolean;
        upcomingScheduled?: boolean;
        weeklyAnalyticsDigest?: boolean;
        monthlyAnalyticsDigest?: boolean;
      },
    ) =>
      request<{
        success: true;
        data: {
          postPublished: boolean;
          postFailed: boolean;
          upcomingScheduled: boolean;
          weeklyAnalyticsDigest: boolean;
          monthlyAnalyticsDigest: boolean;
        };
      }>('/users/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },
  workspaces: {
    list: () => request<{ success: true; data: any[] }>('/workspaces'),
    create: (name: string) =>
      request<{ success: true; data: any }>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    getMembers: (workspaceId: string) =>
      request<{ success: true; data: any[] }>(`/workspaces/${workspaceId}/members`),
    inviteMember: (workspaceId: string, email: string, role: string) =>
      request(`/workspaces/${workspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    acceptInvite: (token: string) =>
      request<{ success: true; data: any }>('/workspaces/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    declineInvite: (token: string) =>
      request<{ success: true; data: any }>('/workspaces/invitations/decline', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    removeMember: (workspaceId: string, userId: string) =>
      request(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
  },
  billing: {
    status: () =>
      request<{ success: true; data: any }>('/billing/status'),
    checkout: (priceKey: string) =>
      request<{ success: true; data: { url: string } }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ priceKey }),
      }),
    portal: () =>
      request<{ success: true; data: { url: string } }>('/billing/portal', {
        method: 'POST',
      }),
  },
  connections: {
    list: () =>
      request<{ success: true; data: any[] }>('/connections'),
    initiateOAuth: (platform: string) =>
      request<{ success: true; data: { authUrl: string } }>(`/connections/${platform}/auth`, {
        method: 'POST',
      }),
    manualConnect: (platform: string, credentials: string) =>
      request<{ success: true; data: any }>(`/connections/${platform}/connect`, {
        method: 'POST',
        body: JSON.stringify({ credentials }),
      }),
    healthCheck: (connectionId: string) =>
      request<{ success: true; data: {
        id: string;
        platform: string;
        accountName: string;
        accountId: string;
        isActive: boolean;
        tokenExpired: boolean;
        lastSyncAt: string | null;
        healthy: boolean;
        error?: { code: string; message: string };
      } }>(`/connections/${connectionId}/health-check`, { method: 'POST' }),
    disconnect: (connectionId: string) =>
      request(`/connections/${connectionId}`, { method: 'DELETE' }),
  },
  ai: {
    caption: (data: any) =>
      request<{ success: true; data: any }>('/ai/caption', { method: 'POST', body: JSON.stringify(data) }),
    hashtags: (data: any) =>
      request<{ success: true; data: any }>('/ai/hashtags', { method: 'POST', body: JSON.stringify(data) }),
    imagePrompt: (data: any) =>
      request<{ success: true; data: any }>('/ai/image-prompt', { method: 'POST', body: JSON.stringify(data) }),
    rewrite: (data: any) =>
      request<{ success: true; data: any }>('/ai/rewrite', { method: 'POST', body: JSON.stringify(data) }),
    translate: (data: any) =>
      request<{ success: true; data: any }>('/ai/translate', { method: 'POST', body: JSON.stringify(data) }),
    compliance: (data: any) =>
      request<{ success: true; data: any }>('/ai/compliance', { method: 'POST', body: JSON.stringify(data) }),
    bestTimes: (data: any) =>
      request<{ success: true; data: any }>('/ai/best-times', { method: 'POST', body: JSON.stringify(data) }),
    trending: (data: any) =>
      request<{ success: true; data: any }>('/ai/trending', { method: 'POST', body: JSON.stringify(data) }),
  },
  posts: {
    list: (params?: Record<string, string>) =>
      request<{ success: true; data: any }>(`/posts${params ? '?' + new URLSearchParams(params) : ''}`),
    get: (postId: string) =>
      request<{ success: true; data: any }>(`/posts/${postId}`),
    create: (data: any) =>
      request<{ success: true; data: any }>('/posts', { method: 'POST', body: JSON.stringify(data) }),
    update: (postId: string, data: any) =>
      request<{ success: true; data: any }>(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(data) }),
    submitForApproval: (postId: string) =>
      request<{ success: true; data: any }>(`/posts/${postId}/submit-approval`, { method: 'POST' }),
    approve: (postId: string) =>
      request<{ success: true; data: any }>(`/posts/${postId}/approve`, { method: 'POST' }),
    reject: (postId: string) =>
      request<{ success: true; data: any }>(`/posts/${postId}/reject`, { method: 'POST' }),
    publish: (postId: string) =>
      request<{ success: true; data: any }>(`/posts/${postId}/publish`, { method: 'POST' }),
    uploadMedia: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{
        success: true;
        data: {
          url: string;
          fileName: string;
          mimeType: string;
          size: number;
          type: 'image' | 'video';
        };
      }>('/posts/media/upload', {
        method: 'POST',
        body: formData,
      });
    },
    delete: (postId: string) =>
      request(`/posts/${postId}`, { method: 'DELETE' }),
  },
  schedule: {
    calendar: (start?: string, end?: string) =>
      request<{ success: true; data: any[] }>(`/schedule/calendar${start || end ? `?${new URLSearchParams({ ...(start ? { start } : {}), ...(end ? { end } : {}) })}` : ''}`),
    schedulePost: (postId: string, scheduledAt: string) =>
      request<{ success: true; data: { jobId: string; scheduledAt: string } }>(`/schedule/${postId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledAt }),
      }),
    bulk: (csv: string) =>
      request<{
        success: true;
        data: {
          total: number;
          scheduled: number;
          failed: number;
          results: Array<{ row: number; postId: string; jobId: string; scheduledAt: string }>;
          errors: Array<{ row: number; postId: string; code: string; message: string }>;
        };
      }>('/schedule/bulk', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      }),
    recommendations: (body: { platform: string; industry?: string; timezone?: string; limit?: number }) =>
      request<{
        success: true;
        data: {
          platform: string;
          timezone: string;
          limit: number;
          conflictWindowMinutes: number;
          recommendations: Array<{ day: string; time: string; score: number; reason?: string; scheduledAt: string }>;
          conflicts: Array<{
            day: string;
            time: string;
            score: number;
            reason?: string;
            scheduledAt: string;
            conflictPostId: string;
            conflictScheduledAt: string | null;
          }>;
        };
      }>('/schedule/recommendations', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    recurring: (postId: string, body: { startsAt: string; recurrence: 'daily' | 'weekly' | 'monthly'; timezone: string }) =>
      request<{ success: true; data: { jobId: string; cronExpr: string; timezone: string; nextRunAt: string } }>(`/schedule/${postId}/recurring`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    cancel: (postId: string) =>
      request<{ success: true; data: { message: string } }>(`/schedule/${postId}/schedule`, {
        method: 'DELETE',
      }),
    stats: () =>
      request<{ success: true; data: { waiting: number; active: number; delayed: number; completed: number; failed: number; paused: boolean; recurring: number } }>('/schedule/stats'),
    pauseQueue: () =>
      request<{ success: true; data: { paused: boolean } }>('/schedule/queue/pause', { method: 'POST' }),
    resumeQueue: () =>
      request<{ success: true; data: { paused: boolean } }>('/schedule/queue/resume', { method: 'POST' }),
  },
  analytics: {
    refresh: () =>
      request<{ success: true; data: { jobId: string } }>('/analytics/refresh', {
        method: 'POST',
      }),
    overview: (days = 30) =>
      request<{ success: true; data: any }>(`/analytics/overview?days=${days}`),
    platform: (platform: string, days = 30) =>
      request<{ success: true; data: any }>(`/analytics/platform/${platform}?days=${days}`),
    topPosts: (limit = 10) =>
      request<{ success: true; data: any }>(`/analytics/top-posts?limit=${limit}`),
    insights: (days = 30) =>
      request<{ success: true; data: { periodDays: number; generatedAt: string; insights: any[] } }>(`/analytics/insights?days=${days}`),
  },
  templates: {
    list: (category?: string) =>
      request<{ success: true; data: any[] }>(`/templates${category ? `?category=${encodeURIComponent(category)}` : ''}`),
    create: (data: { name: string; category: string; designData: string; platforms: string[] }) =>
      request<{ success: true; data: any }>('/templates', { method: 'POST', body: JSON.stringify(data) }),
    delete: (templateId: string) =>
      request('/templates/' + templateId, { method: 'DELETE' }),
  },
};

// Import auth store (circular-safe: only used at runtime)
import { useAuthStore } from '@/stores/authStore';
