// stepsmatch/mobile/components/PermissionGate.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { kickstartBackgroundLocation, headlessBootstrap } from './PushInitializer';

// ────────────────────────────────────────────────────────────
// Constants / Storage Keys
// ────────────────────────────────────────────────────────────
const BRAND = '#0d4ea6';
const ANDROID = Platform.OS === 'android';
const ANDROID_PACKAGE =
  ((Constants as any)?.expoConfig?.android?.package as string) || 'com.ecily.mobile';

const BATTERY_CONFIRM_KEY = 'batteryOptOut.confirmed';
const BATTERY_CONFIRM_AT_KEY = 'batteryOptOut.confirmedAt';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
type GateState = {
  notifs: 'unknown' | 'granted' | 'denied';
  fgLoc: 'unknown' | 'granted' | 'denied';
  bgLoc: 'unknown' | 'granted' | 'denied' | 'n/a';
  batteryConfirmed: boolean;
};

async function readBatteryConfirm(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(BATTERY_CONFIRM_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

async function writeBatteryConfirm(v: boolean) {
  try {
    await AsyncStorage.setItem(BATTERY_CONFIRM_KEY, v ? 'true' : 'false');
    await AsyncStorage.setItem(BATTERY_CONFIRM_AT_KEY, String(Date.now()));
  } catch {}
}

async function getNotifStatus(): Promise<'granted' | 'denied'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    const status = p?.granted ? 'granted' : 'denied';
    console.log('[notif] status', status);
    return status;
  } catch {
    return 'denied';
  }
}

async function getLocStatuses(): Promise<{ fg: 'granted' | 'denied'; bg: 'granted' | 'denied' | 'n/a' }> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    const fgOk = fg?.status === 'granted';
    // iOS: BG separat nicht nötig – führen als n/a
    const bgOk = ANDROID ? bg?.status === 'granted' : true;
    return { fg: fgOk ? 'granted' : 'denied', bg: ANDROID ? (bgOk ? 'granted' : 'denied') : 'n/a' };
  } catch {
    return { fg: 'denied', bg: ANDROID ? 'denied' : 'n/a' };
  }
}

async function openBatterySettings() {
  if (!ANDROID) return;
  try {
    const ACTION_REQ =
      (IntentLauncher as any).ActivityAction?.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS ??
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
    await IntentLauncher.startActivityAsync(ACTION_REQ, { data: `package:${ANDROID_PACKAGE}` });
  } catch {
    try {
      const ACTION_LIST =
        (IntentLauncher as any).ActivityAction?.IGNORE_BATTERY_OPTIMIZATION_SETTINGS ??
        'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';
      await IntentLauncher.startActivityAsync(ACTION_LIST);
    } catch (e) {
      console.log('[gate] battery intent failed', String((e as any)?.message ?? e));
    }
  }
}

async function openAppNotificationSettings() {
  try {
    if (!ANDROID) {
      await Linking.openSettings();
      return;
    }
    const ACTION =
      (IntentLauncher as any).ActivityAction?.APP_NOTIFICATION_SETTINGS ??
      'android.settings.APP_NOTIFICATION_SETTINGS';
    await IntentLauncher.startActivityAsync(ACTION, {
      data: undefined,
      flags: 0,
      extra: {
        'android.provider.extra.APP_PACKAGE': ANDROID_PACKAGE,
        'app_package': ANDROID_PACKAGE,
        'app_uid': 0,
      },
    });
  } catch (e) {
    console.log('[gate] notif settings intent failed', String((e as any)?.message ?? e));
    Linking.openSettings().catch(() => {});
  }
}

// ────────────────────────────────────────────────────────────
type Props = {
  onDone?: () => void;                 // legacy alias
  onReady?: () => void;                // wird gerufen, wenn alles ok
  requireBackgroundLocation?: boolean; // default: true (iOS ignoriert)
  children?: React.ReactNode;          // darunterliegendes UI
  overlay?: boolean;                   // default: true → Gate als Overlay statt Vollseite
};

export default function PermissionGate({
  onDone,
  onReady,
  requireBackgroundLocation = true,
  children,
  overlay = true,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<GateState>({
    notifs: 'unknown',
    fgLoc: 'unknown',
    bgLoc: ANDROID ? 'unknown' : 'n/a',
    batteryConfirmed: false,
  });

  const bgRequired = ANDROID && requireBackgroundLocation;
  const allOk = useMemo(() => {
    const notifOk = state.notifs === 'granted';
    const fgOk = state.fgLoc === 'granted';
    const bgOk = bgRequired ? state.bgLoc === 'granted' : true;
    const batteryOk = ANDROID ? state.batteryConfirmed : true;
    return notifOk && fgOk && bgOk && batteryOk;
  }, [state, bgRequired]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [notifStatus, loc] = await Promise.all([getNotifStatus(), getLocStatuses()]);
      const battery = ANDROID ? await readBatteryConfirm() : true;
      setState({
        notifs: notifStatus,
        fgLoc: loc.fg,
        bgLoc: loc.bg,
        batteryConfirmed: !!battery,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const startedRef = useRef(false);
  useEffect(() => {
    // Sobald alles erfüllt ist: einmalig Headless-Boot + BG-Location starten
    if (allOk && !startedRef.current) {
      startedRef.current = true;
      (async () => {
        try {
          console.log('[gate] all prerequisites ok → boot + start BG');
          await headlessBootstrap();           // Channels + Token + Register
          await kickstartBackgroundLocation(); // BG-Location anwerfen
          onReady?.();
          onDone?.(); // legacy
        } catch (e) {
          console.log('[gate] start error', String((e as any)?.message ?? e));
        }
      })();
    }
  }, [allOk, onReady, onDone]);

  // Actions
  const askNotifs = useCallback(async () => {
    setBusy(true);
    try {
      const res = await Notifications.requestPermissionsAsync();
      console.log('[notif] request ->', res?.granted);
      await refresh();
      if (!res?.granted) await openAppNotificationSettings();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const askFgLocation = useCallback(async () => {
    setBusy(true);
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      console.log('[gate] fg location ->', r?.status);
      await refresh();
      if (r?.status !== 'granted') {
        // öffne Systemeinstellungen als Hilfe
        await Linking.openSettings().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const askBgLocation = useCallback(async () => {
    if (!bgRequired) return;
    setBusy(true);
    try {
      const r = await Location.requestBackgroundPermissionsAsync();
      console.log('[gate] bg location ->', r?.status);
      await refresh();
      if (r?.status !== 'granted') {
        await Linking.openSettings().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }, [refresh, bgRequired]);

  const markBatteryConfirmed = useCallback(async () => {
    await writeBatteryConfirm(true);
    await refresh();
  }, [refresh]);

  // ---------- UI ----------
  const GateContent = (
    <View style={[overlay ? styles.overlayCard : styles.pageCard, state.notifs === 'granted' && styles.pageCardTight]}>
      <Text style={styles.title}>Ersteinrichtung</Text>
      <Text style={styles.subtitle}>
        Damit Ultreia zuverlässig im Hintergrund arbeitet, führe bitte diese Schritte aus:
      </Text>

      {/* Schritt 1: Benachrichtigungen */}
      <Step
        index={1}
        title="Benachrichtigungen erlauben"
        ok={state.notifs === 'granted'}
        actionLabel={state.notifs === 'granted' ? 'Erledigt' : 'Erlauben'}
        onAction={state.notifs === 'granted' ? undefined : askNotifs}
        extra={
          state.notifs !== 'granted' ? (
            <Pressable onPress={openAppNotificationSettings} style={styles.linkBtn}>
              <Text style={styles.link}>Benachrichtigungseinstellungen öffnen</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Schritt 2: Standort (Vordergrund) */}
      <Step
        index={2}
        title="Standort (Vordergrund) erlauben"
        ok={state.fgLoc === 'granted'}
        actionLabel={state.fgLoc === 'granted' ? 'Erledigt' : 'Erlauben'}
        onAction={state.fgLoc === 'granted' ? undefined : askFgLocation}
      />

      {/* Schritt 3: Standort (Hintergrund) – optional */}
      {bgRequired && (
        <Step
          index={3}
          title="Standort (Hintergrund) erlauben"
          ok={state.bgLoc === 'granted'}
          actionLabel={state.bgLoc === 'granted' ? 'Erledigt' : 'Erlauben'}
          onAction={state.bgLoc === 'granted' ? undefined : askBgLocation}
          hint="Wähle „Immer erlauben“, damit Enter-Pushes im Hintergrund funktionieren."
        />
      )}

      {/* Schritt 4: Akku-Optimierung – Android */}
      {ANDROID && (
        <Step
          index={bgRequired ? 4 : 3}
          title="Akku-Optimierung für Ultreia ausschalten"
          ok={state.batteryConfirmed}
          actionLabel="Zu den Akku-Einstellungen"
          onAction={openBatterySettings}
          hint="Bitte Ultreia von Akku-Optimierungen ausnehmen (Doze). Danach unten Bestätigen tippen."
          extra={
            <Pressable onPress={markBatteryConfirmed} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnLabel}>Ich habe es ausgeschaltet ✓</Text>
            </Pressable>
          }
        />
      )}

      <View style={styles.footer}>
        <Pressable onPress={refresh} style={styles.refreshBtn} disabled={busy}>
          {busy ? <ActivityIndicator /> : <Text style={styles.refreshLabel}>Status neu prüfen</Text>}
        </Pressable>
        {allOk ? (
          <Text style={styles.allSet}>Alles bereit ✅ – Hintergrunddienst wird gestartet…</Text>
        ) : (
          <Text style={styles.pending}>Noch nicht alles erledigt</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Unterliegendes UI (optional) */}
      {children}

      {/* Overlay nur, wenn nicht alles ok */}
      {!allOk && (
        overlay ? (
          <View style={styles.overlay}>{GateContent}</View>
        ) : (
          <View style={{ padding: 16 }}>{GateContent}</View>
        )
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// UI Bits
// ────────────────────────────────────────────────────────────
function Step({
  index,
  title,
  ok,
  actionLabel,
  onAction,
  hint,
  extra,
}: {
  index: number;
  title: string;
  ok: boolean;
  actionLabel: string;
  onAction?: () => void;
  hint?: string;
  extra?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, ok && styles.cardOk]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeTodo]}>
          <Text style={styles.badgeText}>{ok ? '✓' : index}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.actions}>
        {onAction ? (
          <Pressable onPress={onAction} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnLabel}>{actionLabel}</Text>
          </Pressable>
        ) : (
          <Text style={styles.doneLabel}>Erledigt</Text>
        )}
        {extra}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Overlay-Hintergrund
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,23,0.85)',
    justifyContent: 'center',
    padding: 18,
  },
  // Card im Overlay
  overlayCard: {
    backgroundColor: '#101827',
    borderColor: '#13203a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  // Vollseitenmodus (wenn overlay={false})
  pageCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  pageCardTight: { paddingTop: 8 },

  title: { fontSize: 22, fontWeight: '700', color: overlayColor('#111', '#fff') },
  subtitle: { fontSize: 14, color: overlayColor('#444', '#c9d1d9'), marginBottom: 8 },

  card: {
    borderWidth: 1,
    borderColor: overlayColor('#e5e7eb', '#1f2a44'),
    borderRadius: 12,
    padding: 12,
    backgroundColor: overlayColor('#fafafa', '#0e1421'),
  },
  cardOk: { backgroundColor: overlayColor('#f0fff4', '#0f1f15'), borderColor: overlayColor('#bbf7d0', '#1f7040') },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  badgeOk: { backgroundColor: overlayColor('#dcfce7', '#11391d'), borderColor: overlayColor('#22c55e', '#1f7040') },
  badgeTodo: { backgroundColor: overlayColor('#eef2ff', '#13203a'), borderColor: overlayColor('#93c5fd', '#2b4a7a') },
  badgeText: { fontWeight: '700', color: overlayColor('#111', '#e4ecf7') },
  cardTitle: { fontSize: 16, fontWeight: '600', color: overlayColor('#111', '#e4ecf7') },
  hint: { marginTop: 6, fontSize: 12, color: overlayColor('#555', '#93a4bd') },
  actions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  primaryBtn: {
    backgroundColor: BRAND, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
  },
  primaryBtnLabel: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: overlayColor('#f3f4f6', '#1b2433'),
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    borderColor: overlayColor('#e5e7eb', '#1f2a44'),
  },
  secondaryBtnLabel: { color: overlayColor('#111', '#e4ecf7'), fontWeight: '600' },
  linkBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  link: { color: BRAND, textDecorationLine: 'underline', fontSize: 12, fontWeight: '600' },
  doneLabel: { color: '#16a34a', fontWeight: '700' },
  footer: { marginTop: 8, alignItems: 'flex-start', gap: 8 },
  refreshBtn: {
    borderRadius: 10, borderWidth: 1, borderColor: overlayColor('#e5e7eb', '#1f2a44'),
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: overlayColor('#f9fafb', '#0e1421'),
  },
  refreshLabel: { color: overlayColor('#111', '#e4ecf7'), fontWeight: '600' },
  allSet: { color: '#16a34a', fontWeight: '700' },
  pending: { color: '#a16207', fontWeight: '600' },
});

// kleine Helper-Funktion für helle/dunkle Farben je nach Modus
function overlayColor(light: string, dark: string) {
  // Wir erkennen "Overlay" grob an der dunklen Card-Farbe im StyleSheet – hier einfach dark zurückgeben.
  // (Design-Hack, damit wir nicht per Context propagieren müssen)
  return dark;
}
