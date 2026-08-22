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
  async countDocuments(query) { return this.documents.filter((document) => matches(document, query)).length; }
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
    const device = await request('/api/devices/register', { method: 'POST', headers: { authorization: `Bearer ${session.session.accessToken}`, 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ deviceId: 'ultreia-test-device-1', platform: 'android' }) });
    assert.equal(device.response.status, 200);
    assert.equal((await database.db.collection('devices').findOne({ deviceId: 'ultreia-test-device-1' })).scope, 'local_test');
  });

  it('keeps technical device writes in the authenticated scope', async () => {
    const session = await login('scoped-device@example.test', 'ultreia-test-device-scope');
    const auth = { authorization: `Bearer ${session.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    const heartbeat = await request('/api/location/heartbeat', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ deviceId: 'ultreia-test-device-scope', lat: 47.1, lng: 15.6, accuracy: 12 }),
    });
    assert.equal(heartbeat.response.status, 200);
    assert.equal((await database.db.collection('devices').findOne({ deviceId: 'ultreia-test-device-scope' })).scope, 'local_test');

    const push = await request('/api/push/register', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ deviceId: 'ultreia-test-device-scope', token: 'ExpoPushToken[scoped-device-token]' }),
    });
    assert.equal(push.response.status, 200);
    assert.equal((await database.db.collection('pushRegistrations').findOne({ deviceId: 'ultreia-test-device-scope' })).scope, 'local_test');
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

  it('keeps admin provisioning closed and supports repeated provisioned admin login', async () => {
    const unknown = await request('/api/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email: 'unknown-admin@example.test', role: 'admin', preferredLocale: 'en' }) });
    assert.equal(unknown.response.status, 403);
    assert.equal(unknown.body.status, 'access_not_available');
    assert.equal(await database.db.collection('users').findOne({ emailNormalized: 'unknown-admin@example.test' }), null);

    const adminId = new ObjectId();
    await database.db.collection('users').insertOne({ _id: adminId, emailNormalized: 'provisioned-admin@example.test', displayName: 'Provisioned Admin', roles: ['admin'], preferredLocale: 'en', status: 'active', testAccess: false, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null });
    const first = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'provisioned-admin@example.test', role: 'admin', preferredLocale: 'en' }) });
    assert.equal(first.response.status, 200);
    const firstLink = await request(`/api/auth/dev/magic-link/${first.body.diagnosticId}`);
    const firstToken = new URL(firstLink.body.verificationUrl).searchParams.get('token');
    const verified = await request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-web': '1', 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token: firstToken }) });
    assert.equal(verified.response.status, 200);
    assert.deepEqual(verified.body.user.roles, ['admin']);
    const accessCookie = verified.response.headers.get('set-cookie').match(/ultreia_access=([^;]+)/)?.[1];
    assert.ok(accessCookie);
    const me = await request('/api/auth/me', { headers: { cookie: `ultreia_access=${accessCookie}` } });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.roles.includes('admin'), true);
    assert.equal(me.body.session.activeRole, 'admin');
    assert.equal((await request('/api/provider/offers', { headers: { cookie: `ultreia_access=${accessCookie}` } })).response.status, 403);
    assert.equal((await request('/api/trips/current', { headers: { cookie: `ultreia_access=${accessCookie}` } })).response.status, 403);
    const adminScopeAuth = { cookie: `ultreia_access=${accessCookie}` };
    assert.equal((await request('/api/admin/overview?scope=local_test', { headers: adminScopeAuth })).response.status, 200);
    const crossScopeAdminRead = await request('/api/admin/overview?scope=production', { headers: adminScopeAuth });
    assert.equal(crossScopeAdminRead.response.status, 403);
    assert.equal(crossScopeAdminRead.body.status, 'scope_mismatch');
    assert.equal((await request('/api/auth/logout', { method: 'POST', headers: { origin: 'https://web.test', cookie: `ultreia_access=${accessCookie}` } })).response.status, 200);
    assert.equal((await request('/api/auth/me', { headers: { cookie: `ultreia_access=${accessCookie}` } })).response.status, 401);

    const second = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'provisioned-admin@example.test', role: 'admin', preferredLocale: 'de' }) });
    assert.equal(second.response.status, 200);
    assert.notEqual(first.body.diagnosticId, second.body.diagnosticId);
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

  it('keeps multi-role identity while isolating provider and admin active contexts', async () => {
    const userId = new ObjectId();
    await database.db.collection('users').insertOne({ _id: userId, emailNormalized: 'multi-role@example.test', displayName: 'Multi Role', roles: ['provider', 'admin'], preferredLocale: 'en', status: 'active', testAccess: true, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null });

    async function roleLogin(role) {
      const requested = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'multi-role@example.test', role, preferredLocale: 'en' }) });
      assert.equal(requested.response.status, 200);
      const link = await request(`/api/auth/dev/magic-link/${requested.body.diagnosticId}`);
      const token = new URL(link.body.verificationUrl).searchParams.get('token');
      return request('/api/auth/magic-link/verify', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ token }) });
    }

    const provider = await roleLogin('provider');
    assert.equal(provider.response.status, 200);
    assert.deepEqual(provider.body.user.roles, ['provider', 'admin']);
    assert.equal(provider.body.session.activeRole, 'provider');
    assert.deepEqual(provider.body.session.allowedRoles, ['provider', 'admin']);
    const providerAuth = { authorization: `Bearer ${provider.body.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    assert.equal((await request('/api/provider/offers', { headers: providerAuth })).response.status, 200);

    const admin = await roleLogin('admin');
    assert.equal(admin.response.status, 200);
    assert.deepEqual(admin.body.user.roles, ['provider', 'admin']);
    assert.equal(admin.body.session.activeRole, 'admin');
    const adminAuth = { authorization: `Bearer ${admin.body.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    assert.equal((await request('/api/provider/offers', { headers: adminAuth })).response.status, 403);
    const adminMe = await request('/api/auth/me', { headers: adminAuth });
    assert.equal(adminMe.body.session.activeRole, 'admin');
    assert.deepEqual(adminMe.body.user.roles, ['provider', 'admin']);
    const refreshedAdmin = await request('/api/auth/session/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: admin.body.session.refreshToken }) });
    assert.equal(refreshedAdmin.response.status, 200);
    assert.equal(refreshedAdmin.body.session.activeRole, 'admin');
    assert.deepEqual(refreshedAdmin.body.session.allowedRoles, ['provider', 'admin']);

    const providerAgain = await roleLogin('provider');
    assert.equal(providerAgain.response.status, 200);
    assert.equal(providerAgain.body.session.activeRole, 'provider');
    assert.deepEqual((await database.db.collection('users').findOne({ emailNormalized: 'multi-role@example.test' })).roles, ['provider', 'admin']);
  });

  it('does not add provider access to an existing admin-only user', async () => {
    await database.db.collection('users').insertOne({ emailNormalized: 'admin-only@example.test', displayName: 'Admin Only', roles: ['admin'], preferredLocale: 'en', status: 'active', testAccess: true, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null });
    const providerRequest = await request('/api/auth/magic-link/request', { method: 'POST', headers: { 'x-ultreia-scope': 'local_test' }, body: JSON.stringify({ email: 'admin-only@example.test', role: 'provider' }) });
    assert.equal(providerRequest.response.status, 403);
    assert.equal(providerRequest.body.status, 'access_not_available');
    assert.deepEqual((await database.db.collection('users').findOne({ emailNormalized: 'admin-only@example.test' })).roles, ['admin']);
  });

  it('deletes provider profiles in every scope when an account is deleted', async () => {
    const isolated = createFakeDatabase();
    const service = createAuthService(config, isolated.service, { sendMagicLink: async () => ({ delivered: false, channel: 'dev' }) });
    const userId = new ObjectId();
    await isolated.db.collection('users').insertOne({ _id: userId, emailNormalized: 'delete-all-scopes@example.test', status: 'active' });
    await isolated.db.collection('providerProfiles').insertOne({ userId, scope: 'production', status: 'active' });
    await isolated.db.collection('providerProfiles').insertOne({ userId, scope: 'local_test', status: 'active' });
    await service.accountDelete(userId);
    const profiles = await isolated.db.collection('providerProfiles').find({ userId }).toArray();
    assert.deepEqual(profiles.map((profile) => profile.status).sort(), ['deleted', 'deleted']);
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
    assert.equal(switchedLocal.body.session.activeRole, 'provider');
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
    const initialOffers = await request('/api/provider/offers', { headers: auth });
    assert.equal(initialOffers.response.status, 200);
    assert.equal(initialOffers.body.items.length, 1);
    assert.equal(initialOffers.body.items[0].status, 'active');
    const draft = await request('/api/provider/offers', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'API water point', description: 'Water for pilgrims.', sourceLocale: 'en', needKeys: ['water'], price: { type: 'free' }, availability: { weekly: { monday: [{ open: '09:00', close: '10:00' }] }, exceptions: [] }, radiusMeters: 250, activate: false }) });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.body.offer.status, 'draft');
    const multipleStatuses = await request('/api/provider/offers', { headers: auth });
    assert.deepEqual(multipleStatuses.body.items.map((item) => item.status).sort(), ['active', 'draft']);
    const invalidOffer = await request('/api/provider/offers', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'Incomplete offer', description: 'Missing need and hours.', sourceLocale: 'en', price: { type: 'free' }, radiusMeters: 250, activate: true }) });
    assert.equal(invalidOffer.response.status, 400);
    assert.equal(invalidOffer.body.status, 'invalid_request');
    assert.equal(invalidOffer.body.error, 'needKeys is required');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/pause`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'paused');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/resume`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'active');
    assert.equal((await request(`/api/provider/offers/${offer.body.offer.id}/confirm`, { method: 'POST', headers: auth, body: '{}' })).body.offer.status, 'active');
    const switchedToProduction = await request('/api/auth/session/switch-scope', { method: 'POST', headers: auth, body: JSON.stringify({ scope: 'production' }) });
    assert.equal(switchedToProduction.response.status, 200);
    const productionOffers = await request('/api/provider/offers', { headers: { authorization: `Bearer ${switchedToProduction.body.session.accessToken}`, 'x-ultreia-scope': 'production' } });
    assert.equal(productionOffers.response.status, 200);
    assert.equal(productionOffers.body.items.length, 0);
  });

  it('stores pilgrim needs and matches only a current scoped open offer', async () => {
    const pilgrim = await login('matching-pilgrim@example.test', 'ultreia-matching-device');
    const auth = { authorization: `Bearer ${pilgrim.session.accessToken}`, 'x-ultreia-scope': 'local_test' };
    const trip = await request('/api/trips', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(trip.response.status, 201);
    await request('/api/devices/register', { method: 'POST', headers: auth, body: JSON.stringify({ deviceId: 'ultreia-matching-device', platform: 'android', appVersion: 'test', buildNumber: 'test' }) });
    await request('/api/location/heartbeat', { method: 'POST', headers: auth, body: JSON.stringify({ deviceId: 'ultreia-matching-device', lat: 42.1, lng: -4.5, accuracy: 8 }) });
    const need = await request('/api/pilgrim/needs/eat', { method: 'PUT', headers: auth, body: JSON.stringify({ active: true, urgency: 'now' }) });
    assert.equal(need.response.status, 200);
    const providerId = new ObjectId(); const profileId = new ObjectId(); const offerId = new ObjectId();
    await database.db.collection('providerProfiles').insertOne({ _id: profileId, userId: providerId, scope: 'local_test', status: 'active', businessName: 'Test Cafe', location: { finalLocation: { location: { type: 'Point', coordinates: [-4.5, 42.1] } } } });
    await database.db.collection('offers').insertOne({ _id: offerId, providerId, scope: 'local_test', status: 'active', title: 'Cafe match', description: 'Open test cafe', needKeys: ['eat'], radiusMeters: 250, price: { type: 'free' }, availability: { weekly: { sunday: [{ open: '00:00', close: '23:59' }], monday: [{ open: '00:00', close: '23:59' }], tuesday: [{ open: '00:00', close: '23:59' }], wednesday: [{ open: '00:00', close: '23:59' }], thursday: [{ open: '00:00', close: '23:59' }], friday: [{ open: '00:00', close: '23:59' }], saturday: [{ open: '00:00', close: '23:59' }] }, exceptions: [] }, images: [] });
    const matches = await request('/api/pilgrim/matches/current', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(matches.response.status, 200, JSON.stringify(matches.body)); assert.equal(matches.body.status, 'ok'); assert.equal(matches.body.matches.length, 1); assert.equal(matches.body.matches[0].matchingNeed.urgency, 'now'); assert.equal(matches.body.matches[0].distanceMeters, 0);
    const wrongScope = await request('/api/pilgrim/matches/current', { method: 'POST', headers: { authorization: `Bearer ${pilgrim.session.accessToken}`, 'x-ultreia-scope': 'production' }, body: '{}' });
    assert.equal(wrongScope.response.status, 403);
    await request('/api/pilgrim/needs/eat', { method: 'PUT', headers: auth, body: JSON.stringify({ active: false, urgency: 'now' }) });
    const inactiveNeed = await request('/api/pilgrim/matches/current', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(inactiveNeed.body.matches.length, 0);
    await request('/api/pilgrim/needs/eat', { method: 'PUT', headers: auth, body: JSON.stringify({ active: true, urgency: 'today' }) });
    await database.db.collection('offers').updateOne({ _id: offerId }, { $set: { status: 'paused' } });
    const paused = await request('/api/pilgrim/matches/current', { method: 'POST', headers: auth, body: '{}' });
    assert.equal(paused.body.matches.length, 0);
  });
});
