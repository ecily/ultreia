// C:/ultreia/backend/src/models/Offer.js
// ULTREIA – Offer Model (kanonisch, erweiterbar)
// Priorität #1: korrekte Geo-Koordinaten (GeoJSON Point, coordinates=[lng,lat])

const mongoose = require('mongoose');

const ALLOWED_CATEGORIES = [
  'albergue',
  'hostel',
  'restaurant',
  'bar',
  'pharmacy',
  'water',
  'supermarket',
  'help',
  'other',
];

// OpeningHours (MVP): always | weekly
const openingHoursSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['always', 'weekly'], default: 'always' },
    weekly: [
      {
        dow: { type: Number, min: 0, max: 6, required: true },
        intervals: [
          {
            start: { type: String, required: true }, // "HH:mm"
            end: { type: String, required: true }, // "HH:mm" (darf über Mitternacht gehen)
          },
        ],
      },
    ],
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },

    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, default: '', trim: true, maxlength: 2000 },

    category: { type: String, required: true, enum: ALLOWED_CATEGORIES, default: 'other', index: true },

    active: { type: Boolean, default: true, index: true },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      // IMPORTANT: GeoJSON order is [lng, lat]
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (coords) {
            if (!Array.isArray(coords) || coords.length !== 2) return false;
            const lng = coords[0];
            const lat = coords[1];
            if (typeof lat !== 'number' || !Number.isFinite(lat)) return false;
            if (typeof lng !== 'number' || !Number.isFinite(lng)) return false;
            if (lat < -90 || lat > 90) return false;
            if (lng < -180 || lng > 180) return false;
            return true;
          },
          message: 'location.coordinates must be [lng,lat] with valid ranges',
        },
      },
    },

    radiusMeters: { type: Number, required: true, default: 200, min: 25, max: 2000 },

    validFrom: { type: Date, required: true, default: () => new Date() },
    validUntil: { type: Date, required: true },

    openingHours: { type: openingHoursSchema, default: () => ({ mode: 'always' }) },

    tags: { type: [String], default: undefined }, // optional, frei erweiterbar
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined }, // optional, frei erweiterbar
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Validation hooks (server-side truth)
// ─────────────────────────────────────────────────────────────────────────────
function isValidHHmm(str) {
  if (typeof str !== 'string') return false;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(str);
  return !!m;
}

offerSchema.pre('validate', function (next) {
  try {
    // validFrom <= validUntil
    if (this.validFrom && this.validUntil) {
      const vf = new Date(this.validFrom).getTime();
      const vu = new Date(this.validUntil).getTime();
      if (!Number.isFinite(vf) || !Number.isFinite(vu)) {
        return next(new Error('validFrom/validUntil must be valid dates'));
      }
      if (vf > vu) {
        return next(new Error('validFrom must be <= validUntil'));
      }
    }

    // openingHours weekly validation (only when weekly)
    if (this.openingHours && this.openingHours.mode === 'weekly') {
      const weekly = Array.isArray(this.openingHours.weekly) ? this.openingHours.weekly : [];
      for (const day of weekly) {
        if (typeof day !== 'object' || day == null) return next(new Error('openingHours.weekly invalid day entry'));
        if (typeof day.dow !== 'number' || day.dow < 0 || day.dow > 6) return next(new Error('openingHours.weekly.dow must be 0..6'));
        const intervals = Array.isArray(day.intervals) ? day.intervals : [];
        for (const it of intervals) {
          if (typeof it !== 'object' || it == null) return next(new Error('openingHours.weekly.intervals invalid entry'));
          if (!isValidHHmm(it.start) || !isValidHHmm(it.end)) {
            return next(new Error('openingHours intervals must use "HH:mm"'));
          }
        }
      }
    }

    return next();
  } catch (e) {
    return next(e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────
offerSchema.index({ location: '2dsphere' });
offerSchema.index({ active: 1, validUntil: 1 });
offerSchema.index({ category: 1, active: 1 });
offerSchema.index({ providerId: 1, updatedAt: -1 });

const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);

module.exports = { Offer, ALLOWED_CATEGORIES };
