import express from 'express';
import { checkForMatchingOffers } from '../controllers/matchController.js';

const router = express.Router();

// ✅ explizite Route: /api/match/check
router.post('/check', checkForMatchingOffers);

export default router;
