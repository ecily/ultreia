import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { badRequest, databaseRequired, readLimit, readString } from '../lib/validation.js';
import { scopeFromRequest } from '../lib/scope.js';

function tripId(value) { if (!ObjectId.isValid(value)) throw new Error('tripId is invalid'); return new ObjectId(value); }
function scopeOrError(req, res, config) { const result = scopeFromRequest(req, config); if (!result.ok) { res.status(403).json({ ok: false, status: result.status }); return null; } return result.scope; }
function handleError(res, error) { if (error.code === 'trip_already_exists') return res.status(409).json({ ok: false, status: 'trip_already_exists' }); if (error.message.includes('invalid') || error.message.includes('required')) return badRequest(res, error); return res.status(404).json({ ok: false, status: 'trip_not_found_or_invalid_transition' }); }

export function createTripRouter(config, databaseService, tripService, authMiddleware) {
  const router = Router();
  router.use(authMiddleware.requireAuth);
  router.post('/', async (req, res) => { try { const db = databaseRequired(res, databaseService); if (!db) return; const scope = scopeOrError(req, res, config); if (!scope) return; const trip = await tripService.create(req.user._id, scope, { routeContext: req.body?.routeContext }); return res.status(201).json({ ok: true, trip }); } catch (error) { return handleError(res, error); } });
  router.get('/current', async (req, res) => { const scope = scopeOrError(req, res, config); if (!scope) return; const trip = await tripService.current(req.user._id, scope); return res.json({ ok: true, trip }); });
  router.get('/', async (req, res) => { try { const scope = scopeOrError(req, res, config); if (!scope) return; return res.json({ ok: true, trips: await tripService.list(req.user._id, scope, readLimit(req.query.limit, 50, 100)) }); } catch (error) { return handleError(res, error); } });
  for (const [path, method] of [['/:tripId/pause', 'pause'], ['/:tripId/resume', 'resume'], ['/:tripId/complete', 'complete']]) router.post(path, async (req, res) => { try { const scope = scopeOrError(req, res, config); if (!scope) return; const trip = await tripService[method](req.user._id, scope, tripId(req.params.tripId)); return res.json({ ok: true, trip }); } catch (error) { return handleError(res, error); } });
  return router;
}
