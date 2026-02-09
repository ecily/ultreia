// C:\ultreia\mobile\src\engine\ultreiaEngine.js
// ULTREIA – Engine (Heartbeat + Push + BG Tasks)
// Ziel: Motor/Logik von UI trennen, ohne Funktionalität zu ändern.

import { Platform, AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
export const TASK_IDS = {
  bgLoc: 'ultreia-bg-location-task',
  fetch: 'ultreia-heartbeat-fetch',
};

export const NOTIF_CHANNELS = { fg: 'ultreia-fg', offers: 'offers' };

export const STORAGE_KEYS = {
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

export const DEBUG_DEFAULTS = {
  offerRadiusM: 200,
  offerValidMin: 30,
};

// API base
export const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) || 'http://10.0.2.2:4000/api';

// ─────────────────────────────────────────────────────────────────────────────
// Global engine state (module-level, headless-safe)
// ─────────────────────────────────────────────────────────────────────────────

// Interessen global (Memory Cache)
let currentInterests = null;
let interestsCacheLoaded = false;

// Global last HB + stats
let lastHeartbeatAtMs = null;
const hbIntervals = []; // keep array instance stable
let lastSentCoords = null;

// Foreground timer
let hbLoopTimerId = null;

// Booster movement snapshots
let lastCoordsForBooster = null;
let lastBoosterAtMs = null;

// Single-flight HB (verhindert Doppel-Trigger)
let hbInFlight = null;
let hbInFlightMeta = null;

const FORCE_HB_REASONS = new Set(['manual', 'init', 'watchdog-rearm', 'fetch-watchdog']);

function isForceReason(reason) {
  return FORCE_HB_REASONS.has(String(reason || ''));
}

function normalizeReason(reason) {
  const r = String(reason || 'unknown').trim();
  return r || 'unknown';
}

function toNumberOrNull(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readResponseJsonOrNull(res) {
  const raw = await res.text().catch(() => '');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { raw };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
export function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

export async function postJson(path, body) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });

  const parsed = await readResponseJsonOrNull(res);

  if (!res.ok) {
    const msg = `HTTP ${res.status} ${typeof parsed === 'string' ? parsed : parsed?.raw || ''}`.trim();
    const err = new Error(msg);
    err.status = res.status;
    err.data = parsed;
    throw err;
  }

  return parsed;
}

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

export function hbAgeSecondsNow() {
  return lastHeartbeatAtMs ? Math.floor((Date.now() - lastHeartbeatAtMs) / 1000) : null;
}

function shouldSkipHeartbeat({ reason, lat, lng }) {
  const now = Date.now();
  const ageSec = lastHeartbeatAtMs ? Math.floor((now - lastHeartbeatAtMs) / 1000) : null;

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

// ─────────────────────────────────────────────────────────────────────────────
// Geo Qualität / Koordinaten-Schutz
// Priorität #1: korrekte Geo-Koordinaten (lat/lng). Backend nutzt Point=[lng,lat].
// Wir schützen clientseitig vor: Range-Fehlern, lat/lng Swap Heuristik (konservativ).
// ─────────────────────────────────────────────────────────────────────────────
function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function maybeSwapLatLng(lat, lng) {
  // Konservativ:
  // - Wenn (lat außerhalb [-90,90] aber lng innerhalb) -> eindeutig falsch -> swap
  // - Wenn (lng außerhalb [-180,180] aber lat innerhalb) -> eindeutig falsch -> swap
  // - Wenn beide gültig -> kein swap (keine Heuristik, um False Positives zu vermeiden)
  // - Wenn beide ungültig -> unverändert (wird später verworfen)
  const latOk = typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const lngOk = typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;

  if (!latOk && lngOk) {
    const swappedLat = lng;
    const swappedLng = lat;
    if (isValidLatLng(swappedLat, swappedLng)) return { lat: swappedLat, lng: swappedLng, swapped: true };
  }

  if (!lngOk && latOk) {
    const swappedLat = lng;
    const swappedLng = lat;
    if (isValidLatLng(swappedLat, swappedLng)) return { lat: swappedLat, lng: swappedLng, swapped: true };
  }

  return { lat, lng, swapped: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// DeviceId (ohne extra Dependencies)
// ─────────────────────────────────────────────────────────────────────────────
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

export function getEasProjectIdMaybe() {
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

export async function resolveDeviceId() {
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

// ─────────────────────────────────────────────────────────────────────────────
// Interests + Prefs
// ─────────────────────────────────────────────────────────────────────────────
export function buildInterestsFromPrefs({ prefAccommodation, prefFood, prefPharmacy, prefWater }) {
  const list = [];
  if (prefAccommodation) list.push('albergue', 'hostel');
  if (prefFood) list.push('restaurant', 'bar');
  if (prefPharmacy) list.push('pharmacy');
  if (prefWater) list.push('water');
  return Array.from(new Set(list));
}

export function normalizeInterests(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .map((x) => x.toLowerCase());
  return Array.from(new Set(cleaned));
}

export async function savePrefsAndInterests(prefs) {
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

export async function loadPrefsFromStorage() {
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

export async function loadInterestsCached() {
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

// ─────────────────────────────────────────────────────────────────────────────
// Inbox (Push Historie)
// ─────────────────────────────────────────────────────────────────────────────
export async function loadNotifInbox() {
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

export async function persistNotifInbox(items) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.notifInbox,
      JSON.stringify(Array.isArray(items) ? items.slice(0, 50) : [])
    );
  } catch (e) {
    // ignore
  }
}

export function normalizeNotifItem(input) {
  const obj = input && typeof input === 'object' ? input : {};
  const title = String(obj.title || '');
  const body = String(obj.body || '');
  const data = obj.data && typeof obj.data === 'object' ? obj.data : {};
  const receivedAt = obj.receivedAt ? String(obj.receivedAt) : new Date().toISOString();
  return { title, body, data, receivedAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications handler (global)
// ─────────────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Coords helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveCoordsForHeartbeat({ allowCurrentFix = true } = {}) {
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last && last.coords) return last.coords;
  } catch (e) {
    // ignore
  }

  if (!allowCurrentFix) return null;

  try {
    const cur = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
    return cur && cur.coords ? cur.coords : null;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat engine
// ─────────────────────────────────────────────────────────────────────────────
async function sendHeartbeatCore({ lat, lng, accuracy, reason = 'unknown', interests }) {
  const startedAt = Date.now();

  const rawLat = toNumberOrNull(lat);
  const rawLng = toNumberOrNull(lng);
  const finalAcc = toNumberOrNull(accuracy);

  if (rawLat == null || rawLng == null) {
    throw new Error('Invalid coords (lat/lng)');
  }

  const { lat: finalLat, lng: finalLng, swapped } = maybeSwapLatLng(rawLat, rawLng);

  if (!isValidLatLng(finalLat, finalLng)) {
    throw new Error('Invalid coords range (lat/lng)');
  }

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
  const r = normalizeReason(reason);

  const payload = {
    deviceId,
    lat: finalLat,
    lng: finalLng,
    accuracy: finalAcc,
    ts: new Date().toISOString(),
    powerState: 'unknown',
    source: r,
  };

  if (finalInterests && finalInterests.length > 0) payload.interests = finalInterests;

  console.log(
    `[HB] start device=${deviceId} reason=${r} lat=${finalLat} lng=${finalLng} acc=${
      finalAcc != null ? finalAcc : 'n/a'
    } interests=${finalInterests && finalInterests.length ? finalInterests.join(',') : 'none'}${
      swapped ? ' swappedLatLng=1' : ''
    }`
  );

  const res = await fetch(`${API_BASE}/location/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const finishedAt = Date.now();
  const latencyMs = finishedAt - startedAt;

  const data = await readResponseJsonOrNull(res);
  console.log('[HB] response payload:', data);

  if (!res.ok) {
    const msg = `HTTP ${res.status}`;
    console.warn(`[HB] error reason=${r} latency=${latencyMs}ms: ${msg}`);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  let intervalSec = null;
  if (lastHeartbeatAtMs != null) {
    const deltaSec = Math.round((finishedAt - lastHeartbeatAtMs) / 1000);
    intervalSec = deltaSec;
    hbIntervals.push(deltaSec);
    if (hbIntervals.length > 60) hbIntervals.shift();
  }

  lastHeartbeatAtMs = finishedAt;
  lastSentCoords = { latitude: finalLat, longitude: finalLng };

  console.log(
    `[HB] ok reason=${r} latency=${latencyMs}ms interval=${intervalSec != null ? `${intervalSec}s` : 'n/a'} samples=${
      hbIntervals.length
    }`
  );

  return { data, latencyMs, intervalSec };
}

export async function sendHeartbeatSingleFlight({ lat, lng, accuracy, reason = 'unknown', interests }) {
  const r = normalizeReason(reason);

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

export async function sendImmediateHeartbeat(reason) {
  const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
  if (!coords) throw new Error('No coords available');
  return sendHeartbeatSingleFlight({
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    reason: normalizeReason(reason || 'immediate'),
  });
}

export async function registerDevice({ expoPushToken, fcmToken } = {}) {
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

  const data = await readResponseJsonOrNull(res);

  if (!res.ok) {
    const txt = data && data.raw ? String(data.raw) : '';
    throw new Error(`register HTTP ${res.status} ${txt}`.trim());
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// BG Location Task
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// BackgroundFetch Task
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Public engine actions
// ─────────────────────────────────────────────────────────────────────────────
export async function startBgLocation() {
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

export function startHeartbeatLoop(updateState) {
  if (hbLoopTimerId) {
    console.log('[HB-Loop] already running');
    if (updateState) updateState((s) => ({ ...s, hbLoopActive: true }));
    return;
  }

  console.log('[HB-Loop] starting loop…', `interval=${HB_LOOP_SECONDS}s`);
  if (updateState) updateState((s) => ({ ...s, hbLoopActive: true }));

  const runTick = async () => {
    try {
      const coords = await resolveCoordsForHeartbeat({ allowCurrentFix: true });
      if (!coords || coords.latitude == null || coords.longitude == null) {
        console.warn('[HB-Loop] no coords available');
        return;
      }

      const dec = shouldSkipHeartbeat({ reason: 'fg-loop', lat: coords.latitude, lng: coords.longitude });
      if (dec.skip) {
        const ageSec = hbAgeSecondsNow();
        console.log(`[HB] skip reason=fg-loop why=${dec.why} ageSec=${ageSec != null ? ageSec : 'n/a'}`);
        if (updateState) updateState((s) => ({ ...s, hbLoopActive: true }));
        return;
      }

      const hbResult = await sendHeartbeatSingleFlight({
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        reason: 'fg-loop',
      });

      if (hbResult && hbResult.skipped) {
        console.log(
          `[HB] skip reason=fg-loop why=${hbResult.why} inFlightReason=${hbResult.inFlightReason || 'n/a'}`
        );
        if (updateState) updateState((s) => ({ ...s, hbLoopActive: true }));
        return;
      }

      if (updateState) {
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
      }
    } catch (e) {
      console.warn('[HB-Loop] tick failed:', (e && e.message) || e);
      if (updateState) {
        updateState((s) => ({
          ...s,
          lastErr: `[hb-loop] ${(e && e.message) || e}`,
          hbLoopActive: true,
        }));
      }
    }
  };

  runTick().catch(() => null);
  hbLoopTimerId = setInterval(runTick, HB_LOOP_SECONDS * 1000);
}

export function stopHeartbeatLoop(updateState) {
  if (hbLoopTimerId) {
    clearInterval(hbLoopTimerId);
    hbLoopTimerId = null;
    console.log('[HB-Loop] stopped');
  }
  if (updateState) updateState((s) => ({ ...s, hbLoopActive: false }));
}

export async function ensureBackgroundFetch() {
  let status = null;
  try {
    status = await BackgroundFetch.getStatusAsync();
  } catch (e) {
    status = null;
  }

  if (status != null && status !== BackgroundFetch.BackgroundFetchStatus.Available) {
    const label =
      status === BackgroundFetch.BackgroundFetchStatus.Denied
        ? 'denied'
        : status === BackgroundFetch.BackgroundFetchStatus.Restricted
          ? 'restricted'
          : 'unknown';
    console.log('[Fetch] not available -> skip register (status=', label, ')');
    return;
  }

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

export async function refreshRuntimeStatus(updateState) {
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

    if (updateState) {
      updateState((s) => ({
        ...s,
        bgLocRunning: !!hasBgLoc,
        fetchStatus: fetchStatusLabel,
        deviceId,
        interestsLabel,
      }));
    }

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

export async function ensurePermissions(setState) {
  try {
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
    }

    const notifPermBefore = await Notifications.getPermissionsAsync();
    console.log('[Perm] notif before request:', notifPermBefore);
    const notifPerm = await Notifications.requestPermissionsAsync();
    console.log('[Perm] notif after request:', notifPerm);
    if (setState) {
      setState((s) => ({
        ...s,
        notifPermission: notifPerm && notifPerm.status ? notifPerm.status : 'unknown',
      }));
    }
  } catch (e) {
    console.warn('[Perm] notifications request failed:', (e && e.message) || e);
    if (setState) setState((s) => ({ ...s, notifPermission: 'unknown' }));
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  console.log('[Perm] fg location:', fg);
  if (setState) setState((s) => ({ ...s, fgLocationPermission: fg.status || 'unknown' }));
  if (fg.status !== 'granted') throw new Error('Foreground location permission denied');

  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[Perm] bg location (request):', bg);
    if (setState) setState((s) => ({ ...s, bgLocationPermission: bg.status || 'unknown' }));
    if (bg.status !== 'granted') console.warn('Background location permission not granted yet.');
    try {
      const bgCurrent = await Location.getBackgroundPermissionsAsync();
      console.log('[Perm] bg location (current):', bgCurrent);
    } catch (e) {
      // ignore
    }
  }
}

export function getHbIntervalsSnapshot() {
  return hbIntervals.slice();
}

export function getHbIntervalsRef() {
  return hbIntervals;
}

export function getWatchdogPollSeconds() {
  return WATCHDOG_POLL_SECONDS;
}

export function getEngineSnapshot() {
  return {
    apiBase: API_BASE,
    deviceId: DEVICE_ID,
    interestsLoaded: interestsCacheLoaded,
    interests: Array.isArray(currentInterests) ? currentInterests.slice() : [],
    lastHeartbeatAtMs,
    hbAgeSeconds: hbAgeSecondsNow(),
    hbIntervals: hbIntervals.slice(),
    bgDistanceMeters: BG_DISTANCE_METERS,
    bgTimeSeconds: BG_TIME_SECONDS,
    hbLoopActive: !!hbLoopTimerId,
    inFlight: !!hbInFlight,
    inFlightMeta: hbInFlightMeta ? { ...hbInFlightMeta } : null,
  };
}

// Helper: optional convenience for AppState re-arm flows (used later in App.js refactor)
export async function ensureBgAndLoopOnActive({ updateState } = {}) {
  if (AppState.currentState !== 'active') return;

  try {
    const hasBg = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
    if (!hasBg) await startBgLocation();
  } catch (e) {
    console.warn('[ReArm] ensure bgLoc failed:', (e && e.message) || e);
  }

  try {
    await refreshRuntimeStatus(updateState);
  } catch (e) {
    // ignore
  }

  try {
    startHeartbeatLoop(updateState);
  } catch (e) {
    // ignore
  }
}
