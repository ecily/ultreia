import { Router } from 'express';
import { createRateLimiter } from '../lib/rateLimit.js';
import { badRequest, databaseRequired, readDeviceId, readString } from '../lib/validation.js';
import { scopeFromRequest, scopeForMagicLink } from '../lib/scope.js';

function authError(res, error) {
  if (['invalid_token', 'invalid_or_expired_token', 'invalid_refresh_token'].includes(error.message)) return res.status(401).json({ ok: false, status: error.message });
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
      const requestedScope = scopeFromRequest(req, config);
      if (!requestedScope.ok) return res.status(403).json({ ok: false, status: requestedScope.status });
      const result = await authService.requestMagicLink({ email: req.body?.email, displayName: req.body?.displayName, preferredLocale: req.body?.preferredLocale, deviceId: req.body?.deviceId ? readDeviceId(req.body.deviceId) : null, scope: scopeForMagicLink(req, config) });
      return res.json({ ok: true, status: 'accepted', diagnosticId: result.diagnosticId || undefined });
    } catch (error) { return authError(res, error); }
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
      const requestedScope = scopeFromRequest(req, config);
      if (!requestedScope.ok) return res.status(403).json({ ok: false, status: requestedScope.status });
      const deviceId = req.body?.deviceId ? readDeviceId(req.body.deviceId) : null;
      const result = await authService.verifyMagicLink(req.body?.token, deviceId, requestedScope.scope);
      const profiles = await authService.profilesFor(result.userId);
      return res.json({ ok: true, user: result.user, ...profiles, session: result.session });
    } catch (error) { return authError(res, error); }
  });

  router.post('/session/refresh', async (req, res) => {
    try {
      const result = await authService.refresh(req.body?.refreshToken, req.body?.deviceId ? readDeviceId(req.body.deviceId) : null);
      return res.json({ ok: true, user: result.user, session: result.session });
    } catch (error) { return authError(res, error); }
  });

  router.get('/me', authMiddleware.requireAuth, async (req, res) => {
    const profiles = await authService.profilesFor(req.user._id);
    return res.json({ ok: true, user: authService.publicUser(req.user), scope: req.session.scope, ...profiles });
  });

  router.post('/logout', authMiddleware.requireAuth, async (req, res) => {
    await authService.logout(req.session._id);
    if (req.session.deviceId) await databaseService.getDb().collection('devices').updateOne({ deviceId: req.session.deviceId, userId: req.user._id }, { $set: { userId: null, bindingStatus: 'logged_out', updatedAt: new Date() } });
    return res.json({ ok: true, status: 'logged_out' });
  });

  return router;
}
