import { ObjectId } from 'mongodb';

const URGENCIES = new Set(['always', 'today', 'now']);

export function createPilgrimNeedService(databaseService, needService) {
  const collection = () => databaseService.getDb().collection('pilgrimNeeds');

  async function list(userId, tripId, scope) {
    const items = await collection().find({ userId, tripId, scope }).sort({ priorityOrder: 1, updatedAt: -1 }).toArray();
    return items.map(publicNeed);
  }

  async function set(userId, tripId, scope, key, input = {}) {
    const activeKeys = await needService.activeKeys([key]);
    if (activeKeys.length !== 1) throw new Error('need_not_available');
    const urgency = input.urgency === undefined ? 'always' : String(input.urgency);
    if (!URGENCIES.has(urgency)) throw new Error('urgency_invalid');
    const active = input.active === undefined ? true : Boolean(input.active);
    const timestamp = new Date();
    const existing = await collection().findOne({ userId, tripId, scope, needKey: key });
    const priorityOrder = Number.isInteger(input.priorityOrder) && input.priorityOrder >= 0 ? input.priorityOrder : (existing?.priorityOrder ?? 0);
    const document = { userId, tripId, scope, needKey: key, active, urgency, pushEnabled: input.pushEnabled !== false, priorityOrder, updatedAt: timestamp };
    if (existing) await collection().updateOne({ _id: existing._id, userId, tripId, scope }, { $set: document });
    else await collection().insertOne({ ...document, createdAt: timestamp });
    return publicNeed({ ...existing, ...document, _id: existing?._id || new ObjectId() });
  }

  function publicNeed(item) { return { id: String(item._id), needKey: item.needKey, active: item.active === true, urgency: item.urgency, pushEnabled: item.pushEnabled !== false, priorityOrder: item.priorityOrder, createdAt: item.createdAt, updatedAt: item.updatedAt }; }
  return { list, set, URGENCIES };
}
