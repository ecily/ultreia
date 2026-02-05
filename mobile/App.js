// C:\ultreia\mobile\App.js
// ULTREIA – Heartbeat + Push MVP (JS-only, robust background strategy)
//
// 3-stufige Strategie (Event-first, Poll-second):
// A) BG-Location + Android Foreground-Service Notification (primärer Motor)
// B) BackgroundFetch/TaskManager Watchdog (Recovery + Self-Heal)
// C) “Booster”-Heartbeats bei Location-Events (edge burst / movement-based)
//
// Fokus: Stabilität/Diagnostik/Token-Hygiene/Dedupe korrekt.
// UI-Phase: App/UX bauen, ohne den Motor zu destabilisieren (Motor bleibt funktional gleich).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity, AppState, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_IDS = {
  bgLoc: 'ultreia-bg-location-task',
  fetch: 'ultreia-heartbeat-fetch',
};

const NOTIF_CHANNELS = { fg: 'ultreia-fg', offers: 'offers' };

const STORAGE_KEYS = {
  prefs: 'ultreia:prefs:v1',
  interests: 'ultreia:interests:v1',
  notifInbox: 'ultreia:notif-inbox:v1',
};

// ── Tuning ───────────────────────────────────────────────────────────────────
const BG_TIME_SECONDS = 60;
const BG_DISTANCE_METERS = 25;

const HB_MIN_GAP_SECONDS = 55;

const BOOSTER_MIN_GAP_SECONDS = 45;
const BOOSTER_MOVE_METERS = 60;

const HB_LOOP_SECONDS = 45;

const WATCHDOG_STALE_SECONDS = 3 * 60;
const WATCHDOG_POLL_SECONDS = 30;

const DEBUG_OFFER_RADIUS_M = 200;
const DEBUG_OFFER_VALID_MIN = 30;

const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) || 'http://10.0.2.2:4000/api';

// Interessen global (Memory Cache)
let currentInterests = null;
let interestsCacheLoaded = false;

// Global last HB
let lastHeartbeatAtMs = null;
let hbIntervals = [];

// Last sent coords for skip logic
let lastSentCoords = null;

// Foreground timer
let hbLoopTimerId = null;

// Last coords snapshot for movement-based decisions
let lastCoordsForBooster = null;
let lastBoosterAtMs = null;

// ── Single-flight HB (verhindert Doppel-Trigger) ─────────────────────────────
let hbInFlight = null;
let hbInFlightMeta = null;

const FORCE_HB_REASONS = new Set(['manual', 'init', 'watchdog-rearm', 'fetch-watchdog']);

function isForceReason(reason) {
  return FORCE_HB_REASONS.has(String(reason || ''));
}

// ── DeviceId (ohne extra Dependencies) ───────────────────────────────────────
let DEVICE_ID = null;

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // eslint-disable-next-line no-bitwise
  return h >>> 0;
}

function makeDeviceIdFromSeed(seed) {
  const hex = fnv1a32(String(seed || 'seed')).toString(16).padStart(8, '0');
  return `ULTR-${hex}`;
}

function getEasProjectIdMaybe() {
  return (
    (Constants &&
      Constants.expoConfig &&
      Constants.expoConfig.extra &&
      Constants.expoConfig.extra.eas &&
      Constants.expoConfig.extra.eas.projectId) ||
    (Constants && Constants.easConfig && Constants.easConfig.projectId) ||
    null
  );
}

async function resolveDeviceId() {
  if (DEVICE_ID) return DEVICE_ID;

  if (Platform.OS === 'android') {
    try {
      const nativeToken = await Notifications.getDevicePushTokenAsync();
      const fcmToken = nativeToken && nativeToken.data ? String(nativeToken.data) : null;
      if (fcmToken && fcmToken.length > 10) {
        DEVICE_ID = makeDeviceIdFromSeed(`fcm:${fcmToken}`);
        return DEVICE_ID;
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const projectId = getEasProjectIdMaybe();
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const expoToken = tokenData && tokenData.data ? String(tokenData.data) : null;
    if (expoToken && expoToken.length > 10) {
      DEVICE_ID = makeDeviceIdFromSeed(`expo:${expoToken}`);
      return DEVICE_ID;
    }
  } catch (e) {
    // ignore
  }

  const fallbackSeed = `${Platform.OS}|${Constants?.deviceName || 'device'}|${Constants?.expoVersion || ''}`;
  DEVICE_ID = makeDeviceIdFromSeed(`fallback:${fallbackSeed}`);
  return DEVICE_ID;
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

async function postJson(path, body) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

  const raw = await res.text().catch(() => '');
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (e) {
    parsed = { raw };
  }

  if (!res.ok) {
    const msg = `HTTP ${res.status} ${typeof parsed === 'string' ? parsed : raw || ''}`.trim();
    const err = new Error(msg);
    err.status = res.status;
    err.data = parsed;
    throw err;
  }

  return parsed;
}

// ── Notifications Handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Mapping UI prefs → backend categories
function buildInterestsFromPrefs({ prefAccommodation, prefFood, prefPharmacy, prefWater }) {
  const list = [];
  if (prefAccommodation) list.push('albergue', 'hostel');
  if (prefFood) list.push('restaurant', 'bar');
  if (prefPharmacy) list.push('pharmacy');
  if (prefWater) list.push('water');
  return Array.from(new Set(list));
}

function normalizeInterests(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .map((x) => x.toLowerCase());
  return Array.from(new Set(cleaned));
}

async function savePrefsAndInterests(prefs) {
  const safePrefs = {
    prefAccommodation: !!prefs.prefAccommodation,
    prefFood: !!prefs.prefFood,
    prefPharmacy: !!prefs.prefPharmacy,
    prefWater: !!prefs.prefWater,
  };

  const interests = normalizeInterests(buildInterestsFromPrefs(safePrefs));

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(safePrefs));
  } catch (e) {
    // ignore
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.interests, JSON.stringify(interests));
  } catch (e) {
    // ignore
  }

  currentInterests = interests;
  interestsCacheLoaded = true;

  console.log('[Interests] persisted:', interests);
  return interests;
}

async function loadPrefsFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.prefs);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      prefAccommodation: !!parsed.prefAccommodation,
      prefFood: !!parsed.prefFood,
      prefPharmacy: !!parsed.prefPharmacy,
      prefWater: !!parsed.prefWater,
    };
  } catch (e) {
    return null;
  }
}

async function loadInterestsCached() {
  if (interestsCacheLoaded && Array.isArray(currentInterests) && currentInterests.length > 0) {
    return currentInterests;
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.interests);
    if (raw) {
      const parsed = JSON.parse(raw);
      const interests = normalizeInterests(parsed);
      if (interests.length > 0) {
        currentInterests = interests;
        interestsCacheLoaded = true;
        console.log('[Interests] loaded from storage:', interests);
        return interests;
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const prefs = await loadPrefsFromStorage();
    if (prefs) {
      const interests = normalizeInterests(buildInterestsFromPrefs(prefs));
      currentInterests = interests;
      interestsCacheLoaded = true;
      console.log('[Interests] derived from stored prefs:', interests);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.interests, JSON.stringify(interests));
      } catch (e) {
        // ignore
      }
      return interests;
    }
  } catch (e) {
    // ignore
  }

  interestsCacheLoaded = true;
  currentInterests = currentInterests || [];
  console.log('[Interests] none available (storage empty)');
  return currentInterests;
}

// ── Inbox (Push Historie) ────────────────────────────────────────────────────
async function loadNotifInbox() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.notifInbox);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 50);
  } catch (e) {
    return [];
  }
}

async function persistNotifInbox(items) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.notifInbox, JSON.stringify(Array.isArray(items) ? items.slice(0, 50) : []));
  } catch (e) {
    // ignore
  }
}

function normalizeNotifItem(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const title = String(obj.title || '');
  const body = String(obj.body || '');
  const data = obj.data && typeof obj.data === 'object' ? obj.data : {};
  const receivedAt = obj.receivedAt ? String(obj.receivedAt) : new Date().toISOString();
  return { title, body, data, receivedAt };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hbAgeSecondsNow() {
  return lastHeartbeatAtMs ? Math.floor((Date.now() - lastHeartbeatAtMs) / 1000) : null;
}

function shouldSkipHeartbeat({ reason, lat, lng }) {
  const now = Date.now();
  const ageSec = lastHeartbeatAtMs ? Math.floor((now - lastHeartbeatAtMs) / 1000) : null;

  // Force: Diagnose/Recovery nur hier
  if (isForceReason(reason)) return { skip: false, why: 'force' };

  if (ageSec != null && ageSec < HB_MIN_GAP_SECONDS) {
    if (lastSentCoords && lat != null && lng != null) {
      const movedM = haversineMeters(lastSentCoords.latitude, lastSentCoords.longitude, lat, lng);
      if (movedM >= BG_DISTANCE_METERS) return { skip: false, why: `moved:${Math.round(movedM)}m` };
      return { skip: true, why: `dedupe:${ageSec}s moved:${Math.round(movedM)}m` };
    }
    return { skip: true, why: `dedupe:${ageSec}s` };
  }

  return { skip: false, why: 'gap-ok' };
}

async function resolveCoordsForHeartbeat({ allowCurrentFix = true } = {}) {
  const last = await Location.getLastKnownPositionAsync();
  if (last && last.coords) return last.coords;

  if (!allowCurrentFix) return null;

  const cur = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: true,
  });
  return cur.coords;
}

// ── Heartbeat Engine ─────────────────────────────────────────────────────────
async function sendHeartbeatCore({ lat, lng, accuracy, reason = 'unknown', interests }) {
  const startedAt = Date.now();

  let finalInterests = null;
  if (Array.isArray(interests) && interests.length > 0) {
    finalInterests = normalizeInterests(interests);
  } else if (Array.isArray(currentInterests) && currentInterests.length > 0) {
    finalInterests = currentInterests;
  } else {
    try {
      const loaded = await loadInterestsCached();
      if (Array.isArray(loaded) && loaded.length > 0) finalInterests = loaded;
    } catch (e) {
      // ignore
    }
  }

  const deviceId = await resolveDeviceId();

  const payload = {
    deviceId,
    lat,
    lng,
    accuracy,
    ts: new Date().toISOString(),
    powerState: 'unknown',
    source: reason,
  };

  if (finalInterests && finalInterests.length > 0) payload.interests = finalInterests;

  console.log(
    `[HB] start device=${deviceId} reason=${reason} lat=${lat} lng=${lng} acc=${
      accuracy != null ? accuracy : 'n/a'
    } interests=${finalInterests && finalInterests.length ? finalInterests.join(',') : 'none'}`
  );

  const res = await fetch(`${API_BASE}/location/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const finishedAt = Date.now();
  const latencyMs = finishedAt - startedAt;

  const data = await res.json().catch(() => null);
  console.log('[HB] response payload:', data);

  if (!res.ok) {
    const msg = `HTTP ${res.status}`;
    console.warn(`[HB] error reason=${reason} latency=${latencyMs}ms: ${msg}`);
    throw new Error(msg);
  }

  let intervalSec = null;
  if (lastHeartbeatAtMs != null) {
    const deltaSec = Math.round((finishedAt - lastHeartbeatAtMs) / 1000);
    intervalSec = deltaSec;
    hbIntervals.push(deltaSec);
    if (hbIntervals.length > 60) hbIntervals.shift();
  }

  lastHeartbeatAtMs = finishedAt;
  if (lat != null && lng != null) lastSentCoords = { latitude: lat, longitude: lng };

  console.log(
    `[HB] ok reason=${reason} latency=${latencyMs}ms interval=${intervalSec != null ? `${intervalSec}s` : 'n/a'} samples=${
      hbIntervals.length
    }`
  );

  return { data, latencyMs, intervalSec };
}

async function sendHeartbeatSingleFlight({ lat, lng, accuracy, reason = 'unknown', interests }) {
  const r = String(reason || 'unknown');

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
      return await sendHeartbeatCore({ lat, lng, accuracy, reason: r, interests });
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

async function sendImmediateHeartbeat(reason) {
  const coords = await resolveCoordsForHeartbeat();
  if (!coords) throw new Error('No coords available');
  return sendHeartbeatSingleFlight({
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    reason: reason || 'immediate',
  });
}

async function registerDevice({ expoPushToken, fcmToken } = {}) {
  const deviceId = await resolveDeviceId();

  const body = {
    deviceId,
    platform: Platform.OS === 'android' ? 'android' : Platform.OS || 'unknown',
  };

  if (expoPushToken) body.expoToken = String(expoPushToken);
  if (fcmToken) body.fcmToken = String(fcmToken);

  const res = await fetch(`${API_BASE}/push/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`register HTTP ${res.status} ${txt}`);
  }
  return res.json();
}

// ── BG Location Task ─────────────────────────────────────────────────────────
try {
  TaskManager.defineTask(TASK_IDS.bgLoc, async ({ data, error }) => {
    if (error) {
      console.warn('[BG TASK] error:', error);
      return;
    }

    const payload = data || {};
    const locations = payload.locations || [];
    if (!locations || !locations.length) {
      console.log('[BG TASK] no locations in payload');
      return;
    }

    const loc = locations[0];
    const coords = (loc && loc.coords) || {};
    const lat = coords.latitude;
    const lng = coords.longitude;
    const acc = coords.accuracy;

    console.log('[BG TASK] location update:', `lat=${lat} lng=${lng} acc=${acc} speed=${coords.speed}`);

    try {
      if (!Array.isArray(currentInterests) || currentInterests.length === 0) {
        await loadInterestsCached();
      }
    } catch (e) {
      // ignore
    }

    try {
      const dec = shouldSkipHeartbeat({ reason: 'bg-location', lat, lng });
      if (dec.skip) {
        const ageSec = hbAgeSecondsNow();
        console.log(`[HB] skip reason=bg-location why=${dec.why} ageSec=${ageSec != null ? ageSec : 'n/a'}`);
      } else {
        const r = await sendHeartbeatSingleFlight({ lat, lng, accuracy: acc, reason: 'bg-location' });
        if (r && r.skipped) {
          const ageSec = hbAgeSecondsNow();
          console.log(
            `[HB] skip reason=bg-location why=${r.why} inFlightReason=${r.inFlightReason || 'n/a'} ageSec=${
              ageSec != null ? ageSec : 'n/a'
            }`
          );
        }
      }
    } catch (e2) {
      console.warn('[BG TASK] heartbeat failed:', (e2 && e2.message) || e2);
    }

    // Booster: große Bewegung, rate-limited (NICHT force; läuft durch dedupe + single-flight)
    try {
      const now = Date.now();
      const canBooster = !lastBoosterAtMs || now - lastBoosterAtMs >= BOOSTER_MIN_GAP_SECONDS * 1000;

      if (canBooster && lastCoordsForBooster && lat != null && lng != null) {
        const movedM = haversineMeters(
          lastCoordsForBooster.latitude,
          lastCoordsForBooster.longitude,
          lat,
          lng
        );
        if (movedM >= BOOSTER_MOVE_METERS) {
          console.log(`[Booster] moved ${Math.round(movedM)}m -> heartbeat booster`);
          lastBoosterAtMs = now;
          try {
            const decB = shouldSkipHeartbeat({ reason: 'booster-move', lat, lng });
            if (decB.skip) {
              const ageSec = hbAgeSecondsNow();
              console.log(`[HB] skip reason=booster-move why=${decB.why} ageSec=${ageSec != null ? ageSec : 'n/a'}`);
            } else {
              const r = await sendHeartbeatSingleFlight({ lat, lng, accuracy: acc, reason: 'booster-move' });
              if (r && r.skipped) {
                console.log(
                  `[HB] skip reason=booster-move why=${r.why} inFlightReason=${r.inFlightReason || 'n/a'}`
                );
              }
            }
          } catch (e3) {
            console.warn('[Booster] failed:', (e3 && e3.message) || e3);
          }
        }
      }

      if (lat != null && lng != null) {
        lastCoordsForBooster = { latitude: lat, longitude: lng };
      }
    } catch (e4) {
      console.warn('[Booster] error:', (e4 && e4.message) || e4);
    }
  });
} catch (e) {
  // duplicate define on fast refresh
}

// ── BackgroundFetch Task ─────────────────────────────────────────────────────
try {
  TaskManager.defineTask(TASK_IDS.fetch, async () => {
    console.log('[FETCH TASK] tick');

    try {
      try {
        const hasBg = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
        if (!hasBg) {
          console.log('[FETCH TASK] bgLoc not running -> rearm startBgLocation');
          await startBgLocation();
        }
      } catch (eRearm) {
        console.warn('[FETCH TASK] rearm check failed:', (eRearm && eRearm.message) || eRearm);
      }

      try {
        if (!Array.isArray(currentInterests) || currentInterests.length === 0) {
          await loadInterestsCached();
        }
      } catch (e) {
        // ignore
      }

      const ageSec = lastHeartbeatAtMs ? Math.floor((Date.now() - lastHeartbeatAtMs) / 1000) : null;
      const stale = ageSec == null || ageSec >= WATCHDOG_STALE_SECONDS;

      if (!stale) {
        console.log('[FETCH TASK] HB not stale -> no heartbeat (ageSec=', ageSec, ')');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
      if (coords && coords.latitude != null && coords.longitude != null) {
        console.log(
          '[FETCH TASK] watchdog heartbeat:',
          `ageSec=${ageSec} lat=${coords.latitude} lng=${coords.longitude} acc=${coords.accuracy}`
        );

        const r = await sendHeartbeatSingleFlight({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          reason: 'fetch-watchdog',
        });

        if (r && r.skipped) {
          console.log(`[FETCH TASK] HB skipped: ${r.why} inFlightReason=${r.inFlightReason || 'n/a'}`);
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
      }

      console.log('[FETCH TASK] no coords available');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (e2) {
      console.warn('[FETCH TASK] failed:', (e2 && e2.message) || e2);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  // duplicate define
}

// ── BG Location Start ─────────────────────────────────────────────────────────
async function startBgLocation() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
  if (hasStarted) {
    console.log('[BG] already started');
    return;
  }

  console.log('[BG] starting location updates…', `time=${BG_TIME_SECONDS}s distance=${BG_DISTANCE_METERS}m`);

  await Location.startLocationUpdatesAsync(TASK_IDS.bgLoc, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: BG_TIME_SECONDS * 1000,
    distanceInterval: BG_DISTANCE_METERS,
    deferredUpdatesInterval: BG_TIME_SECONDS * 1000,
    deferredUpdatesDistance: BG_DISTANCE_METERS,

    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    activityType: Location.ActivityType.Fitness,
    mayShowUserSettingsDialog: true,

    foregroundService: {
      notificationTitle: 'ULTREIA läuft – Pilgerhilfe aktiv',
      notificationBody: 'Wir benachrichtigen dich unterwegs über passende Angebote in deiner Nähe.',
      notificationColor: '#000000',
      killServiceOnDestroy: false,
    },
  });
}

// ── Foreground Heartbeat Loop ────────────────────────────────────────────────
function startHeartbeatLoop(updateState) {
  if (hbLoopTimerId) {
    console.log('[HB-Loop] already running');
    updateState((s) => ({ ...s, hbLoopActive: true }));
    return;
  }

  console.log('[HB-Loop] starting loop…', `interval=${HB_LOOP_SECONDS}s`);
  updateState((s) => ({ ...s, hbLoopActive: true }));

  const runTick = async () => {
    try {
      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
      if (!coords) {
        console.warn('[HB-Loop] no coords available');
        return;
      }

      const dec = shouldSkipHeartbeat({ reason: 'fg-loop', lat: coords.latitude, lng: coords.longitude });
      if (dec.skip) {
        const ageSec = hbAgeSecondsNow();
        console.log(`[HB] skip reason=fg-loop why=${dec.why} ageSec=${ageSec != null ? ageSec : 'n/a'}`);
        updateState((s) => ({ ...s, hbLoopActive: true }));
        return;
      }

      const hbResult = await sendHeartbeatSingleFlight({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        reason: 'fg-loop',
      });

      if (hbResult && hbResult.skipped) {
        console.log(`[HB] skip reason=fg-loop why=${hbResult.why} inFlightReason=${hbResult.inFlightReason || 'n/a'}`);
        updateState((s) => ({ ...s, hbLoopActive: true }));
        return;
      }

      updateState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        lastResp: hbResult.data,
        lastHeartbeatReason: 'fg-loop',
        lastHeartbeatLatencyMs: hbResult.latencyMs,
        lastHeartbeatAt: new Date().toISOString(),
        hbAgeSeconds: 0,
        hbLoopActive: true,
      }));
    } catch (e) {
      console.warn('[HB-Loop] tick failed:', (e && e.message) || e);
      updateState((s) => ({
        ...s,
        lastErr: `[hb-loop] ${(e && e.message) || e}`,
        hbLoopActive: true,
      }));
    }
  };

  runTick().catch(() => null);
  hbLoopTimerId = setInterval(runTick, HB_LOOP_SECONDS * 1000);
}

function stopHeartbeatLoop(updateState) {
  if (hbLoopTimerId) {
    clearInterval(hbLoopTimerId);
    hbLoopTimerId = null;
    console.log('[HB-Loop] stopped');
  }
  if (updateState) updateState((s) => ({ ...s, hbLoopActive: false }));
}

// ── BackgroundFetch register ─────────────────────────────────────────────────
async function ensureBackgroundFetch() {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_IDS.fetch);
  if (!registered) {
    try {
      console.log('[Fetch] registering BackgroundFetch…');
      await BackgroundFetch.registerTaskAsync(TASK_IDS.fetch, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (e) {
      console.warn('[Fetch] register failed:', (e && e.message) || e);
    }
  } else {
    console.log('[Fetch] already registered');
  }
}

// ── Diagnostics runtime status ───────────────────────────────────────────────
async function refreshRuntimeStatus(updateState) {
  try {
    const hasBgLoc = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);

    let fetchStatusLabel = 'unknown';
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (status === BackgroundFetch.BackgroundFetchStatus.Available) fetchStatusLabel = 'available';
      else if (status === BackgroundFetch.BackgroundFetchStatus.Denied) fetchStatusLabel = 'denied';
      else if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) fetchStatusLabel = 'restricted';
    } catch (e) {
      console.warn('[Diag] getStatusAsync failed:', (e && e.message) || e);
    }

    let deviceId = null;
    try {
      deviceId = await resolveDeviceId();
    } catch (e) {
      deviceId = null;
    }

    let interestsLabel = 'none';
    try {
      const ints = await loadInterestsCached();
      interestsLabel = Array.isArray(ints) && ints.length ? ints.join(',') : 'none';
    } catch (e) {
      interestsLabel = 'none';
    }

    updateState((s) => ({
      ...s,
      bgLocRunning: !!hasBgLoc,
      fetchStatus: fetchStatusLabel,
      deviceId,
      interestsLabel,
    }));

    console.log(
      '[Diag] deviceId=',
      deviceId,
      'bgLocRunning=',
      !!hasBgLoc,
      'fetchStatus=',
      fetchStatusLabel,
      'interests=',
      interestsLabel
    );
  } catch (e) {
    console.warn('[Diag] refreshRuntimeStatus failed:', (e && e.message) || e);
  }
}

// ── Permissions ──────────────────────────────────────────────────────────────
async function ensurePermissions(setState) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIF_CHANNELS.fg, {
      name: 'ULTREIA Service',
      importance: Notifications.AndroidImportance.MIN,
      vibrationPattern: [0],
      bypassDnd: false,
      sound: undefined,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    });

    await Notifications.setNotificationChannelAsync(NOTIF_CHANNELS.offers, {
      name: 'ULTREIA Offers',
      importance: Notifications.AndroidImportance.MAX,
    });

    const notifPermBefore = await Notifications.getPermissionsAsync();
    console.log('[Perm] notif before request:', notifPermBefore);
    const notifPerm = await Notifications.requestPermissionsAsync();
    console.log('[Perm] notif after request:', notifPerm);
    setState((s) => ({
      ...s,
      notifPermission: notifPerm && notifPerm.status ? notifPerm.status : 'unknown',
    }));
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  console.log('[Perm] fg location:', fg);
  setState((s) => ({ ...s, fgLocationPermission: fg.status || 'unknown' }));
  if (fg.status !== 'granted') throw new Error('Foreground location permission denied');

  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[Perm] bg location (request):', bg);
    setState((s) => ({ ...s, bgLocationPermission: bg.status || 'unknown' }));
    if (bg.status !== 'granted') console.warn('Background location permission not granted yet.');
    const bgCurrent = await Location.getBackgroundPermissionsAsync();
    console.log('[Perm] bg location (current):', bgCurrent);
  }
}

// ── UI ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'offers', label: 'Angebote' },
  { key: 'settings', label: 'Einstellungen' },
  { key: 'diagnostics', label: 'Diagnostik' },
];

function formatAge(hbAgeSeconds) {
  if (hbAgeSeconds == null) return '—';
  if (hbAgeSeconds < 60) return `${hbAgeSeconds}s`;
  return `${Math.floor(hbAgeSeconds / 60)}min ${hbAgeSeconds % 60}s`;
}

function formatTimeMaybe(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleTimeString();
  } catch (e) {
    return '—';
  }
}

function isTruthy(x) {
  return !!x;
}

export default function App() {
  const [state, setState] = useState({
    // Onboarding
    onboardingCompleted: false,
    onboardingStep: 0,
    prefAccommodation: true,
    prefFood: true,
    prefPharmacy: false,
    prefWater: true,

    // Runtime / Motor
    ready: false,
    lastOkAt: null,
    lastErr: null,
    lastResp: null,
    lastHeartbeatReason: null,
    lastHeartbeatLatencyMs: null,
    lastHeartbeatAt: null,
    hbAgeSeconds: null,
    bgLocRunning: false,
    fetchStatus: 'unknown',
    pushToken: null,
    fcmToken: null,
    deviceRegistered: false,
    lastNotification: null,
    notifPermission: 'unknown',
    fgLocationPermission: 'unknown',
    bgLocationPermission: 'unknown',
    hbLoopActive: false,

    // Identity / interests
    deviceId: null,
    interestsLabel: 'none',

    // Debug
    debugLastAction: null,
    debugLastResult: null,

    // UI
    activeTab: 'home',
    notifInbox: [],
  });

  const [hasRunInit, setHasRunInit] = useState(false);

  const appState = useRef(AppState.currentState);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // ── Boot: prefs + interests + inbox
  useEffect(() => {
    (async () => {
      try {
        const prefs = await loadPrefsFromStorage();
        if (prefs) {
          setState((s) => ({
            ...s,
            prefAccommodation: prefs.prefAccommodation,
            prefFood: prefs.prefFood,
            prefPharmacy: prefs.prefPharmacy,
            prefWater: prefs.prefWater,
          }));
        }
      } catch (e) {
        // ignore
      }

      try {
        const ints = await loadInterestsCached();
        setState((s) => ({ ...s, interestsLabel: Array.isArray(ints) && ints.length ? ints.join(',') : 'none' }));
      } catch (e) {
        // ignore
      }

      try {
        const inbox = await loadNotifInbox();
        setState((s) => ({ ...s, notifInbox: Array.isArray(inbox) ? inbox : [] }));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // ── Persist interests whenever prefs change
  useEffect(() => {
    const prefs = {
      prefAccommodation: state.prefAccommodation,
      prefFood: state.prefFood,
      prefPharmacy: state.prefPharmacy,
      prefWater: state.prefWater,
    };

    (async () => {
      const interests = await savePrefsAndInterests(prefs);
      setState((s) => ({ ...s, interestsLabel: interests.length ? interests.join(',') : 'none' }));
    })().catch(() => null);
  }, [state.prefAccommodation, state.prefFood, state.prefPharmacy, state.prefWater]);

  // ── AppState: rearm
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      appState.current = nextState;

      if (nextState === 'active') {
        try {
          console.log('[AppState] active → ensure BG running + refresh diag + watchdog-check + hb-loop');

          try {
            const deviceId = await resolveDeviceId();
            setState((s) => ({ ...s, deviceId }));
          } catch (e) {
            // ignore
          }

          try {
            const ints = await loadInterestsCached();
            setState((s) => ({ ...s, interestsLabel: Array.isArray(ints) && ints.length ? ints.join(',') : 'none' }));
          } catch (e) {
            // ignore
          }

          const hasBg = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
          if (!hasBg) {
            console.log('[ReArm] bgLoc not running → startBgLocation');
            await startBgLocation();
          }

          await refreshRuntimeStatus(setState);
          startHeartbeatLoop(setState);

          if (lastHeartbeatAtMs) {
            const ageSec = Math.floor((Date.now() - lastHeartbeatAtMs) / 1000);
            console.log('[Watchdog] HB age on active:', ageSec, 's');
            if (ageSec > WATCHDOG_STALE_SECONDS) {
              console.log('[Watchdog] HB stale → sending watchdog-rearm heartbeat');
              try {
                const hbResult = await sendImmediateHeartbeat('watchdog-rearm');
                setState((s) => ({
                  ...s,
                  lastOkAt: new Date(),
                  lastErr: null,
                  lastResp: hbResult.data,
                  lastHeartbeatReason: 'watchdog-rearm',
                  lastHeartbeatLatencyMs: hbResult.latencyMs,
                  lastHeartbeatAt: new Date().toISOString(),
                  hbAgeSeconds: 0,
                }));
              } catch (e) {
                console.warn('[Watchdog] watchdog-rearm failed:', (e && e.message) || e);
                setState((s) => ({ ...s, lastErr: `[watchdog] ${(e && e.message) || e}` }));
              }
            }
          }
        } catch (e) {
          console.warn('[ReArm/AppState] failed:', (e && e.message) || e);
        }
      }
    });

    return () => sub.remove();
  }, []);

  // ── Notifications listeners: update lastNotification + inbox
  useEffect(() => {
    const notifSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const content = notification && notification.request ? notification.request.content : {};
        const info = normalizeNotifItem({
          title: content.title || '',
          body: content.body || '',
          data: content.data || {},
          receivedAt: new Date().toISOString(),
        });

        console.log('[Notif] received:', info);

        setState((s) => {
          const nextInbox = [info, ...(Array.isArray(s.notifInbox) ? s.notifInbox : [])].slice(0, 50);
          persistNotifInbox(nextInbox).catch(() => null);
          return {
            ...s,
            lastNotification: JSON.stringify(info),
            notifInbox: nextInbox,
          };
        });
      } catch (e) {
        console.warn('[Notif] parse failed:', (e && e.message) || e);
      }
    });

    const respSub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notif] response:', response);
    });

    notificationListener.current = notifSub;
    responseListener.current = respSub;

    return () => {
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
      }
    };
  }, []);

  // ── Init sequence after onboarding
  useEffect(() => {
    if (!state.onboardingCompleted || hasRunInit) return;

    (async () => {
      try {
        let expoToken = null;
        let fcmToken = null;

        try {
          const deviceId = await resolveDeviceId();
          setState((s) => ({ ...s, deviceId }));
        } catch (e) {
          // ignore
        }

        try {
          const ints = await loadInterestsCached();
          setState((s) => ({ ...s, interestsLabel: Array.isArray(ints) && ints.length ? ints.join(',') : 'none' }));
        } catch (e) {
          // ignore
        }

        try {
          const projectId = getEasProjectIdMaybe();
          const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
          expoToken = tokenData.data;
          console.log('[Push] Expo token:', expoToken);
          setState((s) => ({ ...s, pushToken: expoToken }));
        } catch (e) {
          console.warn('[Push] getExpoPushTokenAsync failed:', (e && e.message) || e);
          setState((s) => ({ ...s, lastErr: `[PushToken] ${(e && e.message) || e}` }));
        }

        if (Platform.OS === 'android') {
          try {
            const nativeToken = await Notifications.getDevicePushTokenAsync();
            fcmToken = nativeToken && nativeToken.data ? nativeToken.data : null;
            console.log('[Push] FCM native token:', fcmToken);
            if (fcmToken) setState((s) => ({ ...s, fcmToken }));
          } catch (e) {
            console.warn('[Push] getDevicePushTokenAsync failed:', (e && e.message) || e);
            setState((s) => ({ ...s, lastErr: `[FCMToken] ${(e && e.message) || e}` }));
          }
        }

        try {
          const resp = await registerDevice({ expoPushToken: expoToken, fcmToken });
          console.log('[registerDevice] resp:', resp);
          if (resp && resp.ok) setState((s) => ({ ...s, deviceRegistered: true }));
        } catch (e) {
          console.warn('[registerDevice] failed:', (e && e.message) || e);
          setState((s) => ({ ...s, lastErr: `[register] ${(e && e.message) || e}` }));
        }

        if (appState.current === 'active') {
          await startBgLocation();
          startHeartbeatLoop(setState);
        } else {
          console.log('[INIT] app not active, BG/HB-Loop will be ensured on first active');
        }

        await ensureBackgroundFetch();
        await refreshRuntimeStatus(setState);

        const hbResult = await sendImmediateHeartbeat('init');

        setState((s) => ({
          ...s,
          ready: true,
          lastOkAt: new Date(),
          lastErr: null,
          lastResp: hbResult.data,
          lastHeartbeatReason: 'init',
          lastHeartbeatLatencyMs: hbResult.latencyMs,
          lastHeartbeatAt: new Date().toISOString(),
          hbAgeSeconds: 0,
        }));

        setHasRunInit(true);
      } catch (e) {
        console.warn('[INIT] failed:', (e && e.message) || e);
        setState((s) => ({ ...s, ready: false, lastErr: (e && e.message) || String(e) }));
      }
    })();

    return () => {
      stopHeartbeatLoop(setState);
    };
  }, [state.onboardingCompleted, hasRunInit]);

  // ── HB age poll (UI)
  useEffect(() => {
    const id = setInterval(() => {
      if (!lastHeartbeatAtMs) return;
      const ageSec = Math.floor((Date.now() - lastHeartbeatAtMs) / 1000);
      setState((s) => {
        const tsIso = new Date(lastHeartbeatAtMs).toISOString();
        if (s.hbAgeSeconds === ageSec && s.lastHeartbeatAt === tsIso) return s;
        return { ...s, lastHeartbeatAt: tsIso, hbAgeSeconds: ageSec };
      });
    }, WATCHDOG_POLL_SECONDS * 1000);

    return () => clearInterval(id);
  }, []);

  // ── UI actions
  const goNextOnboardingStep = () => setState((s) => ({ ...s, onboardingStep: s.onboardingStep + 1 }));
  const goPrevOnboardingStep = () =>
    setState((s) => ({ ...s, onboardingStep: s.onboardingStep > 0 ? s.onboardingStep - 1 : 0 }));
  const togglePref = (key) => setState((s) => ({ ...s, [key]: !s[key] }));
  const setTab = (key) => setState((s) => ({ ...s, activeTab: key }));

  const handleMotorStart = async () => {
    try {
      console.log('[Onboarding] Motor starten → ensurePermissions');
      await ensurePermissions(setState);

      try {
        const deviceId = await resolveDeviceId();
        setState((s) => ({ ...s, deviceId }));
      } catch (e) {
        // ignore
      }

      try {
        await savePrefsAndInterests({
          prefAccommodation: state.prefAccommodation,
          prefFood: state.prefFood,
          prefPharmacy: state.prefPharmacy,
          prefWater: state.prefWater,
        });
      } catch (e) {
        // ignore
      }

      setState((s) => ({ ...s, onboardingCompleted: true }));
    } catch (e) {
      console.warn('[Onboarding] ensurePermissions failed:', (e && e.message) || e);
      setState((s) => ({ ...s, lastErr: `[OnboardingPerms] ${(e && e.message) || e}` }));
    }
  };

  const onManualPing = async () => {
    try {
      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
      const hbResult = await sendHeartbeatSingleFlight({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        reason: 'manual',
      });

      if (hbResult && hbResult.skipped) {
        setState((s) => ({ ...s, lastErr: `[manual] skipped (${hbResult.why})` }));
        return;
      }

      setState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        lastResp: hbResult.data,
        lastHeartbeatReason: 'manual',
        lastHeartbeatLatencyMs: hbResult.latencyMs,
        lastHeartbeatAt: new Date().toISOString(),
        hbAgeSeconds: 0,
      }));
    } catch (e) {
      setState((s) => ({ ...s, lastErr: (e && e.message) || String(e) }));
    }
  };

  const onLocalTestNotification = async () => {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'ULTREIA Lokal',
          body: 'Lokaler Test-Push (ohne Expo/FCM).',
          data: { source: 'local-test' },
          sound: 'default',
        },
        trigger: null,
      });
      console.log('[LocalNotif] scheduled id:', id);
    } catch (e) {
      console.warn('[LocalNotif] failed:', (e && e.message) || e);
      setState((s) => ({ ...s, lastErr: `[LocalNotif] ${(e && e.message) || e}` }));
    }
  };

  const onRefreshBgStatus = async () => {
    await refreshRuntimeStatus(setState);
  };

  const onSeedOfferHere = async () => {
    try {
      setState((s) => ({ ...s, lastErr: null, debugLastAction: 'seed-offer', debugLastResult: null }));

      const deviceId = await resolveDeviceId();
      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });

      try {
        await loadInterestsCached();
      } catch (e) {
        // ignore
      }

      const category = Array.isArray(currentInterests) && currentInterests.length ? currentInterests[0] : 'restaurant';

      const resp = await postJson('/debug/seed-offer', {
        deviceId,
        lat: coords.latitude,
        lng: coords.longitude,
        category,
        radiusMeters: DEBUG_OFFER_RADIUS_M,
        validMinutes: DEBUG_OFFER_VALID_MIN,
        title: `Debug Offer (${category})`,
      });

      setState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        debugLastAction: 'seed-offer',
        debugLastResult: safeJsonStringify(resp),
        lastResp: resp,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        lastErr: `[debug/seed-offer] ${(e && e.message) || e}`,
        debugLastAction: 'seed-offer',
        debugLastResult: e && e.data ? safeJsonStringify(e.data) : null,
      }));
    }
  };

  const onDebugPushFcm = async () => {
    try {
      setState((s) => ({ ...s, lastErr: null, debugLastAction: 'push-fcm', debugLastResult: null }));

      const deviceId = await resolveDeviceId();
      const resp = await postJson('/debug/push-fcm', {
        deviceId,
        title: 'ULTREIA Debug (FCM)',
        body: `Test Push via FCM @ ${new Date().toLocaleTimeString()}`,
        data: { kind: 'debug-fcm', ts: new Date().toISOString() },
      });

      setState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        debugLastAction: 'push-fcm',
        debugLastResult: safeJsonStringify(resp),
        lastResp: resp,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        lastErr: `[debug/push-fcm] ${(e && e.message) || e}`,
        debugLastAction: 'push-fcm',
        debugLastResult: e && e.data ? safeJsonStringify(e.data) : null,
      }));
    }
  };

  const onDebugPushExpo = async () => {
    try {
      setState((s) => ({ ...s, lastErr: null, debugLastAction: 'push-expo', debugLastResult: null }));

      const deviceId = await resolveDeviceId();
      const resp = await postJson('/debug/push-expo', {
        deviceId,
        title: 'ULTREIA Debug (Expo)',
        body: `Test Push via Expo @ ${new Date().toLocaleTimeString()}`,
        data: { kind: 'debug-expo', ts: new Date().toISOString() },
      });

      setState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        debugLastAction: 'push-expo',
        debugLastResult: safeJsonStringify(resp),
        lastResp: resp,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        lastErr: `[debug/push-expo] ${(e && e.message) || e}`,
        debugLastAction: 'push-expo',
        debugLastResult: e && e.data ? safeJsonStringify(e.data) : null,
      }));
    }
  };

  const onClearInbox = async () => {
    setState((s) => ({ ...s, notifInbox: [] }));
    await persistNotifInbox([]);
  };

  const shortExpoToken = state.pushToken ? String(state.pushToken).slice(0, 22) + '…' : '—';
  const shortFcmToken = state.fcmToken ? String(state.fcmToken).slice(0, 22) + '…' : '—';

  const hbAgeText = formatAge(state.hbAgeSeconds);

  const hbStats = useMemo(() => {
    if (hbIntervals.length <= 0) return { statsText: '—', histText: '—' };

    let sum = 0;
    let min = hbIntervals[0];
    let max = hbIntervals[0];
    for (let i = 0; i < hbIntervals.length; i += 1) {
      const v = hbIntervals[i];
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const avg = sum / hbIntervals.length;
    const statsText = `n=${hbIntervals.length}, min=${min}s, Ø=${avg.toFixed(1)}s, max=${max}s`;

    const bucketDefs = [
      { label: '<30s', min: 0, max: 29 },
      { label: '30–59s', min: 30, max: 59 },
      { label: '60–119s', min: 60, max: 119 },
      { label: '120–299s', min: 120, max: 299 },
      { label: '>=300s', min: 300, max: Infinity },
    ];
    const bucketCounts = bucketDefs.map(() => 0);

    for (let i = 0; i < hbIntervals.length; i += 1) {
      const v = hbIntervals[i];
      for (let j = 0; j < bucketDefs.length; j += 1) {
        const b = bucketDefs[j];
        if (v >= b.min && v <= b.max) {
          bucketCounts[j] += 1;
          break;
        }
      }
    }

    const histText = bucketDefs.map((b, idx) => `${b.label}:${bucketCounts[idx]}`).join(' | ');
    return { statsText, histText };
  }, [state.hbAgeSeconds]); // leichte Triggerung über UI-Tick, hbIntervals ist global

  const prefsSummary = useMemo(() => {
    return [
      state.prefAccommodation && 'Schlafplätze',
      state.prefFood && 'Essen/Trinken',
      state.prefPharmacy && 'Apotheken',
      state.prefWater && 'Wasser',
    ]
      .filter(isTruthy)
      .join(', ');
  }, [state.prefAccommodation, state.prefFood, state.prefPharmacy, state.prefWater]);

  // ── Onboarding UI (unverändert inhaltlich, nur Styles leicht modernisiert)
  if (!state.onboardingCompleted) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.heroTitle}>ULTREIA</Text>
        <Text style={styles.heroSub}>Camino Francés – Context Push</Text>

        {state.onboardingStep === 0 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Wie ULTREIA funktioniert</Text>
              <Text style={styles.p}>
                Ultreia läuft wie eine Navigations-App im Hintergrund und sendet in regelmäßigen Herzschlägen deine Position
                an unseren Server. So können wir dich genau im richtigen Moment auf Schlafplätze, Essen oder Hilfe in deiner
                Nähe hinweisen.
              </Text>
              <Text style={styles.p}>
                Wir achten auf deinen Akku:{'\n'}• schnelle Trigger bei Bewegung/“Enter”{'\n'}• weniger Aktivität, wenn du
                still sitzt oder schläfst{'\n'}• keine Dauer-Flut – nur dann, wenn es relevant ist.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={goNextOnboardingStep}>
              <Text style={styles.btnText}>Weiter</Text>
            </TouchableOpacity>
          </>
        )}

        {state.onboardingStep === 1 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Was ist für dich relevant?</Text>
              <Text style={styles.p}>Du kannst das später jederzeit in den Einstellungen ändern.</Text>

              <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefAccommodation')}>
                <Text style={styles.toggleText}>
                  [{state.prefAccommodation ? '✓' : ' '}] Schlafplätze (Albergues) in der Nähe
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefFood')}>
                <Text style={styles.toggleText}>[{state.prefFood ? '✓' : ' '}] Essen & Trinken (Menú Peregrino, Bars)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefPharmacy')}>
                <Text style={styles.toggleText}>[{state.prefPharmacy ? '✓' : ' '}] Apotheken & medizinische Hilfe</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefWater')}>
                <Text style={styles.toggleText}>[{state.prefWater ? '✓' : ' '}] Wasserstellen & Versorgungspunkte</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={goPrevOnboardingStep}>
                <Text style={styles.btnText}>Zurück</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.rowButton]} onPress={goNextOnboardingStep}>
                <Text style={styles.btnText}>Weiter</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {state.onboardingStep >= 2 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Berechtigungen</Text>
              <Text style={styles.p}>
                Um dich im richtigen Moment zu erreichen, braucht Ultreia Zugriff auf Standort und Notifications. Bitte wähle
                im Standort-Dialog idealerweise „Immer erlauben“.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleMotorStart}>
              <Text style={styles.btnText}>Verstanden – Motor starten</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={goPrevOnboardingStep}>
              <Text style={styles.btnText}>Zurück</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  // ── App Shell
  const renderTopBar = () => {
    return (
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>ULTREIA</Text>
          <Text style={styles.topBarSub}>
            {state.ready ? 'Aktiv' : 'Init…'} • HB {hbAgeText} • {state.bgLocRunning ? 'BG an' : 'BG aus'}
          </Text>
        </View>
        <TouchableOpacity style={styles.chip} onPress={onRefreshBgStatus}>
          <Text style={styles.chipText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabBar = () => {
    return (
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = state.activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, active ? styles.tabBtnActive : null]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Screens
  const HomeScreen = () => {
    const okAt = state.lastOkAt ? formatTimeMaybe(state.lastOkAt) : '—';
    const hbAt = state.lastHeartbeatAt ? formatTimeMaybe(state.lastHeartbeatAt) : '—';
    const interests = state.interestsLabel || 'none';

    return (
      <>
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <Text style={styles.kv}>Bereit: <Text style={styles.kvVal}>{state.ready ? 'Ja' : 'Nein'}</Text></Text>
            <Text style={styles.kv}>BG-Task: <Text style={styles.kvVal}>{state.bgLocRunning ? 'Läuft' : 'Aus'}</Text></Text>
            <Text style={styles.kv}>Fetch: <Text style={styles.kvVal}>{state.fetchStatus}</Text></Text>
            <Text style={styles.kv}>HB-Loop: <Text style={styles.kvVal}>{state.hbLoopActive ? 'Aktiv' : 'Inaktiv'}</Text></Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Heartbeat</Text>
            <Text style={styles.kv}>Alter: <Text style={styles.kvVal}>{hbAgeText}</Text></Text>
            <Text style={styles.kv}>Letzter OK: <Text style={styles.kvVal}>{okAt}</Text></Text>
            <Text style={styles.kv}>Letzter HB: <Text style={styles.kvVal}>{hbAt}</Text></Text>
            <Text style={styles.kv}>Reason: <Text style={styles.kvVal}>{state.lastHeartbeatReason || '—'}</Text></Text>
            <Text style={styles.kv}>
              Latenz: <Text style={styles.kvVal}>{state.lastHeartbeatLatencyMs != null ? `${state.lastHeartbeatLatencyMs} ms` : '—'}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dein Fokus</Text>
          <Text style={styles.p}>Aktiv: {prefsSummary || '—'}</Text>

          <View style={styles.pillRow}>
            <TouchableOpacity style={[styles.pill, state.prefAccommodation ? styles.pillOn : styles.pillOff]} onPress={() => togglePref('prefAccommodation')}>
              <Text style={styles.pillText}>Schlaf</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, state.prefFood ? styles.pillOn : styles.pillOff]} onPress={() => togglePref('prefFood')}>
              <Text style={styles.pillText}>Essen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, state.prefPharmacy ? styles.pillOn : styles.pillOff]} onPress={() => togglePref('prefPharmacy')}>
              <Text style={styles.pillText}>Apotheke</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pill, state.prefWater ? styles.pillOn : styles.pillOff]} onPress={() => togglePref('prefWater')}>
              <Text style={styles.pillText}>Wasser</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.smallMuted}>Backend-Kategorien: {interests}</Text>
        </View>

        {state.lastErr ? (
          <View style={[styles.card, styles.cardDanger]}>
            <Text style={styles.cardTitle}>Hinweis</Text>
            <Text style={styles.errText}>{state.lastErr}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aktionen</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.primaryBtn, styles.rowButton]} onPress={onManualPing}>
              <Text style={styles.btnText}>Heartbeat senden</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={onLocalTestNotification}>
              <Text style={styles.btnText}>Lokaler Test</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={onSeedOfferHere}>
              <Text style={styles.btnText}>Test-Offer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={() => setTab('offers')}>
              <Text style={styles.btnText}>Zu Angeboten</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Letzte Notification</Text>
          {state.notifInbox && state.notifInbox.length ? (
            <>
              <Text style={styles.pStrong}>{state.notifInbox[0].title || '—'}</Text>
              <Text style={styles.p}>{state.notifInbox[0].body || '—'}</Text>
              <Text style={styles.smallMuted}>{formatTimeMaybe(state.notifInbox[0].receivedAt)}</Text>
            </>
          ) : (
            <Text style={styles.p}>Noch keine Notification empfangen.</Text>
          )}
        </View>
      </>
    );
  };

  const OffersScreen = () => {
    const inbox = Array.isArray(state.notifInbox) ? state.notifInbox : [];
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Angebote (Inbox)</Text>
          <Text style={styles.p}>
            Hier erscheinen empfangene Push-Nachrichten. Später wird daraus ein echtes Offer-Feed (mit Details/CTA).
          </Text>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={onDebugPushFcm}>
              <Text style={styles.btnText}>Debug Push (FCM)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, styles.rowButton]} onPress={onDebugPushExpo}>
              <Text style={styles.btnText}>Debug Push (Expo)</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.ghostBtn} onPress={onClearInbox}>
            <Text style={styles.ghostBtnText}>Inbox leeren</Text>
          </TouchableOpacity>
        </View>

        {inbox.length ? (
          inbox.map((n, idx) => {
            const key = `${n.receivedAt || 't'}-${idx}`;
            return (
              <View key={key} style={styles.card}>
                <Text style={styles.pStrong}>{n.title || '—'}</Text>
                <Text style={styles.p}>{n.body || '—'}</Text>
                <Text style={styles.smallMuted}>{formatTimeMaybe(n.receivedAt)}</Text>
                {n.data && Object.keys(n.data).length ? (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{safeJsonStringify(n.data)}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.card}>
            <Text style={styles.p}>Keine Einträge. Sende einen Debug-Push oder warte auf reale Matches.</Text>
          </View>
        )}
      </>
    );
  };

  const SettingsScreen = () => {
    const deviceId = state.deviceId || '—';
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Einstellungen</Text>
          <Text style={styles.p}>Interessen steuern, ohne den Motor zu verändern.</Text>

          <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefAccommodation')}>
            <Text style={styles.toggleText}>[{state.prefAccommodation ? '✓' : ' '}] Schlafplätze</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefFood')}>
            <Text style={styles.toggleText}>[{state.prefFood ? '✓' : ' '}] Essen & Trinken</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefPharmacy')}>
            <Text style={styles.toggleText}>[{state.prefPharmacy ? '✓' : ' '}] Apotheken</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefWater')}>
            <Text style={styles.toggleText}>[{state.prefWater ? '✓' : ' '}] Wasserstellen</Text>
          </TouchableOpacity>

          <View style={styles.hr} />

          <Text style={styles.smallMuted}>DeviceId</Text>
          <Text style={styles.pStrong} numberOfLines={1}>{deviceId}</Text>

          <Text style={styles.smallMuted}>API</Text>
          <Text style={styles.p} numberOfLines={2}>{API_BASE}</Text>
        </View>
      </>
    );
  };

  const DiagnosticsScreen = () => {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diagnostik</Text>

          <Text style={styles.kv}>Device: <Text style={styles.kvVal}>{state.deviceId || '—'}</Text></Text>
          <Text style={styles.kv}>Interests (cache): <Text style={styles.kvVal}>{state.interestsLabel || 'none'}</Text></Text>
          <Text style={styles.kv}>Expo Token: <Text style={styles.kvVal}>{shortExpoToken}</Text></Text>
          <Text style={styles.kv}>FCM Token: <Text style={styles.kvVal}>{shortFcmToken}</Text></Text>
          <Text style={styles.kv}>Device-Register: <Text style={styles.kvVal}>{state.deviceRegistered ? 'OK' : 'noch nicht'}</Text></Text>

          <View style={styles.hr} />

          <Text style={styles.kv}>Notif-Permission: <Text style={styles.kvVal}>{state.notifPermission}</Text></Text>
          <Text style={styles.kv}>FG-Location: <Text style={styles.kvVal}>{state.fgLocationPermission}</Text></Text>
          <Text style={styles.kv}>BG-Location: <Text style={styles.kvVal}>{state.bgLocationPermission}</Text></Text>

          <View style={styles.hr} />

          <Text style={styles.kv}>HB-Intervall Stats: <Text style={styles.kvVal}>{hbStats.statsText}</Text></Text>
          <Text style={styles.kv}>HB-Histogramm: <Text style={styles.kvVal}>{hbStats.histText}</Text></Text>

          {state.lastErr ? (
            <View style={[styles.cardInner, styles.cardDangerInner]}>
              <Text style={styles.pStrong}>Fehler</Text>
              <Text style={styles.errText}>{state.lastErr}</Text>
            </View>
          ) : null}
        </View>

        {state.debugLastAction || state.debugLastResult ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Debug</Text>
            <Text style={styles.kv}>Aktion: <Text style={styles.kvVal}>{state.debugLastAction || '—'}</Text></Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{state.debugLastResult ? state.debugLastResult : '—'}</Text>
            </View>
          </View>
        ) : null}

        {state.lastResp ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Letzte Server-Response</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{safeJsonStringify(state.lastResp)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test-Aktionen</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onManualPing}>
            <Text style={styles.btnText}>Jetzt Heartbeat senden</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onSeedOfferHere}>
            <Text style={styles.btnText}>Test-Offer hier erstellen</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onDebugPushFcm}>
            <Text style={styles.btnText}>Debug Push (FCM)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onDebugPushExpo}>
            <Text style={styles.btnText}>Debug Push (Expo)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onLocalTestNotification}>
            <Text style={styles.btnText}>Lokale Test-Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hinweise</Text>
          <Text style={styles.p}>
            • Android kann BG-Updates dichter als 60s liefern → Dedupe mit HB_MIN_GAP_SECONDS (~55s).{'\n'}
            • Single-flight verhindert Doppel-Trigger (interval=0s).{'\n'}
            • Tier A: expo-location + ForegroundService Notification.{'\n'}
            • Tier B: BackgroundFetch Watchdog (rearm + stale HB).{'\n'}
            • Tier C: Booster bei Movement-Bursts (rate-limited).{'\n'}
            • Interests werden in AsyncStorage persistiert (Headless-sicher nach Reboot).
          </Text>
        </View>
      </>
    );
  };

  const renderScreen = () => {
    if (state.activeTab === 'offers') return <OffersScreen />;
    if (state.activeTab === 'settings') return <SettingsScreen />;
    if (state.activeTab === 'diagnostics') return <DiagnosticsScreen />;
    return <HomeScreen />;
  };

  return (
    <View style={styles.shell}>
      {renderTopBar()}
      {renderTabBar()}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
        {renderScreen()}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#0b0b0c' },
  scroll: { flex: 1, backgroundColor: '#0b0b0c' },

  container: {
    flexGrow: 1,
    backgroundColor: '#0b0b0c',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 40,
  },

  screen: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },

  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 6, letterSpacing: 0.4 },
  heroSub: { color: '#9aa0a6', marginBottom: 18 },

  topBar: {
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1d21',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0b0c',
  },
  topBarTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  topBarSub: { color: '#9aa0a6', fontSize: 12, marginTop: 2 },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#1b1c1f',
    borderWidth: 1,
    borderColor: '#2a2b31',
  },
  chipText: { color: '#cfcfcf', fontWeight: '700', fontSize: 12 },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#0b0b0c',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1d21',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#121317',
    borderWidth: 1,
    borderColor: '#1c1d21',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#1b1c1f',
    borderColor: '#2a2b31',
  },
  tabText: { color: '#9aa0a6', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#ffffff' },

  grid: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: '#121317',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1c1d21',
    marginBottom: 12,
    flex: 1,
  },
  cardInner: {
    marginTop: 10,
    backgroundColor: '#0f1013',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1c1d21',
  },
  cardDanger: { borderColor: '#3a1f24' },
  cardDangerInner: { borderColor: '#3a1f24' },
  cardTitle: { color: '#fff', fontWeight: '800', marginBottom: 8, fontSize: 14 },
  p: { color: '#cfcfcf', lineHeight: 20 },
  pStrong: { color: '#ffffff', fontWeight: '800', marginBottom: 6 },
  smallMuted: { color: '#9aa0a6', marginTop: 10, fontSize: 12 },

  kv: { color: '#cfcfcf', marginBottom: 6 },
  kvVal: { color: '#ffffff', fontWeight: '700' },

  errText: { color: '#ff6b6b', lineHeight: 20 },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#3b5ccc',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: '#2f8f6b',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ghostBtn: {
    marginTop: 12,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2b31',
  },
  ghostBtnText: { color: '#cfcfcf', fontWeight: '800' },
  btnText: { color: '#fff', fontWeight: '800' },

  toggleRow: { marginTop: 10, paddingVertical: 10 },
  toggleText: { color: '#cfcfcf' },

  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2b31',
  },
  pillOn: { backgroundColor: '#1b1c1f' },
  pillOff: { backgroundColor: '#0f1013' },
  pillText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  row: { flexDirection: 'row', marginTop: 10, gap: 10 },
  rowButton: { flex: 1 },

  hr: { height: 1, backgroundColor: '#1c1d21', marginVertical: 12 },

  codeBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0f1013',
    borderWidth: 1,
    borderColor: '#1c1d21',
  },
  codeText: { color: '#cfcfcf', fontSize: 12 },
});
