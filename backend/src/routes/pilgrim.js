import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { badRequest, databaseRequired, readString } from '../lib/validation.js';

function errorResponse(res, error) { if (['need_not_available', 'urgency_invalid', 'trip_required'].includes(error.message)) return badRequest(res, error); return res.status(500).json({ ok: false, status: 'pilgrim_request_failed' }); }
export function createPilgrimRouter(databaseService, authMiddleware, tripService, pilgrimNeedService, matchingService) {
  const router = Router(); router.use(authMiddleware.requireAuth, authMiddleware.requireRole('pilgrim'), (req, res, next) => { const requested = req.get('x-ultreia-scope'); if (requested && requested !== req.session.scope) return res.status(403).json({ ok: false, status: 'scope_mismatch' }); return next(); });
  router.get('/needs', async (req, res) => { const db = databaseRequired(res, databaseService); if (!db) return; const trip = await tripService.current(req.user._id, req.session.scope); return res.json({ ok: true, trip, items: trip ? await pilgrimNeedService.list(req.user._id, new ObjectId(trip.id), req.session.scope) : [] }); });
  router.put('/needs/:key', async (req, res) => { try { const db = databaseRequired(res, databaseService); if (!db) return; const trip = await tripService.current(req.user._id, req.session.scope); if (!trip) throw new Error('trip_required'); const item = await pilgrimNeedService.set(req.user._id, new ObjectId(trip.id), req.session.scope, readString(req.params.key, { name: 'needKey', min: 1, max: 80, required: true }), req.body || {}); return res.json({ ok: true, status: 'saved', item }); } catch (error) { return errorResponse(res, error); } });
  router.post('/matches/current', async (req, res) => { const db = databaseRequired(res, databaseService); if (!db) return; const result = await matchingService.matchPilgrimContext(req.user._id, req.session.scope); const matches = req.session.scope === 'local_test' ? result.matches : result.matches.map(({ reason, ...match }) => match); return res.json({ ok: true, status: result.status, matches, diagnostics: req.session.scope === 'local_test' ? matches.map((match) => match.reason) : undefined }); });
  return router;
}
