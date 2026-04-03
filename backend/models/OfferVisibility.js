// stepsmatch/backend/models/OfferVisibility.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

/* ────────────────────────────────────────────────────────────
   Status-Konstanten
   ──────────────────────────────────────────────────────────── */
const STATUS = {
  SEEN: 'seen',
  NOTIFIED: 'notified',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
};

/* ────────────────────────────────────────────────────────────
   ENV helper
   ──────────────────────────────────────────────────────────── */
function envMs(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  if (['', '0', 'false', 'off', 'null', 'none'].includes(s)) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

/** Wie lange nach einer NOTIFIED-Meldung darf erneut gepusht werden (Geofence-Enter)? */
const RENOTIFY_COOLDOWN_MS = envMs('GEOFENCE_RENOTIFY_COOLDOWN_MS', 2 * 60 * 60 * 1000); // 2h
const REENTRY_MIN_GAP_MS = envMs('REENTRY_MIN_GAP_MS', 5 * 60 * 1000); // 5 min

/* ────────────────────────────────────────────────────────────
   Schema
   ──────────────────────────────────────────────────────────── */
const OfferVisibilitySchema = new Schema(
  {
    deviceToken: {
      type: Types.ObjectId,
      ref: 'PushToken',
      required: true,
      index: true,
    },
    offerId: {
      type: Types.ObjectId,
      ref: 'Offer',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(STATUS),
      required: true,
      default: STATUS.SEEN,
      index: true,
    },

    inside: { type: Boolean, default: false, index: true },
    lastEnterAt: { type: Date, default: null, index: true },
    lastExitAt: { type: Date, default: null, index: true },
    lastDistanceM: { type: Number, default: null },
    lastReason: { type: String, default: null },

    firstSeenAt: { type: Date, default: Date.now, index: true },
    lastNotifiedAt: { type: Date, default: null, index: true },
    remindAt: { type: Date, default: null, index: true },

    /** Optionale serverseitige Unterdrückung bis zu einem Zeitpunkt */
    suppressUntil: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offervisibility',
    strict: true,
    minimize: false,
  }
);

// Eindeutig pro (deviceToken × offerId)
OfferVisibilitySchema.index({ deviceToken: 1, offerId: 1 }, { unique: true });
// Nützliche Sekundärindizes
OfferVisibilitySchema.index({ updatedAt: -1 });
OfferVisibilitySchema.index({ status: 1, remindAt: 1 });
OfferVisibilitySchema.index({ offerId: 1, status: 1, updatedAt: -1 });
OfferVisibilitySchema.index({ deviceToken: 1, inside: 1, updatedAt: -1 });

/* ────────────────────────────────────────────────────────────
   Statics
   ──────────────────────────────────────────────────────────── */
OfferVisibilitySchema.statics.upsertSeen = async function upsertSeen(deviceTokenId, offerId) {
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    { $setOnInsert: { status: STATUS.SEEN, firstSeenAt: new Date() } },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.markNotified = async function markNotified(
  deviceTokenId,
  offerId,
  at = new Date(),
  cooldownMs = RENOTIFY_COOLDOWN_MS
) {
  const suppressUntil =
    Number.isFinite(cooldownMs) && cooldownMs > 0 ? new Date(at.getTime() + cooldownMs) : null;

  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: {
        status: STATUS.NOTIFIED,
        lastNotifiedAt: at,
        remindAt: null,
        ...(suppressUntil ? { suppressUntil } : { suppressUntil: null }),
      },
      $setOnInsert: { firstSeenAt: at },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.snooze = async function snooze(deviceTokenId, offerId, minutes = 30) {
  const now = new Date();
  const remindAt = new Date(now.getTime() + Math.max(1, minutes) * 60 * 1000);
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { status: STATUS.SNOOZED, remindAt, suppressUntil: null },
      $setOnInsert: { firstSeenAt: now },
    },
    { new: true, upsert: true }
  ).exec();
};

OfferVisibilitySchema.statics.dismiss = async function dismiss(deviceTokenId, offerId) {
  const now = new Date();
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { status: STATUS.DISMISSED, remindAt: null, suppressUntil: null },
      $setOnInsert: { firstSeenAt: now },
    },
    { new: true, upsert: true }
  ).exec();
};

/** Suppress-Helfer: setzt/verlängert die Unterdrückung bis now+ms */
OfferVisibilitySchema.statics.setSuppressFor = async function setSuppressFor(
  deviceTokenId,
  offerId,
  ms = RENOTIFY_COOLDOWN_MS
) {
  const now = new Date();
  const until = Number.isFinite(ms) && ms > 0 ? new Date(now.getTime() + ms) : null;
  return this.findOneAndUpdate(
    { deviceToken: deviceTokenId, offerId },
    {
      $set: { suppressUntil: until },
      $setOnInsert: { firstSeenAt: now, status: STATUS.SEEN },
    },
    { new: true, upsert: true }
  ).exec();
};

/**
 * shouldNotify:
 * - DISMISSED → nie
 * - SNOOZED  → erst ab remindAt
 * - suppressUntil > now → nein
 * - SEEN     → ja
 * - NOTIFIED → nur wenn Cooldown seit lastNotifiedAt abgelaufen
 */
OfferVisibilitySchema.statics.shouldNotify = async function shouldNotify(
  deviceTokenId,
  offerId,
  now = new Date()
) {
  const doc = await this.findOne({ deviceToken: deviceTokenId, offerId }).lean().exec();
  if (!doc) return true;
  if (doc.status === STATUS.DISMISSED) return false;
  if (doc.status === STATUS.SNOOZED) return !!doc.remindAt && doc.remindAt <= now;
  const canReenterOverride = () => {
    if (!doc.lastExitAt || !doc.lastNotifiedAt) return false;
    const exitAt = new Date(doc.lastExitAt).getTime();
    const notifiedAt = new Date(doc.lastNotifiedAt).getTime();
    if (!Number.isFinite(exitAt) || !Number.isFinite(notifiedAt)) return false;
    if (exitAt <= notifiedAt) return false;
    return now.getTime() - exitAt >= REENTRY_MIN_GAP_MS;
  };
  if (doc.suppressUntil && doc.suppressUntil > now) {
    return canReenterOverride();
  }
  if (doc.status === STATUS.SEEN) return true;
  // NOTIFIED
  if (!doc.lastNotifiedAt) return false;
  try {
    const t = new Date(doc.lastNotifiedAt).getTime();
    if (!Number.isFinite(t)) return false;
    if (now.getTime() - t >= RENOTIFY_COOLDOWN_MS) return true;
    return canReenterOverride();
  } catch {
    return false;
  }
};

OfferVisibilitySchema.statics.loadMapForOffers = async function loadMapForOffers(deviceTokenId, offerIds = []) {
  if (!deviceTokenId || !Array.isArray(offerIds) || offerIds.length === 0) return new Map();
  const rows = await this.find({ deviceToken: deviceTokenId, offerId: { $in: offerIds } }).lean().exec();
  const map = new Map();
  for (const r of rows) map.set(String(r.offerId), r);
  return map;
};

const OfferVisibility = model('OfferVisibility', OfferVisibilitySchema);
export { STATUS as OFFER_VISIBILITY_STATUS };
export default OfferVisibility;
