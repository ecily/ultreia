// /routes/userAuth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../models/User.js';
import Provider from '../models/Provider.js';
import sendPushNotification from '../utils/sendPushNotification.js';
import { BRAND_NAME } from '../config/brand.js';

const router = express.Router();
const DEFAULT_PROVIDER_CATEGORY = 'Dienstleistungen';
const DEFAULT_PROVIDER_LOCATION = [15.4395, 47.0707]; // Graz fallback [lng, lat]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_TTL_MINUTES = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES || 30);
const RESEND_COOLDOWN_SECONDS = Number(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS || 45);

const normalize = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();
const normalizeUsername = (value) => normalize(value).toLowerCase().replace(/[^a-z0-9._-]/g, '');

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function buildDisplayName({ firstName, lastName, username, fallbackName, email }) {
  const fullName = `${normalize(firstName)} ${normalize(lastName)}`.trim();
  if (fullName) return fullName;
  if (normalize(username)) return normalize(username);
  if (normalize(fallbackName)) return normalize(fallbackName);
  return normalize(email);
}

function sanitizeUser(userDoc) {
  const user = userDoc?.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  delete user.emailVerificationCodeHash;
  delete user.emailVerificationExpiresAt;
  delete user.emailVerificationRequestedAt;
  return user;
}

function needsCodePreview(delivery) {
  if (process.env.EMAIL_VERIFICATION_DEBUG === '1') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return !delivery?.delivered;
}

async function sendVerificationEmail({ email, code, displayName }) {
  const apiKey = normalize(process.env.RESEND_API_KEY);
  const from = normalize(process.env.RESEND_FROM_EMAIL);

  if (!apiKey || !from) {
    console.log(`[auth] verification code for ${email}: ${code}`);
    return { delivered: false, channel: 'log', reason: 'resend_not_configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Dein ${BRAND_NAME} Verifizierungscode`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
          <p>Hallo ${displayName || `bei ${BRAND_NAME}`},</p>
          <p>dein Verifizierungscode lautet:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>
          <p>Der Code ist ${VERIFICATION_TTL_MINUTES} Minuten gueltig.</p>
        </div>`,
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('[auth] resend email send failed', response.status, txt);
      return { delivered: false, channel: 'resend', reason: `http_${response.status}` };
    }

    return { delivered: true, channel: 'resend' };
  } catch (error) {
    console.error('[auth] resend email error', error?.message || error);
    return { delivered: false, channel: 'resend', reason: 'network_error' };
  }
}

function parseAuthUserId(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.userId || decoded?.id || null;
  } catch {
    return null;
  }
}

async function upsertVerificationCode(user) {
  const code = generateVerificationCode();
  user.emailVerificationCodeHash = hashVerificationCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000);
  user.emailVerificationRequestedAt = new Date();
  await user.save();

  const delivery = await sendVerificationEmail({
    email: user.email,
    code,
    displayName: user.firstName || user.username || user.name,
  });

  return { code, delivery };
}

// Registrierung
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, name, email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedFirstName = normalize(firstName);
    const normalizedLastName = normalize(lastName);
    const normalizedUsername = normalizeUsername(username);
    const normalizedLegacyName = normalize(name);

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Bitte gib eine gueltige E-Mail-Adresse ein.' });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });
    }

    const hasNamePair = Boolean(normalizedFirstName && normalizedLastName);
    if (!hasNamePair && !normalizedUsername && !normalizedLegacyName) {
      return res.status(400).json({
        message: 'Bitte gib Vorname und Nachname oder alternativ einen Username ein.',
      });
    }

    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      if (existingEmailUser.emailVerified) {
        return res.status(409).json({ message: 'Diese E-Mail-Adresse ist bereits vergeben.' });
      }

      const { code, delivery } = await upsertVerificationCode(existingEmailUser);
      const payload = {
        message: 'Diese E-Mail ist bereits registriert, aber noch nicht bestaetigt.',
        verificationRequired: true,
        email: existingEmailUser.email,
      };
      if (needsCodePreview(delivery)) payload.verificationCodePreview = code;
      return res.status(409).json(payload);
    }

    if (normalizedUsername) {
      const existingUsername = await User.findOne({ username: normalizedUsername });
      if (existingUsername) {
        return res.status(409).json({ message: 'Dieser Username ist bereits vergeben.' });
      }
    }

    const finalName = buildDisplayName({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      username: normalizedUsername,
      fallbackName: name,
      email: normalizedEmail,
    });

    const newUser = new User({
      name: finalName,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      username: normalizedUsername || null,
      email: normalizedEmail,
      password,
      emailVerified: false,
    });

    await newUser.save();

    let provider = null;
    try {
      provider = await Provider.create({
        name: finalName,
        address: 'Adresse noch nicht gesetzt',
        category: DEFAULT_PROVIDER_CATEGORY,
        description: 'Automatisch bei Registrierung erstellt. Bitte Profil vervollstaendigen.',
        contact: { email: normalizedEmail },
        location: { type: 'Point', coordinates: DEFAULT_PROVIDER_LOCATION },
        user: newUser._id,
      });
    } catch (providerErr) {
      console.error('Provider konnte nicht erstellt werden, rolle User zurueck:', providerErr);
      await User.findByIdAndDelete(newUser._id);
      return res.status(500).json({
        message: 'Registrierung fehlgeschlagen (Provider-Profil konnte nicht erstellt werden).',
      });
    }

    const { code, delivery } = await upsertVerificationCode(newUser);
    const payload = {
      message: 'Registrierung erfolgreich. Bitte bestaetige deine E-Mail mit dem Code.',
      verificationRequired: true,
      email: newUser.email,
      user: sanitizeUser(newUser),
      provider,
    };
    if (needsCodePreview(delivery)) payload.verificationCodePreview = code;

    return res.status(201).json(payload);
  } catch (err) {
    console.error('Fehler bei Registrierung:', err);
    return res.status(500).json({ message: 'Registrierung fehlgeschlagen.' });
  }
});

// E-Mail Verifizierung
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalize(code);

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({ message: 'E-Mail und Verifizierungscode sind erforderlich.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'Kein Konto fuer diese E-Mail gefunden.' });
    }

    if (user.emailVerified) {
      const token = issueToken(user._id);
      return res.json({
        message: 'E-Mail war bereits bestaetigt.',
        token,
        user: sanitizeUser(user),
      });
    }

    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      return res.status(400).json({ message: 'Es liegt kein gueltiger Verifizierungscode vor.' });
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: 'Der Verifizierungscode ist abgelaufen. Bitte fordere einen neuen Code an.',
        errorCode: 'VERIFICATION_CODE_EXPIRED',
      });
    }

    const incomingHash = hashVerificationCode(normalizedCode);
    if (incomingHash !== user.emailVerificationCodeHash) {
      return res.status(400).json({
        message: 'Der Verifizierungscode ist nicht korrekt.',
        errorCode: 'VERIFICATION_CODE_INVALID',
      });
    }

    user.emailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    user.emailVerificationRequestedAt = null;
    await user.save();

    const token = issueToken(user._id);
    return res.json({
      message: 'E-Mail erfolgreich bestaetigt.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Fehler bei verify-email:', err);
    return res.status(500).json({ message: 'E-Mail Verifizierung fehlgeschlagen.' });
  }
});

// Verifizierungscode erneut senden
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Bitte gib eine E-Mail-Adresse ein.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'Kein Konto fuer diese E-Mail gefunden.' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Diese E-Mail ist bereits bestaetigt.' });
    }

    const lastRequestedAt = user.emailVerificationRequestedAt?.getTime?.() || 0;
    const now = Date.now();
    const elapsedSec = Math.floor((now - lastRequestedAt) / 1000);
    if (lastRequestedAt && elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const retryAfterSeconds = RESEND_COOLDOWN_SECONDS - elapsedSec;
      return res.status(429).json({
        message: `Bitte warte ${retryAfterSeconds}s, bevor du einen neuen Code anforderst.`,
        retryAfterSeconds,
      });
    }

    const { code, delivery } = await upsertVerificationCode(user);
    const payload = {
      message: 'Ein neuer Verifizierungscode wurde gesendet.',
      email: user.email,
    };
    if (needsCodePreview(delivery)) payload.verificationCodePreview = code;
    return res.json(payload);
  } catch (err) {
    console.error('Fehler bei resend-verification:', err);
    return res.status(500).json({ message: 'Neuer Verifizierungscode konnte nicht gesendet werden.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Falsche Anmeldedaten.' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Falsche Anmeldedaten.' });
    }

    if (!user.emailVerified) {
      const sent = await upsertVerificationCode(user);
      const previewCode = needsCodePreview(sent.delivery) ? sent.code : undefined;

      return res.status(403).json({
        message: 'Bitte bestaetige zuerst deine E-Mail-Adresse.',
        errorCode: 'EMAIL_NOT_VERIFIED',
        verificationRequired: true,
        email: user.email,
        ...(previewCode ? { verificationCodePreview: previewCode } : {}),
      });
    }

    const token = issueToken(user._id);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Fehler beim Login:', err);
    return res.status(500).json({ message: 'Login fehlgeschlagen.' });
  }
});

// Eigenes Profil (mit Bearer Token)
router.get('/me', async (req, res) => {
  try {
    const userId = parseAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Nicht autorisiert.' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'Nutzer nicht gefunden.' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Fehler bei /users/me:', err);
    return res.status(500).json({ message: 'Profil konnte nicht geladen werden.' });
  }
});

// Push Token speichern
router.post('/push-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ message: 'Kein Push-Token uebergeben.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Nutzer nicht gefunden.' });
    }

    user.expoPushToken = expoPushToken;
    await user.save();

    return res.json({ message: 'Push-Token gespeichert.', userId, expoPushToken });
  } catch (err) {
    console.error('Fehler beim Speichern des Push Tokens:', err);
    return res.status(500).json({ message: 'Serverfehler beim Speichern des Push Tokens.' });
  }
});

// Test-Push senden
router.post('/test-push/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user || !user.expoPushToken) {
      return res.status(404).json({ message: 'Kein gueltiger Push-Token gefunden.' });
    }

    const result = await sendPushNotification(user.expoPushToken, {
      title: 'Push funktioniert!',
      body: `Dies ist eine Testnachricht von ${BRAND_NAME}.`,
      data: { screen: 'Home' },
    });

    return res.json({ message: 'Push gesendet.', result });
  } catch (err) {
    console.error('Fehler bei Test-Push:', err);
    return res.status(500).json({ message: 'Fehler beim Senden der Push-Nachricht.' });
  }
});

// Interessen & Radius speichern
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferredRadius, interests } = req.body || {};

    if (preferredRadius == null || !Array.isArray(interests)) {
      return res.status(400).json({ message: 'Radius und Interessen sind erforderlich.' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { preferredRadius, interests },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Nutzer nicht gefunden.' });
    }

    return res.json({ message: 'Praeferenzen erfolgreich gespeichert.', user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Fehler beim Speichern der Praeferenzen:', error);
    return res.status(500).json({ message: 'Serverfehler beim Speichern der Praeferenzen.' });
  }
});

export default router;
