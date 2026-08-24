const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = (configuredApiBase || '/api').replace(/\/$/, '');

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const tokenKey = 'zhongsai_crm_tokens';

export function getTokens(): Tokens | null {
  try {
    const value = localStorage.getItem(tokenKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<Tokens>;
    return typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string'
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(tokenKey, JSON.stringify(tokens));
  else localStorage.removeItem(tokenKey);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { message?: string | string[] } & T;
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join('；') : body.message;
    throw new Error(message || `请求失败（${response.status}）`);
  }
  return body;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })
      .then((response) => parseResponse<Tokens>(response))
      .then((next) => {
        setTokens(next);
        return next.accessToken;
      })
      .catch(() => {
        setTokens(null);
        return null;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const accessToken = await refreshAccessToken();
    if (accessToken) return api<T>(path, init, false);
  }
  return parseResponse<T>(response);
}

export function queryString(values: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}
