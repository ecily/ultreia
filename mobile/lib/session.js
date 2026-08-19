import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'ultreia.session.v1';

export async function getSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { await clearSession(); return null; }
}

export async function saveSession(session) { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)); return session; }
export async function clearSession() { await SecureStore.deleteItemAsync(SESSION_KEY); }
export async function getAccessToken() { return (await getSession())?.accessToken || null; }
export async function getRefreshToken() { return (await getSession())?.refreshToken || null; }
