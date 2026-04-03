// stepsmatch/mobile/components/push/push-notifications.ts
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { isServiceActiveNow } from './service-control';
import {
  BRAND_BLUE,
  CHANNELS,
  CATEGORIES,
  buildOfferBody,
  buildOfferNotificationContent,
  buildGroupSummaryContent,
} from '../push/notifyUI';
import {
  GROUP_COOLDOWN_MS,
  SUMMARY_WINDOW_MS,
  STRONG_PATTERN,
} from './push-constants';
import {
  getGroupState, setGroupState, makeGroupIdFromMeta,
  getOfferPushState, setOfferPushState,
  getGlobalState,
} from './push-state';

/* ────────────────────────────────────────────────────────────
   DEDUPE/THROTTLE (lokal, risikoarm)
──────────────────────────────────────────────────────────── */
const DEDUPE_LOG = true;
const REMOTE_DEDUPE_WINDOW_MS = 20_000;
const LOCAL_EVENT_DEDUP_WINDOW_MS = 5_000;
const OFFER_THROTTLE_MS = 120_000;
const GLOBAL_THROTTLE_MS = 20_000;
const SYNTHETIC_ENTER_COOLDOWN_MS = 15_000;

/** Bevorzugter Android-Kanalname fuer Offers - muss mit Backend-ENV korrespondieren */
const PREFERRED_OFFERS_CHANNEL = 'offers-v2';

/* ────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────── */
function isForeground() {
  try { return AppState.currentState === 'active'; } catch { return false; }
}
function isOfferNotification(c: any) {
  const ch = c?.android?.channelId || c?.channelId;
  const kind = c?.data?.kind;

  // Alle bekannten Offer-Kanaele akzeptieren (alt + neu)
  const knownOfferChannels = new Set<string>(
    [
      PREFERRED_OFFERS_CHANNEL,          // 'offers-v2'
      CHANNELS?.offers,                  // was auch immer hier aktuell konfiguriert ist
      CHANNELS?.offersLegacy,            // Legacy
      'offers',                          // ganz alte Legacy-ID
    ].filter(Boolean) as string[]
  );

  return knownOfferChannels.has(ch) || (typeof kind === 'string' && kind.startsWith('offer'));
}

async function isGlobalThrottled(now: number) {
  try {
    const gs = await getGlobalState();
    const last = Number(gs?.lastAnyPushAt || 0);
    return !!last && (now - last) < GLOBAL_THROTTLE_MS;
  } catch { return false; }
}
async function isOfferThrottled(offerId: string, now: number) {
  try {
    const st: any = await getOfferPushState(offerId);
    const last = Number(st?.lastPushedAt || 0);
    return !!last && (now - last) < OFFER_THROTTLE_MS;
  } catch { return false; }
}

/* ────────────────────────────────────────────────────────────
   Zentrales DEDUPE-GATE
──────────────────────────────────────────────────────────── */
export async function shouldNotify(
  offerId: string,
  source: 'geofence-local' | 'synthetic-enter' | 'heartbeat' | 'remote-shadow' | 'manual',
  now = Date.now(),
): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isServiceActiveNow())) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[service-inactive]', { offerId, source });
    return { ok: false, reason: 'service-inactive' };
  }
  if (await isGlobalThrottled(now)) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[throttle-global]', { offerId, source });
    return { ok: false, reason: 'throttle-global' };
  }
  if (await isOfferThrottled(offerId, now)) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[throttle-offer]', { offerId, source });
    return { ok: false, reason: 'throttle-offer' };
  }

  const st: any = await getOfferPushState(offerId);
  const lastRemoteAt = Number(st?.lastRemoteAt || 0);
  const lastLocalAt  = Number(st?.lastLocalNotifiedAt || 0);
  const lastSyntheticEnterAt = Number(st?.lastSyntheticEnterAt || 0);

  if (lastRemoteAt && (now - lastRemoteAt) < REMOTE_DEDUPE_WINDOW_MS) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[remote-recent]', { offerId, source });
    return { ok: false, reason: 'remote-recent' };
  }
  if (lastLocalAt && (now - lastLocalAt) < LOCAL_EVENT_DEDUP_WINDOW_MS) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[local-recent]', { offerId, source });
    return { ok: false, reason: 'local-recent' };
  }
  if (source === 'synthetic-enter' && lastSyntheticEnterAt && (now - lastSyntheticEnterAt) < SYNTHETIC_ENTER_COOLDOWN_MS) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('DEDUPE[synthetic-skip]', { offerId, source });
    return { ok: false, reason: 'synthetic-skip' };
  }

  return { ok: true };
}

/** interne Guard-Funktion, um alle bisherigen Tippfehler auf DEDUPE_LOG zu harmonisieren */
function DEDUE_LOG_FIX_GUARD() {
  return DEDUPE_LOG === true;
}

/* ────────────────────────────────────────────────────────────
   Globaler Notification-Handler (einmalig)
   ─ Im FG: **GAR KEIN** Banner/Signal (vollstaendige Unterdrueckung)
──────────────────────────────────────────────────────────── */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const c: any = notification?.request?.content || {};
    if (isForeground()) {
      if (isOfferNotification(c)) {
        const data = c?.data || {};
        DeviceEventEmitter.emit('offers:foreground-signal', {
          offerId: typeof data?.offerId === 'string' ? data.offerId : '',
          title: c?.title || 'Neues Angebot in deiner Naehe',
        });
        if (DEDUE_LOG_FIX_GUARD()) console.log('[FG-SUPPRESS] remote offer suppressed in foreground');
      } else if (DEDUE_LOG_FIX_GUARD()) {
        console.log('[FG-SUPPRESS] notification suppressed in foreground');
      }
      // App im Vordergrund: keine System-Notification anzeigen
      return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
    }
    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
  },
});

/* ────────────────────────────────────────────────────────────
   Remote-Push Listener
   ─ merkt lastRemoteAt
   ─ triggert offers:refresh (UI-Reload), auch im FG
──────────────────────────────────────────────────────────── */
try {
  Notifications.addNotificationReceivedListener(async (evt) => {
    const c: any = evt?.request?.content || {};
    const data = c?.data || {};
    const offerId = typeof data?.offerId === 'string' ? data.offerId : null;
    const kind = typeof data?.kind === 'string' ? data.kind : '';

    if (offerId) {
      await setOfferPushState(offerId, { lastRemoteAt: Date.now() });
      if (DEDUE_LOG_FIX_GUARD()) console.log('[remote-push][recorded]', { offerId, kind });
    }

    if (kind === 'offers-refresh') {
      DeviceEventEmitter.emit('offers:refresh'); // EMIT UI REFRESH
      if (DEDUE_LOG_FIX_GUARD()) console.log('[offers:refresh][emit] (remote)');
    }
  });
} catch { /* noop */ }

let CHANNELS_READY_ONCE = false;

export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  if (CHANNELS_READY_ONCE) return;
  try {
    // Default
    await Notifications.setNotificationChannelAsync(CHANNELS.default, {
      name: 'StepsMatch',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 150, 120, 150],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false, showBadge: true,
      description: 'Allgemeine Benachrichtigungen von StepsMatch',
    });

    // Bevorzugter Offer-Kanal 'offers-v2' - MUSS existieren, sonst zeigt Android nichts
    await Notifications.setNotificationChannelAsync(PREFERRED_OFFERS_CHANNEL, {
      name: 'Offers (v2)',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'arrival',
      vibrationPattern: STRONG_PATTERN,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableLights: true,
      lightColor: BRAND_BLUE as any,
      bypassDnd: false, showBadge: true,
      description: 'Sofort-Push bei passenden Angeboten in deiner Naehe (v2)',
    });

    // Zusaetzlich (Abwaertskompat.) den in CHANNELS.offers hinterlegten Kanal anlegen
    if (CHANNELS?.offers && CHANNELS.offers !== PREFERRED_OFFERS_CHANNEL) {
      await Notifications.setNotificationChannelAsync(CHANNELS.offers, {
        name: 'Offers',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'arrival',
        vibrationPattern: STRONG_PATTERN,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
        lightColor: BRAND_BLUE as any,
        bypassDnd: false, showBadge: true,
        description: 'Sofort-Push bei passenden Angeboten in deiner Naehe',
      });
    }

    // Legacy (nur falls im Code noch referenziert)
    if (CHANNELS?.offersLegacy) {
      await Notifications.setNotificationChannelAsync(CHANNELS.offersLegacy, {
        name: 'Offers (legacy)',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 150, 120, 150],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        description: 'Vorheriger Offer-Kanal (Kompatibilitaet)',
      });
    }

    // Kategorie (Actions)
    await Notifications.setNotificationCategoryAsync(CATEGORIES.offerGo, [
      { identifier: 'go',     buttonTitle: 'Route',  options: { opensAppToForeground: true } },
      { identifier: 'later',  buttonTitle: 'Spaeter', options: { isDestructive: false } },
      { identifier: 'no',     buttonTitle: 'Kein Interesse', options: { isDestructive: true } },
    ]);

    // BG-Service Kanal
    await Notifications.setNotificationChannelAsync(CHANNELS.bg, {
      name: 'StepsMatch - Standort aktiv',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      bypassDnd: false, showBadge: false,
      description: 'Hintergrunddienst zur Standortaktualisierung',
    });

    CHANNELS_READY_ONCE = true;
    console.log('[push] channels & category ready');
  } catch (e: any) {
    console.warn('[notif] ensureChannels failed:', e?.message || e);
  }
}

async function maybeSendGroupSummary({ groupId, providerName, count }: {
  groupId: string, providerName?: string, count: number
}) {
  try {
    const { content, trigger } = buildGroupSummaryContent({ groupId, providerName, count });
    await Notifications.scheduleNotificationAsync({ content, trigger });
  } catch {}
}

/* ────────────────────────────────────────────────────────────
   Lokale Offer-Notification
   ─ Im FG: **komplette Unterdrueckung** (nur State markieren)
   ─ Im BG: normal schedulen
──────────────────────────────────────────────────────────── */
export async function presentLocalOfferNotification(
  offerId: string,
  meta: any,
  source: 'geofence-local' | 'synthetic-enter' | 'heartbeat' = 'geofence-local',
  distanceBadge: string | null = null
) {
  const now = Date.now();

  // Gate trotzdem pruefen (nuetzlich fuer BG & Doppelvermeidung)
  const gate = await shouldNotify(offerId, source, now);
  if (!gate.ok) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('[DEDUPE] presentLocalOfferNotification skip', offerId, source, gate.reason);
    return;
  }

  // ── FG: komplett unterdrücken ─────────────────────────────
  if (isForeground()) {
    if (DEDUE_LOG_FIX_GUARD()) console.log('[FG-SUPPRESS] local offer suppressed in foreground', { offerId, source });
    await setOfferPushState(offerId, {
      lastLocalNotifiedAt: now,
      ...(source === 'synthetic-enter' ? { lastSyntheticEnterAt: now } : null),
    });
    DeviceEventEmitter.emit('offers:foreground-signal', {
      offerId,
      title: meta?.title || 'Neues Angebot in deiner Naehe',
    });
    return;
  }

  // ── BG: regulaere OS-Notification ──────────────────────────
  // (Details fetchen - wie gehabt)
  let providerName = meta?.providerName || '';
  let offerTitle   = meta?.title || 'Angebot';
  let address      = '';
  try {
    const res = await fetch(`https://lobster-app-ie9a5.ondigitalocean.app/api/offers/${offerId}?withProvider=1`, { method: 'GET' });
    if (res.ok) {
      const offer = await res.json();
      providerName = offer?.provider?.name || providerName || '';
      offerTitle   = offer?.title || offer?.name || offerTitle;
      address      =
        offer?.provider?.address?.formatted ||
        [offer?.provider?.address?.street, offer?.provider?.address?.city].filter(Boolean).join(', ') ||
        offer?.provider?.address || '';
    }
  } catch {}

  const body = buildOfferBody({
    offerTitle,
    distanceBadge: distanceBadge || null,
    validityBadge: 'noch gueltig',
    providerName,
    address,
  });

  const groupId = makeGroupIdFromMeta(meta);
  const gs  = await getGroupState(groupId);
  const underCooldown = gs.lastPushedAt && (now - gs.lastPushedAt) < GROUP_COOLDOWN_MS;

  const pruned = (gs.events || []).filter((t: number) => (now - t) <= SUMMARY_WINDOW_MS);
  pruned.push(now);

  const { content, trigger } = buildOfferNotificationContent({
    offerId, source, body, groupId,
  });

  // WICHTIG: fuer Android sicherstellen, dass der bevorzugte Kanal genutzt wird
  if (Platform.OS === 'android') {
    (content as any).android = { ...(content as any).android, channelId: PREFERRED_OFFERS_CHANNEL };
  }

  await Notifications.scheduleNotificationAsync({ content, trigger });

  await setOfferPushState(offerId, {
    lastLocalNotifiedAt: now,
    ...(source === 'synthetic-enter' ? { lastSyntheticEnterAt: now } : null),
  });
  await setGroupState(groupId, { lastPushedAt: now, events: pruned });

  const shouldSummarize =
    (pruned.length >= 2) ||
    (underCooldown && (!gs.lastSummaryAt || (now - gs.lastSummaryAt) > SUMMARY_WINDOW_MS));

  if (shouldSummarize) {
    await maybeSendGroupSummary({ groupId, providerName, count: pruned.length });
    await setGroupState(groupId, { lastPushedAt: now, lastSummaryAt: now, events: pruned });
  }
}


