import { MongoClient } from 'mongodb';

function collectErrorDetails(error, seen = new Set()) {
  if (!error || seen.has(error)) return '';
  seen.add(error);

  const parts = [
    error.name,
    error.code,
    error.codeName,
    error.message,
    error.reason?.type,
    error.reason?.message,
    error.cause?.name,
    error.cause?.code,
    error.cause?.message,
  ];

  if (error.errors && typeof error.errors[Symbol.iterator] === 'function') {
    for (const nestedError of error.errors) {
      parts.push(collectErrorDetails(nestedError, seen));
    }
  }

  if (error.reason?.servers && typeof error.reason.servers.values === 'function') {
    for (const server of error.reason.servers.values()) {
      parts.push(server?.type);
      parts.push(server?.error?.name);
      parts.push(server?.error?.code);
      parts.push(server?.error?.message);
    }
  }

  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function classifyMongoError(error) {
  const details = collectErrorDetails(error);
  const errorName = `${error?.name || ''}`.toLowerCase();

  if (
    errorName.includes('parse') ||
    errorName.includes('invalid') ||
    details.includes('invalid scheme') ||
    details.includes('invalid connection string') ||
    details.includes('mongodb connection string')
  ) {
    return 'invalid_uri';
  }

  if (details.includes('auth') || details.includes('bad auth') || error?.code === 18) {
    return 'authentication_failed';
  }

  if (
    details.includes('querysrv') ||
    details.includes('enotfound') ||
    details.includes('enodata') ||
    details.includes('dns')
  ) {
    return 'dns_or_srv_failed';
  }

  if (
    details.includes('tls') ||
    details.includes('ssl') ||
    details.includes('certificate') ||
    details.includes('self-signed')
  ) {
    return 'tls_error';
  }

  if (
    details.includes('timeout') ||
    details.includes('timed out') ||
    details.includes('etimedout') ||
    details.includes('econnrefused') ||
    details.includes('econnreset') ||
    details.includes('ehostunreach') ||
    details.includes('enetunreach') ||
    details.includes('server selection timed out')
  ) {
    return 'network_access_denied_or_timeout';
  }

  if (
    errorName.includes('serverselection') ||
    details.includes('server selection') ||
    details.includes('replicasetnoprimary') ||
    details.includes('unknown')
  ) {
    return 'server_selection_failed';
  }

  return 'unknown';
}

function safeError(error) {
  if (!error) return null;

  return {
    errorClass: classifyMongoError(error),
  };
}

export function createMongoService(config) {
  const mongodbUri = config.mongodbUri || '';
  const mongodbDbName = config.mongodbDbName || 'ultreia_production';

  let client = null;
  let db = null;
  let connected = false;
  let lastError = null;

  function getStatus() {
    if (!mongodbUri) {
      return {
        configured: false,
        connected: false,
        status: 'not_configured',
      };
    }

    if (connected) {
      return {
        configured: true,
        connected: true,
        status: 'connected',
      };
    }

    if (lastError) {
      return {
        configured: true,
        connected: false,
        status: 'error',
        ...safeError(lastError),
      };
    }

    return {
      configured: true,
      connected: false,
      status: 'disconnected',
    };
  }

  async function connect() {
    if (!mongodbUri) return getStatus();
    if (connected) return getStatus();

    try {
      client = new MongoClient(mongodbUri, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db(mongodbDbName);
      await db.command({ ping: 1 });
      await ensureIndexes(db, config.heartbeatTtlSeconds, config.diagnosticTtlSeconds);
      connected = true;
      lastError = null;
    } catch (error) {
      lastError = error;
      connected = false;
      db = null;

      if (client) {
        await client.close().catch(() => {});
        client = null;
      }
    }

    return getStatus();
  }

  async function disconnect() {
    if (client) {
      await client.close();
    }

    client = null;
    db = null;
    connected = false;
  }

  function getDb() {
    return db;
  }

  return {
    connect,
    disconnect,
    getDb,
    getStatus,
  };
}

async function ensureIndexes(database, heartbeatTtlSeconds = 604800, diagnosticTtlSeconds = 2592000) {
  await database.collection('providerProfiles').dropIndex('userId_unique').catch(() => {});
  await Promise.all([
    database.collection('devices').createIndex({ deviceId: 1 }, { unique: true, name: 'deviceId_unique' }),
    database.collection('pushRegistrations').createIndex({ token: 1 }, { unique: true, name: 'token_unique' }),
    database.collection('pushRegistrations').createIndex({ deviceId: 1, enabled: 1 }, { name: 'device_enabled' }),
    database.collection('devices').createIndex({ lastLocation: '2dsphere' }, { name: 'lastLocation_2dsphere' }),
    database.collection('locationHeartbeats').createIndex({ location: '2dsphere' }, { name: 'location_2dsphere' }),
    database.collection('locationHeartbeats').createIndex({ createdAt: 1 }, { expireAfterSeconds: heartbeatTtlSeconds, name: 'createdAt_ttl' }),
    database.collection('geofenceEvents').createIndex({ deviceId: 1, receivedAt: -1 }, { name: 'device_receivedAt' }),
    database.collection('diagnosticEvents').createIndex({ deviceId: 1, createdAt: -1 }, { name: 'device_createdAt' }),
    database.collection('diagnosticEvents').createIndex({ createdAt: 1 }, { expireAfterSeconds: diagnosticTtlSeconds, name: 'createdAt_ttl' }),
    database.collection('users').createIndex({ emailNormalized: 1 }, { unique: true, name: 'emailNormalized_unique' }),
    database.collection('pilgrimProfiles').createIndex({ userId: 1 }, { unique: true, name: 'userId_unique' }),
    database.collection('providerProfiles').createIndex({ userId: 1, scope: 1 }, { unique: true, name: 'user_scope_unique' }),
    database.collection('needs').createIndex({ key: 1 }, { unique: true, name: 'key_unique' }),
    database.collection('needs').createIndex({ status: 1, sortOrder: 1 }, { name: 'status_sortOrder' }),
    database.collection('offers').createIndex({ providerId: 1, scope: 1, updatedAt: -1 }, { name: 'provider_scope_updatedAt' }),
    database.collection('offers').createIndex({ scope: 1, status: 1 }, { name: 'scope_status' }),
    database.collection('offers').createIndex({ scope: 1, needKeys: 1 }, { name: 'scope_needKeys' }),
    database.collection('offers').createIndex({ confirmationDueAt: 1 }, { name: 'confirmationDueAt' }),
    database.collection('devices').createIndex({ userId: 1, status: 1 }, { name: 'user_status' }),
    database.collection('magicLinks').createIndex({ tokenHash: 1 }, { unique: true, name: 'tokenHash_unique' }),
    database.collection('magicLinks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expiresAt_ttl' }),
    database.collection('sessions').createIndex({ accessTokenHash: 1 }, { unique: true, name: 'accessTokenHash_unique' }),
    database.collection('sessions').createIndex({ refreshTokenHash: 1 }, { unique: true, name: 'refreshTokenHash_unique' }),
    database.collection('sessions').createIndex({ refreshExpiresAt: 1 }, { expireAfterSeconds: 0, name: 'refreshExpiresAt_ttl' }),
    database.collection('trips').createIndex(
      { pilgrimUserId: 1, scope: 1 },
      { unique: true, name: 'one_noncompleted_trip_per_scope', partialFilterExpression: { status: { $in: ['active', 'paused'] } } },
    ),
    database.collection('trips').createIndex({ pilgrimUserId: 1, scope: 1, status: 1, updatedAt: -1 }, { name: 'trip_user_scope_status' }),
  ]);
}
