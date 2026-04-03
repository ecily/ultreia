import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Category from '../models/Category.js';
import Subcategory from '../models/Subcategory.js';
import Provider from '../models/Provider.js';
import Offer from '../models/Offer.js';
import User from '../models/User.js';

const MONGO_URI = process.env.MONGO_URI;
const SEED_TAG = process.env.SEED_TAG || 'gratwein_real_v1';
const TARGET = Number(process.env.SEED_PROVIDERS || 50);
const PLACE_QUERY = process.env.SEED_PLACE || '8111 Gratwein-Strassengel Austria';

if (!MONGO_URI) {
  console.error('MONGO_URI missing');
  process.exit(1);
}

const CATALOG = [
  { name: 'Gastronomie', subs: ['Restaurant', 'Cafe', 'Baeckerei', 'Bar'] },
  { name: 'Lebensmittel & Alltag', subs: ['Supermarkt', 'Drogerie', 'Apotheke', 'Kiosk'] },
  { name: 'Gesundheit', subs: ['Allgemeinmedizin', 'Zahnarzt', 'Physiotherapie', 'Optik'] },
  { name: 'Beauty & Koerperpflege', subs: ['Friseur', 'Kosmetikstudio', 'Nagelstudio', 'Massage'] },
  { name: 'Mode & Accessoires', subs: ['Damenmode', 'Herrenmode', 'Schuhe', 'Schmuck'] },
  { name: 'Wohnen & Haushalt', subs: ['Moebel', 'Haushaltswaren', 'Baumarkt', 'Elektrofachhandel'] },
  { name: 'Mobilitaet & Auto', subs: ['KFZ-Werkstatt', 'Fahrradservice', 'Autohaus', 'Reifenservice'] },
  { name: 'Sport & Freizeit', subs: ['Fitnessstudio', 'Yogastudio', 'Tanzschule', 'Schwimmbad'] },
  { name: 'Kultur & Bildung', subs: ['Buchhandlung', 'Kino', 'Nachhilfe', 'Sprachschule'] },
  { name: 'Nachtleben & Events', subs: ['Club', 'Cocktailbar', 'Pub', 'Live-Musik'] },
  { name: 'Dienstleistungen', subs: ['Reinigung', 'Schneiderei', 'Copyshop', 'Handyreparatur'] },
  { name: 'Familie & Kinder', subs: ['Spielwaren', 'Babyartikel', 'Kinderbetreuung', 'Indoor-Spielplatz'] },
];

const OFFER_TYPES = {
  Gastronomie: ['Mittagsmenue', 'Fruehstuecksangebot', 'After-Work-Deal'],
  'Lebensmittel & Alltag': ['Wochenaktion', '2+1 Angebot', 'Saisonaktion'],
  Gesundheit: ['Erstberatung', 'Vorsorge-Slot', 'Check-Paket'],
  'Beauty & Koerperpflege': ['Neukundenrabatt', 'Kombi-Behandlung', 'Last-Minute-Termin'],
  'Mode & Accessoires': ['Saisonrabatt', 'Abverkauf', '2. Teil reduziert'],
  'Wohnen & Haushalt': ['Set-Angebot', 'Beratungsaktion', 'Wochenend-Deal'],
  'Mobilitaet & Auto': ['Servicepaket', 'Check-Aktion', 'Inspektionsangebot'],
  'Sport & Freizeit': ['Probetraining gratis', 'Schnupperkurs', 'Abendkurs-Special'],
  'Kultur & Bildung': ['Schnupperstunde', 'Workshop-Slot', 'Kursrabatt'],
  'Nachtleben & Events': ['Happy Hour', 'Event-Special', 'Late-Night-Deal'],
  Dienstleistungen: ['Express-Service', 'Neukundenpreis', 'Kombi-Service'],
  'Familie & Kinder': ['Familienpaket', 'Geschwisterrabatt', 'Ferienaktion'],
};

function slugify(v) {
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function offerSchedule(categoryName) {
  if (categoryName === 'Nachtleben & Events') return { validDays: ['Thursday', 'Friday', 'Saturday'], validTimes: { from: '20:00', to: '23:59' } };
  if (categoryName === 'Gastronomie') return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], validTimes: { from: '11:30', to: '14:30' } };
  if (categoryName === 'Gesundheit') return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '08:00', to: '16:00' } };
  return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '10:00', to: '18:00' } };
}

async function ensureCatalog() {
  const categoryByName = new Map();
  const subByKey = new Map();

  for (let i = 0; i < CATALOG.length; i++) {
    const c = CATALOG[i];
    const cat = await Category.findOneAndUpdate(
      { $or: [{ slug: slugify(c.name) }, { name: c.name }] },
      { $set: { name: c.name, slug: slugify(c.name), isActive: true, sortOrder: i, subcategories: c.subs } },
      { new: true, upsert: true }
    );
    categoryByName.set(c.name, cat);

    for (let j = 0; j < c.subs.length; j++) {
      const s = c.subs[j];
      const sub = await Subcategory.findOneAndUpdate(
        { category: cat._id, slug: slugify(s) },
        { $set: { name: s, slug: slugify(s), isActive: true, sortOrder: j, category: cat._id } },
        { new: true, upsert: true }
      );
      subByKey.set(`${c.name}|${s}`, sub);
    }
  }

  return { categoryByName, subByKey };
}

async function ensureSeedUser() {
  const email = `seed+${SEED_TAG}@stepsmatch.local`;
  let user = await User.findOne({ email });
  if (!user) {
    const password = await bcrypt.hash('seed-password-123', 10);
    user = await User.create({ name: `Seed User ${SEED_TAG}`, email, password, interests: [] });
  }
  return user;
}

function mapTagsToCategory(tags = {}) {
  const shop = String(tags.shop || '').toLowerCase();
  const amenity = String(tags.amenity || '').toLowerCase();
  const healthcare = String(tags.healthcare || '').toLowerCase();

  if (['restaurant', 'cafe', 'bakery', 'bar', 'pub', 'fast_food', 'ice_cream'].includes(amenity) || ['bakery', 'cafe', 'confectionery', 'alcohol'].includes(shop)) {
    if (amenity === 'bar' || amenity === 'pub') return { category: 'Nachtleben & Events', subcategory: 'Pub' };
    if (shop === 'bakery' || amenity === 'bakery') return { category: 'Gastronomie', subcategory: 'Baeckerei' };
    if (amenity === 'cafe' || shop === 'cafe') return { category: 'Gastronomie', subcategory: 'Cafe' };
    return { category: 'Gastronomie', subcategory: 'Restaurant' };
  }

  if (['supermarket', 'convenience', 'kiosk', 'chemist'].includes(shop) || amenity === 'pharmacy') {
    if (amenity === 'pharmacy' || shop === 'chemist') return { category: 'Lebensmittel & Alltag', subcategory: 'Apotheke' };
    if (shop === 'kiosk' || shop === 'convenience') return { category: 'Lebensmittel & Alltag', subcategory: 'Kiosk' };
    return { category: 'Lebensmittel & Alltag', subcategory: 'Supermarkt' };
  }

  if (healthcare || ['doctors', 'dentist', 'clinic', 'hospital', 'pharmacy'].includes(amenity)) {
    if (amenity === 'dentist') return { category: 'Gesundheit', subcategory: 'Zahnarzt' };
    if (healthcare.includes('physio')) return { category: 'Gesundheit', subcategory: 'Physiotherapie' };
    return { category: 'Gesundheit', subcategory: 'Allgemeinmedizin' };
  }

  if (['hairdresser', 'beauty', 'spa'].includes(shop) || ['beauty_salon', 'hairdresser'].includes(amenity)) {
    if (shop === 'hairdresser' || amenity === 'hairdresser') return { category: 'Beauty & Koerperpflege', subcategory: 'Friseur' };
    return { category: 'Beauty & Koerperpflege', subcategory: 'Kosmetikstudio' };
  }

  if (['clothes', 'shoes', 'jewelry', 'fashion'].includes(shop)) {
    if (shop === 'shoes') return { category: 'Mode & Accessoires', subcategory: 'Schuhe' };
    if (shop === 'jewelry') return { category: 'Mode & Accessoires', subcategory: 'Schmuck' };
    return { category: 'Mode & Accessoires', subcategory: 'Damenmode' };
  }

  if (['car_repair', 'car', 'motorcycle', 'car_parts', 'bicycle'].includes(shop) || ['fuel', 'car_wash'].includes(amenity)) {
    if (shop === 'bicycle') return { category: 'Mobilitaet & Auto', subcategory: 'Fahrradservice' };
    if (shop === 'car') return { category: 'Mobilitaet & Auto', subcategory: 'Autohaus' };
    return { category: 'Mobilitaet & Auto', subcategory: 'KFZ-Werkstatt' };
  }

  if (['sports', 'fitness'].includes(shop) || ['gym', 'sports_centre', 'swimming_pool'].includes(amenity)) {
    if (amenity === 'swimming_pool') return { category: 'Sport & Freizeit', subcategory: 'Schwimmbad' };
    return { category: 'Sport & Freizeit', subcategory: 'Fitnessstudio' };
  }

  if (['books', 'stationery', 'copyshop'].includes(shop) || ['library', 'cinema'].includes(amenity)) {
    if (amenity === 'cinema') return { category: 'Kultur & Bildung', subcategory: 'Kino' };
    if (shop === 'books') return { category: 'Kultur & Bildung', subcategory: 'Buchhandlung' };
    return { category: 'Dienstleistungen', subcategory: 'Copyshop' };
  }

  if (['laundry', 'tailor', 'electronics_repair', 'mobile_phone'].includes(shop) || ['post_office', 'bank'].includes(amenity)) {
    if (shop === 'laundry') return { category: 'Dienstleistungen', subcategory: 'Reinigung' };
    if (shop === 'tailor') return { category: 'Dienstleistungen', subcategory: 'Schneiderei' };
    return { category: 'Dienstleistungen', subcategory: 'Handyreparatur' };
  }

  return { category: 'Dienstleistungen', subcategory: 'Handyreparatur' };
}

function addrFromTags(tags = {}) {
  const parts = [
    [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    tags['addr:postcode'],
    tags['addr:city'] || tags['addr:place'] || 'Gratwein-Strassengel',
  ].filter(Boolean);
  return parts.join(', ');
}

async function geocodeBbox(placeQuery) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(placeQuery)}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'stepsmatch-seed/1.0' } });
  if (!r.ok) throw new Error(`nominatim failed ${r.status}`);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('nominatim no result');
  const bb = rows[0].boundingbox.map(Number); // [south,north,west,east]
  return { south: bb[0], north: bb[1], west: bb[2], east: bb[3] };
}

async function overpassFetch({ south, west, north, east }) {
  const query = `[out:json][timeout:60];\n(\n  node["name"]["shop"](${south},${west},${north},${east});\n  node["name"]["amenity"](${south},${west},${north},${east});\n  node["name"]["healthcare"](${south},${west},${north},${east});\n  way["name"]["shop"](${south},${west},${north},${east});\n  way["name"]["amenity"](${south},${west},${north},${east});\n  way["name"]["healthcare"](${south},${west},${north},${east});\n);\nout center tags;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ];

  let lastErr = null;
  for (const ep of endpoints) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'stepsmatch-seed/1.0' },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!r.ok) throw new Error(`overpass failed ${r.status} @ ${ep}`);
        const json = await r.json();
        return Array.isArray(json?.elements) ? json.elements : [];
      } catch (e) {
        lastErr = e;
      }
    }
  }

  throw lastErr || new Error('overpass failed');
}

function normalizeElements(elements = []) {
  const out = [];
  const seen = new Set();

  for (const e of elements) {
    const tags = e?.tags || {};
    const name = String(tags.name || '').trim();
    if (!name) continue;

    const lat = Number(e?.lat ?? e?.center?.lat);
    const lng = Number(e?.lon ?? e?.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${name.toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      lat,
      lng,
      tags,
      address: addrFromTags(tags),
    });
  }

  return out;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('[seed:gratwein] connected');

  const { categoryByName, subByKey } = await ensureCatalog();
  const seedUser = await ensureSeedUser();

  await Offer.deleteMany({ contact: new RegExp(`SEED:${SEED_TAG}`) });
  await Provider.deleteMany({ description: new RegExp(`SEED:${SEED_TAG}`) });

  const bb = await geocodeBbox(PLACE_QUERY);

  let pool = [];
  const scales = [1.0, 1.35, 1.7];
  for (const scale of scales) {
    const latPad = (bb.north - bb.south) * (scale - 1) / 2;
    const lngPad = (bb.east - bb.west) * (scale - 1) / 2;
    const expanded = {
      south: bb.south - latPad,
      north: bb.north + latPad,
      west: bb.west - lngPad,
      east: bb.east + lngPad,
    };
    const elems = await overpassFetch(expanded);
    pool = normalizeElements(elems);
    if (pool.length >= TARGET) break;
  }

  if (!pool.length) throw new Error('no providers from OSM');

  const selected = pool.slice(0, TARGET);
  let providerCount = 0;
  let offerCount = 0;

  for (const row of selected) {
    const mapped = mapTagsToCategory(row.tags);
    let categoryName = mapped.category;
    let subName = mapped.subcategory;

    if (!categoryByName.has(categoryName)) categoryName = 'Dienstleistungen';
    const catDoc = categoryByName.get(categoryName);
    if (!subByKey.has(`${categoryName}|${subName}`)) {
      subName = CATALOG.find((c) => c.name === categoryName)?.subs?.[0] || 'Handyreparatur';
    }
    const subDoc = subByKey.get(`${categoryName}|${subName}`);

    const provider = await Provider.create({
      name: row.name,
      address: row.address || 'Gratwein-Strassengel, 8111',
      category: categoryName,
      categoryId: catDoc?._id || null,
      subcategory: subName,
      openingHours: {
        timezone: 'Europe/Vienna',
        mon: [{ from: '09:00', to: '18:00' }],
        tue: [{ from: '09:00', to: '18:00' }],
        wed: [{ from: '09:00', to: '18:00' }],
        thu: [{ from: '09:00', to: '18:00' }],
        fri: [{ from: '09:00', to: '18:00' }],
      },
      contact: { website: 'https://www.openstreetmap.org' },
      location: { type: 'Point', coordinates: [row.lng, row.lat] },
      user: seedUser._id,
      description: `SEED:${SEED_TAG}; source=OSM; place=8111 Gratwein-Strassengel`,
    });
    providerCount++;

    const offerType = pick(OFFER_TYPES[categoryName] || ['Wochenaktion']);
    const sched = offerSchedule(categoryName);
    const from = new Date();
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await Offer.create({
      provider: provider._id,
      name: `${offerType}`,
      category: categoryName,
      subcategory: subName,
      categoryId: catDoc?._id || null,
      subcategoryId: subDoc?._id || null,
      description: `${offerType} bei ${row.name} in 8111 Gratwein-Strassengel.`,
      radius: categoryName === 'Nachtleben & Events' ? 300 : 220,
      validDays: sched.validDays,
      validTimes: sched.validTimes,
      validDates: { from, to },
      location: { type: 'Point', coordinates: [row.lng, row.lat] },
      interestsRequired: [slugify(categoryName), slugify(subName)],
      contact: `SEED:${SEED_TAG}`,
      images: [],
    });
    offerCount++;
  }

  console.log(`[seed:gratwein] done providers=${providerCount} offers=${offerCount} tag=${SEED_TAG}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('[seed:gratwein] failed', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
