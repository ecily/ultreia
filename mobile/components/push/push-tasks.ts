// stepsmatch/mobile/components/push/push-tasks.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import {
  BG_LOCATION_TASK,
  GEOFENCE_TASK,
  EVENT_DEDUP_WINDOW_MS,
  ACCURACY_TOKEN_CAP_M,
  ENTER_SANITY_BUFFER_M,
  MIN_MS_BETWEEN_PUSH_SAME_OFFER,
  MIN_MS_BETWEEN_PUSH_GLOBAL,
  RESOLVED_PROJECT_ID,
} from './push-constants';

// In-Memory Dedupe für Geofence-Events
const LAST_EVENT_SEEN: Record<string, number> = {};
const nowMs = () => Date.now();

// ────────────────────────────────────────────────────────────
// BG-LOCATION TASK (mit Guards + lazy imports)
// ────────────────────────────────────────────────────────────
if (!TaskManager.isTaskDefined(BG_LOCATION_TASK)) {
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) {
        console.log('[BGLOC] Task error', String(error));
        return;
      }
      const { locations } = (data || {}) as any;
      if (!locations?.length) return;

      let { latitude, longitude, accuracy } = locations[0]?.coords || {};

      const locMod = await import('./push-location');
      try {
        const improved = await locMod.ensureGoodAccuracyCoords(
          { latitude, longitude, accuracy } as any
        );
        if (improved) {
          latitude  = improved.latitude;
          longitude = improved.longitude;
          accuracy  = improved.accuracy;
        }
      } catch {}

      if (latitude && longitude) {
        await locMod._sendHeartbeatWithCoords({
          latitude, longitude, accuracy, refreshMode: 'normal',
        });

        try {
          console.log('[geofence] bg-task-triggered refresh (force=true)');
          const gf = await import('./push-geofence');
          await gf.refreshGeofencesAroundUser(true);
        } catch (e:any) {
          console.log('[geofence] bg-task-triggered refresh failed', String(e));
        }
      }
    } catch (e:any) {
      console.log('[BGLOC] task handler exception', String(e));
    }
  });
}

// ────────────────────────────────────────────────────────────
// GEOFENCE TASK (mit Guards + lazy imports)
// ────────────────────────────────────────────────────────────
if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    try {
      if (error) {
        console.log('[GEOFENCE] error', String(error));
        return;
      }
      const { eventType, region } = (data || {}) as any;
      const ident = String(region?.identifier || '');
      console.log('[GEOFENCE] event', eventType, ident);

      const m = ident.match(/^offer:([a-f0-9]{24})$/i);
      if (!m) return;
      const offerId = m[1];

      // Burst-Dedupe (in-memory)
      const key = `${eventType}:${offerId}`;
      const nowEvt = nowMs();
      if (LAST_EVENT_SEEN[key] && (nowEvt - LAST_EVENT_SEEN[key]) < EVENT_DEDUP_WINDOW_MS) {
        console.log('[GEOFENCE] event dedup window hit', key);
        return;
      }
      LAST_EVENT_SEEN[key] = nowEvt;

      // Lazy Imports (vermeidet Zyklen)
      const { getOfferPushState, setOfferPushState, getGlobalState, getCurrentExpoToken, getPersistentDeviceId } = await import('./push-state');
      const { presentLocalOfferNotification } = await import('./push-notifications');

      // Sanity: effektiver Eintritt (Radius + Accuracy + Buffer)
      let lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 200 });
      let lat = lastKnown?.coords?.latitude ?? null;
      let lng = lastKnown?.coords?.longitude ?? null;
      let accuracy = lastKnown?.coords?.accuracy ?? null;

      if (eventType === Location.GeofencingEventType.Enter) {
        if (Number.isFinite(region?.latitude) && Number.isFinite(region?.longitude)) {
          try {
            const { ensureGoodAccuracyCoords } = await import('./push-location');
            const improved = await ensureGoodAccuracyCoords(lastKnown?.coords || null);
            if (improved) {
              lat = improved.latitude; lng = improved.longitude; accuracy = improved.accuracy;
            }
          } catch {}
          if (lat != null && lng != null) {
            const d = haversineMeters(lat!, lng!, region.latitude, region.longitude);
            const accCap = Math.min(Number.isFinite(accuracy as any) ? Number(accuracy) : ACCURACY_TOKEN_CAP_M, ACCURACY_TOKEN_CAP_M);
            const effective = (region.radius ?? 0) + accCap + ENTER_SANITY_BUFFER_M;
            if (d > effective) {
              console.log('[GEOFENCE] ENTER ignored (SANITY:OUTSIDE)', { d: Math.round(d), effective: Math.round(effective), radius: region.radius, acc: accuracy, accCap });
              return;
            }
          }
        }

        // State + Throttle
        const state = await getOfferPushState(offerId);

        const now = nowMs();
        if (state.lastPushedAt && now - state.lastPushedAt < MIN_MS_BETWEEN_PUSH_SAME_OFFER) {
          console.log('[GEOFENCE] THROTTLE per-offer hit', offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt });
          return;
        }
        const g = await getGlobalState();
        if (g.lastAnyPushAt && now - g.lastAnyPushAt < MIN_MS_BETWEEN_PUSH_GLOBAL) {
          console.log('[GEOFENCE] THROTTLE global hit', offerId);
          await setOfferPushState(offerId, { inside: true, lastPushedAt: state.lastPushedAt || 0 });
          return;
        }

        // Lokaler Sofort-Push ODER In-App-Signal (presentLocalOfferNotification handhabt FG/BG)
        await presentLocalOfferNotification(offerId, await safeGetMeta(offerId));

        await setOfferPushState(offerId, { inside: true, lastPushedAt: now });

        // Backend informieren (leichtgewichtig, ohne harte Abhängigkeiten)
        try {
          const token = await getCurrentExpoToken();
          const deviceId = await getPersistentDeviceId();
          fetch('https://api.ultreia.app/api/location/geofence-enter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              offerId, token, deviceId, platform: 'android',
              projectId: RESOLVED_PROJECT_ID, source: 'local-geofence',
              t: now, lat, lng, accuracy,
            }),
          }).catch(() => {});
        } catch {}

        return;
      }

      if (eventType === Location.GeofencingEventType.Exit) {
        const { getOfferPushState, setOfferPushState } = await import('./push-state');
        const prev = await getOfferPushState(offerId);
        await setOfferPushState(offerId, { inside: false, lastPushedAt: prev.lastPushedAt || 0 });
        console.log('[GEOFENCE] EXIT -> re-enter will notify again', offerId);
        return;
      }
    } catch (e:any) {
      console.log('[GEOFENCE] handler exception', String(e));
    }
  });
}

// ────────────────────────────────────────────────────────────
// Kleine Helfer (lokal, ohne weitere Importe)
// ────────────────────────────────────────────────────────────
function toRad(d: number) { return (d * Math.PI) / 180; }
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Metadaten schlank lesen (falls vorhanden)
async function safeGetMeta(offerId: string) {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(`offerMeta.${offerId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export {};

