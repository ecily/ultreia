import { Router } from 'express';
import { badRequest, databaseRequired, readDeviceId, readPushToken, readString } from '../lib/validation.js';
import { logEvent } from '../lib/logger.js';
import { createRateLimiter } from '../lib/rateLimit.js';
import { scopeFromRequest } from '../lib/scope.js';

function authorizedTestRequest(req, config) {
  if (!config.pushTestEnabled || !config.pushTestKey) return false;
  return req.get('x-ultreia-test-key') === config.pushTestKey;
}

async function sendExpoPush(config, token, body) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.expoAccessToken ? { authorization: `Bearer ${config.expoAccessToken}` } : {}),
    },
    body: JSON.stringify({ to: token, title: body.title, body: body.message, data: { kind: 'technical_test' }, sound: 'default' }),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => null);
  const ticket = payload?.data;
  return {
    ok: response.ok && ticket?.status === 'ok',
    status: response.status,
    payload,
    ticketStatus: ticket?.status === 'ok' ? 'erfolgreich' : ticket?.status === 'error' ? 'upstream_error' : 'unbekannt',
    ticketId: ticket?.id || null,
  };
}

async function getExpoReceipt(ticketId) {
  if (!ticketId) return 'offen';
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [ticketId] }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    const receipt = payload?.data?.[ticketId];
    if (receipt?.status === 'ok') return 'erfolgreich';
    if (receipt?.status === 'error') return 'upstream_error';
    return response.ok ? 'offen' : 'Fehlerklasse';
  } catch {
    return 'Fehlerklasse';
  }
}

export function createPushRouter(config, databaseService) {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const token = readPushToken(req.body?.token);
      const platform = readString(req.body?.platform, { name: 'platform', max: 32 }) || 'android';
      const projectId = readString(req.body?.projectId, { name: 'projectId', max: 128 });
      const scopeResult = scopeFromRequest(req, config);
      if (!scopeResult.ok) return res.status(403).json({ ok: false, status: scopeResult.status });
      if (config.expoProjectId && projectId !== config.expoProjectId) throw new Error('projectId does not match the configured Expo project');
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const now = new Date();
      await db.collection('devices').updateOne(
        { deviceId },
        { $set: { platform, lastSeenAt: now }, $setOnInsert: { deviceId, createdAt: now, scope: 'production' } },
        { upsert: true },
      );
      await db.collection('pushRegistrations').updateMany(
        { deviceId, token: { $ne: token }, enabled: true },
        { $set: { enabled: false, lastError: 'replaced' } },
      );
      await db.collection('pushRegistrations').updateOne(
        { token },
        { $set: { deviceId, platform, projectId, scope: scopeResult.scope, enabled: true, lastSeenAt: now, lastError: null }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      logEvent('info', 'push_registered', { deviceId, platform, projectId: projectId || 'unset' });
      return res.json({ ok: true, deviceId, enabled: true, registeredAt: now.toISOString() });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('too long')) return badRequest(res, error);
      logEvent('error', 'push_register_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  router.get('/status', (_req, res) => res.json({
    ok: true,
    projectConfigured: Boolean(config.expoProjectId),
    testPushEnabled: config.pushTestEnabled,
  }));

  router.post('/test', createRateLimiter({ max: 10 }), async (req, res) => {
    if (!authorizedTestRequest(req, config)) {
      return res.status(404).json({ ok: false, status: 'not_found' });
    }

    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const title = readString(req.body?.title, { name: 'title', max: 80 }) || 'Ultreia technical test';
      const message = readString(req.body?.message, { name: 'message', max: 240 }) || 'Server push is configured.';
      const scopeResult = scopeFromRequest(req, config);
      if (!scopeResult.ok) return res.status(403).json({ ok: false, status: scopeResult.status });
      const db = databaseRequired(res, databaseService);
      if (!db) return;
      const registration = await db.collection('pushRegistrations').findOne({ deviceId, enabled: true, ...(scopeResult.scope === 'production' ? { $or: [{ scope: 'production' }, { scope: { $exists: false } }] } : { scope: scopeResult.scope }) }, { projection: { token: 1 } });
      if (!registration) return res.status(404).json({ ok: false, status: 'push_registration_not_found' });

      const result = await sendExpoPush(config, registration.token, { title, message });
      if (result.payload?.data?.details?.error === 'DeviceNotRegistered') {
        await db.collection('pushRegistrations').updateOne({ token: registration.token }, { $set: { enabled: false, lastError: 'DeviceNotRegistered' } });
      }
      const receiptStatus = result.ok ? await getExpoReceipt(result.ticketId) : 'offen';
      logEvent(result.ok ? 'info' : 'warn', 'push_test_sent', { deviceId, upstreamStatus: result.status, ticketStatus: result.ticketStatus, receiptStatus, accepted: result.ok });
      return res.status(result.ok ? 200 : 502).json({ ok: result.ok, status: result.ok ? 'sent' : 'upstream_error', ticket: result.ticketStatus, receipt: receiptStatus });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('too long')) return badRequest(res, error);
      logEvent('error', 'push_test_failed', { error });
      return res.status(502).json({ ok: false, status: 'push_failed' });
    }
  });

  return router;
}
