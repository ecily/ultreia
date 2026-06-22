import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { loadLocalEnvFile } from './config/loadEnvFile.js';
import { createMongoService } from './db/mongoClient.js';

loadLocalEnvFile();
const config = loadConfig();
const databaseService = createMongoService(config);
await databaseService.connect();

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
