import { listNeedCategories } from './taxonomyService.js';

const V1_NEED_KEYS = new Set(['water', 'eat', 'breakfast', 'coffee_break', 'grocery', 'bakery', 'pharmacy', 'medication', 'foot_care', 'medical', 'physiotherapy', 'sleep', 'albergue', 'hotel', 'laundry', 'dryer', 'shower', 'toilet', 'rest_place', 'shade', 'gear', 'shoe_store', 'gear_repair', 'hiking_poles', 'rain_gear', 'sun_protection', 'hygiene', 'feminine_hygiene', 'cash', 'card_payment', 'charging', 'powerbank', 'wifi_mobile', 'sim', 'luggage_transport', 'parcel_shipping', 'bike_service', 'pilgrim_credential', 'stamp', 'church']);

function toNeedDocument(category, timestamp = new Date()) {
  return {
    key: category.key,
    status: V1_NEED_KEYS.has(category.key) ? 'active' : 'inactive',
    sortOrder: category.priority === 'core' ? 10 : category.priority === 'secondary' ? 20 : category.priority === 'discovery' ? 30 : 40,
    pushable: !['silent_only', 'in_app', 'in_app_or_low'].includes(category.pushSuitability),
    criticality: category.priority === 'core' ? 'core' : category.priority === 'secondary' ? 'secondary' : 'discovery',
    translations: { de: category.labels.de, en: category.labels.en, es: category.labels.es },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createNeedService(databaseService) {
  const collection = () => databaseService.getDb().collection('needs');

  async function ensureCatalog() {
    const timestamp = new Date();
    for (const category of listNeedCategories()) {
      const document = toNeedDocument(category, timestamp);
      await collection().updateOne({ key: document.key }, { $setOnInsert: document }, { upsert: true });
    }
  }

  async function list(locale = 'de') {
    await ensureCatalog();
    const items = await collection().find({ status: 'active' }).sort({ sortOrder: 1, key: 1 }).toArray();
    return items.map((item) => ({ key: item.key, label: item.translations[locale] || item.translations.de, status: item.status, sortOrder: item.sortOrder, pushable: item.pushable, criticality: item.criticality }));
  }

  async function activeKeys(keys) {
    await ensureCatalog();
    const wanted = [...new Set(keys)];
    const items = await collection().find({ status: 'active' }).toArray();
    const allowed = new Set(items.map((item) => item.key));
    return wanted.filter((key) => allowed.has(key));
  }

  return { ensureCatalog, list, activeKeys };
}

export { toNeedDocument };
