/**
 * REST API HTTP Client for Telegram Mini App.
 * Handles authentication headers (Telegram initData, admin Bearer tokens, or development fallback),
 * base URL routing, error normalization, and JSON parsing.
 */

const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_API_BASE_URL || 'https://daemonproxy-7m1m.onrender.com';

const ADMIN_TOKEN_KEY = 'krish_telebot_admin_token';
const WEB_USER_TOKEN_KEY = 'krish_web_user_token';
let adminSessionToken: string | null = null;
let webUserSessionToken: string | null = null;

try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    adminSessionToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    webUserSessionToken = window.localStorage.getItem(WEB_USER_TOKEN_KEY);
  }
} catch {
  // Storage access in sandboxed environment
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
 * Stores or clears the website Google user JWT session token in localStorage.
 */
export function setWebUserToken(token: string | null): void {
  webUserSessionToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(WEB_USER_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(WEB_USER_TOKEN_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieves the website Google user JWT session token from memory or localStorage.
 */
export function getWebUserToken(): string | null {
  if (!webUserSessionToken) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        webUserSessionToken = window.localStorage.getItem(WEB_USER_TOKEN_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
  return webUserSessionToken;
}

/**
 * Extracts raw Telegram WebApp initData string if available in current window or URL params.
 */
export function getTelegramInitData(): string {
  try {
    const direct = (
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram
        ?.WebApp?.initData || ''
    );
    if (direct) return direct;

    // Check URL hash for tgWebAppData
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const tgData = params.get('tgWebAppData');
      if (tgData) return tgData;
    }

    // Check query parameter for initData
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const qData = params.get('initData') || params.get('tgWebAppData');
      if (qData) return qData;
    }

    return '';
  } catch {
    return '';
  }
}

/**
 * Returns true if current execution context is inside native Telegram Mini App.
 */
export function isTelegramWebApp(): boolean {
  return Boolean(getTelegramInitData());
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
  const webUserToken = getWebUserToken();
  const adminToken = getAdminToken();

  if (initData) {
    // 1. Inside Telegram Mini App: Always authenticate via cryptographic initData
    headers.set('X-Telegram-Init-Data', initData);

    // Inject Bearer Authorization header for admin endpoints if admin token exists
    if (adminToken && (endpoint.startsWith('/api/admin') || endpoint.includes('/admin/'))) {
      headers.set('Authorization', `Bearer ${adminToken}`);
    }
  } else if (webUserToken) {
    // 2. Standalone Website: Authenticate via Google Session JWT
    headers.set('Authorization', `Bearer ${webUserToken}`);
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
