import { Router } from 'express';

export function createHealthRouter(config) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: config.serviceName,
      status: 'ok',
      environment: config.nodeEnv,
      version: config.version,
      timestamp: new Date().toISOString(),
      commitShort: config.commitShort,
    });
  });

  return router;
}
