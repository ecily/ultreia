// C:/ultreia/backend/src/server.js
// ULTREIA Backend – Heartbeat-MVP (FCM + optional Expo Push mit Diagnostik)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const https = require('https');
const path = require('path');
const admin = require('firebase-admin');

// Models
const Offer = require('./models/Offer');
// Routes
const offersRouter = require('./routes/offers');

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ultreia';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const HEARTBEAT_SECONDS = Number(process.env.HEARTBEAT_SECONDS || 60);
const OFFER_MAX_DISTANCE_METERS = Number(process.env.OFFER_MAX_DISTANCE_METERS || 250);

// Push-Dedupe (Server-seitig)
const PUSH_DEDUPE_MINUTES = Math.max(1, Number(process.env.PUSH_DEDUPE_MINUTES || 5)); // pro offerId
// Globaler Cooldown (egal welche Offer): schützt vor Push-Spam bei vielen Treffern
const PUSH_GLOBAL_COOLDOWN_SECONDS = Math.max(0, Number(process.env.PUSH_GLOBAL_COOLDOWN_SECONDS || 45));
const PUSH_EVENT_TTL_DAYS = Math.max(1, Number(process.env.PUSH_EVENT_TTL_DAYS || 14));

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || undefined;
// Cloud (DO / App Platform): Service-Account als JSON in Env
const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON || undefined;
// Lokal: alternativ Pfad zu JSON-Datei
const FCM_SERVICE_ACCOUNT_PATH =
  process.env.FCM_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined;

// Debug gating (Prod-Sicherheit)
const DEBUG_TOKEN = process.env.DEBUG_TOKEN || '';
const DEBUG_DEVICE_ALLOWLIST = (process.env.DEBUG_DEVICE_ALLOWLIST || '')
  .split(',')
  .map((s) => String(s || '').trim())
  .filter(Boolean);

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: { service: 'ultreia-backend' },
  redact: ['req.headers.authorization', 'req.headers["x-debug-token"]'],
});

// ── Debug helper ───────────────────────────────────────────────────────────────
function isDebugAllowed(req, deviceIdMaybe) {
  // In non-prod: always allow
  if (!isProd) return { ok: true, why: 'non-prod' };

  const deviceId = deviceIdMaybe ? String(deviceIdMaybe) : null;

  // In prod: allow only if deviceId is in allowlist OR token matches
  const token = String(req.headers['x-debug-token'] || req.query.debugToken || req.query.token || '');
  if (DEBUG_TOKEN && token && token === DEBUG_TOKEN) return { ok: true, why: 'token' };

  if (deviceId && DEBUG_DEVICE_ALLOWLIST.includes(deviceId)) return { ok: true, why: 'allowlist' };

  return { ok: false, why: 'forbidden' };
}

function requireDebug(req, res, deviceIdMaybe) {
  const gate = isDebugAllowed(req, deviceIdMaybe);
  if (gate.ok) return true;
  res.status(403).json({ ok: false, error: 'debug forbidden', reason: gate.why });
  return false;
}

function clampNumber(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

// ── Expo Push Setup ───────────────────────────────────────────────────────────
const EXPO_PUSH_HOST = 'exp.host';
const EXPO_PUSH_SEND_PATH = '/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_PATH = '/--/api/v2/push/getReceipts';

function expoPost(pathName, body) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body || {});
    const options = {
      host: EXPO_PUSH_HOST,
      method: 'POST',
      path: pathName,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(json),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (e) {
          parsed = null;
        }
        resolve({ statusCode: res.statusCode, body: parsed !== null ? parsed : raw });
      });
    });

    req.on('error', (err) => reject(err));

    req.write(json);
    req.end();
  });
}

// Einzelnen Expo Push senden (ein Token)
async function sendExpoPush({ expoPushToken, title, body, data }) {
  if (!expoPushToken || typeof expoPushToken !== 'string') {
    logger.warn({ expoPushToken }, '[push-expo] missing expoPushToken, skipping');
    return { ok: false, error: 'missing-expo-token' };
  }
  if (!expoPushToken.startsWith('ExponentPushToken[')) {
    logger.warn({ expoPushToken }, '[push-expo] invalid expoPushToken format');
    return { ok: false, error: 'invalid-expo-token-format' };
  }

  const payload = {
    to: expoPushToken,
    sound: 'default',
    title: title || 'ULTREIA',
    body: body || 'Neues Angebot in deiner Nähe.',
    data: data || {},
  };

  try {
    const { statusCode, body: respBody } = await expoPost(EXPO_PUSH_SEND_PATH, payload);
    logger.info({ statusCode, respBody }, '[push-expo] Expo send response');

    let ticket = null;
    if (respBody && respBody.data) {
      if (respBody.data.id) ticket = respBody.data;
      if (Array.isArray(respBody.data) && respBody.data.length > 0) ticket = respBody.data[0];
    }

    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode,
      ticket,
      raw: respBody,
    };
  } catch (err) {
    logger.warn({ err }, '[push-expo] Expo send error');
    return { ok: false, error: err.message || String(err) };
  }
}

// Expo Receipts holen
async function getExpoReceipts(ticketIds) {
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return { ok: false, error: 'no-ticket-ids' };
  }

  try {
    const { statusCode, body } = await expoPost(EXPO_PUSH_RECEIPTS_PATH, { ids: ticketIds });
    logger.info({ statusCode, body }, '[push-expo] Expo receipts response');
    return { ok: statusCode >= 200 && statusCode < 300, statusCode, body };
  } catch (err) {
    logger.warn({ err }, '[push-expo] Expo receipts error');
    return { ok: false, error: err.message || String(err) };
  }
}

const expoPushReady = true;

// ── FCM (firebase-admin) Setup ────────────────────────────────────────────────
let fcmReady = false;
let fcmMessaging = null;

if (FCM_SERVICE_ACCOUNT_JSON || FCM_SERVICE_ACCOUNT_PATH) {
  try {
    let serviceAccount;

    if (FCM_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
      logger.info(
        { projectId: FCM_PROJECT_ID || serviceAccount.project_id },
        '[fcm] initializing firebase-admin from JSON env'
      );
    } else {
      const resolved = path.resolve(FCM_SERVICE_ACCOUNT_PATH);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      serviceAccount = require(resolved);
      logger.info(
        { projectId: FCM_PROJECT_ID || serviceAccount.project_id, serviceAccountPath: resolved },
        '[fcm] initializing firebase-admin from file'
      );
    }

    if (!admin.apps.length) {
      const appFcm = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FCM_PROJECT_ID || serviceAccount.project_id,
      });
      fcmMessaging = appFcm.messaging();
    } else {
      fcmMessaging = admin.app().messaging();
    }

    fcmReady = true;
    logger.info({ projectId: FCM_PROJECT_ID || serviceAccount.project_id }, '[fcm] initialized firebase-admin');
  } catch (err) {
    fcmReady = false;
    fcmMessaging = null;
    logger.error(
      { err, hasJson: Boolean(FCM_SERVICE_ACCOUNT_JSON), FCM_SERVICE_ACCOUNT_PATH, FCM_PROJECT_ID },
      '[fcm] failed to init firebase-admin'
    );
  }
} else {
  logger.warn(
    '[fcm] no FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_PATH/GOOGLE_APPLICATION_CREDENTIALS set – FCM disabled'
  );
}

function isFcmTokenInvalidCode(code) {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token' ||
    code === 'messaging/invalid-argument'
  );
}

async function sendFcmPush({ deviceId, fcmToken, title, body, data }) {
  if (!fcmReady || !fcmMessaging) {
    logger.warn('[fcm] not initialized, skipping push');
    return { ok: false, error: 'fcm-not-initialized' };
  }
  if (!fcmToken || typeof fcmToken !== 'string') {
    logger.warn({ fcmToken }, '[fcm] missing fcmToken, skipping');
    return { ok: false, error: 'missing-fcm-token' };
  }

  const dataPayload = {};
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === 'string') dataPayload[String(k)] = v;
      else dataPayload[String(k)] = JSON.stringify(v);
    });
  }

  const message = {
    token: fcmToken,
    notification: {
      title: title || 'ULTREIA',
      body: body || 'Neues Angebot in deiner Nähe.',
    },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        channelId: 'offers',
        sound: 'default',
      },
    },
  };

  try {
    const response = await fcmMessaging.send(message);
    logger.info({ response }, '[fcm] send response');
    return { ok: true, messageId: response };
  } catch (err) {
    const code = err && err.code ? err.code : undefined;
    logger.warn({ err: { message: err.message, code, stack: err.stack } }, '[fcm] send error');

    // Token-Hygiene: ungültige Tokens serverseitig entfernen
    if (deviceId && typeof deviceId === 'string' && isFcmTokenInvalidCode(code)) {
      try {
        await Device.updateOne(
          { deviceId },
          { $set: { invalid: true, fcmToken: null, lastSeenAt: new Date() } }
        );
        logger.warn({ deviceId, code }, '[fcm] token invalid -> cleared fcmToken & marked invalid');
      } catch (e) {
        logger.warn({ deviceId, e }, '[fcm] failed to clear invalid token');
      }
    }

    return { ok: false, error: err.message || String(err), code };
  }
}

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', true);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// request-id + logging
app.use((req, res, next) => {
  if (!req.headers['x-request-id']) req.headers['x-request-id'] = crypto.randomUUID();
  res.setHeader('x-request-id', req.headers['x-request-id']);
  next();
});
app.use(
  pinoHttp({
    logger,
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
    autoLogging: { ignore: (req) => req.url === '/favicon.ico' },
  })
);

// ── Models ────────────────────────────────────────────────────────────────────
const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'unknown' },
    expoPushToken: { type: String },
    fcmToken: { type: String },
    lastSeenAt: { type: Date },
    invalid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const heartbeatSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number },
    ts: { type: Date, default: () => new Date() },
    serverReceivedAt: { type: Date, default: () => new Date(), index: true },

    powerState: { type: String },
    battery: {
      level: { type: Number, min: 0, max: 1 },
      charging: { type: Boolean },
    },

    interests: [{ type: String }],

    expireAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
  },
  { timestamps: true }
);

heartbeatSchema.index({ deviceId: 1, ts: -1 });
heartbeatSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const pushEventSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    offerId: { type: String, required: true, index: true }, // primary offer
    offerIds: { type: String }, // comma-separated ids (optional)
    via: { type: String, enum: ['fcm', 'expo', 'none'], default: 'none' },
    source: { type: String, default: 'heartbeat' },

    pushOk: { type: Boolean, default: false, index: true },
    errorCode: { type: String },
    errorMessage: { type: String },

    category: { type: String },
    distanceMeters: { type: Number },

    sentAt: { type: Date, default: () => new Date(), index: true },
    expireAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * PUSH_EVENT_TTL_DAYS),
    },
  },
  { timestamps: true }
);

pushEventSchema.index({ deviceId: 1, offerId: 1, sentAt: -1 });
pushEventSchema.index({ deviceId: 1, sentAt: -1 });
pushEventSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
const Heartbeat = mongoose.models.Heartbeat || mongoose.model('Heartbeat', heartbeatSchema);
const PushEvent = mongoose.models.PushEvent || mongoose.model('PushEvent', pushEventSchema);

async function shouldDedupePushOkByOffer({ deviceId, offerId }) {
  const since = new Date(Date.now() - PUSH_DEDUPE_MINUTES * 60 * 1000);
  const existing = await PushEvent.findOne({
    deviceId,
    offerId,
    pushOk: true,
    sentAt: { $gte: since },
  })
    .sort({ sentAt: -1 })
    .select({ sentAt: 1, via: 1, _id: 0 })
    .lean();

  return existing ? { dedupe: true, last: existing } : { dedupe: false, last: null };
}

async function shouldCooldownPushOkGlobal({ deviceId }) {
  if (!PUSH_GLOBAL_COOLDOWN_SECONDS || PUSH_GLOBAL_COOLDOWN_SECONDS <= 0) {
    return { cooldown: false, last: null };
  }
  const since = new Date(Date.now() - PUSH_GLOBAL_COOLDOWN_SECONDS * 1000);
  const existing = await PushEvent.findOne({
    deviceId,
    pushOk: true,
    sentAt: { $gte: since },
  })
    .sort({ sentAt: -1 })
    .select({ sentAt: 1, offerId: 1, via: 1, _id: 0 })
    .lean();

  return existing ? { cooldown: true, last: existing } : { cooldown: false, last: null };
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';

  return res.json({
    ok: true,
    service: 'ultreia-backend',
    env: NODE_ENV,
    db: dbState,
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    expoPushReady,
    fcmReady,
    heartbeatSeconds: HEARTBEAT_SECONDS,
    offerMaxDistanceMeters: OFFER_MAX_DISTANCE_METERS,
    pushDedupeMinutes: PUSH_DEDUPE_MINUTES,
    pushGlobalCooldownSeconds: PUSH_GLOBAL_COOLDOWN_SECONDS,
    debug: {
      prodGated: isProd,
      allowlistCount: DEBUG_DEVICE_ALLOWLIST.length,
      tokenEnabled: Boolean(DEBUG_TOKEN),
    },
  });
});

// ── Offers-Routen (für Admin-Frontend) ────────────────────────────────────────
app.use('/api/offers', offersRouter);

// ── Endpoints ─────────────────────────────────────────────────────────────────
// 1) Register/Update device
app.post('/api/push/register', async (req, res, next) => {
  try {
    const { deviceId, platform = 'android', expoToken, fcmToken } = req.body || {};
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceId required (string)' });
    }

    const update = {
      platform: ['android', 'ios', 'web'].includes(platform) ? platform : 'unknown',
      lastSeenAt: new Date(),
      invalid: false,
    };
    if (expoToken) update.expoPushToken = String(expoToken);
    if (fcmToken) update.fcmToken = String(fcmToken);

    const dev = await Device.findOneAndUpdate(
      { deviceId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.log.info(
      {
        deviceId,
        hasExpoToken: Boolean(dev.expoPushToken),
        hasFcmToken: Boolean(dev.fcmToken),
      },
      '[register] upsert ok'
    );

    return res.json({
      ok: true,
      device: {
        deviceId: dev.deviceId,
        platform: dev.platform,
        hasExpoToken: Boolean(dev.expoPushToken),
        hasFcmToken: Boolean(dev.fcmToken),
      },
    });
  } catch (err) {
    return next(err);
  }
});

// 2) Heartbeat ingest + Offer-Matching + Push (FCM bevorzugt, Expo Fallback)
app.post('/api/location/heartbeat', async (req, res, next) => {
  try {
    const { deviceId, lat, lng, accuracy, ts, battery, powerState, interests } = req.body || {};

    const nlat = Number(lat);
    const nlng = Number(lng);
    const nacc = accuracy != null ? Number(accuracy) : undefined;

    let interestList = null;
    if (Array.isArray(interests)) {
      interestList = interests
        .map((v) => (typeof v === 'string' ? v : String(v)))
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0);
      if (interestList.length === 0) interestList = null;
    } else if (typeof interests === 'string' && interests.trim() !== '') {
      interestList = interests
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0);
      if (interestList.length === 0) interestList = null;
    }

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceId required (string)' });
    }
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
      return res.status(400).json({ ok: false, error: 'lat/lng required (number)' });
    }

    const now = new Date();
    const hb = await Heartbeat.create({
      deviceId,
      lat: nlat,
      lng: nlng,
      accuracy: Number.isFinite(nacc) ? nacc : undefined,
      ts: ts ? new Date(ts) : now,
      serverReceivedAt: now,
      battery: battery && typeof battery === 'object' ? battery : undefined,
      powerState: powerState ? String(powerState) : undefined,
      interests: interestList && interestList.length > 0 ? interestList : undefined,
    });

    await Device.findOneAndUpdate(
      { deviceId },
      { $set: { lastSeenAt: now, invalid: false } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    let offers = [];
    try {
      const point = { type: 'Point', coordinates: [nlng, nlat] };

      const query = {
        active: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
      };

      if (interestList && interestList.length > 0) {
        query.category = { $in: interestList };
      }

      // GeoNear liefert Distanz in Metern -> danach radiusMeters pro Offer berücksichtigen
      const raw = await Offer.aggregate([
        {
          $geoNear: {
            near: point,
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: OFFER_MAX_DISTANCE_METERS,
            query,
          },
        },
        { $limit: 20 },
      ]).exec();

      offers = (raw || [])
        .filter((o) => {
          const d = typeof o.distanceMeters === 'number' ? o.distanceMeters : null;
          const r = Number(o.radiusMeters);
          const allowed = Number.isFinite(r) && r > 0 ? Math.min(r, OFFER_MAX_DISTANCE_METERS) : OFFER_MAX_DISTANCE_METERS;
          if (d == null) return true;
          return d <= allowed;
        })
        .slice(0, 10);
    } catch (matchErr) {
      req.log.warn({ deviceId, err: matchErr }, '[hb] offer match failed');
    }

    req.log.info(
      {
        deviceId,
        id: hb._id,
        offers: offers.length,
        hasInterests: Boolean(interestList && interestList.length > 0),
        interests: interestList,
      },
      '[hb] stored'
    );

    if (offers.length > 0) {
      (async () => {
        try {
          const dev = await Device.findOne({ deviceId }).lean();
          if (!dev) {
            req.log.info({ deviceId }, '[hb] no device doc, skip push');
            return;
          }

          const primary = offers[0];
          const primaryOfferId = primary && primary._id ? primary._id.toString() : null;
          if (!primaryOfferId) return;

          // 0) Global Cooldown: schützt vor “offer carousel spamming”
          const cooldownCheck = await shouldCooldownPushOkGlobal({ deviceId });
          if (cooldownCheck.cooldown) {
            req.log.info(
              { deviceId, cooldownHit: true, cooldownSec: PUSH_GLOBAL_COOLDOWN_SECONDS, last: cooldownCheck.last },
              '[hb] push cooldown (global)'
            );
            return;
          }

          // 1) Dedupe pro primary offerId: nur erfolgreiche Pushes dedupen
          const dedupeCheck = await shouldDedupePushOkByOffer({ deviceId, offerId: primaryOfferId });
          if (dedupeCheck.dedupe) {
            req.log.info(
              { deviceId, dedupeHit: true, primaryOfferId, last: dedupeCheck.last, windowMin: PUSH_DEDUPE_MINUTES },
              '[hb] push deduped (per-offer)'
            );
            return;
          }

          const allOfferIds = offers.map((o) => o._id.toString()).join(',');
          const dataPayload = { deviceId, offerId: primaryOfferId, offerIds: allOfferIds, source: 'heartbeat' };

          let pushResult = null;
          let via = null;

          if (dev.fcmToken && fcmReady) {
            pushResult = await sendFcmPush({
              deviceId,
              fcmToken: dev.fcmToken,
              title: primary.title || 'ULTREIA Angebot',
              body: primary.body || 'Neues Angebot in deiner Nähe.',
              data: dataPayload,
            });
            via = 'fcm';
          } else if (dev.expoPushToken) {
            pushResult = await sendExpoPush({
              expoPushToken: dev.expoPushToken,
              title: primary.title || 'ULTREIA Angebot',
              body: primary.body || 'Neues Angebot in deiner Nähe.',
              data: dataPayload,
            });
            via = 'expo';
          } else {
            req.log.info({ deviceId }, '[hb] no push token on device, skip push');
            return;
          }

          const pushOk = Boolean(pushResult && pushResult.ok);

          // PushEvent IMMER schreiben (auch Fehler), aber Dedupe greift nur bei pushOk=true
          try {
            await PushEvent.create({
              deviceId,
              offerId: primaryOfferId,
              offerIds: allOfferIds,
              via: via || 'none',
              source: 'heartbeat',
              pushOk,
              errorCode: pushOk ? null : String(pushResult && pushResult.code ? pushResult.code : ''),
              errorMessage: pushOk ? null : String(pushResult && pushResult.error ? pushResult.error : ''),
              category: primary.category ? String(primary.category) : null,
              distanceMeters: typeof primary.distanceMeters === 'number' ? Math.round(primary.distanceMeters) : null,
              sentAt: new Date(),
            });
          } catch (e) {
            req.log.warn({ deviceId, e }, '[hb] failed to write PushEvent');
          }

          req.log.info(
            {
              deviceId,
              via,
              pushOk,
              offerId: primaryOfferId,
              distanceMeters: typeof primary.distanceMeters === 'number' ? Math.round(primary.distanceMeters) : null,
              category: primary.category || null,
              pushResult,
            },
            '[hb] push result'
          );
        } catch (pushErr) {
          req.log.warn({ deviceId, err: pushErr }, '[hb] push trigger failed');
        }
      })();
    }

    return res.json({
      ok: true,
      nextPollSec: HEARTBEAT_SECONDS,
      savedId: hb._id.toString(),
      offers: offers.map((o) => ({
        id: o._id.toString(),
        title: o.title,
        body: o.body,
        radiusMeters: o.radiusMeters,
        validFrom: o.validFrom,
        validUntil: o.validUntil,
        category: o.category || null,
        distanceMeters: typeof o.distanceMeters === 'number' ? Math.round(o.distanceMeters) : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

// 3) Simple success metric
app.get('/api/metrics/heartbeat', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;
    const minutes = Math.max(1, Math.min(1440, Number(req.query.minutes) || 15));
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const match = deviceId ? { deviceId, ts: { $gte: since } } : { ts: { $gte: since } };
    const count = await Heartbeat.countDocuments(match);

    const expected = Math.max(1, Math.floor((minutes * 60) / HEARTBEAT_SECONDS));
    const successRate = Math.min(1, count / expected);

    const last = await Heartbeat.find(deviceId ? { deviceId } : {})
      .sort({ ts: -1 })
      .limit(5)
      .select({ deviceId: 1, ts: 1, serverReceivedAt: 1, _id: 0 });

    return res.json({
      ok: true,
      windowMinutes: minutes,
      heartbeatSeconds: HEARTBEAT_SECONDS,
      deviceScoped: Boolean(deviceId),
      observed: count,
      expected,
      successRate,
      last,
    });
  } catch (err) {
    return next(err);
  }
});

// 4) Debug: Seed Offer near given coords (App expects /api/debug/seed-offer)
app.post('/api/debug/seed-offer', async (req, res, next) => {
  try {
    const { deviceId, lat, lng, category, radiusMeters, validMinutes, title, body } = req.body || {};

    if (!requireDebug(req, res, deviceId)) return;

    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceId required (string)' });
    }
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
      return res.status(400).json({ ok: false, error: 'lat/lng required (number)' });
    }

    const now = new Date();
    const rM = clampNumber(radiusMeters, 25, OFFER_MAX_DISTANCE_METERS, Math.min(200, OFFER_MAX_DISTANCE_METERS));
    const vMin = clampNumber(validMinutes, 1, 24 * 60, 30);
    const cat = String(category || 'restaurant').trim().toLowerCase() || 'restaurant';

    const offerDoc = {
      active: true,
      title: String(title || `Debug Offer (${cat})`).slice(0, 120),
      body: String(body || `Debug-Offer für ${deviceId}`).slice(0, 500),
      category: cat,
      radiusMeters: rM,
      validFrom: new Date(now.getTime() - 60 * 1000),
      validUntil: new Date(now.getTime() + vMin * 60 * 1000),
      // Standard: GeoJSON Point [lng, lat]
      location: { type: 'Point', coordinates: [nlng, nlat] },
      debug: {
        seededBy: deviceId,
        seededAt: now,
      },
    };

    const created = await Offer.create(offerDoc);

    req.log.info(
      { deviceId, offerId: created._id.toString(), category: cat, radiusMeters: rM, validMinutes: vMin },
      '[debug] seeded offer'
    );

    return res.json({
      ok: true,
      offer: {
        id: created._id.toString(),
        title: created.title,
        category: created.category,
        radiusMeters: created.radiusMeters,
        validFrom: created.validFrom,
        validUntil: created.validUntil,
        location: created.location,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// 5) Debug: Push via Expo (App expects /api/debug/push-expo)
app.post('/api/debug/push-expo', async (req, res, next) => {
  try {
    const { deviceId, title, body, data } = req.body || {};
    if (!requireDebug(req, res, deviceId)) return;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceId required (string)' });
    }

    const dev = await Device.findOne({ deviceId }).lean();
    if (!dev) return res.status(404).json({ ok: false, error: 'device not found' });
    if (!dev.expoPushToken) return res.status(400).json({ ok: false, error: 'device has no expoPushToken' });

    const pushResult = await sendExpoPush({
      expoPushToken: dev.expoPushToken,
      title: title || 'ULTREIA Debug (Expo)',
      body: body || `Test Push via Expo @ ${new Date().toLocaleTimeString()}`,
      data: {
        ...(data && typeof data === 'object' ? data : {}),
        kind: 'debug-expo',
        deviceId,
        ts: new Date().toISOString(),
      },
    });

    let receipts = null;
    if (pushResult && pushResult.ticket && pushResult.ticket.id) {
      const ticketId = pushResult.ticket.id;
      const receiptResult = await getExpoReceipts([ticketId]);
      receipts = { ticketId, raw: receiptResult.body };

      try {
        const r = receiptResult.body && receiptResult.body.data ? receiptResult.body.data[ticketId] : null;
        if (r && r.status === 'error' && r.details && r.details.error === 'DeviceNotRegistered') {
          await Device.updateOne({ deviceId }, { $set: { invalid: true, expoPushToken: null } });
          logger.warn(
            { deviceId, ticketId },
            '[push-expo] DeviceNotRegistered – marked device invalid & cleared expoPushToken'
          );
        }
      } catch (markErr) {
        logger.warn({ deviceId, markErr }, '[push-expo] failed to mark device invalid');
      }
    }

    return res.json({ ok: true, deviceId, pushResult, receipts });
  } catch (err) {
    return next(err);
  }
});

// 6) Debug: Push via FCM (App expects /api/debug/push-fcm)
app.post('/api/debug/push-fcm', async (req, res, next) => {
  try {
    const { deviceId, title, body, data } = req.body || {};
    if (!requireDebug(req, res, deviceId)) return;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ ok: false, error: 'deviceId required (string)' });
    }

    const dev = await Device.findOne({ deviceId }).lean();
    if (!dev) return res.status(404).json({ ok: false, error: 'device not found' });
    if (!dev.fcmToken) return res.status(400).json({ ok: false, error: 'device has no fcmToken' });

    const pushResult = await sendFcmPush({
      deviceId,
      fcmToken: dev.fcmToken,
      title: title || 'ULTREIA Debug (FCM)',
      body: body || `Test Push via FCM @ ${new Date().toLocaleTimeString()}`,
      data: {
        ...(data && typeof data === 'object' ? data : {}),
        kind: 'debug-fcm',
        deviceId,
        ts: new Date().toISOString(),
      },
    });

    return res.json({ ok: true, deviceId, pushResult });
  } catch (err) {
    return next(err);
  }
});

// Backward compatible debug endpoints (optional, keep existing ones)
// 7) Debug-Endpoint: Expo-Push + unmittelbare Receipts (sofort)
app.post('/api/debug/push/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    if (!requireDebug(req, res, deviceId)) return;

    const dev = await Device.findOne({ deviceId }).lean();

    if (!dev) {
      return res.status(404).json({ ok: false, error: 'device not found' });
    }
    if (!dev.expoPushToken) {
      return res.status(400).json({ ok: false, error: 'device has no expoPushToken' });
    }

    const title = (req.body && req.body.title) || 'ULTREIA Debug (Expo)';
    const bodyText = (req.body && req.body.body) || 'Debug-Push vom Backend (Expo)';

    const pushResult = await sendExpoPush({
      expoPushToken: dev.expoPushToken,
      title,
      body: bodyText,
      data: { source: 'debug-endpoint-expo', deviceId },
    });

    let receipts = null;
    if (pushResult && pushResult.ticket && pushResult.ticket.id) {
      const ticketId = pushResult.ticket.id;
      const receiptResult = await getExpoReceipts([ticketId]);
      receipts = { ticketId, raw: receiptResult.body };

      try {
        const data = receiptResult.body && receiptResult.body.data;
        const r = data && data[ticketId];
        if (r && r.status === 'error' && r.details && r.details.error === 'DeviceNotRegistered') {
          await Device.updateOne({ deviceId }, { $set: { invalid: true, expoPushToken: null } });
          logger.warn(
            { deviceId, ticketId },
            '[push-expo] DeviceNotRegistered – marked device invalid & cleared expoPushToken'
          );
        }
      } catch (markErr) {
        logger.warn({ deviceId, markErr }, '[push-expo] failed to mark device invalid');
      }
    }

    return res.json({
      ok: true,
      deviceId,
      expoPushToken: dev.expoPushToken,
      pushResult,
      receipts,
    });
  } catch (err) {
    return next(err);
  }
});

// 8) Neuer Endpoint: Receipts später nachfragen (Expo)
app.get('/api/debug/receipts/:ticketId', async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    if (!ticketId) {
      return res.status(400).json({ ok: false, error: 'ticketId required' });
    }

    const receiptsResult = await getExpoReceipts([ticketId]);

    return res.json({
      ok: true,
      ticketId,
      receiptsResult,
    });
  } catch (err) {
    return next(err);
  }
});

// 9) Neuer Endpoint: Direkter FCM-Debug-Push (legacy)
app.post('/api/debug/push-fcm/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    if (!requireDebug(req, res, deviceId)) return;

    const dev = await Device.findOne({ deviceId }).lean();

    if (!dev) {
      return res.status(404).json({ ok: false, error: 'device not found' });
    }
    if (!dev.fcmToken) {
      return res.status(400).json({ ok: false, error: 'device has no fcmToken' });
    }

    const title = (req.body && req.body.title) || 'ULTREIA Debug (FCM)';
    const bodyText = (req.body && req.body.body) || 'Debug-Push vom Backend (FCM)';

    const dataPayload = { source: 'debug-endpoint-fcm', deviceId };

    const pushResult = await sendFcmPush({
      deviceId,
      fcmToken: dev.fcmToken,
      title,
      body: bodyText,
      data: dataPayload,
    });

    return res.json({
      ok: true,
      deviceId,
      fcmToken: dev.fcmToken,
      pushResult,
    });
  } catch (err) {
    return next(err);
  }
});

// Root & Errors ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ ok: true, message: 'ULTREIA backend ready. See /api/health' });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  req.log?.error({ err }, 'Unhandled error');
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

// Start / Shutdown ─────────────────────────────────────────────────────────────
let httpServer;

function maskMongoUri(uri) {
  try {
    return uri.replace(/\/\/([^@]+)@/, '//***:***@');
  } catch (e) {
    return uri;
  }
}

async function start() {
  try {
    logger.info({ uri: maskMongoUri(MONGODB_URI) }, 'Connecting MongoDB…');
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected');

    httpServer = app.listen(PORT, () => {
      logger.info({ port: PORT, env: NODE_ENV }, 'Server listening');
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal) {
  try {
    logger.warn({ signal }, 'Shutting down…');
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      logger.info('HTTP server closed');
    }
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Shutdown error');
    process.exit(1);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
