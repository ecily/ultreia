import { createApp } from './app.js';
import { loadConfig, validateRuntimeConfig } from './config/env.js';
import { loadLocalEnvFile } from './config/loadEnvFile.js';
import { createMongoService } from './db/mongoClient.js';

const requestedMode = process.env.ULTREIA_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
if (requestedMode !== 'production') loadLocalEnvFile();
const config = loadConfig();
const validation = validateRuntimeConfig(config);
if (!validation.ok) {
  console.error(JSON.stringify({ event: 'invalid_runtime_config', missing: validation.errors }));
  process.exitCode = 1;
  throw new Error('Invalid Ultreia runtime configuration');
}
const databaseService = createMongoService(config);
const databaseStatus = await databaseService.connect();
if (!databaseStatus.connected) console.error(JSON.stringify({ event: 'mongo_not_ready_at_startup', status: databaseStatus.status, errorClass: databaseStatus.errorClass || null }));

const app = createApp(config, { databaseService });

const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} listening on port ${config.port}`);
});

async function shutdown(signal) {
  console.log(`${config.serviceName} received ${signal}, shutting down`);
  server.close(async () => {
    await databaseService.disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
