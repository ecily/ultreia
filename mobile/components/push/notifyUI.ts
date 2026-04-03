// stepsmatch/mobile/components/push/notifyUI.ts
/**
 * Zweck:
 * - Zentrale, wiederverwendbare Builder fuer Notification-UI (Titel, Body, Actions, Channel).
 * - Keine Seiteneffekte, keine Imports aus expo-*; reine Objekterzeugung.
 * - Wird im naechsten Schritt in PushInitializer.tsx verwendet.
 */

export const BRAND_BLUE = '#0d4ea6' as const;

export const CHANNELS = {
  offers: 'offers-v2',
  offersLegacy: 'offers',
  default: 'stepsmatch-default-v2',
  bg: 'com.ecily.mobile:stepsmatch-bg-location-task',
} as const;

export const CATEGORIES = {
  offerGo: 'offer-go-v2',
} as const;

type SourceTag = 'geofence-local' | 'synthetic-enter' | 'heartbeat';

export interface OfferMeta {
  title?: string;
  providerName?: string;
  providerId?: string;
  radius?: number;
  address?: string;
}

/**
 * Baut den mehrzeiligen Body im StepsMatch-Stil.
 * Format (max. 3 Zeilen):
 *   1) {offerTitle}
 *   2) • Entfernung: {distanceBadge}   • gueltig: {validityBadge}
 *   3) {providerName} - {address}
 *
 * Uebergib nur bereits ermittelte Strings (keine IO in dieser Funktion).
 */
export function buildOfferBody({
  offerTitle,
  distanceBadge,
  validityBadge = 'noch gueltig',
  providerName,
  address,
}: {
  offerTitle: string;
  distanceBadge?: string | null;
  validityBadge?: string;
  providerName?: string;
  address?: string;
}) {
  const lines: string[] = [];

  if (offerTitle) lines.push(offerTitle);

  const metaParts: string[] = [];
  if (distanceBadge) metaParts.push(`• Entfernung: ${distanceBadge}`);
  if (validityBadge) metaParts.push(`• gueltig: ${validityBadge}`);

  const metaLine = metaParts.join('   ');
  if (metaLine) lines.push(metaLine);

  const providerLine = [providerName, address].filter(Boolean).join(' - ');
  if (providerLine) lines.push(providerLine);

  return lines.join('\n');
}

/**
 * Erzeugt das Content-Objekt fuer Notifications.scheduleNotificationAsync.
 * Rein UI/Branding. Route/offerId werden in data abgelegt.
 *
 * Default-Titel: "Angebot in deiner Naehe"
 * channelId: 'offers-v2'
 * categoryIdentifier: 'offer-go-v2'
 * Farbe: #0d4ea6
 */
export function buildOfferNotificationContent({
  offerId,
  source,
  title = 'Angebot in deiner Naehe',
  body,
  groupId,
  route = `/offers/${offerId}`,
  extraData,
}: {
  offerId: string;
  source: SourceTag;
  title?: string;
  body: string;
  groupId: string;
  route?: string;
  extraData?: Record<string, any>;
}) {
  const now = Date.now();

  return {
    content: {
      title,
      body,
      data: {
        offerId,
        source,
        t: now,
        route,
        ...(extraData || {}),
      },
      sound: true,
      categoryIdentifier: CATEGORIES.offerGo,
      android: {
        channelId: CHANNELS.offers,
        color: BRAND_BLUE,
        link: `mobile://offers/${offerId}`,
        groupId,
        groupSummary: false,
      },
    },
    trigger: null as const,
  };
}

/**
 * Gruppenzusammenfassung (Anti-Spam).
 * Titel:
 *   - wenn providerName:  "{providerName}: {count} Angebote in deiner Naehe"
 *   - sonst:              "StepsMatch - {count} Angebote in deiner Naehe"
 *
 * Body: "Tippe, um alle zu sehen."
 */
export function buildGroupSummaryContent({
  groupId,
  providerName,
  count,
}: {
  groupId: string;
  providerName?: string;
  count: number;
}) {
  const title = providerName
    ? `${providerName}: ${count} Angebote in deiner Naehe`
    : `StepsMatch - ${count} Angebote in deiner Naehe`;

  return {
    content: {
      title,
      body: 'Tippe, um alle zu sehen.',
      data: { kind: 'group-summary', groupId, count, t: Date.now() },
      sound: true,
      android: {
        channelId: CHANNELS.offers,
        color: BRAND_BLUE,
        link: `mobile://offers?group=${encodeURIComponent(groupId)}`,
        groupId,
        groupSummary: true,
      },
    },
    trigger: null as const,
  };
}
