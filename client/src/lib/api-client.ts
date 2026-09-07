import type { ApiErrorBody } from '@leadpilot/shared';

/**
 * Same-origin in every environment: Vite proxies `/api` in development and
 * Vercel routes it in production, so the auth cookie is always first-party.
 */
const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages keyed by form path, when the server sent them. */
  readonly details?: Record<string, string[]>;
  /** Matches a line in the server log — quote it when reporting a bug. */
  readonly requestId?: string;
  /** Real error name, message and stack. Development only, by default. */
  readonly debug?: ApiErrorBody['error']['debug'];

  constructor(status: number, body: ApiErrorBody['error'] | undefined, fallback: string) {
    super(body?.message ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN';
    this.details = body?.details;
    this.requestId = body?.requestId;
    this.debug = body?.debug;

    // Surface the server's stack in the browser console. Without this a 500
    // shows only the client-side frames, which say nothing about the cause.
    if (import.meta.env.DEV && this.debug) {
      console.error(
        `[API ${status} ${this.code}] ${this.debug.name}: ${this.debug.detail}` +
          (this.requestId ? `\n  requestId: ${this.requestId}` : ''),
        this.debug.stack ? `\n${this.debug.stack.join('\n')}` : '',
      );
    }
  }

  /** True when the caller should be sent back to the login screen. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Query parameters; `undefined`, `null` and `''` entries are dropped. */
  params?: Record<string, unknown>;
  /** Internal — prevents the refresh retry from recursing. */
  skipRefresh?: boolean;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // The API accepts comma-separated lists for repeated filters.
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }

  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Serialises a single refresh across concurrent 401s.
 *
 * Without this, a page that fires five queries at once would trigger five
 * parallel refreshes — and because refresh tokens rotate, four of them would
 * present an already-revoked token and trip the reuse-detection lockout.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      queueMicrotask(() => {
        refreshPromise = null;
      });
    }
  })();

  return refreshPromise;
}

/** Listeners notified when the session is definitively gone. */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (a proxy timeout, say) — fall through to the status text.
  }
  return new ApiError(response.status, body?.error, response.statusText || 'Request failed');
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, skipRefresh, headers, ...init } = options;

  const response = await fetch(buildUrl(path, params), {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // A 401 on any call means the short-lived access token expired. Refresh once
  // and replay the original request; if that fails, the session is really over.
  if (response.status === 401 && !skipRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    notifySessionExpired();
    throw await parseError(response);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
