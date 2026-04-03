// stepsmatch/mobile/lib/geofencing.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { GEOFENCE_TASK } from '../background/geofencingTask';

const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app';

export type GeofenceItem = {
  offerId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  distanceMeters?: number;
};

export async function requestLocationPermissionsAsync() {
  // Foreground-Permission
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    throw new Error('Standort-Freigabe (Foreground) abgelehnt.');
  }

  // Background-Permission (für zuverlässigeres Geofencing auf Android)
  if (Platform.OS === 'android') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      console.warn(
        'Hinweis: Hintergrund-Standort nicht freigegeben. Geofencing kann unzuverlässig sein.'
      );
    }
  }
}

export async function fetchNearbyGeofencesAsync(options?: {
  lat?: number;
  lng?: number;
  limit?: number;
  maxDistance?: number;
}): Promise<GeofenceItem[]> {
  let { lat, lng } = options ?? {};
  const limit = options?.limit ?? 50;
  const maxDistance = options?.maxDistance ?? 5000;

  // Falls keine Koordinate mitgegeben → letzte bekannte/aktuelle holen
  if (!lat || !lng) {
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      lat = last.coords.latitude;
      lng = last.coords.longitude;
    } else {
      const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = now.coords.latitude;
      lng = now.coords.longitude;
    }
  }

  const url = `${API_BASE}/api/offers/nearby-geofence?lat=${lat}&lng=${lng}&limit=${limit}&maxDistance=${maxDistance}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`nearby-geofence failed: ${res.status}`);
  const json = await res.json();
  return (json?.geofences ?? []) as GeofenceItem[];
}

export async function startGeofencingAsync(geofences: GeofenceItem[]) {
  if (!geofences.length) {
    console.warn('[Geofencing] Keine Geofences zu registrieren.');
    return;
  }

  const regions: Location.LocationRegion[] = geofences.map((g) => ({
    identifier: g.offerId,
    latitude: g.latitude,
    longitude: g.longitude,
    radius: g.radiusMeters, // Meter
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  // Sicherstellen, dass der Task definiert ist
  const isDefined = await TaskManager.isTaskDefined(GEOFENCE_TASK);
  if (!isDefined) {
    throw new Error('Geofencing Task ist nicht definiert (Import von geofencingTask.ts fehlt?).');
    // Hinweis: Der Task wird später über einen Side-Effect-Import eingebunden.
  }

  const already = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (already) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  console.log(`[Geofencing] Registriert: ${regions.length} Regionen`);
}

export async function refreshGeofencesAsync() {
  await requestLocationPermissionsAsync();
  const items = await fetchNearbyGeofencesAsync();
  await startGeofencingAsync(items);
}
