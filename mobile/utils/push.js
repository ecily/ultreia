// stepsmatch/backend/utils/push.js
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

/**
 * Centralized Expo Push Client (StepsMatch)
 * - Forces correct channelId default (offers-v2) to match the app's Android channel
 * - Uses Expo projectId header so tokens are scoped correctly (avoids DeviceNotRegistered)
 * - Sends in chunks, collects tickets & receipts
 * - Auto-disables *and* invalidates tokens on DeviceNotRegistered
 * - When pushing from DB, picks the *freshest* token per deviceId (prevents sending to stale tokens)
 */

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECTID || // legacy env
  process.env.EXPO_PROJECT ||   // last-resort alias
  '08559a29-b307-47e9-a130-d3b31f73b4ed'; // hard fallback (your real Expo Project ID)

const DEFAULT_CHANNEL_ID =
  process.env.EXPO_PUSH_CHANNEL_ID ||
  'offers-v2'; // must match the channel created in the app

// Create Expo client; attach projectId if available (important for token scope)
const expo = new Expo(PROJECT_ID ? { projectId: PROJECT_ID } : {});

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export function isExpoToken(str) {
  try {
    return Expo.isExpoPushToken(String(str || '').trim());
  } catch {
    return false;
  }
}

/**
 * pushToTokens(tokens, { title, body, data, sound, priority, channelId })
 * - tokens: string|string[]
 * - returns: { tickets: [], receipts: {}, disabledTokens: [], invalid: [] }
 */
export async function pushToTokens(tokens, message = {}) {
  const tokenList = asArray(tokens)
    .map(t => String(t || '').trim())
    .filter(Boolean);

  // Filter only syntactically valid Expo tokens; log invalids
  const valid = [];
  const invalid = [];
  for (const t of tokenList) {
    if (isExpoToken(t)) valid.push(t);
    else invalid.push(t);
  }

  if (invalid.length) {
    console.warn('[push] invalid tokens filtered:', invalid.length);
  }
  if (!valid.length) {
    return { tickets: [], receipts: {}, disabledTokens: [], invalid };
  }

  // Default payload (Android requires an existing channelId, we default to offers-v2)
  const baseMsg = {
    title: message.title ?? 'StepsMatch',
    body: message.body ?? '',
    data: message.data ?? {},
    sound: message.sound ?? 'default',
    channelId: message.channelId ?? DEFAULT_CHANNEL_ID, // <— important
    priority: message.priority ?? 'high',
  };

  // Build messages
  const messages = valid.map(to => ({ to, ...baseMsg }));

  // Chunk & send
  const tickets = [];
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      console.error('[push] send error:', err);
    }
  }

  // Collect receipt IDs
  const receiptIds = tickets
    .map(t => t?.id)
    .filter(Boolean);

  const receipts = {};
  const disabledTokens = [];

  if (receiptIds.length) {
    const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const rc of receiptChunks) {
      try {
        const rec = await expo.getPushNotificationReceiptsAsync(rc);
        Object.assign(receipts, rec);

        // Inspect receipts → disable DeviceNotRegistered
        // We map ticket index -> token by order (Expo preserves order in responses)
        for (const [id, info] of Object.entries(rec || {})) {
          if (info?.status === 'error') {
            const err =
              info?.details?.error ||
              info?.details?.errorCode ||
              info?.message;

            if (err === 'DeviceNotRegistered') {
              const idx = tickets.findIndex(t => t?.id === id);
              if (idx >= 0) {
                const tok = messages[idx]?.to;
                if (tok) {
                  disabledTokens.push(tok);
                }
              }
            } else {
              console.warn('[push] receipt error:', err, info);
            }
          }
        }
      } catch (err) {
        console.error('[push] receipts error:', err);
      }
    }
  }

  // Persist disable/invalid in DB (best-effort)
  if (disabledTokens.length) {
    try {
      const now = new Date();
      const res = await PushToken.updateMany(
        { token: { $in: disabledTokens } },
        { $set: { disabled: true, valid: false, lastError: 'DeviceNotRegistered', updatedAt: now } }
      );
      console.log('[push] disabled tokens (DeviceNotRegistered):', disabledTokens.length, 'updated:', res?.modifiedCount ?? 'n/a');
    } catch (err) {
      console.error('[push] disable DB update error:', err);
    }
  }

  // Optional visibility
  if (!PROJECT_ID) {
    console.warn('[push] WARNING: PROJECT_ID missing — Dev tokens may be rejected by Expo');
  }

  return { tickets, receipts, disabledTokens, invalid };
}

/**
 * Convenience: push to many tokens from DB query (e.g., by user or by area)
 * selector can be { disabled: false, platform: 'android', ... }
 *
 * Improvements:
 *  - Enforces projectId match (if PROJECT_ID is set)
 *  - Filters disabled:false & valid:true by default
 *  - Picks the *freshest* token per deviceId (by lastSeenAt, fallback createdAt)
 *  - Sends using channelId DEFAULT_CHANNEL_ID ('offers-v2') unless overridden
 */
export async function pushByQuery(selector = {}, message = {}) {
  const baseSelector = {
    ...(selector || {}),
    disabled: false,
    valid: true,
    ...(PROJECT_ID ? { projectId: PROJECT_ID } : {}),
  };

  // We need deviceId & timestamps to pick freshest token per device
  const docs = await PushToken.find(
    baseSelector,
    { token: 1, deviceId: 1, lastSeenAt: 1, createdAt: 1 }
  ).lean();

  if (!docs.length) {
    console.warn('[push] no tokens matched selector', baseSelector);
    return { tickets: [], receipts: {}, disabledTokens: [], invalid: [] };
  }

  // Group by deviceId, pick freshest (prefer lastSeenAt, fallback createdAt)
  const pickFreshestPerDevice = (() => {
    const byDevice = new Map(); // deviceId -> {token, lastSeenAt, createdAt}
    for (const d of docs) {
      const key = d.deviceId || 'unknown';
      const prev = byDevice.get(key);
      const currScore = Number(new Date(d.lastSeenAt || d.createdAt || 0));
      const prevScore = Number(new Date(prev?.lastSeenAt || prev?.createdAt || 0));
      if (!prev || currScore > prevScore) {
        byDevice.set(key, d);
      }
    }
    return Array.from(byDevice.values());
  })();

  const tokens = pickFreshestPerDevice
    .map(d => d.token)
    .filter(Boolean);

  // Force our canonical channel unless caller overrides
  const msg = {
    ...message,
    channelId: message.channelId ?? DEFAULT_CHANNEL_ID,
    priority: message.priority ?? 'high',
  };

  return pushToTokens(tokens, msg);
}
