// C:\ultreia\mobile\App.js
// ULTREIA – UI Shell (Engine ist ausgelagert nach src/engine/ultreiaEngine.js)
// Block 4/6: App.js nutzt Engine-APIs; UI bleibt stabil, Motor bleibt unverändert.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  API_BASE,
  DEBUG_DEFAULTS,
  ensureBackgroundFetch,
  ensurePermissions,
  getEasProjectIdMaybe,
  getEngineSnapshot,
  getHbIntervalsRef,
  getWatchdogPollSeconds,
  hbAgeSecondsNow,
  loadInterestsCached,
  loadNotifInbox,
  loadPrefsFromStorage,
  normalizeNotifItem,
  persistNotifInbox,
  postJson,
  refreshRuntimeStatus,
  registerDevice,
  resolveCoordsForHeartbeat,
  resolveDeviceId,
  safeJsonStringify,
  savePrefsAndInterests,
  sendHeartbeatSingleFlight,
  sendImmediateHeartbeat,
  startBgLocation,
  startHeartbeatLoop,
  stopHeartbeatLoop,
} from './src/engine/ultreiaEngine';

// ── Watchdog thresholds (UI-seitig für ReArm-Entscheidung) ───────────────────
const WATCHDOG_STALE_SECONDS = 3 * 60;

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
  const notifSubRef = useRef(null);
  const respSubRef = useRef(null);

  // Stop HB loop only on real unmount (NOT on init-effect cleanup)
  useEffect(() => {
    return () => {
      stopHeartbeatLoop(setState);
    };
  }, []);

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

          try {
            await startBgLocation();
          } catch (e) {
            // ignore
          }

          await refreshRuntimeStatus(setState);
          startHeartbeatLoop(setState);

          const ageSec = hbAgeSecondsNow();
          if (ageSec != null) {
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

    notifSubRef.current = notifSub;
    respSubRef.current = respSub;

    return () => {
      if (notifSubRef.current && typeof notifSubRef.current.remove === 'function') {
        notifSubRef.current.remove();
      }
      if (respSubRef.current && typeof respSubRef.current.remove === 'function') {
        respSubRef.current.remove();
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

        // IMPORTANT: set this at the very end; no init-cleanup stops hb-loop anymore
        setHasRunInit(true);
      } catch (e) {
        console.warn('[INIT] failed:', (e && e.message) || e);
        setState((s) => ({ ...s, ready: false, lastErr: (e && e.message) || String(e) }));
      }
    })();
  }, [state.onboardingCompleted, hasRunInit]);

  // ── HB age poll (UI)
  useEffect(() => {
    const pollSeconds = getWatchdogPollSeconds();
    const id = setInterval(() => {
      const snap = getEngineSnapshot();
      if (!snap || !snap.lastHeartbeatAtMs) return;

      const ageSec = snap.hbAgeSeconds != null ? snap.hbAgeSeconds : null;
      const tsIso = new Date(snap.lastHeartbeatAtMs).toISOString();

      setState((s) => {
        if (s.hbAgeSeconds === ageSec && s.lastHeartbeatAt === tsIso) return s;
        return { ...s, lastHeartbeatAt: tsIso, hbAgeSeconds: ageSec };
      });
    }, pollSeconds * 1000);

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

      let category = 'restaurant';
      try {
        const ints = await loadInterestsCached();
        if (Array.isArray(ints) && ints.length) category = String(ints[0]);
      } catch (e) {
        // ignore
      }

      const resp = await postJson('/debug/seed-offer', {
        deviceId,
        lat: coords.latitude,
        lng: coords.longitude,
        category,
        radiusMeters: DEBUG_DEFAULTS.offerRadiusM,
        validMinutes: DEBUG_DEFAULTS.offerValidMin,
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
    const intervals = getHbIntervalsRef();
    if (!intervals || intervals.length <= 0) return { statsText: '—', histText: '—' };

    let sum = 0;
    let min = intervals[0];
    let max = intervals[0];
    for (let i = 0; i < intervals.length; i += 1) {
      const v = intervals[i];
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const avg = sum / intervals.length;
    const statsText = `n=${intervals.length}, min=${min}s, Ø=${avg.toFixed(1)}s, max=${max}s`;

    const bucketDefs = [
      { label: '<30s', min: 0, max: 29 },
      { label: '30–59s', min: 30, max: 59 },
      { label: '60–119s', min: 60, max: 119 },
      { label: '120–299s', min: 120, max: 299 },
      { label: '>=300s', min: 300, max: Infinity },
    ];
    const bucketCounts = bucketDefs.map(() => 0);

    for (let i = 0; i < intervals.length; i += 1) {
      const v = intervals[i];
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
  }, [state.hbAgeSeconds]);

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

  // ── Onboarding UI
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
            <Text style={styles.kv}>
              Bereit: <Text style={styles.kvVal}>{state.ready ? 'Ja' : 'Nein'}</Text>
            </Text>
            <Text style={styles.kv}>
              BG-Task: <Text style={styles.kvVal}>{state.bgLocRunning ? 'Läuft' : 'Aus'}</Text>
            </Text>
            <Text style={styles.kv}>
              Fetch: <Text style={styles.kvVal}>{state.fetchStatus}</Text>
            </Text>
            <Text style={styles.kv}>
              HB-Loop: <Text style={styles.kvVal}>{state.hbLoopActive ? 'Aktiv' : 'Inaktiv'}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Heartbeat</Text>
            <Text style={styles.kv}>
              Alter: <Text style={styles.kvVal}>{hbAgeText}</Text>
            </Text>
            <Text style={styles.kv}>
              Letzter OK: <Text style={styles.kvVal}>{okAt}</Text>
            </Text>
            <Text style={styles.kv}>
              Letzter HB: <Text style={styles.kvVal}>{hbAt}</Text>
            </Text>
            <Text style={styles.kv}>
              Reason: <Text style={styles.kvVal}>{state.lastHeartbeatReason || '—'}</Text>
            </Text>
            <Text style={styles.kv}>
              Latenz:{' '}
              <Text style={styles.kvVal}>
                {state.lastHeartbeatLatencyMs != null ? `${state.lastHeartbeatLatencyMs} ms` : '—'}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dein Fokus</Text>
          <Text style={styles.p}>Aktiv: {prefsSummary || '—'}</Text>

          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[styles.pill, state.prefAccommodation ? styles.pillOn : styles.pillOff]}
              onPress={() => togglePref('prefAccommodation')}
            >
              <Text style={styles.pillText}>Schlaf</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, state.prefFood ? styles.pillOn : styles.pillOff]}
              onPress={() => togglePref('prefFood')}
            >
              <Text style={styles.pillText}>Essen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, state.prefPharmacy ? styles.pillOn : styles.pillOff]}
              onPress={() => togglePref('prefPharmacy')}
            >
              <Text style={styles.pillText}>Apotheke</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, state.prefWater ? styles.pillOn : styles.pillOff]}
              onPress={() => togglePref('prefWater')}
            >
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
          <Text style={styles.pStrong} numberOfLines={1}>
            {deviceId}
          </Text>

          <Text style={styles.smallMuted}>API</Text>
          <Text style={styles.p} numberOfLines={2}>
            {API_BASE}
          </Text>
        </View>
      </>
    );
  };

  const DiagnosticsScreen = () => {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diagnostik</Text>

          <Text style={styles.kv}>
            Device: <Text style={styles.kvVal}>{state.deviceId || '—'}</Text>
          </Text>
          <Text style={styles.kv}>
            Interests (cache): <Text style={styles.kvVal}>{state.interestsLabel || 'none'}</Text>
          </Text>
          <Text style={styles.kv}>
            Expo Token: <Text style={styles.kvVal}>{shortExpoToken}</Text>
          </Text>
          <Text style={styles.kv}>
            FCM Token: <Text style={styles.kvVal}>{shortFcmToken}</Text>
          </Text>
          <Text style={styles.kv}>
            Device-Register: <Text style={styles.kvVal}>{state.deviceRegistered ? 'OK' : 'noch nicht'}</Text>
          </Text>

          <View style={styles.hr} />

          <Text style={styles.kv}>
            Notif-Permission: <Text style={styles.kvVal}>{state.notifPermission}</Text>
          </Text>
          <Text style={styles.kv}>
            FG-Location: <Text style={styles.kvVal}>{state.fgLocationPermission}</Text>
          </Text>
          <Text style={styles.kv}>
            BG-Location: <Text style={styles.kvVal}>{state.bgLocationPermission}</Text>
          </Text>

          <View style={styles.hr} />

          <Text style={styles.kv}>
            HB-Intervall Stats: <Text style={styles.kvVal}>{hbStats.statsText}</Text>
          </Text>
          <Text style={styles.kv}>
            HB-Histogramm: <Text style={styles.kvVal}>{hbStats.histText}</Text>
          </Text>

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
            <Text style={styles.kv}>
              Aktion: <Text style={styles.kvVal}>{state.debugLastAction || '—'}</Text>
            </Text>
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
            • Android kann BG-Updates dichter als 60s liefern → Dedupe in Engine (HB_MIN_GAP_SECONDS ~55s).{'\n'}
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
