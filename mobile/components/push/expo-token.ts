// immer projekt-scoped Token holen – nie wieder "DeviceNotRegistered"
import * as Notifications from 'expo-notifications';

const PROJECT_ID = '08559a29-b307-47e9-a130-d3b31f73b4ed'; // exakt euer Expo Project ID

export async function getScopedExpoPushTokenAsync(): Promise<string> {
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  return data; // "ExponentPushToken[...]"
}
