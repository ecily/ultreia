const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:3000/api';
const projectId = process.env.EXPO_PROJECT_ID || '';

module.exports = {
  expo: {
    name: 'Ultreia',
    slug: 'ultreia-mobile',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'ultreia',
    userInterfaceStyle: 'automatic',
    android: {
      package: 'com.ecily.ultreia',
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'VIBRATE',
        'WAKE_LOCK',
      ],
      foregroundService: {
        notificationTitle: 'Ultreia ist aktiv',
        notificationBody: 'Standort wird für technische Tests verwendet.',
        notificationChannelId: 'ultreia-location-v1',
      },
      foregroundServiceType: ['location'],
      blockedPermissions: ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW'],
    },
    plugins: [
      ['expo-notifications', { sounds: [] }],
      ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }],
      'expo-secure-store',
    ],
    extra: { apiBase, eas: { projectId } },
    updates: { enabled: false },
  },
};
