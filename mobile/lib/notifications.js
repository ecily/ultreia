import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EXPO_PROJECT_ID, ATTENTION_CHANNEL, LOCATION_CHANNEL } from './config';
import { getDeviceId } from './device';
import { postJson } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function configureNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(LOCATION_CHANNEL, {
    name: 'Standortdienst', importance: Notifications.AndroidImportance.LOW, sound: null,
  });
  await Notifications.setNotificationChannelAsync(ATTENTION_CHANNEL, {
    name: 'Ultreia technische Hinweise', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', vibrationPattern: [0, 300, 150, 300],
  });
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return current;
  return Notifications.requestPermissionsAsync();
}

export async function registerPushToken() {
  if (!EXPO_PROJECT_ID) throw new Error('EXPO_PROJECT_ID fehlt in der mobilen Build-Konfiguration.');
  const permission = await requestNotificationPermission();
  if (!permission.granted) throw new Error('Notification-Permission nicht erteilt.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID })).data;
  const deviceId = await getDeviceId();
  await postJson('/push/register', { deviceId, token, platform: Platform.OS, projectId: EXPO_PROJECT_ID });
  return token;
}

export async function requestServerPushTechnicalTest() {
  const deviceId = await getDeviceId();
  return postJson('/push/test', { deviceId, title: 'Ultreia Server-Push-Test', body: 'Technischer Server-Push-Test.' });
}

export async function showLocalTechnicalNotification() {
  await requestNotificationPermission();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Ultreia lokaler Test', body: 'Lokale Notification technisch ausgelöst.', data: { kind: 'technical_test' } },
    trigger: Platform.OS === 'android' ? { channelId: ATTENTION_CHANNEL, seconds: 1 } : { seconds: 1 },
  });
}
