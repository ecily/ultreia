import express from 'express';
import { loadConfig } from './config/env.js';
import { createMongoService } from './db/mongoClient.js';
import { createHealthRouter } from './routes/health.js';
import { createTaxonomyRouter } from './routes/taxonomy.js';
import { createDeviceRouter } from './routes/devices.js';
import { createLocationRouter } from './routes/location.js';
import { createPushRouter } from './routes/push.js';
import { createDiagnosticsRouter } from './routes/diagnostics.js';

function createCorsMiddleware(corsOrigins) {
  return function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && corsOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  };
}

export function createApp(config = loadConfig(), services = {}) {
  const app = express();
  const databaseService = services.databaseService || createMongoService(config);

  app.disable('x-powered-by');
  app.use(createCorsMiddleware(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createHealthRouter(config, databaseService));
  app.use('/api/taxonomy', createTaxonomyRouter());
  app.use('/api/devices', createDeviceRouter(config, databaseService));
  app.use('/api/location', createLocationRouter(config, databaseService));
  app.use('/api/push', createPushRouter(config, databaseService));
  app.use('/api/diagnostics', createDiagnosticsRouter(config, databaseService));

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      status: 'not_found',
    });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    return res.status(500).json({
      ok: false,
      status: 'error',
    });
  });

  return app;
}
