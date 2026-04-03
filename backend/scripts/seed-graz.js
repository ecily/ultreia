import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import Category from '../models/Category.js';
import Subcategory from '../models/Subcategory.js';
import Provider from '../models/Provider.js';
import Offer from '../models/Offer.js';
import User from '../models/User.js';
import cloudinary from '../utils/cloudinary.js';

const MONGO_URI = process.env.MONGO_URI;
const SEED_TAG = process.env.SEED_TAG || 'graz_uni_real_v2';
const PROVIDERS_TARGET = Math.max(1, Number(process.env.SEED_PROVIDERS || 100));
const UNI_QUERY = process.env.SEED_UNI_QUERY || 'Universitaet Graz, Graz, Austria';
const UNI_FALLBACK_COORDS = {
  lat: 47.0778573,
  lng: 15.4498491,
  display: 'Fallback: Universitaet Graz Zentrum',
};

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

const STUDENT_FOCUS = new Set([
  'Gastronomie',
  'Nachtleben & Events',
  'Kultur & Bildung',
  'Sport & Freizeit',
  'Dienstleistungen',
  'Lebensmittel & Alltag',
  'Beauty & Koerperpflege',
  'Mode & Accessoires',
]);

const CATEGORY_WEIGHTS = {
  'Gastronomie': 0.26,
  'Nachtleben & Events': 0.2,
  'Kultur & Bildung': 0.14,
  'Dienstleistungen': 0.13,
  'Sport & Freizeit': 0.1,
  'Lebensmittel & Alltag': 0.08,
  'Beauty & Koerperpflege': 0.05,
  'Mode & Accessoires': 0.03,
  'Gesundheit': 0.01,
};

// Frei verwendbare Quellen laut jeweiliger Plattform-Lizenz (Testdaten-Zweck).
const IMAGE_SOURCE_BY_CATEGORY = {
  'Gastronomie': [
    'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg',
    'https://images.pexels.com/photos/2619967/pexels-photo-2619967.jpeg',
  ],
  'Nachtleben & Events': [
    'https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg',
    'https://images.pexels.com/photos/167446/pexels-photo-167446.jpeg',
  ],
  'Kultur & Bildung': [
    'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg',
    'https://images.pexels.com/photos/590493/pexels-photo-590493.jpeg',
  ],
  'Dienstleistungen': [
    'https://images.pexels.com/photos/4792509/pexels-photo-4792509.jpeg',
    'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg',
  ],
  'Sport & Freizeit': [
    'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg',
    'https://images.pexels.com/photos/3757376/pexels-photo-3757376.jpeg',
  ],
  'Lebensmittel & Alltag': [
    'https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg',
    'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg',
  ],
  'Beauty & Koerperpflege': [
    'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg',
    'https://images.pexels.com/photos/3993328/pexels-photo-3993328.jpeg',
  ],
  'Mode & Accessoires': [
    'https://images.pexels.com/photos/934070/pexels-photo-934070.jpeg',
    'https://images.pexels.com/photos/5709661/pexels-photo-5709661.jpeg',
  ],
  default: ['https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg'],
};

function slugify(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function inferAddress(tags = {}) {
  const street = String(tags['addr:street'] || '').trim();
  const house = String(tags['addr:housenumber'] || '').trim();
  const post = String(tags['addr:postcode'] || '').trim();
  const city = String(tags['addr:city'] || tags['addr:place'] || 'Graz').trim();
  const full = String(tags['addr:full'] || '').trim();

  if (street && house) {
    return `${street} ${house}, ${post ? `${post} ` : ''}${city}`.trim();
  }
  if (full) return full;
  if (street) {
    return `${street}, ${post ? `${post} ` : ''}${city}`.trim();
  }
  return '';
}

function addressQuality(tags = {}) {
  let s = 0;
  if (tags['addr:street']) s += 2;
  if (tags['addr:housenumber']) s += 2;
  if (tags['addr:postcode']) s += 1;
  if (tags['addr:city'] || tags['addr:place']) s += 1;
  if (tags['addr:full']) s += 1;
  return s;
}

function mapTagsToCategory(tags = {}, name = '') {
  const amenity = String(tags.amenity || '').toLowerCase();
  const shop = String(tags.shop || '').toLowerCase();
  const healthcare = String(tags.healthcare || '').toLowerCase();
  const leisure = String(tags.leisure || '').toLowerCase();
  const craft = String(tags.craft || '').toLowerCase();
  const office = String(tags.office || '').toLowerCase();
  const n = String(name || '').toLowerCase();

  if (['nightclub', 'stripclub'].includes(amenity)) return { category: 'Nachtleben & Events', subcategory: 'Club' };
  if (['pub', 'biergarten'].includes(amenity)) return { category: 'Nachtleben & Events', subcategory: 'Pub' };
  if (amenity === 'bar') return { category: 'Nachtleben & Events', subcategory: 'Cocktailbar' };
  if (n.includes('club') || n.includes('disco')) return { category: 'Nachtleben & Events', subcategory: 'Club' };

  if (['restaurant', 'fast_food', 'food_court'].includes(amenity)) return { category: 'Gastronomie', subcategory: 'Restaurant' };
  if (amenity === 'cafe' || shop === 'coffee') return { category: 'Gastronomie', subcategory: 'Cafe' };
  if (shop === 'bakery' || amenity === 'bakery') return { category: 'Gastronomie', subcategory: 'Baeckerei' };
  if (shop === 'ice_cream') return { category: 'Gastronomie', subcategory: 'Cafe' };

  if (['supermarket', 'convenience'].includes(shop)) return { category: 'Lebensmittel & Alltag', subcategory: 'Supermarkt' };
  if (shop === 'kiosk') return { category: 'Lebensmittel & Alltag', subcategory: 'Kiosk' };
  if (amenity === 'pharmacy' || shop === 'chemist') return { category: 'Lebensmittel & Alltag', subcategory: 'Apotheke' };
  if (shop === 'drugstore') return { category: 'Lebensmittel & Alltag', subcategory: 'Drogerie' };

  if (amenity === 'cinema') return { category: 'Kultur & Bildung', subcategory: 'Kino' };
  if (shop === 'books') return { category: 'Kultur & Bildung', subcategory: 'Buchhandlung' };
  if (['library', 'college', 'university', 'language_school', 'music_school'].includes(amenity)) {
    return { category: 'Kultur & Bildung', subcategory: 'Sprachschule' };
  }

  if (['gym', 'sports_centre', 'swimming_pool'].includes(amenity) || ['fitness'].includes(leisure) || shop === 'sports') {
    if (amenity === 'swimming_pool') return { category: 'Sport & Freizeit', subcategory: 'Schwimmbad' };
    return { category: 'Sport & Freizeit', subcategory: 'Fitnessstudio' };
  }

  if (shop === 'hairdresser' || amenity === 'hairdresser') return { category: 'Beauty & Koerperpflege', subcategory: 'Friseur' };
  if (shop === 'beauty' || amenity === 'beauty_salon') return { category: 'Beauty & Koerperpflege', subcategory: 'Kosmetikstudio' };
  if (amenity === 'spa') return { category: 'Beauty & Koerperpflege', subcategory: 'Massage' };

  if (shop === 'clothes') return { category: 'Mode & Accessoires', subcategory: 'Damenmode' };
  if (shop === 'shoes') return { category: 'Mode & Accessoires', subcategory: 'Schuhe' };
  if (shop === 'jewelry') return { category: 'Mode & Accessoires', subcategory: 'Schmuck' };

  if (healthcare || ['dentist', 'doctors', 'clinic', 'hospital'].includes(amenity)) {
    if (amenity === 'dentist') return { category: 'Gesundheit', subcategory: 'Zahnarzt' };
    if (healthcare.includes('physio')) return { category: 'Gesundheit', subcategory: 'Physiotherapie' };
    return { category: 'Gesundheit', subcategory: 'Allgemeinmedizin' };
  }

  if (shop === 'copyshop' || n.includes('copy') || n.includes('druck')) return { category: 'Dienstleistungen', subcategory: 'Copyshop' };
  if (shop === 'mobile_phone' || shop === 'electronics_repair') return { category: 'Dienstleistungen', subcategory: 'Handyreparatur' };
  if (shop === 'laundry' || amenity === 'laundry') return { category: 'Dienstleistungen', subcategory: 'Reinigung' };
  if (shop === 'tailor' || craft === 'tailor') return { category: 'Dienstleistungen', subcategory: 'Schneiderei' };
  if (office || amenity === 'post_office') return { category: 'Dienstleistungen', subcategory: 'Copyshop' };

  if (shop === 'toys') return { category: 'Familie & Kinder', subcategory: 'Spielwaren' };
  if (shop === 'baby_goods') return { category: 'Familie & Kinder', subcategory: 'Babyartikel' };

  return { category: 'Dienstleistungen', subcategory: 'Copyshop' };
}

function providerOpeningHours(category) {
  const empty = [];
  if (category === 'Nachtleben & Events') {
    return {
      timezone: 'Europe/Vienna',
      mon: empty,
      tue: empty,
      wed: [{ from: '20:00', to: '02:00' }],
      thu: [{ from: '20:00', to: '03:00' }],
      fri: [{ from: '20:00', to: '04:00' }],
      sat: [{ from: '20:00', to: '04:00' }],
      sun: [{ from: '19:00', to: '01:00' }],
    };
  }
  if (category === 'Gastronomie') {
    return {
      timezone: 'Europe/Vienna',
      mon: [{ from: '08:00', to: '22:00' }],
      tue: [{ from: '08:00', to: '22:00' }],
      wed: [{ from: '08:00', to: '22:00' }],
      thu: [{ from: '08:00', to: '23:00' }],
      fri: [{ from: '08:00', to: '23:00' }],
      sat: [{ from: '09:00', to: '23:00' }],
      sun: [{ from: '09:00', to: '21:00' }],
    };
  }
  if (category === 'Kultur & Bildung') {
    return {
      timezone: 'Europe/Vienna',
      mon: [{ from: '09:00', to: '19:00' }],
      tue: [{ from: '09:00', to: '19:00' }],
      wed: [{ from: '09:00', to: '19:00' }],
      thu: [{ from: '09:00', to: '20:00' }],
      fri: [{ from: '09:00', to: '18:00' }],
      sat: [{ from: '10:00', to: '16:00' }],
      sun: empty,
    };
  }
  if (category === 'Sport & Freizeit') {
    return {
      timezone: 'Europe/Vienna',
      mon: [{ from: '06:30', to: '22:30' }],
      tue: [{ from: '06:30', to: '22:30' }],
      wed: [{ from: '06:30', to: '22:30' }],
      thu: [{ from: '06:30', to: '22:30' }],
      fri: [{ from: '06:30', to: '21:00' }],
      sat: [{ from: '08:00', to: '20:00' }],
      sun: [{ from: '08:00', to: '20:00' }],
    };
  }
  return {
    timezone: 'Europe/Vienna',
    mon: [{ from: '09:00', to: '19:00' }],
    tue: [{ from: '09:00', to: '19:00' }],
    wed: [{ from: '09:00', to: '19:00' }],
    thu: [{ from: '09:00', to: '19:00' }],
    fri: [{ from: '09:00', to: '19:00' }],
    sat: [{ from: '10:00', to: '17:00' }],
    sun: [],
  };
}

function offerSchedule(category) {
  if (category === 'Nachtleben & Events') {
    return { validDays: ['Thursday', 'Friday', 'Saturday'], validTimes: { from: '21:00', to: '23:59' } };
  }
  if (category === 'Gastronomie') {
    const variants = [
      { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '11:30', to: '14:30' } },
      { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '15:00', to: '18:00' } },
      { validDays: ['Thursday', 'Friday', 'Saturday'], validTimes: { from: '18:00', to: '22:30' } },
    ];
    return pick(variants);
  }
  if (category === 'Kultur & Bildung') {
    return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '13:00', to: '19:00' } };
  }
  if (category === 'Sport & Freizeit') {
    return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], validTimes: { from: '16:00', to: '21:00' } };
  }
  return { validDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], validTimes: { from: '10:00', to: '19:00' } };
}

function offerText(category, subcategory, providerName) {
  const templates = {
    'Gastronomie': {
      title: ['Campus Lunch Deal', 'Study Break Special', 'After-Lecture Snack'],
      desc: [
        `Frisches ${subcategory}-Angebot bei ${providerName}: ideal zwischen zwei Vorlesungen.`,
        `Schneller ${subcategory}-Deal nahe Uni Graz - perfekt fuer kurze Lernpausen.`,
      ],
    },
    'Nachtleben & Events': {
      title: ['After-Lecture Happy Hour', 'Campus Night Special', 'Student Night Deal'],
      desc: [
        `Abendangebot bei ${providerName} fuer Studierende - ideal nach Seminarende.`,
        `Nightlife-Special in Uni-Naehe mit starkem Preisvorteil am Abend.`,
      ],
    },
    'Kultur & Bildung': {
      title: ['Study Support Deal', 'Campus Culture Special', 'Learning Boost Angebot'],
      desc: [
        `${subcategory}-Angebot bei ${providerName} fuer den Studienalltag.`,
        `Passendes ${subcategory}-Special fuer Lern- und Campuszeiten.`,
      ],
    },
    'Dienstleistungen': {
      title: ['Campus Service Deal', 'Quick Fix fuer Studierende', 'Student Service Angebot'],
      desc: [
        `Schneller ${subcategory}-Service bei ${providerName} im Uni-Umfeld.`,
        `${subcategory}-Leistung fuer Studierende: schnell, nah, alltagstauglich.`,
      ],
    },
    default: {
      title: ['Campus Vorteil', 'Studenten-Angebot', 'Uni-Naehe Special'],
      desc: [`${subcategory}-Angebot bei ${providerName}, abgestimmt auf den Studienalltag.`],
    },
  };

  const t = templates[category] || templates.default;
  return {
    name: pick(t.title),
    description: pick(t.desc),
  };
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

async function cleanupExistingTestData() {
  const seedUsers = await User.find({ email: /^seed\+.*@stepsmatch\.local$/i }).select('_id');
  const seedUserIds = seedUsers.map((u) => u._id);

  const providersBySeedUser = seedUserIds.length
    ? await Provider.find({ user: { $in: seedUserIds } }).select('_id')
    : [];
  const providerIds = providersBySeedUser.map((p) => p._id);

  const offerDel = await Offer.deleteMany({
    $or: [
      { provider: { $in: providerIds } },
      { contact: /SEED:/i },
      { description: /SEED:/i },
    ],
  });

  const providerDel = await Provider.deleteMany({
    $or: [
      { _id: { $in: providerIds } },
      { description: /SEED:/i },
      { address: /SEED:/i },
    ],
  });

  const userDel = await User.deleteMany({ email: /^seed\+.*@stepsmatch\.local$/i });

  console.log(`[cleanup] offers=${offerDel.deletedCount} providers=${providerDel.deletedCount} users=${userDel.deletedCount}`);
}

async function geocodeSingle(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'stepsmatch-seed/1.0' } });
  if (!res.ok) throw new Error(`nominatim failed: ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('nominatim no result');
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), display: rows[0].display_name };
}

async function geocodeCenter(query) {
  const candidates = [
    query,
    'Universitaet Graz, Graz, Austria',
    'University of Graz, Austria',
    'Universitaetsplatz 3, Graz, Austria',
    'Uni Graz',
  ].filter(Boolean);

  let lastErr = null;
  for (const q of candidates) {
    try {
      const c = await geocodeSingle(q);
      return c;
    } catch (e) {
      lastErr = e;
      console.warn(`[seed:graz] geocode failed for "${q}": ${String(e?.message || e)}`);
    }
  }

  console.warn('[seed:graz] geocode fallback coordinates in use');
  if (Number.isFinite(UNI_FALLBACK_COORDS.lat) && Number.isFinite(UNI_FALLBACK_COORDS.lng)) {
    return UNI_FALLBACK_COORDS;
  }
  throw lastErr || new Error('geocode failed without fallback');
}

async function overpassFetchAround(center, radiusM) {
  const query = `[out:json][timeout:120];\n(\n  node(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"shop\"];\n  node(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"amenity\"];\n  node(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"healthcare\"];\n  node(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"office\"];\n  way(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"shop\"];\n  way(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"amenity\"];\n  way(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"healthcare\"];\n  way(around:${radiusM},${center.lat},${center.lng})[\"name\"][\"office\"];\n);\nout center tags;`;

  const endpoints = [
    'http://overpass-api.de/api/interpreter',
    'http://lz4.overpass-api.de/api/interpreter',
    'http://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let lastErr = null;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'stepsmatch-seed/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`overpass ${ep} -> ${res.status}`);
      const json = await res.json();
      return Array.isArray(json?.elements) ? json.elements : [];
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('overpass fetch failed');
}

function normalizeElements(elements, center) {
  const seen = new Set();
  const rows = [];

  for (const el of elements || []) {
    const tags = el?.tags || {};
    const name = String(tags.name || '').trim();
    if (!name) continue;

    const lat = Number(el?.lat ?? el?.center?.lat);
    const lng = Number(el?.lon ?? el?.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${name.toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const mapped = mapTagsToCategory(tags, name);
    const addr = inferAddress(tags);
    if (!addr) continue;

    rows.push({
      name,
      lat,
      lng,
      tags,
      category: mapped.category,
      subcategory: mapped.subcategory,
      address: addr,
      quality: addressQuality(tags),
      distanceM: Math.round(haversineM(center, { lat, lng })),
    });
  }

  return rows;
}

function computeCategoryTargets(total) {
  const out = new Map();
  let assigned = 0;
  const keys = Object.keys(CATEGORY_WEIGHTS);
  for (const k of keys) {
    const n = Math.floor(total * CATEGORY_WEIGHTS[k]);
    out.set(k, n);
    assigned += n;
  }
  while (assigned < total) {
    for (const k of keys) {
      out.set(k, (out.get(k) || 0) + 1);
      assigned += 1;
      if (assigned >= total) break;
    }
  }
  return out;
}

function selectCandidates(rows, total) {
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  }

  for (const [cat, arr] of byCategory.entries()) {
    arr.sort((a, b) => {
      const q = b.quality - a.quality;
      if (q !== 0) return q;
      return a.distanceM - b.distanceM;
    });
    byCategory.set(cat, arr);
  }

  const targets = computeCategoryTargets(total);
  const selected = [];
  const taken = new Set();

  for (const [cat, need] of targets.entries()) {
    const pool = byCategory.get(cat) || [];
    let got = 0;
    for (const row of pool) {
      const k = `${row.name.toLowerCase()}|${row.address.toLowerCase()}`;
      if (taken.has(k)) continue;
      selected.push(row);
      taken.add(k);
      got += 1;
      if (got >= need) break;
    }
  }

  if (selected.length < total) {
    const rest = [...rows]
      .filter((r) => !taken.has(`${r.name.toLowerCase()}|${r.address.toLowerCase()}`))
      .sort((a, b) => {
        const sa = (STUDENT_FOCUS.has(a.category) ? 1 : 0) * 10000 + a.quality * 1000 - a.distanceM;
        const sb = (STUDENT_FOCUS.has(b.category) ? 1 : 0) * 10000 + b.quality * 1000 - b.distanceM;
        return sb - sa;
      });

    for (const row of rest) {
      selected.push(row);
      if (selected.length >= total) break;
    }
  }

  return selected.slice(0, total);
}

function cloudinaryReady() {
  const cfg = cloudinary.config();
  return !!(cfg?.cloud_name && cfg?.api_key && cfg?.api_secret);
}

const imageCache = new Map();
async function resolveCategoryImage(category) {
  if (imageCache.has(category)) return imageCache.get(category);

  const pool = IMAGE_SOURCE_BY_CATEGORY[category] || IMAGE_SOURCE_BY_CATEGORY.default;
  const sourceUrl = pick(pool);

  if (!cloudinaryReady()) {
    imageCache.set(category, sourceUrl);
    return sourceUrl;
  }

  try {
    const uploaded = await cloudinary.uploader.upload(sourceUrl, {
      folder: `stepsmatch/seeds/${SEED_TAG}/${slugify(category)}`,
      public_id: `${slugify(category)}_${Date.now()}_${randInt(100, 999)}`,
      overwrite: true,
      resource_type: 'image',
    });
    const finalUrl = uploaded?.secure_url || sourceUrl;
    imageCache.set(category, finalUrl);
    return finalUrl;
  } catch (e) {
    console.warn('[cloudinary] upload failed, using source URL', category, String(e?.message || e));
    imageCache.set(category, sourceUrl);
    return sourceUrl;
  }
}

function makeContactEmail(providerName, idx) {
  const base = slugify(providerName).replace(/-/g, '');
  return `${base.slice(0, 18) || 'anbieter'}${idx + 1}@example.at`;
}

function mapSearchWebsite(name, lat, lng) {
  const q = encodeURIComponent(`${name}, Graz`);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}&query=${q}`;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('[seed:graz] connected');

  const { categoryByName, subByKey } = await ensureCatalog();

  const center = await geocodeCenter(UNI_QUERY);
  console.log(`[seed:graz] center=${center.lat},${center.lng} :: ${center.display}`);

  const radii = [2200, 3200, 4500, 6000];
  let all = [];
  for (const r of radii) {
    const raw = await overpassFetchAround(center, r);
    const rows = normalizeElements(raw, center);
    all = rows;
    console.log(`[seed:graz] radius=${r}m candidates=${rows.length}`);
    if (rows.length >= PROVIDERS_TARGET * 2) break;
  }

  if (!all.length) throw new Error('no OSM candidates around Uni Graz');

  const selected = selectCandidates(all, PROVIDERS_TARGET);
  if (selected.length < PROVIDERS_TARGET) {
    throw new Error(`not enough candidates with plausible addresses: ${selected.length}/${PROVIDERS_TARGET}`);
  }

  await cleanupExistingTestData();
  const seedUser = await ensureSeedUser();

  let providerCount = 0;
  let offerCount = 0;

  for (let i = 0; i < selected.length; i++) {
    const row = selected[i];
    const categoryName = categoryByName.has(row.category) ? row.category : 'Dienstleistungen';
    let subName = row.subcategory;

    const fallbackSubs = CATALOG.find((c) => c.name === categoryName)?.subs || ['Copyshop'];
    if (!subByKey.has(`${categoryName}|${subName}`)) subName = fallbackSubs[0];

    const catDoc = categoryByName.get(categoryName);
    const subDoc = subByKey.get(`${categoryName}|${subName}`);

    const provider = await Provider.create({
      name: row.name,
      address: row.address,
      category: categoryName,
      subcategory: subName,
      categoryId: catDoc?._id || null,
      description: `SEED:${SEED_TAG}; Realer Standort in Uni-Graz-Naehe (OSM-Datenbasis).`,
      contact: {
        phone: String(row.tags['contact:phone'] || row.tags.phone || `+43 316 ${randInt(100000, 999999)}`),
        email: makeContactEmail(row.name, i),
        website: String(row.tags['contact:website'] || row.tags.website || mapSearchWebsite(row.name, row.lat, row.lng)),
      },
      openingHours: providerOpeningHours(categoryName),
      location: { type: 'Point', coordinates: [row.lng, row.lat] },
      user: seedUser._id,
    });
    providerCount += 1;

    const schedule = offerSchedule(categoryName);
    const text = offerText(categoryName, subName, row.name);
    const imageUrl = await resolveCategoryImage(categoryName);

    const from = new Date(Date.now() - randInt(1, 4) * 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + randInt(21, 75) * 24 * 60 * 60 * 1000);
    const radius = randInt(100, 500);

    await Offer.create({
      provider: provider._id,
      categoryId: catDoc?._id || null,
      subcategoryId: subDoc?._id || null,
      category: categoryName,
      subcategory: subName,
      name: text.name,
      description: text.description,
      radius,
      interestsRequired: [slugify(categoryName), slugify(subName), 'studenten', 'campus'],
      validDays: schedule.validDays,
      weekdays: schedule.validDays,
      validTimes: { from: schedule.validTimes.from, to: schedule.validTimes.to },
      validDates: { from, to },
      contact: `SEED:${SEED_TAG}; provider=${provider._id}`,
      images: imageUrl ? [imageUrl] : [],
      location: { type: 'Point', coordinates: [row.lng, row.lat] },
      languages: ['de', 'en'],
      foundCounter: randInt(0, 35),
    });

    offerCount += 1;
  }

  console.log(`[seed:graz] done providers=${providerCount} offers=${offerCount} tag=${SEED_TAG}`);
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error('[seed:graz] failed', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
