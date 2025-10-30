// C:/Ultreia/backend/src/server.js
// ULTREIA Backend – Heartbeat-MVP (JS-only)
// Adds MVP endpoints: /api/push/register, /api/location/heartbeat, /api/metrics/heartbeat

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');
const crypto = require('crypto');

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ultreia';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const HEARTBEAT_SECONDS = Number(process.env.HEARTBEAT_SECONDS || 60);

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: { service: 'ultreia-backend' },
  redact: ['req.headers.authorization'],
});

// ── App Setup ──────────────────────────────────────────────────────────────────
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

// ── Minimal Models (inline for MVP speed) ──────────────────────────────────────
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
    ts: { type: Date, default: () => new Date() }, // device timestamp (optional)
    serverReceivedAt: { type: Date, default: () => new Date(), index: true },
    powerState: { type: String }, // 'unplugged' | 'charging' | ...
    battery: {
      level: { type: Number, min: 0, max: 1 },
      charging: { type: Boolean },
    },
    // TTL cleanup after 30 days:
    expireAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
  },
  { timestamps: true }
);

heartbeatSchema.index({ deviceId: 1, ts: -1 });
heartbeatSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
const Heartbeat = mongoose.models.Heartbeat || mongoose.model('Heartbeat', heartbeatSchema);

// ── Health ─────────────────────────────────────────────────────────────────────
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
  });
});

// ── MVP Endpoints ──────────────────────────────────────────────────────────────
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

    req.log.info({ deviceId }, '[register] upsert ok');
    return res.json({ ok: true, device: { deviceId: dev.deviceId, platform: dev.platform } });
  } catch (err) {
    return next(err);
  }
});

// 2) Heartbeat ingest
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

    // Upsert/refresh device lastSeenAt as part of HB
    await Device.findOneAndUpdate(
      { deviceId },
      { $set: { lastSeenAt: now, invalid: false } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    req.log.info({ deviceId, id: hb._id }, '[hb] stored');
    return res.json({
      ok: true,
      nextPollSec: HEARTBEAT_SECONDS,
      savedId: hb._id.toString(),
    });
  } catch (err) {
    return next(err);
  }
});

// 3) Simple success metric (how reliable are HBs in the last X minutes?)
app.get('/api/metrics/heartbeat', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : null;
    const minutes = Math.max(1, Math.min(1440, Number(req.query.minutes) || 15));
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const match = deviceId ? { deviceId, ts: { $gte: since } } : { ts: { $gte: since } };
    const count = await Heartbeat.countDocuments(match);

    // expected if every HEARTBEAT_SECONDS
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
      successRate, // 0..1
      last,
    });
  } catch (err) {
    return next(err);
  }
});

// ── Root & Errors ──────────────────────────────────────────────────────────────
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

// ── Start / Shutdown ───────────────────────────────────────────────────────────
let httpServer;

async function start() {
  try {
    logger.info({ uri: MONGODB_URI }, 'Connecting MongoDB…');
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
