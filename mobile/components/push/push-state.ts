// stepsmatch/mobile/components/push/push-state.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Random from 'expo-random';
import * as Notifications from 'expo-notifications';
import { RESOLVED_PROJECT_ID } from './push-constants';

const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const DEVICE_ID_ASYNC_KEY  = 'deviceId.v1.mirror';
const GLOBAL_STATE_KEY = 'offerPushState.__global';
const GROUP_STATE_KEY_PR = 'offerGroupState.'; // nur hier verwendet

let CURRENT_EXPO_TOKEN: string | null = null;

export const nowMs = () => Date.now();

function safeKey(k: any): string | null {
  if (typeof k === 'string' && k.length) return k;
  console.warn('[storage] invalid key (undefined/empty) — operation skipped');
  return null;
}

// Device ID
function bytesToUuidV4(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
async function generateUuidV4() {
  const bytes = await Random.getRandomBytesAsync(16);
  return bytesToUuidV4(bytes);
}

export async function getPersistentDeviceId() {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY);
    if (existing) return existing;
  } catch {}
  try {
    const mirror = await AsyncStorage.getItem(DEVICE_ID_ASYNC_KEY);
    if (mirror) {
      try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, mirror); } catch {}
      return mirror;
    }
  } catch {}
  const fresh = await generateUuidV4();
  try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, fresh); } catch {}
  try { await AsyncStorage.setItem(DEVICE_ID_ASYNC_KEY, fresh); } catch {}
  return fresh;
}

// Expo token
export async function resolveExpoTokenAuthoritative() {
  const { data: freshToken } = await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID });
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  if (cached !== freshToken) {
    await AsyncStorage.setItem(TOKEN_KEY, freshToken);
    console.log('[push] token changed -> cache updated');
  }
  CURRENT_EXPO_TOKEN = freshToken;
  return freshToken;
}
export async function getCurrentExpoToken() {
  if (CURRENT_EXPO_TOKEN) return CURRENT_EXPO_TOKEN;
  const cached = await AsyncStorage.getItem(TOKEN_KEY);
  if (cached) {
    CURRENT_EXPO_TOKEN = cached;
    // refresh asynchronously
    resolveExpoTokenAuthoritative().catch(() => {});
    return cached;
  }
  return resolveExpoTokenAuthoritative();
}

// Offer push state
export async function getOfferPushState(offerId: string) {
  const key = safeKey(offerId) ? `offerPushState.${offerId}` : null;
  if (!key) return { inside: false, lastPushedAt: 0 };
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : { inside: false, lastPushedAt: 0 };
  } catch {
    return { inside: false, lastPushedAt: 0 };
  }
}
export async function setOfferPushState(offerId: string, state: any) {
  const key = safeKey(offerId) ? `offerPushState.${offerId}` : null;
  if (!key) return;
  try { await AsyncStorage.setItem(key, JSON.stringify(state || {})); } catch {}
}

// Global state
export async function getGlobalState() {
  try {
    const raw = await AsyncStorage.getItem(GLOBAL_STATE_KEY);
    return raw ? JSON.parse(raw) : { lastAnyPushAt: 0, lastHeartbeatAt: 0 };
  } catch { return { lastAnyPushAt: 0, lastHeartbeatAt: 0 }; }
}
export async function setGlobalState(patch: any) {
  const prev = await getGlobalState();
  const next = { ...prev, ...(patch || {}) };
  try { await AsyncStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// Group state
export function makeGroupIdFromMeta(meta: any) {
  const pid = meta && typeof meta === 'object' ? meta.providerId : null;
  return pid ? `provider:${pid}` : 'misc';
}
export async function getGroupState(groupId: string) {
  const key = safeKey(groupId) ? GROUP_STATE_KEY_PR + groupId : null;
  if (!key) return { lastPushedAt: 0, lastSummaryAt: 0, events: [] };
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : { lastPushedAt: 0, lastSummaryAt: 0, events: [] };
  } catch {
    return { lastPushedAt: 0, lastSummaryAt: 0, events: [] };
  }
}
export async function setGroupState(groupId: string, patch: any) {
  const key = safeKey(groupId) ? GROUP_STATE_KEY_PR + groupId : null;
  if (!key) return;
  const prev = await getGroupState(groupId);
  const next = { ...prev, ...(patch || {}) };
  try { await AsyncStorage.setItem(key, JSON.stringify(next)); } catch {}
  return next;
}

// Offer meta cache
export async function setOfferMeta(offerId: string, meta: any) {
  const key = safeKey(offerId) ? `offerMeta.${offerId}` : null;
  if (!key) return;
  try { await AsyncStorage.setItem(key, JSON.stringify(meta || {})); } catch {}
}
export async function getOfferMeta(offerId: string) {
  const key = safeKey(offerId) ? `offerMeta.${offerId}` : null;
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

