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
    assert.equal(Object.hasOwn(body, 'database'), false);
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
});
