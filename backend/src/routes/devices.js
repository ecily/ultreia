import { Router } from 'express';
import { badRequest, databaseRequired, readDeviceId, readString } from '../lib/validation.js';
import { logEvent } from '../lib/logger.js';

function deviceFields(body) {
  return {
    platform: readString(body.platform, { name: 'platform', max: 32 }) || 'android',
    appVersion: readString(body.appVersion, { name: 'appVersion', max: 32 }),
    buildNumber: readString(body.buildNumber, { name: 'buildNumber', max: 32 }),
  };
}

export function createDeviceRouter(config, databaseService, authMiddleware) {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const now = new Date();
      const fields = deviceFields(req.body || {});
      const binding = req.user ? { userId: req.user._id, bindingStatus: 'active' } : {};
      const existing = req.user ? await db.collection('devices').findOne({ deviceId }, { projection: { userId: 1 } }) : null;
      if (existing?.userId && String(existing.userId) !== String(req.user._id)) return res.status(409).json({ ok: false, status: 'device_bound_to_other_user' });
      await db.collection('devices').updateOne(
        { deviceId },
        { $set: { ...fields, ...binding, lastSeenAt: now }, $setOnInsert: { createdAt: now, scope: 'production' } },
        { upsert: true },
      );

      logEvent('info', 'device_registered', { deviceId, platform: fields.platform });
      return res.json({ ok: true, deviceId, registeredAt: now.toISOString() });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('too long')) {
        return badRequest(res, error);
      }
      logEvent('error', 'device_register_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  return router;
}
