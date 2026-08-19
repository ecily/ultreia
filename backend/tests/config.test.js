import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig, validateRuntimeConfig } from '../src/config/env.js';

describe('runtime configuration', () => {
  it('defaults non-production execution to local mode', () => {
    const config = loadConfig({ NODE_ENV: 'development', PORT: '3000' });
    assert.equal(config.runtimeMode, 'local');
    assert.equal(validateRuntimeConfig(config).ok, true);
  });

  it('requires production database and CORS configuration', () => {
    const config = loadConfig({ NODE_ENV: 'production', ULTREIA_MODE: 'production' });
    const validation = validateRuntimeConfig(config);
    assert.equal(validation.ok, false);
    assert.deepEqual(validation.errors, ['MONGODB_URI', 'CORS_ORIGINS', 'AUTH_PUBLIC_BASE_URL=https://ultreia.app/auth/verify']);
  });

  it('accepts a complete production configuration without exposing values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      ULTREIA_MODE: 'production',
      PORT: '3000',
      MONGODB_URI: 'mongodb+srv://configured-placeholder',
      MONGODB_DB_NAME: 'ultreia_production',
      CORS_ORIGINS: 'https://www.ultreia.app',
      PUSH_TEST_ENABLED: 'false',
      AUTH_PUBLIC_BASE_URL: 'https://ultreia.app/auth/verify',
    });
    assert.deepEqual(validateRuntimeConfig(config), { ok: true, errors: [] });
  });
});
