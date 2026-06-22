import express from 'express';
import { loadConfig } from './config/env.js';
import { createHealthRouter } from './routes/health.js';

function createCorsMiddleware(corsOrigins) {
  return function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && corsOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  };
}

export function createApp(config = loadConfig()) {
  const app = express();

  app.disable('x-powered-by');
  app.use(createCorsMiddleware(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createHealthRouter(config));

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
