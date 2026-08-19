import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { scopeFromRequest } from '../src/lib/scope.js';
import { createAuthService } from '../src/services/authService.js';

function valueAt(document, key) { return key.split('.').reduce((value, part) => value?.[part], document); }
function equalValue(left, right) { return String(left) === String(right); }
function matches(document, query) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = valueAt(document, key);
    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date) && !(expected instanceof ObjectId)) {
      if ('$gt' in expected && !(actual > expected.$gt)) return false;
      if ('$in' in expected && !expected.$in.some((item) => equalValue(actual, item))) return false;
      if ('$ne' in expected && equalValue(actual, expected.$ne)) return false;
      if ('$exists' in expected && Boolean(actual !== undefined) !== expected.$exists) return false;
      if ('$in' in expected || '$gt' in expected || '$ne' in expected || '$exists' in expected) return true;
    }
    return equalValue(actual, expected);
  });
}

function applyUpdate(document, update, insert = false) {
  if (update.$set) Object.assign(document, update.$set);
  if (update.$setOnInsert && insert) Object.assign(document, update.$setOnInsert);
  return document;
}

class FakeCollection {
  constructor(name) { this.name = name; this.documents = []; }
  async findOne(query) { return this.documents.find((document) => matches(document, query)) || null; }
  async insertOne(document) { const copy = { ...document, _id: document._id || new ObjectId() }; if (this.name === 'users' && this.documents.some((item) => document.emailNormalized && item.emailNormalized === document.emailNormalized)) { const error = new Error('duplicate'); error.code = 11000; throw error; } this.documents.push(copy); return { insertedId: copy._id }; }
  async updateOne(query, update, options = {}) { let document = this.documents.find((item) => matches(item, query)); const inserted = !document && options.upsert; if (!document && inserted) { document = {}; for (const [key, value] of Object.entries(query)) if (!key.includes('$')) document[key] = value; this.documents.push(document); } if (document) applyUpdate(document, update, inserted); return { matchedCount: document ? 1 : 0 }; }
  async updateMany(query, update) { for (const document of this.documents.filter((item) => matches(item, query))) applyUpdate(document, update); return {}; }
  async findOneAndUpdate(query, update) { const document = this.documents.find((item) => matches(item, query)); if (!document) return null; applyUpdate(document, update); return document; }
  find(query) { const items = this.documents.filter((item) => matches(item, query)); return { sort: () => ({ limit: () => ({ toArray: async () => items }), toArray: async () => items }), toArray: async () => items }; }
}

class FakeDb {
  constructor() { this.collections = new Map(); }
  collection(name) { if (!this.collections.has(name)) this.collections.set(name, new FakeCollection(name)); return this.collections.get(name); }
}

function createFakeDatabase() {
  const db = new FakeDb();
  return { db, service: { getDb: () => db, getStatus: () => ({ connected: true, status: 'connected' }) } };
}

const config = {
  runtimeMode: 'local', nodeEnv: 'test', port: 0, corsOrigins: ['https://web.test'], logLevel: 'silent', serviceName: 'ultreia-backend', version: '0.1.0', commitShort: 'unknown', mongodbUri: '', mongodbDbName: 'ultreia_production', expoProjectId: '', expoAccessToken: '', pushTestEnabled: false, pushTestKey: '', accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600, magicLinkTtlSeconds: 900, mailProvider: 'none', mailFrom: '', authPublicBaseUrl: 'ultreia://auth/verify', microsoftTenantId: '', microsoftClientId: '', microsoftClientSecret: '', microsoftGraphTimeoutMs: 10000, allowLocalTestScope: true, localTestEmails: [], authRequestRateLimitMax: 100,
};

const providerGoogle = {
  configured: () => true,
  autocompleteCalls: [],
  autocomplete: async (input) => { providerGoogle.autocompleteCalls.push(input); return { ok: true, suggestions: [] }; },
  details: async () => ({ ok: true, place: { id: 'places/provider-test', formattedAddress: 'Test Street 1, Camino', location: { latitude: 42.1, longitude: -4.5 }, addressComponents: [{ types: ['country'], shortText: 'ES', longText: 'Spain' }, { types: ['locality'], longText: 'Camino Town' }, { types: ['postal_code'], longText: '1000' }, { types: ['route'], longText: 'Test Street' }, { types: ['street_number'], longText: '1' }] } }),
};

describe('V1 auth, device binding, scope and trips', () => {
  let server;
  let baseUrl;
  let database;
  before(async () => { database = createFakeDatabase(); server = createApp(config, { databaseService: database.service, googlePlacesService: providerGoogle }).listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve)); baseUrl = `http://127.0.0.1:${server.address().port}`; });
  after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  async function request(path, options = {}) { const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); return { response, body }; }
  async function login(email, deviceId, scope = 'local_test', role) { const first = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': scope }, body: JSON.stringify({ email, displayName: 'Test Pilgrim', deviceId, role }) }); assert.equal(first.response.status, 200, `request:${JSON.stringify(first.body)}`); const linkResponse = await request(`/api/auth/dev/magic-link/${first.body.diagnosticId}`); const token = new URL(linkResponse.body.verificationUrl).searchParams.get('token'); const verified = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': scope }, body: JSON.stringify({ token, deviceId }) }); assert.equal(verified.response.status, 200, `verify:${JSON.stringify(verified.body)}`); return verified.body; }

  it('creates a pilgrim, verifies one-time magic links and binds the device', async () => {
    const session = await login('pilgrim@example.test', 'ultreia-test-device-1');
    assert.equal(session.user.roles[0], 'pilgrim');
    const me = await request('/api/auth/me', { headers: { authorization: `Bearer ${session.session.accessToken}`, 'x-ultreia-scope': 'local_test' } });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.scope, 'local_test');
    const device = await request('/api/devices/register', { method: 'POST', headers: { authorization: `Bearer ${session.session.accessToken}` }, body: JSON.stringify({ deviceId: 'ultreia-test-device-1', platform: 'android' }) });
    assert.equal(device.response.status, 200);
  });

  it('enforces role and scope guards and recovers one current trip on a second device', async () => {
    const session = await login('trip@example.test', 'ultreia-test-device-2');
    const auth = { authorization: `Bearer ${session.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    const created = await request('/api/trips', { method: 'POST', headers: auth, body: JSON.stringify({}) });
    assert.equal(created.response.status, 201);
    const duplicate = await request('/api/trips', { method: 'POST', headers: auth, body: JSON.stringify({}) });
    assert.equal(duplicate.response.status, 409);
    const wrongScope = await request('/api/trips/current', { headers: { ...auth, 'x-ultreia-scope': 'production' } });
    assert.equal(wrongScope.response.status, 403);
    const secondDevice = await login('trip@example.test', 'ultreia-test-device-3');
    const secondAuth = { authorization: `Bearer ${secondDevice.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    const current = await request('/api/trips/current', { headers: secondAuth });
    assert.equal(current.body.trip.id, created.body.trip.id);
    const forbidden = await request('/api/profiles/provider', { method: 'POST', headers: auth, body: JSON.stringify({}) });
    assert.equal(forbidden.response.status, 403);
  });

  it('rejects a reused magic link', async () => {
    const first = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'reuse@example.test', displayName: 'Reuse Test' }) });
    const link = await request(`/api/auth/dev/magic-link/${first.body.diagnosticId}`);
    const token = new URL(link.body.verificationUrl).searchParams.get('token');
    const once = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token }) });
    const twice = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token }) });
    assert.equal(once.response.status, 200);
    assert.equal(twice.response.status, 401);
  });

  it('keeps request responses generic and rejects invalid tokens', async () => {
    const newUser = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'generic-new@example.test', displayName: 'Generic Test' }) });
    const existingUser = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'generic-new@example.test' }) });
    assert.equal(newUser.response.status, existingUser.response.status);
    assert.equal(newUser.body.ok, existingUser.body.ok);
    const invalid = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token: 'invalid-token-value-that-is-long-enough-for-validation' }) });
    assert.equal(invalid.response.status, 401);
  });

  it('uses HttpOnly web cookies and limits production local_test to authorized accounts', async () => {
    const first = await request('/api/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email: 'web@example.test', displayName: 'Web Test' }) });
    const link = await request(`/api/auth/dev/magic-link/${first.body.diagnosticId}`);
    const token = new URL(link.body.verificationUrl).searchParams.get('token');
    const verified = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-web': '1' }, body: JSON.stringify({ token }) });
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.session.accessToken, undefined);
    const cookieHeader = verified.response.headers.get('set-cookie');
    const accessCookie = cookieHeader.match(/ultreia_access=([^;]+)/)?.[1];
    assert.ok(accessCookie);
    const me = await request('/api/auth/me', { headers: { cookie: `ultreia_access=${accessCookie}` } });
    assert.equal(me.response.status, 200);
    const loggedOut = await request('/api/auth/logout', { method: 'POST', headers: { origin: 'https://web.test', cookie: `ultreia_access=${accessCookie}` } });
    assert.equal(loggedOut.response.status, 200);
    const productionConfig = { ...config, runtimeMode: 'production', localTestEmails: [] };
    const requestForScope = { get: () => 'local_test', session: null };
    assert.equal(scopeFromRequest(requestForScope, productionConfig, { roles: ['pilgrim'], emailNormalized: 'normal@example.test' }).ok, false);
    assert.equal(scopeFromRequest(requestForScope, productionConfig, { roles: ['admin'], emailNormalized: 'admin@example.test' }).ok, true);
    const strictAuth = createAuthService({ ...config, runtimeMode: 'production', localTestEmails: ['authorized@example.test'] }, createFakeDatabase().service, { sendMagicLink: async () => ({ delivered: true, channel: 'test' }) });
    await assert.rejects(() => strictAuth.switchScope({ _id: new ObjectId(), emailNormalized: 'normal@example.test', roles: ['provider'] }, { _id: new ObjectId() }, 'local_test'), /local_test_not_authorized/);
  });

  it('creates a pending provider account from the provider web intent without requiring a display name', async () => {
    const result = await request('/api/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'provider@example.test', role: 'provider', preferredLocale: 'en' }),
    });
    assert.equal(result.response.status, 200);
    const user = await database.db.collection('users').findOne({ emailNormalized: 'provider@example.test' });
    assert.deepEqual(user.roles, ['provider']);
    assert.equal(user.displayName, 'provider');
    const profile = await database.db.collection('providerProfiles').findOne({ userId: user._id });
    assert.equal(profile.status, 'pending');
    assert.equal(profile.preferredLocale, 'en');
  });

  it('sends independent magic links again after an existing provider logs out', async () => {
    const isolated = createFakeDatabase();
    const deliveries = [];
    const authService = createAuthService(config, isolated.service, {
      async sendMagicLink(payload) {
        deliveries.push(payload);
        return { delivered: false, channel: 'dev', diagnosticId: `diagnostic-${deliveries.length}` };
      },
    });
    const email = 'repeat-provider@example.test';
    const first = await authService.requestMagicLink({ email, role: 'provider', preferredLocale: 'en', scope: 'local_test' });
    const firstToken = new URL(deliveries[0].verificationUrl).searchParams.get('token');
    const verifiedFirst = await authService.verifyMagicLink(firstToken, null, 'local_test');
    const firstStoredSession = await isolated.db.collection('sessions').findOne({ userId: verifiedFirst.userId });
    await authService.logout(firstStoredSession._id);
    const second = await authService.requestMagicLink({ email, role: 'provider', preferredLocale: 'en', scope: 'local_test' });
    const secondToken = new URL(deliveries[1].verificationUrl).searchParams.get('token');
    const verifiedSecond = await authService.verifyMagicLink(secondToken, null, 'local_test');

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, true);
    assert.equal(deliveries.length, 2);
    assert.notEqual(firstToken, secondToken);
    assert.equal(verifiedSecond.user.email, email);
    await assert.rejects(() => authService.verifyMagicLink(firstToken, null, 'local_test'), /invalid_or_expired_token/);
  });

  it('exposes the scoped provider profile, needs and owned offer API', async () => {
    const requested = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'api-provider@example.test', role: 'provider', preferredLocale: 'en' }) });
    assert.equal(requested.response.status, 200, JSON.stringify(requested.body));
    assert.ok(requested.body.diagnosticId);
    const link = await request(`/api/auth/dev/magic-link/${requested.body.diagnosticId}`);
    const token = new URL(link.body.verificationUrl).searchParams.get('token');
    const verified = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token }) });
    const auth = { authorization: `Bearer ${verified.body.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    assert.equal((await request('/api/provider/profile', { headers: auth })).body.profile.status, 'pending');
    assert.equal((await request('/api/provider/profile', { method: 'PUT', headers: auth, body: JSON.stringify({ businessName: 'API Camino Cafe', sourceLocale: 'en' }) })).body.profile.status, 'pending');
    const location = await request('/api/provider/location', { method: 'PUT', headers: auth, body: JSON.stringify({ googlePlaceId: 'places/provider-test', sourceLocale: 'en' }) });
    assert.equal(location.body.profile.status, 'active');
    const localAutocomplete = await request('/api/provider/location/autocomplete', { method: 'POST', headers: { ...auth, 'x-ultreia-scope': 'production' }, body: JSON.stringify({ input: '8111 Gratwein-Straßengel', locale: 'de', sessionToken: 'local-session', includedRegionCodes: ['fr'] }) });
    assert.equal(localAutocomplete.response.status, 200);
    const localCall = providerGoogle.autocompleteCalls.at(-1);
    assert.equal(localCall.scope, 'local_test');
    assert.equal(localCall.input, '8111 Gratwein-Straßengel');
    assert.equal(localCall.locale, 'de');
    assert.equal(localCall.sessionToken, 'local-session');
    const shortAutocomplete = await request('/api/provider/location/autocomplete', { method: 'POST', headers: auth, body: JSON.stringify({ input: '81', locale: 'de' }) });
    assert.equal(shortAutocomplete.response.status, 400);
    const productionSession = await login('production-provider@example.test', 'ultreia-test-device-production', 'production', 'provider');
    const productionAutocomplete = await request('/api/provider/location/autocomplete', { method: 'POST', headers: { authorization: `Bearer ${productionSession.session.accessToken}`, 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ input: 'Saint-Jean-Pied-de-Port', locale: 'es', includedRegionCodes: ['at'] }) });
    assert.equal(productionAutocomplete.response.status, 200);
    assert.equal(providerGoogle.autocompleteCalls.at(-1).scope, 'production');
    const productionAuth = { authorization: `Bearer ${productionSession.session.accessToken}`, 'x-ultreia-scope': 'production' };
    const switchedLocal = await request('/api/auth/session/switch-scope', { method: 'POST', headers: { ...productionAuth, 'x-ultreia-scope': 'production' }, body: JSON.stringify({ scope: 'local_test' }) });
    assert.equal(switchedLocal.response.status, 200);
    assert.equal(switchedLocal.body.session.scope, 'local_test');
    const localAuth = { authorization: `Bearer ${switchedLocal.body.session.accessToken}`, 'x-ultreia-scope': 'production' };
    assert.equal((await request('/api/provider/profile', { headers: localAuth })).body.profile.scope, 'local_test');
    await request('/api/provider/profile', { method: 'PUT', headers: localAuth, body: JSON.stringify({ businessName: 'Local Test Cafe', sourceLocale: 'de' }) });
    assert.equal((await request('/api/provider/profile', { headers: productionAuth })).response.status, 401);
    const switchedProduction = await request('/api/auth/session/switch-scope', { method: 'POST', headers: localAuth, body: JSON.stringify({ scope: 'production' }) });
    assert.equal(switchedProduction.response.status, 200);
    const restoredProductionAuth = { authorization: `Bearer ${switchedProduction.body.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    const productionProfile = await request('/api/provider/profile', { headers: restoredProductionAuth });
    assert.equal(productionProfile.body.profile.scope, 'production');
    assert.equal(productionProfile.body.profile.businessName, '');
    const needs = await request('/api/needs?locale=en', { headers: auth });
    assert.equal(needs.response.status, 200, JSON.stringify(needs.body));
    assert.equal(needs.body.items.length, 40);
    const offer = await request('/api/provider/offers', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'API breakfast', description: 'Breakfast for pilgrims.', sourceLocale: 'en', needKeys: ['eat', 'breakfast'], price: { type: 'free' }, availability: { weekly: { monday: [{ open: '08:00', close: '12:00' }] }, exceptions: [] }, radiusMeters: 250, activate: true }) });
    assert.equal(offer.response.status, 201);
    assert.equal(offer.body.offer.status, 'active');
    const invalidOffer = await request('/api/provider/offers', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'Incomplete offer', description: 'Missing need and hours.', sourceLocale: 'en', price: { type: 'free' }, radiusMeters: 250, activate: true }) });
    assert.equal(invalidOffer.response.status, 400);
    assert.equal(invalidOffer.body.status, 'invalid_request');
    assert.equal(invalidOffer.body.error, 'needKeys is required');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/pause`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'paused');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/resume`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'active');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/confirm`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'active');
  });
});
