// backend/scripts/ensure-indexes.mjs
// Legt fehlende Geo-Indizes idempotent an (safe bei mehrfacher Ausführung).
import { MongoClient } from 'mongodb';

// ⚠️ Deine URI (wie gepostet). Optional kann stattdessen process.env.MONGODB_URI genutzt werden.
const URI = process.env.MONGODB_URI
  || 'mongodb+srv://ecily:wSOf4GQZ7fyBqy6x@ultreia.sxs9dfq.mongodb.net/ultreia?retryWrites=true&w=majority&appName=ultreia';

const client = new MongoClient(URI);

async function run() {
  await client.connect();
  // DB aus URI ziehen; fallback 'ultreia'
  const path = new URL(URI.replace('mongodb+srv://','mongodb://')).pathname || '';
  const dbName = path.startsWith('/') ? path.slice(1) : (path || 'ultreia');
  const db = client.db(dbName || 'ultreia');

  // Kandidaten-Collections (unterschiedliche Schreibweisen)
  const tokenCollections = ['pushTokens', 'pushtokens'];

  for (const coll of tokenCollections) {
    try {
      const res = await db.collection(coll).createIndex(
        { lastLocation: '2dsphere' },
        { name: 'lastLocation_2dsphere' }
      );
      console.log(`[ok] ${coll}.lastLocation 2dsphere => ${res}`);
    } catch (e) {
      console.warn(`[skip] ${coll}: ${e.message}`);
    }
  }

  // Offers / Providers
  try {
    const r1 = await db.collection('offers').createIndex(
      { location: '2dsphere' },
      { name: 'offer_location_2dsphere' }
    );
    console.log(`[ok] offers.location 2dsphere => ${r1}`);
  } catch (e) {
    console.warn(`[skip] offers: ${e.message}`);
  }

  try {
    const r2 = await db.collection('providers').createIndex(
      { location: '2dsphere' },
      { name: 'provider_location_2dsphere' }
    );
    console.log(`[ok] providers.location 2dsphere => ${r2}`);
  } catch (e) {
    console.warn(`[skip] providers: ${e.message}`);
  }

  console.log('[done] geo indexes ensured');
  await client.close();
}

run().catch(async (e) => {
  console.error('[fail]', e);
  try { await client.close(); } catch {}
  process.exit(1);
});
