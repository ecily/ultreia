const URGENCY_ORDER = { now: 0, today: 1, always: 2 };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function distanceMeters(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b[1] - a[1]); const dLng = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function asWindows(value) { return value?.weekly || value || {}; }
function isInside(window, time) { return window.open < window.close ? time >= window.open && time < window.close : time >= window.open || time < window.close; }
export function isOfferOpenAt(availability, date = new Date()) {
  const dateKey = date.toISOString().slice(0, 10); const exception = (availability?.exceptions || []).find((item) => item.date === dateKey);
  if (exception?.closed === true) return false;
  const windows = exception ? (exception.windows || []) : (asWindows(availability)[DAYS[date.getUTCDay()]] || []);
  const time = date.toISOString().slice(11, 16);
  return windows.some((window) => isInside(window, time));
}

export function createMatchingService(databaseService, pilgrimNeedService) {
  const db = () => databaseService.getDb();
  async function matchPilgrimContext(userId, scope, now = new Date()) {
    const [trip, device] = await Promise.all([
      db().collection('trips').findOne({ pilgrimUserId: userId, scope, status: { $in: ['active', 'paused'] } }),
      db().collection('devices').findOne({ userId, scope, lastLocation: { $exists: true } }),
    ]);
    if (!trip) return { status: 'trip_required', matches: [] };
    if (trip.status === 'paused') return { status: 'trip_paused', matches: [] };
    if (!device?.lastLocation?.coordinates) return { status: 'location_required', matches: [] };
    const needs = (await pilgrimNeedService.list(userId, trip._id, scope)).filter((need) => need.active);
    if (!needs.length) return { status: 'needs_required', matches: [] };
    const offers = await db().collection('offers').find({ scope, status: 'active' }).toArray();
    const profiles = await db().collection('providerProfiles').find({ scope, status: 'active', userId: { $in: offers.map((offer) => offer.providerId) } }).toArray();
    const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    const point = device.lastLocation.coordinates;
    const matches = [];
    for (const offer of offers) {
      const profile = profileByUser.get(String(offer.providerId)); const providerPoint = profile?.location?.finalLocation?.location?.coordinates || profile?.location?.location?.coordinates || profile?.location?.coordinates;
      if (!providerPoint || !Number.isFinite(offer.radiusMeters) || offer.radiusMeters < 50 || offer.radiusMeters > 1000) continue;
      if (offer.confirmationDueAt && new Date(offer.confirmationDueAt) <= now || !isOfferOpenAt(offer.availability, now)) continue;
      const distance = Math.round(distanceMeters(point, providerPoint)); if (distance > offer.radiusMeters) continue;
      for (const need of needs.filter((item) => offer.needKeys?.includes(item.needKey))) {
        matches.push({ offer: { id: String(offer._id), title: offer.title, description: offer.description, price: offer.price, images: (offer.images || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).slice(0, 3), location: profile.location }, provider: { id: String(profile._id), name: profile.businessName || profile.displayName || null }, matchingNeed: need, urgency: need.urgency, distanceMeters: distance, openStatus: 'open', reason: { need: need.needKey, urgency: need.urgency, distanceMeters: distance, offerRadiusMeters: offer.radiusMeters, providerStatus: profile.status, offerStatus: offer.status, open: true } });
      }
    }
    matches.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.distanceMeters - b.distanceMeters || String(a.offer.id).localeCompare(String(b.offer.id)));
    return { status: 'ok', matches: matches.slice(0, 20) };
  }
  return { matchPilgrimContext };
}
