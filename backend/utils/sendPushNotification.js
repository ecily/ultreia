// /utils/sendPushNotification.js
import axios from 'axios';

export default async function sendPushNotification(token, message) {
  if (!token || !token.startsWith('ExponentPushToken')) {
    console.warn('⚠️ Ungültiger oder fehlender Push-Token:', token);
    return { error: 'Ungültiger oder fehlender Push-Token' };
  }

  const payload = {
    to: token,
    sound: 'default',
    ...message,
  };

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📤 Push erfolgreich gesendet:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Fehler beim Push-Versand:', error.message);
    if (error.response?.data) {
      console.error('📩 Antwort vom Expo-Server:', error.response.data);
    }
    return { error: error.message };
  }
}
