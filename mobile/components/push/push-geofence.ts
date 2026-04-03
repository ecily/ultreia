// stepsmatch/mobile/components/push/push-geofence.ts
import { DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { isServiceActiveNow } from './service-control';
import {
  ACCURACY_TOKEN_CAP_M,
  API_BASE,
  DEFAULT_RADIUS_M,
  ENTER_SANITY_BUFFER_M,
  EUROPE_VIENNA,
  GEOFENCE_SYNC_INTERVAL_MS,
  GEOFENCE_TASK,
  MAX_GEOFENCES,
  OUTSIDE_TOLERANCE_M,
} from './push-constants';
import {
  getOfferPushState, setOfferPushState,
  setGlobalState,
  setOfferMeta, getOfferMeta,
  pruneObsoleteOfferStates, nowMs,
  getInterestSet, acquirePushLock,
} from './push-state';
import { isOfferActiveNow as _isOfferActiveNow } from '../../utils/isOfferActiveNow';
import { matchesInterests as _matchesInterests } from '../../utils/interests';
import { presentLocalOfferNotification as _presentLocalOfferNotification, shouldNotify as _shouldNotify } from './push-notifications';

// ⬇️ Neu/Sicher: Fallbacks & Wrappers, damit „undefined is not a function“ nicht mehr auftreten kann
const isOfferActiveNow: typeof _isOfferActiveNow =
  typeof _isOfferActiveNow === 'function' ? _isOfferActiveNow : ((o: any) => true);

const matchesInterests: typeof _matchesInterests =
  typeof _matchesInterests === 'function' ? _matchesInterests : (() => true);

const presentLocalOfferNotification: typeof _presentLocalOfferNotification =
  typeof _presentLocalOfferNotification === 'function'
    ? _presentLocalOfferNotification
    : (async () => { console.log('[warn] presentLocalOfferNotification noop'); });
const shouldNotify: (offerId: string, reason: string) => Promise<{ ok: boolean; reason?: string }> =
  typeof _shouldNotify === 'function'
    ? _shouldNotify
    : async () => ({ ok: true, reason: 'noop-shouldNotify' });

// Regions cache (module-local)
let CURRENT_REGIONS: {identifier:string, latitude:number, longitude:number, radius:number}[] = [];

// Geofence sync guards
let GEOFENCE_REFRESH_IN_FLIGHT = false;
let LAST_REFRESH_TS = 0;
// leicht erhöht, um Netz-Noise zu reduzieren
const REFRESH_MIN_GAP_MS = 5000;

// Track zuletzt bekannte Sync-Zeit (für Watchdog)
export let lastGeofenceSyncAt = 0;

// Event dedupe (ENTER/EXIT burst)
export const EVENT_DEDUP_WINDOW_MS = 5000;

export function toRad(d:number) { return (d * Math.PI) / 180; }
export function haversineMeters(lat1:number, lng1:number, lat2:number, lng2:number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function regionsEqual(a: typeof CURRENT_REGIONS, b: typeof CURRENT_REGIONS) {
  if ((a?.length || 0) !== (b?.length || 0)) return false;
  const sig = (r: any) => `${r.identifier}:${r.latitude.toFixed(6)}:${r.longitude.toFixed(6)}:${Math.round(Number(r.radius||0))}`;
  const sa = [...a].map(sig).sort();
  const sb = [...b].map(sig).sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

function parseOfferIdFromIdentifier(identifier = '') {
  const m = String(identifier).match(/^offer:([a-f0-9]{24})$/i);
  return m ? m[1] : null;
}

/* ────────────────────────────────────────────────────────────
   Robust HTTP: Timeout + kleiner Retry (lokale Defaults)
──────────────────────────────────────────────────────────── */
const HTTP_TIMEOUT_MS = 6000;
const HTTP_RETRY_ATTEMPTS = 3;

async function httpGetJsonWithRetry(url: string, {
  attempts = HTTP_RETRY_ATTEMPTS,
  timeoutMs = HTTP_TIMEOUT_MS
}: { attempts?: number; timeoutMs?: number } = {}) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timer);
      const json = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, json };
    } catch (e: any) {
      clearTimeout(timer);
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 300 * (i + 1))); // 300/600ms Backoff
    }
  }
  throw lastErr || new Error('network failed');
}

/* ────────────────────────────────────────────────────────────
   Offers-Fetch mit klaren Logs & Recovery-Refresh
──────────────────────────────────────────────────────────── */
let _offersFetchErrorOnce = false; // Log-Noise-Guard
async function fetchCandidateOffers() {
  const base = (typeof API_BASE === 'string' && API_BASE) ? API_BASE : 'https://lobster-app-ie9a5.ondigitalocean.app/api';
  const url = `${base}/offers?withProvider=1&activeNow=1&fields=_id,name,location,provider,radius,validTimes,validDays,validDates`;

  try {
    const { ok, status, json } = await httpGetJsonWithRetry(url);
    const list = Array.isArray(json) ? json : (json?.data || []);
    if (!ok) {
      if (!_offersFetchErrorOnce) {
        console.log('[geofence] fetch offers non-200', status, 'url=', url);
        _offersFetchErrorOnce = true;
      }
      return Array.isArray(list) ? list : [];
    }
    if (_offersFetchErrorOnce) {
      console.log('[geofence] fetch offers recovered', 'count=', (list?.length ?? 0));
      _offersFetchErrorOnce = false;
      DeviceEventEmitter.emit('offers:refresh');
    }
    return list || [];
  } catch (e: any) {
    if (!_offersFetchErrorOnce) {
      console.log('[geofence] fetch offers exception', String(e?.message || e), 'url=', url);
      _offersFetchErrorOnce = true;
    }
    return [];
  }
}

function pickOfferPoint(offer:any) {
  const coords = (offer?.provider?.location?.coordinates) || (offer?.location?.coordinates) || null;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}
function offerRadius(offer:any) {
  return offer?.radiusM ?? offer?.radius ?? offer?.radiusMeters ?? DEFAULT_RADIUS_M;
}

function effectiveInside({
  hereLat, hereLng, regionLat, regionLng, radius, acc
}: { hereLat:number, hereLng:number, regionLat:number, regionLng:number, radius:number, acc?:number|null }) {
  const accCap = Math.min(Number.isFinite(acc as any) ? Number(acc) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);
  const d = haversineMeters(hereLat, hereLng, regionLat, regionLng);
  return { inside: d <= ((radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M), d, accCap };
}

export async function computeDistanceBadge(offerId:string) {
  try {
    const region = CURRENT_REGIONS.find(r => r.identifier === `offer:${offerId}`);
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!region || !pos?.coords) return null;
    const m = haversineMeters(pos.coords.latitude, pos.coords.longitude, region.latitude, region.longitude);
    if (!Number.isFinite(m)) return null;
    return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`;
  } catch { return null; }
}
export async function computeDistanceMeters(offerId:string, lat?:number|null, lng?:number|null) {
  try {
    const region = CURRENT_REGIONS.find(r => r.identifier === `offer:${offerId}`);
    if (!region) return null;
    let ref = { latitude: lat ?? null, longitude: lng ?? null };
    if (ref.latitude == null || ref.longitude == null) {
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
      if (!pos?.coords) return null;
      ref = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
    const m = haversineMeters(ref.latitude!, ref.longitude!, region.latitude, region.longitude);
    return Number.isFinite(m) ? Math.round(m) : null;
  } catch { return null; }
}

export type RefreshOptions = boolean | { force?: boolean; silent?: boolean };

export async function refreshGeofencesAroundUser(forceOrOptions: RefreshOptions = false) {
  if (!(await isServiceActiveNow())) {
    console.log('[geofence] skip refresh (service inactive)');
    return;
  }
  const opts = typeof forceOrOptions === 'boolean' ? { force: forceOrOptions, silent: false } : (forceOrOptions || { force: false, silent: false });
  const { force, silent } = { force: !!opts.force, silent: !!opts.silent };

  const nowStart = nowMs();
  if (GEOFENCE_REFRESH_IN_FLIGHT) return;
  if (!force && nowStart - LAST_REFRESH_TS < REFRESH_MIN_GAP_MS) return;

  GEOFENCE_REFRESH_IN_FLIGHT = true;
  try {
    const now = nowMs();
    if (!force && now - lastGeofenceSyncAt < GEOFENCE_SYNC_INTERVAL_MS) return;

    const loc = await Location.getLastKnownPositionAsync({});
    if (!loc?.coords) {
      console.log('[geofence] skip sync (no lastKnownPosition)');
      return;
    }
    const { latitude, longitude, accuracy: hereAcc } = loc.coords;

    const offers = await fetchCandidateOffers();
    const activeNearby: {offer:any, p:{lat:number,lng:number}, dist:number}[] = [];
    for (const offer of offers) {
      try {
        if (!isOfferActiveNow(offer, EUROPE_VIENNA)) continue;
        const p = pickOfferPoint(offer);
        if (!p) continue;
        const dist = haversineMeters(latitude, longitude, p.lat, p.lng);
        if (dist <= 2000) activeNearby.push({ offer, p, dist });
      } catch {}
    }
    activeNearby.sort((a, b) => a.dist - b.dist);
    const top = activeNearby.slice(0, MAX_GEOFENCES);

    const regions = top.map(({ offer, p }) => {
      const r = offerRadius(offer);
      const identifier = `offer:${offer._id}`;
      setOfferMeta(offer._id, {
        title: offer?.title || offer?.name || 'Angebot',
        providerName: offer?.provider?.name || '',
        providerId: offer?.provider?._id || '',
        radius: r,
      }).catch(() => {});
      return {
        identifier,
        latitude: p.lat,
        longitude: p.lng,
        radius: Math.max(20, Math.min(500, Number(r) || DEFAULT_RADIUS_M)),
        notifyOnEnter: true,
        notifyOnExit: true,
      };
    });

    // INSTANT-INSIDE nur wenn NICHT silent
    try {
      if (!silent && regions.length && loc?.coords) {
        for (const r of regions) {
          const offerId = parseOfferIdFromIdentifier(r.identifier);
          if (!offerId) continue;

          const { inside, d, accCap } = effectiveInside({
            hereLat: latitude, hereLng: longitude,
            regionLat: r.latitude, regionLng: r.longitude,
            radius: Number(r.radius) || DEFAULT_RADIUS_M, acc: hereAcc
          });

          // Zusatz-Diagnose
          if (inside) {
            console.log('[INSTANT_CHECK]', JSON.stringify({
              offerId, d: Math.round(d), radius: r.radius, accCap, eff: Math.round((r.radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M)
            }));
          }

          if (!inside) continue;

          const st = await getOfferPushState(offerId);
          if (st?.inside) continue;

          // Aktivität check (defensiv)
          let active = true;
          try {
            const res = await fetch(`${API_BASE}/offers/${offerId}?withProvider=1`, { method: 'GET' });
            const offerForChecks = await res.json().catch(() => null);
            active = res.ok ? !!isOfferActiveNow(offerForChecks, EUROPE_VIENNA) : true;
          } catch {}

          if (!active) {
            await setOfferPushState(offerId, { inside: true, lastPushedAt: st?.lastPushedAt || 0 });
            continue;
          }

          if (acquirePushLock(offerId)) {
            // DEDUPE-GATE vor der lokalen Notification (synthetic-enter)
            const gate = await shouldNotify(offerId, 'synthetic-enter').catch((e:any) => ({ ok: true, reason: 'gate-error:'+String(e?.message || e) }));
            if (!gate?.ok) {
              console.log('[DEDUPE] skip synthetic-enter', offerId, gate?.reason);
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st?.lastPushedAt || 0 });
              continue;
            }

            const meta = await getOfferMeta(offerId).catch(() => ({} as any));
            try {
              if (typeof (Notifications as any)?.setBadgeCountAsync === 'function') {
                await (Notifications as any).setBadgeCountAsync(0).catch(() => {});
              }
            } catch {}

            const distanceBadge = await computeDistanceBadge(offerId).catch(() => null);
            await presentLocalOfferNotification(offerId, meta, 'synthetic-enter', distanceBadge || null);

            console.log('[LOCAL_PUSH_SHOWN:INSTANT_NEW_OFFER]', JSON.stringify({
              offerId, d: Math.round(d) + 'm', source: 'INSTANT_AFTER_SYNC'
            }));

            const ts = nowMs();
            await setOfferPushState(offerId, { inside: true, lastPushedAt: ts });
            await setGlobalState({ lastAnyPushAt: ts });
            // reportEnterToBackend bleibt im Task-ENTER Pfad
          }
        }
      }
    } catch (e:any) {
      console.log('[geofence] instant-inside check failed', String(e?.message || e));
    }

    if (!regions.length) {
      const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (started) {
        try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
        console.log('[geofence] geofencing stopped (no regions)');
      }
      CURRENT_REGIONS = [];
      lastGeofenceSyncAt = now;
      LAST_REFRESH_TS = nowMs();

      DeviceEventEmitter.emit('offers:refresh');
      console.log('[offers:refresh][emit] (no regions)');

      return;
    }

    if (regionsEqual(CURRENT_REGIONS, regions)) {
      CURRENT_REGIONS = regions.slice();
      lastGeofenceSyncAt = now;
      LAST_REFRESH_TS = nowMs();
      await markAlreadyInsideQuietly({ allowFirstEverPush: true });
      console.log('[geofence] regions unchanged -> no restart]');

      DeviceEventEmitter.emit('offers:refresh');
      console.log('[offers:refresh][emit] (regions unchanged)');

      return;
    }

    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (started) {
      try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
    }
    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
    } catch (e:any) {
      console.log('[geofence] start failed once, retrying...', String(e?.message || e));
      await new Promise(r => setTimeout(r, 250));
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions as any);
    }
    CURRENT_REGIONS = regions.slice();
    lastGeofenceSyncAt = now;
    LAST_REFRESH_TS = nowMs();
    console.log('[geofence] started with', regions.length, 'regions');

    try { await pruneObsoleteOfferStates(regions.map(r => r.identifier)); } catch {}

    // Auch nach (Re)Start einmaligen First-Ever-Push zulassen
    await markAlreadyInsideQuietly({ allowFirstEverPush: true });

    DeviceEventEmitter.emit('offers:refresh');
    console.log('[offers:refresh][emit] (regions started/restarted)');
  } catch (e:any) {
    console.log('[geofence] refresh error', String(e));
  } finally {
    GEOFENCE_REFRESH_IN_FLIGHT = GEOFENCE_REFRESH_IN_FLIGHT && false; // ensure reset even if re-entrancy tried
    GEOFENCE_REFRESH_IN_FLIGHT = false;
  }
}

export async function reconcileInsideFlagsWithPosition({
  latitude, longitude, accuracy,
}: { latitude:number, longitude:number, accuracy?:number }) {
  try {
    if (!CURRENT_REGIONS?.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const accCap = Math.min(Number.isFinite(accuracy!) ? Number(accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);

    const updates = [];
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(latitude, longitude, r.latitude, r.longitude);
      const outside = d > (Number(r.radius) + accCap + OUTSIDE_TOLERANCE_M);

      if (outside) {
        const state = await getOfferPushState(offerId);
        if (state.inside) {
          updates.push(setOfferPushState(offerId, { inside: false, lastPushedAt: state.lastPushedAt || 0 }));
          console.log('[RECONCILE] set outside for', offerId, `(d=${Math.round(d)}m > r=${r.radius}m + accCap=${accCap}m + tol=${OUTSIDE_TOLERANCE_M}m)`);
        }
      }
    }
    if (updates.length) await Promise.allSettled(updates as any);
  } catch (e:any) {
    console.log('[RECONCILE] error', String(e));
  }
}

export async function markAlreadyInsideQuietly({ allowFirstEverPush = true }: { allowFirstEverPush?: boolean } = {}) {
  try {
    if (!CURRENT_REGIONS?.length) return;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 200 });
    if (!pos?.coords) return;

    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const accCap = Math.min(Number.isFinite(pos.coords.accuracy) ? Number(pos.coords.accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);

    const now = nowMs();
    for (const r of CURRENT_REGIONS) {
      const offerId = parseOfferIdFromIdentifier(r.identifier);
      if (!offerId) continue;

      const d = haversineMeters(here.lat, here.lng, r.latitude, r.longitude);
      const effective = (r.radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M;

      if (d <= effective) {
        const st = await getOfferPushState(offerId);
        if (!st.inside) {
          // Interessen/aktiv (defensiv)
          try {
            const [interestSet, fetchedOffer] = await Promise.all([
              getInterestSet(),
              fetch(`${API_BASE}/offers/${offerId}?withProvider=1`).then(r => r.ok ? r.json() : null).catch(()=>null)
            ]);
            if (fetchedOffer && !matchesInterests(fetchedOffer, interestSet)) {
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
              console.log('[GEOFENCE] QUIET-INSIDE skipped by interests', offerId);
              continue;
            }
            if (fetchedOffer && !isOfferActiveNow(fetchedOffer, EUROPE_VIENNA)) {
              await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
              console.log('[GEOFENCE] QUIET-INSIDE skipped (not active now)', offerId);
              continue;
            }
          } catch {}

          const isFirstEver = !st.lastPushedAt;
          if (isFirstEver && allowFirstEverPush && acquirePushLock(offerId)) {
            try {
              // DEDUPE-GATE vor der lokalen Notification (synthetic-enter)
              const gate = await shouldNotify(offerId, 'synthetic-enter').catch((e:any) => ({ ok: true, reason: 'gate-error:'+String(e?.message || e) }));
              if (!gate?.ok) {
                console.log('[DEDUPE] skip synthetic-enter (firstEver)', offerId, gate?.reason);
                await setOfferPushState(offerId, { inside: true, lastPushedAt: st?.lastPushedAt || 0 });
                continue;
              }

              const meta = await getOfferMeta(offerId).catch(() => ({} as any));
              try {
                if (typeof (Notifications as any)?.setBadgeCountAsync === 'function') {
                  await (Notifications as any).setBadgeCountAsync(0).catch(() => {});
                }
              } catch {}
              const distanceBadge = await computeDistanceBadge(offerId).catch(() => null);
              await presentLocalOfferNotification(offerId, meta, 'synthetic-enter', distanceBadge || null);

              const enteredDistanceM = await computeDistanceMeters(offerId, here.lat, here.lng);
              console.log('[LOCAL_PUSH_SHOWN:SYNT_ENTER]', JSON.stringify({
                offerId,
                d: typeof enteredDistanceM === 'number' ? `${enteredDistanceM}m` : null,
                acc: pos?.coords?.accuracy != null ? Math.round(pos.coords.accuracy as number) : null,
                source: 'SYNTH_ENTER',
              }));

              await setOfferPushState(offerId, { inside: true, lastPushedAt: now });
              await setGlobalState({ lastAnyPushAt: now });

              // optionales Reporting
              try {
                const token = await (await import('./push-state')).getCurrentExpoToken();
                const deviceId = await (await import('./push-state')).getPersistentDeviceId();
                const payload = {
                  offerId, token, deviceId,
                  platform: (await import('./push-state')).Platform.OS,
                  projectId: (await import('./push-constants')).RESOLVED_PROJECT_ID,
                  source: 'local-geofence',
                  t: nowMs(),
                  lat: here.lat, lng: here.lng, accuracy: pos?.coords?.accuracy ?? null,
                };
                fetch(`${API_BASE}/location/geofence-enter`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                }).catch(() => {});
              } catch {}
              continue;
            } catch (e:any) {
              console.log('[GEOFENCE] QUIET-INSIDE synthetic-enter push failed, fallback to quiet', String(e?.message || e));
            }
          }

          await setOfferPushState(offerId, { inside: true, lastPushedAt: st.lastPushedAt || 0 });
          console.log('[GEOFENCE] QUIET-INSIDE (no push)', r.identifier, { d: Math.round(d), effective: Math.round(effective), accCap });
        }
      }
    }
  } catch (e:any) {
    console.log('[GEOFENCE] QUIET-INSIDE error', String(e?.message || e));
  }
}

export function getCurrentRegionsSnapshot() {
  return CURRENT_REGIONS.slice();
}

