const API_BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    // Try token refresh on 401
    if (res.status === 401 && token) {
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
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
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
  },
  users: {
    getProfile: () => request<{ success: true; data: any }>('/users/profile'),
    updateProfile: (body: { name?: string; bio?: string; timezone?: string }) =>
      request<{ success: true; data: any }>('/users/profile', {
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
};

// Import auth store (circular-safe: only used at runtime)
import { useAuthStore } from '@/stores/authStore';
