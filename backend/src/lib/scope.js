const VALID_SCOPES = new Set(['production', 'local_test']);

export function scopeFromRequest(req, config) {
  const requested = req.get('x-ultreia-scope') || 'production';
  if (!VALID_SCOPES.has(requested)) return { ok: false, status: 'invalid_scope' };
  if (requested === 'local_test' && (config.runtimeMode === 'production' || !config.allowLocalTestScope)) {
    return { ok: false, status: 'scope_not_available' };
  }
  if (req.session?.scope && req.session.scope !== requested) return { ok: false, status: 'scope_mismatch' };
  return { ok: true, scope: requested };
}

export function scopeForMagicLink(req, config) {
  const result = scopeFromRequest(req, config);
  return result.ok ? result.scope : 'production';
}
