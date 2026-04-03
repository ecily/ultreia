// stepsmatch/backend/routes/push.js
import express from 'express';
import mongoose from 'mongoose';
import { Expo } from 'expo-server-sdk';
import PushToken from '../models/PushToken.js';
import { sendToDevice } from '../services/pushService.js';

const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Constants & helpers
   ──────────────────────────────────────────────────────────── */
const PLATFORMS = new Set(['android', 'ios', 'web']);

const normPlatform = (p) => {
  const s = String(p || '').toLowerCase().trim();
  return PLATFORMS.has(s) ? s : 'android';
};
const parseBool = (v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled', 'active'].includes(s)) return true;
  if (['0', 'false', 'off', 'no', 'disabled', 'inactive'].includes(s)) return false;
  return undefined;
};
const normalizeInterestsInput = (input) => {
  if (input === undefined) return null; // no update requested
  const src = Array.isArray(input) ? input : String(input || '').split(/[,\n;|]/);
  const out = src
    .map((s) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
  return Array.from(new Set(out));
};
const isValidObjectId = (v) => {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); } catch { return false; }
};

console.log('[push] EXPO_ACCESS_TOKEN present =', Boolean(process.env.EXPO_ACCESS_TOKEN));

const PROJECT_ID =
  process.env.EXPO_PROJECT_ID ||
  process.env.EXPO_PROJECT ||
  process.env.PROJECT_ID ||
  null;

console.log('[push] routes projectId =', PROJECT_ID || '(none)');

/** Baut ein valides GeoJSON-Point-Objekt oder gibt null zurück. */
function normalizePoint(input, fallbackLat = null, fallbackLng = null) {
  try {
    // 1) Bereits GeoJSON?
    if (input && typeof input === 'object' && input.type === 'Point') {
      const coords = Array.isArray(input.coordinates) ? input.coordinates : null;
      if (coords && coords.length === 2) {
        const [lng, lat] = coords;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { type: 'Point', coordinates: [Number(lng), Number(lat)] };
        }
      }
      // Ungültiges GeoJSON → ignorieren
      return null;
    }
    // 2) Objekt mit lat/lng?
    if (input && typeof input === 'object') {
      const lat = Number(input.lat);
      const lng = Number(input.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { type: 'Point', coordinates: [lng, lat] };
      }
    }
    // 3) Fallback: separate Werte
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      return { type: 'Point', coordinates: [Number(fallbackLng), Number(fallbackLat)] };
    }
    return null;
  } catch {
    return null;
  }
}

/* prefer valid:true */
async function findLatestToken(queryBase, sort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 }) {
  const tValid = await PushToken.findOne({ ...queryBase, valid: true }).sort(sort).lean();
  if (tValid) return tValid;
  return PushToken.findOne({ ...queryBase, disabled: { $ne: true } }).sort(sort).lean();
}

async function getLatestActiveTokenPreferProject() {
  const baseSort = { lastSeenAt: -1, updatedAt: -1, createdAt: -1 };
  if (PROJECT_ID) {
    const withProject = await findLatestToken({ projectId: PROJECT_ID }, baseSort);
    if (withProject?.token) return withProject;
  }
  return findLatestToken({}, baseSort);
}

async function getLatestActiveTokenForDevice(deviceId, projectIdHint) {
  if (!deviceId) return null;
  const proj = PROJECT_ID || projectIdHint || null;
  const q = proj ? { deviceId, projectId: proj } : { deviceId };
  return findLatestToken(q);
}

async function chooseTargetToken({ token, deviceId, projectId }) {
  if (token && typeof token === 'string') {
    const trimmed = token.trim();
    if (Expo.isExpoPushToken(trimmed)) {
      const doc = await PushToken.findOne({ token: trimmed }).lean();
      return {
        token: trimmed,
        projectId: doc?.projectId ?? projectId ?? null,
        deviceId: doc?.deviceId ?? null,   // ⬅️ deviceId mitnehmen, falls vorhanden
        source: 'explicit-token',
      };
    }
  }
  if (deviceId) {
    const doc = await getLatestActiveTokenForDevice(deviceId, projectId);
    if (doc?.token) {
      return { token: doc.token, projectId: doc.projectId ?? projectId ?? null, deviceId, source: 'device-latest' };
    }
  }
  const last = await getLatestActiveTokenPreferProject();
  if (last?.token) {
    return { token: last.token, projectId: last.projectId ?? projectId ?? null, deviceId: last.deviceId ?? null, source: 'db-prefer-project' };
  }
  return { token: null, projectId: projectId ?? null, deviceId: null, source: 'none' };
}

function hasDNR(resp) {
  return (
    (resp?.receipts && resp.receipts.errors && Number(resp.receipts.errors.DeviceNotRegistered || 0) > 0) ||
    (Array.isArray(resp?.tickets) &&
      resp.tickets.some(
        (t) =>
          (t?.status || '').toLowerCase() === 'error' &&
          String(t?.details?.error || '').toLowerCase() === 'devicenotregistered'
      ))
  );
}

/* ────────────────────────────────────────────────────────────
   Routes
   ──────────────────────────────────────────────────────────── */

/** Health-Ping über GET – liefert nur einen OK-Hinweis.
 *  Optional: Wenn ?token=… oder ?deviceId=… gesetzt, wird ein echter Canary-Push versendet.
 */
router.get('/canary', async (req, res) => {
  try {
    const { token, deviceId, projectId } = req.query || {};

    // reiner Health-Ping (kein Token/Device übergeben)
    if (!token && !deviceId) {
      return res.json({
        ok: true,
        success: true,
        route: 'push',
        message: 'push canary up',
        projectId: PROJECT_ID || null,
      });
    }

    // echter Test-Push (per GET mit Query-Parametern)
    const target = await chooseTargetToken({ token, deviceId, projectId });
    if (!target.token) {
      return res.status(404).json({ ok: false, success: false, error: 'no-token' });
    }

    // DeviceId sicherstellen (falls nicht mitgegeben oder in target leer)
    let resolvedDeviceId = target.deviceId ?? deviceId ?? null;
    if (!resolvedDeviceId) {
      const tokenDoc = await PushToken.findOne({ token: target.token }, { deviceId: 1 }).lean();
      resolvedDeviceId = tokenDoc?.deviceId ?? null;
    }

    const title = 'StepsMatch Canary';
    const body = 'Automatischer Test-Push zur Token-Validierung.';
    const payload = { route: '/canary', source: 'canary', t: Date.now() };

    const resp = await sendToDevice({
      deviceId: resolvedDeviceId,
      token: target.token,
      message: { title, body, data: payload },
    });

    // ggf. DeviceNotRegistered auto-invalidieren
    let autoInvalidated = false;
    if (hasDNR(resp)) {
      const upd = await PushToken.updateOne(
        { token: target.token },
        { $set: { valid: false, lastError: 'DeviceNotRegistered', updatedAt: new Date() } }
      );
      autoInvalidated = upd.modifiedCount > 0;
      console.warn('[push][canary][GET] DeviceNotRegistered – token invalidated:', String(target.token).slice(0, 22) + '…');
    }

    return res.json({
      ok: true,
      success: true,
      route: 'push',
      projectId: target.projectId || PROJECT_ID || null,
      token: target.token,
      deviceId: resolvedDeviceId,
      result: resp,
      autoInvalidated,
    });
  } catch (e) {
    console.error('[push][canary][GET] error', e);
    return res.status(500).json({ ok: false, success: false, error: 'server-error' });
  }
});

/** ✅ FIX 2: Register – GeoJSON strikt & sicher */
router.post('/register', async (req, res) => {
  try {
    const {
      token,
      platform,
      userId,
      deviceId,
      projectId,
      interests,
      serviceEnabled,
      lastLocation,
      lat,
      lng,
      reason,
    } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'token-required' });
    }

    // Strikte Geo-Validierung (setzt nur bei valider Koordinate)
    const point = normalizePoint(lastLocation, Number(lat), Number(lng));
    const normalizedInterests = normalizeInterestsInput(interests);
    const enabledFlag = parseBool(serviceEnabled);

    const now = new Date();

    // $set/$setOnInsert → kein Replacement-Update
    const $set = {
      token: token.trim(),
      platform: normPlatform(platform),
      userId: isValidObjectId(userId) ? userId : null,
      deviceId: deviceId || null,
      valid: true,
      disabled: enabledFlag === false ? true : false,
      lastError: null,
      lastTriedAt: null,
      lastSeenAt: now,
      updatedAt: now,
      ...(projectId ? { projectId } : {}),
    };

    // Nur wenn Koordinate gültig ist → GeoJSON + lastHeartbeatAt
    if (point) {
      $set.lastLocation = point;
      $set.lastHeartbeatAt = now;
    }
    if (normalizedInterests !== null) {
      $set.interests = normalizedInterests;
    }
    // WICHTIG: Wenn keine Koordinate → NICHTS zu lastLocation setzen (auch kein leeres Objekt)!

    const $setOnInsert = {
      createdAt: now,
      firstSeenAt: now,
    };

    // Sicheres Upsert
    const doc = await PushToken.findOneAndUpdate(
      { token: token.trim() },
      { $set, $setOnInsert },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        omitUndefined: true,
        // runValidators bewusst aus – Geo wird von normalizePoint garantiert
      }
    ).lean();

    // Alte Tokens desselben Geräts invalidieren (wenn wir eine deviceId haben)
    if (doc?.deviceId) {
      const resInvalidate = await PushToken.updateMany(
        { deviceId: doc.deviceId, token: { $ne: doc.token } },
        { $set: { valid: false, lastError: 'replaced-by-new-token', updatedAt: new Date() } }
      );
      if (resInvalidate.modifiedCount > 0) {
        console.log('[push] register: invalidated old tokens', doc.deviceId, resInvalidate.modifiedCount);
      }
    }

    console.log('[push] register',
      String(token).slice(0, 22) + '…',
      'platform=', $set.platform,
      'deviceId=', $set.deviceId || '(none)',
      'point=', point ? 'ok' : 'n/a',
      normalizedInterests !== null ? `interests=${normalizedInterests.length}` : 'interests=keep',
      enabledFlag !== undefined ? `serviceEnabled=${enabledFlag}` : 'serviceEnabled=default-on',
      reason ? `reason=${reason}` : ''
    );

    res.json({
      success: true,
      id: doc?._id || null,
      platform: $set.platform,
      deviceId: $set.deviceId,
      valid: true,
      hadPoint: Boolean(point),
    });
  } catch (e) {
    console.error('[push] register error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

/**
 * Expliziter Remote-Service-State:
 * enabled=false -> Token(s) serverseitig deaktivieren (kein Remote-Push).
 * enabled=true  -> Token(s) wieder aktivieren.
 */
router.post('/service-state', async (req, res) => {
  try {
    const { token, deviceId, projectId, enabled, interests, reason } = req.body || {};
    const enabledFlag = parseBool(enabled);
    if (enabledFlag === undefined) {
      return res.status(400).json({ success: false, error: 'enabled-required' });
    }

    const trimmedToken = typeof token === 'string' ? token.trim() : '';
    const projectScope = projectId || PROJECT_ID || null;
    const normalizedInterests = normalizeInterestsInput(interests);

    const or = [];
    if (trimmedToken && Expo.isExpoPushToken(trimmedToken)) or.push({ token: trimmedToken });
    if (deviceId) {
      const q = { deviceId: String(deviceId) };
      if (projectScope) q.projectId = projectScope;
      or.push(q);
    }
    if (!or.length) {
      return res.status(400).json({ success: false, error: 'token-or-deviceId-required' });
    }

    const filter = or.length === 1 ? or[0] : { $or: or };
    const now = new Date();
    const $set = {
      disabled: !enabledFlag,
      valid: true,
      updatedAt: now,
      lastSeenAt: now,
      ...(projectScope ? { projectId: projectScope } : {}),
    };
    if (normalizedInterests !== null) $set.interests = normalizedInterests;

    const upd = await PushToken.updateMany(filter, { $set });

    console.log(
      '[push] service-state',
      `enabled=${enabledFlag}`,
      trimmedToken ? `token=${trimmedToken.slice(0, 22)}…` : 'token=(none)',
      deviceId ? `deviceId=${deviceId}` : 'deviceId=(none)',
      `matched=${upd.matchedCount || 0}`,
      `modified=${upd.modifiedCount || 0}`,
      normalizedInterests !== null ? `interests=${normalizedInterests.length}` : 'interests=keep',
      reason ? `reason=${reason}` : ''
    );

    return res.json({
      success: true,
      enabled: enabledFlag,
      matched: upd.matchedCount || 0,
      modified: upd.modifiedCount || 0,
    });
  } catch (e) {
    console.error('[push] service-state error', e);
    return res.status(500).json({ success: false, error: 'server-error' });
  }
});

router.post('/roundtrip', async (req, res) => {
  try {
    const { offerId: rawOfferId, title: rawTitle, body: rawBody, token, deviceId, projectId } = req.body || {};
    const target = await chooseTargetToken({ token, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Test-Push') + ` [offerId:${offerId}]`;

    const resp = await sendToDevice({
      deviceId: deviceId,
      token: target.token,                // <─ optional: Token explizit mitgeben
      message: { title, body, data: payload },
    });

    res.json({ success: true, projectId: target.projectId || null, meta: resp, source: target.source });
  } catch (e) {
    console.error('[push] roundtrip error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

router.post('/test', async (req, res) => {
  return router.handle({ ...req, url: '/roundtrip', method: 'POST' }, res, () => {});
});

router.post('/ping', async (_req, res) => {
  res.json({ success: true, projectId: PROJECT_ID || null, t: Date.now() });
});

router.post('/roundtrip-diagnose', async (req, res) => {
  try {
    const { token: explicitToken, deviceId, projectId, offerId: rawOfferId, title: rawTitle, body: rawBody } = req.body || {};
    const target = await chooseTargetToken({ token: explicitToken, deviceId, projectId });
    if (!target.token) return res.status(404).json({ success: false, error: 'no-token' });

    const offerId = rawOfferId || 'TEST_DIAG';
    const payload = { offerId, route: `/offers/${offerId}`, source: 'roundtrip', t: Date.now() };
    const title = rawTitle || 'StepsMatch';
    const body = (rawBody || 'Diagnose-Push') + ` [offerId:${offerId}]`;

    const resp = await sendToDevice({
      deviceId: deviceId,
      token: target.token,                // <─ optional
      message: { title, body, data: payload },
    });

    res.json({ success: true, projectId: target.projectId || null, diag: resp, tokenSource: target.source });
  } catch (e) {
    console.error('[push] diagnose error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

/* ────────────────────────────────────────────────────────────
   NEW: Canary endpoint (POST) – prüft gültigen Token & invalidiert bei Fehler
   ──────────────────────────────────────────────────────────── */
router.post('/canary', async (_req, res) => {
  try {
    const latest = await getLatestActiveTokenPreferProject();
    if (!latest?.token) {
      return res.status(404).json({ success: false, error: 'no-valid-token' });
    }

    const title = 'StepsMatch Canary';
    const body  = 'Automatischer Test-Push zur Token-Validierung.';
    const payload = { route: '/canary', source: 'canary', t: Date.now() };

    const resp = await sendToDevice({
      deviceId: latest.deviceId ?? null,
      token: latest.token,                // <─ wir adressieren exakt diesen Token
      message: { title, body, data: payload },
    });

    let autoInvalidated = false;
    if (hasDNR(resp)) {
      const upd = await PushToken.updateOne(
        { token: latest.token },
        { $set: { valid: false, lastError: 'DeviceNotRegistered', updatedAt: new Date() } }
      );
      autoInvalidated = upd.modifiedCount > 0;
      console.warn('[push][canary][POST] DeviceNotRegistered – token invalidated:', latest.token.slice(0, 22) + '…');
    }

    res.json({
      success: true,
      projectId: PROJECT_ID || latest.projectId || null,
      token: latest.token,
      deviceId: latest.deviceId ?? null,
      result: resp,
      autoInvalidated,
    });
  } catch (e) {
    console.error('[push][canary][POST] error', e);
    res.status(500).json({ success: false, error: 'server-error' });
  }
});

export default router;
