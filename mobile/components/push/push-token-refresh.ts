// stepsmatch/mobile/components/push/push-token-refresh.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { API_BASE } from './push-constants';
import { getPersistentDeviceId } from './push-state';

async function getProjectId(): Promise<string> {
  // aus Constants, fallback auf euren festen Wert
  const pid =
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId ||
    '08559a29-b307-47e9-a130-d3b31f73b4ed';
  return String(pid);
}

async function getStoredToken(): Promise<string|null> {
  try {
    const { SecureStore } = await import('expo-secure-store');
    const v = await SecureStore.getItemAsync('expoPushToken');
    return v || null;
  } catch { return null; }
}

async function setStoredToken(tok:string) {
  try {
    const { SecureStore } = await import('expo-secure-store');
    await SecureStore.setItemAsync('expoPushToken', tok);
  } catch {}
}

export async function refreshExpoPushTokenNow(reason = 'manual-refresh') {
  try {
    // 1) Permission sicherstellen
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') {
        console.log('[PUSH] permission not granted');
        return null;
      }
    }

    // 2) Token mit Project ID holen (wichtig!)
    const projectId = await getProjectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp?.data || null;
    if (!token) return null;

    // 3) Bei Änderung registrieren
    const prev = await getStoredToken();
    if (token !== prev) {
      await setStoredToken(token);
      const deviceId = await getPersistentDeviceId();
      await fetch(`${API_BASE}/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, deviceId, projectId, platform: 'android' }),
      }).catch(()=>{});
      console.log('[PUSH] token (re)registered', token.slice(0,22)+'…', { reason, projectId });
    }
    return token;
  } catch (e:any) {
    console.log('[PUSH] refreshExpoPushTokenNow error', String(e?.message || e));
    return null;
  }
}
