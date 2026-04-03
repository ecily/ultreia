import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inLat = (lat) => isFiniteNum(lat) && lat >= -90 && lat <= 90;
const inLng = (lng) => isFiniteNum(lng) && lng >= -180 && lng <= 180;

const OfferSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },

    // New reference schema (v2)
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', default: null, index: true },

    // Legacy fields kept for compatibility during migration
    category: { type: String, required: true },
    subcategory: { type: String, default: null },

    name: { type: String, required: true },
    description: { type: String, maxlength: 250, default: null },
    radius: { type: Number, default: 100, min: 1 },
    interestsRequired: { type: [String], default: undefined },
    validDays: { type: [Schema.Types.Mixed], default: undefined },
    weekdays: { type: [Schema.Types.Mixed], default: undefined, select: false },
    validTimes: {
      from: { type: String, default: null },
      to: { type: String, default: null },
    },
    validDates: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    contact: { type: String, default: null },
    images: { type: [String], default: undefined },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v) => {
            if (!Array.isArray(v) || v.length !== 2) return false;
            const [lng, lat] = v.map(Number);
            return inLng(lng) && inLat(lat);
          },
          message: 'location.coordinates must be [lng, lat] within valid ranges',
        },
      },
    },
    languages: { type: [String], default: undefined },
    foundCounter: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'offers',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

OfferSchema.virtual('radiusMeters')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

OfferSchema.virtual('radiusM')
  .get(function () { return this.radius; })
  .set(function (v) { this.radius = Number(v); });

OfferSchema.index({ location: '2dsphere' }, { name: 'location_2dsphere' });
OfferSchema.index({ updatedAt: -1 }, { name: 'offer_updatedAt_desc' });
OfferSchema.index({ provider: 1, updatedAt: -1 }, { name: 'provider_updatedAt' });
OfferSchema.index({ 'validDates.from': 1, 'validDates.to': 1 }, { name: 'validDates_range' });

OfferSchema.pre('validate', function (next) {
  if (this.location && this.location.type !== 'Point') this.location.type = 'Point';
  if (this.location && Array.isArray(this.location.coordinates)) {
    this.location.coordinates = this.location.coordinates.map((n) => Number(n));
  }
  next();
});

export default model('Offer', OfferSchema);
