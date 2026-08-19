import { Linking } from 'react-native';
import { getDeviceId } from './device';
import { getJson, postJson, apiRequest } from './api';
import { clearSession, getSession, saveSession } from './session';

function sessionFromResponse(body) {
  return { accessToken: body.session.accessToken, refreshToken: body.session.refreshToken, user: body.user, scope: body.session.scope };
}

export async function requestMagicLink(email, displayName, preferredLocale = 'de') {
  const deviceId = await getDeviceId();
  return postJson('/auth/magic-link/request', { email, displayName, preferredLocale, deviceId });
}

export async function verifyMagicLink(token) {
  const body = await postJson('/auth/magic-link/verify', { token, deviceId: await getDeviceId() });
  await saveSession(sessionFromResponse(body));
  return body;
}

export async function openVerificationUrl(url) {
  const match = String(url || '').match(/[?&]token=([^&]+)/);
  if (!match) throw Object.assign(new Error('invalid_magic_link'), { code: 'invalid_magic_link' });
  return verifyMagicLink(decodeURIComponent(match[1]));
}

export async function readDevVerificationUrl(diagnosticId) {
  return getJson(`/auth/dev/magic-link/${encodeURIComponent(diagnosticId)}`);
}

export async function loadCurrentUser() {
  try { return await getJson('/auth/me'); } catch (error) { if (error.code === 'http_4xx') await clearSession(); throw error; }
}

export async function logout() {
  try { if (await getSession()) await apiRequest('/auth/logout', { method: 'POST' }); } finally { await clearSession(); }
}

export function listenForMagicLinks(handler) {
  const handle = ({ url }) => handler(url);
  const subscription = Linking.addEventListener('url', handle);
  Linking.getInitialURL().then((url) => { if (url) handler(url); }).catch(() => {});
  return () => subscription.remove();
}
