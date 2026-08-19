export function createAuthMiddleware(authService) {
  function cookieValue(req, name) {
    const header = req.get('cookie') || '';
    const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
  }

  async function optionalAuth(req, _res, next) {
    try {
      const authorization = req.get('authorization') || '';
      const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
      const cookieToken = cookieValue(req, 'ultreia_access');
      const origin = req.get('origin');
      const cookieAllowed = Boolean(cookieToken) && (req.method === 'GET' || req.method === 'HEAD' || Boolean(origin && req.app.locals.corsOrigins?.includes(origin)));
      const token = bearerToken || (cookieAllowed ? cookieToken : null);
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
