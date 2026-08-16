import { API_BASE } from './config';

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.status || `HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function postJson(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}
