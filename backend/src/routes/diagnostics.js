import { Router } from 'express';
import { badRequest, databaseRequired, readDeviceId, readString } from '../lib/validation.js';
import { logEvent } from '../lib/logger.js';

export function createDiagnosticsRouter(config, databaseService) {
  const router = Router();

  router.post('/log', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const event = readString(req.body?.event, { name: 'event', max: 80, required: true });
      const level = readString(req.body?.level, { name: 'level', max: 16 }) || 'info';
      const db = databaseRequired(res, databaseService);
      if (!db) return;
      await db.collection('diagnosticEvents').insertOne({
        deviceId,
        event,
        level,
        data: req.body?.data && typeof req.body.data === 'object' ? JSON.stringify(req.body.data).slice(0, 4000) : null,
        createdAt: new Date(),
      });
      return res.status(202).json({ ok: true });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('too long')) return badRequest(res, error);
      logEvent('error', 'diagnostic_log_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  router.get('/ping', (_req, res) => res.json({ ok: true, service: 'diagnostics' }));
  return router;
}
