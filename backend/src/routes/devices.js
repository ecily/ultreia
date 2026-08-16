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

export function createDeviceRouter(config, databaseService) {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const now = new Date();
      const fields = deviceFields(req.body || {});
      await db.collection('devices').updateOne(
        { deviceId },
        { $set: { ...fields, lastSeenAt: now }, $setOnInsert: { createdAt: now } },
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
