import express from 'express';
import mongoose from 'mongoose';
import Provider from '../models/Provider.js';
import Category from '../models/Category.js';

const { Types } = mongoose;
const router = express.Router();

async function resolveProviderCategory(update = {}) {
  const out = { ...update };
  if (out.categoryId) {
    const cat = await Category.findById(out.categoryId).select('_id name').lean();
    if (cat) {
      out.categoryId = cat._id;
      out.category = cat.name;
    }
    return out;
  }
  if (typeof out.category === 'string' && out.category.trim()) {
    const cat = await Category.findOne({ name: out.category.trim() }).select('_id name').lean();
    if (cat) {
      out.categoryId = cat._id;
      out.category = cat.name;
    }
  }
  return out;
}

function buildUpdate(body = {}) {
  const update = {};

  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.category === 'string') update.category = body.category;
  if (body.categoryId) update.categoryId = body.categoryId;
  if (typeof body.description === 'string') update.description = body.description;
  if (typeof body.address === 'string') update.address = body.address;
  if (body.contact && typeof body.contact === 'object') update.contact = body.contact;
  if (body.openingHours && typeof body.openingHours === 'object') update.openingHours = body.openingHours;

  if (body.location?.coordinates?.length === 2) {
    const [lng, lat] = body.location.coordinates;
    const lngNum = Number(lng);
    const latNum = Number(lat);
    if (Number.isFinite(lngNum) && Number.isFinite(latNum)) {
      update.location = {
        type: 'Point',
        coordinates: [lngNum, latNum],
      };
    }
  }

  if (body.radiusMeters !== undefined) {
    const r = Number(body.radiusMeters);
    if (Number.isFinite(r)) update.radiusMeters = r;
  }

  return update;
}

router.get('/', async (_req, res) => {
  try {
    const providers = await Provider.find().populate('categoryId', 'name slug');
    const rows = providers.map((p) => ({
      ...p.toObject(),
      categoryRef: p?.categoryId && typeof p.categoryId === 'object' ? p.categoryId : null,
      category: p?.category || p?.categoryId?.name || null,
    }));
    res.json(rows);
  } catch (err) {
    console.error('Fehler beim Laden der Anbieter:', err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Anbieter' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, categoryId, location, address, description, contact, user, openingHours, radiusMeters } = req.body;
    if (!name || (!category && !categoryId) || !location || !address || !user) {
      return res.status(400).json({ error: 'Fehlende Pflichtfelder' });
    }

    const coords = location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      return res.status(400).json({ error: 'Ungültige Location-Koordinaten' });
    }
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ error: 'Ungültige Location-Koordinaten (NaN)' });
    }

    const payload = await resolveProviderCategory({
      name,
      category,
      categoryId,
      location: { type: 'Point', coordinates: [lng, lat] },
      address,
      description,
      contact,
      openingHours,
      user,
      ...(radiusMeters !== undefined ? { radiusMeters: Number(radiusMeters) } : {}),
    });

    const doc = new Provider(payload);
    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Fehler beim Anlegen des Anbieters:', error);
    res.status(400).json({ error: 'Fehler beim Anlegen des Anbieters.' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const provider = await Provider.findOne({ user: userId }).populate('categoryId', 'name slug');
    if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json({
      ...provider.toObject(),
      categoryRef: provider?.categoryId && typeof provider.categoryId === 'object' ? provider.categoryId : null,
      category: provider?.category || provider?.categoryId?.name || null,
    });
  } catch (err) {
    console.error('Fehler beim Laden per userId:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    const provider = await Provider.findById(id).populate('categoryId', 'name slug');
    if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json({
      ...provider.toObject(),
      categoryRef: provider?.categoryId && typeof provider.categoryId === 'object' ? provider.categoryId : null,
      category: provider?.category || provider?.categoryId?.name || null,
    });
  } catch (err) {
    console.error('Fehler beim Laden des Anbieters:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Anbieters' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    let update = buildUpdate(req.body);
    update = await resolveProviderCategory(update);

    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });

    const doc = await Provider.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(doc);
  } catch (e) {
    console.error('[PATCH /providers/:id] Fehler:', e);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Anbieters' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Ungültige ID' });

    let update = buildUpdate(req.body);
    update = await resolveProviderCategory(update);
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Keine gültigen Felder zum Aktualisieren' });

    const doc = await Provider.findByIdAndUpdate(id, update, { new: true, upsert: false, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
    res.json(doc);
  } catch (e) {
    console.error('[PUT /providers/:id] Fehler:', e);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Anbieters' });
  }
});

export default router;
