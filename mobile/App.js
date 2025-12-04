// ULTREIA – Heartbeat + Push MVP (mit Watchdog, JS-only)
// - BG-Location (≈20s + ~100m) via Foreground-Service-Notification
// - Foreground-Heartbeat-Loop (Timer) für stabile HBs im Hintergrund
// - BackgroundFetch als Fallback
// - Device-Register inkl. Expo-Push-Token + FCM-Token + Diagnostics
// - Zentrale Heartbeat-Engine mit Reason + Latenz-Logging
// - Watchdog (HB-Alter + Self-Heal bei AppState 'active')
// - BG-Diagnostics (Permissions + Task-Status)
// - Lokale Test-Notification
// - Einfaches Onboarding für Pilger (Motor-Erklärung + Präferenzen)
// - API_BASE über app.json (Online-Backend auf DO oder lokal per adb reverse)

import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  AppState,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants from 'expo-constants';

const TASK_IDS = {
  bgLoc: 'ultreia-bg-location-task',
  fetch: 'ultreia-heartbeat-fetch',
};
const NOTIF_CHANNELS = { fg: 'ultreia-fg', offers: 'offers' };

// Ziel: Sweet-Spot für Fußgänger (~12 min/km).
// Nominell 20s Heartbeat + ~100m Distanz. Android drosselt im BG, aber
// damit landen wir real eher im 1–3-Minuten-Bereich als bei 5–10.
const HEARTBEAT_SECONDS = 20;
const BG_DISTANCE_METERS = 100;

// Foreground-Heartbeat-Loop (zusätzlicher Timer, der HBs nicht nur an Location bindet)
const HB_LOOP_SECONDS = 30;

// Watchdog: ab diesem Alter (in Sekunden) betrachten wir den letzten Heartbeat
// als "alt" und versuchen bei AppState 'active' ein Self-Heal (Rearm+HB).
const WATCHDOG_THRESHOLD_SECONDS = 3 * 60;
const WATCHDOG_POLL_SECONDS = 30;

// API-Base: aus app.json / extra.apiBase (Online-Backend auf DO)
// Emulator-Fallback: 10.0.2.2
const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) ||
  'http://10.0.2.2:4000/api';

const DEVICE_ID = 'ULTR-DEV-001';

// Globaler Timestamp des letzten erfolgreichen Heartbeats (inkl. BG-Tasks)
let lastHeartbeatAtMs = null;
// Historie der Inter-HB-Intervalle (Sekunden) für die letzten ≈60 Heartbeats
let hbIntervals = [];
// Timer-ID des Foreground-Heartbeat-Loops
let hbLoopTimerId = null;

// ── Notifications Handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Expo warnt: deprecated, für MVP ok
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── API Calls / Heartbeat-Engine ─────────────────────────────────────────────
async function sendHeartbeat({ lat, lng, accuracy, reason = 'unknown' }) {
  const startedAt = Date.now();
  const payload = {
    deviceId: DEVICE_ID,
    lat,
    lng,
    accuracy,
    ts: new Date().toISOString(),
    powerState: 'unknown',
    source: reason,
  };

  console.log(
    `[HB] start reason=${reason} lat=${lat} lng=${lng} acc=${accuracy != null ? accuracy : 'n/a'}`
  );

  const res = await fetch(`${API_BASE}/location/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const finishedAt = Date.now();
  const latencyMs = finishedAt - startedAt;

  if (!res.ok) {
    let txt = '';
    try {
      txt = await res.text();
    } catch (e) {
      txt = '';
    }
    const msg = `HTTP ${res.status} ${txt}`;
    console.warn(`[HB] error reason=${reason} latency=${latencyMs}ms: ${msg}`);
    throw new Error(msg);
  }

  const data = await res.json();

  let intervalSec = null;
  if (lastHeartbeatAtMs != null) {
    const deltaSec = Math.round((finishedAt - lastHeartbeatAtMs) / 1000);
    intervalSec = deltaSec;
    hbIntervals.push(deltaSec);
    if (hbIntervals.length > 60) {
      hbIntervals.shift();
    }
  }
  lastHeartbeatAtMs = finishedAt;

  console.log(
    `[HB] ok reason=${reason} latency=${latencyMs}ms interval=${
      intervalSec != null ? `${intervalSec}s` : 'n/a'
    } samples=${hbIntervals.length}`
  );

  return { data, latencyMs, intervalSec };
}

async function registerDevice({ expoPushToken, fcmToken } = {}) {
  const body = {
    deviceId: DEVICE_ID,
    platform: Platform.OS === 'android' ? 'android' : Platform.OS || 'unknown',
  };

  if (expoPushToken) {
    body.expoToken = String(expoPushToken);
  }
  if (fcmToken) {
    body.fcmToken = String(fcmToken);
  }

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

// ── BG-Location Task ─────────────────────────────────────────────────────────-
try {
  TaskManager.defineTask(TASK_IDS.bgLoc, async ({ data, error }) => {
    if (error) {
      console.warn('[BG TASK] error:', error);
      return;
    }
    const payload = data || {};
    const locations = payload.locations || [];
    if (locations && locations.length) {
      const loc = locations[0];
      const coords = (loc && loc.coords) || {};
      console.log(
        '[BG TASK] location update:',
        `lat=${coords.latitude} lng=${coords.longitude} acc=${coords.accuracy}`
      );
      try {
        await sendHeartbeat({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          reason: 'bg-location',
        });
      } catch (e2) {
        console.warn('[BG TASK] heartbeat failed:', (e2 && e2.message) || e2);
      }
    }
  });
} catch (e) {
  // duplicate define on fast refresh
}

// ── BackgroundFetch Task ─────────────────────────────────────────────────-----
try {
  TaskManager.defineTask(TASK_IDS.fetch, async () => {
    console.log('[FETCH TASK] tick');
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last && last.coords) {
        console.log(
          '[FETCH TASK] using lastKnown:',
          `lat=${last.coords.latitude} lng=${last.coords.longitude} acc=${last.coords.accuracy}`
        );
        await sendHeartbeat({
          lat: last.coords.latitude,
          lng: last.coords.longitude,
          accuracy: last.coords.accuracy,
          reason: 'fetch',
        });
      } else {
        console.log('[FETCH TASK] no lastKnown coords available');
      }
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e2) {
      console.warn('[FETCH TASK] failed:', (e2 && e2.message) || e2);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  // duplicate define
}

// ── Start BG-Location ─────────────────────────────────────────────────--------
async function startBgLocation() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
  if (hasStarted) {
    console.log('[BG] already started');
    return;
  }

  console.log(
    '[BG] starting location updates…',
    `interval=${HEARTBEAT_SECONDS}s distance=${BG_DISTANCE_METERS}m`
  );
  await Location.startLocationUpdatesAsync(TASK_IDS.bgLoc, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: HEARTBEAT_SECONDS * 1000,
    distanceInterval: BG_DISTANCE_METERS,
    foregroundService: {
      notificationTitle: 'ULTREIA läuft – Pilgerhilfe aktiv',
      notificationBody: 'Sorgt für regelmäßige Herzschläge im Hintergrund.',
      notificationColor: '#000000',
      killServiceOnDestroy: false,
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  });
}

// ── Foreground-Heartbeat-Loop ────────────────────────────────────────────────
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
      const coords = await resolveCoordsForHeartbeat();
      if (!coords) {
        console.warn('[HB-Loop] no coords available');
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

  hbLoopTimerId = setInterval(runTick, HB_LOOP_SECONDS * 1000);
}

function stopHeartbeatLoop(updateState) {
  if (hbLoopTimerId) {
    clearInterval(hbLoopTimerId);
    hbLoopTimerId = null;
    console.log('[HB-Loop] stopped');
  }
  if (updateState) {
    updateState((s) => ({ ...s, hbLoopActive: false }));
  }
}

// ── BackgroundFetch registrieren ─────────────────────────────────────────────-
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

// ── Diagnostics: BG-Status Refresh ────────────────────────────────────────────
async function refreshRuntimeStatus(updateState) {
  try {
    const hasBgLoc = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);

    let fetchStatusLabel = 'unknown';
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
        fetchStatusLabel = 'available';
      } else if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        fetchStatusLabel = 'denied';
      } else if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        fetchStatusLabel = 'restricted';
      }
    } catch (e) {
      console.warn('[Diag] getStatusAsync failed:', (e && e.message) || e);
    }

    updateState((s) => ({
      ...s,
      bgLocRunning: !!hasBgLoc,
      fetchStatus: fetchStatusLabel,
    }));

    console.log('[Diag] bgLocRunning=', !!hasBgLoc, 'fetchStatus=', fetchStatusLabel);
  } catch (e) {
    console.warn('[Diag] refreshRuntimeStatus failed:', (e && e.message) || e);
  }
}

// ── Permissions ───────────────────────────────────────────────────────────────
async function ensurePermissions(setState) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIF_CHANNELS.fg, {
      name: 'ULTREIA Service',
      importance: Notifications.AndroidImportance.MIN,
      vibrationPattern: [0],
      bypassDnd: false,
      sound: undefined,
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
  setState((s) => ({
    ...s,
    fgLocationPermission: fg.status || 'unknown',
  }));
  if (fg.status !== 'granted') throw new Error('Foreground location permission denied');

  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    console.log('[Perm] bg location (request):', bg);
    setState((s) => ({
      ...s,
      bgLocationPermission: bg.status || 'unknown',
    }));
    if (bg.status !== 'granted') {
      console.warn('Background location permission not granted yet.');
    }

    const bgCurrent = await Location.getBackgroundPermissionsAsync();
    console.log('[Perm] bg location (current):', bgCurrent);
  }
}

// ── Helper: Koordinaten für Heartbeat bestimmen ──────────────────────────────
async function resolveCoordsForHeartbeat() {
  const last = await Location.getLastKnownPositionAsync();
  if (last && last.coords) {
    return last.coords;
  }
  const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return cur.coords;
}

// ── Helper: einmaliger FG-Heartbeat mit Reason ───────────────────────────────
async function sendImmediateHeartbeat(reason) {
  const hbReason = reason || 'init';
  const coords = await resolveCoordsForHeartbeat();
  if (!coords) {
    throw new Error('No coords available');
  }
  return sendHeartbeat({
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    reason: hbReason,
  });
}

// ── UI Komponente ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState({
    // Onboarding / Pilger-Setup
    onboardingCompleted: false,
    onboardingStep: 0,
    prefAccommodation: true,
    prefFood: true,
    prefPharmacy: false,
    prefWater: true,

    // Heartbeat / Diagnostics
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
  });

  const [hasRunInit, setHasRunInit] = useState(false);

  const appState = useRef(AppState.currentState);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);
  const lastHbMsRef = useRef(null);

  // AppState → bei active sicherstellen, dass BG-Location läuft + Diagnostics + Watchdog-Heal + HB-Loop
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      appState.current = nextState;
      if (nextState === 'active') {
        try {
          console.log(
            '[AppState] active → ensure BG running + refresh diag + watchdog-check + hb-loop'
          );
          const hasBg = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
          if (!hasBg) {
            console.log('[ReArm] bgLoc not running → startBgLocation');
            await startBgLocation();
          }

          await refreshRuntimeStatus(setState);
          startHeartbeatLoop(setState);

          // Watchdog: Wenn letzter HB zu lange her ist, versuche Self-Heal (Rearm+HB)
          if (lastHeartbeatAtMs) {
            const ageMs = Date.now() - lastHeartbeatAtMs;
            const ageSec = Math.floor(ageMs / 1000);
            console.log('[Watchdog] HB age on active:', ageSec, 's');
            if (ageSec > WATCHDOG_THRESHOLD_SECONDS) {
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
                lastHbMsRef.current = Date.now();
              } catch (e) {
                console.warn('[Watchdog] watchdog-rearm failed:', (e && e.message) || e);
                setState((s) => ({
                  ...s,
                  lastErr: `[watchdog] ${(e && e.message) || e}`,
                }));
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

  // Notification Listener
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
        setState((s) => ({
          ...s,
          lastNotification: JSON.stringify(info),
        }));
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

  // Initiales Setup – läuft erst NACH abgeschlossenem Onboarding
  useEffect(() => {
    if (!state.onboardingCompleted || hasRunInit) {
      return;
    }

    (async () => {
      try {
        await ensurePermissions(setState);

        // Expo Push Token + FCM-Token holen
        let expoToken = null;
        let fcmToken = null;

        try {
          const projectId =
            (Constants &&
              Constants.expoConfig &&
              Constants.expoConfig.extra &&
              Constants.expoConfig.extra.eas &&
              Constants.expoConfig.extra.eas.projectId) ||
            (Constants && Constants.easConfig && Constants.easConfig.projectId) ||
            null;

          const tokenData = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );
          expoToken = tokenData.data;
          console.log('[Push] Expo token:', expoToken);
          setState((s) => ({ ...s, pushToken: expoToken }));
        } catch (e) {
          console.warn('[Push] getExpoPushTokenAsync failed:', (e && e.message) || e);
          setState((s) => ({
            ...s,
            lastErr: `[PushToken] ${(e && e.message) || e}`,
          }));
        }

        if (Platform.OS === 'android') {
          try {
            const nativeToken = await Notifications.getDevicePushTokenAsync();
            fcmToken = nativeToken && nativeToken.data ? nativeToken.data : null;
            console.log('[Push] FCM native token:', fcmToken);
            if (fcmToken) {
              setState((s) => ({ ...s, fcmToken }));
            }
          } catch (e) {
            console.warn('[Push] getDevicePushTokenAsync failed:', (e && e.message) || e);
            setState((s) => ({
              ...s,
              lastErr: `[FCMToken] ${(e && e.message) || e}`,
            }));
          }
        }

        try {
          const resp = await registerDevice({ expoPushToken: expoToken, fcmToken });
          console.log('[registerDevice] resp:', resp);
          if (resp && resp.ok) {
            setState((s) => ({ ...s, deviceRegistered: true }));
          }
        } catch (e) {
          console.warn('[registerDevice] failed:', (e && e.message) || e);
          setState((s) => ({
            ...s,
            lastErr: `[register] ${(e && e.message) || e}`,
          }));
        }

        if (appState.current === 'active') {
          await startBgLocation();
          startHeartbeatLoop(setState);
        } else {
          console.log('[INIT] app not active, BG/HB-Loop will be ensured on first active');
        }

        await ensureBackgroundFetch();
        await refreshRuntimeStatus(setState);

        // Initialer Heartbeat (Reason = init)
        const hbResult = await sendImmediateHeartbeat('init');

        lastHbMsRef.current = lastHeartbeatAtMs || Date.now();

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
        setState((s) => ({
          ...s,
          ready: false,
          lastErr: (e && e.message) || String(e),
        }));
      }
    })();

    return () => {
      // Bei Unmount sauber stoppen
      stopHeartbeatLoop(setState);
    };
  }, [state.onboardingCompleted, hasRunInit]);

  // Watchdog: HB-Alter im State halten (für Anzeige) und Poll, solange App im FG
  useEffect(() => {
    const intervalMs = WATCHDOG_POLL_SECONDS * 1000;
    const id = setInterval(() => {
      if (!lastHeartbeatAtMs) {
        return;
      }
      const ageMs = Date.now() - lastHeartbeatAtMs;
      const ageSec = Math.floor(ageMs / 1000);
      setState((s) => {
        const prevAge = s.hbAgeSeconds;
        const prevLastAt = s.lastHeartbeatAt;
        const tsIso = new Date(lastHeartbeatAtMs).toISOString();
        if (prevAge === ageSec && prevLastAt === tsIso) {
          return s;
        }
        return {
          ...s,
          lastHeartbeatAt: tsIso,
          hbAgeSeconds: ageSec,
        };
      });
      lastHbMsRef.current = lastHeartbeatAtMs;
    }, intervalMs);

    return () => clearInterval(id);
  }, []);

  // ── Onboarding-Handler ──────────────────────────────────────────────────────
  const goNextOnboardingStep = () => {
    setState((s) => ({
      ...s,
      onboardingStep: s.onboardingStep + 1,
    }));
  };

  const goPrevOnboardingStep = () => {
    setState((s) => ({
      ...s,
      onboardingStep: s.onboardingStep > 0 ? s.onboardingStep - 1 : 0,
    }));
  };

  const togglePref = (key) => {
    setState((s) => ({
      ...s,
      [key]: !s[key],
    }));
  };

  const completeOnboarding = () => {
    setState((s) => ({
      ...s,
      onboardingCompleted: true,
    }));
  };

  const onManualPing = async () => {
    try {
      const coords = await resolveCoordsForHeartbeat();
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
      lastHbMsRef.current = lastHeartbeatAtMs || Date.now();
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

  const shortExpoToken = state.pushToken ? String(state.pushToken).slice(0, 22) + '…' : '—';
  const shortFcmToken = state.fcmToken ? String(state.fcmToken).slice(0, 22) + '…' : '—';

  const hbAgeText =
    state.hbAgeSeconds == null
      ? '—'
      : state.hbAgeSeconds < 60
      ? `${state.hbAgeSeconds}s`
      : `${Math.floor(state.hbAgeSeconds / 60)}min ${state.hbAgeSeconds % 60}s`;

  // Auswertung der Inter-HB-Intervalle (letzte ≈60 Samples)
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

    hbHistogramText = bucketDefs
      .map((b, idx) => `${b.label}:${bucketCounts[idx]}`)
      .join(' | ');
  }

  // ── Onboarding-UI ───────────────────────────────────────────────────────────
  if (!state.onboardingCompleted) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.title}>ULTREIA – Pilger-Herzschlag</Text>

        {state.onboardingStep === 0 && (
          <>
            <Text style={styles.line}>
              Ultreia läuft wie eine Navigations-App im Hintergrund und sendet in regelmäßigen
              Herzschlägen deine Position an unseren Server. So können wir dich genau im richtigen
              Moment auf Schlafplätze, Essen oder Hilfe in deiner Nähe hinweisen.
            </Text>
            <Text style={styles.line}>
              Wir achten auf deinen Akku:{' '}
              {'\n'}• häufige Herzschläge nur, während du zu Fuß unterwegs bist
              {'\n'}• deutlich weniger Aktivität, wenn du still sitzt oder schläfst
              {'\n'}• keine Dauer-Flut an Notifications – nur dann, wenn es wirklich relevant ist.
            </Text>

            <TouchableOpacity style={styles.btn} onPress={goNextOnboardingStep}>
              <Text style={styles.btnText}>Weiter</Text>
            </TouchableOpacity>
          </>
        )}

        {state.onboardingStep === 1 && (
          <>
            <Text style={styles.line}>
              Worauf soll Ultreia dich unterwegs aufmerksam machen? Du kannst das später jederzeit
              anpassen.
            </Text>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => togglePref('prefAccommodation')}
            >
              <Text style={styles.toggleText}>
                [{state.prefAccommodation ? '✓' : ' '}] Schlafplätze (Albergues) in der Nähe
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefFood')}>
              <Text style={styles.toggleText}>
                [{state.prefFood ? '✓' : ' '}] Essen & Trinken (Menú Peregrino, Bars)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => togglePref('prefPharmacy')}
            >
              <Text style={styles.toggleText}>
                [{state.prefPharmacy ? '✓' : ' '}] Apotheken & medizinische Hilfe
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleRow} onPress={() => togglePref('prefWater')}>
              <Text style={styles.toggleText}>
                [{state.prefWater ? '✓' : ' '}] Wasserstellen & Versorgungspunkte
              </Text>
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
              Um dich im richtigen Moment zu erreichen, braucht Ultreia Zugriff auf Standort und
              Notifications. Wir nutzen diese Daten ausschließlich, um dir auf dem Camino zu
              helfen – nicht für Werbung abseits deiner gewählten Kategorien.
            </Text>
            <Text style={styles.line}>
              Du kannst Ultreia jederzeit wieder schließen oder die Berechtigungen in den
              Android-Einstellungen anpassen. Solange der Herzschlag läuft, verpasst du keine
              wichtigen Punkte entlang des Weges.
            </Text>

            <TouchableOpacity style={styles.btn} onPress={completeOnboarding}>
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

  // ── Haupt-Diagnostics-UI (nach Onboarding) ─────────────────────────────────
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>ULTREIA – Heartbeat + Push MVP</Text>

      <Text style={styles.line}>API_BASE: {API_BASE}</Text>
      <Text style={styles.line}>Device: {DEVICE_ID}</Text>
      <Text style={styles.line}>Expo PushToken: {shortExpoToken}</Text>
      <Text style={styles.line}>FCM-Token: {shortFcmToken}</Text>
      <Text style={styles.line}>
        Device-Register: {state.deviceRegistered ? 'OK' : 'noch nicht'}
      </Text>

      <Text style={styles.line}>Status: {state.ready ? 'Bereit' : 'Init…'}</Text>
      <Text style={styles.line}>
        BG-Task laufend (OS): {state.bgLocRunning ? 'ja' : 'nein'}
      </Text>
      <Text style={styles.line}>BackgroundFetch-Status: {state.fetchStatus}</Text>
      <Text style={styles.line}>
        HB-Loop aktiv (Timer): {state.hbLoopActive ? 'ja' : 'nein'}
      </Text>

      <Text style={styles.line}>
        Letzter OK:{' '}
        {state.lastOkAt ? new Date(state.lastOkAt).toLocaleTimeString() : '—'}
      </Text>
      <Text style={styles.line}>
        Letzter HB-Reason: {state.lastHeartbeatReason || '—'}
      </Text>
      <Text style={styles.line}>
        Letzte HB-Latenz:{' '}
        {state.lastHeartbeatLatencyMs != null ? `${state.lastHeartbeatLatencyMs} ms` : '—'}
      </Text>
      <Text style={styles.line}>
        Letzter HB-Zeitpunkt:{' '}
        {state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).toLocaleTimeString() : '—'}
      </Text>
      <Text style={styles.line}>HB-Alter: {hbAgeText}</Text>
      <Text style={styles.line}>HB-Intervall (letzte HBs): {hbStatsText}</Text>
      <Text style={styles.line}>HB-Histogramm: {hbHistogramText}</Text>

      <Text style={styles.line}>Notif-Permission: {state.notifPermission}</Text>
      <Text style={styles.line}>
        FG-Location-Permission: {state.fgLocationPermission}
      </Text>
      <Text style={styles.line}>
        BG-Location-Permission: {state.bgLocationPermission}
      </Text>

      <Text style={styles.line}>
        Pilger-Präferenzen:{' '}
        {[state.prefAccommodation && 'Schlafplätze', state.prefFood && 'Essen/Trinken', state.prefPharmacy && 'Apotheken', state.prefWater && 'Wasser']
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

      {state.lastErr ? <Text style={styles.err}>Fehler: {state.lastErr}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={onManualPing}>
        <Text style={styles.btnText}>Jetzt Heartbeat senden</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onLocalTestNotification}>
        <Text style={styles.btnText}>Lokale Test-Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={onRefreshBgStatus}>
        <Text style={styles.btnText}>BG-Status aktualisieren</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Hinweis:{'\n'}
        • Backend: Online-API (oder lokal mit http://localhost:4000 per adb reverse){'\n'}
        • Android-Device via USB mit PC verbinden (für lokale Tests).{'\n'}
        • BG-Heartbeat: nominell alle 20s + ~100m Bewegung, Android drosselt im Doze.{'\n'}
        • Foreground-HB-Loop: zusätzlicher Timer (ca. 30s) auf Basis LastKnownLocation für
        stabilere HBs auch bei wenig Bewegung.{'\n'}
        • Watchdog: zeigt HB-Alter, versucht bei Rückkehr in den Vordergrund ein Self-Heal, wenn der
        letzte HB zu lange her ist (~3 min).{'\n'}
        • HB-Stats/Histo: zeigt reale Inter-HB-Intervalle (letzte ≈60 HBs) zur Feintuning-Analyse.{'\n'}
        • Akku-Optimierung DARF anbleiben – Ultreia versucht trotzdem, im Rahmen der Android-Regeln
        stabil zu bleiben.
      </Text>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0b0b0c',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#0b0b0c',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },
  line: {
    color: '#cfcfcf',
    marginBottom: 8,
  },
  err: {
    color: '#ff6b6b',
    marginVertical: 8,
  },
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
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    color: '#9aa0a6',
    marginTop: 16,
    lineHeight: 20,
  },
  notifBox: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1b1c1f',
  },
  notifTitle: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
  },
  notifText: {
    color: '#cfcfcf',
    fontSize: 12,
  },
  toggleRow: {
    marginTop: 10,
    paddingVertical: 10,
  },
  toggleText: {
    color: '#cfcfcf',
  },
  row: {
    flexDirection: 'row',
    marginTop: 18,
  },
  rowButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
