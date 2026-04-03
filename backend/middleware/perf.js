import compression from 'compression';
import helmet from 'helmet';

export default function applyPerf(app) {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.set('trust proxy', 1);
}

