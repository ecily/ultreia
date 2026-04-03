// stepsmatch/mobile/app/(tabs)/diagnostics.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ✅ KORREKT: Exports aus PushInitializer
import {
  roundtripTest,
  headlessBootstrap,
  kickstartBackgroundLocation,
  // In PushInitializer exportiert als: export const sendHeartbeat = sendHeartbeatOnce;
  sendHeartbeat as sendHeartbeatNow,
} from '../../components/PushInitializer';

// =========================
// Settings & Constants
// =========================
const MAX_LOG_LINES = 1500;
// erweitert: auch LOCAL_PUSH, CHANNELS, WD
const TAG_RE = /\[(push|BGLOC|HEARTBEAT|GEOFENCE|RECONCILE|LOCAL_PUSH_SHOWN|LOCAL_PUSH|CHANNELS|WD)\]/i;

const TOKEN_KEY = 'expoPushToken.v2';
const DEVICE_ID_SECURE_KEY = 'deviceId.v1';
const GLOBAL_STATE_KEY = 'offerPushState.__global';

// ⚠️ Muss exakt der FG_CHANNEL_ID aus PushInitializer + app.config.js entsprechen:
const OFFERS_CHANNEL_ID = 'offers-v2';
const BG_CHANNEL_IDS = ['stepsmatch-bg-location-task', 'com.ecily.mobile:stepsmatch-bg-location-task'];
const HEARTBEAT_FETCH_TASK = 'stepsmatch-heartbeat-fetch';

// Backend (wie im PushInitializer)
const API_BASE =
  (Constants?.expoConfig?.extra?.apiBase) ??
  'https://lobster-app-ie9a5.ondigitalocean.app/api';

// ▶️ Akku-Keys JETZT konsistent zum PermissionGate
const BATTERY_CONFIRM_KEY = 'batteryOptOut.confirmed';
const BATTERY_CONFIRM_AT_KEY = 'batteryOptOut.confirmedAt';
const LAST_TOKEN_REFRESH_AT_KEY = 'push.lastTokenRefreshAt';

// Heuristik: wie frisch ist „frisch“?
const BG_FIX_FRESH_MS = 2 * 60 * 1000; // 2 min
const HB_FRESH_MS = 2 * 60 * 1000;     // 2 min

// App-Package (für Intents)
const ANDROID_PACKAGE =
  (Constants?.expoConfig?.android?.package) || 'com.ecily.mobile';

// =========================
// Lightweight Log Capture
// =========================
function formatArg(a) {
  if (a == null) return String(a);
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}
function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
/** Install once */
function ensureGlobalLogWrap() {
  if (globalThis.__SM_LOG_WRAP__) return;
  const ensureBuffer = () => {
    if (!globalThis.__SM_LOGS__) globalThis.__SM_LOGS__ = [];
    return globalThis.__SM_LOGS__;
  };
  const wrap = (orig, level) => (...args) => {
    try {
      const line = `[${level}] ${ts()} ${args.map(formatArg).join(' ')}`;
      const buf = ensureBuffer();
      buf.push(line);
      if (buf.length > MAX_LOG_LINES) buf.splice(0, buf.length - MAX_LOG_LINES);
    } catch {}
    try { orig(...args); } catch {}
  };
  console.log   = wrap(console.log.bind(console),   'LOG');
  console.warn  = wrap(console.warn?.bind(console)  || console.log.bind(console), 'WARN');
  console.error = wrap(console.error?.bind(console) || console.log.bind(console), 'ERROR');
  globalThis.__SM_LOG_WRAP__ = true;
}
function getLogs() { return Array.isArray(globalThis.__SM_LOGS__) ? globalThis.__SM_LOGS__ : []; }
function clearLogs() { if (Array.isArray(globalThis.__SM_LOGS__)) globalThis.__SM_LOGS__.length = 0; }

// =========================
const fmtMsAge = (t) => {
  if (!t) return '–';
  const age = Date.now() - Number(t);
  const s = Math.floor(age / 1000);
  if (s < 120) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 120) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};
const take = (s, n=28) => (s ? String(s).slice(0, n) + (String(s).length>n ? '…' : '') : '–');

// ❗️Lokale Zeit parsen (nicht mit „Z“ als UTC forcen)
function parseWrappedLogTimestamp(line) {
  // format: [LEVEL] YYYY-MM-DD HH:mm:ss ...
  const m = line.match(/^\[(LOG|WARN|ERROR)\]\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return 0;
  const isoLocal = `${m[2]}T${m[3]}`;
  const t = Date.parse(isoLocal);
  return Number.isFinite(t) ? t : 0;
}
function lastEventFromLogs(lines, re) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (re.test(lines[i])) {
      const t = parseWrappedLogTimestamp(lines[i]);
      return { line: lines[i], at: t };
    }
  }
  return { line: null, at: 0 };
}

// Näherungsweise „Kandidaten in der Nähe“ (Backend)
async function fetchNearbyOfferCandidates(pos) {
  if (!pos?.coords?.latitude || !pos?.coords?.longitude) return [];
  try {
    const res = await fetch(`${API_BASE}/offers?withProvider=1&fields=_id,title,name,location,provider,radius,validTimes,validDays,validDates`);
    const json = await res.json().catch(()=>({}));
    const list = Array.isArray(json) ? json : json?.data || [];
    const toRad = (d) => (d * Math.PI) / 180;
    const hav = (aLat, aLng, bLat, bLng) => {
      const R = 6371000, dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
      const s1 = Math.sin(dLat/2), s2 = Math.sin(dLng/2);
      const aa = s1*s1 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*s2*s2;
      return Math.round(2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa)));
    };
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const acc = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : 20;
    const accAdj = Math.min((acc * 0.5), 20);
    const items = [];
    for (const o of list) {
      try {
        const p = (o?.location?.coordinates && Array.isArray(o.location.coordinates))
          ? { lng: Number(o.location.coordinates[0]), lat: Number(o.location.coordinates[1]) }
          : null;
        if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const d = hav(here.lat, here.lng, p.lat, p.lng);
        if (d <= 3000) {
          const radius = Number.isFinite(Number(o?.radius)) ? Math.max(30, Math.min(500, Number(o.radius))) : 120;
          const effective = radius + accAdj + 2; // radius + min(acc*0.5,20) + 2
          items.push({
            id: String(o?._id || ''),
            title: o?.title || o?.name || 'Offer',
            provider: o?.provider?.name || '',
            d, radius, effective
          });
        }
      } catch {}
    }
    items.sort((a,b)=>a.d-b.d);
    return items.slice(0, 20);
  } catch {
    return [];
  }
}

// =========================
// Diagnostics Screen
// =========================
export default function Diagnostics() {
  const [logs, setLogs] = useState(() => getLogs());
  const [onlyTagged, setOnlyTagged] = useState(true);
  const logScrollerRef = useRef(null);

  const [notifPerm, setNotifPerm] = useState('unknown');
  const [locPerm, setLocPerm] = useState({ fg: 'unknown', bg: 'unknown' });

  const [bgStarted, setBgStarted] = useState(false);
  const [gfStarted, setGfStarted] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('unknown');
  const [fetchTaskReg, setFetchTaskReg] = useState(false);

  const [lastFixAt, setLastFixAt] = useState(0);
  const [lastHeartbeatLogAt, setLastHeartbeatLogAt] = useState(0);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(0);

  const [lastKnown, setLastKnown] = useState(null);
  const [providerStatus, setProviderStatus] = useState(null);

  const [token, setToken] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  const [channels, setChannels] = useState([]);
  const [candidates, setCandidates] = useState([]);

  // ▶️ neue Zustände
  const [batteryConfirmed, setBatteryConfirmed] = useState(false);
  const [batteryConfirmedAt, setBatteryConfirmedAt] = useState(0);
  const [lastTokenRefreshAt, setLastTokenRefreshAt] = useState(0);

  const [appState, setAppState] = useState(AppState.currentState || 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub?.remove?.();
  }, []);

  // ---- poll logs every 500ms
  useEffect(() => {
    ensureGlobalLogWrap();
    const iv = setInterval(() => setLogs(getLogs().slice(-MAX_LOG_LINES)), 500);
    return () => clearInterval(iv);
  }, []);

  // Ableitung: letzte Heartbeat-/ENTER-Aktivität aus Logs
  useEffect(() => {
    const l1 = lastEventFromLogs(logs, /\[HEARTBEAT\]/i);
    setLastHeartbeatLogAt(l1.at || 0);
  }, [logs]);

  const filtered = useMemo(() => (onlyTagged ? logs.filter((l) => TAG_RE.test(l)) : logs), [logs, onlyTagged]);

  const onCopy = async () => {
    try { await Clipboard.setStringAsync((filtered || []).join('\n') || '(keine Logs)'); } catch {}
  };
  const onClear = () => { clearLogs(); setLogs([]); };

  // ---- refresh diagnostics snapshot
  const snapshot = async () => {
    try {
      const pre = await Notifications.getPermissionsAsync();
      setNotifPerm(pre?.status || 'unknown');
    } catch {}

    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      setLocPerm({ fg: fg?.status || 'unknown', bg: bg?.status || 'unknown' });
    } catch {}

    try {
      setBgStarted(await Location.hasStartedLocationUpdatesAsync('stepsmatch-bg-location-task'));
    } catch { setBgStarted(false); }
    try {
      setGfStarted(await Location.hasStartedGeofencingAsync('stepsmatch-geofence-task'));
    } catch { setGfStarted(false); }
    try {
      const s = await BackgroundFetch.getStatusAsync();
      setFetchStatus(
        s === BackgroundFetch.BackgroundFetchStatus.Available
          ? 'available'
          : s === BackgroundFetch.BackgroundFetchStatus.Denied
            ? 'denied'
            : s === BackgroundFetch.BackgroundFetchStatus.Restricted
              ? 'restricted'
              : 'unknown'
      );
    } catch { setFetchStatus('unknown'); }
    try {
      const fn = TaskManager?.isTaskRegisteredAsync;
      setFetchTaskReg(fn ? await fn(HEARTBEAT_FETCH_TASK) : false);
    } catch { setFetchTaskReg(false); }

    try {
      const lf = Number(await AsyncStorage.getItem('lastFixAt') || 0);
      setLastFixAt(lf);
    } catch { setLastFixAt(0); }
    try {
      const gs = await AsyncStorage.getItem(GLOBAL_STATE_KEY);
      const parsed = gs ? JSON.parse(gs) : null;
      setLastHeartbeatAt(Number(parsed?.lastHeartbeatAt || 0));
    } catch { setLastHeartbeatAt(0); }

    try {
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 400 });
      setLastKnown(pos || null);
      // Kandidaten (nahe Offers vom Backend)
      const cand = await fetchNearbyOfferCandidates(pos || null);
      setCandidates(cand);
    } catch {
      setLastKnown(null);
      setCandidates([]);
    }

    try {
      const prov = await Location.getProviderStatusAsync();
      setProviderStatus(prov || null);
    } catch { setProviderStatus(null); }

    try {
      const cached = await AsyncStorage.getItem(TOKEN_KEY);
      setToken(cached || null);
    } catch {}

    try {
      const did = await SecureStore.getItemAsync(DEVICE_ID_SECURE_KEY);
      setDeviceId(did || null);
    } catch {}

    // ▶️ neue Felder laden (konsistent zum PermissionGate)
    try { setBatteryConfirmed((await AsyncStorage.getItem(BATTERY_CONFIRM_KEY)) === 'true'); } catch {}
    try { setBatteryConfirmedAt(Number(await AsyncStorage.getItem(BATTERY_CONFIRM_AT_KEY) || 0)); } catch {}
    try { setLastTokenRefreshAt(Number(await AsyncStorage.getItem(LAST_TOKEN_REFRESH_AT_KEY) || 0)); } catch {}

    if (Platform.OS === 'android') {
      try {
        const list = await Notifications.getNotificationChannelsAsync();
        setChannels(Array.isArray(list) ? list : []);
      } catch { setChannels([]); }
    }
  };

  useEffect(() => {
    snapshot();
    const iv = setInterval(snapshot, 3000);
    return () => clearInterval(iv);
  }, []);

  const localNow = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'StepsMatch – Local Test',
          body: 'Sofortige Local-Notification',
          data: { offerId: 'LOCAL_TEST' },
          channelId: OFFERS_CHANNEL_ID,
          categoryIdentifier: 'offer-go-v2',
        },
        trigger: null,
      });
      console.log('[diag] scheduled local notification');
    } catch (e) {
      console.log('[diag] local notification error', String(e));
    }
  };

  const roundtrip = async () => {
    try {
      await roundtripTest('ROUNDTRIP_TEST');
    } catch (e) {
      console.log('[diag] roundtrip error', String(e));
    }
  };

  const heartbeatNow = async () => {
    try {
      await sendHeartbeatNow();
      console.log('[diag] manual heartbeat sent (also triggers geofence refresh)');
      await snapshot();
    } catch (e) {
      console.log('[diag] heartbeat error', String(e));
    }
  };

  const restartBg = async () => {
    try {
      await headlessBootstrap();            // re-register, ensure channels
      await kickstartBackgroundLocation();  // 🔧 BG Location wirklich starten
      await sendHeartbeatNow();             // warmup + geofence refresh
      console.log('[diag] BG kickstart requested');
      await snapshot();
    } catch (e) {
      console.log('[diag] restartBg error', String(e));
    }
  };

  const openIgnoreBatteryOptimizations = async () => {
    if (Platform.OS !== 'android') return;
    try {
      // ✅ mit package → direkter Sprung zur App
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        { data: `package:${ANDROID_PACKAGE}` }
      );
    } catch {
      try {
        await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      } catch {
        Linking.openSettings().catch(()=>{});
      }
    }
  };

  const openAppNotificationSettings = async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync('android.settings.APP_NOTIFICATION_SETTINGS', {
        data: undefined,
        flags: 0,
        extra: {
          'android.provider.extra.APP_PACKAGE': ANDROID_PACKAGE,
          'app_package': ANDROID_PACKAGE,
          'app_uid': 0,
        },
      });
    } catch {
      Linking.openSettings().catch(()=>{});
    }
  };

  // ▶️ Akku-Optimierung: Acknowledge/Reset (zeigt nur UI-Status an)
  const markBatteryAck = async () => {
    try {
      await AsyncStorage.setItem(BATTERY_CONFIRM_KEY, 'true');
      await AsyncStorage.setItem(BATTERY_CONFIRM_AT_KEY, String(Date.now()));
    } catch {}
    await snapshot();
  };
  const resetBatteryAck = async () => {
    try {
      await AsyncStorage.removeItem(BATTERY_CONFIRM_KEY);
      await AsyncStorage.removeItem(BATTERY_CONFIRM_AT_KEY);
    } catch {}
    await snapshot();
  };

  const atBottom = () => { requestAnimationFrame(() => logScrollerRef.current?.scrollToEnd?.({ animated: false })); };
  useEffect(() => { atBottom(); }, [filtered.length]);

  // ===== Derived Checks / Verdict =====
  const chById = useMemo(() => {
    const map = {};
    for (const c of channels) map[c.id] = c;
    return map;
  }, [channels]);

  const chOffers = chById[OFFERS_CHANNEL_ID];
  const chBg     = BG_CHANNEL_IDS.map((id) => chById[id]).find(Boolean);

  // importance: 1=NONE 2=MIN 3=LOW 4=DEFAULT 5=HIGH 6=MAX (Expo)
  const offersIsMax = !!chOffers && Number(chOffers.importance) >= 6;
  const offersHasSound = !!chOffers && !!chOffers.sound; // "arrival" erwartet
  const bgIsPresent = !!chBg;
  const channelTuningOk = offersIsMax && offersHasSound && bgIsPresent;

  const notifOk = notifPerm === 'granted';
  const locOk = (locPerm.fg === 'granted') && (locPerm.bg === 'granted');

  // ✅ Robustere Einschätzung, ob BG wirklich läuft:
  const now = Date.now();
  const bgApiStarted = !!bgStarted;
  const bgRecentFix = !!lastFixAt && (now - lastFixAt <= BG_FIX_FRESH_MS);
  const hbRecent = !!lastHeartbeatLogAt && (now - lastHeartbeatLogAt <= HB_FRESH_MS);
  const bgEffective = bgApiStarted || bgRecentFix || hbRecent;

  const hasNearbyCandidates = Array.isArray(candidates) && candidates.length > 0;
  const geofenceOk = hasNearbyCandidates ? gfStarted : true;
  const tasksOk = bgEffective && geofenceOk;

  const verdictOK = notifOk && locOk && tasksOk;

  const verdictWarn =
    verdictOK && !channelTuningOk;

  // ===== Render =====
  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.h}>System-Check</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={() => setOnlyTagged((v) => !v)}>
              <Text style={s.bt}>{onlyTagged ? 'Alle Logs' : 'Nur Tags'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.bGray]} onPress={onClear}>
              <Text style={s.bt}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.bBlue]} onPress={onCopy}>
              <Text style={s.bt}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={heartbeatNow}>
            <Text style={s.bt}>Heartbeat jetzt (→ Geofence-Refresh)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={restartBg}>
            <Text style={s.bt}>BG Location (re)starten</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={localNow}>
            <Text style={s.bt}>Lokale Notification (sofort)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnFull, s.bBlue]} onPress={roundtrip}>
            <Text style={s.bt}>Roundtrip an Backend</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openAppNotificationSettings}>
                <Text style={s.bt}>App-Benachrichtigungen öffnen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openIgnoreBatteryOptimizations}>
                <Text style={s.bt}>Akku-Optimierung öffnen</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Verdict */}
        <View style={s.cards}>
          <Card title="Gesamtstatus">
            {verdictOK ? (
              <Verdict ok label="Alles OK – Push sollte früh & zuverlässig feuern." />
            ) : verdictWarn ? (
              <Verdict warn label="Läuft grundsätzlich – Feintuning empfohlen (Kanal/Sound/Tasks)." />
            ) : (
              <Verdict ok={false} warn={false} label="Fehler – mindestens eine Kernvoraussetzung fehlt." />
            )}
          </Card>

          <Card title="App / Build">
            <KV k="ProjectId" v={String((Constants.expoConfig?.extra?.eas?.projectId) || (Constants.easConfig?.projectId) || '–')} />
            <KV k="ReleaseChannel" v={String(Constants.expoConfig?.releaseChannel || 'default')} />
            <KV k="AppState" v={String(appState)} />
          </Card>

          <Card title="Permissions">
            <Row verdict={notifOk} label="Notifications" value={notifPerm} />
            <Row verdict={locPerm.fg === 'granted'} label="Location (Foreground)" value={locPerm.fg} />
            <Row verdict={locPerm.bg === 'granted'} label="Location (Background)" value={locPerm.bg} />
          </Card>

          <Card title="Background Services">
            {/* Zwei Ebenen: API vs. Effektiv */}
            <Row verdict={bgApiStarted} label="BG Location started (API)" value={String(bgApiStarted)} />
            <Row verdict={bgEffective} label="BG Location healthy (effektiv)" value={String(bgEffective)} />
            <Row verdict={geofenceOk} label="Geofencing started" value={hasNearbyCandidates ? String(gfStarted) : 'idle (no nearby offers)'} />
            <Row verdict={fetchStatus === 'available'} label="BackgroundFetch" value={fetchStatus} />
            <Row verdict={!!fetchTaskReg} label="Fetch Task registered" value={String(fetchTaskReg)} />
            <KV k="lastFixAt" v={fmtMsAge(lastFixAt)} />
            <KV k="lastHeartbeat(log)" v={fmtMsAge(lastHeartbeatLogAt)} />
            <KV k="lastHeartbeat(state)" v={fmtMsAge(lastHeartbeatAt)} />
          </Card>

          <Card title="Position (lastKnown)">
            <KV k="lat" v={lastKnown?.coords?.latitude?.toFixed?.(5) ?? '–'} />
            <KV k="lng" v={lastKnown?.coords?.longitude?.toFixed?.(5) ?? '–'} />
            <KV k="acc" v={lastKnown?.coords?.accuracy != null ? `${Math.round(lastKnown.coords.accuracy)} m` : '–'} />
            <KV k="speed" v={lastKnown?.coords?.speed != null ? `${Number(lastKnown.coords.speed).toFixed(2)} m/s` : '–'} />
            <KV k="age" v={lastKnown?.timestamp ? fmtMsAge(lastKnown.timestamp) : '–'} />
          </Card>

          <Card title="Location Provider">
            <KV k="GPS enabled" v={providerStatus?.gpsAvailable === true ? 'true' : 'false'} />
            <KV k="Network enabled" v={providerStatus?.networkAvailable === true ? 'true' : 'false'} />
            <KV k="Location services" v={providerStatus?.locationServicesEnabled === true ? 'true' : 'false'} />
          </Card>

          <Card title="Identity">
            <KV k="Expo Token" v={take(token)} />
            <KV k="DeviceId" v={take(deviceId)} />
          </Card>

          {Platform.OS === 'android' && (
            <Card title="Android Channels">
              {channels.length === 0 ? (
                <Text style={s.kvV}>–</Text>
              ) : (
                channels.map((c) => (
                  <Text key={c.id} style={s.kvV}>
                    {c.id}{'  '}
                    <Text style={s.kvDim}>
                      importance={c.importance} sound={c.sound || 'none'} bypassDnd={String(c.bypassDnd || false)}
                    </Text>
                  </Text>
                ))
              )}
              <Text style={s.hintSmall}>
                Erwartet: [{BG_CHANNEL_IDS.join(' | ')}] present; {OFFERS_CHANNEL_ID} importance=MAX &amp; sound≠none
              </Text>
            </Card>
          )}

          {Platform.OS === 'android' && (
            <Card title="Akku-Optimierung (Android)">
              <KV k="Bestätigt" v={batteryConfirmed ? 'true' : 'false'} />
              <KV k="Bestätigt seit" v={batteryConfirmedAt ? fmtMsAge(batteryConfirmedAt) : '–'} />
              <View style={{ marginTop: 8, gap: 8 }}>
                <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={openIgnoreBatteryOptimizations}>
                  <Text style={s.bt}>Einstellung öffnen</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[s.btn, s.bBlue, { flex: 1 }]} onPress={markBatteryAck}>
                    <Text style={s.bt}>Als bestätigt markieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, s.bGray, { flex: 1 }]} onPress={resetBatteryAck}>
                    <Text style={s.bt}>Zurücksetzen</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.hintSmall}>
                  Android liefert kein sicheres API, um den Ignore-Whitelist-Status auszulesen. Dieses Flag ist bewusst „manuell“.
                </Text>
              </View>
            </Card>
          )}

          <Card title="Self-Heal / Token">
            <KV k="Letzter Token-Refresh" v={fmtMsAge(lastTokenRefreshAt)} />
            <Text style={s.hintSmall}>
              Der Token wird automatisch erneuert (Self-Heal), z.B. bei „DeviceNotRegistered“. Manuell anstoßen über „BG Location (re)starten“.
            </Text>
          </Card>

          <Card title="Kandidaten in deiner Nähe (vom Backend)">
            {candidates.length === 0 ? (
              <Text style={s.kvV}>–</Text>
            ) : (
              candidates.map((it) => (
                <Text key={it.id} style={s.kvV}>
                  {take(it.title || it.id, 22)} · d={it.d}m · r={it.radius} · eff≈{Math.round(it.effective)}m {it.d <= it.effective ? '● ENTER möglich' : ''}
                </Text>
              ))
            )}
            <Text style={s.hintSmall}>
              ENTER-Regel: d ≤ radius + min(acc*0.5, 20) + 2 (acc aus lastKnown)
            </Text>
            <View style={{ marginTop: 8, gap: 8 }}>
              <TouchableOpacity style={[s.btnFull, s.bGray]} onPress={snapshot}>
                <Text style={s.bt}>Snapshot aktualisieren</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Logs */}
        <View style={s.logWrapper}>
          <ScrollView
            ref={logScrollerRef}
            style={s.logBox}
            contentContainerStyle={s.logContent}
            nestedScrollEnabled
          >
            {filtered.length === 0 ? (
              <Text style={s.logEmpty}>Keine Logs vorhanden.</Text>
            ) : (
              filtered.map((line, i) => (
                <Text key={i} style={lineStyle(line)} selectable>
                  {line}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        <Text style={s.hint}>
          Gefilterte Tags: [push], [BGLOC], [HEARTBEAT], [GEOFENCE], [RECONCILE], [LOCAL_PUSH], [LOCAL_PUSH_SHOWN], [CHANNELS], [WD]. Umschalten über „Nur Tags/Alle Logs“.
        </Text>
      </ScrollView>
    </View>
  );
}

// ===== UI Bits
function Verdict({ ok, warn, label }) {
  const style = ok ? v.ok : warn ? v.warn : v.fail;
  return <Text style={[v.badge, style]}>{label}</Text>;
}
function Row({ verdict, label, value }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvK}>{label}</Text>
      <Text style={[s.kvV, verdict ? s.good : s.bad]}>{String(value)}</Text>
    </View>
  );
}
function KV({ k, v }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={s.kvV}>{String(v)}</Text>
    </View>
  );
}
function Card({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={{ marginTop: 8, gap: 4 }}>{children}</View>
    </View>
  );
}
function lineStyle(line) {
  if (/\[ERROR\]/.test(line)) return s.logErr;
  if (/\[WARN\]/.test(line)) return s.logWarn;
  if (/\[(GEOFENCE|RECONCILE|LOCAL_PUSH_SHOWN|LOCAL_PUSH)\]/i.test(line)) return s.logHot;
  if (/\[(push|BGLOC|HEARTBEAT|CHANNELS|WD)\]/i.test(line)) return s.logInfo;
  return s.log;
}

// ===== Styles
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7ff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#f4f7ff' },
  h: { fontSize: 20, fontWeight: '900', color: '#0b1220' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },

  actions: { padding: 16, gap: 10, backgroundColor: '#f4f7ff' },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnFull: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },

  bBlue: { backgroundColor: '#2563eb' },
  bGray: { backgroundColor: '#334155' },

  bt: { color: 'white', fontWeight: '700' },

  cards: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#d8e1f0' },
  cardTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginBottom: 2 },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kvK: { color: '#64748b' },
  kvV: { color: '#0f172a', fontWeight: '700' },
  kvDim: { color: '#64748b' },
  good: { color: '#15803d' },
  bad: { color: '#b91c1c' },

  logWrapper: { paddingHorizontal: 16, paddingTop: 8 },
  logBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e1f0',
    maxHeight: 360,
  },
  logContent: { padding: 12 },
  log: { color: '#334155', fontFamily: 'monospace', marginBottom: 4 },
  logInfo: { color: '#1d4ed8', fontFamily: 'monospace', marginBottom: 4 },
  logHot: { color: '#15803d', fontFamily: 'monospace', marginBottom: 4 },
  logWarn: { color: '#b45309', fontFamily: 'monospace', marginBottom: 4 },
  logErr: { color: '#b91c1c', fontFamily: 'monospace', marginBottom: 4 },
  logEmpty: { color: '#64748b', fontStyle: 'italic' },

  hint: { color: '#64748b', padding: 12, fontSize: 12 },
  hintSmall: { color: '#64748b', paddingTop: 8, fontSize: 11 },
});

const v = StyleSheet.create({
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, fontWeight: '800', alignSelf: 'flex-start' },
  ok:   { backgroundColor: '#dcfce7', color: '#166534', borderWidth: 1, borderColor: '#86efac' },
  warn: { backgroundColor: '#fef3c7', color: '#92400e', borderWidth: 1, borderColor: '#fcd34d' },
  fail: { backgroundColor: '#fee2e2', color: '#991b1b', borderWidth: 1, borderColor: '#fca5a5' },
});

