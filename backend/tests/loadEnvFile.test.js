import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { loadLocalEnvFile } from '../src/config/loadEnvFile.js';

describe('loadLocalEnvFile', () => {
  let dir;
  let file;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ultreia-env-'));
    file = join(dir, '.env');
    await writeFile(
      file,
      [
        '# local values',
        'PORT=4010',
        'MONGODB_DB_NAME="ultreia_staging"',
        'INVALID LINE',
        'EXISTING=from_file',
      ].join('\n')
    );
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads local env values without overriding existing values', () => {
    const targetEnv = { EXISTING: 'from_process' };
    const result = loadLocalEnvFile(file, targetEnv);

    assert.deepEqual(result, { loaded: true, count: 2 });
    assert.equal(targetEnv.PORT, '4010');
    assert.equal(targetEnv.MONGODB_DB_NAME, 'ultreia_staging');
    assert.equal(targetEnv.EXISTING, 'from_process');
  });

  it('is a no-op when the file is missing', () => {
    const targetEnv = {};
    const result = loadLocalEnvFile(join(dir, 'missing.env'), targetEnv);

    assert.deepEqual(result, { loaded: false });
    assert.deepEqual(targetEnv, {});
  });
});
