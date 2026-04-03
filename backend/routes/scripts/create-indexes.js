// scripts/create-indexes.js
import 'dotenv/config';
import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

if (!uri) {
  console.error('❌ Keine MongoDB-URI gefunden (MONGODB_URI / MONGO_URI / DATABASE_URL).');
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri, { maxPoolSize: 10 });
  const db = mongoose.connection.db;
  console.log('✅ Verbunden mit DB:', db.databaseName);

  // Mongoose pluralisiert "Offer" → Collection heißt i. d. R. "offers"
  const col = db.collection('offers');

  // WICHTIG: Geo-Index für $geoNear
  await col.createIndex({ location: '2dsphere' }, { name: 'location_2dsphere' });
  // Hilfsindizes – häufige Filter
  await col.createIndex({ subcategory: 1 }, { name: 'subcategory_1' });
  await col.createIndex({ provider: 1 }, { name: 'provider_1' });

  const indexes = await col.indexes();
  console.log('📌 Indizes auf "offers":');
  console.table(indexes.map(i => ({ name: i.name, key: JSON.stringify(i.key) })));

  await mongoose.disconnect();
  console.log('✅ Fertig.');
}

run().catch(err => {
  console.error('❌ Fehler beim Erstellen der Indizes:', err?.message || err);
  process.exit(1);
});
