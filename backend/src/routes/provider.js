import { Router } from 'express';
import { badRequest, databaseRequired, readString } from '../lib/validation.js';
import { normalizeLocale } from '../services/taxonomyService.js';

function providerError(res, error) {
  const message = typeof error?.message === 'string' ? error.message : 'server_error';
  if (['offer_not_found', 'provider_profile_not_found'].includes(message)) return res.status(404).json({ ok: false, status: message });
  if (message === 'offer_transition_not_allowed') return res.status(409).json({ ok: false, status: message });
  if (message === 'provider_profile_incomplete') return res.status(409).json({ ok: false, status: message });
  if (message.startsWith('google_places_')) return res.status(message === 'google_places_not_configured' ? 503 : 502).json({ ok: false, status: message });
  if (message === 'location_adjustment_exceeds_25m' || message === 'google_place_invalid' || message === 'location_coordinates_invalid') return res.status(400).json({ ok: false, status: message });
  if (message.includes('required') || message.includes('invalid') || message.includes('too short') || message.includes('too long') || message.includes('unknown Need') || message.includes('availability')) return badRequest(res, { message });
  return res.status(500).json({ ok: false, status: 'server_error' });
}

function sessionScope(req) {
  const scope = req.session?.scope;
  if (!['production', 'local_test'].includes(scope)) throw new Error('scope_not_available');
  return scope;
}

export function createProviderRouter(config, databaseService, providerService, googlePlacesService, authMiddleware) {
  const router = Router();
  router.use(authMiddleware.requireAuth, authMiddleware.requireRole('provider', 'admin'));

  router.get('/profile', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, profile: await providerService.getProfile(req.user, sessionScope(req)) }); } catch (error) { return providerError(res, error); }
  });

  router.put('/profile', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, profile: await providerService.updateProfile(req.user, sessionScope(req), req.body || {}) }); } catch (error) { return providerError(res, error); }
  });

  router.post('/location/autocomplete', async (req, res) => {
    try {
      if (!googlePlacesService.configured()) return res.status(503).json({ ok: false, status: 'google_places_not_configured' });
      const db = databaseRequired(res, databaseService); if (!db) return;
      const scope = sessionScope(req);
      const input = readString(req.body?.input, { name: 'input', min: 3, max: 200, required: true });
      const location = await providerService.locationHint(req.user, scope);
      const result = await googlePlacesService.autocomplete({ input, scope, location, sessionToken: readString(req.body?.sessionToken, { name: 'sessionToken', max: 200 }), locale: normalizeLocale(req.body?.locale) });
      if (!result.ok) return res.status(502).json({ ok: false, status: result.errorClass });
      return res.json({ ok: true, suggestions: result.suggestions });
    } catch (error) { return providerError(res, error); }
  });

  router.post('/location/validate', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; sessionScope(req); const body = { ...(req.body || {}), sessionToken: readString(req.body?.sessionToken, { name: 'sessionToken', max: 200 }) }; return res.json({ ok: true, location: await providerService.validateLocation(body, normalizeLocale(req.body?.sourceLocale)) }); } catch (error) { return providerError(res, error); }
  });

  router.put('/location', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, profile: await providerService.updateLocation(req.user, sessionScope(req), req.body || {}) }); } catch (error) { return providerError(res, error); }
  });

  router.get('/offers', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, items: await providerService.listOffers(req.user, sessionScope(req)) }); } catch (error) { return providerError(res, error); }
  });

  router.post('/offers', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.status(201).json({ ok: true, offer: await providerService.writeOffer(req.user, sessionScope(req), req.body || {}) }); } catch (error) { return providerError(res, error); }
  });

  router.get('/offers/:id', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, offer: await providerService.getOffer(req.user, sessionScope(req), req.params.id) }); } catch (error) { return providerError(res, error); }
  });

  router.put('/offers/:id', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, offer: await providerService.writeOffer(req.user, sessionScope(req), req.body || {}, req.params.id) }); } catch (error) { return providerError(res, error); }
  });

  router.post('/offers/:id/pause', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, offer: await providerService.pause(req.user, sessionScope(req), req.params.id) }); } catch (error) { return providerError(res, error); }
  });

  router.post('/offers/:id/resume', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, offer: await providerService.resume(req.user, sessionScope(req), req.params.id) }); } catch (error) { return providerError(res, error); }
  });

  router.post('/offers/:id/confirm', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; return res.json({ ok: true, offer: await providerService.confirm(req.user, sessionScope(req), req.params.id) }); } catch (error) { return providerError(res, error); }
  });

  return router;
}
