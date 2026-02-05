// C:\ultreia\mobile\App.js
// ULTREIA – Heartbeat + Push MVP (JS-only, robust background strategy)
//
// 3-stufige Strategie (Event-first, Poll-second):
// A) BG-Location + Android Foreground-Service Notification (primärer Motor)
// B) BackgroundFetch/TaskManager Watchdog (Recovery + Self-Heal)
// C) “Booster”-Heartbeats bei Location-Events (edge burst / movement-based)
//
// WICHTIG (Realität Android):
// - Exakt 60s “für immer” ist ohne echten nativen Foreground-Service schwer.
// - expo-location foregroundService ist der beste JS-only Weg; wir machen es so sticky wie möglich
//   (rearm via Watchdog, startOnBoot, stopOnTerminate=false, OS-Status-Diagnostics).
//
// Fokus: Stabilität/Diagnostik/Token-Hygiene/Dedupe korrekt.

import React, { useEffect, useRef, useState } from 'react';
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
};

// ── Tuning (Fußgänger-UX, akzeptabler Rhythmus) ───────────────────────────────
// BG Location: lieber “bewegungsnah” statt starrer Sekunden-Takt.
// timeInterval hilft Android beim Scheduling, aber Bewegung/Doze bestimmen real.
const BG_TIME_SECONDS = 60; // nominell
const BG_DISTANCE_METERS = 25; // reagiert flott beim Gehen

// Globales Dedupe: Android kann Updates in 20–40s liefern → wir senden nicht jedes Event.
// Ziel: im Normalfall ~60s, bei Doze auch mal länger.
const HB_MIN_GAP_SECONDS = 55;

// “Booster”: Wenn wir Bewegung sehen, sofortiger Heartbeat (einmalig pro Burst).
const BOOSTER_MIN_GAP_SECONDS = 45;
const BOOSTER_MOVE_METERS = 60;

// Foreground-Loop (nur wenn App aktiv): Diagnostics + “immer warm”
const HB_LOOP_SECONDS = 45;

// Watchdog: ab diesem Alter versuchen wir Self-Heal (auch via Fetch)
const WATCHDOG_STALE_SECONDS = 3 * 60;
const WATCHDOG_POLL_SECONDS = 30;

// Debug Defaults
const DEBUG_OFFER_RADIUS_M = 200;
const DEBUG_OFFER_VALID_MIN = 30;

// API Base
const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) || 'http://10.0.2.2:4000/api';

// Interessen global (Memory Cache)
let currentInterests = null;
let interestsCacheLoaded = false;

// Global last HB
let lastHeartbeatAtMs = null;
// Intervals history
let hbIntervals = [];

// Last sent coords for skip logic
let lastSentCoords = null;

// Foreground timer
let hbLoopTimerId = null;

// Last coords snapshot for movement-based decisions
let lastCoordsForBooster = null;
// Last booster fire time
let lastBoosterAtMs = null;

// ── DeviceId (ohne extra Dependencies) ────────────────────────────────────────
// Stabil “genug” via FCM Token (primär), sonst Expo Token, sonst deterministischer Fallback.
// WICHTIG: niemals aktiv “upgraden” (kein DEVICE_ID reset), sonst wechseln DeviceIDs mitten im Betrieb.
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

  // 1) FCM Token (Android)
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

  // 2) Expo Push Token
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

  // 3) Deterministischer Fallback (ohne Date.now -> bleibt stabil zwischen Sessions “genug”)
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

  // fallback: prefs → interests
  try {
    const prefs = await loadPrefsFromStorage();
    if (prefs) {
      const interests = normalizeInterests(buildInterestsFromPrefs(prefs));
      currentInterests = interests;
      interestsCacheLoaded = true;
      console.log('[Interests] derived from stored prefs:', interests);
      // also persist derived interests to keep storage consistent
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

  interestsCacheLoaded = true; // prevent repeated IO storms
  currentInterests = currentInterests || [];
  console.log('[Interests] none available (storage empty)');
  return currentInterests;
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

  // Hard allow list: manual/debug/init/watchdog-rearm dürfen immer (Diagnose/Recovery)
  const forceReasons = new Set(['manual', 'init', 'watchdog-rearm', 'fetch-watchdog', 'booster-move']);
  if (forceReasons.has(String(reason || ''))) return { skip: false, why: 'force' };

  if (ageSec != null && ageSec < HB_MIN_GAP_SECONDS) {
    // Wenn wir uns signifikant bewegt haben, nicht skippen (auch wenn der Takt enger ist).
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
async function sendHeartbeat({ lat, lng, accuracy, reason = 'unknown', interests }) {
  const startedAt = Date.now();

  let finalInterests = null;
  if (Array.isArray(interests) && interests.length > 0) {
    finalInterests = normalizeInterests(interests);
  } else if (Array.isArray(currentInterests) && currentInterests.length > 0) {
    finalInterests = currentInterests;
  } else {
    // Headless/after reboot: attempt lazy-load from storage once
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

async function sendImmediateHeartbeat(reason) {
  const coords = await resolveCoordsForHeartbeat();
  if (!coords) throw new Error('No coords available');
  return sendHeartbeat({
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
// Tier A event-first, aber deduped (HB_MIN_GAP_SECONDS), sonst flutet Android teils mit 30s Updates.
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

    // Ensure interests available in headless context (once)
    try {
      if (!Array.isArray(currentInterests) || currentInterests.length === 0) {
        await loadInterestsCached();
      }
    } catch (e) {
      // ignore
    }

    // Deduped event-first HB
    try {
      const dec = shouldSkipHeartbeat({ reason: 'bg-location', lat, lng });
      if (dec.skip) {
        const ageSec = hbAgeSecondsNow();
        console.log(`[HB] skip reason=bg-location why=${dec.why} ageSec=${ageSec != null ? ageSec : 'n/a'}`);
      } else {
        await sendHeartbeat({ lat, lng, accuracy: acc, reason: 'bg-location' });
      }
    } catch (e2) {
      console.warn('[BG TASK] heartbeat failed:', (e2 && e2.message) || e2);
    }

    // Booster: große Bewegung, rate-limited
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
            await sendHeartbeat({ lat, lng, accuracy: acc, reason: 'booster-move' });
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

// ── BackgroundFetch Task (Tier B Watchdog) ────────────────────────────────────
// Responsibilities:
// - Ensure BG location updates are started (rearm)
// - If HB is stale -> send a heartbeat using lastKnown (or current if possible)
try {
  TaskManager.defineTask(TASK_IDS.fetch, async () => {
    console.log('[FETCH TASK] tick');

    try {
      // Rearm BG Location if needed
      try {
        const hasBg = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
        if (!hasBg) {
          console.log('[FETCH TASK] bgLoc not running -> rearm startBgLocation');
          await startBgLocation();
        }
      } catch (eRearm) {
        console.warn('[FETCH TASK] rearm check failed:', (eRearm && eRearm.message) || eRearm);
      }

      // Ensure interests available in headless context (once)
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
        await sendHeartbeat({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          reason: 'fetch-watchdog',
        });
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

// ── BG Location Start (Tier A) ───────────────────────────────────────────────
// expo-location uses an Android foreground service for background updates when foregroundService is provided.
// We do our best to make it persistent; rearm happens via AppState + Fetch watchdog.
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

// ── Foreground Heartbeat Loop (nur wenn App aktiv) ───────────────────────────
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

      const hbResult = await sendHeartbeat({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        reason: 'fg-loop',
      });

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

// ── BackgroundFetch register (Tier B) ────────────────────────────────────────
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

    // also show interests status (useful after reboot/headless)
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
export default function App() {
  const [state, setState] = useState({
    // Onboarding
    onboardingCompleted: false,
    onboardingStep: 0,
    prefAccommodation: true,
    prefFood: true,
    prefPharmacy: false,
    prefWater: true,

    // Diagnostics
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

    // Device
    deviceId: null,

    // Interests UI
    interestsLabel: 'none',

    // Debug
    debugLastAction: null,
    debugLastResult: null,
  });

  const [hasRunInit, setHasRunInit] = useState(false);

  const appState = useRef(AppState.currentState);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // Early hydration: prefs + interests from AsyncStorage (so UI & BG share same baseline)
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
    })();
  }, []);

  // interests (persist)
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

  // AppState rearm + active loop
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

          // make sure interests are loaded (after reboot it might be empty until UI toggles)
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

  // Notification listeners
  useEffect(() => {
    const notifSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const content = notification && notification.request ? notification.request.content : {};
        const info = {
          title: content.title || '',
          body: content.body || '',
          data: content.data || {},
          receivedAt: new Date().toISOString(),
        };
        console.log('[Notif] received:', info);
        setState((s) => ({ ...s, lastNotification: JSON.stringify(info) }));
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

  // Init after onboarding
  useEffect(() => {
    if (!state.onboardingCompleted || hasRunInit) return;

    (async () => {
      try {
        let expoToken = null;
        let fcmToken = null;

        // deviceId early
        try {
          const deviceId = await resolveDeviceId();
          setState((s) => ({ ...s, deviceId }));
        } catch (e) {
          // ignore
        }

        // Ensure interests loaded before any headless motor sends HBs
        try {
          const ints = await loadInterestsCached();
          setState((s) => ({ ...s, interestsLabel: Array.isArray(ints) && ints.length ? ints.join(',') : 'none' }));
        } catch (e) {
          // ignore
        }

        // Expo token
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

        // FCM token
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

        // register
        try {
          const resp = await registerDevice({ expoPushToken: expoToken, fcmToken });
          console.log('[registerDevice] resp:', resp);
          if (resp && resp.ok) setState((s) => ({ ...s, deviceRegistered: true }));
        } catch (e) {
          console.warn('[registerDevice] failed:', (e && e.message) || e);
          setState((s) => ({ ...s, lastErr: `[register] ${(e && e.message) || e}` }));
        }

        // Start BG + FG loop if active
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

  // Watchdog age update (UI only)
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

  // ── Onboarding handlers ────────────────────────────────────────────────────
  const goNextOnboardingStep = () => setState((s) => ({ ...s, onboardingStep: s.onboardingStep + 1 }));
  const goPrevOnboardingStep = () =>
    setState((s) => ({ ...s, onboardingStep: s.onboardingStep > 0 ? s.onboardingStep - 1 : 0 }));
  const togglePref = (key) => setState((s) => ({ ...s, [key]: !s[key] }));

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

      // persist current prefs/interests explicitly (so reboot/headless has them even if user never opens again)
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const onManualPing = async () => {
    try {
      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
      const hbResult = await sendHeartbeat({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        reason: 'manual',
      });
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

      // Ensure interests present for category selection too
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

  // ── UI derived ─────────────────────────────────────────────────────────────
  const shortExpoToken = state.pushToken ? String(state.pushToken).slice(0, 22) + '…' : '—';
  const shortFcmToken = state.fcmToken ? String(state.fcmToken).slice(0, 22) + '…' : '—';

  const hbAgeText =
    state.hbAgeSeconds == null
      ? '—'
      : state.hbAgeSeconds < 60
      ? `${state.hbAgeSeconds}s`
      : `${Math.floor(state.hbAgeSeconds / 60)}min ${state.hbAgeSeconds % 60}s`;

  let hbStatsText = '—';
  let hbHistogramText = '—';

  if (hbIntervals.length > 0) {
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
    hbStatsText = `n=${hbIntervals.length}, min=${min}s, Ø=${avg.toFixed(1)}s, max=${max}s`;

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

    hbHistogramText = bucketDefs.map((b, idx) => `${b.label}:${bucketCounts[idx]}`).join(' | ');
  }

  // ── Onboarding UI ──────────────────────────────────────────────────────────
  if (!state.onboardingCompleted) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>ULTREIA – Pilger-Herzschlag</Text>

        {state.onboardingStep === 0 && (
          <>
            <Text style={styles.line}>
              Ultreia läuft wie eine Navigations-App im Hintergrund und sendet in regelmäßigen Herzschlägen deine Position
              an unseren Server. So können wir dich genau im richtigen Moment auf Schlafplätze, Essen oder Hilfe in deiner
              Nähe hinweisen.
            </Text>
            <Text style={styles.line}>
              Wir achten auf deinen Akku:{'\n'}• schnelle Trigger bei Bewegung/“Enter”{'\n'}• weniger Aktivität, wenn du
              still sitzt oder schläfst{'\n'}• keine Dauer-Flut – nur dann, wenn es relevant ist.
            </Text>

            <TouchableOpacity style={styles.btn} onPress={goNextOnboardingStep}>
              <Text style={styles.btnText}>Weiter</Text>
            </TouchableOpacity>
          </>
        )}

        {state.onboardingStep === 1 && (
          <>
            <Text style={styles.line}>
              Worauf soll Ultreia dich unterwegs aufmerksam machen? Du kannst das später jederzeit anpassen.
            </Text>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefAccommodation')}>
              <Text style={styles.toggleText}>
                [{state.prefAccommodation ? '✓' : ' '}] Schlafplätze (Albergues) in der Nähe
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefFood')}>
              <Text style={styles.toggleText}>
                [{state.prefFood ? '✓' : ' '}] Essen & Trinken (Menú Peregrino, Bars)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefPharmacy')}>
              <Text style={styles.toggleText}>[{state.prefPharmacy ? '✓' : ' '}] Apotheken & medizinische Hilfe</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefWater')}>
              <Text style={styles.toggleText}>[{state.prefWater ? '✓' : ' '}] Wasserstellen & Versorgungspunkte</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btnSecondary, styles.rowButton]} onPress={goPrevOnboardingStep}>
                <Text style={styles.btnText}>Zurück</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.rowButton]} onPress={goNextOnboardingStep}>
                <Text style={styles.btnText}>Weiter</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {state.onboardingStep >= 2 && (
          <>
            <Text style={styles.line}>
              Um dich im richtigen Moment zu erreichen, braucht Ultreia Zugriff auf Standort und Notifications. Bitte wähle
              im Standort-Dialog idealerweise „Immer erlauben“.
            </Text>

            <TouchableOpacity style={styles.btn} onPress={handleMotorStart}>
              <Text style={styles.btnText}>Verstanden – Motor starten</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={goPrevOnboardingStep}>
              <Text style={styles.btnText}>Zurück</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  }

  // ── Main Diagnostics UI ────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>ULTREIA – Heartbeat + Push MVP</Text>

      <Text style={styles.line}>API_BASE: {API_BASE}</Text>
      <Text style={styles.line}>Device: {state.deviceId || '—'}</Text>
      <Text style={styles.line}>Interests (cache): {state.interestsLabel || 'none'}</Text>
      <Text style={styles.line}>Expo PushToken: {shortExpoToken}</Text>
      <Text style={styles.line}>FCM-Token: {shortFcmToken}</Text>
      <Text style={styles.line}>Device-Register: {state.deviceRegistered ? 'OK' : 'noch nicht'}</Text>

      <Text style={styles.line}>Status: {state.ready ? 'Bereit' : 'Init…'}</Text>
      <Text style={styles.line}>BG-Task laufend (OS): {state.bgLocRunning ? 'ja' : 'nein'}</Text>
      <Text style={styles.line}>BackgroundFetch-Status: {state.fetchStatus}</Text>
      <Text style={styles.line}>HB-Loop aktiv (Timer): {state.hbLoopActive ? 'ja' : 'nein'}</Text>

      <Text style={styles.line}>Letzter OK: {state.lastOkAt ? new Date(state.lastOkAt).toLocaleTimeString() : '—'}</Text>
      <Text style={styles.line}>Letzter HB-Reason: {state.lastHeartbeatReason || '—'}</Text>
      <Text style={styles.line}>
        Letzte HB-Latenz: {state.lastHeartbeatLatencyMs != null ? `${state.lastHeartbeatLatencyMs} ms` : '—'}
      </Text>
      <Text style={styles.line}>
        Letzter HB-Zeitpunkt: {state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).toLocaleTimeString() : '—'}
      </Text>
      <Text style={styles.line}>HB-Alter: {hbAgeText}</Text>
      <Text style={styles.line}>HB-Intervall (letzte HBs): {hbStatsText}</Text>
      <Text style={styles.line}>HB-Histogramm: {hbHistogramText}</Text>

      <Text style={styles.line}>Notif-Permission: {state.notifPermission}</Text>
      <Text style={styles.line}>FG-Location-Permission: {state.fgLocationPermission}</Text>
      <Text style={styles.line}>BG-Location-Permission: {state.bgLocationPermission}</Text>

      <Text style={styles.line}>
        Pilger-Präferenzen:{' '}
        {[
          state.prefAccommodation && 'Schlafplätze',
          state.prefFood && 'Essen/Trinken',
          state.prefPharmacy && 'Apotheken',
          state.prefWater && 'Wasser',
        ]
          .filter(Boolean)
          .join(', ') || '—'}
      </Text>

      {state.lastNotification ? (
        <View style={styles.notifBox}>
          <Text style={styles.notifTitle}>Letzte Notification:</Text>
          <Text style={styles.notifText}>{state.lastNotification}</Text>
        </View>
      ) : (
        <Text style={styles.line}>Letzte Notification: —</Text>
      )}

      {state.debugLastAction || state.debugLastResult ? (
        <View style={styles.notifBox}>
          <Text style={styles.notifTitle}>Debug:</Text>
          <Text style={styles.notifText}>Aktion: {state.debugLastAction || '—'}</Text>
          <Text style={styles.notifText}>Ergebnis: {state.debugLastResult ? state.debugLastResult : '—'}</Text>
        </View>
      ) : null}

      {state.lastResp ? (
        <View style={styles.notifBox}>
          <Text style={styles.notifTitle}>Letzte Server-Response:</Text>
          <Text style={styles.notifText}>{safeJsonStringify(state.lastResp)}</Text>
        </View>
      ) : null}

      {state.lastErr ? <Text style={styles.err}>Fehler: {state.lastErr}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={onManualPing}>
        <Text style={styles.btnText}>Jetzt Heartbeat senden</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onSeedOfferHere}>
        <Text style={styles.btnText}>Test-Offer hier erstellen</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onDebugPushFcm}>
        <Text style={styles.btnText}>Debug Push (FCM)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onDebugPushExpo}>
        <Text style={styles.btnText}>Debug Push (Expo)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onLocalTestNotification}>
        <Text style={styles.btnText}>Lokale Test-Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onRefreshBgStatus}>
        <Text style={styles.btnText}>BG-Status aktualisieren</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Hinweis:{'\n'}• Android kann BG-Updates dichter als 60s liefern → wir dedupen mit HB_MIN_GAP_SECONDS (~55s).
        {'\n'}• Tier A: expo-location + ForegroundService Notification.{'\n'}• Tier B: BackgroundFetch Watchdog (rearm +
        stale HB).{'\n'}• Tier C: Booster bei Movement-Bursts (rate-limited).{'\n'}• Interests werden in AsyncStorage
        persistiert, damit sie nach Reboot im Headless-Kontext verfügbar sind.{'\n'}• Debug: benötigt Backend-Endpunkte
        /api/debug/seed-offer, /api/debug/push-fcm, /api/debug/push-expo.
      </Text>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0b0b0c' },
  container: {
    flexGrow: 1,
    backgroundColor: '#0b0b0c',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 18 },
  line: { color: '#cfcfcf', marginBottom: 8 },
  err: { color: '#ff6b6b', marginVertical: 8 },
  btn: {
    marginTop: 18,
    backgroundColor: '#3b5ccc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSecondary: {
    marginTop: 12,
    backgroundColor: '#2f8f6b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  hint: { color: '#9aa0a6', marginTop: 16, lineHeight: 20 },
  notifBox: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1b1c1f',
  },
  notifTitle: { color: '#ffffff', fontWeight: '600', marginBottom: 4 },
  notifText: { color: '#cfcfcf', fontSize: 12 },
  toggleRow: { marginTop: 10, paddingVertical: 10 },
  toggleText: { color: '#cfcfcf' },
  row: { flexDirection: 'row', marginTop: 18 },
  rowButton: { flex: 1, marginHorizontal: 4 },
});
