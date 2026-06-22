import { MongoClient } from 'mongodb';

function classifyMongoError(error) {
  const details = `${error?.name || ''} ${error?.code || ''} ${error?.message || ''}`.toLowerCase();

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

  if (details.includes('timeout') || details.includes('timed out') || details.includes('etimedout')) {
    return 'timeout';
  }

  if (
    details.includes('econnrefused') ||
    details.includes('econnreset') ||
    details.includes('ehostunreach') ||
    details.includes('enetunreach')
  ) {
    return 'network_access_denied';
  }

  return 'unknown';
}

function safeError(error) {
  if (!error) return null;

  return {
    code: classifyMongoError(error),
    message: 'MongoDB connection failed',
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
        error: safeError(lastError),
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
