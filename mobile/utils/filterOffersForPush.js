// stepsmatch/mobile/utils/filterOffersForPush.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOfferActiveNow } from './isOfferActiveNow';

/** Kleine Geo-Utils (dupliziert leichtgewichtig, unabhängig vom Screen) */
const toRad = (deg) => (deg * Math.PI) / 180;
function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
function pickRadiusMeters(offer) {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null;
}

/** Lokales YYYY-MM-DD in Europe/Vienna (für Tages-Cooldown/Idempotenz) */
function ymdLocalVienna(d = new Date(), tz = 'Europe/Vienna') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`; // YYYY-MM-DD
}

/** Einmal-pro-Tag-Keys pro Offer */
function pushedKey(offerId, tz = 'Europe/Vienna', d = new Date()) {
  return `ultreia:push:${offerId}:${ymdLocalVienna(d, tz)}`;
}
export async function hasPushedToday(offerId, tz = 'Europe/Vienna') {
  try { return (await AsyncStorage.getItem(pushedKey(offerId, tz))) === '1'; } catch { return false; }
}
export async function markPushedToday(offerId, tz = 'Europe/Vienna') {
  try { await AsyncStorage.setItem(pushedKey(offerId, tz), '1'); } catch {}
}

/**
 * Filtert Offers für Push:
 * - aktiv JETZT in Europe/Vienna (Datum/Tag/Uhrzeit; auch „nur heute“)
 * - optional: innerhalb Radius und maxDistance
 * - optional: skipAlreadyPushedToday → schließt bereits gepushte (heute) aus
 *
 * @param {Array<object>} offers  Array von Offer-Objekten (oder Rows mit { offer })
 * @param {{latitude:number, longitude:number}} userPos  Benutzerposition (optional, für Distanz)
 * @param {object} opts
 *   - timeZone?: string (Default 'Europe/Vienna')
 *   - requireRadius?: boolean (Default true)  → nur wenn User im Offer-Radius ist
 *   - maxDistanceM?: number (optional)        → zusätzliches Distanzlimit
 *   - skipAlreadyPushedToday?: boolean (Default true)
 *   - unwrapKey?: string (z.B. 'offer')       → wenn Elemente als {offer: {...}} vorliegen
 * @returns {Promise<Array<object>>} gefilterte Offers (selbe Struktur wie Input)
 */
export async function filterOffersForPush(offers, userPos, opts = {}) {
  const {
    timeZone = 'Europe/Vienna',
    requireRadius = true,
    maxDistanceM,
    skipAlreadyPushedToday = true,
    unwrapKey = null,
  } = opts;

  if (!Array.isArray(offers) || offers.length === 0) return [];

  const out = [];
  for (const row of offers) {
    const offer = unwrapKey ? row?.[unwrapKey] : row;
    if (!offer) continue;

    // 1) Gültigkeit jetzt (inkl. „nur heute“)
    if (!isOfferActiveNow(offer, timeZone)) continue;

    // 2) Distanz-/Radius-Regeln (optional)
    if (userPos) {
      const loc = pickOfferLocation(offer);
      if (!loc) continue;

      const radius = pickRadiusMeters(offer);
      const dist = haversineM(userPos, loc);

      if (requireRadius && (!Number.isFinite(radius) || dist > radius)) continue;
      if (Number.isFinite(maxDistanceM) && dist > maxDistanceM) continue;

      // Distanz nützlich für Sortierung später
      row.__distanceM = dist;
    }

    // 3) Idempotenz: heute schon gepusht?
    if (skipAlreadyPushedToday) {
      const pushed = await hasPushedToday(offer._id || offer.id || offer.uuid || '');
      if (pushed) continue;
    }

    out.push(row);
  }

  // Distanz-basiert sortieren, falls vorhanden
  out.sort((a, b) => {
    const da = a.__distanceM ?? Infinity;
    const db = b.__distanceM ?? Infinity;
    return da - db;
  });

  // interne Hilfsmarker entfernen
  for (const r of out) delete r.__distanceM;

  return out;
}
