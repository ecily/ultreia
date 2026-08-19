import express from 'express';
import { loadConfig } from './config/env.js';
import { createMongoService } from './db/mongoClient.js';
import { createHealthRouter } from './routes/health.js';
import { createTaxonomyRouter } from './routes/taxonomy.js';
import { createDeviceRouter } from './routes/devices.js';
import { createLocationRouter } from './routes/location.js';
import { createPushRouter } from './routes/push.js';
import { createDiagnosticsRouter } from './routes/diagnostics.js';
import { createAuthRouter } from './routes/auth.js';
import { createTripRouter } from './routes/trips.js';
import { createProfileRouter } from './routes/profiles.js';
import { createMailService } from './services/mailService.js';
import { createAuthService } from './services/authService.js';
import { createTripService } from './services/tripService.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAccountRouter } from './routes/account.js';
import { logEvent } from './lib/logger.js';
import { createGooglePlacesService } from './services/googlePlacesService.js';
import { createNeedService } from './services/needService.js';
import { createProviderService } from './services/providerService.js';
import { createProviderRouter } from './routes/provider.js';
import { createNeedsRouter } from './routes/needs.js';

const ALLOWED_CORS_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';

function createCorsMiddleware(corsOrigins) {
  return function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && corsOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_CORS_METHODS);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Ultreia-Scope,X-Ultreia-Web');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
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
  const mailService = services.mailService || createMailService(config);
  const authService = services.authService || createAuthService(config, databaseService, mailService);
  const authMiddleware = createAuthMiddleware(authService);
  const tripService = services.tripService || createTripService(databaseService);
  const googlePlacesService = services.googlePlacesService || createGooglePlacesService(config);
  const needService = services.needService || createNeedService(databaseService);
  const providerService = services.providerService || createProviderService(databaseService, googlePlacesService, needService);

  app.disable('x-powered-by');
  app.locals.corsOrigins = config.corsOrigins;
  app.use(createCorsMiddleware(config.corsOrigins));
  app.use(express.json({ limit: '100kb' }));
  app.use(authMiddleware.optionalAuth);

  app.use('/api', createHealthRouter(config, databaseService));
  app.use('/api/taxonomy', createTaxonomyRouter());
  app.use('/api/needs', createNeedsRouter(databaseService, needService));
  app.use('/api/devices', createDeviceRouter(config, databaseService));
  app.use('/api/location', createLocationRouter(config, databaseService, authMiddleware));
  app.use('/api/push', createPushRouter(config, databaseService));
  app.use('/api/diagnostics', createDiagnosticsRouter(config, databaseService));
  app.use('/api/auth', createAuthRouter(config, databaseService, authService, mailService, authMiddleware));
  app.use('/api/provider', createProviderRouter(config, databaseService, providerService, googlePlacesService, authMiddleware));
  app.use('/api/account', createAccountRouter(authService, authMiddleware));
  app.use('/api/profiles', createProfileRouter(databaseService, authService, authMiddleware));
  app.use('/api/trips', createTripRouter(config, databaseService, tripService, authMiddleware));

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      status: 'not_found',
    });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    logEvent('error', 'unhandled_request_error', { errorClass: err?.code || err?.name || 'unknown', error: err });

    return res.status(500).json({
      ok: false,
      status: 'error',
    });
  });

  return app;
}
