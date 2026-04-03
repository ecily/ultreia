import 'dotenv/config';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Provider from '../models/Provider.js';
import User from '../models/User.js';

const MONGO_URI = process.env.MONGO_URI;
const SEED_TAG = process.env.SEED_TAG || 'graz_seed_v1';

async function run() {
  if (!MONGO_URI) throw new Error('MONGO_URI missing');
  await mongoose.connect(MONGO_URI);

  const email = `seed+${SEED_TAG}@ultreia.local`;
  const user = await User.findOne({ email }).lean();
  const userId = user?._id || null;

  const offerDel = await Offer.deleteMany({ contact: new RegExp(`SEED:${SEED_TAG}`) });
  const providerDel = await Provider.deleteMany({ address: new RegExp(`SEED:${SEED_TAG}`) });
  if (userId) await User.deleteOne({ _id: userId });

  console.log(`[seed:reset] offers=${offerDel.deletedCount} providers=${providerDel.deletedCount} user=${userId ? 1 : 0}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('[seed:reset] failed', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});

