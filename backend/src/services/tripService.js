export function createTripService(databaseService) {
  const collection = () => databaseService.getDb().collection('trips');
  const activeFilter = (userId, scope) => ({ pilgrimUserId: userId, scope, status: { $in: ['active', 'paused'] } });

  async function create(userId, scope, context = {}) {
    const existing = await collection().findOne(activeFilter(userId, scope));
    if (existing) { const error = new Error('trip_already_exists'); error.code = 'trip_already_exists'; throw error; }
    const timestamp = new Date();
    const trip = { pilgrimUserId: userId, scope, status: 'active', startedAt: timestamp, pausedAt: null, completedAt: null, routeContext: context.routeContext || null, createdAt: timestamp, updatedAt: timestamp };
    try { const result = await collection().insertOne(trip); return toPublic({ ...trip, _id: result.insertedId }); } catch (error) {
      if (error?.code === 11000) { const conflict = new Error('trip_already_exists'); conflict.code = 'trip_already_exists'; throw conflict; }
      throw error;
    }
  }

  function toPublic(trip) { return trip ? { id: String(trip._id), scope: trip.scope, status: trip.status, startedAt: trip.startedAt, pausedAt: trip.pausedAt, completedAt: trip.completedAt, createdAt: trip.createdAt, updatedAt: trip.updatedAt } : null; }
  async function current(userId, scope) { return toPublic(await collection().findOne(activeFilter(userId, scope))); }
  async function list(userId, scope, limit = 50) { return (await collection().find({ pilgrimUserId: userId, scope }).sort({ createdAt: -1 }).limit(limit).toArray()).map(toPublic); }

  async function transition(userId, scope, tripId, from, to) {
    const timestamp = new Date();
    const set = { status: to, updatedAt: timestamp };
    if (to === 'paused') set.pausedAt = timestamp;
    if (to === 'active') set.pausedAt = null;
    if (to === 'completed') set.completedAt = timestamp;
    const result = await collection().findOneAndUpdate({ _id: tripId, pilgrimUserId: userId, scope, status: from }, { $set: set }, { returnDocument: 'after' });
    if (!result) { const error = new Error('trip_not_found_or_invalid_transition'); error.code = 'trip_transition'; throw error; }
    return toPublic(result);
  }
  return { create, current, list, pause: (u, s, id) => transition(u, s, id, 'active', 'paused'), resume: (u, s, id) => transition(u, s, id, 'paused', 'active'), complete: async (u, s, id) => { const timestamp = new Date(); const result = await collection().findOneAndUpdate({ _id: id, pilgrimUserId: u, scope: s, status: { $in: ['active', 'paused'] } }, { $set: { status: 'completed', completedAt: timestamp, updatedAt: timestamp } }, { returnDocument: 'after' }); if (!result) throw new Error('trip_not_found_or_invalid_transition'); return toPublic(result); } };
}
