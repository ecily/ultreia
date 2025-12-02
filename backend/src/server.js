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

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ultreia';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const HEARTBEAT_SECONDS = Number(process.env.HEARTBEAT_SECONDS || 60);
const OFFER_MAX_DISTANCE_METERS = Number(process.env.OFFER_MAX_DISTANCE_METERS || 250);

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || undefined;
// Cloud (DO / App Platform): Service-Account als JSON in Env
const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON || undefined;
// Lokal: alternativ Pfad zu JSON-Datei
const FCM_SERVICE_ACCOUNT_PATH =
  process.env.FCM_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: { service: 'ultreia-backend' },
  redact: ['req.headers.authorization'],
});

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

    req.on('error', (err) => {
      reject(err);
    });

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
    logger.info({ expoPushToken, statusCode, respBody }, '[push-expo] Expo send response');

    let ticket = null;
    if (respBody && respBody.data) {
      if (respBody.data.id) {
        ticket = respBody.data;
      }
      if (Array.isArray(respBody.data) && respBody.data.length > 0) {
        ticket = respBody.data[0];
      }
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
    const { statusCode, body } = await expoPost(EXPO_PUSH_RECEIPTS_PATH, {
      ids: ticketIds,
    });
    logger.info({ statusCode, body }, '[push-expo] Expo receipts response');
    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode,
      body,
    };
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
      // Bevorzugt in Cloud-Umgebungen (DigitalOcean App Platform)
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
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FCM_PROJECT_ID || serviceAccount.project_id,
      });
      fcmMessaging = app.messaging();
    } else {
      fcmMessaging = admin.app().messaging();
    }

    fcmReady = true;
    logger.info(
      { projectId: FCM_PROJECT_ID || serviceAccount.project_id },
      '[fcm] initialized firebase-admin'
    );
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

async function sendFcmPush({ fcmToken, title, body, data }) {
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
      if (typeof v === 'string') {
        dataPayload[String(k)] = v;
      } else {
        dataPayload[String(k)] = JSON.stringify(v);
      }
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
        channelId: 'offers', // muss zu deinem Android-Channel "offers" passen
        sound: 'default',
      },
    },
  };

  try {
    const response = await fcmMessaging.send(message);
    logger.info({ fcmToken, response }, '[fcm] send response');
    return { ok: true, messageId: response };
  } catch (err) {
    logger.warn(
      { fcmToken, err: { message: err.message, code: err.code, stack: err.stack } },
      '[fcm] send error'
    );
    return { ok: false, error: err.message || String(err), code: err.code };
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
    expireAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
  },
  { timestamps: true }
);

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    radiusMeters: { type: Number, default: 200 },
    validFrom: { type: Date, default: () => new Date() },
    validUntil: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

heartbeatSchema.index({ deviceId: 1, ts: -1 });
heartbeatSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
offerSchema.index({ location: '2dsphere' });
offerSchema.index({ active: 1, validFrom: 1, validUntil: 1 });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
const Heartbeat = mongoose.models.Heartbeat || mongoose.model('Heartbeat', heartbeatSchema);
const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);

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
  });
});

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
    const { deviceId, lat, lng, accuracy, ts, battery, powerState } = req.body || {};
    const nlat = Number(lat);
    const nlng = Number(lng);
    const nacc = accuracy != null ? Number(accuracy) : undefined;

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
    });

    await Device.findOneAndUpdate(
      { deviceId },
      { $set: { lastSeenAt: now, invalid: false } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    let offers = [];
    try {
      const point = {
        type: 'Point',
        coordinates: [nlng, nlat],
      };

      offers = await Offer.find({
        active: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        location: {
          $near: {
            $geometry: point,
            $maxDistance: OFFER_MAX_DISTANCE_METERS,
          },
        },
      })
        .limit(10)
        .lean();
    } catch (matchErr) {
      req.log.warn({ deviceId, err: matchErr }, '[hb] offer match failed');
    }

    req.log.info({ deviceId, id: hb._id, offers: offers.length }, '[hb] stored');

    if (offers.length > 0) {
      (async () => {
        try {
          const dev = await Device.findOne({ deviceId }).lean();
          if (!dev) {
            req.log.info({ deviceId }, '[hb] no device doc, skip push');
            return;
          }

          const primary = offers[0];
          const dataPayload = {
            deviceId,
            offerIds: offers.map((o) => o._id.toString()).join(','),
            source: 'heartbeat',
          };

          let pushResult = null;
          let via = null;

          if (dev.fcmToken && fcmReady) {
            pushResult = await sendFcmPush({
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

          req.log.info({ deviceId, via, pushResult }, '[hb] push triggered');
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

// 4) Debug-Endpoint: Expo-Push + unmittelbare Receipts (sofort)
app.post('/api/debug/push/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
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
      receipts = {
        ticketId,
        raw: receiptResult.body,
      };

      try {
        const data = receiptResult.body && receiptResult.body.data;
        const r = data && data[ticketId];
        if (r && r.status === 'error' && r.details && r.details.error === 'DeviceNotRegistered') {
          await Device.updateOne(
            { deviceId },
            { $set: { invalid: true, expoPushToken: null } }
          );
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

// 5) Neuer Endpoint: Receipts später nachfragen (Expo)
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

// 6) Neuer Endpoint: Direkter FCM-Debug-Push
app.post('/api/debug/push-fcm/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const dev = await Device.findOne({ deviceId }).lean();

    if (!dev) {
      return res.status(404).json({ ok: false, error: 'device not found' });
    }
    if (!dev.fcmToken) {
      return res.status(400).json({ ok: false, error: 'device has no fcmToken' });
    }

    const title = (req.body && req.body.title) || 'ULTREIA Debug (FCM)';
    const bodyText = (req.body && req.body.body) || 'Debug-Push vom Backend (FCM)';

    const dataPayload = {
      source: 'debug-endpoint-fcm',
      deviceId,
    };

    const pushResult = await sendFcmPush({
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
