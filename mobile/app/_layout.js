// stepsmatch/mobile/app/_layout.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import ThemeProvider from '../theme/ThemeProvider';

// Startet Foreground-Location-Service, Geofencing, Channels (ohne Popups)
import PushInitializer, {
  ensureBgAfterOnboarding,
  getBgStatus,
} from '../components/PushInitializer';

// Geführtes Onboarding (Notifs → FG/BG-Location)
import PermissionGate from '../components/PermissionGate';
import { clearStopUntilRestart } from '../components/push/service-control';

const API_BASE =
  (Constants?.expoConfig?.extra?.apiBase || Constants?.manifest?.extra?.apiBase) ??
  'https://api.ultreia.app/api';

async function postNotifAction(action, data = {}, minutes) {
  try {
    const offerId = data?.offerId || data?.id || data?.offer || null;
    if (!offerId) return;
    const deviceId = data?.deviceId || null;
    const tokenId = data?.tokenId || null;
    if (!deviceId && !tokenId) return;
    await fetch(`${API_BASE}/notifications/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        offerId,
        deviceId,
        tokenId,
        minutes: minutes || undefined,
      }),
    });
  } catch {}
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const gateCompletedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState || 'active');
  const router = useRouter();

  // Falls App mit bereits erteilten Rechten startet, Gate überspringen
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await clearStopUntilRestart();
        const s = await getBgStatus();
        if (!mounted) return;
        if (s?.locPerms && s?.notifPerms) {
          try { await ensureBgAfterOnboarding(); } catch {}
          setAppReady(true);
        }
      } catch {
        // Gate übernimmt dann
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Notifications: Listener für Empfang + Interaktion
  useEffect(() => {
    const subRecv = Notifications.addNotificationReceivedListener((notif) => {
      try {
        const data = notif?.request?.content?.data || {};
        console.log('[notif] received', { id: notif?.request?.identifier, data });
      } catch {}
    });

    const subResp = Notifications.addNotificationResponseReceivedListener((resp) => {
      try {
        const action = resp?.actionIdentifier;
        const data = resp?.notification?.request?.content?.data || {};
        const offerId = data?.offerId || data?.id || data?.offer || null;
        console.log('[notif] response', { action, data });

        // Standardaktion oder "GO" → App in den Vordergrund + optional Navigation
        if (action === Notifications.DEFAULT_ACTION_IDENTIFIER || action === 'go') {
          postNotifAction('go', data);
          if (offerId) {
            try { router.push({ pathname: '/(tabs)/offers/[id]', params: { id: String(offerId) } }); }
            catch { router.push('/(tabs)/diagnostics'); }
          } else {
            router.push('/(tabs)/diagnostics');
          }
        } else if (action === 'later') {
          postNotifAction('later', data);
        } else if (action === 'no') {
          postNotifAction('no', data);
        }
      } catch (e) {
        console.log('[notif] response handler error', String(e?.message || e));
      }
    });

    return () => {
      try { subRecv?.remove?.(); } catch {}
      try { subResp?.remove?.(); } catch {}
    };
  }, [router]);

  // AppState → bei Rückkehr in den Vordergrund leise BG sicherstellen
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      appStateRef.current = next;
      if (next === 'active' && appReady) {
        try { await Notifications.dismissAllNotificationsAsync(); } catch {}
        try { await Notifications.setBadgeCountAsync(0); } catch {}
        try { await ensureBgAfterOnboarding(); } catch {}
      }
    });
    return () => sub?.remove?.();
  }, [appReady]);

  const handleGateDone = useCallback(async () => {
    if (gateCompletedRef.current) return; // Doppelklick-Schutz
    gateCompletedRef.current = true;

    try {
      // Startet BG-Location + Geofences + Token-Register OHNE Dialoge
      await ensureBgAfterOnboarding();
    } catch {
      // Logs kommen aus PushInitializer
    } finally {
      setAppReady(true);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {appReady ? (
            <>
              {/* Initialisierung erst NACH erfüllten Voraussetzungen */}
              <PushInitializer />
              <Slot />
              <StatusBar style="auto" />
            </>
          ) : (
            // Geführter Onboarding-Flow (2-stufig: Notifs → FG/BG-Location)
            <PermissionGate onDone={handleGateDone} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


