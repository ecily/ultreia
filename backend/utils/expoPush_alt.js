// stepsmatch/backend/utils/expoPush.js
import { Expo } from 'expo-server-sdk';

const expo = new Expo({ useFcmV1: true }); // Stabil für Android

function buildAndroidPayload({ title, body, data }) {
  return {
    to: undefined, // wird pro Nachricht gesetzt
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'stepsmatch-default-v2', // MUSS zum Client-Channel passen
  };
}

async function sendExpoNotifications(messages) {
  const tickets = [];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const t = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...t);
    } catch (err) {
      console.error('[push] send chunk error:', err);
    }
  }
  return tickets;
}

async function fetchExpoReceipts(tickets) {
  const receiptIds = tickets.map((t) => t?.id).filter(Boolean);
  if (!receiptIds.length) return [];

  const receipts = [];
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (const chunk of chunks) {
    try {
      const r = await expo.getPushNotificationReceiptsAsync(chunk);
      receipts.push(r); // r ist { [id]: { status, message, details } }
    } catch (err) {
      console.error('[push] receipt chunk error:', err);
    }
  }
  return receipts;
}

/**
 * Sendet Pushes an Expo-Tokens, loggt Tickets & Receipts.
 * @param {string[]} expoTokens
 * @param {{title:string, body:string, data:any}} content
 * @returns {{tickets:any[], receipts:any[]}}
 */
export async function pushToTokens(expoTokens, content) {
  const valid = (expoTokens || []).filter((t) => Expo.isExpoPushToken(t));
  const invalid = (expoTokens || []).filter((t) => !Expo.isExpoPushToken(t));
  if (invalid.length) console.warn('[push] dropped invalid tokens:', invalid);
  if (!valid.length) return { tickets: [], receipts: [] };

  const messages = valid.map((token) => {
    const payload = buildAndroidPayload(content);
    return { ...payload, to: token };
  });

  const tickets = await sendExpoNotifications(messages);
  console.log('[push] tickets:', tickets);

  // Kurz warten, dann Receipts holen (für Debug ausreichend)
  await new Promise((r) => setTimeout(r, 1500));
  const receipts = await fetchExpoReceipts(tickets);
  console.log('[push] receipts:', JSON.stringify(receipts, null, 2));

  return { tickets, receipts };
}
