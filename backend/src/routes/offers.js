// C:/ultreia/backend/src/routes/offers.js
// ULTREIA – Offer CRUD Routes (für Admin-Frontend / Provider-Backend)
// Fokus: robuste Geo-Validierung (Point=[lng,lat]), Radius/Zeiten, optional Provider-Ownership (wenn Offer-Schema providerId hat)

const express = require('express');
const mongoose = require('mongoose');
const Offer = require('../models/Offer');

// Provider ist optional nutzbar (nur wenn Offer-Schema providerId unterstützt)
let Provider = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('../models/Provider');
  Provider = mod && (mod.Provider || mod.default) ? (mod.Provider || mod.default) : null;
} catch (e) {
  Provider = null;
}

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNumber(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = undefined) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return fallback;
}

function normalizeCategory(input) {
  const s = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!s) return 'other';
  // sehr liberal (später Enum möglich)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return 'other';
  return s;
}

function parseDateOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function clampNumber(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

// Lat/Lng: strikte Ranges + "swapped"-Hint
function validateLatLng(nlat, nlng) {
  if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
    return { ok: false, error: 'lat/lng (number) required' };
  }

  const latOk = nlat >= -90 && nlat <= 90;
  const lngOk = nlng >= -180 && nlng <= 180;

  if (latOk && lngOk) return { ok: true };

  // swapped-hint (häufigster Fehler)
  const looksSwapped = nlng >= -90 && nlng <= 90 && (nlat < -90 || nlat > 90) && nlng >= -180 && nlng <= 180;

  if (looksSwapped) {
    return {
      ok: false,
      error: 'lat/lng out of range (possible swap). Expected lat in [-90..90], lng in [-180..180].',
      hint: { expected: 'coordinates=[lng,lat]', received: { lat: nlat, lng: nlng }, maybeSwapped: true },
    };
  }

  return {
    ok: false,
    error: 'lat/lng out of range. Expected lat in [-90..90], lng in [-180..180].',
    hint: { expected: 'coordinates=[lng,lat]', received: { lat: nlat, lng: nlng } },
  };
}

function hasProviderIdInOfferSchema() {
  try {
    return Boolean(Offer && Offer.schema && Offer.schema.path && Offer.schema.path('providerId'));
  } catch (e) {
    return false;
  }
}

async function resolveProviderFromReq(req) {
  const slug = String(req.headers['x-provider-slug'] || req.query.providerSlug || '').trim().toLowerCase();
  if (!slug) return { ok: false, error: 'x-provider-slug header required (providerSlug)' };
  if (!Provider) return { ok: false, error: 'Provider model not available on server' };

  const p = await Provider.findOne({ slug }).select({ _id: 1, slug: 1, name: 1, timezone: 1 }).lean();
  if (!p) return { ok: false, error: `provider not found for slug=${slug}` };
  return { ok: true, provider: p };
}

// DTO-Mapper: DB → API-Response
function mapOffer(o) {
  const coords = Array.isArray(o.location?.coordinates) ? o.location.coordinates : [undefined, undefined];
  const lng = coords[0];
  const lat = coords[1];

  return {
    id: o._id.toString(),
    providerId: o.providerId ? String(o.providerId) : null,
    title: o.title,
    body: o.body || '',
    category: o.category || 'other',
    lat,
    lng,
    radiusMeters: o.radiusMeters,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    active: o.active,
    openingHours: o.openingHours || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/offers
 * Optional Query-Parameter:
 *  - active: true/false
 *  - category: string
 *  - providerSlug: string (wenn Offer-Schema providerId hat)
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    const active = toBoolean(req.query.active, undefined);
    if (typeof active === 'boolean') filter.active = active;

    if (typeof req.query.category === 'string' && req.query.category.trim() !== '') {
      filter.category = normalizeCategory(req.query.category);
    }

    // Optional Provider-Filter (nur wenn Schema providerId hat)
    if (hasProviderIdInOfferSchema() && (req.query.providerSlug || req.headers['x-provider-slug'])) {
      const pr = await resolveProviderFromReq(req);
      if (!pr.ok) return res.status(400).json({ ok: false, error: pr.error });
      filter.providerId = pr.provider._id;
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({
      ok: true,
      count: offers.length,
      schema: { providerIdSupported: hasProviderIdInOfferSchema() },
      offers: offers.map(mapOffer),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/offers/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }

    const offer = await Offer.findById(id).lean();
    if (!offer) {
      return res.status(404).json({ ok: false, error: 'offer not found' });
    }

    return res.json({
      ok: true,
      schema: { providerIdSupported: hasProviderIdInOfferSchema() },
      offer: mapOffer(offer),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/offers
 * Erwartet im Body (JSON):
 *  - title: string (required)
 *  - body: string (optional)
 *  - category: string (optional, default 'other')
 *  - lat: number (required)
 *  - lng: number (required)
 *  - radiusMeters: number (optional, default 200)
 *  - validFrom: ISO-String (optional, default jetzt)
 *  - validUntil: ISO-String (required)
 *  - active: boolean (optional, default true)
 *  - openingHours: object (optional; wird erst im Matching später berücksichtigt)
 *
 * Provider-Ownership (optional, nur wenn Offer-Schema providerId hat):
 *  - Header: x-provider-slug: <slug>
 */
router.post('/', async (req, res, next) => {
  try {
    const { title, body, category, lat, lng, radiusMeters, validFrom, validUntil, active, openingHours } =
      req.body || {};

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ ok: false, error: 'title (string) required' });
    }

    const nlat = toNumber(lat);
    const nlng = toNumber(lng);

    const coordCheck = validateLatLng(nlat, nlng);
    if (!coordCheck.ok) {
      return res.status(400).json({ ok: false, error: coordCheck.error, hint: coordCheck.hint });
    }

    // Radius: MVP clamp (später pro ENV konfigurierbar)
    const nRadius = clampNumber(radiusMeters, 25, 5000, 200);
    if (!Number.isFinite(nRadius) || nRadius <= 0) {
      return res.status(400).json({ ok: false, error: 'radiusMeters must be > 0' });
    }

    const vFrom = parseDateOrNull(validFrom) || new Date();

    if (!validUntil) {
      return res.status(400).json({ ok: false, error: 'validUntil (ISO date) required' });
    }
    const vUntil = parseDateOrNull(validUntil);
    if (!vUntil) {
      return res.status(400).json({ ok: false, error: 'validUntil must be a valid ISO date' });
    }
    if (vUntil.getTime() <= vFrom.getTime()) {
      return res.status(400).json({ ok: false, error: 'validUntil must be > validFrom' });
    }

    const isActive = typeof active === 'boolean' ? active : true;

    const doc = {
      title: title.trim(),
      body: typeof body === 'string' ? body.trim() : undefined,
      category: normalizeCategory(category),
      location: { type: 'Point', coordinates: [nlng, nlat] }, // [lng,lat]
      radiusMeters: nRadius,
      validFrom: vFrom,
      validUntil: vUntil,
      active: isActive,
    };

    if (openingHours && typeof openingHours === 'object') {
      doc.openingHours = openingHours;
    }

    // Provider-Ownership nur aktivieren, wenn Offer-Schema providerId unterstützt
    if (hasProviderIdInOfferSchema()) {
      const pr = await resolveProviderFromReq(req);
      if (!pr.ok) return res.status(400).json({ ok: false, error: pr.error });
      doc.providerId = pr.provider._id;
    }

    const created = await Offer.create(doc);

    return res.status(201).json({
      ok: true,
      schema: { providerIdSupported: hasProviderIdInOfferSchema() },
      offer: mapOffer(created),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/offers/:id
 * Gleiche Felder wie POST, alle optional außer id.
 * Provider-Ownership:
 *  - wenn providerIdSupported: Updates nur mit x-provider-slug (und offer muss zu provider gehören)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }

    const { title, body, category, lat, lng, radiusMeters, validFrom, validUntil, active, openingHours } =
      req.body || {};

    const update = {};

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ ok: false, error: 'title must be non-empty string' });
      }
      update.title = title.trim();
    }

    if (body !== undefined) {
      if (body === null || body === '') update.body = undefined;
      else if (typeof body === 'string') update.body = body.trim();
      else return res.status(400).json({ ok: false, error: 'body must be string' });
    }

    if (category !== undefined) {
      update.category = normalizeCategory(category);
    }

    const nlat = toNumber(lat, null);
    const nlng = toNumber(lng, null);
    if (nlat !== null || nlng !== null) {
      const coordCheck = validateLatLng(nlat, nlng);
      if (!coordCheck.ok) {
        return res.status(400).json({ ok: false, error: coordCheck.error, hint: coordCheck.hint });
      }
      update.location = { type: 'Point', coordinates: [nlng, nlat] };
    }

    const nRadius = toNumber(radiusMeters, null);
    if (nRadius !== null) {
      const clamped = clampNumber(nRadius, 25, 5000, null);
      if (!Number.isFinite(clamped) || clamped <= 0) {
        return res.status(400).json({ ok: false, error: 'radiusMeters must be > 0' });
      }
      update.radiusMeters = clamped;
    }

    if (validFrom !== undefined) {
      const vFrom = parseDateOrNull(validFrom) || new Date();
      update.validFrom = vFrom;
    }

    if (validUntil !== undefined) {
      const vUntil = parseDateOrNull(validUntil);
      if (!vUntil) return res.status(400).json({ ok: false, error: 'validUntil must be a valid ISO date' });
      update.validUntil = vUntil;
    }

    if (openingHours !== undefined) {
      if (openingHours === null) update.openingHours = undefined;
      else if (typeof openingHours === 'object') update.openingHours = openingHours;
      else return res.status(400).json({ ok: false, error: 'openingHours must be object or null' });
    }

    if (active !== undefined) {
      const isActive = toBoolean(active, null);
      if (isActive === null) {
        return res.status(400).json({ ok: false, error: 'active must be boolean or "true"/"false"' });
      }
      update.active = isActive;
    }

    // offer holen (für validUntil>validFrom Check + optional ownership)
    const existing = await Offer.findById(id).lean();
    if (!existing) return res.status(404).json({ ok: false, error: 'offer not found' });

    // Ownership enforcement nur wenn Schema providerId unterstützt
    if (hasProviderIdInOfferSchema()) {
      const pr = await resolveProviderFromReq(req);
      if (!pr.ok) return res.status(400).json({ ok: false, error: pr.error });

      const offerProviderId = existing.providerId ? String(existing.providerId) : null;
      if (!offerProviderId || offerProviderId !== String(pr.provider._id)) {
        return res.status(403).json({ ok: false, error: 'forbidden (provider mismatch)' });
      }
    }

    const nextFrom = update.validFrom ? new Date(update.validFrom) : new Date(existing.validFrom);
    const nextUntil = update.validUntil ? new Date(update.validUntil) : new Date(existing.validUntil);
    if (nextUntil.getTime() <= nextFrom.getTime()) {
      return res.status(400).json({ ok: false, error: 'validUntil must be > validFrom' });
    }

    const doc = await Offer.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'offer not found' });

    return res.json({
      ok: true,
      schema: { providerIdSupported: hasProviderIdInOfferSchema() },
      offer: mapOffer(doc),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/offers/:id
 * MVP: soft-delete (active=false), damit Matching & Logs konsistent bleiben.
 * Provider-Ownership:
 *  - wenn providerIdSupported: nur mit x-provider-slug und offer muss zu provider gehören
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }

    const existing = await Offer.findById(id).lean();
    if (!existing) return res.status(404).json({ ok: false, error: 'offer not found' });

    if (hasProviderIdInOfferSchema()) {
      const pr = await resolveProviderFromReq(req);
      if (!pr.ok) return res.status(400).json({ ok: false, error: pr.error });

      const offerProviderId = existing.providerId ? String(existing.providerId) : null;
      if (!offerProviderId || offerProviderId !== String(pr.provider._id)) {
        return res.status(403).json({ ok: false, error: 'forbidden (provider mismatch)' });
      }
    }

    await Offer.updateOne({ _id: id }, { $set: { active: false } });

    return res.json({
      ok: true,
      deletedId: id,
      mode: 'soft',
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
