const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = 'info';
const SERVICE_NAME = 'ultreia-backend';
const DEFAULT_MODE = 'local';
const VALID_MODES = new Set(['local', 'lan', 'production']);
const DEFAULT_ACCESS_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TTL_SECONDS = 2592000;
const DEFAULT_MAGIC_LINK_TTL_SECONDS = 900;
const DEFAULT_MICROSOFT_GRAPH_TIMEOUT_MS = 10000;
const DEFAULT_GOOGLE_PLACES_TIMEOUT_MS = 8000;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parsePort(value) {
  if (!value) return DEFAULT_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer`);
  return number;
}

function parseTimeout(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_MICROSOFT_GRAPH_TIMEOUT_MS;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1000 || number > 30000) throw new Error('MICROSOFT_GRAPH_TIMEOUT_MS must be an integer between 1000 and 30000');
  return number;
}

function parseCorsOrigins(value) {
  if (!value) return [];

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseCsv(value) {
  return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function shortCommit(value) {
  if (!value || value === 'unknown') return 'unknown';
  return value.slice(0, 7);
}

export function loadConfig(env = process.env) {
  const commitSha = env.COMMIT_SHA || env.SOURCE_VERSION || env.GIT_COMMIT || 'unknown';
  const runtimeMode = env.ULTREIA_MODE || (env.NODE_ENV === 'production' ? 'production' : DEFAULT_MODE);
  if (!VALID_MODES.has(runtimeMode)) throw new Error('ULTREIA_MODE must be local, lan, or production');

  return {
    runtimeMode,
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    mongodbUri: env.MONGODB_URI || '',
    mongodbDbName: env.MONGODB_DB_NAME || 'ultreia_production',
    logLevel: env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
    expoProjectId: env.EXPO_PROJECT_ID || '',
    expoAccessToken: env.EXPO_ACCESS_TOKEN || '',
    pushTestEnabled: parseBoolean(env.PUSH_TEST_ENABLED, false),
    pushTestKey: env.PUSH_TEST_KEY || '',
    heartbeatTtlSeconds: parsePositiveInteger(env.HEARTBEAT_TTL_SECONDS, 604800, 'HEARTBEAT_TTL_SECONDS'),
    diagnosticTtlSeconds: parsePositiveInteger(env.DIAGNOSTIC_TTL_SECONDS, 2592000, 'DIAGNOSTIC_TTL_SECONDS'),
    accessTokenTtlSeconds: parsePositiveInteger(env.AUTH_ACCESS_TTL_SECONDS, DEFAULT_ACCESS_TTL_SECONDS, 'AUTH_ACCESS_TTL_SECONDS'),
    refreshTokenTtlSeconds: parsePositiveInteger(env.AUTH_REFRESH_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS, 'AUTH_REFRESH_TTL_SECONDS'),
    magicLinkTtlSeconds: parsePositiveInteger(env.AUTH_MAGIC_LINK_TTL_SECONDS, DEFAULT_MAGIC_LINK_TTL_SECONDS, 'AUTH_MAGIC_LINK_TTL_SECONDS'),
    mailProvider: env.MAIL_PROVIDER || 'none',
    mailFrom: env.MAIL_FROM || '',
    authPublicBaseUrl: env.AUTH_PUBLIC_BASE_URL || 'ultreia://auth/verify',
    microsoftTenantId: env.MICROSOFT_TENANT_ID || '',
    microsoftClientId: env.MICROSOFT_CLIENT_ID || '',
    microsoftClientSecret: env.MICROSOFT_CLIENT_SECRET || '',
    microsoftGraphTimeoutMs: parseTimeout(env.MICROSOFT_GRAPH_TIMEOUT_MS),
    googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY || '',
    googlePlacesTimeoutMs: parseTimeout(env.GOOGLE_PLACES_TIMEOUT_MS || DEFAULT_GOOGLE_PLACES_TIMEOUT_MS),
    allowLocalTestScope: parseBoolean(env.ALLOW_LOCAL_TEST_SCOPE, true),
    localTestEmails: parseCsv(env.LOCAL_TEST_EMAILS),
    serviceName: SERVICE_NAME,
    version: env.npm_package_version || env.APP_VERSION || '0.1.0',
    commitShort: shortCommit(commitSha),
  };
}

export function validateRuntimeConfig(config) {
  const errors = [];
  const production = config.runtimeMode === 'production' || config.nodeEnv === 'production';

  if (production) {
    if (!config.mongodbUri) errors.push('MONGODB_URI');
    if (config.mongodbDbName !== 'ultreia_production') errors.push('MONGODB_DB_NAME=ultreia_production');
    if (!config.corsOrigins.length) errors.push('CORS_ORIGINS');
    if (config.pushTestEnabled && !config.pushTestKey) errors.push('PUSH_TEST_KEY when PUSH_TEST_ENABLED=true');
    if (config.pushTestEnabled && !config.expoProjectId) errors.push('EXPO_PROJECT_ID when PUSH_TEST_ENABLED=true');
    try {
      const authUrl = new URL(config.authPublicBaseUrl);
      if (authUrl.protocol !== 'https:' || authUrl.hostname !== 'ultreia.app' || authUrl.pathname !== '/auth/verify' || authUrl.search || authUrl.hash || authUrl.username || authUrl.password) {
        errors.push('AUTH_PUBLIC_BASE_URL=https://ultreia.app/auth/verify');
      }
    } catch {
      errors.push('AUTH_PUBLIC_BASE_URL=https://ultreia.app/auth/verify');
    }
  }

  return { ok: errors.length === 0, errors };
}
