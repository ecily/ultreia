import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
export const API_BASE = String(extra.apiBase || 'http://10.0.2.2:3000/api').replace(/\/$/, '');
export const EXPO_PROJECT_ID = String(extra.eas?.projectId || '').trim();
export const LOCATION_TASK = 'ultreia-background-location-v1';
export const GEOFENCE_TASK = 'ultreia-geofence-v1';
export const LOCATION_CHANNEL = 'ultreia-location-v1';
export const ATTENTION_CHANNEL = 'ultreia-attention-v1';
