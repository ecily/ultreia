import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import { createGooglePlacesService } from '../src/services/googlePlacesService.js';
import { createNeedService } from '../src/services/needService.js';
import { canonicalGoogleLocation, createProviderService, validatePrice, validateTimeWindows } from '../src/services/providerService.js';

function valueAt(document, key) { return key.split('.').reduce((value, part) => value?.[part], document); }
function equalValue(left, right) { return String(left) === String(right); }
function matches(document, query) { return Object.entries(query).every(([key, expected]) => equalValue(valueAt(document, key), expected)); }

class Collection {
  constructor() { this.documents = []; }
  async findOne(query) { return this.documents.find((item) => matches(item, query)) || null; }
  async insertOne(document) { const item = { ...document, _id: document._id || new ObjectId() }; this.documents.push(item); return { insertedId: item._id }; }
  async updateOne(query, update, options = {}) { let item = this.documents.find((document) => matches(document, query)); if (!item && options.upsert) { item = { ...query, _id: new ObjectId() }; this.documents.push(item); if (update.$setOnInsert) Object.assign(item, update.$setOnInsert); } if (item && update.$set) Object.assign(item, update.$set); return {}; }
  find(query) { const items = this.documents.filter((item) => matches(item, query)); return { sort: () => ({ toArray: async () => items }), toArray: async () => items }; }
}
class Db {
  constructor() { this.collections = new Map(); }
  collection(name) { if (!this.collections.has(name)) this.collections.set(name, new Collection()); return this.collections.get(name); }
}

const locationPlace = { id: 'places/test-place', formattedAddress: 'Test Street 1, 1000 Camino', location: { latitude: 42.1, longitude: -4.5 }, addressComponents: [{ types: ['country'], shortText: 'ES', longText: 'Spain' }, { types: ['locality'], longText: 'Camino Town' }, { types: ['postal_code'], longText: '1000' }, { types: ['route'], longText: 'Test Street' }, { types: ['street_number'], longText: '1' }] };
const offerInput = { title: 'Pilgrim breakfast', description: 'A simple breakfast for pilgrims.', sourceLocale: 'en', needKeys: ['eat', 'water'], price: { type: 'fixed', amount: 8, currency: 'EUR' }, availability: { weekly: { monday: [{ open: '08:00', close: '12:00' }] }, exceptions: [] }, radiusMeters: 250, activate: true };

describe('provider V1 service', () => {
  it('normalizes Google Place data and enforces the 25 metre marker limit', () => {
    const location = canonicalGoogleLocation(locationPlace, 42.1001, -4.5);
    assert.deepEqual(location.location, { type: 'Point', coordinates: [-4.5, 42.1001] });
    assert.equal(location.googlePlaceId, 'places/test-place');
    assert.throws(() => canonicalGoogleLocation(locationPlace, 42.101, -4.5), /location_adjustment_exceeds_25m/);
  });

  it('validates all supported price types and structured availability', () => {
    for (const type of ['free', 'donativo', 'on_request']) assert.equal(validatePrice({ type }).type, type);
    assert.equal(validatePrice({ type: 'fixed', amount: 3, currency: 'EUR' }).amount, 3);
    assert.equal(validatePrice({ type: 'from', amount: 3, currency: 'EUR' }).type, 'from');
    assert.equal(validatePrice({ type: 'range', min: 3, max: 8, currency: 'EUR' }).max, 8);
    assert.throws(() => validatePrice({ type: 'range', min: 9, max: 8, currency: 'EUR' }), /price is invalid/);
    assert.throws(() => validateTimeWindows({ weekly: { monday: [{ open: '8:00', close: '12:00' }] } }), /availability is invalid/);
  });

  it('supports scoped provider profile and offer lifecycle with ownership checks', async () => {
    const db = new Db();
    const database = { getDb: () => db };
    const needService = createNeedService(database);
    const google = { details: async () => ({ ok: true, place: locationPlace }) };
    const service = createProviderService(database, google, needService);
    const user = { _id: new ObjectId(), emailNormalized: 'provider@example.test', displayName: 'Provider', preferredLocale: 'en' };
    const other = { _id: new ObjectId(), emailNormalized: 'other@example.test', displayName: 'Other', preferredLocale: 'en' };

    assert.equal((await service.getProfile(user, 'production')).status, 'pending');
    assert.equal((await service.updateProfile(user, 'production', { businessName: 'Camino Cafe', sourceLocale: 'en' })).status, 'pending');
    assert.equal((await service.updateLocation(user, 'production', { googlePlaceId: 'places/test-place', sourceLocale: 'en' })).status, 'active');
    const created = await service.writeOffer(user, 'production', offerInput);
    assert.equal(created.status, 'active');
    assert.equal(created.needKeys.length, 2);
    assert.equal((await service.listOffers(user, 'local_test')).length, 0);
    await assert.rejects(() => service.getOffer(other, 'production', created.id), /offer_not_found/);
    assert.equal((await service.pause(user, 'production', created.id)).status, 'paused');
    assert.equal((await service.resume(user, 'production', created.id)).status, 'active');
    assert.equal((await service.confirm(user, 'production', created.id)).confirmationDueAt instanceof Date, true);
    await assert.rejects(() => service.writeOffer(user, 'production', { ...offerInput, needKeys: [], radiusMeters: 49 }), /needKeys is required/);
    await assert.rejects(() => service.writeOffer(user, 'production', { ...offerInput, radiusMeters: 1001 }), /radiusMeters is invalid/);
  });

  it('keeps offer images scoped, ordered and capped at three', async () => {
    const db = new Db();
    const database = { getDb: () => db };
    const service = createProviderService(database, { details: async () => ({ ok: true, place: locationPlace }) }, createNeedService(database));
    const user = { _id: new ObjectId(), emailNormalized: 'images@example.test', displayName: 'Images', preferredLocale: 'en' };
    await service.updateProfile(user, 'local_test', { businessName: 'Image Cafe', sourceLocale: 'en' });
    await service.updateLocation(user, 'local_test', { googlePlaceId: 'places/test-place', sourceLocale: 'en' });
    const created = await service.writeOffer(user, 'local_test', offerInput);
    const image = (index) => ({ publicId: `ultreia/local_test/offers/${user._id}/${created.id}/photo-${index}`, secureUrl: `https://res.cloudinary.com/test/image/upload/photo-${index}.jpg`, width: 1200, height: 800, format: 'jpg', bytes: 1000, sortOrder: index, createdAt: new Date() });
    const first = await service.addOfferImage(user, 'local_test', created.id, image(0));
    const second = await service.addOfferImage(user, 'local_test', created.id, image(1));
    const third = await service.addOfferImage(user, 'local_test', created.id, image(2));
    assert.equal(third.images.length, 3);
    await assert.rejects(() => service.addOfferImage(user, 'local_test', created.id, image(3)), /images_limit_exceeded/);
    const edited = await service.writeOffer(user, 'local_test', { ...offerInput, title: 'Updated image offer' }, created.id);
    assert.equal(edited.images.length, 3);
    await assert.rejects(() => service.writeOffer(user, 'local_test', { ...offerInput, images: [{ publicId: 'foreign/photo', secureUrl: 'https://example.com/foreign.jpg', width: 1, height: 1, format: 'jpg' }] }, created.id), /images_are_managed_separately/);
    const reordered = await service.reorderOfferImages(user, 'local_test', created.id, [second.images[1].publicId, first.images[0].publicId, third.images[2].publicId]);
    assert.equal(reordered.images[0].sortOrder, 0);
    const removed = await service.removeOfferImage(user, 'local_test', created.id, reordered.images[0].publicId);
    assert.equal(removed.images.length, 2);
  });

  it('uses Places API (New) field masks and degrades safely without a key', async () => {
    const calls = [];
    const google = createGooglePlacesService({ googlePlacesApiKey: 'test-key', googlePlacesTimeoutMs: 1000 }, { fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ suggestions: [{ placePrediction: { placeId: 'places/x', text: { text: 'X' } } }] }), { status: 200 }); } });
    const result = await google.autocomplete({ input: '8111 Gratwein-Straßengel', scope: 'local_test', sessionToken: 'session', locale: 'de', location: { finalLocation: { latitude: 47.13, longitude: 15.6 } } });
    assert.equal(result.suggestions[0].placeId, 'places/x');
    assert.equal(calls[0].options.headers['x-goog-fieldmask'].includes('placeId'), true);
    const localBody = JSON.parse(calls[0].options.body);
    assert.equal(localBody.input, '8111 Gratwein-Straßengel');
    assert.deepEqual(localBody.includedRegionCodes, ['at']);
    assert.equal(localBody.regionCode, 'at');
    assert.equal(localBody.languageCode, 'de');
    assert.equal(localBody.includePureServiceAreaBusinesses, false);
    assert.deepEqual(localBody.locationBias.circle.center, { latitude: 47.13, longitude: 15.6 });
    assert.equal(localBody.locationBias.circle.radius, 50000);
    const production = await google.autocomplete({ input: 'Saint-Jean-Pied-de-Port', scope: 'production', locale: 'es' });
    assert.equal(production.ok, true);
    const productionBody = JSON.parse(calls[1].options.body);
    assert.deepEqual(productionBody.includedRegionCodes, ['es', 'fr']);
    assert.equal(productionBody.regionCode, undefined);
    assert.equal(productionBody.locationBias, undefined);
    assert.equal(productionBody.languageCode, 'es');
    assert.equal(calls[0].options.signal instanceof AbortSignal, true);
    assert.equal((await createGooglePlacesService({}, {}).autocomplete({ input: 'Camino' })).errorClass, 'google_places_not_configured');
  });
});
