import express from 'express';
import ClientDiagLog from '../models/ClientDiagLog.js';
import PushToken from '../models/PushToken.js';

const router = express.Router();
const READ_TOKEN = process.env.DIAG_READ_TOKEN || '';

function canRead(req) {
  if (!READ_TOKEN) return true;
  const h = req.headers['x-diag-token'] || req.headers['x-diag-read-token'];
  const q = req.query?.token;
  return String(h || q || '') === String(READ_TOKEN);
}

router.post('/log', async (req, res) => {
  try {
    const {
      deviceId,
      platform,
      appVersion,
      buildNumber,
      event,
      level,
      data,
    } = req.body || {};

    if (!event) {
      return res.status(400).json({ ok: false, error: 'event required' });
    }

    await ClientDiagLog.create({
      deviceId: deviceId || 'unknown',
      platform: platform || 'unknown',
      appVersion,
      buildNumber,
      event,
      level: level || 'info',
      data: data || {},
      receivedAt: new Date(),
    });

    console.log('[diag]', event, deviceId || 'unknown', level || 'info', JSON.stringify(data || {}));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[diag] log error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

router.get('/recent', async (req, res) => {
  try {
    if (!canRead(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const deviceId = req.query?.deviceId ? String(req.query.deviceId) : null;
    const event = req.query?.event ? String(req.query.event) : null;
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 50));
    const sinceMs = Number(req.query?.sinceMs || 0);

    const q = {};
    if (deviceId) q.deviceId = deviceId;
    if (event) q.event = event;
    if (sinceMs > 0) q.createdAt = { $gte: new Date(sinceMs) };

    const docs = await ClientDiagLog.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    console.error('[diag] recent error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

router.get('/heartbeat', async (req, res) => {
  try {
    if (!canRead(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const deviceId = req.query?.deviceId ? String(req.query.deviceId) : null;
    const token = req.query?.token ? String(req.query.token) : null;

    if (!deviceId && !token) {
      return res.status(400).json({ ok: false, error: 'deviceId or token required' });
    }

    const q = {};
    if (deviceId) q.deviceId = deviceId;
    if (token) q.token = token;

    const doc = await PushToken.findOne(q)
      .select('_id token deviceId projectId platform lastHeartbeatAt lastSeenAt lastLocation lastLocationAt lastLocationAccuracy lastLocationSpeed updatedAt createdAt')
      .sort({ lastHeartbeatAt: -1, lastSeenAt: -1, updatedAt: -1 })
      .lean();

    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    return res.json({
      ok: true,
      doc: {
        id: doc._id,
        token: doc.token ? String(doc.token).slice(0, 22) + '…' : null,
        deviceId: doc.deviceId || null,
        projectId: doc.projectId || null,
        platform: doc.platform || null,
        lastHeartbeatAt: doc.lastHeartbeatAt || null,
        lastSeenAt: doc.lastSeenAt || null,
        lastLocationAt: doc.lastLocationAt || null,
        lastLocation: doc.lastLocation || null,
        lastLocationAccuracy: doc.lastLocationAccuracy ?? null,
        lastLocationSpeed: doc.lastLocationSpeed ?? null,
        updatedAt: doc.updatedAt || null,
        createdAt: doc.createdAt || null,
      },
    });
  } catch (e) {
    console.error('[diag] heartbeat error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

router.get('/heartbeat-list', async (req, res) => {
  try {
    if (!canRead(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const limitRaw = Number(req.query?.limit || 20);
    const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 20));

    const docs = await PushToken.find({})
      .select('_id token deviceId projectId platform lastHeartbeatAt lastSeenAt lastLocationAt lastLocation updatedAt createdAt')
      .sort({ lastHeartbeatAt: -1, lastSeenAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const list = docs.map((d) => ({
      id: d._id,
      token: d.token ? String(d.token).slice(0, 22) + '…' : null,
      deviceId: d.deviceId || null,
      projectId: d.projectId || null,
      platform: d.platform || null,
      lastHeartbeatAt: d.lastHeartbeatAt || null,
      lastSeenAt: d.lastSeenAt || null,
      lastLocationAt: d.lastLocationAt || null,
      lastLocation: d.lastLocation || null,
      updatedAt: d.updatedAt || null,
      createdAt: d.createdAt || null,
    }));

    return res.json({ ok: true, count: list.length, list });
  } catch (e) {
    console.error('[diag] heartbeat-list error', e?.message || e);
    return res.status(500).json({ ok: false });
  }
});

export default router;
