import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config/env.js';
import { loadLocalEnvFile } from '../src/config/loadEnvFile.js';
import { createMongoService } from '../src/db/mongoClient.js';

if (process.env.ULTREIA_MODE !== 'production') loadLocalEnvFile();
const config = loadConfig();
if (!config.mongodbUri) throw new Error('MONGODB_URI is required for database verification');

const service = createMongoService(config);
const auditId = `ultreia-db-verify-${randomUUID()}`;
const deviceId = `ultreia-db-device-${randomUUID()}`;
let db;

try {
  const connected = await service.connect();
  if (!connected.connected) throw new Error(`Mongo is not ready: ${connected.status}`);
  db = service.getDb();
  await db.collection('diagnosticEvents').insertOne({ auditId, type: 'verify_db', createdAt: new Date() });
  const read = await db.collection('diagnosticEvents').findOne({ auditId }, { projection: { _id: 0, auditId: 1 } });
  await db.collection('devices').insertOne({ deviceId, lastLocation: { type: 'Point', coordinates: [-3.1883, 43.3449] }, createdAt: new Date() });
  const geo = await db.collection('devices').aggregate([
    { $geoNear: { near: { type: 'Point', coordinates: [-3.1883, 43.3449] }, key: 'lastLocation', distanceField: 'distanceMeters', maxDistance: 1000, spherical: true, query: { deviceId } } },
    { $limit: 1 },
  ]).toArray();
  const indexes = {
    devices: (await db.collection('devices').listIndexes().toArray()).map((index) => index.name).sort(),
    locationHeartbeats: (await db.collection('locationHeartbeats').listIndexes().toArray()).map((index) => index.name).sort(),
    diagnosticEvents: (await db.collection('diagnosticEvents').listIndexes().toArray()).map((index) => index.name).sort(),
  };
  if (!read || read.auditId !== auditId || geo.length !== 1) throw new Error('Database verification assertion failed');
  console.log(JSON.stringify({ status: 'verified', database: config.mongodbDbName, writeRead: true, geo: true, indexes }));
} finally {
  if (db) {
    await db.collection('diagnosticEvents').deleteMany({ auditId }).catch(() => {});
    await db.collection('devices').deleteMany({ deviceId }).catch(() => {});
  }
  await service.disconnect().catch(() => {});
}
