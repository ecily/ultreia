import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { GEOFENCE_TASK, LOCATION_TASK, ATTENTION_CHANNEL } from '../lib/config';
import { sendHeartbeat } from '../lib/location';
import { getDeviceId } from '../lib/device';
import { postJson } from '../lib/api';

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const position = data?.locations?.[data.locations.length - 1];
    if (!position) return;
    try { await sendHeartbeat(position); } catch (heartbeatError) { console.warn('[ultreia] background heartbeat failed', heartbeatError?.message); }
  });
}

if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || data?.eventType !== 1) return;
    const region = data.region;
    const deviceId = await getDeviceId();
    const position = await import('expo-location').then((Location) => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).catch(() => null);
    if (position) {
      await postJson('/location/geofence-enter', {
        deviceId,
        geofenceId: region?.identifier || 'ultreia-technical-test',
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }).catch(() => {});
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Ultreia Geofence ENTER', body: 'Der technische ENTER-Handler wurde ausgeführt.', data: { kind: 'technical_test' } },
      trigger: { channelId: ATTENTION_CHANNEL, seconds: 1 },
    }).catch(() => {});
  });
}
