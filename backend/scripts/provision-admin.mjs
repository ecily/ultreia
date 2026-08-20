import { pathToFileURL } from 'node:url';
import { loadConfig } from '../src/config/env.js';
import { createMongoService } from '../src/db/mongoClient.js';
import { normalizeEmail } from '../src/services/authService.js';

export function readAdminProvisionInput(env = process.env) {
  if (env.ADMIN_PROVISION_CONFIRM !== 'ULTREIA_ADMIN_PROVISION_V1') throw new Error('ADMIN_PROVISION_CONFIRM is required');
  return normalizeEmail(env.ADMIN_PROVISION_EMAIL);
}

export async function provisionAdmin(databaseService, email) {
  const users = databaseService.getDb().collection('users');
  const user = await users.findOne({ emailNormalized: email });
  if (!user || user.status !== 'active') throw new Error('admin_target_not_found_or_inactive');
  const alreadyAdmin = user.roles?.includes('admin') === true;
  if (!alreadyAdmin) await users.updateOne({ _id: user._id, status: 'active' }, { $addToSet: { roles: 'admin' }, $set: { updatedAt: new Date() } });
  return { status: alreadyAdmin ? 'admin_already_provisioned' : 'admin_provisioned', roleAdded: !alreadyAdmin };
}

async function main() {
  const email = readAdminProvisionInput();
  const config = loadConfig();
  if (config.runtimeMode !== 'production') throw new Error('production_mode_required');
  if (!config.mongodbUri) throw new Error('MONGODB_URI is required');
  const service = createMongoService(config);
  try {
    await service.connect();
    const result = await provisionAdmin(service, email);
    console.log(JSON.stringify(result));
  } finally {
    await service.disconnect().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
