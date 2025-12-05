// C:/ultreia/backend/src/models/Offer.js
// ULTREIA – Offer Model (mit Kategorie, aber noch ohne Heartbeat-Filterung)

const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String },

    // Kategorie des Offers, z. B.:
    // 'albergue', 'hostel', 'restaurant', 'bar', 'supermarket', 'pharmacy', 'water', 'help', ...
    // Vorerst als freies String-Feld, später können wir ein Enum daraus machen.
    category: {
      type: String,
      default: 'other',
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },

    radiusMeters: { type: Number, default: 200 },

    validFrom: { type: Date, default: () => new Date() },
    validUntil: { type: Date, required: true },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Geo-Index für $near-Queries
offerSchema.index({ location: '2dsphere' });
// Aktiv + Zeitraum
offerSchema.index({ active: 1, validFrom: 1, validUntil: 1 });
// Kategorie + aktiv (für spätere Kategorie-Filter)
offerSchema.index({ category: 1, active: 1 });

const Offer =
  mongoose.models.Offer || mongoose.model('Offer', offerSchema);

module.exports = Offer;
