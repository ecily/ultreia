import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

const config = {
  nodeEnv: 'test',
  port: 0,
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
  serviceName: 'ultreia-backend',
  version: '0.1.0',
  commitShort: 'unknown',
  mongodbUri: '',
  mongodbDbName: 'ultreia_staging',
};

describe('GET /api/health', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp(config);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it('returns process-level backend health without requiring a database', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'ultreia-backend');
    assert.equal(body.status, 'ok');
    assert.equal(body.environment, 'test');
    assert.equal(body.version, '0.1.0');
    assert.equal(body.commitShort, 'unknown');
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(body.database, {
      configured: false,
      connected: false,
      status: 'not_configured',
    });
    assert.equal(Object.hasOwn(body, 'commitSha'), false);
  });

  it('applies configured CORS origins only', async () => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    const denied = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://example.invalid' },
    });

    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });

  it('allows the provider PUT preflight without opening other origins', async () => {
    for (const path of ['/api/provider/profile', '/api/provider/location']) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type,x-ultreia-web',
        },
      });

      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assert.deepEqual(
        response.headers.get('access-control-allow-methods').split(','),
        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      );
    }

    const denied = await fetch(`${baseUrl}/api/provider/profile`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.invalid',
        'Access-Control-Request-Method': 'PUT',
      },
    });

    assert.equal(denied.status, 204);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal(denied.headers.get('access-control-allow-credentials'), null);
  });

  it('keeps readiness red when the database is not connected', async () => {
    const response = await fetch(`${baseUrl}/api/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.status, 'not_ready');
    assert.equal(body.checks.database.status, 'not_configured');
  });
});
