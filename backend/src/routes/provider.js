import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { badRequest, databaseRequired, readString } from '../lib/validation.js';
import { normalizeLocale } from '../services/taxonomyService.js';
import { logEvent } from '../lib/logger.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function readMultipartImage(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
    if (!boundary) return reject(new Error('image_multipart_invalid'));
    const chunks = []; let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES + 128 * 1024) { req.destroy(); reject(new Error('image_too_large_or_empty')); return; }
      chunks.push(chunk);
    });
    req.on('error', () => reject(new Error('image_multipart_invalid')));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('latin1');
        const parts = raw.split(`--${boundary}`);
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd < 0 || !/name="image"/i.test(part.slice(0, headerEnd))) continue;
          const headers = part.slice(0, headerEnd);
          const body = part.slice(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
          const mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
          const filename = headers.match(/filename="([^"]*)"/i)?.[1] || 'image';
          return resolve({ buffer: Buffer.from(body, 'latin1'), mimeType, filename });
        }
        return reject(new Error('image_field_missing'));
      } catch { return reject(new Error('image_multipart_invalid')); }
    });
  });
}

function providerError(res, error) {
  const message = typeof error?.message === 'string' ? error.message : 'server_error';
  if (['offer_not_found', 'provider_profile_not_found'].includes(message)) return res.status(404).json({ ok: false, status: message });
  if (message === 'offer_transition_not_allowed') return res.status(409).json({ ok: false, status: message });
  if (message === 'provider_profile_incomplete') return res.status(409).json({ ok: false, status: message });
  if (message === 'media_provider_not_configured') return res.status(503).json({ ok: false, status: message });
  if (['image_too_large_or_empty', 'image_type_not_allowed', 'image_content_invalid', 'image_multipart_invalid', 'image_field_missing', 'images is invalid', 'images_are_managed_separately', 'images_limit_exceeded'].includes(message)) return res.status(400).json({ ok: false, status: message });
  if (['image_not_found', 'media_ownership_invalid'].includes(message)) return res.status(404).json({ ok: false, status: message });
  if (message === 'media_upload_timeout') return res.status(504).json({ ok: false, status: message });
  if (['media_upload_failed', 'media_upload_network_error', 'media_delete_failed'].includes(message)) return res.status(502).json({ ok: false, status: message });
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

export function createProviderRouter(config, databaseService, providerService, googlePlacesService, authMiddleware, mediaService = null) {
  const router = Router();
  router.use(authMiddleware.requireAuth, authMiddleware.requireRole('provider'));

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

  router.get('/maps-config', async (req, res) => {
    try { sessionScope(req); return res.json({ ok: true, configured: Boolean(config.googleMapsWebKey), key: config.googleMapsWebKey || null }); } catch (error) { return providerError(res, error); }
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

  router.post('/offers/:id/images', async (req, res) => {
    let uploaded = null;
    let scope = null;
    const correlationId = String(req.headers['x-request-id'] || randomUUID()).slice(0, 80);
    const startedAt = Date.now();
    try {
      const db = databaseRequired(res, databaseService); if (!db) return;
      scope = sessionScope(req);
      if (!mediaService?.configured) throw new Error('media_provider_not_configured');
      const offer = await providerService.getOffer(req.user, scope, req.params.id);
      logEvent('info', 'offer_image_upload_started', { correlationId, scope });
      if ((offer.images || []).length >= providerService.MAX_OFFER_IMAGES) throw new Error('images_limit_exceeded');
      const file = await readMultipartImage(req);
      uploaded = await mediaService.uploadImage({ buffer: file.buffer, mimeType: file.mimeType, scope, userId: String(req.user._id), offerId: offer.id, sortOrder: offer.images.length, correlationId });
      const updated = await providerService.addOfferImage(req.user, scope, offer.id, uploaded);
      logEvent('info', 'offer_image_persisted', { correlationId, scope, bytes: file.buffer.length, mimeType: file.mimeType, durationMs: Date.now() - startedAt });
      return res.status(201).json({ ok: true, image: uploaded, offer: updated });
    } catch (error) {
      logEvent('error', 'offer_image_upload_failed', { correlationId, scope, durationMs: Date.now() - startedAt, upstreamStatus: error?.upstreamStatus || null, errorClass: error?.message || 'unknown' });
      if (uploaded && mediaService?.destroyImage && scope) await mediaService.destroyImage({ publicId: uploaded.publicId, scope, userId: String(req.user._id), offerId: req.params.id }).catch(() => {});
      return providerError(res, error);
    }
  });

  router.delete('/offers/:id/images', async (req, res) => {
    try {
      const db = databaseRequired(res, databaseService); if (!db) return;
      const scope = sessionScope(req);
      const offer = await providerService.getOffer(req.user, scope, req.params.id);
      const publicId = readString(req.body?.publicId, { name: 'publicId', min: 3, max: 500 });
      const image = offer.images.find((item) => item.publicId === publicId);
      if (!image) throw new Error('image_not_found');
      if (!mediaService?.configured) throw new Error('media_provider_not_configured');
      await mediaService.destroyImage({ publicId, scope, userId: String(req.user._id), offerId: offer.id });
      const updated = await providerService.removeOfferImage(req.user, scope, offer.id, publicId);
      return res.json({ ok: true, offer: updated });
    } catch (error) { return providerError(res, error); }
  });

  router.post('/offers/:id/images/reorder', async (req, res) => {
    try { const db = databaseRequired(res, databaseService); if (!db) return; const updated = await providerService.reorderOfferImages(req.user, sessionScope(req), req.params.id, req.body?.publicIds); return res.json({ ok: true, offer: updated }); } catch (error) { return providerError(res, error); }
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
