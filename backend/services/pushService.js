// stepsmatch/backend/services/pushService.js
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

// Expo-SDK: immer mit FCM v1 (Service Account) arbeiten
const expo = new Expo({ useFcmV1: true });

/**
 * sendToDevice
 * - deviceId: Zielgerät
 * - message: { title, body, data, channelId?, sound?, priority? }
 */
export async function sendToDevice({ deviceId, message }) {
  try {
    if (!deviceId) throw new Error('deviceId-required');

    // Nur gültige Tokens nehmen
    const tokens = await PushToken.find({ deviceId, valid: true }).lean();
    if (!tokens.length) {
      console.warn('[pushService] no valid tokens for deviceId=', deviceId);
      return { ok: false, reason: 'no-valid-tokens' };
    }

    // Build Expo-Messages
    const msgs = tokens.map((t) => ({
      to: t.token,
      title: message.title,
      body: message.body,
      data: message.data || {},
      channelId: message.channelId || 'offers',
      sound: message.sound || 'default',
      priority: message.priority || 'high',
    }));

    const chunks = expo.chunkPushNotifications(msgs);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (err) {
        console.error('[pushService] send chunk error', err);
      }
    }

    // Tickets → Receipts auswerten
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const tok = tokens[i];
      if (!ticket) continue;

      if (ticket.status === 'ok') {
        await PushToken.updateOne(
          { _id: tok._id },
          { $set: { lastError: null, lastTriedAt: new Date(), valid: true } }
        );
      } else if (ticket.status === 'error') {
        const err = ticket.details?.error || ticket.message || 'unknown';
        console.warn('[pushService] error for token', tok.token.slice(0, 22) + '…', err);

        // DeviceNotRegistered / InvalidCredentials → Token ungültig
        if (['DeviceNotRegistered', 'MessageTooBig', 'InvalidCredentials', 'MessageRateExceeded'].includes(err)) {
          await PushToken.updateOne(
            { _id: tok._id },
            { $set: { valid: false, lastError: err, lastTriedAt: new Date() } }
          );
        } else {
          await PushToken.updateOne(
            { _id: tok._id },
            { $set: { lastError: err, lastTriedAt: new Date() } }
          );
        }
      }
    }

    return { ok: true, tickets };
  } catch (e) {
    console.error('[pushService] sendToDevice failed', e);
    return { ok: false, error: e.message };
  }
}
