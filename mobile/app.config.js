// c:/coding/ultreia/mobile/app.config.js
/* eslint-disable no-console */
require('dotenv').config();

/**
 * Build ENV:
 * - EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY
 * - EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY
 * - EXPO_PUBLIC_API_BASE_URL (optional)
 */
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '';
const DIRECTIONS_KEY = process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY || '';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.ultreia.app/api';

// Central IDs used by app code and build config.
const FG_CHANNEL_ID = 'ultreia-bg-location-task';
const OFFER_CHANNEL_ID = 'offers-v2';
const BG_LOCATION_TASK = 'ultreia-bg-location-task';
const GEOFENCE_TASK = 'ultreia-geofence-task';
const HEARTBEAT_FETCH_TASK = 'ultreia-heartbeat-fetch';

if (!MAPS_KEY) console.warn('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ist leer.');
if (!DIRECTIONS_KEY) console.warn('EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ist leer.');

module.exports = {
  expo: {
    name: 'Ultreia',
    slug: 'ultreia-mobile',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'ultreia',
    userInterfaceStyle: 'automatic',

    splash: {
      image: './assets/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#0d4ea6',
    },

    ios: {
      supportsTablet: true,
    },

    android: {
      package: 'com.ecily.mobile',
      edgeToEdgeEnabled: true,

      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B3B68',
      },

      googleServicesFile: './google-services.json',

      config: {
        googleMaps: { apiKey: MAPS_KEY },
      },

      permissions: [
        'VIBRATE',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'WAKE_LOCK',
        'POST_NOTIFICATIONS',
        'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        'INTERNET',
      ],

      foregroundService: {
        notificationTitle: 'Ultreia l\u00e4uft. Angebote aktiv.',
        notificationBody: 'Sorgt f\u00fcr regelm\u00e4\u00dfigen Abgleich im Hintergrund.',
        notificationChannelId: FG_CHANNEL_ID,
      },

      foregroundServiceType: ['location'],
    },

    notification: {
      icon: './assets/notification-icon.png',
      color: '#0d4ea6',
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      ['expo-splash-screen', { image: './assets/splash.png', resizeMode: 'cover', backgroundColor: '#0d4ea6' }],
      'expo-font',
      ['expo-notifications', { sounds: ['./assets/sounds/arrival.mp3'] }],
      ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }],
      'expo-secure-store',
    ],

    experiments: { typedRoutes: true },

    extra: {
      eas: { projectId: '08559a29-b307-47e9-a130-d3b31f73b4ed' },
      apiBase: API_BASE,
      directionsKey: DIRECTIONS_KEY,
      mapsKeyPresent: Boolean(MAPS_KEY),
      directionsKeyPresent: Boolean(DIRECTIONS_KEY),
      fgChannelId: FG_CHANNEL_ID,
      offerChannelId: OFFER_CHANNEL_ID,
      bgLocationTask: BG_LOCATION_TASK,
      geofenceTask: GEOFENCE_TASK,
      heartbeatFetchTask: HEARTBEAT_FETCH_TASK,
    },

    updates: { enabled: false },
  },
};
