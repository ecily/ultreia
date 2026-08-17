import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
export const API_BASE = String(extra.apiBase || 'https://api.ultreia.app/api').replace(/\/$/, '');
export const ULTREIA_MODE = String(extra.mode || (API_BASE.startsWith('https://') ? 'production' : 'local'));
export const APP_VERSION = String(Constants.expoConfig?.version || 'unknown');
export const EXPO_PROJECT_ID = String(extra.eas?.projectId || '').trim();
export const LOCATION_TASK = 'ultreia-background-location-v1';
export const GEOFENCE_TASK = 'ultreia-geofence-v1';
export const LOCATION_CHANNEL = 'ultreia-location-v1';
export const ATTENTION_CHANNEL = 'ultreia-attention-v1';
