const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.ultreia.app/api';
const projectId = process.env.EXPO_PROJECT_ID || '';
const mode = process.env.ULTREIA_MODE || (apiBase.startsWith('https://') ? 'production' : 'local');
if (mode === 'production' && !apiBase.startsWith('https://')) throw new Error('Production mobile builds require an HTTPS API URL');

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
      usesCleartextTraffic: mode !== 'production',
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
      './plugins/withCleartextTraffic',
      ['expo-notifications', { sounds: [] }],
      ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }],
      'expo-secure-store',
    ],
    extra: { apiBase, mode, eas: { projectId } },
    updates: { enabled: false },
  },
};
