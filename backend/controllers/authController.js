// backend/routes/userAuth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';

const router = express.Router();

// ⏺️ Registrierung
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'E-Mail bereits vergeben' });

    const newUser = new User({ name, email, password });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// ⏺️ Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Falsche Anmeldedaten' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Falsche Anmeldedaten' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// ⏺️ 🆕 Push Token speichern
router.post('/push-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ error: 'Kein Push-Token übergeben' });
    }

    const user = await User.findByIdAndUpdate(userId, { expoPushToken }, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    }

    res.json({ message: 'Push-Token gespeichert', user });
  } catch (err) {
    console.error('❌ Fehler beim Speichern des Push Tokens:', err);
    res.status(500).json({ error: 'Serverfehler beim Speichern des Push Tokens' });
  }
});

export default router;
