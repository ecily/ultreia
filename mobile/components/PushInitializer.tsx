// stepsmatch/mobile/components/PushInitializer.tsx
import { useEffect, useRef } from 'react';
import { Platform, AppState, NativeModules } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Random from 'expo-random';
import Constants from 'expo-constants';
import { isOfferActiveNow as _isOfferActiveNow } from '../utils/isOfferActiveNow';
import { csvToSet, matchesInterests as _matchesInterests } from '../utils/interests';
import { getServiceState, isServiceActive, isServiceActiveNow, isStoppedUntilRestartNow } from './push/service-control';

// ────────────────────────────────────────────────────────────
// Notification handler
// ────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => {
    const state = AppState.currentState;
    const appOpen = state !== 'background';
    if (appOpen) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Constants (aus app.config.js → extra, mit Fallbacks)
// ────────────────────────────────────────────────────────────
const EXTRA = (Constants as any)?.expoConfig?.extra || {};

/**
 * SANITIZE FIX (Root-Cause):
 * Einige OEMs (insb. MIUI) verweigern FGS-Start, wenn die Channel-ID nicht exakt existiert
 * oder Sonderzeichen/Namensräume (z. B. "com.pkg:channel") enthält.
 * → Kanal-ID vereinheitlichen: einfache, paketlose ID ohne ":".
 */
function sanitizeChannelId(id: any, fallback = 'ultreia-bg-location-task'): string {
  try {
    let s = String(id || '').trim();
    if (!s) return fallback;
    if (s.includes(':')) s = s.split(':').pop() as string; // nur Segment nach ":" behalten
    s = s.replace(/[^a-zA-Z0-9._-]/g, '-');               // harte Zeichenbereinigung
    return s.toLowerCase();
  } catch {
    return fallback;
  }
}

const RAW_FG_CHANNEL_ID: string =
  EXTRA?.fgChannelId || 'com.ecily.mobile:ultreia-bg-location-task';
const FG_CHANNEL_ID: string = sanitizeChannelId(RAW_FG_CHANNEL_ID, 'ultreia-bg-location-task');

const OFFER_CHANNEL_ID: string =
  EXTRA?.offerChannelId || 'offers-v2';
const BG_LOCATION_TASK: string =
  EXTRA?.bgLocationTask || 'ultreia-bg-location-task';
const GEOFENCE_TASK: string =
  EXTRA?.geofenceTask || 'ultreia-geofence-task';
const HEARTBEAT_FETCH_TASK: string =
  EXTRA?.heartbeatFetchTask || 'ultreia-heartbeat-fetch';

const API_BASE: string =
  EXTRA?.apiBase || 'https://api.ultreia.app/api';
const EUROPE_VIENNA = 'Europe/Vienna';

// Geofencing
const MAX_GEOFENCES = 20;
const GEOFENCE_SYNC_INTERVAL_MS = 60 * 1000;
const DEFAULT_RADIUS_M = 120;

// Reconcile/Accuracy
const OUTSIDE_TOLERANCE_M = 5;
const ACCURACY_TOKEN_CAP_M = 20;
const ENTER_SANITY_BUFFER_M = 2;
const BORDERLINE_BAND_M = 20;

// Cooldown/Edge-Burst
const POST_START_ENTER_COOLDOWN_MS = 15_000;
const EDGE_BURST_NEARBY_M = 40;
const BG_DEFAULT_TIME_MS = 30_000;
const BG_DEFAULT_DIST_M = 25;
const BG_BURST_TIME_MS = 6_000;
const BG_BURST_DIST_M = 10;

// Foreground Refresh (Highest)
const FG_REFRESH_MIN_S = 10;
const FG_REFRESH_MAX_S = 15;

// Dynamic heartbeat policy
const SPEED_ACTIVE_MS = 0.5;
const DEEP_IDLE_AFTER_MS = 3 * 60 * 1000;

// Ultreia-style heartbeat hardening
const HB_MIN_GAP_SECONDS = 55;
const BG_DISTANCE_METERS = 25;
const BOOSTER_MIN_GAP_SECONDS = 45;
const BOOSTER_MOVE_METERS = 60;

// ⏱️ Auto-Refresh der Geofences ohne manuelle Aktion:
const GEOFENCE_REEVAL_DIST_M = 200;
const GEOFENCE_REEVAL_MAX_AGE_MS = 10 * 60 * 1000;
const EMPTY_REGION_GRACE_MS = 10 * 60 * 1000;

let geofenceStartedAt = 0 as number;

// Storage Keys
const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const DEVICE_ID_ASYNC_KEY = 'deviceId.v1.mirror';

// Global-State
const GLOBAL_STATE_KEY = 'offerPushState.__global';

const RESOLVED_PROJECT_ID =
  EXTRA?.eas?.projectId ||
  (Constants as any)?.easConfig?.projectId ||
  '08559a29-b307-47e9-a130-d3b31f73b4ed';

// UI / Channels
const BRAND_BLUE = '#0d4ea6';
const STRONG_PATTERN = [0, 450, 180, 900, 300, 1200];

// FGS-Text exakt wie im Manifest (für ADB-Grep & MIUI)
const FGS_NOTIFICATION_TITLE = 'Ultreia ist aktiv';
const FGS_NOTIFICATION_BODY  = 'Standortaktualisierung läuft';

// Laufzeit-Cache
let CURRENT_REGIONS: { identifier: string; latitude: number; longitude: number; radius: number }[] = [];
let LAST_REGION_HASH = '';
let lastGeofenceSyncAt = 0;
let lastNonEmptyRegionsAt = 0;

// Interessen-Cache
let INTEREST_SET_CACHE: Set<string> | null = null;
let INTERESTS_LAST_LOAD_AT = 0;
const INTERESTS_TTL_MS = 60 * 1000;

// BG mode switching
type BgMode = 'default' | 'burst';
let CURRENT_BG_MODE: BgMode = 'default';
let LAST_BG_MODE_CHANGE_AT = 0;

// Self-Heal
const LAST_TOKEN_REFRESH_AT_KEY = 'push.lastTokenRefreshAt';
const TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
let SELF_HEAL_IN_FLIGHT = false;
let LAST_BG_REARM_AT = 0;
let BG_REARM_IN_FLIGHT = false;
const BG_REARM_MIN_GAP_MS = 15000;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
let CHANNELS_READY_ONCE = false;

const jitter = (minS: number, maxS: number) =>
  Math.floor(minS * 1000 + Math.random() * (maxS - minS) * 1000);

function toRad(d: number) { return (d * Math.PI) / 180; }
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function nowMs() { return Date.now(); }

function logErr(tag: string, e: any, ctx?: any) {
  const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
  console.log(`[${tag}]`, ctx ? JSON.stringify(ctx) : '', msg);
}
async function dumpChannelsOnce(tag = 'CHANNELS') {
  if (Platform.OS !== 'android') return;
  try {
    const list = await Notifications.getNotificationChannelsAsync?.();
    const brief = (list || []).map(c => `${c.id}:${c.importance}:${(c as any)?.sound ?? 'none'}`);
    console.log(`[${tag}]`, brief.join(' | '));
    const fg = (list || []).find(c => c.id === FG_CHANNEL_ID);
    if (!fg) console.log(`[${tag}] WARN no FG channel`, FG_CHANNEL_ID);
  } catch (e) {
    logErr(`${tag}`, e);
  }
}

// Channel/FGS-Assertions + Fused-Priming
async function assertFgChannelBound() {
  if (Platform.OS !== 'android') return;
  try {
    const list = await Notifications.getNotificationChannelsAsync?.();
    const fg = (list || []).find(c => c.id === FG_CHANNEL_ID);
    if (!fg) {
      console.log('[CHANNELS] MISSING_FG_CHANNEL', FG_CHANNEL_ID, '(raw was:', RAW_FG_CHANNEL_ID, ')');
    } else {
      console.log('[CHANNELS] FG_CHANNEL_OK', FG_CHANNEL_ID, 'importance=', (fg as any)?.importance);
    }
  } catch (e) {
    logErr('CHANNELS:assert', e);
  }
}

// „Priming“: kurzer High-Accuracy-Fix → fused provider geht auf ON
async function primeFusedProviderOnce() {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeout: 3500,
      mayShowUserSettingsDialog: false,
    } as any);
    if (fix?.coords) {
      lastKnownLocRef.current = {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
      };
      console.log('[BGLOC] primed fused provider with one-shot fix');
    }
  } catch {
    // best effort
  }
}

// Activity refs
const lastSpeedRef: { current: number } = { current: 0 };
const lastMoveAtRef: { current: number } = { current: 0 };
const appStateRef: { current: string } = { current: AppState.currentState || 'active' };
const lastKnownLocRef: { current: { latitude: number; longitude: number; accuracy?: number } | null } = { current: null };

function heartbeatWindowSeconds(): number {
  const speed = lastSpeedRef.current || 0;
  const now = nowMs();
  const sinceMove = now - (lastMoveAtRef.current || 0);
  const foreground = appStateRef.current === 'active';
  if (foreground || speed >= SPEED_ACTIVE_MS) return Math.floor(Math.random() * 6) + 10;
  if (sinceMove > DEEP_IDLE_AFTER_MS) return 45;
  return 30;
}

function bytesToUuidV4(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
async function generateUuidV4() {
  const bytes = await Random.getRandomBytesAsync(16);
  return bytesToUuidV4(bytes);
}
async function getPersistentDeviceId() {
  try { const s = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY); if (s) return s; } catch {}
  try { const m = await AsyncStorage.getItem(DEVICE_ID_ASYNC_KEY); if (m) return m; } catch {}
  const nid = await generateUuidV4();
  try { await SecureStore.setItemAsync(DEVICE_ID_SECURE_KEY, nid); } catch {}
  try { await AsyncStorage.setItem(DEVICE_ID_ASYNC_KEY, nid); } catch {}
  return nid;
}

const NativeHeartbeatConfig = (NativeModules as any)?.NativeHeartbeatConfig;
async function syncNativeHeartbeatConfig(reason: string, tokenOverride?: string | null, enabled = true) {
  try {
    if (!NativeHeartbeatConfig?.syncConfig) return;
    const deviceId = await getPersistentDeviceId();
    const token = enabled
      ? (tokenOverride ?? (await getCurrentExpoToken()))
      : (tokenOverride ?? (await AsyncStorage.getItem(TOKEN_KEY)));
    const projectId = RESOLVED_PROJECT_ID || null;
    NativeHeartbeatConfig.syncConfig(API_BASE, token || null, deviceId, projectId, !!enabled);
    diagLog('native.sync', { reason, enabled: !!enabled, hasToken: !!token, hasDeviceId: !!deviceId }, 'info', 5000);
  } catch {}
}

// Lightweight client diag logger (writes to backend Mongo)
const diagLastAt: Record<string, number> = {};
async function diagLog(
  event: string,
  data: Record<string, any> = {},
  level: 'info' | 'warn' | 'error' = 'info',
  minGapMs = 4000
) {
  try {
    const now = Date.now();
    const key = `${event}`;
    if (diagLastAt[key] && now - diagLastAt[key] < minGapMs) return;
    diagLastAt[key] = now;
    const deviceId = await getPersistentDeviceId();
    fetch(`${API_BASE}/diag/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        platform: Platform.OS,
        event,
        level,
        data: { ...data, t: now, appState: appStateRef?.current || undefined },
      }),
    }).catch(() => {});
  } catch {}
}

async function fetchOfferForInterests(offerId: string) {
  try {
    const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (!res.ok) return null;
    return (await res.json()) || null;
  } catch { return null; }
}

// Offer Push State
async function getOfferPushState(offerId: string) {
  try {
    const raw = await AsyncStorage.getItem(`offerPushState.${offerId}`);
    return raw ? JSON.parse(raw) : { inside: false, lastPushedAt: 0 };
  } catch { return { inside: false, lastPushedAt: 0 }; }
}
async function setOfferPushState(offerId: string, state: any) {
  try { await AsyncStorage.setItem(`offerPushState.${offerId}`, JSON.stringify(state)); } catch {}
}

// Global-State
async function getGlobalState() {
  try {
    const raw = await AsyncStorage.getItem(GLOBAL_STATE_KEY);
    return raw ? JSON.parse(raw) : { lastAnyPushAt: 0, lastHeartbeatAt: 0 };
  } catch { return { lastAnyPushAt: 0, lastHeartbeatAt: 0 }; }
}
async function setGlobalState(patch: any) {
  const prev = await getGlobalState();
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// Interest helpers
async function readInterestsForBackend(): Promise<string[]> {
  try {
    const now = Date.now();
    if (INTEREST_SET_CACHE && now - INTERESTS_LAST_LOAD_AT < INTERESTS_TTL_MS) {
      return Array.from(INTEREST_SET_CACHE);
    }

    const [rawCsv, rawJson] = await Promise.all([
      AsyncStorage.getItem('userInterests.csv'),
      AsyncStorage.getItem('userInterests'),
    ]);

    const set = new Set<string>(csvToSet(rawCsv || ''));
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const normalized = csvToSet(String(item || ''));
            for (const token of normalized) set.add(token);
          }
        } else if (typeof parsed === 'string') {
          for (const token of csvToSet(parsed)) set.add(token);
        }
      } catch {
        for (const token of csvToSet(rawJson)) set.add(token);
      }
    }

    INTEREST_SET_CACHE = set;
    INTERESTS_LAST_LOAD_AT = now;
    return Array.from(set);
  } catch {
    return [];
  }
}

async function getInterestSet(): Promise<Set<string>> {
  try {
    return new Set(await readInterestsForBackend());
  } catch {
    return new Set();
  }
}

// IDs & Regions
function parseOfferIdFromIdentifier(identifier = '') {
  const m = String(identifier).match(/^offer:([a-f0-9]{24})$/i);
  return m ? m[1] : null;
}
async function pruneObsoleteOfferStates(validIdentifiers: string[]) {
  try {
    const validIds = new Set((validIdentifiers || []).map(parseOfferIdFromIdentifier).filter(Boolean));
    const keys = await AsyncStorage.getAllKeys();
    const offerStateKeys = (keys || []).filter((k) => k.startsWith('offerPushState.'));
    const ops: Promise<any>[] = [];
    for (const key of offerStateKeys) {
      const offerId = key.slice('offerPushState.'.length);
      if (!validIds.has(offerId)) {
        ops.push(AsyncStorage.setItem(key, JSON.stringify({ inside: false, lastPushedAt: 0 })));
      }
    }
    if (ops.length) await Promise.allSettled(ops as any);
  } catch {}
}

// ────────────────────────────────────────────────────────────
// Accuracy helpers
// ────────────────────────────────────────────────────────────
const MIN_GOOD_ACCURACY_M = 25;
const FRESH_FIX_TIMEOUT_MS = 4000;

async function getFreshBestFixOrNull(timeoutMs = FRESH_FIX_TIMEOUT_MS) {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeout: timeoutMs,
    } as any);
    return fix || null;
  } catch { return null; }
}

async function ensureGoodAccuracyCoords(base: { latitude: number; longitude: number; accuracy?: number } | null) {
  try {
    if (!base || !Number.isFinite(base.latitude) || !Number.isFinite(base.longitude)) return null;
    const acc = Number.isFinite(base.accuracy as any) ? Number(base.accuracy) : 9999;
    if (acc <= MIN_GOOD_ACCURACY_M) return base;
    const fresh = await getFreshBestFixOrNull();
    if (fresh?.coords?.latitude && fresh?.coords?.longitude) {
      return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude, accuracy: fresh.coords.accuracy };
    }
  } catch {}
  return null;
}

// ────────────────────────────────────────────────────────────
// Safer activity check
// ────────────────────────────────────────────────────────────
function endOfLocalDayIso(fromIso: string) {
  const d = new Date(fromIso);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
function isOfferActiveNowSafe(offer: any, tz = EUROPE_VIENNA): boolean {
  try {
    if (typeof _isOfferActiveNow === 'function' && _isOfferActiveNow(offer, tz)) return true;
    const vd = offer?.validDates;
    if (!vd?.from || !vd?.to) return false;
    const fromT = new Date(vd.from).getTime();
    const toT = new Date(vd.to).getTime();
    const almostSame = Math.abs(toT - fromT) < 60 * 1000;
    if (almostSame && typeof _isOfferActiveNow === 'function') {
      const patched = { ...offer, validDates: { ...vd, to: endOfLocalDayIso(vd.from) } };
      return _isOfferActiveNow(patched, tz);
    }
    return false;
  } catch { return true; }
}

// ────────────────────────────────────────────────────────────
// Notification Channels & Categories
// ────────────────────────────────────────────────────────────
async function ensureChannels() {
  if (CHANNELS_READY_ONCE) return;
  try {
    await Notifications.setNotificationChannelAsync('ultreia-default-v2', {
      name: 'Ultreia – Benachrichtigungen',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default' as any,
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      description: 'Allgemeine Benachrichtigungen von Ultreia',
    } as any);

    // Offers (primary)
    await Notifications.setNotificationChannelAsync(OFFER_CHANNEL_ID, {
      name: 'Offers',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'arrival' as any,
      vibrationPattern: STRONG_PATTERN,
      enableVibrate: true as any,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true as any,
      lightColor: BRAND_BLUE as any,
      showBadge: true,
      description: 'Sofort-Push bei passenden Angeboten in deiner Nähe',
    } as any);

    // Optionaler Legacy-Alias
    try {
      await Notifications.setNotificationChannelAsync('offers', {
        name: 'Offers (Legacy)',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'arrival' as any,
        vibrationPattern: STRONG_PATTERN,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        description: 'Kompatibler Offer-Kanal',
      } as any);
    } catch {}

    // Foreground service channel – FIX: stets die SANITIZED ID ohne ":" anlegen
    await Notifications.setNotificationChannelAsync(FG_CHANNEL_ID, {
      name: 'Ultreia – Standort aktiv',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null as any,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
      description: 'Hintergrunddienst zur Standortaktualisierung',
    } as any);

    await Notifications.setNotificationCategoryAsync('offer-go-v2', [
      { identifier: 'go', buttonTitle: 'GO', options: { opensAppToForeground: true } },
      { identifier: 'later', buttonTitle: 'SPÄTER', options: { isDestructive: false } },
      { identifier: 'no', buttonTitle: 'KEIN INTERESSE', options: { isDestructive: true } },
    ] as any);

    CHANNELS_READY_ONCE = true;
    console.log('[CHANNELS] fgId(sanitized)=', FG_CHANNEL_ID, 'raw=', RAW_FG_CHANNEL_ID);
    await dumpChannelsOnce();
  } catch (e: any) {
    console.warn('[CHANNELS] ensureChannels failed:', e?.message || e);
  }
}

// ────────────────────────────────────────────────────────────
// Permissions & Token Gating
// ────────────────────────────────────────────────────────────
async function hasLocationPermissions(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    if (Platform.OS === 'android') return fg.status === 'granted' && bg.status === 'granted';
    return fg.status === 'granted';
  } catch { return false; }
}
async function hasNotificationPermissions(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    const iosProv = (p as any)?.ios?.status === 'provisional';
    return !!(p.granted || iosProv);
  } catch { return false; }
}

let CURRENT_EXPO_TOKEN: string | null = null;
let REGISTERED_READY = false;

function looksLikeInvalidToken(res: Response | null, body: any): boolean {
  try {
    const status = res?.status ?? 0;
    const msg = String((body && (body.error || body.message || body.reason)) || '').toLowerCase();
    if (status === 410 || status === 409 || status === 422) return true;
    if (msg.includes('notregistered') || (msg.includes('device') && msg.includes('not') && msg.includes('registered'))) return true;
    if (msg.includes('invalid') && msg.includes('token')) return true;
    if (body && (body.needsTokenRefresh === true || body.refreshToken === true)) return true;
  } catch {}
  return false;
}

async function maybePeriodicTokenRefresh(reason: string) {
  try {
    const notifOk = await hasNotificationPermissions();
    if (!notifOk) return;

    const last = Number(await AsyncStorage.getItem(LAST_TOKEN_REFRESH_AT_KEY) || 0);
    const now = nowMs();
    if (!last || now - last >= TOKEN_REFRESH_INTERVAL_MS) {
      console.log('[push] periodic token refresh →', reason);
      await resolveExpoTokenAuthoritative();
      await registerTokenAtBackend(`periodic-refresh:${reason}`);
      await AsyncStorage.setItem(LAST_TOKEN_REFRESH_AT_KEY, String(now));
    }
  } catch (e) {
    logErr('push:periodic-refresh', e);
  }
}

async function selfHealTokenFlow(trigger: string) {
  if (SELF_HEAL_IN_FLIGHT) { console.log('[push] self-heal skip (in-flight)'); return; }
  SELF_HEAL_IN_FLIGHT = true;
  try {
    const notifOk = await hasNotificationPermissions();
    if (!notifOk) { console.log('[push] self-heal skipped (no notif permission)'); return; }

    console.log('[push] self-heal start →', trigger);
    await resolveExpoTokenAuthoritative();
    await registerTokenAtBackend(`self-heal:${trigger}`);
    await AsyncStorage.setItem(LAST_TOKEN_REFRESH_AT_KEY, String(nowMs()));
    console.log('[push] self-heal done');
  } catch (e) {
    logErr('push:self-heal', e, { trigger });
  } finally {
    SELF_HEAL_IN_FLIGHT = false;
  }
}

async function resolveExpoTokenAuthoritative(): Promise<string | null> {
  try {
    const notifOk = await hasNotificationPermissions();
    if (!notifOk) {
      console.log('[push] resolve token skipped (no notif permission)');
      const cached = await AsyncStorage.getItem(TOKEN_KEY);
      CURRENT_EXPO_TOKEN = cached || null;
      return CURRENT_EXPO_TOKEN;
    }

    console.log('[push] meta projectId',
      (Constants as any)?.expoConfig?.extra?.eas?.projectId,
      (Constants as any)?.easConfig?.projectId
    );
    const { data: freshToken } = await Notifications.getExpoPushTokenAsync({ projectId: RESOLVED_PROJECT_ID });
    const cached = await AsyncStorage.getItem(TOKEN_KEY);
    if (cached !== freshToken) {
      await AsyncStorage.setItem(TOKEN_KEY, freshToken);
      console.log('[push] token changed -> cache updated]');
    }
    CURRENT_EXPO_TOKEN = freshToken;
    await syncNativeHeartbeatConfig('resolve-token', freshToken);
    return freshToken;
  } catch (e) {
    logErr('push:resolveToken', e);
    return null;
  }
}

async function getCurrentExpoToken(): Promise<string | null> {
  if (CURRENT_EXPO_TOKEN) return CURRENT_EXPO_TOKEN;
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  if (t) { CURRENT_EXPO_TOKEN = t; return t; }
  return await resolveExpoTokenAuthoritative();
}

async function registerTokenAtBackend(reason: string) {
  try {
    const token = await getCurrentExpoToken();
    if (!token) {
      console.log('[push] register skipped (no token/permission) →', reason);
      diagLog('push.register.skip', { reason }, 'warn', 2000);
      REGISTERED_READY = false;
      return;
    }
    await syncNativeHeartbeatConfig(`register:${reason}`, token);
    const deviceId = await getPersistentDeviceId();
    const interests = await readInterestsForBackend();
    const res = await fetch(`${API_BASE}/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        deviceId,
        projectId: RESOLVED_PROJECT_ID,
        platform: Platform.OS,
        reason,
        interests,
        serviceEnabled: true,
      }),
    });
    let json: any = {};
    try { json = await res.json(); } catch { json = {}; }

    console.log('[push] register =>', res.status);
    diagLog('push.register', { reason, ok: res.ok, status: res.status }, res.ok ? 'info' : 'warn', 1000);
    REGISTERED_READY = res.ok;

    if (!res.ok && looksLikeInvalidToken(res, json)) {
      console.log('[push] register detected invalid token → self-heal');
      await selfHealTokenFlow('register');
      return;
    }

    // BG & Geofence möglichst direkt "wärmen"
    if (res.ok) {
      try {
        const permsOk = await hasLocationPermissions();
        if (permsOk) {
          await guardedBgRearm('token-register');
          await refreshGeofencesAroundUser(true);
        } else {
          console.log('[init] BG not started (missing background location).');
        }
      } catch (e: any) {
        console.warn('[BGLOC] auto-start or geofence-sync after register failed', String(e));
      }
    }
  } catch (e: any) {
    console.warn('[push] register error', String(e));
    diagLog('push.register.error', { reason, error: String(e?.message || e) }, 'error', 1000);
  }
}

// ────────────────────────────────────────────────────────────
// Local-first Geofencing
// ────────────────────────────────────────────────────────────
async function fetchCandidateOffers() {
  try {
    const res = await fetch(
      `${API_BASE}/offers?withProvider=1&fields=_id,title,name,location,provider,radius,validTimes,validDays,validDates`,
      { method: 'GET' }
    );
    const json = await res.json();
    if (!res.ok) {
      console.log('[geofence] fetch offers error', res.status, JSON.stringify(json));
      return [];
    }
    const list = Array.isArray(json) ? json : json?.data || [];
    return list || [];
  } catch (e: any) {
    console.log('[geofence] fetch offers exception', String(e));
    return [];
  }
}

function pickOfferPoint(offer: any): { lat: number; lng: number } | null {
  try {
    const p = offer?.location?.coordinates || offer?.location?.coordinates?.coordinates;
    const lng = Array.isArray(p) ? Number(p[0]) : NaN;
    const lat = Array.isArray(p) ? Number(p[1]) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {}
  return null;
}
function offerRadius(offer: any) {
  const r = Number(offer?.radius);
  return Number.isFinite(r) ? Math.max(30, Math.min(500, r)) : DEFAULT_RADIUS_M;
}

type EnterReport = { offerId: string; lat: number; lng: number; accuracy: number | null };
async function reportEnterToBackend(p: EnterReport) {
  try {
    const token = await getCurrentExpoToken();
    await fetch(`${API_BASE}/location/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        projectId: RESOLVED_PROJECT_ID,
        offerId: p.offerId,
        deviceId: await getPersistentDeviceId(),
        token: token || undefined,
        platform: Platform.OS,
      }),
    });
  } catch {}
}

let GEOFENCE_REFRESH_IN_FLIGHT = false;

function hashRegions(regs: typeof CURRENT_REGIONS) {
  try { return JSON.stringify(regs.map((r) => [r.identifier, r.latitude, r.longitude, r.radius])); }
  catch { return ''; }
}

// ────────────────────────────────────────────────────────────
// Notification helpers & unified de-dupe
// ────────────────────────────────────────────────────────────
async function fetchProviderDetails(offerId: string) {
  try {
    const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (!res.ok) return {};
    const offer = await res.json();
    const providerName = offer?.provider?.name || undefined;
    const address =
      offer?.provider?.address?.formatted ||
      [offer?.provider?.address?.street, offer?.provider?.address?.city].filter(Boolean).join(', ') ||
      offer?.provider?.address ||
      undefined;
    const title = offer?.title || offer?.name;
    return { providerName, address, title };
  } catch { return {}; }
}

async function safePresentNotification(content: Notifications.NotificationContentInput) {
  try {
    const sched = (Notifications as any)?.scheduleNotificationAsync;
    const present = (Notifications as any)?.presentNotificationAsync;
    if (typeof sched === 'function') { await sched({ content, trigger: null }); return; }
    if (typeof present === 'function') { await present(content); return; }
    console.log('[LOCAL_PUSH] no presenter available');
  } catch (e: any) {
    console.log('[LOCAL_PUSH] present error', String(e?.message || e));
  }
}

const GROUP_SUMMARY_ENABLED = false;
const SUMMARY_WINDOW_MS = 5 * 60 * 1000;
const GROUP_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function makeGroupIdFromMeta(meta: any) {
  const pid = meta?.providerName || 'nearby';
  return `provider:${pid}`.toLowerCase();
}
async function getGroupState(groupId: string) {
  try {
    const raw = await AsyncStorage.getItem(`groupState.${groupId}`);
    return raw ? JSON.parse(raw) : { lastPushedAt: 0, events: [] };
  } catch { return { lastPushedAt: 0, events: [] }; }
}
async function setGroupState(groupId: string, patch: any) {
  const prev = await getGroupState(groupId);
  const next = { ...prev, ...patch };
  try { await AsyncStorage.setItem(`groupState.${groupId}`, JSON.stringify(next)); } catch {}
}

async function presentLocalOfferNotification(
  offerId: string,
  meta?: { providerName?: string; address?: string; title?: string },
  source: 'ENTER' | 'synthetic-enter' = 'ENTER'
) {
  try {
    const { providerName, address, title } = meta || (await fetchProviderDetails(offerId)) || {};
    const header = [title || 'Angebot in deiner Nähe', '', [providerName, address].filter(Boolean).join(' – ')].filter(Boolean);
    const body = header.length >= 3 ? `${header[2]}` : providerName || address || 'Jetzt ansehen';

    const groupId = makeGroupIdFromMeta(meta);
    const now = nowMs();
    const gs = await getGroupState(groupId);
    const underCooldown = gs.lastPushedAt && now - gs.lastPushedAt < GROUP_COOLDOWN_MS;

    const pruned = (gs.events || []).filter((t: number) => now - t <= SUMMARY_WINDOW_MS);
    pruned.push(now);

    try {
      const _setBadge = (Notifications as any)?.setBadgeCountAsync;
      if (typeof _setBadge === 'function') await _setBadge(0);
    } catch {}

    await safePresentNotification({
      title: header[0],
      body,
      data: { offerId, source, t: now } as any,
      sound: true as any,
      categoryIdentifier: 'offer-go-v2',
      channelId: OFFER_CHANNEL_ID,
    });

    await setGroupState(groupId, { lastPushedAt: underCooldown ? gs.lastPushedAt : now, events: pruned });

    if (GROUP_SUMMARY_ENABLED && pruned.length >= 2 && !underCooldown) {
      const titleG = providerName ? `${providerName}: ${pruned.length} Angebote in deiner Nähe` : `${pruned.length} Angebote in deiner Nähe`;
      await safePresentNotification({
        title: titleG,
        body: 'Tippe, um alle zu sehen.',
        data: { groupId, kind: 'group-summary' } as any,
        channelId: OFFER_CHANNEL_ID,
      } as any);
    }
  } catch (e: any) {
    logErr('LOCAL_PUSH', e);
  }
}

// De-dupe
const DEDUPE_WINDOW_MS = 60_000;
let PUSH_LOCKS = new Set<string>();
function acquirePushLock(key: string) {
  if (PUSH_LOCKS.has(key)) return false;
  PUSH_LOCKS.add(key);
  setTimeout(() => { try { PUSH_LOCKS.delete(key); } catch {} }, 3000);
  return true;
}
async function pushOfferOnce(
  offerId: string,
  meta?: { providerName?: string; address?: string; title?: string },
  source: 'ENTER' | 'synthetic-enter' = 'ENTER'
): Promise<boolean> {
  try {
    const st = await getOfferPushState(offerId);
    const now = nowMs();
    if (st.lastPushedAt && now - st.lastPushedAt < DEDUPE_WINDOW_MS) {
      console.log('[LOCAL_PUSH] dedupe-window skip', offerId);
      await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt });
      return false;
    }
    if (!acquirePushLock(offerId)) {
      console.log('[LOCAL_PUSH] lock skip', offerId);
      await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
      return false;
    }

    await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
    await presentLocalOfferNotification(offerId, meta, source);
    await setGlobalState({ lastAnyPushAt: now });
    return true;
  } catch (e) {
    logErr('LOCAL_PUSH:pushOfferOnce', e);
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// Geofence refresh
// ────────────────────────────────────────────────────────────
export async function refreshGeofencesAroundUser(force = false) {
  if (GEOFENCE_REFRESH_IN_FLIGHT) return;
  GEOFENCE_REFRESH_IN_FLIGHT = true;
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (Platform.OS === 'android' && bg.status !== 'granted') {
      console.log('[geofence] skip sync (no BG permission)');
      return;
    }

    const now = nowMs();
    if (!force && now - lastGeofenceSyncAt < GEOFENCE_SYNC_INTERVAL_MS) return;

    let loc = await Location.getLastKnownPositionAsync({});
    if (!loc?.coords) {
      const fresh = await getFreshBestFixOrNull();
      if (fresh?.coords) loc = fresh;
    }
    if (!loc?.coords) {
      console.log('[geofence] skip sync (no position)');
      return;
    }
    const { latitude, longitude } = loc.coords;
    lastKnownLocRef.current = { latitude, longitude, accuracy: loc.coords.accuracy };

    const offers = await fetchCandidateOffers();
    const activeNearby: { offer: any; p: { lat: number; lng: number }; dist: number }[] = [];
    for (const offer of offers) {
      try {
        if (!isOfferActiveNowSafe(offer, EUROPE_VIENNA)) continue;
        const p = pickOfferPoint(offer);
        if (!p) continue;
        const dist = haversineMeters(latitude, longitude, p.lat, p.lng);
        if (dist <= 2000) activeNearby.push({ offer, p, dist });
      } catch {}
    }
    activeNearby.sort((a, b) => a.dist - b.dist);
    const top = activeNearby.slice(0, MAX_GEOFENCES);

    const regions = top.map(({ offer, p }) => {
      const r = offerRadius(offer);
      const identifier = `offer:${offer._id}`;
      setOfferMeta(offer._id, {
        providerName: offer?.provider?.name,
        address: offer?.provider?.address?.formatted,
        title: offer?.title || offer?.name,
      }).catch(() => {});
      return { identifier, latitude: p.lat, longitude: p.lng, radius: r };
    });

    const newHash = hashRegions(regions as any);
    const changed = newHash !== LAST_REGION_HASH;

    if (regions.length === 0) {
      if (CURRENT_REGIONS.length > 0) {
        const age = now - (lastNonEmptyRegionsAt || 0);
        if (age <= EMPTY_REGION_GRACE_MS) {
          console.log('[geofence] empty result → keep previous regions (grace active, age=', age, 'ms)');
          lastGeofenceSyncAt = now;
          return;
        }
      }
      const wasRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false as any);
      if (wasRunning) {
        try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
      }
      CURRENT_REGIONS = [];
      LAST_REGION_HASH = newHash;
      geofenceStartedAt = 0;
      lastGeofenceSyncAt = now;
      try { await pruneObsoleteOfferStates([]); } catch {}
      console.log('[geofence] no regions nearby → stopped/idle');
      return;
    }

    if (changed) {
      const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (started) { try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {} }
      try {
        await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
      } catch (e: any) {
        console.log('[geofence] start failed once, retrying...', String(e?.message || e));
        await new Promise((r) => setTimeout(r, 250));
        await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
      }
      geofenceStartedAt = nowMs();
      CURRENT_REGIONS = regions.slice();
      LAST_REGION_HASH = newHash;
      lastNonEmptyRegionsAt = now;
      console.log('[geofence] started with', regions.length, 'regions');
    } else {
      console.log('[geofence] regions unchanged → no restart');
      if (regions.length > 0) lastNonEmptyRegionsAt = now;
    }

    lastGeofenceSyncAt = now;
    try { await pruneObsoleteOfferStates(regions.map((r) => r.identifier)); } catch {}
    await markAlreadyInsideQuietly();
  } catch (e: any) {
    logErr('geofence:refresh', e);
  } finally {
    GEOFENCE_REFRESH_IN_FLIGHT = false;
  }
}

// ────────────────────────────────────────────────────────────
let lastHeartbeatAt = 0;
let lastSentCoords: { latitude: number; longitude: number } | null = null;
let lastBoosterAtMs: number | null = null;
let lastCoordsForBooster: { latitude: number; longitude: number } | null = null;

// Single-flight HB (verhindert Doppel-Trigger)
let hbInFlight: Promise<any> | null = null;
let hbInFlightMeta: { reason: string; startedAtMs: number } | null = null;

const FORCE_HB_REASONS = new Set(['manual', 'init', 'watchdog', 'fetch-watchdog', 'after-bg-start', 'fg-refresh', 'bg-boost']);

function isForceReason(reason?: string) {
  return FORCE_HB_REASONS.has(String(reason || ''));
}

function shouldSkipHeartbeat({
  reason,
  latitude,
  longitude,
}: {
  reason?: string;
  latitude?: number;
  longitude?: number;
}) {
  const now = Date.now();
  const ageSec = lastHeartbeatAt ? Math.floor((now - lastHeartbeatAt) / 1000) : null;

  if (isForceReason(reason)) return { skip: false, why: 'force' };

  if (ageSec != null && ageSec < HB_MIN_GAP_SECONDS) {
    if (lastSentCoords && latitude != null && longitude != null) {
      const movedM = haversineMeters(
        lastSentCoords.latitude,
        lastSentCoords.longitude,
        latitude,
        longitude
      );
      if (movedM >= BG_DISTANCE_METERS) return { skip: false, why: `moved:${Math.round(movedM)}m` };
      return { skip: true, why: `dedupe:${ageSec}s moved:${Math.round(movedM)}m` };
    }
    return { skip: true, why: `dedupe:${ageSec}s` };
  }

  return { skip: false, why: 'gap-ok' };
}

async function sendHeartbeatSingleFlight(arg: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  reason?: string;
}) {
  const r = String(arg.reason || 'unknown');
  if (hbInFlight) {
    if (isForceReason(r)) {
      console.log(`[HB] join in-flight reason=${r} inFlightReason=${hbInFlightMeta?.reason || 'n/a'}`);
      return hbInFlight;
    }
    console.log(`[HB] skip reason=${r} why=in-flight inFlightReason=${hbInFlightMeta?.reason || 'n/a'}`);
    return { skipped: true, why: 'in-flight', inFlightReason: hbInFlightMeta?.reason || null };
  }

  hbInFlightMeta = { reason: r, startedAtMs: Date.now() };
  const p = (async () => {
    try {
      return await _sendHeartbeatWithCoords({ ...arg, reason: r });
    } finally {
      if (hbInFlight === p) {
        hbInFlight = null;
        hbInFlightMeta = null;
      }
    }
  })();

  hbInFlight = p;
  return p;
}

async function _sendHeartbeatWithCoords({
  latitude, longitude, accuracy, reason = 'timer',
}: { latitude: number; longitude: number; accuracy?: number; reason?: string; }) {
  try {
    if (!(await isServiceActiveNow())) {
      console.log('[HB] skip (service inactive)');
      return;
    }
    const prev = lastKnownLocRef.current;
    const moved = prev ? haversineMeters(prev.latitude, prev.longitude, latitude, longitude) : 0;
    lastKnownLocRef.current = { latitude, longitude, accuracy };

    const now = nowMs();
    if (moved >= GEOFENCE_REEVAL_DIST_M || now - (lastGeofenceSyncAt || 0) > GEOFENCE_REEVAL_MAX_AGE_MS) {
      console.log('[geofence] auto-refresh trigger', { moved: Math.round(moved), ageMs: now - (lastGeofenceSyncAt || 0) });
      await refreshGeofencesAroundUser(true);
    }

    await reconcileInsideFlagsWithPosition({ latitude, longitude, accuracy });

    const accVal = typeof accuracy === 'number' ? accuracy : undefined;

    const token = await getCurrentExpoToken();
    if (!token) {
      console.log('[HB] skipped (no token)');
      diagLog('hb.skip.no_token', { reason }, 'warn', 5000);
      return;
    }

    const dec = shouldSkipHeartbeat({ reason, latitude, longitude });
    if (dec.skip) {
      console.log(`[HB] skip reason=${reason} why=${dec.why}`);
      return;
    }

    const minWindowS = heartbeatWindowSeconds();
    if (now - lastHeartbeatAt >= minWindowS * 1000 || isForceReason(reason)) {
      lastHeartbeatAt = now;
      try {
        const deviceId = await getPersistentDeviceId();
        const interests = await readInterestsForBackend();
        diagLog('hb.send', { reason, lat: latitude, lng: longitude, acc: accVal, appState: appStateRef.current }, 'info', 1000);
        const res = await fetch(`${API_BASE}/location/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token || undefined, deviceId, lat: latitude, lng: longitude, accuracy: accVal,
            platform: Platform.OS, projectId: RESOLVED_PROJECT_ID, reason, appState: appStateRef.current,
            interests,
          }),
        });
        let json: any = {};
        try { json = await res.json(); } catch { json = {}; }

        diagLog('hb.res', { reason, ok: res.ok, status: res.status }, res.ok ? 'info' : 'warn', 1000);
        console.log('[HEARTBEAT] ok', {
          status: res.status, acc: Math.round(accVal ?? 0), reason, windowS: minWindowS, appState: appStateRef.current,
        });
        try {
          await setGlobalState({ lastHeartbeatAt: now });
        } catch {}

        if (res.ok && !REGISTERED_READY) REGISTERED_READY = true;

        if (looksLikeInvalidToken(res, json)) {
          console.log('[push] heartbeat signalled token refresh ? self-heal');
          await selfHealTokenFlow('heartbeat');
        }

        const geos = (json as any)?.geofences;
        if (Array.isArray(geos) && geos.length) await refreshGeofencesAroundUser(true);

        lastSentCoords = { latitude, longitude };
      } catch (e: any) {
        logErr('HEARTBEAT', e);
        diagLog('hb.error', { reason, error: String(e?.message || e) }, 'error', 1000);
      }
    }
  } catch (e: any) {
    logErr('HEARTBEAT:wrapper', e);
  }
}

export async function sendHeartbeatOnce() {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 4000 } as any);
    if (pos?.coords) {
      await sendHeartbeatSingleFlight({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
        reason: 'manual',
      });
    }
  } catch (e: any) {
    logErr('BGLOC:sendHeartbeat', e);
  }
}

// Reconcile & Already-inside
async function reconcileInsideFlagsWithPosition({
  latitude, longitude, accuracy,
}: { latitude: number; longitude: number; accuracy?: number; }) {
  try {
    if (!CURRENT_REGIONS?.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const rawAcc = Number.isFinite(accuracy as any) ? Number(accuracy) : 20;
    const accAdj = Math.min(rawAcc * 0.5, ACCURACY_TOKEN_CAP_M);

    const updates: Promise<any>[] = [];
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(latitude, longitude, r.latitude, r.longitude);
      const outside = d > Number(r.radius) + accAdj + OUTSIDE_TOLERANCE_M;

      if (outside) {
        const state = await getOfferPushState(offerId);
        if (state.inside) {
          updates.push(setOfferPushState(offerId, { inside: false, lastPushedAt: state.lastPushedAt || 0 }));
          console.log('[RECONCILE] set outside', offerId,
            `(d=${Math.round(d)} > r=${r.radius} + accAdj=${Math.round(accAdj)} + tol=${OUTSIDE_TOLERANCE_M})`);
        }
      }
    }
    if (updates.length) await Promise.allSettled(updates as any);
  } catch (e: any) {
    logErr('RECONCILE', e);
  }
}

async function markAlreadyInsideQuietly() {
  try {
    const loc = await Location.getLastKnownPositionAsync({});
    const here = { lat: loc?.coords?.latitude ?? NaN, lng: loc?.coords?.longitude ?? NaN };
    const rawAcc = Number.isFinite(loc?.coords?.accuracy as any) ? Number(loc?.coords?.accuracy) : 20;
    const accAdj = Math.min(rawAcc * 0.5, ACCURACY_TOKEN_CAP_M);

    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(here.lat, here.lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + accAdj + ENTER_SANITY_BUFFER_M;

      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        if (!st.inside) {
          let ok = true;
          try {
            const [interestSet, fetchedOffer] = await Promise.all([getInterestSet(), fetchOfferForInterests(offerId)]);
            if (typeof _matchesInterests === 'function' && fetchedOffer && !_matchesInterests(fetchedOffer, interestSet)) ok = false;
            if (ok && fetchedOffer && !isOfferActiveNowSafe(fetchedOffer, EUROPE_VIENNA)) ok = false;
          } catch {}

          if (ok) {
            const meta = await getOfferMeta(offerId);
            const pushed = await pushOfferOnce(offerId, meta, 'synthetic-enter');
            if (pushed) {
              reportEnterToBackend({ offerId, lat: here.lat, lng: here.lng, accuracy: rawAcc }).catch(() => {});
              console.log('[LOCAL_PUSH_SHOWN:INSTANT_NEW_OFFER]', JSON.stringify({ offerId, d: Math.round(d) + 'm', source: 'INSTANT_AFTER_SYNC' }));
            } else {
              console.log('[GEOFENCE] QUIET-INSIDE (no push after dedupe)', r.identifier, {
                d: Math.round(d), effective: Math.round(effective), accAdj,
              });
            }
          } else {
            await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
            console.log('[GEOFENCE] QUIET-INSIDE skipped (interests/active)', offerId);
          }
        }
      }
    }
  } catch (e: any) {
    logErr('GEOFENCE:QUIET-INSIDE', e);
  }
}

// BG Fallback-Enter & Edge-Burst
async function evaluateProximityForFallback(lat: number, lng: number, accuracy?: number) {
  try {
    if (!CURRENT_REGIONS?.length) return;
    const rawAcc = Number.isFinite(accuracy as any) ? Number(accuracy) : 20;
    const accAdj = Math.min(rawAcc * 0.5, ACCURACY_TOKEN_CAP_M);
    let nearest: { offerId: string; d: number; effective: number; region: any } | null = null;

    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;
      const d = haversineMeters(lat, lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + accAdj + ENTER_SANITY_BUFFER_M;

      if (!nearest || d < nearest.d) nearest = { offerId, d, effective, region: r };

      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        if (st.inside) continue;

        let ok = true;
        try {
          const [interestSet, fetchedOffer] = await Promise.all([getInterestSet(), fetchOfferForInterests(offerId)]);
          if (typeof _matchesInterests === 'function' && fetchedOffer && !_matchesInterests(fetchedOffer, interestSet)) ok = false;
          if (ok && fetchedOffer && !isOfferActiveNowSafe(fetchedOffer, EUROPE_VIENNA)) ok = false;
        } catch {}

        if (ok) {
          const meta = await getOfferMeta(offerId);
          const pushed = await pushOfferOnce(offerId, meta, 'synthetic-enter');
          if (pushed) {
            reportEnterToBackend({ offerId, lat, lng, accuracy: rawAcc }).catch(() => {});
            console.log('[LOCAL_PUSH_SHOWN:ENTER]', JSON.stringify({
              offerId, d: Math.round(d), effective: Math.round(effective), accRaw: rawAcc, accAdj: Math.round(accAdj),
              regionRadius: r.radius, fallback: true
            }));
          }
        }
      }
    }

    if (nearest) {
      const { d, region } = nearest;
      const threshold = (region.radius ?? 0) + EDGE_BURST_NEARBY_M;
      if (d <= threshold) { await ensureBgLocMode('burst'); }
      else { await ensureBgLocMode('default'); }
    }
  } catch (e: any) {
    logErr('BG Fallback', e);
  }
}

// ───────────── BG Location start (mit robusten Retries) ─────────────
async function startBgLocationWithOptions(timeMs: number, distM: number) {
  try {
    await ensureChannels();            // FIX: Channel garantiert VOR Start vorhanden
    await dumpChannelsOnce();
    await assertFgChannelBound();

    // 0) einmal kurz "primen", damit fused provider auf ON geht
    await primeFusedProviderOnce();

    // 1) Permissions hart verifizieren (sichtbar nur im FG)
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        const r = await Location.requestForegroundPermissionsAsync();
        console.log('[PERMS] request FG →', r.status);
      }
      const bg = await Location.getBackgroundPermissionsAsync();
      if (Platform.OS === 'android' && bg.status !== 'granted') {
        const r2 = await Location.requestBackgroundPermissionsAsync();
        console.log('[PERMS] request BG →', r2.status);
      }
    } catch (e) {
      logErr('PERMS:req', e);
    }

    const fgNow = await Location.getForegroundPermissionsAsync();
    const bgNow = await Location.getBackgroundPermissionsAsync();
    console.log('[PERMS] location', { fg: fgNow?.status, bg: bgNow?.status });

    // 2) Vor Start sicher stoppen
    const startedPrev = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (startedPrev) {
      try { await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK); } catch {}
    }

    // 3) Start FGS-Location (mit exakt gleicher, SANITIZED Channel-ID)
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: timeMs,
      distanceInterval: distM,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: FGS_NOTIFICATION_TITLE,
        notificationBody:  FGS_NOTIFICATION_BODY,
        // @ts-ignore
        notificationChannelId: FG_CHANNEL_ID, // <<< SANITIZED, garantiert vorhanden
        // @ts-ignore
        notificationColor: BRAND_BLUE,
      },
    } as any);

    // 4) Bestätigung mit Backoff + eine „Last-Chance“-Wiederholung
    const attempts = [250, 600, 1200, 2000, 2800];
    let ok = false;
    for (const wait of attempts) {
      await new Promise(r => setTimeout(r, wait));
      ok = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
      if (ok) break;
    }
    if (!ok) {
      console.log('[BGLOC] start not confirmed → retry hard');
      try { await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK); } catch {}
      await new Promise(r => setTimeout(r, 300));
      await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: timeMs,
        distanceInterval: distM,
        deferredUpdatesInterval: 0,
        deferredUpdatesDistance: 0,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: false,
        foregroundService: {
          notificationTitle: FGS_NOTIFICATION_TITLE,
          notificationBody:  FGS_NOTIFICATION_BODY,
          // @ts-ignore
          notificationChannelId: FG_CHANNEL_ID,
          // @ts-ignore
          notificationColor: BRAND_BLUE,
        },
      } as any);
      ok = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    }

    console.log('[BGLOC] hasStartedLocationUpdatesAsync =', ok, '(time=', timeMs, 'ms, dist=', distM, 'm)');

    // 5) Direkt danach Geofences „wärmen“
    try { await refreshGeofencesAroundUser(true); } catch {}

    if (!ok) console.log('[BGLOC] START REPORTED FALSE - check channel/permissions above]');
  } catch (e) {
    logErr('BGLOC:startLocationUpdatesAsync', e, { timeMs, distM });
  }
}

async function ensureBgLocMode(mode: BgMode) {
  const now = nowMs();
  if (!(await isServiceActiveNow())) {
    console.log('[BGLOC] mode change skipped (service inactive)');
    return;
  }
  if (mode === CURRENT_BG_MODE && now - LAST_BG_MODE_CHANGE_AT < 10_000) return;
  if (mode === CURRENT_BG_MODE) return;

  if (mode === 'burst') {
    await startBgLocationWithOptions(BG_BURST_TIME_MS, BG_BURST_DIST_M);
  } else {
    await startBgLocationWithOptions(BG_DEFAULT_TIME_MS, BG_DEFAULT_DIST_M);
  }
  CURRENT_BG_MODE = mode;
  LAST_BG_MODE_CHANGE_AT = now;
}

async function startAggressiveBgLocation() {
  await ensureChannels();
  if (!(await isServiceActiveNow())) {
    console.log('[BGLOC] start aborted (service inactive)');
    return;
  }

  // Wenn BG noch nicht gewährt, try-request (nur im FG sichtbar)
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (Platform.OS === 'android' && bg.status !== 'granted') {
      const r = await Location.requestBackgroundPermissionsAsync();
      console.log('[PERMS] request BG (aggressive) →', r.status);
    }
  } catch (e) {
    logErr('PERMS:req2', e);
  }

  const bg2 = await Location.getBackgroundPermissionsAsync();
  if (Platform.OS === 'android' && bg2.status !== 'granted') {
    console.log('[BGLOC] start aborted (no BG permission)');
    return;
  }

  await ensureBgLocMode('default');

  try {
    const warm = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 } as any);
    if (warm?.coords?.latitude && warm?.coords?.longitude) {
      lastSpeedRef.current = warm.coords.speed ?? 0;
      if ((warm.coords.speed ?? 0) >= SPEED_ACTIVE_MS) lastMoveAtRef.current = nowMs();
        await sendHeartbeatSingleFlight({
          latitude: warm.coords.latitude,
          longitude: warm.coords.longitude,
          accuracy: typeof warm.coords.accuracy === 'number' ? warm.coords.accuracy : undefined,
          reason: 'after-bg-start',
        });
    } else {
      await refreshGeofencesAroundUser(true);
    }
  } catch {
    await refreshGeofencesAroundUser(true);
  }
}

// Foreground Highest Refresh
function useForegroundHighAccuracyRefresh() {
  const timerRef = useRef<any>(null);

  useEffect(() => {
    function schedule() {
      clearTimeout(timerRef.current);
      if (appStateRef.current !== 'active') return;
      const delay = jitter(FG_REFRESH_MIN_S, FG_REFRESH_MAX_S);
      timerRef.current = setTimeout(async () => {
        try {
          if (!(await isServiceActiveNow())) {
            console.log('[FG] skip (service inactive)');
            schedule();
            return;
          }
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Highest,
              mayShowUserSettingsDialog: false,
            } as any);
            if (loc?.coords) {
              lastSpeedRef.current = loc.coords.speed ?? 0;
              if ((loc.coords.speed ?? 0) >= SPEED_ACTIVE_MS) lastMoveAtRef.current = nowMs();
                await sendHeartbeatSingleFlight({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  accuracy: typeof loc.coords.accuracy === 'number' ? loc.coords.accuracy : undefined,
                  reason: 'fg-refresh',
                });
            }
          }
        } catch {}
        schedule();
      }, delay);
    }
    schedule();

    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      schedule();
    });

    return () => {
      sub?.remove?.();
      clearTimeout(timerRef.current);
    };
  }, []);
}

// Heartbeat Scheduler
function useHeartbeatScheduler() {
  const timerRef = useRef<any>(null);

  useEffect(() => {
    async function tick() {
      const delay = (() => {
        const secs = heartbeatWindowSeconds();
        return secs * 1000;
      })();

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          if (!(await isServiceActiveNow())) {
            console.log('[HB] scheduler skip (service inactive)');
            tick();
            return;
          }
          const last =
            lastKnownLocRef.current ||
            (await (async () => {
              const lk = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 } as any);
              return lk?.coords ? { latitude: lk.coords.latitude, longitude: lk.coords.longitude, accuracy: lk.coords.accuracy } : null;
            })());
          if (last) {
            await sendHeartbeatSingleFlight({ ...last, reason: 'scheduler' });
          }
        } catch {}
        tick();
      }, delay);
    }
    tick();

    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);
}

// Watchdogs
function useLocationWatchdog() {
  const timerRef = useRef<any>(null);
  useEffect(() => {
    const WD_TICK_MS = 60_000;
    const GF_STALE_MS = 55 * 60 * 1000;

    async function tick() {
      try {
        if (!(await isServiceActiveNow())) {
          console.log('[WD] skip (service inactive)');
          return;
        }
        const permsOk = await hasLocationPermissions();

        const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!started && permsOk) {
          console.log('[BGLOC] watchdog → (re)start');
          await startAggressiveBgLocation();
        } else if (started) {
          console.log('[BGLOC] watchdog → running');
        }

        try {
          await AsyncStorage.setItem('wd.lastTickAt', String(Date.now()));
        } catch {}

        try {
          const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 } as any);
          if (pos?.coords) {
            lastSpeedRef.current = pos.coords.speed ?? 0;
            if ((pos.coords.speed ?? 0) >= SPEED_ACTIVE_MS) lastMoveAtRef.current = nowMs();
              await sendHeartbeatSingleFlight({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
                reason: 'watchdog',
              });
          }
        } catch {}

        const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
        const gfAge = Date.now() - (lastGeofenceSyncAt || 0);
        if (permsOk && !gfStarted) {
          console.log('[GEOFENCE] watchdog → geofencing not running → force refresh');
          await refreshGeofencesAroundUser(true);
        } else if (permsOk && (!lastGeofenceSyncAt || gfAge > GF_STALE_MS)) {
          console.log('[GEOFENCE] watchdog → geofence stale (age=', gfAge, 'ms) → force refresh');
          await refreshGeofencesAroundUser(true);
        }

        await maybePeriodicTokenRefresh('watchdog');
      } catch (e) {
        logErr('WD', e);
      }
    }
    timerRef.current = setInterval(tick, WD_TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}

async function guardedBgRearm(reason: string) {
  const now = nowMs();
  if (BG_REARM_IN_FLIGHT) {
    console.log('[BGLOC] rearm skipped (in-flight)', reason);
    return;
  }
  if (now - LAST_BG_REARM_AT < BG_REARM_MIN_GAP_MS) {
    console.log('[BGLOC] rearm skipped (cooldown)', reason, 'age=', now - LAST_BG_REARM_AT);
    return;
  }
  BG_REARM_IN_FLIGHT = true;
  LAST_BG_REARM_AT = now;
  try {
    await startAggressiveBgLocation();
  } finally {
    BG_REARM_IN_FLIGHT = false;
  }
}

function useAppStateWatchdog() {
  const appState = useRef<string>(AppState.currentState || 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      try {
        appStateRef.current = next;
        if (next === 'active' && appState.current !== 'active') {
          if (!(await isServiceActiveNow())) {
            console.log('[WD] appstate skip (service inactive)');
            appState.current = next;
            return;
          }
          const permsOk = await hasLocationPermissions();
          const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
          if (permsOk && !started) {
            console.log('[BGLOC] watchdog appstate → (re)start]');
            await guardedBgRearm('appstate-active');
          }
          await maybePeriodicTokenRefresh('app-foreground');
        }
      } catch {}
      appState.current = next;
    });

    return () => sub?.remove?.();
  }, []);
}

// ───────────── Task Definitions ─────────────
if (!TaskManager.isTaskDefined(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (!(await isServiceActiveNow())) {
      console.log('[BGLOC] task skip (service inactive)');
      return;
    }
    if (error) {
      console.log('[BGLOC] Task error', String(error));
      return;
    }
    const { locations } = (data || {}) as any;
    if (!locations?.length) return;
    console.log('[BGLOC] locations batch size =', locations.length);
    let { latitude, longitude, accuracy, speed } = locations[0]?.coords || {};

    try {
      await AsyncStorage.setItem('lastFixAt', String(Date.now()));
    } catch {}

    diagLog('bg.task', { count: locations.length, lat: latitude, lng: longitude, acc: accuracy, speed }, 'info', 5000);

    try {
      const improved = await ensureGoodAccuracyCoords({ latitude, longitude, accuracy } as any);
      if (improved) {
        latitude = improved.latitude;
        longitude = improved.longitude;
        accuracy = improved.accuracy;
      }
    } catch {}

    if (typeof speed === 'number') {
      lastSpeedRef.current = speed;
      if (speed >= SPEED_ACTIVE_MS) lastMoveAtRef.current = nowMs();
    }

      if (latitude && longitude) {
        await sendHeartbeatSingleFlight({
          latitude,
          longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : undefined,
          reason: 'bg-task',
        });

        // Booster: bei groesserer Bewegung einen zweiten HB mit Mindestabstand senden
        const now = Date.now();
        const prev = lastCoordsForBooster;
        const moved = prev ? haversineMeters(prev.latitude, prev.longitude, latitude, longitude) : 0;
        if (!prev || moved >= BOOSTER_MOVE_METERS) {
          if (now - lastBoosterAtMs >= BOOSTER_MIN_GAP_SECONDS * 1000) {
            lastBoosterAtMs = now;
            await sendHeartbeatSingleFlight({
              latitude,
              longitude,
              accuracy: typeof accuracy === 'number' ? accuracy : undefined,
              reason: 'bg-boost',
            });
          }
          lastCoordsForBooster = { latitude, longitude };
        }

        await evaluateProximityForFallback(latitude, longitude, typeof accuracy === 'number' ? accuracy : undefined);
      }
  } catch (e: any) {
    logErr('BGLOC:task', e);
  }
  });
}

// BackgroundFetch watchdog (Ultreia-style): rearm + stale heartbeat
if (!TaskManager.isTaskDefined(HEARTBEAT_FETCH_TASK)) {
  TaskManager.defineTask(HEARTBEAT_FETCH_TASK, async () => {
    try {
      if (!(await isServiceActiveNow())) {
        console.log('[FETCH] task skip (service inactive)');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      const permsOk = await hasLocationPermissions();
      if (!permsOk) return BackgroundFetch.BackgroundFetchResult.NoData;

      const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
      if (!started) {
        console.log('[FETCH] bgLoc not running -> rearm startAggressiveBgLocation');
        await startAggressiveBgLocation();
      }

      const last = await getGlobalState();
      const lastHb = Number(last?.lastHeartbeatAt || 0);
      const ageMs = lastHb ? (Date.now() - lastHb) : Infinity;
      const stale = ageMs >= 3 * 60 * 1000;

      if (!stale) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      diagLog('fetch.stale', { ageMs }, 'info', 60000);
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 } as any);
      if (pos?.coords) {
          await sendHeartbeatSingleFlight({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
            reason: 'fetch-watchdog',
          });
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e: any) {
      logErr('FETCH', e);
      diagLog('fetch.error', { error: String(e?.message || e) }, 'error', 1000);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  try {
    if (!(await isServiceActiveNow())) {
      console.log('[GEOFENCE] task skip (service inactive)');
      return;
    }
    if (error) {
      console.log('[GEOFENCE] Task error', String(error));
      return;
    }
    const eventType = (data as any)?.eventType;
    const region = (data as any)?.region;

    const offerId = parseOfferIdFromIdentifier(region?.identifier);
    if (!offerId) return;

    const state = await getOfferPushState(offerId);
    if (eventType === Location.GeofencingEventType.Exit) {
      await setOfferPushState(offerId, { inside: false, lastPushedAt: state.lastPushedAt || 0 });
      console.log('[GEOFENCE] EXIT', region?.identifier);
      return;
    }

    if (eventType === Location.GeofencingEventType.Enter) {
      const since = nowMs() - geofenceStartedAt;
      if (geofenceStartedAt && since < POST_START_ENTER_COOLDOWN_MS) {
        console.log('[GEOFENCE] ENTER ignored (COOLDOWN)', since, 'ms since (re)start');
        return;
      }
    }

    let lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 } as any);
    let lat = lastKnown?.coords?.latitude ?? null;
    let lng = lastKnown?.coords?.longitude ?? null;
    let accuracy = lastKnown?.coords?.accuracy ?? null;
    let speed = lastKnown?.coords?.speed ?? null;
    let enteredDistanceM: number | null = null;

    if (eventType === Location.GeofencingEventType.Enter) {
      if (Number.isFinite(region?.latitude) && Number.isFinite(region?.longitude)) {
        try {
          const improved = await ensureGoodAccuracyCoords(lastKnown?.coords || null);
          if (improved) { lat = improved.latitude; lng = improved.longitude; accuracy = improved.accuracy; }
        } catch {}

        if (lat == null || lng == null) {
          console.log('[GEOFENCE] ENTER ignored (no lastKnown fix)');
          return;
        }

        const d = haversineMeters(lat, lng, region.latitude, region.longitude);
        enteredDistanceM = Math.round(d);

        const accRaw = Number.isFinite(accuracy as any) ? Number(accuracy) : 20;
        const accAdj = Math.min(accRaw * 0.5, ACCURACY_TOKEN_CAP_M);
        const effective = (region.radius ?? 0) + accAdj + ENTER_SANITY_BUFFER_M;

        if (d > (region.radius ?? 0) && d <= (region.radius ?? 0) + BORDERLINE_BAND_M) {
          const hot = await getFreshBestFixOrNull(3000);
          if (hot?.coords) {
            const d2 = haversineMeters(hot.coords.latitude, hot.coords.longitude, region.latitude, region.longitude);
            if (d2 > (region.radius ?? 0)) {
              console.log('[GEOFENCE] ENTER ignored after hot-fix', { d2: Math.round(d2) });
              return;
            }
          }
        }

        if (d > effective) {
          console.log('[GEOFENCE] ENTER ignored (SANITY:OUTSIDE)', {
            d: Math.round(d),
            effective: Math.round(effective),
            radius: region.radius,
            accAdj: Math.round(accAdj),
          });
          return;
        }
      }

      let offerForChecks: any = null;
      let ok = true;
      try {
        const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
        offerForChecks = await res.json();
        ok = res.ok ? !!isOfferActiveNowSafe(offerForChecks, EUROPE_VIENNA) : true;
        if (ok) {
          const interestSet = await getInterestSet();
          if (typeof _matchesInterests === 'function' && offerForChecks && !_matchesInterests(offerForChecks, interestSet)) ok = false;
        }
      } catch {}

      if (!ok) {
        await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
        console.log('[LOCAL_PUSH] skipped by interests/active', offerId);
        return;
      }

      const meta = await getOfferMeta(offerId);
      const pushed = await pushOfferOnce(offerId, meta, 'ENTER');

      if (pushed) {
        reportEnterToBackend({
          offerId,
          lat: lat!, lng: lng!,
          accuracy: Number.isFinite(accuracy as any) ? Number(accuracy) : null,
        }).catch(() => {});

        const accRaw = Number.isFinite(accuracy as any) ? Number(accuracy) : 20;
        const accAdj = Math.min(accRaw * 0.5, ACCURACY_TOKEN_CAP_M);
        const eff = (region?.radius ?? 0) + accAdj + ENTER_SANITY_BUFFER_M;

        console.log('[LOCAL_PUSH_SHOWN:ENTER]', JSON.stringify({
          offerId,
          d: enteredDistanceM,
          effective: Math.round(eff),
          accRaw,
          accAdj: Math.round(accAdj),
          speed: typeof speed === 'number' ? +Number(speed).toFixed(2) : null,
          regionRadius: region?.radius,
        }));
      }
    }
  } catch (e: any) {
    logErr('GEOFENCE:handler', e);
  }
  });
}

// Meta for notifications
async function getOfferMeta(offerId: string) {
  try {
    const raw = await AsyncStorage.getItem(`offerMeta.${offerId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
async function setOfferMeta(offerId: string, meta: any) {
  try { await AsyncStorage.setItem(`offerMeta.${offerId}`, JSON.stringify(meta || {})); } catch {}
}

// Diagnostics & Roundtrip helpers
export async function roundtripTest(offerId: string) {
  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const payload = { token: token || undefined, deviceId, platform: Platform.OS, projectId: RESOLVED_PROJECT_ID, offerId, t: nowMs() };

    const endpoints = ['roundtrip', 'test', 'ping'];
    let ok = false, lastStatus = 0;
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${API_BASE}/push/${ep}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        lastStatus = res.status;
        if (res.ok) { ok = true; break; }
      } catch {}
    }

    await safePresentNotification({
      title: 'Ultreia – Roundtrip',
      body: ok ? 'Backend-Push ausgelöst.' : `Backend nicht erreichbar (status=${lastStatus}).`,
      data: { kind: 'roundtrip', ok } as any,
      channelId: OFFER_CHANNEL_ID,
    });
    console.log('[diag] roundtrip', ok ? 'ok' : `failed status=${lastStatus}`);
  } catch (e: any) {
    logErr('diag:roundtrip', e);
  }
}

// ───────────── Init
export async function stopBackgroundServices(reason = 'manual') {
  try { await syncNativeHeartbeatConfig(`stop:${reason}`, null, false); } catch {}

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    if (started) {
      try { await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK); } catch {}
    }
  } catch {}

  try {
    const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (gfStarted) {
      try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
    }
  } catch {}

  try {
    const registered = await TaskManager.isTaskRegisteredAsync(HEARTBEAT_FETCH_TASK);
    if (registered) {
      try { await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_FETCH_TASK); } catch {}
    }
  } catch {}

  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
  try {
    const fn = (Notifications as any)?.dismissAllNotificationsAsync;
    if (typeof fn === 'function') await fn();
  } catch {}

  try { CURRENT_REGIONS = []; } catch {}
  console.log('[service] background stopped', reason);
}

export async function syncRemoteServiceState(enabled: boolean, reason = 'manual') {
  try {
    const deviceId = await getPersistentDeviceId();
    const token = await getCurrentExpoToken();
    const interests = await readInterestsForBackend();
    const res = await fetch(`${API_BASE}/push/service-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: !!enabled,
        reason,
        token: token || undefined,
        deviceId,
        projectId: RESOLVED_PROJECT_ID,
        interests,
      }),
    });
    if (!res.ok) {
      console.log('[service] remote state sync non-ok', res.status, reason);
      return false;
    }
    return true;
  } catch (e: any) {
    logErr('service:remote-sync', e, { enabled, reason });
    return false;
  }
}

async function initPush() {
  await ensureChannels().catch(() => {}); // FIX: Channel vor jeglichem Start

  if (await isStoppedUntilRestartNow()) {
    console.log('[init] service hard-stopped until app restart -> skip');
    await syncRemoteServiceState(false, 'init-hard-stop').catch(() => {});
    await stopBackgroundServices('init-hard-stop');
    return;
  }

  const svc = await getServiceState();
  if (!isServiceActive(svc)) {
    console.log('[init] service disabled or paused -> skip');
    await syncRemoteServiceState(false, 'init-inactive').catch(() => {});
    await stopBackgroundServices('init-inactive');
    return;
  }

  try {
    const notifOk = await hasNotificationPermissions();
    if (notifOk) {
      await resolveExpoTokenAuthoritative().catch(() => {});
      await registerTokenAtBackend('app-foreground').catch(() => {});
      await maybePeriodicTokenRefresh('init');
    } else {
      console.log('[init] notif permission not granted → skip token/register');
    }
  } catch {}

  try {
    // Falls Gate es noch nicht erledigt hat, hier aktiv BG-Permission versuchen (nur im FG sichtbar)
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const r = await Location.requestForegroundPermissionsAsync();
      console.log('[PERMS] init FG →', r.status);
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (Platform.OS === 'android' && bg.status !== 'granted') {
      const r2 = await Location.requestBackgroundPermissionsAsync();
      console.log('[PERMS] init BG →', r2.status);
    }

    const permsOk = await hasLocationPermissions();
    if (permsOk) {
      await startAggressiveBgLocation();
      await refreshGeofencesAroundUser(true);
    } else {
      console.log('[init] BG not started (permissions not granted)');
    }
  } catch {}

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      const registered = await TaskManager.isTaskRegisteredAsync(HEARTBEAT_FETCH_TASK);
      if (!registered) {
        await BackgroundFetch.registerTaskAsync(HEARTBEAT_FETCH_TASK, {
          minimumInterval: 15 * 60,
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('[FETCH] registered task', HEARTBEAT_FETCH_TASK);
      }
    }
  } catch (e: any) {
    logErr('FETCH:register', e);
  }
}

export default function PushInitializer() {
  useEffect(() => { initPush().catch(() => {}); }, []);
  useAppStateWatchdog();
  useLocationWatchdog();
  useHeartbeatScheduler();
  useForegroundHighAccuracyRefresh();
  return null;
}

// Headless Bootstrap
export async function headlessBootstrap() {
  try {
    console.log('[HEADLESS] boot start');
    if (await isStoppedUntilRestartNow()) {
      console.log('[HEADLESS] hard-stopped until restart -> skip');
      await stopBackgroundServices('headless-hard-stop');
      return;
    }
    if (!(await isServiceActiveNow())) {
      console.log('[HEADLESS] service inactive -> skip');
      await stopBackgroundServices('headless-inactive');
      return;
    }
    await ensureChannels();
    if (await hasNotificationPermissions()) {
      await resolveExpoTokenAuthoritative();
      await registerTokenAtBackend('boot-headless');
    } else {
      console.log('[HEADLESS] skip token/register (no notif permission)');
    }

    try {
      if (await hasLocationPermissions()) {
        await guardedBgRearm('boot-headless');
        await refreshGeofencesAroundUser(true);
        await sendHeartbeatOnce();
      }
    } catch (e) {
      logErr('HEADLESS:bg-rearm', e);
    }
    console.log('[HEADLESS] boot done');
  } catch (e: any) {
    logErr('HEADLESS:boot', e);
  }
}

// ───────────── Öffentliche Helfer (Onboarding/Diag) ─────────────
export async function ensureBgAfterOnboarding() {
  try {
    if (await isStoppedUntilRestartNow()) {
      console.log('[ensureBgAfterOnboarding] hard-stopped until restart');
      await stopBackgroundServices('onboarding-hard-stop');
      return;
    }
    const active = await isServiceActiveNow();
    if (!active) {
      console.log('[ensureBgAfterOnboarding] service disabled or paused');
      return;
    }
    await ensureChannels(); // FIX: Channel vor Start sicherstellen
    // Im Onboarding im FG: aktiv (nochmals) anfragen, um sicher zu sein
    const bg = await Location.getBackgroundPermissionsAsync();
    if (Platform.OS === 'android' && bg.status !== 'granted') {
      const r = await Location.requestBackgroundPermissionsAsync();
      console.log('[PERMS] onboarding BG →', r.status);
    }

    const locOk = await hasLocationPermissions();
    if (locOk) {
      await startAggressiveBgLocation();
      await refreshGeofencesAroundUser(true);
    } else {
      console.log('[ensureBgAfterOnboarding] location perms not granted');
    }

    if (await hasNotificationPermissions()) {
      await resolveExpoTokenAuthoritative();
      await registerTokenAtBackend('after-onboarding');
    }
  } catch (e) {
    logErr('ensureBgAfterOnboarding', e);
  }
}

export async function getBgStatus() {
  try {
    const locStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    const locPerms = await hasLocationPermissions();
    const notifPerms = await hasNotificationPermissions();
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return { locStarted, gfStarted, locPerms, notifPerms, hasToken: !!token, projectId: RESOLVED_PROJECT_ID };
  } catch (e) {
    logErr('getBgStatus', e);
    return { locStarted: false, gfStarted: false, locPerms: false, notifPerms: false, hasToken: false, projectId: RESOLVED_PROJECT_ID };
  }
}

// Exports for Diagnostics
export async function kickstartBackgroundLocation() { await startAggressiveBgLocation(); }
export const sendHeartbeat = sendHeartbeatOnce;
export const sendRoundtripTest = roundtripTest;





