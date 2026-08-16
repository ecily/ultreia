import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

const config = {
  nodeEnv: 'test', port: 0, corsOrigins: [], logLevel: 'silent', serviceName: 'ultreia-backend',
  version: '0.1.0', commitShort: 'unknown', mongodbUri: '', mongodbDbName: 'ultreia_production',
  expoProjectId: '', expoAccessToken: '', pushTestEnabled: false, pushTestKey: '',
};

describe('technical routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createApp(config).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  it('rejects malformed device ids before touching the database', async () => {
    const response = await fetch(`${baseUrl}/api/devices/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: 'bad' }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.status, 'invalid_request');
  });

  it('does not expose the push test endpoint while disabled', async () => {
    const response = await fetch(`${baseUrl}/api/push/test`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-ultreia-test-key': 'wrong' }, body: JSON.stringify({ deviceId: 'not-used' }),
    });
    assert.equal(response.status, 404);
  });
});
