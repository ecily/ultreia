import { Router } from 'express';
import { databaseRequired } from '../lib/validation.js';
import { normalizeLocale } from '../services/taxonomyService.js';

export function createNeedsRouter(databaseService, needService) {
  const router = Router();
  router.get('/', async (req, res) => {
    const db = databaseRequired(res, databaseService);
    if (!db) return;
    try { return res.json({ ok: true, locale: normalizeLocale(req.query.locale), items: await needService.list(normalizeLocale(req.query.locale)) }); } catch { return res.status(500).json({ ok: false, status: 'needs_unavailable' }); }
  });
  return router;
}
