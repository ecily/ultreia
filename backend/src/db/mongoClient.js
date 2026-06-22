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
  const mongodbDbName = config.mongodbDbName || 'ultreia_staging';

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
