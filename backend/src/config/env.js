const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = 'info';
const SERVICE_NAME = 'ultreia-backend';

function parsePort(value) {
  if (!value) return DEFAULT_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseCorsOrigins(value) {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function shortCommit(value) {
  if (!value || value === 'unknown') return 'unknown';
  return value.slice(0, 7);
}

export function loadConfig(env = process.env) {
  const commitSha = env.COMMIT_SHA || env.SOURCE_VERSION || env.GIT_COMMIT || 'unknown';

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    mongodbUri: env.MONGODB_URI || '',
    mongodbDbName: env.MONGODB_DB_NAME || 'ultreia_staging',
    logLevel: env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
    serviceName: SERVICE_NAME,
    version: env.npm_package_version || env.APP_VERSION || '0.1.0',
    commitShort: shortCommit(commitSha),
  };
}
