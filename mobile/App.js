// C:/Ultreia/mobile/App.js
// ULTREIA – Heartbeat MVP + Recovery (expo-background-fetch)
// - BG-Location (≈60s) via Foreground-Service-Notification
// - BackgroundFetch als Fallback (startOnBoot, stopOnTerminate:false)
// - Device-Register + Diagnostics-Banner

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity, AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants from 'expo-constants';

// ── Feste IDs/Konstanten (stabil halten) ──────────────────────────────────────
const TASK_IDS = {
  bgLoc: 'ultreia-bg-location-task',
  fetch: 'ultreia-heartbeat-fetch',
};
const NOTIF_CHANNELS = {
  fg: 'ultreia-fg',
  offers: 'offers',
};
const HEARTBEAT_SECONDS = 60;

// API Base (aus app.json -> extra.apiBase)
const API_BASE =
  (Constants?.expoConfig?.extra && Constants.expoConfig.extra.apiBase) ||
  'http://10.0.2.2:4000/api';

// Für den MVP eine feste Device-ID
const DEVICE_ID = 'ULTR-DEV-001';

// ── Background-Task: BG-Location ──────────────────────────────────────────────
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
} catch { /* Fast-Refresh duplicate define → ignorieren */ }

// ── Background-Task: Fetch (Recovery-Fallback) ────────────────────────────────
try {
  TaskManager.defineTask(TASK_IDS.fetch, async () => {
    try {
      // Sicherstellen, dass BG-Location läuft (re-arm)
      const started = await Location.hasStartedLocationUpdatesAsync(TASK_IDS.bgLoc);
      if (!started) {
        await startBgLocation(); // nutzt Foreground-Service-Notification
      }

      // Versuche mit letzter Position zu senden
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
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
} catch { /* duplicate define → ignorieren */ }

// ── Notifications Setup ────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Heartbeat Call ─────────────────────────────────────────────────────────────
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

// ── Device Register ────────────────────────────────────────────────────────────
async function registerDevice() {
  const res = await fetch(`${API_BASE}/push/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deviceId: DEVICE_ID,
      platform: Platform.OS === 'android' ? 'android' : Platform.OS,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`register HTTP ${res.status} ${txt}`);
  }
  return res.json();
}

// ── Start Background Location mit Foreground-Service ──────────────────────────
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

// ── BackgroundFetch registrieren ───────────────────────────────────────────────
async function ensureBackgroundFetch() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_IDS.fetch);
  if (!isRegistered) {
    try {
      await BackgroundFetch.registerTaskAsync(TASK_IDS.fetch, {
        minimumInterval: 15 * 60, // systemabhängig; Fallback-Schicht
        stopOnTerminate: false,
        startOnBoot: true,
        requiredNetworkType: BackgroundFetch.NetworkType.ANY,
      });
    } catch (e) {
      console.warn('[Fetch] register failed:', e?.message || e);
    }
  }
}

// ── Permissions ────────────────────────────────────────────────────────────────
async function ensurePermissions() {
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
    await Notifications.requestPermissionsAsync();
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

// ── Helper: einmaliger FG-Heartbeat sofort ────────────────────────────────────
async function sendImmediateHeartbeat() {
  const last = await Location.getLastKnownPositionAsync();
  let coords = last?.coords;
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
  });

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await registerDevice();
        await ensurePermissions();
        await startBgLocation();
        await ensureBackgroundFetch(); // <─ Recovery-Fallback aktivieren
        const resp = await sendImmediateHeartbeat();

        setState((s) => ({ ...s, ready: true, lastOkAt: new Date(), lastErr: null, lastResp: resp }));
      } catch (e) {
        setState((s) => ({ ...s, ready: false, lastErr: e?.message || String(e) }));
      }
    })();
  }, []);

  const onManualPing = async () => {
    try {
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const resp = await sendHeartbeat({
        lat: cur.coords.latitude,
        lng: cur.coords.longitude,
        accuracy: cur.coords.accuracy,
        source: 'manual',
      });
      setState((s) => ({ ...s, lastOkAt: new Date(), lastErr: null, lastResp: resp }));
    } catch (e) {
      setState((s) => ({ ...s, lastErr: e?.message || String(e) }));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ULTREIA – Heartbeat MVP</Text>
      <Text style={styles.line}>API_BASE: {API_BASE}</Text>
      <Text style={styles.line}>Device: {DEVICE_ID}</Text>
      <Text style={styles.line}>
        Status: {state.ready ? 'Bereit (BG aktiv)' : 'Init…'}
      </Text>
      <Text style={styles.line}>
        Letzter OK: {state.lastOkAt ? new Date(state.lastOkAt).toLocaleTimeString() : '—'}
      </Text>
      {state.lastErr ? <Text style={styles.err}>Fehler: {state.lastErr}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={onManualPing}>
        <Text style={styles.btnText}>Jetzt Heartbeat senden</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Hinweis: Dauerhafte Service-Benachrichtigung sichtbar?
        App im Hintergrund lassen und die Metrik unter /api/metrics beobachten.
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0c',
    paddingHorizontal: 16,
    paddingTop: 80,
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
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    color: '#9aa0a6',
    marginTop: 14,
    lineHeight: 20,
  },
});
