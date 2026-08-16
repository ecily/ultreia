import { Router } from 'express';

export function createHealthRouter(config, databaseService) {
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
      database: databaseService.getStatus(),
    });
  });

  router.get('/ready', (req, res) => {
    const database = databaseService.getStatus();
    const ready = database.connected === true;
    return res.status(ready ? 200 : 503).json({
      ok: ready,
      service: config.serviceName,
      status: ready ? 'ready' : 'not_ready',
      checks: { database },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
