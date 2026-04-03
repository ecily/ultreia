import express from 'express';
import mongoose from 'mongoose';
import PushToken from '../models/PushToken.js';
import OfferVisibility from '../models/OfferVisibility.js';

const router = express.Router();

const DEFAULT_SNOOZE_MIN = Number(process.env.NOTIF_SNOOZE_MINUTES ?? 120);
const DEFAULT_MUTE_MIN = Number(process.env.NOTIF_MUTE_MINUTES ?? (7 * 24 * 60));
const DEFAULT_GO_MUTE_MIN = Number(process.env.NOTIF_GO_MUTE_MINUTES ?? (24 * 60));

function normAction(a) {
  return String(a || '').trim().toLowerCase();
}

router.post('/action', async (req, res) => {
  try {
    const b = req.body || {};
    const action = normAction(b.action);
    const offerId = String(b.offerId || '').trim();
    const tokenId = b.tokenId ? String(b.tokenId) : null;
    const deviceId = b.deviceId ? String(b.deviceId) : null;
    const token = b.token ? String(b.token).trim() : null;
    const minutes = Number(b.minutes || 0);

    if (!offerId) return res.status(400).json({ ok: false, error: 'offerId_required' });
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ ok: false, error: 'offerId_invalid' });
    }
    if (!['go', 'later', 'no'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'action_invalid' });
    }

    let tokenDoc = null;
    if (tokenId) {
      tokenDoc = await PushToken.findOne({ _id: tokenId }).select('_id token deviceId').lean();
    }
    if (!tokenDoc && token) {
      tokenDoc = await PushToken.findOne({ token }).select('_id token deviceId').lean();
    }
    if (!tokenDoc && deviceId) {
      tokenDoc = await PushToken.findOne({ deviceId, disabled: { $ne: true } })
        .sort({ lastSeenAt: -1, updatedAt: -1 })
        .select('_id token deviceId')
        .lean();
    }
    if (!tokenDoc?._id) return res.status(404).json({ ok: false, error: 'token_not_found' });

    if (action === 'later') {
      const mins = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_SNOOZE_MIN;
      await OfferVisibility.snooze(tokenDoc._id, offerId, mins);
      return res.json({ ok: true, action, snoozeMinutes: mins });
    }

    if (action === 'go') {
      const mins = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_GO_MUTE_MIN;
      await OfferVisibility.setSuppressFor(tokenDoc._id, offerId, mins * 60 * 1000);
      return res.json({ ok: true, action, mutedMinutes: mins });
    }

    if (action === 'no') {
      const mins = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MUTE_MIN;
      await OfferVisibility.setSuppressFor(tokenDoc._id, offerId, mins * 60 * 1000);
      return res.json({ ok: true, action, mutedMinutes: mins });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[notifications.action] error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
