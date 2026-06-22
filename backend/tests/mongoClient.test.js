import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMongoService } from '../src/db/mongoClient.js';

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
    assert.equal(status.error.message, 'MongoDB connection failed');
    assert.equal(JSON.stringify(status).includes('configured-placeholder'), false);
  });

  it('maps connection errors to safe technical classes', async () => {
    const service = createMongoService({
      mongodbUri: 'configured-placeholder',
      mongodbDbName: 'ultreia_staging',
    });

    const status = await service.connect();

    assert.match(
      status.error.code,
      /^(network_access_denied|authentication_failed|dns_or_srv_failed|tls_error|timeout|unknown)$/
    );
  });
});
