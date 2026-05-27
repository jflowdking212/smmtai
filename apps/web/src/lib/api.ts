import type { SubscriptionTier, WorkspaceRole } from '@ee-postmind/shared';

const API_BASE = '/api/v1';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_NO_REFRESH_PREFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/oauth/',
  '/auth/refresh',
];

function shouldAttemptRefresh(url: string): boolean {
  return !AUTH_NO_REFRESH_PREFIXES.some((prefix) => url.startsWith(prefix));
}

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

async function request<T>(url: string, options?: RequestInit, retryOnUnauthorized = true): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const method = (options?.method || 'GET').toUpperCase();
  const csrfToken = UNSAFE_METHODS.has(method) ? getCookieValue('csrfToken') : null;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    cache: 'no-store',
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
    // Try one token refresh on 401 for non-auth endpoints only.
    if (res.status === 401 && retryOnUnauthorized && shouldAttemptRefresh(url)) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return request<T>(url, options, false);
      }
    }
    if (res.status === 401 && shouldAttemptRefresh(url)) {
      useAuthStore.getState().logout();
    }
    throw new ApiError(data.error?.message || 'Request failed', data.error?.code, res.status);
  }

  return data;
}

async function requestBlob(url: string, options?: RequestInit, retryOnUnauthorized = true): Promise<Blob> {
  const token = useAuthStore.getState().accessToken;
  const method = (options?.method || 'GET').toUpperCase();
  const csrfToken = UNSAFE_METHODS.has(method) ? getCookieValue('csrfToken') : null;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401 && retryOnUnauthorized && shouldAttemptRefresh(url)) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return requestBlob(url, options, false);
      }
    }
    if (res.status === 401 && shouldAttemptRefresh(url)) {
      useAuthStore.getState().logout();
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error?.message || 'Request failed', data.error?.code, res.status);
    }

    throw new ApiError('Request failed', 'UNKNOWN', res.status);
  }

  return res.blob();
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
      request<{ success: true; data: { user: any; workspaceId: string; accessToken: string; role?: WorkspaceRole; tier?: SubscriptionTier } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    login: (body: { email: string; password: string }) =>
      request<{ success: true; data: { user: any; workspaceId: string; accessToken: string; role?: WorkspaceRole; tier?: SubscriptionTier } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    logout: () => request('/auth/logout', { method: 'POST' }),
    switchWorkspace: (workspaceId: string) =>
      request<{ success: true; data: { workspaceId: string; accessToken: string; role: WorkspaceRole; tier: SubscriptionTier } }>('/auth/switch-workspace', {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      }),
    me: () =>
      request<{ success: true; data: { user: any; workspaceId: string; role?: WorkspaceRole; tier?: SubscriptionTier; usage?: Record<string, number> } }>('/auth/me'),
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
    resendVerification: () =>
      request('/auth/resend-verification', { method: 'POST' }),
  },
  users: {
    getProfile: () => request<{ success: true; data: any }>('/users/profile'),
    listEntrepreneurs: () =>
      request<{
        success: true;
        data: Array<{
          id: string;
          name: string;
          email: string;
          avatar: string | null;
          bio: string | null;
          workspaceName: string;
          tier: string;
          accountName: string;
          accountId: string;
          connectedAt: string;
        }>;
      }>('/users/entrepreneurs'),
    updateProfile: (body: { name?: string; bio?: string; timezone?: string; phone?: string; country?: string; avatar?: string }) =>
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
    checkout: (priceKey: string, couponCode?: string) =>
      request<{ success: true; data: { url: string } }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ priceKey, ...(couponCode ? { couponCode } : {}) }),
      }),
    checkoutPublic: (body: { name: string; email: string; priceKey: string; couponCode?: string }) =>
      request<{ success: true; data: { url: string } }>('/billing/checkout/public', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getCheckoutSession: (sessionId: string) =>
      request<{ success: true; data: { amount: number; currency: string; status: string } }>(`/billing/checkout/session/${sessionId}`),
    changePlan: (body: { tier?: string; priceKey?: string; couponCode?: string }) =>
      request<{ success: true; data: any }>('/billing/change-plan', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    previewCoupon: (code: string, priceKey?: string) =>
      request<{ success: true; data: any }>(`/billing/coupons/${encodeURIComponent(code)}${priceKey ? `?priceKey=${encodeURIComponent(priceKey)}` : ''}`),
    portal: () =>
      request<{ success: true; data: { url: string } }>('/billing/portal', {
        method: 'POST',
      }),
    getLimits: () =>
      request<{ success: true; data: { socialAccounts: number; postsPerMonth: number; aiGenerationsPerMonth: number; templatesPerMonth: number; teamMembers: number; analyticsDays: number } }>('/billing/limits'),
    activateTrial: () =>
      request<{ success: true; data: any }>('/billing/trial/activate', { method: 'POST' }),
    getTrialStatus: () =>
      request<{ success: true; data: any }>('/billing/trial/status'),
  },



  connections: {
    list: () =>
      request<{ success: true; data: any[] }>('/connections'),
    getGlobalPlatforms: () =>
      request<{ success: true; data: string[] }>('/connections/global-platforms'),
    initiateOAuth: (platform: string, mode?: string) =>
      request<{ success: true; data: { authUrl: string } }>(`/connections/${platform}/auth`, {
        method: 'POST',
        body: mode ? JSON.stringify({ mode }) : undefined,
      }),
    manualConnect: (platform: string, credentials: string) =>
      request<{ success: true; data: any }>(`/connections/${platform}/connect`, {
        method: 'POST',
        body: JSON.stringify({ credentials }),
      }),
    getEntreprenrsAccessToken: (body: { username: string; password: string; serverKey?: string }) =>
      request<{ success: true; data: { accessToken: string; serverKey: string; userId?: string } }>('/connections/entreprenrs/access-token', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getChrxstiansAccessToken: (body: { usernameEmail: string; password: string; apiKey: string; apiSecret: string }) =>
      request<{ success: true; data: { accessToken: string; apiKey: string; apiSecret: string; accountId?: string; accountName?: string } }>('/connections/chrxstians/access-token', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getIohahAccessToken: (body: { usernameEmail: string; password: string; apiKey: string; apiSecret: string }) =>
      request<{ success: true; data: { accessToken: string; apiKey: string; apiSecret: string; accountId?: string; accountName?: string } }>('/connections/iohah/access-token', {
        method: 'POST',
        body: JSON.stringify(body),
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
    facebookPages: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; picture: string | null; accessToken: string }> }>(`/connections/${connectionId}/facebook-pages`),
    entreprenrsPages: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; description?: string | null; avatar?: string | null }> }>(`/connections/${connectionId}/entreprenrs-pages`),
    chrxstiansPages: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; description?: string | null; avatar?: string | null; url?: string | null }> }>(`/connections/${connectionId}/chrxstians-pages`),
    chrxstiansGroups: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; description?: string | null; avatar?: string | null; url?: string | null }> }>(`/connections/${connectionId}/chrxstians-groups`),
    iohahPages: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; description?: string | null; avatar?: string | null; url?: string | null }> }>(`/connections/${connectionId}/iohah-pages`),
    iohahGroups: (connectionId: string) =>
      request<{ success: true; data: Array<{ id: string; name: string; description?: string | null; avatar?: string | null; url?: string | null }> }>(`/connections/${connectionId}/iohah-groups`),
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
    analytics: (postId: string) =>
      request<{ success: true; data: { postId: string; platforms: Array<{ platformPostId: string; platform: string; status: string; metrics: { impressions: number; reach: number; likes: number; comments: number; shares: number; clicks: number; saves: number } | null; error: string | null; fetchedLive: boolean }> } }>(`/posts/${postId}/analytics`),
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
  editor: {
    removeBackground: (formData: FormData) =>
      requestBlob('/bg-remove', { method: 'POST', body: formData }),
    collaborationAccess: () =>
      request<{ success: true; data: { allowed: boolean; tier: string } }>('/collaboration/access'),
    collaborationPublish: (roomId: string, clientId: string, payload: unknown) =>
      request<{ success: true; data: { delivered: number } }>(
        `/collaboration/${encodeURIComponent(roomId)}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ clientId, payload }),
        },
      ),
    collaborationStreamUrl: (roomId: string, clientId: string) => {
      const token = useAuthStore.getState().accessToken;
      const params = new URLSearchParams();
      params.set('clientId', clientId);
      if (token) params.set('token', token);
      return `${API_BASE}/collaboration/${encodeURIComponent(roomId)}/stream?${params.toString()}`;
    },
  },
  feedback: {
    submit: (data: { type: string; message: string; rating: number }) =>
      request<{ success: true; data: { id: string } }>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
    list: () =>
      request<{ success: true; data: any[] }>('/feedback'),
  },
  site: {
    getPublicSettings: () =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/site/public'),
    getPublicPlans: () =>
      request<{ success: true; data: Record<string, any> }>('/admin/settings/plans/public'),
  },
  admin: {
    getSmtp: () =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/smtp'),
    saveSmtp: (data: Record<string, string>) =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/smtp', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    testSmtp: (email: string) =>
      request<{ success: true; data: { success: boolean; message: string } }>('/admin/settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    getStorage: () =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/storage'),
    saveStorage: (data: Record<string, string>) =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/storage', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    testStorage: (data?: Record<string, string>) =>
      request<{ success: true; data: { success: boolean; message: string } }>('/admin/settings/storage/test', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    getSiteSettings: () =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/site'),
    saveSiteSettings: (data: Record<string, string>) =>
      request<{ success: true; data: Record<string, string> }>('/admin/settings/site', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    uploadLogo: (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      return request<{ success: true; data: { url: string } }>('/admin/settings/site/logo', {
        method: 'POST',
        body: formData,
      });
    },
    uploadFavicon: (file: File) => {
      const formData = new FormData();
      formData.append('favicon', file);
      return request<{ success: true; data: { url: string } }>('/admin/settings/site/favicon', {
        method: 'POST',
        body: formData,
      });
    },
    getPlatforms: () =>
      request<{ success: true; data: Record<string, { access_token: string; server_key: string; client_id: string; client_secret: string }> }>('/admin/settings/platforms'),
    savePlatforms: (data: Record<string, Partial<{ access_token: string; server_key: string; client_id: string; client_secret: string }>>) =>
      request<{ success: true; data: Record<string, { access_token: string; server_key: string; client_id: string; client_secret: string }> }>('/admin/settings/platforms', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getPlans: () =>
      request<{ success: true; data: Record<string, any> }>('/admin/settings/plans'),
    savePlans: (data: Record<string, any>) =>
      request<{ success: true; data: Record<string, any> }>('/admin/settings/plans', {
        method: 'PUT',
        body: JSON.stringify(data, (_k, v) => (v === Infinity ? '__INFINITY__' : v)),
      }),
    getCoupons: () =>
      request<{ success: true; data: any[] }>('/admin/coupons'),
    createCoupon: (data: Record<string, any>) =>
      request<{ success: true; data: any }>('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateCoupon: (id: string, data: Record<string, any>) =>
      request<{ success: true; data: any }>(`/admin/coupons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    // Admin dashboard & management
    getDashboard: () =>
      request<{ success: true; data: { totalUsers: number; scheduledPosts: number; activeSubscriptions: number; planBreakdown: Record<string, number> } }>('/admin/dashboard'),
    getUsers: (params?: { search?: string; page?: string; limit?: string }) =>
      request<{ success: true; data: { users: any[]; total: number; page: number; limit: number } }>(`/admin/users${params ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    updateUserStatus: (id: string, action: 'suspend' | 'enable') =>
      request<{ success: true; data: { message: string } }>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ action }) }),
    updateUserPlan: (id: string, tier: string) =>
      request<{ success: true; data: { message: string } }>(`/admin/users/${id}/plan`, { method: 'PUT', body: JSON.stringify({ tier }) }),
    updateUserRole: (id: string, role: string) =>
      request<{ success: true; data: { message: string } }>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    deleteUser: (id: string, password: string) =>
      request<{ success: true; data: { message: string } }>(`/admin/users/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
    getAnalytics: () =>
      request<{ success: true; data: any }>('/admin/analytics'),
    getMessages: (params?: { status?: string; search?: string; page?: string; limit?: string }) =>
      request<{ success: true; data: { conversations: any[]; total: number; page: number; limit: number } }>(`/admin/messages${params ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    getAuditLog: (params?: { page?: string; limit?: string }) =>
      request<{ success: true; data: { logs: any[]; total: number; page: number; limit: number } }>(`/admin/audit-log${params ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
  },
  chat: {
    sendMessage: (data: { message: string; context?: string; sessionId?: string; customerInfo?: { name?: string; email?: string; phone?: string } }) =>
      request<any>('/chat/message', { method: 'POST', body: JSON.stringify(data) }),
    transcribeVoice: (audioBlob: Blob, filename = 'voice.webm') => {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      return request<{ success: true; transcript: string }>('/chat/transcribe', { method: 'POST', body: formData });
    },
    getHistory: (sessionId: string) =>
      request<{ success: boolean; messages: any[]; customerInfo?: any }>(`/chat/conversations/history/${sessionId}`),
    getConversations: (params?: { status?: string; email?: string }) =>
      request<{ success: true; data: any[] }>(`/chat/conversations${params ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    getConversationStats: () =>
      request<{ success: true; data: { total: number; active: number; transferred: number; ended: number } }>('/chat/conversations/stats'),
    getConversation: (sessionId: string) =>
      request<{ success: true; data: any }>(`/chat/conversation/${sessionId}`),
    deleteConversation: (sessionId: string) =>
      request<{ success: boolean; message: string }>(`/chat/conversation/${sessionId}`, { method: 'DELETE' }),
    endConversation: (sessionId: string, summary?: string) =>
      request<{ success: true; data: any }>('/chat/conversation/end', { method: 'POST', body: JSON.stringify({ sessionId, summary }) }),
    // Knowledge Base
    getKnowledge: (params?: { category?: string; isActive?: string }) =>
      request<{ success: true; data: any[] }>(`/chat/knowledge${params ? '?' + new URLSearchParams(params as Record<string, string>) : ''}`),
    createKnowledge: (data: { title: string; content: string; category?: string; tags?: string[]; priority?: number }) =>
      request<{ success: true; data: any }>('/chat/knowledge', { method: 'POST', body: JSON.stringify(data) }),
    updateKnowledge: (id: string, data: { title?: string; content?: string; category?: string; tags?: string[]; priority?: number }) =>
      request<{ success: true; data: any }>(`/chat/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteKnowledge: (id: string) =>
      request<{ success: true; data: any }>(`/chat/knowledge/${id}`, { method: 'DELETE' }),
    bulkImportKnowledge: (entries: Array<{ title: string; content: string; category?: string; tags?: string[] }>) =>
      request<{ success: true; data: any }>('/chat/knowledge/bulk-import', { method: 'POST', body: JSON.stringify({ entries }) }),
    searchKnowledge: (query: string, limit?: number) =>
      request<{ success: true; data: any[] }>('/chat/knowledge/search', { method: 'POST', body: JSON.stringify({ query, limit }) }),
  },

  messaging: {
    getConversations: () =>
      request<{ success: true; data: { conversations: any[]; connections: any[] } }>('/messaging/conversations'),
    getMessages: (conversationId: string, connectionId: string) =>
      request<{ success: true; data: any[] }>(`/messaging/conversations/${conversationId}/messages?connectionId=${connectionId}`),
    sendMessage: (conversationId: string, connectionId: string, recipientId: string, message: string) =>
      request<{ success: true; data: any }>(`/messaging/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ connectionId, recipientId, message }),
      }),
    getPostComments: (mediaId: string, connectionId: string) =>
      request<{ success: true; data: any[] }>(`/messaging/posts/${mediaId}/comments?connectionId=${connectionId}`),
    replyToComment: (commentId: string, connectionId: string, message: string) =>
      request<{ success: true; data: any }>(`/messaging/comments/${commentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ connectionId, message }),
      }),
    hideComment: (commentId: string, connectionId: string, hide: boolean) =>
      request<{ success: true; data: any }>(`/messaging/comments/${commentId}/hide`, {
        method: 'POST',
        body: JSON.stringify({ connectionId, hide }),
      }),
    deleteComment: (commentId: string, connectionId: string) =>
      request<{ success: true; data: any }>(`/messaging/comments/${commentId}?connectionId=${connectionId}`, {
        method: 'DELETE',
      }),
  },
};

// Import auth store (circular-safe: only used at runtime)
import { useAuthStore } from '@/stores/authStore';
