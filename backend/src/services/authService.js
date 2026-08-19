import { createHash, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { isLocalTestAuthorized } from '../lib/scope.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const now = () => new Date();

function publicUser(user) {
  if (!user) return null;
  return { id: String(user._id), email: user.emailNormalized, displayName: user.displayName, roles: user.roles, preferredLocale: user.preferredLocale, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt, lastLoginAt: user.lastLoginAt || null };
}

function publicProfile(profile) {
  if (!profile) return null;
  return { id: String(profile._id), userId: String(profile.userId), status: profile.status || 'active', displayName: profile.displayName, preferredLocale: profile.preferredLocale, consent: profile.consent || null, createdAt: profile.createdAt, updatedAt: profile.updatedAt };
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new Error('email is required');
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('email is invalid');
  return email;
}

function readDisplayName(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 80) throw new Error('displayName is invalid');
  return value.trim();
}

function readLocale(value) {
  return ['de', 'en', 'es'].includes(value) ? value : 'de';
}

export function createAuthService(config, databaseService, mailService) {
  async function issueSession(userId, deviceId, scope = 'production') {
    const accessToken = randomBytes(32).toString('base64url');
    const refreshToken = randomBytes(48).toString('base64url');
    const createdAt = now();
    const session = { userId, deviceId: deviceId || null, scope, accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken), accessExpiresAt: new Date(createdAt.getTime() + config.accessTokenTtlSeconds * 1000), refreshExpiresAt: new Date(createdAt.getTime() + config.refreshTokenTtlSeconds * 1000), createdAt, lastUsedAt: createdAt, revokedAt: null };
    await databaseService.getDb().collection('sessions').insertOne(session);
    return { accessToken, refreshToken, scope, accessExpiresAt: session.accessExpiresAt, refreshExpiresAt: session.refreshExpiresAt };
  }

  async function requestMagicLink({ email, displayName, preferredLocale, scope = 'production' }) {
    const emailNormalized = normalizeEmail(email);
    const collection = databaseService.getDb().collection('users');
    const existing = await collection.findOne({ emailNormalized });
    let user = existing;
    const timestamp = now();
    if (!user) {
      user = { emailNormalized, displayName: readDisplayName(displayName), roles: ['pilgrim'], preferredLocale: readLocale(preferredLocale), status: 'active', testAccess: config.localTestEmails?.includes(emailNormalized) === true, authMethods: ['magic_link'], createdAt: timestamp, updatedAt: timestamp, lastLoginAt: null };
      const inserted = await collection.insertOne(user);
      user._id = inserted.insertedId;
      await databaseService.getDb().collection('pilgrimProfiles').insertOne({ userId: user._id, displayName: user.displayName, preferredLocale: user.preferredLocale, consent: { privacyAcceptedAt: null }, status: 'active', createdAt: timestamp, updatedAt: timestamp });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const requestId = randomBytes(12).toString('hex');
    const expiresAt = new Date(timestamp.getTime() + config.magicLinkTtlSeconds * 1000);
    await databaseService.getDb().collection('magicLinks').insertOne({ requestId, tokenHash: hashToken(rawToken), userId: user._id, emailNormalized, scope, expiresAt, usedAt: null, createdAt: timestamp });
    const verificationUrl = `${config.authPublicBaseUrl}${config.authPublicBaseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(rawToken)}`;
    const delivery = await mailService.sendMagicLink({ emailNormalized, verificationUrl, preferredLocale: readLocale(preferredLocale || user.preferredLocale), expiresAt });
    return { accepted: true, diagnosticId: delivery.diagnosticId || null, delivered: delivery.delivered, channel: delivery.channel };
  }

  async function verifyMagicLink(rawToken, deviceId, requestedScope = 'production') {
    if (typeof rawToken !== 'string' || rawToken.length < 32) throw new Error('invalid_token');
    const links = databaseService.getDb().collection('magicLinks');
    const link = await links.findOneAndUpdate({ tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { $gt: now() } }, { $set: { usedAt: now() } }, { returnDocument: 'after' });
    if (!link) throw new Error('invalid_or_expired_token');
    const user = await databaseService.getDb().collection('users').findOne({ _id: link.userId, status: 'active' });
    if (!user) throw new Error('account_unavailable');
    const timestamp = now();
    await databaseService.getDb().collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: timestamp, updatedAt: timestamp } });
    if (link.scope === 'local_test' && config.runtimeMode === 'production' && !isLocalTestAuthorized(user, config)) throw new Error('local_test_not_authorized');
    if (link.scope !== requestedScope) throw new Error('scope_mismatch');
    const session = await issueSession(user._id, deviceId, link.scope === requestedScope ? link.scope : 'production');
    return { user: publicUser({ ...user, lastLoginAt: timestamp, updatedAt: timestamp }), userId: user._id, session };
  }

  async function authenticateAccessToken(token) {
    if (!token) return null;
    const session = await databaseService.getDb().collection('sessions').findOne({ accessTokenHash: hashToken(token), revokedAt: null, accessExpiresAt: { $gt: now() } });
    if (!session) return null;
    const user = await databaseService.getDb().collection('users').findOne({ _id: session.userId, status: 'active' });
    if (!user) return null;
    await databaseService.getDb().collection('sessions').updateOne({ _id: session._id }, { $set: { lastUsedAt: now() } });
    return { user, session };
  }

  async function refresh(refreshToken, deviceId) {
    const sessions = databaseService.getDb().collection('sessions');
    const current = await sessions.findOne({ refreshTokenHash: hashToken(refreshToken || ''), revokedAt: null, refreshExpiresAt: { $gt: now() } });
    if (!current) throw new Error('invalid_refresh_token');
    const user = await databaseService.getDb().collection('users').findOne({ _id: current.userId, status: 'active' });
    if (!user) throw new Error('account_unavailable');
    await sessions.updateOne({ _id: current._id, revokedAt: null }, { $set: { revokedAt: now(), rotatedAt: now() } });
    return { user: publicUser(user), session: await issueSession(user._id, deviceId || current.deviceId, current.scope) };
  }

  async function logout(sessionId) {
    if (sessionId) await databaseService.getDb().collection('sessions').updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: now() } });
  }

  async function profilesFor(userId) {
    const [pilgrimProfile, providerProfile] = await Promise.all([
      databaseService.getDb().collection('pilgrimProfiles').findOne({ userId }),
      databaseService.getDb().collection('providerProfiles').findOne({ userId }),
    ]);
    return { pilgrimProfile: publicProfile(pilgrimProfile), providerProfile: publicProfile(providerProfile) };
  }

  async function accountDelete(userId) {
    const timestamp = now();
    await Promise.all([
      databaseService.getDb().collection('users').updateOne({ _id: userId }, { $set: { status: 'deleted', deletedAt: timestamp, updatedAt: timestamp } }),
      databaseService.getDb().collection('sessions').updateMany({ userId, revokedAt: null }, { $set: { revokedAt: timestamp } }),
      databaseService.getDb().collection('devices').updateMany({ userId }, { $set: { userId: null, bindingStatus: 'logged_out', updatedAt: timestamp } }),
      databaseService.getDb().collection('pilgrimProfiles').updateOne({ userId }, { $set: { status: 'deleted', updatedAt: timestamp } }),
      databaseService.getDb().collection('providerProfiles').updateOne({ userId }, { $set: { status: 'deleted', updatedAt: timestamp } }),
    ]);
  }

  return { issueSession, requestMagicLink, verifyMagicLink, authenticateAccessToken, refresh, logout, profilesFor, accountDelete, publicUser, normalizeEmail, isLocalTestAuthorized: (user) => isLocalTestAuthorized(user, config) };
}

export { publicUser };
