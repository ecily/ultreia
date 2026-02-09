// C:/ultreia/backend/src/models/Provider.js
// ULTREIA – Provider Model (Anbieter)
// Kanonisch für Offer-Ownership + Zeitzone (Öffnungszeiten-Auswertung)

const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },

    // slug für URLs / Frontend (unique via schema.index unten)
    slug: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    // Zeitzone ist wichtig für openingHours (Default Camino)
    timezone: { type: String, required: true, default: 'Europe/Madrid', trim: true, maxlength: 64 },

    contact: {
      email: { type: String, trim: true, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 64 },
      website: { type: String, trim: true, maxlength: 512 },
    },

    // Erweiterungspunkt (z.B. Adresse, Wallet, Booking-Integration, etc.)
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

// Index/Uniqueness (einmalig, ohne Duplicate Warning)
providerSchema.index({ slug: 1 }, { unique: true });

const Provider = mongoose.models.Provider || mongoose.model('Provider', providerSchema);

module.exports = { Provider };
