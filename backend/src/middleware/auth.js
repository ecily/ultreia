export function createAuthMiddleware(authService) {
  async function optionalAuth(req, _res, next) {
    try {
      const authorization = req.get('authorization') || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
      if (token) {
        const context = await authService.authenticateAccessToken(token);
        if (context) { req.user = context.user; req.session = context.session; }
      }
      return next();
    } catch (error) { return next(error); }
  }

  function requireAuth(req, res, next) {
    if (!req.user || !req.session) return res.status(401).json({ ok: false, status: 'unauthorized' });
    return next();
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.some((role) => req.user.roles?.includes(role))) return res.status(403).json({ ok: false, status: 'forbidden' });
      return next();
    };
  }

  return { optionalAuth, requireAuth, requireRole };
}
