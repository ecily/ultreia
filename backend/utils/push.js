// backend/utils/push.js
// ESM, Node 22.x
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';

const accessToken = process.env.EXPO_ACCESS_TOKEN || null;
console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(accessToken)); // Health-Log

// Projekt-Scope zur Auswahl/Retry (muss zu Client passen)
const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

// Optional: Striktes Scoping aktiv? (nur Tokens mit passendem projectId zulassen)
// Default: an (true). Zum Debuggen/Notfall: PUSH_ENFORCE_PROJECT_SCOPE=0
const ENFORCE_PROJECT_SCOPE = !['0', 'false', 'False'].includes(
  String(process.env.PUSH_ENFORCE_PROJECT_SCOPE ?? '1')
);

console.log('[push] Project ID =', PROJECT_ID || '(none)');
console.log('[push] Enforce project scope =', ENFORCE_PROJECT_SCOPE);

// ⏳ Grace-Periode für frische Tokens gegen "DeviceNotRegistered"-Races (Default: 2 Min)
const GRACE_MS = (() => {
  const mins = Number(process.env.PUSH_GRACE_MINUTES || 2);
  return Number.isFinite(mins) && mins > 0 ? mins * 60 * 1000 : 2 * 60 * 1000;
})();

// Tipp: setze EXPO_ACCESS_TOKEN in DO, damit Requests deinem Expo-Projekt sicher zugeordnet sind.
//const expo = accessToken ? new Expo({ accessToken }) : new Expo();
  const expo = new Expo({
  accessToken: accessToken || undefined,
  projectId: PROJECT_ID || undefined,
  });



/* ────────────────────────────────────────────────────────────
   Helfer
   ──────────────────────────────────────────────────────────── */

function uniq(arr = []) {
  return Array.from(new Set(arr));
}
function normTokens(raw = []) {
  // trimme & filtere Leerstrings
  return uniq(
    (raw || [])
      .map((t) => (typeof t === 'string' ? t.trim() : t))
      .filter((t) => typeof t === 'string' && t.length > 0)
  );
}

/**
 * Prüft Tokens gegen DB & Projekt-Scope.
 * - Muss Expo-Format haben
 * - Muss in DB existieren
 * - Darf nicht disabled sein
 * - Bei ENFORCE_PROJECT_SCOPE && PROJECT_ID: doc.projectId muss matchen (falls gesetzt)
 */
async function scopeAndValidateTokens(rawTokens = []) {
  const dropped = { invalidFormat: [], unknown: [], disabled: [], mismatch: [] };
  const input = normTokens(rawTokens);
  if (!input.length) return { scoped: [], dropped };

  // Nur Expo-Format weiter betrachten (spart DB-Query)
  const expoLike = input.filter((t) => Expo.isExpoPushToken(t));
  const docs = expoLike.length
    ? await PushToken.find({ token: { $in: expoLike } })
        .select('token projectId disabled')
        .lean()
    : [];
  const byToken = new Map(docs.map((d) => [d.token, d]));

  const scoped = [];
  for (const t of input) {
    if (!Expo.isExpoPushToken(t)) {
      dropped.invalidFormat.push(t);
      continue;
    }
    const doc = byToken.get(t);
    if (!doc) {
      dropped.unknown.push(t);
      continue;
    }
    if (doc.disabled) {
      dropped.disabled.push(t);
      continue;
    }
    if (ENFORCE_PROJECT_SCOPE && PROJECT_ID && doc.projectId && doc.projectId !== PROJECT_ID) {
      dropped.mismatch.push(t);
      continue;
    }
    scoped.push(t);
  }

  // Kompakte Sichtbarkeit im Log (nur Counts, keine Token)
  const totalDropped =
    dropped.invalidFormat.length + dropped.unknown.length + dropped.disabled.length + dropped.mismatch.length;
  if (totalDropped > 0) {
    console.warn('[push] token filter', {
      in: input.length,
      out: scoped.length,
      dropped: {
        invalidFormat: dropped.invalidFormat.length,
        unknown: dropped.unknown.length,
        disabled: dropped.disabled.length,
        mismatch: dropped.mismatch.length,
      },
    });
  }
  return { scoped, dropped };
}

/* ────────────────────────────────────────────────────────────
   Senden
   ──────────────────────────────────────────────────────────── */

/**
 * Sendet Push an das Expo-Gateway (mit Chunking).
 * Default: channelId="offers", sound="default", priority="high".
 * Gibt Tickets + Mapping id->token zurück.
 */
export async function sendPush({
  tokens,
  title,
  body,
  data = {},
  channelId = 'offers',
  categoryId = undefined,
  sound = 'default',
  priority = 'high',
}) {
  // Vor dem Senden strikt gegen DB/Scope prüfen
  const { scoped } = await scopeAndValidateTokens(tokens || []);
  const valid = normTokens(scoped);

  if (!valid.length) {
    return { sent: 0, tickets: [], errors: ['no-valid-tokens'], okCount: 0, ticketIds: [], idToToken: {} };
  }

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data,
    channelId,
    ...(categoryId ? { categoryId } : {}),
    sound,
    priority,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  const errors = [];
  const idToToken = {};

  for (const chunk of chunks) {
    try {
      const res = await expo.sendPushNotificationsAsync(chunk);
      // Map Ticket IDs -> Tokens (gleiche Reihenfolge)
      res.forEach((t, i) => {
        const token = chunk[i]?.to;
        if (t?.id && token) idToToken[t.id] = token;
      });
      tickets.push(...res);
    } catch (e) {
      const msg = String(e?.message || e);
      errors.push(msg);
      // Typische Auth-/Scope-Hinweise prominenter loggen
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        console.error('[push] Expo send unauthorized. Prüfe EXPO_ACCESS_TOKEN (hat Zugriff auf dieses Projekt?)');
      }
    }
  }

  const okCount = tickets.filter((t) => t?.status === 'ok').length;
  const ticketIds = tickets.map((t) => t?.id).filter(Boolean);
  return { sent: messages.length, tickets, errors, okCount, ticketIds, idToToken };
}

/** Receipts abholen (+ kompakte Summary) */
export async function checkReceipts(ticketIds = []) {
  const ids = (ticketIds || []).filter(Boolean);
  if (!ids.length) return { receipts: {}, errors: [], summary: { ok: 0, errors: {} } };

  const chunks = expo.chunkPushNotificationReceiptIds(ids);
  const receipts = [];
  const errors = [];

  for (const chunk of chunks) {
    try {
      const res = await expo.getPushNotificationReceiptsAsync(chunk);
      receipts.push(res); // { [id]: { status, message, details } }
    } catch (e) {
      errors.push(String(e));
    }
  }

  // flatten
  const flat = receipts.reduce((acc, obj) => Object.assign(acc, obj), {});
  const summary = { ok: 0, errors: {} }; // errors gruppiert nach Code

  for (const id of Object.keys(flat)) {
    const r = flat[id];
    if (!r) continue;
    if (r.status === 'ok') {
      summary.ok += 1;
    } else if (r.status === 'error') {
      const code = r.details?.error || r.message || 'unknown';
      summary.errors[code] = (summary.errors[code] || 0) + 1;
    }
  }
  return { receipts: flat, errors, summary };
}

async function safeDisableToken(token) {
  try {
    await PushToken.updateOne({ token }, { $set: { disabled: true } });
  } catch {}
}

// Prüft, ob ein Token-Dokument "frisch" ist (innerhalb der Grace-Periode)
function isFreshDoc(doc) {
  if (!doc) return false;
  const now = Date.now();
  const ts = [
    doc.createdAt ? new Date(doc.createdAt).getTime() : null,
    doc.lastSeenAt ? new Date(doc.lastSeenAt).getTime() : null,
    doc.updatedAt ? new Date(doc.updatedAt).getTime() : null,
  ].filter((n) => Number.isFinite(n));
  if (!ts.length) return false;
  const newest = Math.max(...ts);
  return now - newest <= GRACE_MS;
}

/* ────────────────────────────────────────────────────────────
   Komfort: send + receipts + Grace + Auto-Retry auf neuestes Gerätetoken
   ──────────────────────────────────────────────────────────── */

/**
 * Komfort: sendet, verarbeitet Receipts und:
 *  - markiert DeviceNotRegistered-Token als disabled (ABER: NICHT, wenn frischer Token innerhalb der Grace-Periode),
 *  - versucht EINEN Retry mit dem neuesten aktiven Token derselben deviceId (im selben projectId),
 *  - liefert Diagnosefelder (disabledTokens, invalid, retry-Summary) zurück.
 */
export async function sendPushAndCheckReceipts({
  tokens,
  title,
  body,
  data = {},
  channelId = 'offers',
  categoryId = undefined,
  sound = 'default',
  priority = 'high',
  delayMs = 3500,
}) {
  const result = {
    sent: null,
    receipts: { receipts: {}, errors: [], summary: { ok: 0, errors: {} } },
    disabledTokens: [],
    invalid: [],
    retry: { count: 0, succeeded: 0, targets: [] },
    graceMs: GRACE_MS,
  };

  // 1) Initial send
  const sent = await sendPush({ tokens, title, body, data, channelId, categoryId, sound, priority });
  result.sent = sent;

  // 2) Receipts einsammeln
  if (sent.ticketIds?.length) {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const receipts = await checkReceipts(sent.ticketIds);
    result.receipts = receipts;

    // 3) DeviceNotRegistered behandeln (mit Grace-Periode)
    const retryCandidates = new Set(); // neue Tokens (strings) zum Retry
    for (const ticketId of Object.keys(receipts.receipts || {})) {
      const r = receipts.receipts[ticketId];
      if (!r) continue;

      if (r.status === 'error') {
        const code = r.details?.error || r.message || 'unknown';
        if (code === 'DeviceNotRegistered') {
          const badToken = sent.idToToken[ticketId];
          if (badToken) {
            let fresh = false;
            let devId = null;
            let proj = null;

            try {
              const badDoc = await PushToken.findOne({ token: badToken })
                .select('deviceId projectId createdAt updatedAt lastSeenAt disabled')
                .lean();

              fresh = isFreshDoc(badDoc);
              devId = badDoc?.deviceId || null;
              proj = badDoc?.projectId || null;

              if (fresh) {
                console.warn(
                  '[push] DeviceNotRegistered for FRESH token (within grace). NOT disabling.',
                  badToken.slice(0, 22) + '…',
                  { graceMs: GRACE_MS, deviceId: devId, projectId: proj }
                );
                if (ENFORCE_PROJECT_SCOPE && PROJECT_ID && proj && proj !== PROJECT_ID) {
                  console.warn('[push] Hinweis: Token gehört zu anderem projectId als konfiguriert.', {
                    tokenProject: proj,
                    serverProject: PROJECT_ID,
                  });
                }
              } else {
                await safeDisableToken(badToken);
                result.disabledTokens.push(badToken);
              }

              // 🔁 Falls deviceId bekannt → neuesten gültigen Token für dasselbe Gerät finden (gleiches Projekt)
              if (devId) {
                const q = {
                  deviceId: devId,
                  disabled: { $ne: true },
                };
                // Auf Projekt einschränken (muss mit Client übereinstimmen)
                const projFilter = PROJECT_ID || proj || null;
                if (projFilter) q.projectId = projFilter;

                // neuesten aktiven Token holen (lastSeenAt/updatedAt)
                const newest = await PushToken.findOne(q)
                  .sort({ lastSeenAt: -1, updatedAt: -1 })
                  .select('token')
                  .lean();

                const newestToken = newest?.token;
                if (newestToken && newestToken !== badToken) {
                  retryCandidates.add(newestToken);
                }
              }
            } catch (e) {
              // Falls DB-Lookup fehlschlägt: lieber NICHT blind disable'n
              console.error('[push] error while handling DeviceNotRegistered', e);
            }
          }
        } else if (code === 'MessageTooBig' || code === 'MessageRateExceeded') {
          // bekannte Fehler, aber kein Token-Problem
        } else {
          // Unbekannt → zur Info (wir markieren Token nicht als disabled)
          const tok = sent.idToToken[ticketId];
          if (tok) result.invalid.push(tok);
        }
      }
    }

    // 4) Einmaliger Retry auf aggregierte Ziel-Tokens (falls vorhanden)
    const retryTokens = Array.from(retryCandidates);
    if (retryTokens.length) {
      result.retry.count = retryTokens.length;
      result.retry.targets = retryTokens;
      try {
          const retrySend = await sendPush({
            tokens: retryTokens,
            title,
            body,
            data,
            channelId,
            categoryId,
            sound,
            priority,
          });

        // optional: kurze Receipt-Wartezeit & Summen mergen
        if (retrySend.ticketIds?.length) {
          const retryReceipts = await checkReceipts(retrySend.ticketIds);
          const okAfterRetry = retryReceipts.summary?.ok || 0;
          result.retry.succeeded = okAfterRetry;
          result.receipts.summary.ok += okAfterRetry;
          for (const [k, v] of Object.entries(retryReceipts.summary?.errors || {})) {
            result.receipts.summary.errors[k] = (result.receipts.summary.errors[k] || 0) + v;
          }
        }
      } catch (e) {
        console.error('[push] retry send error', e);
      }
    }
  }

  return result;
}

/* ────────────────────────────────────────────────────────────
   Kompatibilität / Aliase
   ──────────────────────────────────────────────────────────── */

export async function sendOffersPushSafe(args) {
  try {
    return await sendPush(args);
  } catch (e) {
    console.error('[push] sendOffersPushSafe error', e);
    return { sent: 0, tickets: [], errors: [String(e)], okCount: 0, ticketIds: [], idToToken: {} };
  }
}
export async function pushToTokens(args) {
  return sendPush(args);
}

export default { sendPush, sendOffersPushSafe, pushToTokens, checkReceipts, sendPushAndCheckReceipts };
