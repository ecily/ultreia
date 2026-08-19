import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { postJson } from './api';

const DEVICE_ID_KEY = 'ultreia.deviceId.v1';

function createDeviceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ultreia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function getDeviceId() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = createDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function registerDevice() {
  const deviceId = await getDeviceId();
  await postJson('/devices/register', { deviceId, platform: Platform.OS, appVersion: '0.1.0' });
  return deviceId;
}

export async function bindDeviceToUser() {
  const deviceId = await getDeviceId();
  await postJson('/devices/register', { deviceId, platform: Platform.OS, appVersion: '0.1.0' });
  return deviceId;
}
