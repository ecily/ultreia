import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import {
  BG_LOCATION_TASK,
  CHANNELS,
  FRESH_FIX_TIMEOUT_MS,
  HEARTBEAT_MIN_SECONDS,
  LOC_STALE_MS,
  WD_TICK_MS,
  GF_STALE_MS,
  RESOLVED_PROJECT_ID,
} from './push-constants';
import {
  getCurrentExpoToken,
  getPersistentDeviceId,
  setGlobalState,
  nowMs,
} from './push-state';
import { ensureChannels } from './push-notifications';
import {
  reconcileInsideFlagsWithPosition,
  refreshGeofencesAroundUser,
} from './push-geofence';

let lastHeartbeatAt = 0;

/** 🔒 NEU: Idempotenz-/Debounce-Guards gegen Doppelstarts & Binder-Flut */
let __bgLocStarting = false;           // verhindert parallele Starts
let __lastStartAt = 0;                 // letztes erfolgreiches Start-Zeitstempel
const RESTART_DEBOUNCE_MS = 60_000;    // NEU: kein Restart < 60s
const STALE_WARM_FIX_MS = 10_000;      // NEU: Warm-Fix-Frist, ohne Restart
let __fgServiceRetryDone = false;      // NEU: einmaliger Retry-Guard

export type HeartbeatRefreshMode = 'normal' | 'silent' | 'none';

// ────────────────────────────────────────────────────────────
// App state helper
// ────────────────────────────────────────────────────────────
function isForeground(): boolean {
  try { return AppState.currentState === 'active'; } catch { return false; }
}

// kleine Sleep-Hilfe
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ────────────────────────────────────────────────────────────
// Location helpers
// ────────────────────────────────────────────────────────────
export async function getFreshBestFixOrNull(timeoutMs = FRESH_FIX_TIMEOUT_MS) {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      maximumAge: 0,
      timeout: timeoutMs,
    });
    return fix?.coords ? fix : null;
  } catch {
    return null;
  }
}

export async function ensureGoodAccuracyCoords(
  coords: Partial<Location.LocationObjectCoords> | null
) {
  try {
    if (
      !coords ||
      !Number.isFinite((coords as any).latitude) ||
      !Number.isFinite((coords as any).longitude)
    ) {
      const fresh = await getFreshBestFixOrNull();
      return fresh?.coords || null;
    }
    const MIN_GOOD = 25;
    if (
      !Number.isFinite((coords as any).accuracy) ||
      ((coords as any).accuracy as number) > MIN_GOOD
    ) {
      const fresh = await getFreshBestFixOrNull();
      if (
        fresh?.coords &&
        fresh.coords.accuracy < (((coords as any).accuracy) ?? 1e9)
      ) {
        return fresh.coords;
      }
    }
    return coords as Location.LocationObjectCoords;
  } catch {
    return (coords as any) || null;
  }
}

// ────────────────────────────────────────────────────────────
// Heartbeat
// ────────────────────────────────────────────────────────────
export async function _sendHeartbeatWithCoords({
  latitude,
  longitude,
  accuracy,
  refreshMode = 'normal',
}: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  refreshMode?: HeartbeatRefreshMode;
}) {
  const now = nowMs();
  if (now - lastHeartbeatAt < HEARTBEAT_MIN_SECONDS * 1000) return;
  lastHeartbeatAt = now;

  try {
    const token = await getCurrentExpoToken();
    const deviceId = await getPersistentDeviceId();
    const res = await fetch(
      `https://lobster-app-ie9a5.ondigitalocean.app/api/location/heartbeat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceId,
          lat: latitude,
          lng: longitude,
          accuracy,
          platform: 'android',
          projectId: RESOLVED_PROJECT_ID,
        }),
      }
    );
    const json = await res.json();
    console.log('[BGLOC] Heartbeat', res.status, JSON.stringify(json));
  } catch (e: any) {
    console.log('[BGLOC] Heartbeat error', String(e));
  }

  try {
    await reconcileInsideFlagsWithPosition({ latitude, longitude, accuracy });
  } catch (e: any) {
    console.log('[RECONCILE] failed after heartbeat', String(e));
  }

  try {
    if (refreshMode === 'normal') {
      console.log('[geofence] heartbeat-triggered refresh (force=true)');
      await refreshGeofencesAroundUser(true);
    } else if (refreshMode === 'silent') {
      console.log(
        '[geofence] heartbeat-triggered refresh (force=true, silent=true)'
      );
      await refreshGeofencesAroundUser({ force: true, silent: true });
    } else {
      console.log('[geofence] heartbeat-triggered refresh skipped (mode=none)');
    }
  } catch (e: any) {
    console.log('[geofence] heartbeat-triggered refresh failed', String(e));
  }

  await setGlobalState({ lastHeartbeatAt: now });
}

export async function sendHeartbeat(arg?: any) {
  try {
    if (typeof arg === 'string') {
      const pos = await Location.getLastKnownPositionAsync({});
      if (!pos?.coords) {
        try {
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            maximumAge: 0,
            timeout: FRESH_FIX_TIMEOUT_MS,
          });
          if (fresh?.coords) {
            return _sendHeartbeatWithCoords({
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
              accuracy: fresh.coords.accuracy,
              refreshMode: 'silent',
            });
          }
        } catch {}
        console.log('[BGLOC] sendHeartbeat(token) no position available');
        return;
      }
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        refreshMode: 'silent',
      });
    }

    if (
      arg &&
      typeof arg === 'object' &&
      Number.isFinite(arg.latitude) &&
      Number.isFinite(arg.longitude)
    ) {
      return _sendHeartbeatWithCoords({ ...arg, refreshMode: 'normal' });
    }

    const pos = await Location.getLastKnownPositionAsync({});
    if (pos?.coords) {
      return _sendHeartbeatWithCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        refreshMode: 'normal',
      });
    }
  } catch (e: any) {
    console.log('[BGLOC] sendHeartbeat wrapper error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Background Location start (with Foreground Service)
// ────────────────────────────────────────────────────────────

// Safe resolver for the background notification channel ID
function getBgChannelId(): string {
  try {
    const id = (CHANNELS as any)?.bg;
    return typeof id === 'string' && id.length
      ? id
      : 'com.ecily.mobile:stepsmatch-bg-location-task';
  } catch {
    return 'com.ecily.mobile:stepsmatch-bg-location-task';
  }
}

export async function startAggressiveBgLocation() {
  // Ab Android 12+: FG-Service darf nicht aus BG gestartet werden.
  if (!isForeground()) {
    console.log('[BGLOC] skip startLocationUpdates (app in background)');
    return;
  }

  // 🔒 Idempotenz: parallele Starts verhindern
  if (__bgLocStarting) {
    console.log('[BGLOC] start: already starting → skip');
    return;
  }

  await ensureChannels(); // make sure channels exist

  try {
    __bgLocStarting = true;

    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
    const now = Date.now();

    // NEU: Neustarts nur, wenn wirklich notwendig und außerhalb Debounce-Fenster
    if (started) {      // Bereits laufend → kein Stop/Start (Binder-Schonung)
      console.log('[BGLOC] start: already running → no-op');
      return;
    }

    // Debounce gegen schnelle Restart-Loops
    if (__lastStartAt && (now - __lastStartAt) < RESTART_DEBOUNCE_MS) {
      console.log('[BGLOC] start: debounce window → skip');
      return;
    }

    const channelId = getBgChannelId();
    console.log('[BGLOC] using bg channel', channelId);

    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 30 * 1000,
      distanceInterval: 0,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      mayShowUserSettingsDialog: true,
      foregroundService: {
        notificationTitle: 'StepsMatch ist aktiv',
        notificationBody: 'Standort wird im Hintergrund aktualisiert.',
        notificationChannelId: channelId, // safe
        killServiceOnDestroy: false,
      },
    });    __lastStartAt = now;

    try {
      // Warmer Fix ohne harten Neustart – reduziert Binder-Last
      const warm = await getFreshBestFixOrNull(5000);
      if (warm?.coords) {
        await (
          await import('@react-native-async-storage/async-storage')
        ).default.setItem('lastFixAt', String(Date.now()));
        await _sendHeartbeatWithCoords({
          latitude: warm.coords.latitude,
          longitude: warm.coords.longitude,
          accuracy: warm.coords.accuracy,
          refreshMode: isForeground() ? 'silent' : 'normal',
        });
      }
    } catch {}

    await (
      await import('@react-native-async-storage/async-storage')
    ).default.setItem('lastFixAt', String(Date.now()));
    console.log('[BGLOC] startLocationUpdatesAsync → armed (aggressive)');
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.log('[BGLOC] startLocationUpdatesAsync error', msg);

    // ⚠️ NEU: Einmaliger Retry, wenn das FG-Service zu früh gestartet wurde
    if (
      !__fgServiceRetryDone &&
      /Foreground service cannot be started/i.test(msg)
    ) {
      __fgServiceRetryDone = true;
      console.log('[BGLOC] retry: foreground service race → wait 1s & retry');
      await sleep(1000);
      if (isForeground()) {
        __bgLocStarting = false; // Reset, damit Retry nicht geblockt wird
        await startAggressiveBgLocation();
      } else {
        console.log('[BGLOC] retry aborted: not in foreground anymore');
      }
    }
  } finally {
    __bgLocStarting = false;
  }
}

export async function kickstartBackgroundLocation() {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[BGLOC] permissions', {
      fg: (fg as any)?.status,
      bg: (bg as any)?.status,
    });

    if (!isForeground()) {
      // Android 12+ Restriktion: Start erst im FG. Sende nur leichten Heartbeat.
      console.log('[BGLOC] kickstart: app in background → defer start, send heartbeat only');
      const loc = await Location.getLastKnownPositionAsync({});
      if (loc?.coords) {
        await _sendHeartbeatWithCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          refreshMode: 'silent',
        });
      }
      return;
    }

    await startAggressiveBgLocation();

    const loc = await Location.getLastKnownPositionAsync({});
    if (loc?.coords) {
      await _sendHeartbeatWithCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        refreshMode: 'silent',
      });
    }
  } catch (e: any) {
    console.log('[BGLOC] kickstart error', String(e));
  }
}

// ────────────────────────────────────────────────────────────
// Watchdog
// ────────────────────────────────────────────────────────────
export function useLocationWatchdog() {  const timerRef = useRef<any>(null);
  useEffect(() => {
    async function tick() {
      try {
        // Kein Start-Versuch, wenn die App im Hintergrund ist
        if (!isForeground()) {
          // optional: kurzen, stillen Heartbeat schicken
          const pos = await Location.getLastKnownPositionAsync({});
          if (pos?.coords) {
            await _sendHeartbeatWithCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              refreshMode: 'silent',
            });
          }
          return;
        }

        const locStarted = await Location.hasStartedLocationUpdatesAsync(
          BG_LOCATION_TASK
        );

        // Falls nicht gestartet → EINMAL starten (idempotent)
        if (!locStarted) {
          console.log('[BGLOC] watchdog → BG task not running → start');
          await startAggressiveBgLocation();
        }

        const AsyncStorage = (
          await import('@react-native-async-storage/async-storage')
        ).default;
        const lastFixAt = Number((await AsyncStorage.getItem('lastFixAt')) || 0);
        const age = Date.now() - lastFixAt;

        // NEU: Bei stale Fix NICHT blind neustarten, zuerst warm fix + heartbeat
        if (!lastFixAt || age > LOC_STALE_MS) {
          console.log(
            '[BGLOC] watchdog → stale fix (age=',
            age,
            'ms) → warm-fix + heartbeat'
          );

          // Warm-Fix versuchen (ohne Restart)
          try {
            const warm = await getFreshBestFixOrNull(STALE_WARM_FIX_MS);
            const pos = warm?.coords
              ? { coords: warm.coords }
              : await Location.getLastKnownPositionAsync({});
            if (pos?.coords) {
              await AsyncStorage.setItem('lastFixAt', String(Date.now()));
              await _sendHeartbeatWithCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                refreshMode: 'normal',
              });
            }
          } catch {}

          // Nur wenn Task NICHT läuft, nach Debounce starten
          const stillStarted = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
          if (!stillStarted) {
            await startAggressiveBgLocation();
          }
        }

        const { GEOFENCE_TASK } = await import('./push-constants');
        const gfStarted = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
        const mod = await import('./push-geofence');
        const gfAge = Date.now() - (mod as any).lastGeofenceSyncAt;
        if (!gfStarted) {
          console.log(
            '[GEOFENCE] watchdog → geofencing not running → force refresh'
          );
          await refreshGeofencesAroundUser(true);
        } else if (!(mod as any).lastGeofenceSyncAt || gfAge > GF_STALE_MS) {
          console.log(
            '[GEOFENCE] watchdog → geofence stale (age=',
            gfAge,
            'ms) → force refresh'
          );
          await refreshGeofencesAroundUser(true);
        }
      } catch (e: any) {
        console.log('[WD] tick error', String(e?.message || e));
      }
    }
    // @ts-ignore
    timerRef.current = setInterval(tick, WD_TICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}

