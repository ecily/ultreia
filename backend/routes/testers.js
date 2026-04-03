import express from "express";
import Tester from "../models/Tester.js";

const router = express.Router();

/**
 * POST /api/testers/validate
 * Body: { key }
 * -> Prüft, ob Key existiert, markiert validatedAt, setzt status=validated
 */
router.post("/validate", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ ok: false, message: "Key fehlt." });

    const tester = await Tester.findOne({ key });
    if (!tester) {
      return res.status(404).json({ ok: false, message: "Ungültiger Key." });
    }

    tester.validatedAt = new Date();
    tester.status = "validated";
    await tester.save();

    res.json({
      ok: true,
      tester: {
        key: tester.key,
        name: tester.name,
        email: tester.email,
        gateModalMessage: tester.gateModalMessage || "",
      },
    });
  } catch (err) {
    console.error("[validate] error", err);
    res.status(500).json({ ok: false, message: "Serverfehler bei Validierung." });
  }
});

/**
 * POST /api/testers/accept
 * Body: { key, ndaVersion }
 * -> Markiert acceptedAt + NDA-Version, setzt status=accepted
 */
router.post("/accept", async (req, res) => {
  try {
    const { key, ndaVersion } = req.body;
    if (!key) return res.status(400).json({ ok: false, message: "Key fehlt." });

    const tester = await Tester.findOne({ key });
    if (!tester) {
      return res.status(404).json({ ok: false, message: "Ungültiger Key." });
    }

    tester.acceptedAt = new Date();
    tester.ndaVersion = ndaVersion || "v1.0";
    tester.status = "accepted";
    await tester.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[accept] error", err);
    res.status(500).json({ ok: false, message: "Serverfehler bei Akzeptanz." });
  }
});

export default router;
