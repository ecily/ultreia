import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`${config.serviceName} received ${signal}, shutting down`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
