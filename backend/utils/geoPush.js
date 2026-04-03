// stepsmatch/backend/utils/geoPush.js
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from './push.js'; // robust mit Receipts/Retry/Disable
import { isOfferActiveNow } from './isOfferActiveNow.js';

/* ────────────────────────────────────────────────────────────
   ENV / Defaults
   ──────────────────────────────────────────────────────────── */
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// ⚠️ Wichtig: Standard-Kanal jetzt 'offers-v2' und Expo-kompatible ENV bevorzugen
const PUSH_CHANNEL_ID =
  process.env.EXPO_PUSH_CHANNEL_ID ||  // primär: neue ENV, z. B. EXPO_PUSH_CHANNEL_ID=offers-v2
  process.env.PUSH_CHANNEL_ID ||       // fallback: alte ENV
  'offers-v2';                         // letzte Instanz: harter Default passend zur App

const PUSH_PRIORITY   = process.env.PUSH_PRIORITY   || 'high';
const PUSH_SOUND      = process.env.PUSH_SOUND      || 'default';

// Standort-Freshness (Standard 10 Min)
const LAST_LOCATION_MAX_AGE_MS = Number(process.env.PUSH_LAST_LOCATION_MAX_AGE_MS || 10 * 60_000);

// ➕ globale/individuelle Accuracy-Puffer (analog zum Poller)
const ACCURACY_BUFFER_MAX = Number(process.env.PUSH_ACCURACY_BUFFER_MAX ?? 15); // m
const ACCURACY_TOKEN_CAP  = Number(process.env.PUSH_ACCURACY_TOKEN_CAP  ?? 60); // m
const SEARCH_BUFFER       = Math.max(ACCURACY_BUFFER_MAX, ACCURACY_TOKEN_CAP);

// 🔁 Server-Formel angleichen an Mobile: +5 m Grundpuffer bei ENTER
// (bewusst hart kodiert für Konsistenz mit Client)
const ENTER_SANITY_BUFFER_M = 5;

// Re-Notify nach Offer-Update erlauben? (Default: ON)
const OFFER_NOTIFY_RESET_ON_UPDATE = !['0', 'false', 'off'].includes(
  String(process.env.OFFER_NOTIFY_RESET_ON_UPDATE ?? '1').toLowerCase()
);

// Verbose Diagnose-Logs (Default: ON). Setze GEOPUSH_DEBUG=0 zum Abschalten.
const GEOPUSH_DEBUG = String(process.env.GEOPUSH_DEBUG ?? '1') !== '0';

// Fresh-Token-Retry: Delays
const FRESH_RETRY_DELAYS_MS = (process.env.FRESH_RETRY_DELAYS_MS || '90000,300000')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => Number.isFinite(n) && n > 0);

// Suppression/Cooldown (Default: 2h – synchron zu OfferVisibility)
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}
const RENOTIFY_COOLDOWN_MS = envMs('GEOFENCE_RENOTIFY_COOLDOWN_MS', 2 * 60 * 60 * 1000);

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
function toRad(d) { return (d * Math.PI) / 180; }
function haversineMeters(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeInterests(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').toLowerCase().normalize('NFKD').trim())
    .filter(Boolean);
}
function interestsMatch(offer, token) {
  const req = normalizeInterests(offer?.interestsRequired);
  if (req.length === 0) return true; // kein Filter
  const have = new Set(normalizeInterests(token?.interests));
  if (have.size === 0) return false;
  return req.some((r) => have.has(r));
}

// sichere, gekürzte Stringify für Logs
function sjson(obj, max = 400) {
  try {
    const str = JSON.stringify(obj);
    return str.length > max ? str.slice(0, max) + '…' : str;
  } catch {
    return '[unserializable]';
  }
}

function logDiag(offer, phase, detail = {}) {
  if (!GEOPUSH_DEBUG) return;
  const base = {
    phase,
    offerId: String(offer?._id || ''),
    radius: Number(offer?.radius ?? offer?.radiusMeters ?? 0),
  };
  // Einzeilige, klar lesbare Debug-Zeile
  console.log(`[geoPush.diag] ${phase} ${sjson({ ...base, ...detail }, 1200)}`);
}

/* ────────────────────────────────────────────────────────────
   Retry-Helper für DeviceNotRegistered bei frischen Tokens
   ──────────────────────────────────────────────────────────── */
async function scheduleFreshTokenRetries({ offer, tokens, now }) {
  try {
    if (!Array.isArray(FRESH_RETRY_DELAYS_MS) || FRESH_RETRY_DELAYS_MS.length === 0) return;
    if (!tokens?.length) return;

    for (const delayMs of FRESH_RETRY_DELAYS_MS) {
      setTimeout(async () => {
        try {
          const stillActive = isOfferActiveNow(offer, 'Europe/Vienna', new Date());
          if (!stillActive) {
            console.log('[geoPush.retry] offer no longer active -> skip', String(offer?._id || ''));
            return;
          }

          const sentDocs = await PushToken.find({ token: { $in: tokens } }, { _id: 1, token: 1 }).lean();
          const ids = sentDocs.map(d => d._id);
          if (!ids.length) return;

          const vis = await OfferVisibility.find({
            offerId: offer._id,
            deviceToken: { $in: ids },
            $or: [
              { status: 'snoozed', remindAt: { $gt: new Date() } },
              { status: 'dismissed' },
              { status: 'notified', lastNotifiedAt: { $gte: new Date(offer?.updatedAt || offer?.createdAt || 0) } },
              { suppressUntil: { $gt: new Date() } },
            ],
          }).select('deviceToken').lean();

          const already = new Set(vis.map(v => String(v.deviceToken)));
          const retryTokens = sentDocs
            .filter(d => !already.has(String(d._id)))
            .map(d => d.token);

          if (!retryTokens.length) {
            console.log('[geoPush.retry] nothing to retry (dedup cleared)', String(offer?._id || ''));
            return;
          }

          console.log('[geoPush.retry] sending', retryTokens.length, 'tokens after', delayMs, 'ms', String(offer?._id || ''));

          const diagRetry = await sendPushAndCheckReceipts({
            tokens: retryTokens,
            title: offer.name || 'Angebot in deiner Nähe',
            body: 'Tippe, um Details zu sehen.',
            data: {
              type: 'offer',
              offerId: String(offer._id),
              route: `/offers/${offer._id}`,
              source: 'offer-update-retry',
            },
            channelId: PUSH_CHANNEL_ID,
      categoryId: process.env.PUSH_CATEGORY_ID || 'offer-go-v2',
            priority: PUSH_PRIORITY,
            sound: PUSH_SOUND,
            delayMs: 1500,
          });

          const tickets = Array.isArray(diagRetry?.sent?.tickets) ? diagRetry.sent.tickets : [];
          const idToToken = diagRetry?.sent?.idToToken || {};
          const okTokens = [];
          for (const t of tickets) {
            if (t?.status === 'ok' && t?.id && idToToken[t.id]) okTokens.push(idToToken[t.id]);
          }
          if (okTokens.length) {
            const okDocs = await PushToken.find({ token: { $in: okTokens } }, { _id: 1, token: 1 }).lean();
            const nowOk = new Date();
            const suppressUntil = RENOTIFY_COOLDOWN_MS > 0 ? new Date(nowOk.getTime() + RENOTIFY_COOLDOWN_MS) : null;
            const bulk = okDocs.map((d) => ({
              updateOne: {
                filter: { offerId: offer._id, deviceToken: d._id },
                update: {
                  $setOnInsert: { offerId: offer._id, deviceToken: d._id, firstSeenAt: nowOk },
                  $set: {
                    status: 'notified',
                    remindAt: null,
                    lastNotifiedAt: nowOk,
                    updatedAt: nowOk,
                    ...(suppressUntil ? { suppressUntil } : { suppressUntil: null }),
                  },
                },
                upsert: true,
              },
            }));
            if (bulk.length) await OfferVisibility.bulkWrite(bulk);
          }

          if (Array.isArray(diagRetry?.disabledTokens) && diagRetry.disabledTokens.length > 0) {
            await PushToken.updateMany({ token: { $in: diagRetry.disabledTokens } }, { $set: { disabled: true } });
          }

          const summary = diagRetry?.receipts?.summary || {};
          console.log(
            `[geoPush.retry] offer=${offer._id} after=${delayMs}ms tried=${retryTokens.length} ` +
            `ok=${okTokens.length} receipts=${JSON.stringify(summary)}`
          );
        } catch (err) {
          console.error('[geoPush.retry] error:', err?.message || err);
        }
      }, delayMs);
    }
  } catch (e) {
    console.error('[geoPush.retry] schedule error:', e?.message || e);
  }
}

/* ────────────────────────────────────────────────────────────
   Sofort-Push an Tokens in Radius (mit Freshness, Accuracy-Puffer,
   OfferVisibility-Dedupe und robusten Expo-Receipts).
   ──────────────────────────────────────────────────────────── */
export async function sendPushToNearbyTokensForOffer(offer, { now = new Date() } = {}) {
  try {
    // 0) Sanity
    const coords = offer?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      logDiag(offer, 'early-exit', { reason: 'offer-has-no-geo' });
      return { ok: false, reason: 'offer-has-no-geo' };
    }
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      logDiag(offer, 'early-exit', { reason: 'offer-geo-invalid', coords });
      return { ok: false, reason: 'offer-geo-invalid' };
    }
    const baseRadiusM = Number(offer.radius ?? offer.radiusMeters ?? 0);
    if (!(baseRadiusM > 0)) {
      logDiag(offer, 'early-exit', { reason: 'offer-has-no-radius' });
      return { ok: false, reason: 'offer-has-no-radius' };
    }

    const active = isOfferActiveNow(offer, 'Europe/Vienna', now);
    if (!active) {
      logDiag(offer, 'early-exit', { reason: 'offer-not-active', now: now.toISOString() });
      return { ok: false, reason: 'offer-not-active' };
    }

    // 1) Frische Tokens
    const freshSince = new Date(now.getTime() - LAST_LOCATION_MAX_AGE_MS);
    const tokenQuery = {
      disabled: { $ne: true },
      'lastLocation.coordinates.0': { $exists: true },
      $or: [
        { lastHeartbeatAt: { $gte: freshSince } },
        { lastSeenAt:      { $gte: freshSince } },
        { updatedAt:       { $gte: freshSince } },
      ],
    };
    if (PROJECT_ID) tokenQuery.projectId = PROJECT_ID;

    const freshTokens = await PushToken.find(tokenQuery)
      .select('_id token platform interests lastLocation projectId deviceId lastLocationAccuracy lastHeartbeatAt updatedAt')
      .lean();

    logDiag(offer, 'fresh-tokens', {
      freshCount: freshTokens.length,
      projectScoped: Boolean(PROJECT_ID),
      freshSince: freshSince.toISOString(),
      searchBuffer: SEARCH_BUFFER,
      accCap: ACCURACY_TOKEN_CAP,
    });

    if (!freshTokens.length) {
      logDiag(offer, 'result', { reason: 'no-fresh-tokens' });
      return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-fresh-tokens' };
    }

    // 2) Vorselektion per $near
    const searchRadiusM = Math.max(1, baseRadiusM + SEARCH_BUFFER);
    const nearDocs = await PushToken.find({
      _id: { $in: freshTokens.map((t) => t._id) },
      lastLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: searchRadiusM,
        },
      },
    })
      .select('_id token platform interests lastLocation lastLocationAccuracy')
      .lean();

    logDiag(offer, 'near-preselect', {
      nearCount: nearDocs.length,
      searchRadiusM,
      baseRadiusM,
    });

    if (!nearDocs.length) {
      logDiag(offer, 'result', { reason: 'no-near-tokens' });
      return { ok: true, total: 0, tried: 0, sent: 0, skipped: 0, reason: 'no-near-tokens' };
    }

    // 3) Interests-Filter
    const reqInterests = normalizeInterests(offer?.interestsRequired);
    let matched = nearDocs.filter((t) => interestsMatch(offer, t));
    logDiag(offer, 'interests-filter', {
      required: reqInterests,
      before: nearDocs.length,
      after: matched.length,
    });

    if (!matched.length) {
      logDiag(offer, 'result', {
        reason: 'interests-no-match',
        required: reqInterests,
        nearCount: nearDocs.length,
      });
      return {
        ok: true,
        total: nearDocs.length,
        tried: 0,
        sent: 0,
        skipped: nearDocs.length,
        reason: 'interests-no-match',
      };
    }

    // 4) Haversine + Accuracy-Cap (+5 m Buffer wie Mobile)
    const diagDistances = GEOPUSH_DEBUG ? [] : null;
    matched = matched.filter((t) => {
      const [tlng, tlat] = (t?.lastLocation?.coordinates || []);
      if (!Number.isFinite(tlng) || !Number.isFinite(tlat)) return false;
      const acc = Number(t?.lastLocationAccuracy);
      const capAcc = Number.isFinite(acc) && acc > 0 ? Math.min(acc, ACCURACY_TOKEN_CAP) : 0;

      // ⬇️ Align mit Mobile: radius + min(acc,60) + 5
      const effForToken = baseRadiusM + capAcc + ENTER_SANITY_BUFFER_M;

      const d = haversineMeters(lng, lat, tlng, tlat);
      if (diagDistances && diagDistances.length < 8) {
        diagDistances.push({
          d: Math.round(d),
          acc: Math.round(acc || 0),
          capAcc,
          eff: Math.round(effForToken),
          rule: 'r+min(acc,60)+5'
        });
      }
      return d <= effForToken;
    });

    logDiag(offer, 'distance-filter', {
      after: matched.length,
      samples: diagDistances || undefined,
    });

    if (!matched.length) {
      logDiag(offer, 'result', {
        reason: 'outside-after-accuracy',
        baseRadiusM,
        accCap: ACCURACY_TOKEN_CAP,
        samples: diagDistances || undefined,
      });
      return {
        ok: true,
        total: nearDocs.length,
        tried: 0,
        sent: 0,
        skipped: nearDocs.length,
        reason: 'outside-after-accuracy',
      };
    }

    // 5) OfferVisibility-Dedupe (+ Suppression)
    const cutoff = OFFER_NOTIFY_RESET_ON_UPDATE
      ? new Date(offer?.updatedAt || offer?.createdAt || 0)
      : new Date(0);

    const vis = await OfferVisibility.find({
      offerId: offer._id,
      deviceToken: { $in: matched.map((t) => t._id) },
      $or: [
        { status: 'snoozed', remindAt: { $gt: now } },
        { status: 'dismissed' },
        { status: 'notified', lastNotifiedAt: { $gte: cutoff } },
        { suppressUntil: { $gt: now } },
      ],
    })
      .select('deviceToken status remindAt lastNotifiedAt suppressUntil')
      .lean();

    const already = new Set(vis.map((v) => String(v.deviceToken)));
    const toNotifyDocs = matched.filter((t) => !already.has(String(t._id)));

    logDiag(offer, 'dedupe', {
      matched: matched.length,
      blockedByVis: already.size,
      toNotify: toNotifyDocs.length,
      cutoff: cutoff.toISOString(),
    });

    if (!toNotifyDocs.length) {
      logDiag(offer, 'result', { reason: 'dedup', matched: matched.length });
      return {
        ok: true,
        total: matched.length,
        tried: 0,
        sent: 0,
        skipped: matched.length,
        reason: 'dedup',
      };
    }

    // 6) Push senden (robust)
    const tokens = toNotifyDocs.map((t) => t.token).filter(Boolean);
    if (!tokens.length) {
      logDiag(offer, 'result', { reason: 'no-pushable-tokens', toNotify: toNotifyDocs.length });
      return {
        ok: true,
        total: toNotifyDocs.length,
        tried: 0,
        sent: 0,
        skipped: toNotifyDocs.length,
        reason: 'no-pushable-tokens',
      };
    }

    const title = offer.name || 'Angebot in deiner Nähe';
    const body = 'Tippe, um Details zu sehen.';
    const data = {
      type: 'offer',
      offerId: String(offer._id),
      route: `/offers/${offer._id}`,
      source: 'offer-update',
    };

    logDiag(offer, 'push-send', {
      tried: tokens.length,
      channelId: PUSH_CHANNEL_ID,
      categoryId: process.env.PUSH_CATEGORY_ID || 'offer-go-v2',
      priority: PUSH_PRIORITY,
      sound: PUSH_SOUND,
    });

    const diag = await sendPushAndCheckReceipts({
      tokens,
      title,
      body,
      data,
      channelId: PUSH_CHANNEL_ID, // ← jetzt konsistent 'offers-v2' (oder ENV)
      priority: PUSH_PRIORITY,
      sound: PUSH_SOUND,
      delayMs: 2500,
    });

    // 7) Welche Tokens „ok“?
    const sentTokens = [];
    const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
    const idToToken = diag?.sent?.idToToken || {};
    for (const t of tickets) {
      if (t?.status === 'ok' && t?.id && idToToken[t.id]) {
        sentTokens.push(idToToken[t.id]);
      }
    }

    // 8) OfferVisibility auf „notified“ setzen (+ Suppression)
    if (sentTokens.length) {
      const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
      const byToken = new Map(sentDocs.map((d) => [d.token, d._id]));
      const nowIso = new Date();
      const suppressUntil = RENOTIFY_COOLDOWN_MS > 0 ? new Date(nowIso.getTime() + RENOTIFY_COOLDOWN_MS) : null;
      const bulk = sentTokens
        .map((tok) => {
          const deviceTokenId = byToken.get(tok);
          if (!deviceTokenId) return null;
          return {
            updateOne: {
              filter: { offerId: offer._id, deviceToken: deviceTokenId },
              update: {
                $setOnInsert: { offerId: offer._id, deviceToken: deviceTokenId, firstSeenAt: nowIso },
                $set: {
                  status: 'notified',
                  remindAt: null,
                  lastNotifiedAt: nowIso,
                  updatedAt: nowIso,
                  ...(suppressUntil ? { suppressUntil } : { suppressUntil: null }),
                },
              },
              upsert: true,
            },
          };
        })
        .filter(Boolean);
      if (bulk.length) await OfferVisibility.bulkWrite(bulk);
    }

    // 9) Tokens ggf. deaktivieren
    const disabledCount = Array.isArray(diag?.disabledTokens) ? diag.disabledTokens.length : 0;
    if (disabledCount > 0) {
      await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
    }

    const summary = diag?.receipts?.summary || {};
    console.log(
      `[geoPush] offer=${offer._id} fresh=${freshTokens.length} near=${nearDocs.length} ` +
      `matched=${matched.length} tried=${tokens.length} sentOk=${sentTokens.length} ` +
      `disabled=${disabledCount} receipts=${JSON.stringify(summary)}${
        diag?.retry && diag.retry.count > 0 ? ` retry=${JSON.stringify(diag.retry)}` : ''
      }`
    );

    logDiag(offer, 'result', {
      reason: sentTokens.length ? 'sent' : 'sent-0',
      total: matched.length,
      tried: tokens.length,
      sentOk: sentTokens.length,
      disabledCount,
      receipts: summary,
    });

    // 🔁 Fresh-Token-Retry (optional)
    try {
      const deviceNotRegistered =
        summary && summary.errors && typeof summary.errors.DeviceNotRegistered === 'number'
          ? summary.errors.DeviceNotRegistered
          : 0;

      const tokensForRetry = sentTokens.length
        ? tokens.filter(t => !sentTokens.includes(t))
        : tokens.slice();

      if (deviceNotRegistered > 0 && tokensForRetry.length) {
        console.log('[geoPush.retry] scheduling for DeviceNotRegistered', {
          offerId: String(offer?._id || ''),
          count: tokensForRetry.length,
          delays: FRESH_RETRY_DELAYS_MS,
        });
        await scheduleFreshTokenRetries({ offer, tokens: tokensForRetry, now });
      }
    } catch (e) {
      console.log('[geoPush.retry] scheduling failed (non-fatal):', e?.message || e);
    }

    return {
      ok: true,
      total: matched.length,
      tried: tokens.length,
      sent: sentTokens.length,
      skipped: matched.length - sentTokens.length,
      receipts: summary,
    };
  } catch (e) {
    console.error('[geoPush] error:', e?.message || e, e?.stack || '');
    logDiag(offer, 'error', { message: e?.message || String(e) });
    return { ok: false, error: String(e?.message || e) };
  }
}
