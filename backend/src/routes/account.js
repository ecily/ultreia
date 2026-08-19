import { Router } from 'express';

export function createAccountRouter(authService, authMiddleware) {
  const router = Router();
  router.delete('/', authMiddleware.requireAuth, async (req, res) => {
    await authService.accountDelete(req.user._id);
    return res.status(202).json({ ok: true, status: 'account_deletion_started' });
  });
  return router;
}
