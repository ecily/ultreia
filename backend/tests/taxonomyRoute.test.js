import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

const config = {
  nodeEnv: 'test',
  port: 0,
  corsOrigins: [],
  logLevel: 'silent',
  serviceName: 'ultreia-backend',
  version: '0.1.0',
  commitShort: 'unknown',
};

describe('GET /api/taxonomy/needs', () => {
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

  it('returns localized need category options', async () => {
    const response = await fetch(`${baseUrl}/api/taxonomy/needs?locale=de`);
    const body = await response.json();
    const sleep = body.items.find((item) => item.key === 'sleep');

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.locale, 'de');
    assert.deepEqual(sleep, { key: 'sleep', label: 'Schlafen' });
  });

  it('falls back to English for unsupported locales', async () => {
    const response = await fetch(`${baseUrl}/api/taxonomy/needs?locale=fr`);
    const body = await response.json();
    const sleep = body.items.find((item) => item.key === 'sleep');

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.locale, 'en');
    assert.deepEqual(sleep, { key: 'sleep', label: 'Sleep' });
  });
});
