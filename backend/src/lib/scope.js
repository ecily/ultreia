const VALID_SCOPES = new Set(['production', 'local_test']);

export function scopeFromRequest(req, config, user = req.user) {
  const requested = req.get('x-ultreia-scope') || 'production';
  if (!VALID_SCOPES.has(requested)) return { ok: false, status: 'invalid_scope' };
  if (requested === 'local_test' && (config.allowLocalTestScope === false || (config.runtimeMode === 'production' && !isLocalTestAuthorized(user, config)))) {
    return { ok: false, status: 'scope_not_available' };
  }
  if (req.session?.scope && req.session.scope !== requested) return { ok: false, status: 'scope_mismatch' };
  return { ok: true, scope: requested };
}

export function isLocalTestAuthorized(user, config) {
  if (user?.roles?.includes('admin') || user?.testAccess === true) return true;
  return Boolean(user?.emailNormalized && config.localTestEmails?.includes(user.emailNormalized));
}
