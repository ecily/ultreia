// backend/jobs/offerPoller.js
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';
import { sendPushAndCheckReceipts } from '../utils/push.js'; // robuste Diagnose-Variante
import { isOfferActiveNow } from '../utils/isOfferActiveNow.js'; // TZ-sicher

/* ───────── Helpers ───────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
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

// Haversine (Meter)
function distanceMeters(lng1, lat1, lng2, lat2) {
  function toRad(d) { return (d * Math.PI) / 180; }
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ───────── Konfig ───────── */
// ⏱️ Polling (via ENV überschreibbar)
const INTERVAL_MS = envMs('PUSH_POLLER_INTERVAL_MS', 60_000);

// Wie weit zurück neue/aktualisierte Offers berücksichtigt werden
const NEW_OFFER_WINDOW_MS = envMs('PUSH_NEW_OFFER_WINDOW_MS', 15 * 60_000);

// 🛰️ Freshness-Fenster für Standort
const LAST_LOCATION_MAX_AGE_MS = envMs('PUSH_LAST_LOCATION_MAX_AGE_MS', 10 * 60_000);

// Fallback-Radius, falls Offer keinen Radius hat
const MAX_DISTANCE_M_DEFAULT = Number(process.env.PUSH_MAX_DISTANCE_M ?? 1500);

// ➕ Globaler Accuracy-Puffer (für Geo-Query)
const ACCURACY_BUFFER_MAX = Number(process.env.PUSH_ACCURACY_BUFFER_MAX ?? 15); // Meter

// 🔧 Pro-Token-Accuracy-Cap für die Nachfilterung (Haversine)
const ACCURACY_TOKEN_CAP = Number(process.env.PUSH_ACCURACY_TOKEN_CAP ?? 60); // Meter

// Vorselektion großzügig, damit die Nachfilterung Kandidaten bekommt
const SEARCH_BUFFER = Math.max(ACCURACY_BUFFER_MAX, ACCURACY_TOKEN_CAP);

const TZ = 'Europe/Vienna';

// Push-Defaults (müssen zur App passen)
const PUSH_CHANNEL_ID =
  process.env.EXPO_PUSH_CHANNEL_ID ||
  process.env.PUSH_CHANNEL_ID ||
  'offers-v2';
const PUSH_PRIORITY   = process.env.PUSH_PRIORITY   || 'high';
const PUSH_SOUND      = process.env.PUSH_SOUND      || 'default';
const RENOTIFY_COOLDOWN_MS = envMs('GEOFENCE_RENOTIFY_COOLDOWN_MS', 2 * 60 * 60 * 1000);

// Projekt-Scope (Filter Tokens auf dieses Projekt, falls gesetzt)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// Re-Notify nach Offer-Update erlauben (Default ON)
const OFFER_NOTIFY_RESET_ON_UPDATE = !['0','false','off'].includes(
  String(process.env.OFFER_NOTIFY_RESET_ON_UPDATE ?? '1').toLowerCase()
);

let timer = null;

/* ───────── Leader-Lock & Dedup-Lock (Mongo) ───────── */
// Collection-Namen
const LEADER_COLL    = 'offer_poller_leader';
const PUSHLOCKS_COLL = 'offer_poller_pushlocks';

// Lease-Zeit für Leader (etwas > Intervall)
const LEASE_MS = Math.max(INTERVAL_MS * 3, 45_000);

// Id der Instanz
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

// einmalige Index-Initialisierung
let indexesReady = false;
async function ensureIndexes() {
  if (indexesReady) return;
  const db = mongoose.connection.db;

  // Leader: unique-Key + TTL auf expiresAt
  const leader = db.collection(LEADER_COLL);
  await leader.createIndex({ key: 1 }, { unique: true, name: 'leader_key_unique' });
  await leader.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'leader_expire_ttl' });

  // PushLocks: eindeutige Kombination (offerId, deviceTokenId) + TTL
  const locks = db.collection(PUSHLOCKS_COLL);
  await locks.createIndex({ offerId: 1, deviceTokenId: 1 }, { unique: true, name: 'pushlock_offer_token_unique' });
  await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'pushlock_expire_ttl' });

  indexesReady = true;
}

// versucht Leader-Lock zu erlangen/erneuern
async function acquireLeader() {
  const db = mongoose.connection.db;
  const leader = db.collection(LEADER_COLL);
  const now = new Date();
  const exp = new Date(now.getTime() + LEASE_MS);
  const filter = {
    key: 'offerPoller',
    $or: [
      { expiresAt: { $lte: now } },
      { leaderId: INSTANCE_ID },
    ],
  };
  const update = {
    $set: { key: 'offerPoller', leaderId: INSTANCE_ID, expiresAt: exp, updatedAt: now },
    $setOnInsert: { createdAt: now },
  };
  const opts = { upsert: true, returnDocument: 'after' };
  try {
    const res = await leader.findOneAndUpdate(filter, update, opts);
    return res?.value?.leaderId === INSTANCE_ID ? { ok: true, expiresAt: res.value.expiresAt } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// Idempotenz-Locks für Batch (ein Insert je (offerId, deviceTokenId))
async function createPushLocks(offerId, deviceTokenIds, ttlMs) {
  if (!deviceTokenIds?.length) return { inserted: [], skipped: deviceTokenIds || [] };
  const db = mongoose.connection.db;
  const locks = db.collection(PUSHLOCKS_COLL);
  const now = new Date();
  const exp = new Date(now.getTime() + Math.max(ttlMs, 1));
  const docs = deviceTokenIds.map((id) => ({
    offerId: new mongoose.Types.ObjectId(String(offerId)),
    deviceTokenId: new mongoose.Types.ObjectId(String(id)),
    createdAt: now,
    expiresAt: exp,
    instanceId: INSTANCE_ID,
  }));

  const inserted = [];
  const skipped = [];
  for (const d of docs) {
    try {
      await locks.insertOne(d);
      inserted.push(String(d.deviceTokenId));
    } catch {
      skipped.push(String(d.deviceTokenId));
    }
  }
  return { inserted, skipped };
}

/* ───────── Start/Stop ───────── */
export function startOfferPoller() {
  if (timer) return;

  const DEBUG = process.env.DEBUG_OFFER_POLLER === '1';

  if (DEBUG) {
    console.log(
      `[offerPoller][debug] cfg interval=${INTERVAL_MS}ms freshness=${LAST_LOCATION_MAX_AGE_MS}ms ` +
      `accuracyBuf=${ACCURACY_BUFFER_MAX}m tokenCap=${ACCURACY_TOKEN_CAP}m lease=${LEASE_MS}ms instance=${INSTANCE_ID}`
    );
  } else {
    console.log(`[offerPoller] started — every ${INTERVAL_MS}ms (instance=${INSTANCE_ID})`);
  }

  async function doCycle() {
    const now = new Date();
    try {
      await ensureIndexes();
      const leader = await acquireLeader();
      if (!leader.ok) return;

      // Kandidaten: nur Offers mit Geo & Radius > 0 und (neu/aktualisiert im Fenster oder im Datumsfenster gültig)
      const since = new Date(Date.now() - NEW_OFFER_WINDOW_MS);
      const candidateOffers = await Offer.find({
        radius: { $gt: 0 },
        'location.coordinates.0': { $type: 'number' },
        'location.coordinates.1': { $type: 'number' },
        $or: [
          { createdAt: { $gte: since } },
          { updatedAt: { $gte: since } },
          {
            $and: [
              { $or: [{ 'validDates.from': { $exists: false } }, { 'validDates.from': { $lte: now } }] },
              { $or: [{ 'validDates.to': { $exists: false } }, { 'validDates.to': { $gte: now } }] },
            ],
          },
        ],
      })
        .select('_id name location radiusMeters radius validDates validTimes validDays weekdays category subcategory interestsRequired updatedAt createdAt')
        .lean();

      const activeOffers = candidateOffers.filter((o) => isOfferActiveNow(o, TZ, now));

      // Tokens mit frischer Location (ggf. Project-Scope)
      const freshSince = new Date(Date.now() - LAST_LOCATION_MAX_AGE_MS);
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

      const tokensFresh = await PushToken.find(tokenQuery)
        .select('_id token platform interests lastLocation projectId deviceId updatedAt lastSeenAt lastHeartbeatAt lastLocationAccuracy')
        .lean();

      if (!activeOffers.length || !tokensFresh.length) {
        if (DEBUG) {
          console.log(`[offerPoller][debug] skip cycle — activeOffers=${activeOffers.length} tokensFresh=${tokensFresh.length}`);
        }
        return;
      }

      for (const offer of activeOffers) {
        try {
          const coords = offer?.location?.coordinates;
          const [lng, lat] = Array.isArray(coords) ? coords : [];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const baseRadiusM = Number(offer.radiusMeters ?? offer.radius ?? MAX_DISTANCE_M_DEFAULT);
          if (!Number.isFinite(baseRadiusM) || baseRadiusM <= 0) continue;

          const searchRadiusM = Math.max(1, baseRadiusM + SEARCH_BUFFER);

          const nearQuery = {
            _id: { $in: tokensFresh.map((t) => t._id) },
            lastLocation: {
              $near: {
                $geometry: { type: 'Point', coordinates: [lng, lat] },
                $maxDistance: searchRadiusM,
              },
            },
          };

          const nearTokens = await PushToken.find(nearQuery)
            .select('_id token platform interests lastLocation projectId deviceId lastLocationAccuracy')
            .lean();

          // Interessen-Matching
          let matched = nearTokens.filter((t) => interestsMatch(offer, t));

          // Feinfilter: echte Distanz + token-spezifischer Eff-Radius
          if (matched.length) {
            matched = matched.filter((t) => {
              const acc = Number(t?.lastLocationAccuracy);
              const capAcc = Number.isFinite(acc) && acc > 0 ? Math.min(acc, ACCURACY_TOKEN_CAP) : 0;
              const effForToken = baseRadiusM + capAcc;
              const [tlng, tlat] = (t?.lastLocation?.coordinates || []);
              if (!Number.isFinite(tlng) || !Number.isFinite(tlat)) return false;
              const dist = distanceMeters(lng, lat, tlng, tlat);
              return dist <= effForToken;
            });
          }

          if (!matched.length) continue;

          // Dedupe: Snooze blockt immer; notified/dismissed blocken nur, wenn nach cutoff
          const RESET_ON_UPDATE = OFFER_NOTIFY_RESET_ON_UPDATE;
          const cutoff = RESET_ON_UPDATE
            ? new Date(offer?.updatedAt || offer?.createdAt || 0)
            : new Date(0);

          const vis = await OfferVisibility.find({
            offerId: offer._id,
            deviceToken: { $in: matched.map((t) => t._id) },
            $or: [
              { status: 'snoozed', remindAt: { $gt: now } },
              { status: { $in: ['notified', 'dismissed'] }, lastNotifiedAt: { $gte: cutoff } },
              { suppressUntil: { $gt: now } },
            ],
          }).select('deviceToken status remindAt lastNotifiedAt').lean();

          const already = new Set(vis.map((v) => String(v.deviceToken)));
          const toNotifyDocs = matched.filter((t) => !already.has(String(t._id)));
          if (!toNotifyDocs.length) continue;

          // Idempotenz-Lock je (offerId, deviceToken)
          const deviceTokenIds = toNotifyDocs.map((t) => t._id);
          const lockRes = await createPushLocks(offer._id, deviceTokenIds, NEW_OFFER_WINDOW_MS);
          const lockedSet = new Set(lockRes.inserted);
          const deduped = toNotifyDocs.filter((t) => lockedSet.has(String(t._id)));
          if (!deduped.length) continue;

          // Push senden
          const tokens = deduped.map((t) => t.token).filter(Boolean);
          if (!tokens.length) continue;

          const title = offer.name ?? 'Neues Angebot in deiner Nähe';
          const body  = 'Tippe, um Details zu sehen.';
          const data  = {
            type: 'offer',
            offerId: String(offer._id),
            route: `/offers/${offer._id}`,
            source: 'poller',
          };

          const diag = await sendPushAndCheckReceipts({
            tokens,
            title,
            body,
            data,
            channelId: PUSH_CHANNEL_ID,
            categoryId: process.env.PUSH_CATEGORY_ID || 'offer-go-v2',
            priority:  PUSH_PRIORITY,
            sound:     PUSH_SOUND,
            delayMs:   2500,
          });

          // Erfolgreich gesendete Tokens ermitteln
          const sentTokens = [];
          const tickets = Array.isArray(diag?.sent?.tickets) ? diag.sent.tickets : [];
          const idToToken = diag?.sent?.idToToken || {};
          if (tickets.length) {
            for (let i = 0; i < tickets.length; i++) {
              const t = tickets[i];
              if (t?.status === 'ok') {
                // bevorzugt idToToken, ansonsten Fallback auf Positions-Mapping
                const tok = (t?.id && idToToken[t.id]) ? idToToken[t.id] : (tokens[i] || null);
                if (tok) sentTokens.push(tok);
              }
            }
          }

          // OfferVisibility auf „notified“ setzen
          if (sentTokens.length) {
            const sentDocs = await PushToken.find({ token: { $in: sentTokens } }, { _id: 1, token: 1 }).lean();
            const byToken = new Map(sentDocs.map((d) => [d.token, d._id]));
            const nowIso = new Date();
            const bulk = [];
            const suppressUntil = RENOTIFY_COOLDOWN_MS > 0 ? new Date(nowIso.getTime() + RENOTIFY_COOLDOWN_MS) : null;
            for (const tok of sentTokens) {
              const deviceTokenId = byToken.get(tok);
              if (!deviceTokenId) continue;
              bulk.push({
                updateOne: {
                  filter: { offerId: offer._id, deviceToken: deviceTokenId },
                  update: {
                    $setOnInsert: { offerId: offer._id, deviceToken: deviceTokenId, firstSeenAt: nowIso },
                    $set: { status: 'notified', remindAt: null, lastNotifiedAt: nowIso, updatedAt: nowIso, ...(suppressUntil ? { suppressUntil } : { suppressUntil: null }) },
                  },
                  upsert: true,
                },
              });
            }
            if (bulk.length) await OfferVisibility.bulkWrite(bulk);
          }

          // lokal deaktivieren falls nötig
          const disabledCount = Array.isArray(diag?.disabledTokens) ? diag.disabledTokens.length : 0;
          if (disabledCount > 0) {
            await PushToken.updateMany({ token: { $in: diag.disabledTokens } }, { $set: { disabled: true } });
          }

          // Logging
          const summary = diag?.receipts?.summary || {};
          console.log(
            `[offerPoller][batch] offer=${offer._id} tried=${tokens.length} sentOk=${sentTokens.length} ` +
              `disabled=${disabledCount} invalid=${(diag?.invalid || []).length} ` +
              `receipts=${JSON.stringify(summary)}`
          );
          if (diag?.retry && diag.retry.count > 0) {
            console.log(
              `[offerPoller][retry] attempts=${diag.retry.count} succeeded=${diag.retry.succeeded} ` +
                `targets=${JSON.stringify(diag.retry.targets || [])}`
            );
          }
        } catch (err) {
          console.error('[offerPoller][offer] error:', err?.message || err);
          continue;
        }
      }
    } catch (e) {
      console.error('[offerPoller] cycle error:', e?.message || e);
    }
  }

  // Sofortiger erster Lauf + Intervall
  (async () => {
    try { await ensureIndexes(); } catch {}
    await doCycle();
  })();

  timer = setInterval(doCycle, INTERVAL_MS);
}

export function stopOfferPoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[offerPoller] stopped');
  }
}
