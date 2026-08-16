import { Router } from 'express';
import {
  asPoint,
  badRequest,
  databaseRequired,
  readCoordinate,
  readDeviceId,
  readLimit,
  readOptionalNumber,
} from '../lib/validation.js';
import { logEvent } from '../lib/logger.js';

function readLocation(body) {
  return {
    lat: readCoordinate(body?.lat, 'lat'),
    lng: readCoordinate(body?.lng, 'lng'),
    accuracy: readOptionalNumber(body?.accuracy, 'accuracy', { min: 0, max: 100000 }),
    speed: readOptionalNumber(body?.speed, 'speed', { min: 0, max: 1000 }),
  };
}

export function createLocationRouter(config, databaseService) {
  const router = Router();

  router.post('/heartbeat', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const location = readLocation(req.body || {});
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const now = new Date();
      const point = asPoint(location.lat, location.lng);
      await Promise.all([
        db.collection('devices').updateOne(
          { deviceId },
          {
            $set: {
              lastLocation: point,
              lastLocationAccuracy: location.accuracy,
              lastLocationSpeed: location.speed,
              lastHeartbeatAt: now,
              lastSeenAt: now,
            },
            $setOnInsert: { deviceId, platform: 'android', createdAt: now },
          },
          { upsert: true },
        ),
        db.collection('locationHeartbeats').insertOne({
          deviceId,
          location: point,
          accuracy: location.accuracy,
          speed: location.speed,
          createdAt: now,
        }),
      ]);

      logEvent('info', 'location_heartbeat', { deviceId, accuracy: location.accuracy });
      return res.json({ ok: true, receivedAt: now.toISOString() });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('range')) {
        return badRequest(res, error);
      }
      logEvent('error', 'location_heartbeat_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  router.post('/geofence-enter', async (req, res) => {
    try {
      const deviceId = readDeviceId(req.body?.deviceId);
      const location = readLocation(req.body || {});
      const geofenceId = typeof req.body?.geofenceId === 'string' ? req.body.geofenceId.trim().slice(0, 128) : null;
      if (!geofenceId) throw new Error('geofenceId is required');
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const now = new Date();
      await db.collection('geofenceEvents').insertOne({
        deviceId,
        geofenceId,
        transition: 'enter',
        location: asPoint(location.lat, location.lng),
        accuracy: location.accuracy,
        receivedAt: now,
      });
      logEvent('info', 'geofence_enter', { deviceId, geofenceId });
      return res.json({ ok: true, receivedAt: now.toISOString() });
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('range')) {
        return badRequest(res, error);
      }
      logEvent('error', 'geofence_enter_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  router.get('/nearby', async (req, res) => {
    try {
      const lat = readCoordinate(req.query.lat, 'lat');
      const lng = readCoordinate(req.query.lng, 'lng');
      const radiusMeters = readOptionalNumber(req.query.radiusMeters, 'radiusMeters', { min: 1, max: 50000 }) || 1000;
      const limit = readLimit(req.query.limit, 20, 100);
      const db = databaseRequired(res, databaseService);
      if (!db) return;

      const items = await db.collection('devices').aggregate([
        {
          $geoNear: {
            near: asPoint(lat, lng),
            key: 'lastLocation',
            distanceField: 'distanceMeters',
            maxDistance: radiusMeters,
            spherical: true,
            query: { lastLocation: { $exists: true } },
          },
        },
        { $limit: limit },
        { $project: { _id: 0, deviceId: 1, distanceMeters: 1, lastHeartbeatAt: 1 } },
      ]).toArray();
      return res.json({ ok: true, count: items.length, items });
    } catch (error) {
      if (error.message.includes('invalid') || error.message.includes('range') || error.message.includes('out of range')) return badRequest(res, error);
      logEvent('error', 'location_nearby_failed', { error });
      return res.status(500).json({ ok: false, status: 'server_error' });
    }
  });

  router.get('/ping', (_req, res) => res.json({ ok: true, service: 'location' }));
  return router;
}
