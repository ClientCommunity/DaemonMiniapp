/**
 * REST API HTTP Client for Telegram Mini App.
 * Handles authentication headers (Telegram initData, admin Bearer tokens, or development fallback),
 * base URL routing, error normalization, and JSON parsing.
 */

const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_API_BASE_URL || 'https://daemonproxy-7m1m.onrender.com';

const ADMIN_TOKEN_KEY = 'krish_telebot_admin_token';
let adminSessionToken: string | null = null;

try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    adminSessionToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  }
} catch {
  // Session storage access in sandboxed environment
}

/**
 * Stores or clears the admin JWT session token in memory and sessionStorage.
 */
export function setAdminToken(token: string | null): void {
  adminSessionToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) {
        window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieves the current admin JWT session token from memory or sessionStorage.
 */
export function getAdminToken(): string | null {
  if (!adminSessionToken) {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        adminSessionToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
  return adminSessionToken;
}

/**
 * Extracts raw Telegram WebApp initData string if available in current window.
 */
export function getTelegramInitData(): string {
  try {
    return (
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram
        ?.WebApp?.initData || ''
    );
  } catch {
    return '';
  }
}

/**
 * Resolves API request path against the configured base URL.
 */
export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  if (cleanPath.startsWith('/api') && cleanBase.endsWith('/api')) {
    return `${cleanBase.slice(0, -4)}${cleanPath}`;
  }
  return `${cleanBase}${cleanPath}`;
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Main fetch wrapper that injects security headers and standardizes error handling.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, ...fetchOptions } = options;

  let url = resolveApiUrl(endpoint);
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers = new Headers(customHeaders || {});

  if (!headers.has('Content-Type') && fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const initData = getTelegramInitData();
  if (initData) {
    headers.set('X-Telegram-Init-Data', initData);
  } else {
    // Development fallback when launched outside native Telegram client
    headers.set('X-User-Id', '7507183871');
  }

  // Inject Bearer Authorization header for admin endpoints if admin token exists
  const adminToken = getAdminToken();
  if (adminToken && (endpoint.startsWith('/api/admin') || endpoint.includes('/admin/'))) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network connection failed';
    throw new Error(`API Network Error: ${message}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let responseData: any = null;

  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      (responseData && typeof responseData === 'object' && (responseData.error || responseData.detail || responseData.message)) ||
      `Request to ${endpoint} failed with status ${response.status}`;
    throw new Error(String(errorMsg));
  }

  return responseData as T;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<T>(endpoint, { method: 'GET', params }),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'DELETE',
      params,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
