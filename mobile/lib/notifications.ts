// stepsmatch/mobile/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OFFERS_CHANNEL_ID = 'offers';
const TOKEN_KEY = 'expoPushToken';

/** Android: Channel VOR der Permission anlegen (Android 13+). */
export async function ensureAndroidChannelAsync() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(OFFERS_CHANNEL_ID, {
    name: 'Angebote in deiner Nähe',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default', // oder 'arrival.mp3', wenn in app.json registriert
    vibrationPattern: [0, 200, 150, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Fragt Benachrichtigungs-Berechtigung an (zeigt System-Prompt, falls nötig). */
export async function requestNotificationPermissionAsync(): Promise<boolean> {
  await ensureAndroidChannelAsync();
  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  return status === 'granted';
}

/** Holt Expo Push Token (EAS projectId nötig in Dev/Preview) und speichert ihn lokal. */
export async function getAndStoreExpoPushTokenAsync(): Promise<string | null> {
  const granted = await requestNotificationPermissionAsync();
  if (!granted) return null;

  // projectId aus Constants (Dev/Preview Build)
  const projectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined;

  let token = '';
  try {
    token = (await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined as any
    )).data;
  } catch (e) {
    // Fallback ohne projectId (kann in bestimmten Setups funktionieren)
    token = (await Notifications.getExpoPushTokenAsync() as any).data;
  }

  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  }
  return null;
}

/** Liest den lokal gespeicherten Push-Token (für Hintergrund-Tasks). */
export async function getStoredPushTokenAsync(): Promise<string | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token || null;
}
