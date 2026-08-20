import { API_BASE, REQUEST_SCOPE } from './config';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      const response = await fetch(`${API_BASE}/auth/session/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (!response.ok) { await clearSession(); return false; }
      const body = await response.json();
      await saveSession({ accessToken: body.session.accessToken, refreshToken: body.session.refreshToken, user: body.user, scope: body.session.scope });
      return true;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const makeRequest = async (token) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const request = fetch(`${API_BASE}${path}`, { ...options, headers: { 'content-type': 'application/json', 'x-ultreia-scope': REQUEST_SCOPE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }, signal: controller.signal });
    return request.catch((error) => {
      const networkError = new Error(error?.name === 'AbortError' ? 'network_timeout' : 'network_unreachable');
      networkError.code = error?.name === 'AbortError' ? 'network_timeout' : 'network_unreachable';
      throw networkError;
    }).finally(() => clearTimeout(timeout));
  };
  let token = await getAccessToken();
  let response;
  response = await makeRequest(token);
    if (response.status === 401 && token && !path.startsWith('/auth/session/refresh') && !path.startsWith('/auth/magic-link/')) {
      if (await refreshAccessToken()) { token = await getAccessToken(); response = await makeRequest(token); }
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = new Error(body.error || body.status || `HTTP ${response.status}`);
      apiError.code = response.status === 503 ? 'backend_not_ready' : response.status >= 500 ? 'http_5xx' : 'http_4xx';
      throw apiError;
    }
  return body;
}

export function postJson(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

export function getJson(path) {
  return apiRequest(path);
}
