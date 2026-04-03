// stepsmatch/backend/models/PushToken.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/* ───────────────────────── helpers ───────────────────────── */
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

/** Normalisiert eine beliebige Geo-Input-Form zu gültigem GeoJSON-Point oder gibt undefined zurück. */
function normalizePointStrict(v) {
  try {
    if (!v || typeof v !== 'object') return undefined;

    // { type:'Point', coordinates:[lng, lat] }
    if (v.type === 'Point' && Array.isArray(v.coordinates) && v.coordinates.length === 2) {
      const [lng, lat] = v.coordinates.map(Number);
      if (inLng(lng) && inLat(lat)) return { type: 'Point', coordinates: [lng, lat] };
      return undefined;
    }

    // Alternative Form: { lat, lng }
    if (Object.prototype.hasOwnProperty.call(v, 'lat') && Object.prototype.hasOwnProperty.call(v, 'lng')) {
      const lat = Number(v.lat);
      const lng = Number(v.lng);
      if (inLng(lng) && inLat(lat)) return { type: 'Point', coordinates: [lng, lat] };
      return undefined;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/** Entfernt/normalisiert Geo im Update-Objekt ($set / $setOnInsert). */
function sanitizeGeoInUpdate(update) {
  if (!update || typeof update !== 'object') return;
  for (const key of ['$set', '$setOnInsert']) {
    if (!update[key] || typeof update[key] !== 'object') continue;
    if ('lastLocation' in update[key]) {
      const norm = normalizePointStrict(update[key].lastLocation);
      if (norm) update[key].lastLocation = norm;
      else delete update[key].lastLocation; // ⚠️ invalid → nicht schreiben
    }
    // Konsistenz: wenn lastLocation entfernt wurde, auch lastLocationAt weglassen
    if (!('lastLocation' in (update[key] || {})) && 'lastLocationAt' in update[key]) {
      delete update[key].lastLocationAt;
    }
  }
}

/* ───────────────────────── schema ───────────────────────── */
const PushTokenSchema = new Schema(
  {
    // Expo Push Token (einzigartig pro Registrierung)
    token: { type: String, required: true, index: true, unique: true },

    // 'android' | 'ios' | etc.
    platform: { type: String, default: 'android' },

    // Zuordnung (optional)
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Stabiles Geräte-Merkmal (aus SecureStore)
    deviceId: { type: String, default: null, index: true },

    // ── NEU: Gültigkeitsflag für Self-Heal
    valid: { type: Boolean, default: true, index: true },

    // (Alt, nur für Rückwärtskompatibilität)
    disabled: { type: Boolean, default: false, index: true },

    // ── NEU: Fehler-/Retry-Metadaten
    lastError: { type: String, default: null },   // z. B. 'DeviceNotRegistered'
    lastTriedAt: { type: Date, default: null },

    // Aktivitäts-Timestamps
    lastSeenAt: { type: Date, default: Date.now, index: true },
    lastHeartbeatAt: { type: Date, default: null, index: true },

    // Letzte bekannte Location (GeoJSON: [lng, lat])
    lastLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,      // kein halbes Subdoc erzeugen
      },
      coordinates: {
        type: [Number],
        default: undefined,      // kein leeres Array persistieren
        validate: {
          validator: function (val) {
            if (val == null) return true;                 // Feld ist optional
            if (!Array.isArray(val) || val.length !== 2) return false;
            const [lng, lat] = val;
            return inLng(lng) && inLat(lat);
          },
          message: 'Invalid lastLocation coordinates; expected [lng, lat] within ranges.',
        },
      },
    },
    lastLocationAccuracy: { type: Number, default: null },
    lastLocationAt: { type: Date, default: null },
    lastLocationSpeed: { type: Number, default: null },

    // Interessen
    interests: { type: [String], default: [] },

    // Expo Project Scope
    projectId: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'pushtokens',
    strict: true,
    minimize: false,
  }
);

/* ───────────────────────── hooks ───────────────────────── */
// 1) Create/Save: normalisieren oder Feld entfernen
PushTokenSchema.pre('validate', function (next) {
  try {
    if (this.isModified('lastLocation') || this.lastLocation != null) {
      const norm = normalizePointStrict(this.lastLocation);
      if (norm) {
        this.lastLocation = norm;
      } else {
        // invalid → ganz entfernen + Attribut-Zeitstempel konsistent halten
        this.lastLocation = undefined;
        this.lastLocationAt = undefined;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
});

// 2) Updates: inkompatible GeoJSONs vor DB-Call strippen
PushTokenSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  sanitizeGeoInUpdate(update);
  this.setUpdate(update);
  next();
});
PushTokenSchema.pre('updateOne', function (next) {
  const update = this.getUpdate();
  sanitizeGeoInUpdate(update);
  this.setUpdate(update);
  next();
});
PushTokenSchema.pre('updateMany', function (next) {
  const update = this.getUpdate();
  sanitizeGeoInUpdate(update);
  this.setUpdate(update);
  next();
});

/* Indizes */
// Geo
PushTokenSchema.index({ lastLocation: '2dsphere' }, { name: 'lastLocation_2dsphere' });

// Aktivität
PushTokenSchema.index({ updatedAt: -1 }, { name: 'updatedAt_desc' });
PushTokenSchema.index({ lastHeartbeatAt: -1 }, { name: 'lastHeartbeatAt_desc' });

// Häufige Filterkombis (Self-Heal nutzt "valid:true")
PushTokenSchema.index(
  { projectId: 1, valid: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byProject_valid_recent' }
);
PushTokenSchema.index(
  { deviceId: 1, valid: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byDevice_valid_recent' }
);

// Altkompatibel für disabled
PushTokenSchema.index(
  { projectId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byProject_disabled_recent' }
);
PushTokenSchema.index(
  { deviceId: 1, disabled: 1, lastSeenAt: -1, updatedAt: -1 },
  { name: 'byDevice_disabled_recent' }
);

// Für Location-Scans
PushTokenSchema.index(
  { 'lastLocation.coordinates': 1, lastLocationAt: -1 },
  { name: 'coords_present_lastLocationAt_desc' }
);

export default model('PushToken', PushTokenSchema);
