// stepsmatch/backend/routes/pushTest.js
import express from 'express';
import PushToken from '../models/PushToken.js';
import { pushToTokens } from '../utils/expoPush.js';
import { BRAND_NAME } from '../config/brand.js';

const router = express.Router();

/**
 * POST /api/push-test
 * Body (optional): { token?: string }
 * - Wenn token fehlt: nimmt die letzten 5 gespeicherten.
 * - Antwort enthält tickets & receipts zur schnellen Diagnose.
 */
router.post('/', async (req, res) => {
  try {
    const explicit = (req.body?.token && [req.body.token]) || [];
    const recent =
      explicit.length
        ? []
        : (await PushToken.find().sort({ updatedAt: -1 }).limit(5)).map((x) => x.token);

    const tokens = [...explicit, ...recent];
    if (!tokens.length) {
      return res.status(400).json({ ok: false, error: 'no tokens found' });
    }

    const { tickets, receipts } = await pushToTokens(tokens, {
      title: `${BRAND_NAME} Test`,
      body: 'Wenn du das siehst, funktionieren Pushes wieder ✅',
      data: { test: true, now: Date.now() },
    });

    res.json({ ok: true, sent: tokens.length, tickets, receipts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
