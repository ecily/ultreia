import { Router } from 'express';
import { createRateLimiter } from '../lib/rateLimit.js';
import { badRequest, databaseRequired, readDeviceId, readString } from '../lib/validation.js';
import { scopeFromRequest } from '../lib/scope.js';
import { logEvent } from '../lib/logger.js';

function cookieOptions(maxAge, config) {
  return `Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${config.runtimeMode === 'production' ? '; Secure' : ''}`;
}

function setSessionCookies(res, session, config) {
  res.setHeader('Set-Cookie', [`ultreia_access=${encodeURIComponent(session.accessToken)}; ${cookieOptions(config.accessTokenTtlSeconds, config)}`, `ultreia_refresh=${encodeURIComponent(session.refreshToken)}; ${cookieOptions(config.refreshTokenTtlSeconds, config)}`]);
}

function clearSessionCookies(res, config) {
  res.setHeader('Set-Cookie', [`ultreia_access=; ${cookieOptions(0, config)}`, `ultreia_refresh=; ${cookieOptions(0, config)}`]);
}

function readCookie(req, name) {
  const header = req.get('cookie') || '';
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function authError(res, error) {
  if (['invalid_token', 'invalid_or_expired_token', 'invalid_refresh_token', 'local_test_not_authorized', 'scope_mismatch'].includes(error.message)) return res.status(['scope_mismatch', 'local_test_not_authorized'].includes(error.message) ? 403 : 401).json({ ok: false, status: error.message });
  if (['admin_access_not_granted', 'provider_access_not_granted'].includes(error.message)) return res.status(403).json({ ok: false, status: 'access_not_available' });
  if (error.message.includes('required') || error.message.includes('invalid')) return badRequest(res, error);
  return res.status(500).json({ ok: false, status: 'server_error' });
}

export function createAuthRouter(config, databaseService, authService, mailService, authMiddleware) {
  const router = Router();
  const requestLimiter = createRateLimiter({ max: 8 });

  router.post('/magic-link/request', requestLimiter, async (req, res) => {
    try {
      const db = databaseRequired(res, databaseService);
      if (!db) return;
      if (config.runtimeMode === 'production' && !mailService.isConfigured()) return res.status(503).json({ ok: false, status: 'mail_provider_not_configured' });
      const email = authService.normalizeEmail ? authService.normalizeEmail(req.body?.email) : String(req.body?.email || '').trim().toLowerCase();
      const existingUser = await db.collection('users').findOne({ emailNormalized: email });
      const requestedScope = scopeFromRequest(req, config, existingUser || (config.localTestEmails?.includes(email) ? { emailNormalized: email } : null));
      if (!requestedScope.ok) return res.status(403).json({ ok: false, status: requestedScope.status });
      const result = await authService.requestMagicLink({ email, displayName: req.body?.displayName, preferredLocale: req.body?.preferredLocale, role: req.body?.role, deviceId: req.body?.deviceId ? readDeviceId(req.body.deviceId) : null, scope: requestedScope.scope });
      if (config.runtimeMode === 'production' && !result.delivered) {
        logEvent('warn', 'magic_link_delivery_failed', { channel: result.channel, errorClass: result.errorClass || 'mail_provider_failed', upstreamStatus: result.upstreamStatus || null });
        return res.status(result.errorClass === 'mail_provider_not_configured' ? 503 : 502).json({ ok: false, status: result.errorClass === 'mail_provider_not_configured' ? 'mail_provider_not_configured' : 'mail_provider_failed' });
      }
      if (config.runtimeMode === 'production') logEvent('info', 'magic_link_delivered', { channel: result.channel, upstreamStatus: result.upstreamStatus || null });
      return res.json({ ok: true, status: 'accepted', diagnosticId: result.diagnosticId || undefined });
    } catch (error) {
      logEvent('error', 'magic_link_request_failed', { errorClass: error?.code || error?.name || 'unknown', error });
      return authError(res, error);
    }
  });

  router.get('/dev/magic-link/:diagnosticId', (req, res) => {
    if (config.runtimeMode === 'production') return res.status(404).json({ ok: false, status: 'not_found' });
    const link = mailService.readDevLink(readString(req.params.diagnosticId, { name: 'diagnosticId', max: 64, required: true }));
    if (!link) return res.status(404).json({ ok: false, status: 'not_found' });
    return res.json({ ok: true, verificationUrl: link });
  });

  router.post('/magic-link/verify', async (req, res) => {
    try {
      const db = databaseRequired(res, databaseService);
      if (!db) return;
      const requestedScope = req.get('x-ultreia-scope') || 'production';
      if (!['production', 'local_test'].includes(requestedScope)) return res.status(403).json({ ok: false, status: 'invalid_scope' });
      const deviceId = req.body?.deviceId ? readDeviceId(req.body.deviceId) : null;
      const result = await authService.verifyMagicLink(req.body?.token, deviceId, requestedScope);
      if (requestedScope === 'local_test' && result.session.scope !== 'local_test') return res.status(403).json({ ok: false, status: 'scope_not_available' });
      const profiles = await authService.profilesFor(result.userId);
      if (req.get('x-ultreia-web') === '1') setSessionCookies(res, result.session, config);
      return res.json({ ok: true, user: result.user, ...profiles, session: req.get('x-ultreia-web') === '1' ? { scope: result.session.scope, accessExpiresAt: result.session.accessExpiresAt, refreshExpiresAt: result.session.refreshExpiresAt } : result.session });
    } catch (error) { return authError(res, error); }
  });

  router.post('/session/refresh', async (req, res) => {
    try {
      const result = await authService.refresh(req.body?.refreshToken || readCookie(req, 'ultreia_refresh'), req.body?.deviceId ? readDeviceId(req.body.deviceId) : null);
      if (req.get('x-ultreia-web') === '1') setSessionCookies(res, result.session, config);
      return res.json({ ok: true, user: result.user, session: req.get('x-ultreia-web') === '1' ? { scope: result.session.scope, accessExpiresAt: result.session.accessExpiresAt, refreshExpiresAt: result.session.refreshExpiresAt } : result.session });
    } catch (error) { return authError(res, error); }
  });

  router.get('/me', authMiddleware.requireAuth, async (req, res) => {
    const profiles = await authService.profilesFor(req.user._id);
    return res.json({ ok: true, user: authService.publicUser(req.user), scope: req.session.scope, localTestAuthorized: authService.isLocalTestAuthorized(req.user), ...profiles });
  });

  router.post('/logout', authMiddleware.requireAuth, async (req, res) => {
    await authService.logout(req.session._id);
    if (req.session.deviceId) await databaseService.getDb().collection('devices').updateOne({ deviceId: req.session.deviceId, userId: req.user._id }, { $set: { userId: null, bindingStatus: 'logged_out', updatedAt: new Date() } });
    clearSessionCookies(res, config);
    return res.json({ ok: true, status: 'logged_out' });
  });

  return router;
}
