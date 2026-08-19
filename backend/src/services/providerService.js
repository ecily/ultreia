import { ObjectId } from 'mongodb';
import { normalizeLocale } from './taxonomyService.js';

const PROFILE_STATUSES = new Set(['pending', 'active', 'paused', 'blocked']);
const OFFER_STATUSES = new Set(['draft', 'active', 'paused', 'expired', 'blocked']);
const PRICE_TYPES = new Set(['free', 'fixed', 'from', 'range', 'donativo', 'on_request']);
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const CURRENCIES = /^[A-Z]{3}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asId(value) { try { return new ObjectId(value); } catch { return null; } }
function clone(value) { return value == null ? value : structuredClone(value); }
function now() { return new Date(); }
function plusDays(date, days) { return new Date(date.getTime() + days * 86400000); }
function number(value) { return typeof value === 'number' ? value : Number(value); }

function publicProfile(profile) {
  if (!profile) return null;
  return {
    id: String(profile._id), userId: String(profile.userId), scope: profile.scope,
    status: profile.status, businessName: profile.businessName || '', displayName: profile.displayName || '',
    contactEmail: profile.contactEmail, phone: profile.phone || '', website: profile.website || '',
    sourceLocale: profile.sourceLocale || 'de', location: clone(profile.location || null),
    createdAt: profile.createdAt, updatedAt: profile.updatedAt, completedAt: profile.completedAt || null,
  };
}

function publicOffer(offer) {
  if (!offer) return null;
  return {
    id: String(offer._id), providerId: String(offer.providerId), scope: offer.scope, status: offer.status,
    title: offer.title, description: offer.description, sourceLocale: offer.sourceLocale,
    translations: clone(offer.translations), needKeys: offer.needKeys, price: clone(offer.price),
    availability: clone(offer.availability), openingHours: clone(offer.openingHours || offer.availability?.weekly || {}),
    availabilityExceptions: clone(offer.availabilityExceptions || offer.availability?.exceptions || []),
    radiusMeters: offer.radiusMeters, images: clone(offer.images || []),
    lastConfirmedAt: offer.lastConfirmedAt || null, confirmationDueAt: offer.confirmationDueAt || null,
    createdAt: offer.createdAt, updatedAt: offer.updatedAt,
  };
}

function readText(value, name, { min = 1, max = 200, optional = false } = {}) {
  if (value === undefined || value === null || value === '') { if (optional) return null; throw new Error(`${name} is required`); }
  if (typeof value !== 'string') throw new Error(`${name} is invalid`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${name} is invalid`);
  return text;
}

function readProfileInput(body, user) {
  const businessName = readText(body?.businessName, 'businessName', { min: 2, max: 120 });
  if (!['de', 'en', 'es'].includes(body?.sourceLocale)) throw new Error('sourceLocale is invalid');
  const sourceLocale = body.sourceLocale;
  const phone = readText(body?.phone, 'phone', { min: 3, max: 40, optional: true });
  const website = readText(body?.website, 'website', { min: 8, max: 200, optional: true });
  if (website && !URL_PATTERN.test(website)) throw new Error('website is invalid');
  return { businessName, sourceLocale, phone, website, contactEmail: user.emailNormalized };
}

function component(place, type) {
  return place.addressComponents?.find((item) => item.types?.includes(type));
}

function canonicalGoogleLocation(place, finalLatitude, finalLongitude) {
  if (!place?.id || !place.location || !Number.isFinite(place.location.latitude) || !Number.isFinite(place.location.longitude)) throw new Error('google_place_invalid');
  const originalLatitude = number(place.location.latitude);
  const originalLongitude = number(place.location.longitude);
  const latitude = finalLatitude === undefined ? originalLatitude : number(finalLatitude);
  const longitude = finalLongitude === undefined ? originalLongitude : number(finalLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('location_coordinates_invalid');
  const adjustmentMeters = haversineMeters(originalLatitude, originalLongitude, latitude, longitude);
  if (adjustmentMeters > 25) throw new Error('location_adjustment_exceeds_25m');
  const country = component(place, 'country');
  const locality = component(place, 'locality') || component(place, 'postal_town');
  const postal = component(place, 'postal_code');
  const route = component(place, 'route');
  const streetNumber = component(place, 'street_number');
  return {
    googlePlaceId: place.id,
    formattedAddress: readText(place.formattedAddress, 'formattedAddress', { min: 3, max: 300 }),
    latitude, longitude,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    countryCode: country?.shortText || '', locality: locality?.longText || '',
    postalCode: postal?.longText || null,
    streetAddress: [route?.longText, streetNumber?.longText].filter(Boolean).join(' ') || null,
    googleOriginalLocation: { latitude: originalLatitude, longitude: originalLongitude, location: { type: 'Point', coordinates: [originalLongitude, originalLatitude] } },
    finalLocation: { latitude, longitude, location: { type: 'Point', coordinates: [longitude, latitude] } },
    adjustmentMeters: Math.round(adjustmentMeters * 100) / 100,
    adjustedAt: adjustmentMeters > 0.01 ? now() : null,
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validateTimeWindows(availability) {
  if (!availability || typeof availability !== 'object') throw new Error('availability is required');
  const weekly = availability.weekly || availability;
  const normalized = {};
  let hasOpenWindow = false;
  for (const day of DAYS) {
    const windows = weekly[day] === undefined ? [] : weekly[day];
    if (!Array.isArray(windows) || windows.length > 3) throw new Error('availability is invalid');
    normalized[day] = windows.map((window) => {
      if (!TIME_PATTERN.test(window?.open) || !TIME_PATTERN.test(window?.close) || window.open === window.close) throw new Error('availability is invalid');
      hasOpenWindow = true;
      return { open: window.open, close: window.close };
    });
  }
  const exceptions = availability.exceptions || availability.availabilityExceptions || [];
  if (!Array.isArray(exceptions) || exceptions.length > 100) throw new Error('availabilityExceptions is invalid');
  const normalizedExceptions = exceptions.map((item) => {
    if (!DAY_PATTERN.test(item?.date)) throw new Error('availabilityExceptions is invalid');
    if (item.closed === true) return { date: item.date, closed: true, windows: [] };
    const windows = item.windows || item.intervals || [];
    if (!Array.isArray(windows) || windows.length > 3) throw new Error('availabilityExceptions is invalid');
    return { date: item.date, closed: false, windows: windows.map((window) => {
      if (!TIME_PATTERN.test(window?.open) || !TIME_PATTERN.test(window?.close) || window.open === window.close) throw new Error('availabilityExceptions is invalid');
      hasOpenWindow = true;
      return { open: window.open, close: window.close };
    }) };
  });
  if (!hasOpenWindow) throw new Error('availability must contain an opening window');
  return { weekly: normalized, exceptions: normalizedExceptions };
}

function validatePrice(price) {
  if (!price || !PRICE_TYPES.has(price.type)) throw new Error('price is invalid');
  if (['free', 'donativo', 'on_request'].includes(price.type)) return { type: price.type, currency: price.currency || 'EUR' };
  const currency = typeof price.currency === 'string' ? price.currency.toUpperCase() : 'EUR';
  if (!CURRENCIES.test(currency)) throw new Error('price.currency is invalid');
  if (price.type === 'range') {
    const min = number(price.min); const max = number(price.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) throw new Error('price is invalid');
    return { type: price.type, min, max, currency };
  }
  const amount = number(price.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('price is invalid');
  return { type: price.type, amount, currency };
}

function validateOfferInput(body, activeNeedKeys) {
  const title = readText(body?.title, 'title', { min: 2, max: 120 });
  const description = readText(body?.description, 'description', { min: 2, max: 1000 });
  if (!['de', 'en', 'es'].includes(body?.sourceLocale)) throw new Error('sourceLocale is invalid');
  const sourceLocale = body.sourceLocale;
  const needKeys = Array.isArray(body?.needKeys) ? [...new Set(body.needKeys.filter((value) => typeof value === 'string'))] : [];
  if (needKeys.length === 0) throw new Error('needKeys is required');
  if (needKeys.some((key) => !activeNeedKeys.includes(key))) throw new Error('needKeys contains an unknown Need');
  const radiusMeters = number(body?.radiusMeters === undefined ? 250 : body.radiusMeters);
  if (!Number.isInteger(radiusMeters) || radiusMeters < 50 || radiusMeters > 1000) throw new Error('radiusMeters is invalid');
  const availability = validateTimeWindows(body?.availability || { weekly: body?.openingHours, exceptions: body?.availabilityExceptions });
  const images = Array.isArray(body?.images) ? body.images.filter((value) => typeof value === 'string' && URL_PATTERN.test(value)).slice(0, 8) : [];
  return { title, description, sourceLocale, needKeys, price: validatePrice(body?.price), availability, images, radiusMeters };
}

function withTranslations(input, previous = null) {
  const translations = previous || {};
  return Object.fromEntries(['de', 'en', 'es'].map((locale) => [locale, locale === input.sourceLocale
    ? { status: 'provider_source', title: input.title, description: input.description }
    : { status: translations[locale]?.status || 'pending_translation', title: translations[locale]?.title || null, description: translations[locale]?.description || null }]));
}

export function createProviderService(databaseService, googlePlacesService, needService) {
  const db = () => databaseService.getDb();
  const profiles = () => db().collection('providerProfiles');
  const offers = () => db().collection('offers');

  async function ensureProfile(user, scope) {
    let profile = await profiles().findOne({ userId: user._id, scope });
    if (!profile) {
      const legacy = await profiles().findOne({ userId: user._id });
      if (legacy && !legacy.scope) {
        await profiles().updateOne({ _id: legacy._id }, { $set: { scope, contactEmail: user.emailNormalized, updatedAt: now() } });
        profile = { ...legacy, scope, contactEmail: user.emailNormalized };
      }
    }
    if (!profile) {
      const timestamp = now();
      profile = { userId: user._id, scope, status: 'pending', businessName: null, displayName: user.displayName || '', contactEmail: user.emailNormalized, phone: null, website: null, sourceLocale: user.preferredLocale || 'de', preferredLocale: user.preferredLocale || 'de', location: null, createdAt: timestamp, updatedAt: timestamp, completedAt: null };
      const inserted = await profiles().insertOne(profile);
      profile._id = inserted.insertedId;
    }
    return profile;
  }

  async function getProfile(user, scope) { return publicProfile(await ensureProfile(user, scope)); }

  async function updateProfile(user, scope, body) {
    const profile = await ensureProfile(user, scope);
    const fields = readProfileInput(body, user);
    const timestamp = now();
    const complete = Boolean(fields.businessName && profile.location);
    const status = profile.status === 'blocked' ? 'blocked' : complete ? 'active' : 'pending';
    await profiles().updateOne({ _id: profile._id, userId: user._id, scope }, { $set: { ...fields, preferredLocale: fields.sourceLocale, status, updatedAt: timestamp, completedAt: complete ? (profile.completedAt || timestamp) : null } });
    return getProfile(user, scope);
  }

  async function validateLocation(body, locale = 'de') {
    const placeId = readText(body?.googlePlaceId || body?.placeId, 'googlePlaceId', { min: 3, max: 200 });
    const result = await googlePlacesService.details({ placeId, sessionToken: body?.sessionToken || null, locale });
    if (!result.ok) { const error = new Error(result.errorClass); error.code = result.errorClass; error.upstreamStatus = result.upstreamStatus; throw error; }
    return canonicalGoogleLocation(result.place, body?.finalLatitude, body?.finalLongitude);
  }

  async function updateLocation(user, scope, body) {
    const profile = await ensureProfile(user, scope);
    const location = await validateLocation(body, normalizeLocale(body?.sourceLocale || profile.sourceLocale));
    const timestamp = now();
    const complete = Boolean(profile.businessName);
    const status = profile.status === 'blocked' ? 'blocked' : complete ? 'active' : 'pending';
    await profiles().updateOne({ _id: profile._id, userId: user._id, scope }, { $set: { location, status, updatedAt: timestamp, completedAt: complete ? (profile.completedAt || timestamp) : null } });
    return getProfile(user, scope);
  }

  async function locationHint(user, scope) {
    const profile = await profiles().findOne({ userId: user._id, scope });
    return profile?.location || null;
  }

  async function listOffers(user, scope) {
    const items = await offers().find({ providerId: user._id, scope }).sort({ updatedAt: -1 }).toArray();
    return Promise.all(items.map(async (item) => {
      if (item.status === 'active' && item.confirmationDueAt && item.confirmationDueAt <= now()) {
        await offers().updateOne({ _id: item._id, providerId: user._id, scope, status: 'active' }, { $set: { status: 'expired', updatedAt: now() } });
        item.status = 'expired';
      }
      return publicOffer(item);
    }));
  }

  async function getOffer(user, scope, id) {
    const objectId = asId(id); if (!objectId) throw new Error('offer_not_found');
    const offer = await offers().findOne({ _id: objectId, providerId: user._id, scope });
    if (!offer) throw new Error('offer_not_found');
    if (offer.status === 'active' && offer.confirmationDueAt && offer.confirmationDueAt <= now()) { offer.status = 'expired'; await offers().updateOne({ _id: objectId }, { $set: { status: 'expired', updatedAt: now() } }); }
    return publicOffer(offer);
  }

  async function writeOffer(user, scope, body, id = null) {
    const profile = await ensureProfile(user, scope);
    const allowedNeeds = await needService.activeKeys(Array.isArray(body?.needKeys) ? body.needKeys : []);
    const input = validateOfferInput(body, allowedNeeds);
    const timestamp = now();
    const requestedActive = body?.activate === true;
    if (requestedActive && (!profile.businessName || !profile.location || profile.status !== 'active')) throw new Error('provider_profile_incomplete');
    const status = requestedActive ? 'active' : 'draft';
    const previous = id ? await offers().findOne({ _id: asId(id), providerId: user._id, scope }) : null;
    if (id && !previous) throw new Error('offer_not_found');
    const document = { providerId: user._id, scope, status, ...input, translations: withTranslations(input, previous?.translations), lastConfirmedAt: status === 'active' ? timestamp : (previous?.lastConfirmedAt || null), confirmationDueAt: status === 'active' ? plusDays(timestamp, 30) : (previous?.confirmationDueAt || null), createdAt: previous?.createdAt || timestamp, updatedAt: timestamp };
    if (previous) {
      await offers().updateOne({ _id: previous._id, providerId: user._id, scope }, { $set: document });
      return getOffer(user, scope, String(previous._id));
    }
    const inserted = await offers().insertOne(document);
    return getOffer(user, scope, String(inserted.insertedId));
  }

  async function transitionOffer(user, scope, id, fromStatuses, status) {
    const objectId = asId(id); if (!objectId) throw new Error('offer_not_found');
    const offer = await offers().findOne({ _id: objectId, providerId: user._id, scope });
    if (!offer || !fromStatuses.includes(offer.status)) throw new Error('offer_transition_not_allowed');
    const timestamp = now();
    const set = { status, updatedAt: timestamp };
    if (status === 'active') { set.lastConfirmedAt = timestamp; set.confirmationDueAt = plusDays(timestamp, 30); }
    await offers().updateOne({ _id: objectId, providerId: user._id, scope }, { $set: set });
    return getOffer(user, scope, id);
  }

  async function confirmOffer(user, scope, id) { return transitionOffer(user, scope, id, ['active', 'expired', 'paused'], 'active'); }

  return { ensureProfile, getProfile, locationHint, updateProfile, validateLocation, updateLocation, listOffers, getOffer, writeOffer, pause: (u, s, id) => transitionOffer(u, s, id, ['active', 'expired'], 'paused'), resume: (u, s, id) => transitionOffer(u, s, id, ['paused', 'expired'], 'active'), confirm: confirmOffer, publicProfile, publicOffer, PROFILE_STATUSES, OFFER_STATUSES };
}

export { canonicalGoogleLocation, haversineMeters, validatePrice, validateTimeWindows };
