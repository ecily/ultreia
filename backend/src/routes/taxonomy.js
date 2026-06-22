import { Router } from 'express';
import { getNeedCategoryOptions, normalizeLocale } from '../services/taxonomyService.js';

export function createTaxonomyRouter() {
  const router = Router();

  router.get('/needs', (req, res) => {
    const locale = normalizeLocale(req.query.locale);

    res.json({
      ok: true,
      locale,
      items: getNeedCategoryOptions(locale),
    });
  });

  return router;
}
