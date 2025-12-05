// C:/ultreia/backend/src/routes/offers.js
// ULTREIA – Offer CRUD Routes (für Admin-Frontend)

const express = require('express');
const mongoose = require('mongoose');
const Offer = require('../models/Offer');

const router = express.Router();

/**
 * Hilfsfunktionen
 */

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

// DTO-Mapper: DB → API-Response
function mapOffer(o) {
  const coords = Array.isArray(o.location?.coordinates)
    ? o.location.coordinates
    : [undefined, undefined];

  const lng = coords[0];
  const lat = coords[1];

  return {
    id: o._id.toString(),
    title: o.title,
    body: o.body || '',
    category: o.category || 'other',
    lat,
    lng,
    radiusMeters: o.radiusMeters,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
    active: o.active,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * GET /api/offers
 * Optional Query-Parameter:
 *  - active: true/false
 *  - category: string
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};

    const active = toBoolean(req.query.active, undefined);
    if (typeof active === 'boolean') {
      filter.active = active;
    }

    if (typeof req.query.category === 'string' && req.query.category.trim() !== '') {
      filter.category = req.query.category.trim().toLowerCase();
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({
      ok: true,
      count: offers.length,
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
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      body,
      category,
      lat,
      lng,
      radiusMeters,
      validFrom,
      validUntil,
      active,
    } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ ok: false, error: 'title (string) required' });
    }

    const nlat = toNumber(lat);
    const nlng = toNumber(lng);
    if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
      return res.status(400).json({ ok: false, error: 'lat/lng (number) required' });
    }

    const nRadius = toNumber(radiusMeters, 200);
    if (!Number.isFinite(nRadius) || nRadius <= 0) {
      return res.status(400).json({ ok: false, error: 'radiusMeters must be > 0' });
    }

    let vFrom = validFrom ? new Date(validFrom) : new Date();
    if (Number.isNaN(vFrom.getTime())) {
      vFrom = new Date();
    }

    if (!validUntil) {
      return res.status(400).json({ ok: false, error: 'validUntil (ISO date) required' });
    }
    let vUntil = new Date(validUntil);
    if (Number.isNaN(vUntil.getTime())) {
      return res
        .status(400)
        .json({ ok: false, error: 'validUntil must be a valid ISO date' });
    }

    const isActive = typeof active === 'boolean' ? active : true;

    const doc = await Offer.create({
      title: title.trim(),
      body: typeof body === 'string' ? body.trim() : undefined,
      category: typeof category === 'string' ? category.trim().toLowerCase() : 'other',
      location: {
        type: 'Point',
        coordinates: [nlng, nlat],
      },
      radiusMeters: nRadius,
      validFrom: vFrom,
      validUntil: vUntil,
      active: isActive,
    });

    return res.status(201).json({
      ok: true,
      offer: mapOffer(doc),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/offers/:id
 * Gleiche Felder wie POST, alle optional außer id.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }

    const {
      title,
      body,
      category,
      lat,
      lng,
      radiusMeters,
      validFrom,
      validUntil,
      active,
    } = req.body || {};

    const update = {};

    if (title !== undefined) {
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ ok: false, error: 'title must be non-empty string' });
      }
      update.title = title.trim();
    }

    if (body !== undefined) {
      if (body === null || body === '') {
        update.body = undefined;
      } else if (typeof body === 'string') {
        update.body = body.trim();
      }
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim() === '') {
        update.category = 'other';
      } else {
        update.category = category.trim().toLowerCase();
      }
    }

    const nlat = toNumber(lat, null);
    const nlng = toNumber(lng, null);
    if (nlat !== null || nlng !== null) {
      if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) {
        return res.status(400).json({ ok: false, error: 'lat/lng must be numbers' });
      }
      update.location = {
        type: 'Point',
        coordinates: [nlng, nlat],
      };
    }

    const nRadius = toNumber(radiusMeters, null);
    if (nRadius !== null) {
      if (!Number.isFinite(nRadius) || nRadius <= 0) {
        return res.status(400).json({ ok: false, error: 'radiusMeters must be > 0' });
      }
      update.radiusMeters = nRadius;
    }

    if (validFrom !== undefined) {
      if (!validFrom) {
        update.validFrom = new Date();
      } else {
        const vFrom = new Date(validFrom);
        if (Number.isNaN(vFrom.getTime())) {
          return res
            .status(400)
            .json({ ok: false, error: 'validFrom must be a valid ISO date' });
        }
        update.validFrom = vFrom;
      }
    }

    if (validUntil !== undefined) {
      if (!validUntil) {
        return res
          .status(400)
          .json({ ok: false, error: 'validUntil must be a valid ISO date' });
      }
      const vUntil = new Date(validUntil);
      if (Number.isNaN(vUntil.getTime())) {
        return res
          .status(400)
          .json({ ok: false, error: 'validUntil must be a valid ISO date' });
      }
      update.validUntil = vUntil;
    }

    if (active !== undefined) {
      const isActive = toBoolean(active, null);
      if (isActive === null) {
        return res
          .status(400)
          .json({ ok: false, error: 'active must be boolean or "true"/"false"' });
      }
      update.active = isActive;
    }

    const doc = await Offer.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) {
      return res.status(404).json({ ok: false, error: 'offer not found' });
    }

    return res.json({
      ok: true,
      offer: mapOffer(doc),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/offers/:id
 * (MVP: hard delete – später evtl. soft delete / archive)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: 'invalid id' });
    }

    const result = await Offer.findByIdAndDelete(id).lean();
    if (!result) {
      return res.status(404).json({ ok: false, error: 'offer not found' });
    }

    return res.json({
      ok: true,
      deletedId: id,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
