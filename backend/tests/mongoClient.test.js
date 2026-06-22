import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyMongoError, createMongoService } from '../src/db/mongoClient.js';

describe('mongo service', () => {
  it('is not configured when MONGODB_URI is missing', async () => {
    const service = createMongoService({
      mongodbUri: '',
      mongodbDbName: 'ultreia_staging',
    });

    assert.deepEqual(service.getStatus(), {
      configured: false,
      connected: false,
      status: 'not_configured',
    });
    assert.equal(service.getDb(), null);
    assert.deepEqual(await service.connect(), {
      configured: false,
      connected: false,
      status: 'not_configured',
    });
  });

  it('reports disconnected before connecting when MONGODB_URI is configured', () => {
    const service = createMongoService({
      mongodbUri: 'configured-placeholder',
      mongodbDbName: 'ultreia_staging',
    });

    assert.deepEqual(service.getStatus(), {
      configured: true,
      connected: false,
      status: 'disconnected',
    });
  });

  it('returns a generic error without exposing the configured URI value', async () => {
    const service = createMongoService({
      mongodbUri: 'configured-placeholder',
      mongodbDbName: 'ultreia_staging',
    });

    const status = await service.connect();

    assert.equal(status.configured, true);
    assert.equal(status.connected, false);
    assert.equal(status.status, 'error');
    assert.equal(typeof status.errorClass, 'string');
    assert.equal(JSON.stringify(status).includes('configured-placeholder'), false);
  });

  it('maps connection errors to safe technical classes', async () => {
    const service = createMongoService({
      mongodbUri: 'configured-placeholder',
      mongodbDbName: 'ultreia_staging',
    });

    const status = await service.connect();

    assert.match(
      status.errorClass,
      /^(network_access_denied_or_timeout|authentication_failed|dns_or_srv_failed|tls_error|invalid_uri|server_selection_failed|unknown)$/
    );
  });

  it('classifies representative MongoDB errors without exposing raw details', () => {
    assert.equal(classifyMongoError({ name: 'MongoParseError', message: 'Invalid connection string' }), 'invalid_uri');
    assert.equal(classifyMongoError({ name: 'MongoServerError', code: 18, message: 'Authentication failed' }), 'authentication_failed');
    assert.equal(classifyMongoError({ name: 'Error', code: 'ENOTFOUND', message: 'querySrv ENOTFOUND' }), 'dns_or_srv_failed');
    assert.equal(classifyMongoError({ name: 'MongoNetworkError', message: 'self-signed certificate' }), 'tls_error');
    assert.equal(
      classifyMongoError({ name: 'MongoServerSelectionError', message: 'Server selection timed out after 5000 ms' }),
      'network_access_denied_or_timeout'
    );
    assert.equal(
      classifyMongoError({ name: 'MongoServerSelectionError', message: 'ReplicaSetNoPrimary' }),
      'server_selection_failed'
    );
  });
});
