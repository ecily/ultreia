import express from 'express';
import Category from '../models/Category.js';
import Subcategory from '../models/Subcategory.js';

const router = express.Router();

function slugify(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function hydrateLegacyCategoryShape(catDoc) {
  const subs = await Subcategory.find({ category: catDoc._id, isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select('_id name slug')
    .lean();

  return {
    _id: catDoc._id,
    name: catDoc.name,
    slug: catDoc.slug,
    isActive: catDoc.isActive,
    sortOrder: catDoc.sortOrder,
    subcategories: subs.map((s) => s.name),
    subcategoryRefs: subs,
    createdAt: catDoc.createdAt,
    updatedAt: catDoc.updatedAt,
  };
}

router.get('/', async (_req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    const out = [];
    for (const c of categories) out.push(await hydrateLegacyCategoryShape(c));
    res.json(out);
  } catch (err) {
    console.error('Fehler beim Laden der Kategorien:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Kategorien' });
  }
});

router.get('/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.query || {};
    const filter = { isActive: true };
    if (categoryId) filter.category = categoryId;
    const rows = await Subcategory.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .populate('category', 'name slug')
      .lean();
    res.json(rows);
  } catch (err) {
    console.error('Fehler beim Laden der Subkategorien:', err);
    res.status(500).json({ error: 'Serverfehler beim Laden der Subkategorien' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, subcategories } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name erforderlich' });

    const slug = slugify(cleanName);
    const existing = await Category.findOne({ $or: [{ name: cleanName }, { slug }] });
    if (existing) return res.status(400).json({ error: 'Kategorie existiert bereits' });

    const category = await Category.create({ name: cleanName, slug });

    const subs = Array.isArray(subcategories) ? subcategories : [];
    for (const raw of subs) {
      const subName = String(raw || '').trim();
      if (!subName) continue;
      const subSlug = slugify(subName);
      await Subcategory.updateOne(
        { category: category._id, slug: subSlug },
        { $setOnInsert: { category: category._id, name: subName, slug: subSlug, isActive: true } },
        { upsert: true }
      );
    }

    const hydrated = await hydrateLegacyCategoryShape(category.toObject());
    return res.status(201).json(hydrated);
  } catch (err) {
    console.error('Fehler beim Erstellen der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen' });
  }
});

router.post('/:id/subcategories', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'name erforderlich' });

    const slug = slugify(cleanName);
    const existing = await Subcategory.findOne({ category: category._id, slug });
    if (existing) return res.status(400).json({ error: 'Subkategorie existiert bereits' });

    const doc = await Subcategory.create({ category: category._id, name: cleanName, slug });
    return res.status(201).json(doc);
  } catch (err) {
    console.error('Fehler beim Erstellen der Subkategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Subkategorie' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, subcategories } = req.body || {};
    const patch = {};
    if (typeof name === 'string' && name.trim()) {
      patch.name = name.trim();
      patch.slug = slugify(name.trim());
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    if (Array.isArray(subcategories)) {
      const desired = new Set(subcategories.map((s) => slugify(String(s || '').trim())).filter(Boolean));
      const current = await Subcategory.find({ category: updated._id }).lean();
      const currentBySlug = new Map(current.map((r) => [r.slug, r]));

      for (const raw of subcategories) {
        const clean = String(raw || '').trim();
        const slug = slugify(clean);
        if (!slug) continue;
        if (!currentBySlug.has(slug)) {
          await Subcategory.create({ category: updated._id, name: clean, slug, isActive: true });
        } else {
          await Subcategory.updateOne({ _id: currentBySlug.get(slug)._id }, { $set: { name: clean, isActive: true } });
        }
      }

      for (const row of current) {
        if (!desired.has(row.slug)) {
          await Subcategory.updateOne({ _id: row._id }, { $set: { isActive: false } });
        }
      }
    }

    const hydrated = await hydrateLegacyCategoryShape(updated.toObject());
    res.json(hydrated);
  } catch (err) {
    console.error('Fehler beim Aktualisieren der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Kategorie nicht gefunden' });

    await Subcategory.deleteMany({ category: deleted._id });
    res.json({ success: true, message: 'Kategorie gelöscht' });
  } catch (err) {
    console.error('Fehler beim Löschen der Kategorie:', err);
    res.status(500).json({ error: 'Serverfehler beim Löschen' });
  }
});

export default router;
