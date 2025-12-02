// ULTREIA – Heartbeat + Push MVP (mit Debug-Notifs, JS-only)
// - BG-Location (≈60s) via Foreground-Service-Notification
// - BackgroundFetch als Fallback
// - Device-Register inkl. Expo-Push-Token + FCM-Token + Diagnostics
// - Lokaler Test-Push-Button + Logging eingehender Notifications
// - API_BASE wieder über app.json (http://localhost:4000/api) + adb reverse

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
const HEARTBEAT_SECONDS = 60;

// API-Base: aus app.json / extra.apiBase (http://localhost:4000/api)
// Emulator-Fallback: 10.0.2.2
const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) ||
  'http://10.0.2.2:4000/api';

const DEVICE_ID = 'ULTR-DEV-001';

// ── Notifications Handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── API Calls ─────────────────────────────────────────────────────────────────
async function sendHeartbeat({ lat, lng, accuracy, source = 'fg' }) {
  const payload = {
    deviceId: DEVICE_ID,
    lat,
    lng,
    accuracy,
    ts: new Date().toISOString(),
    powerState: 'unknown',
    source,
  };
  const res = await fetch(`${API_BASE}/location/heartbeat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${txt}`);
  }
  return res.json();
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
    const { locations } = data || {};
    if (locations && locations.length) {
      const loc = locations[0];
      try {
        await sendHeartbeat({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          source: 'bg',
        });
      } catch (e) {
        console.warn('[BG TASK] heartbeat failed:', e?.message || e);
      }
    }
  });
} catch (e) {
  // duplicate define on fast refresh
}

// ── BackgroundFetch Task ──────────────────────────────────────────────────────
try {
  TaskManager.defineTask(TASK_IDS.fetch, async () => {
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last && last.coords) {
        await sendHeartbeat({
          lat: last.coords.latitude,
          lng: last.coords.longitude,
          accuracy: last.coords.accuracy,
          source: 'fetch',
        });
      }
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
      console.warn('[FETCH TASK] failed:', e?.message || e);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  // duplicate define
}

// ── Start BG-Location ─────────────────────────────────────────────────────────
async function startBgLocation() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
  if (hasStarted) return;

  await Location.startLocationUpdatesAsync(TASK_IDS.bgLoc, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: HEARTBEAT_SECONDS * 1000,
    distanceInterval: 0,
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

// ── BackgroundFetch registrieren ──────────────────────────────────────────────
async function ensureBackgroundFetch() {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_IDS.fetch);
  if (!registered) {
    try {
      await BackgroundFetch.registerTaskAsync(TASK_IDS.fetch, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (e) {
      console.warn('[Fetch] register failed:', e?.message || e);
    }
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
  if (fg.status !== 'granted') throw new Error('Foreground location permission denied');

  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      console.warn('Background location permission not granted yet.');
    }
  }
}

// ── Helper: einmaliger FG-Heartbeat ──────────────────────────────────────────
async function sendImmediateHeartbeat() {
  const last = await Location.getLastKnownPositionAsync();
  let coords = last && last.coords ? last.coords : null;
  if (!coords) {
    const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    coords = cur.coords;
  }
  if (coords) {
    return await sendHeartbeat({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      source: 'fg',
    });
  }
  throw new Error('No coords available');
}

// ── UI Komponente ─────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState({
    ready: false,
    lastOkAt: null,
    lastErr: null,
    lastResp: null,
    bgStarted: false,
    needsRearm: false,
    pushToken: null,
    fcmToken: null,
    deviceRegistered: false,
    lastNotification: null,
    notifPermission: 'unknown',
  });

  const appState = useRef(AppState.currentState);
  const needsRearmRef = useRef(false);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // AppState → Re-Arm von BG-Location
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      appState.current = next;
      if (next === 'active' && needsRearmRef.current) {
        try {
          await startBgLocation();
          needsRearmRef.current = false;
          setState((s) => ({ ...s, bgStarted: true, needsRearm: false }));
        } catch (e) {
          console.warn('[ReArm on active] failed:', e?.message || e);
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
        console.warn('[Notif] parse failed:', e?.message || e);
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

  // Initiales Setup
  useEffect(() => {
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
          console.warn('[Push] getExpoPushTokenAsync failed:', e?.message || e);
          setState((s) => ({
            ...s,
            lastErr: `[PushToken] ${e?.message || e}`,
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
            console.warn('[Push] getDevicePushTokenAsync failed:', e?.message || e);
            setState((s) => ({
              ...s,
              lastErr: `[FCMToken] ${e?.message || e}`,
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
          console.warn('[registerDevice] failed:', e?.message || e);
          setState((s) => ({
            ...s,
            lastErr: `[register] ${e?.message || e}`,
          }));
        }

        if (appState.current === 'active') {
          await startBgLocation();
          setState((s) => ({ ...s, bgStarted: true }));
        } else {
          needsRearmRef.current = true;
          setState((s) => ({ ...s, needsRearm: true }));
        }

        await ensureBackgroundFetch();

        const hbResp = await sendImmediateHeartbeat();

        setState((s) => ({
          ...s,
          ready: true,
          lastOkAt: new Date(),
          lastErr: null,
          lastResp: hbResp,
        }));
      } catch (e) {
        console.warn('[INIT] failed:', e?.message || e);
        setState((s) => ({
          ...s,
          ready: false,
          lastErr: e?.message || String(e),
        }));
      }
    })();
  }, []);

  const onManualPing = async () => {
    try {
      const cur = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const resp = await sendHeartbeat({
        lat: cur.coords.latitude,
        lng: cur.coords.longitude,
        accuracy: cur.coords.accuracy,
        source: 'manual',
      });
      setState((s) => ({
        ...s,
        lastOkAt: new Date(),
        lastErr: null,
        lastResp: resp,
      }));
    } catch (e) {
      setState((s) => ({ ...s, lastErr: e?.message || String(e) }));
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
      console.warn('[LocalNotif] failed:', e?.message || e);
      setState((s) => ({ ...s, lastErr: `[LocalNotif] ${e?.message || e}` }));
    }
  };

  const shortExpoToken = state.pushToken ? String(state.pushToken).slice(0, 22) + '…' : '—';
  const shortFcmToken = state.fcmToken ? String(state.fcmToken).slice(0, 22) + '…' : '—';

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
        BG-Updates:{' '}
        {state.bgStarted
          ? 'gestartet'
          : state.needsRearm
          ? 'wartet auf Vordergrund (Re-Arm)'
          : 'noch nicht'}
      </Text>
      <Text style={styles.line}>
        Letzter OK:{' '}
        {state.lastOkAt ? new Date(state.lastOkAt).toLocaleTimeString() : '—'}
      </Text>
      <Text style={styles.line}>Notif-Permission: {state.notifPermission}</Text>

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

      <Text style={styles.hint}>
        Hinweis:{'\n'}
        • Backend: http://localhost:4000 (per adb reverse){'\n'}
        • Android-Device via USB mit PC verbinden.{'\n'}
        • BackgroundFetch sendet LastKnown-Heartbeats als Fallback.
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
    marginBottom: 6,
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
});
