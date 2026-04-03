// stepsmatch/mobile/components/push/push-constants.ts

/** ───── Backend Base URL ───── */
export const API_BASE = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
export const HTTP_TIMEOUT_MS = 6000;
export const HTTP_RETRY_ATTEMPTS = 3;

/** ───── Tasks (IDs müssen zu euren Registrierungen passen) ───── */
export const BG_LOCATION_TASK = 'stepsmatch-bg-location-task';
export const GEOFENCE_TASK    = 'stepsmatch-geofence-task';

/** ───── Notification Channels & Categories ─────
 * Bestehende Channel-IDs aus eurem Setup:
 *  - offers-v2
 *  - stepsmatch-default-v2
 *  - com.ecily.mobile:stepsmatch-bg-location-task
 */
export const CHANNELS = {
  default: 'stepsmatch-default-v2',
  offers: 'offers-v2',
  offersLegacy: 'offers-legacy',
  bg: 'com.ecily.mobile:stepsmatch-bg-location-task',
} as const;

export const CATEGORIES = {
  offerGo: 'offer-go-v2', // Actions "go" / "later"
} as const;

/** ───── Branding / UI ───── */
export const BRAND_BLUE = '#0d4ea6';

/** ───── Zeit-/Watchdog-Parameter ───── */
export const WD_TICK_MS   = 20_000;
export const LOC_STALE_MS = 120_000;
export const GF_STALE_MS  = 180_000;

/** ───── Standort / Accuracy ───── */
export const FRESH_FIX_TIMEOUT_MS   = 4_000;
export const ACCURACY_TOKEN_CAP_M   = 60;
export const ENTER_SANITY_BUFFER_M  = 5;
export const OUTSIDE_TOLERANCE_M    = 5;

/** ───── Geofence Sync/Radius ───── */
export const MAX_GEOFENCES              = 20;
export const GEOFENCE_SYNC_INTERVAL_MS  = 60_000;
export const DEFAULT_RADIUS_M           = 120;

/** ───── Dedupe/Throttle ───── */
export const EVENT_DEDUP_WINDOW_MS            = 5_000;
export const MIN_MS_BETWEEN_PUSH_SAME_OFFER   = 2 * 60_000;
export const MIN_MS_BETWEEN_PUSH_GLOBAL       = 20_000;

/** ───── Grouping/Anti-Spam ───── */
export const GROUP_COOLDOWN_MS = 2 * 60_000;
export const SUMMARY_WINDOW_MS = 60_000;

/** ───── Expo Project ID (fix, nie dynamisch) ───── */
export const RESOLVED_PROJECT_ID = '08559a29-b307-47e9-a130-d3b31f73b4ed';
