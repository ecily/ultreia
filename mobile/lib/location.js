import * as Location from 'expo-location';
import { GEOFENCE_TASK, LOCATION_TASK } from './config';
import { getDeviceId } from './device';
import { postJson } from './api';

function locationPayload(position) {
  return {
    deviceId: null,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
  };
}

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = foreground.status === 'granted'
    ? await Location.requestBackgroundPermissionsAsync()
    : await Location.getBackgroundPermissionsAsync();
  return { foreground, background };
}

export async function getLocationPermissions() {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return { foreground, background };
}

export function getBackgroundLocationTaskStatus() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

export function getGeofenceStatus() {
  return Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
}

export async function getCurrentLocation() {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return position;
}

export async function sendHeartbeat(position = null) {
  const current = position || await getCurrentLocation();
  const payload = locationPayload(current);
  payload.deviceId = await getDeviceId();
  return postJson('/location/heartbeat', payload);
}

export async function startBackgroundLocation() {
  const permissions = await requestLocationPermissions();
  if (permissions.foreground.status !== 'granted' || permissions.background.status !== 'granted') {
    throw new Error('Foreground- und Background-Location-Permission werden benötigt.');
  }
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!started) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 120000,
      distanceInterval: 50,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Ultreia ist aktiv',
        notificationBody: 'Technischer Standort-Heartbeat läuft.',
        notificationColor: '#275d4a',
      },
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: false,
    });
  }
  return { started: true };
}

export async function registerTechnicalGeofence(position = null) {
  const permissions = await requestLocationPermissions();
  if (permissions.background.status !== 'granted') throw new Error('Background-Location-Permission fehlt.');
  const current = position || await getCurrentLocation();
  const latitude = current.coords.latitude + 0.00036;
  const longitude = current.coords.longitude;
  const radiusMeters = 25;
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  await Location.startGeofencingAsync(GEOFENCE_TASK, [{
    identifier: 'ultreia-technical-test',
    latitude,
    longitude,
    radius: radiusMeters,
    notifyOnEnter: true,
    notifyOnExit: false,
  }]);
  return { registered: true, geofenceId: 'ultreia-technical-test', latitude, longitude, radiusMeters };
}
