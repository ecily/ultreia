import { API_BASE } from './config';

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
        signal: controller.signal,
      });
    } catch (error) {
      const networkError = new Error(error?.name === 'AbortError' ? 'Netzwerk-Timeout' : 'Netzwerk/DNS nicht erreichbar');
      networkError.code = error?.name === 'AbortError' ? 'network_timeout' : 'network_unreachable';
      throw networkError;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = new Error(body.error || body.status || `HTTP ${response.status}`);
      apiError.code = response.status >= 500 ? 'http_5xx' : response.status === 503 ? 'backend_not_ready' : 'http_4xx';
      throw apiError;
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function postJson(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}

export function getJson(path) {
  return apiRequest(path);
}
