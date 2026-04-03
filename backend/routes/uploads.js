// backend/routes/uploads.js
import express from 'express';
import cloudinary from '../utils/cloudinary.js';
import multer from 'multer';
import streamifier from 'streamifier';

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Multer: Speicher im RAM + Validierung (nur Bilder, max 8 MB)
   ───────────────────────────────────────────────────────────── */
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const storage = multer.memoryStorage();

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimes.has(file.mimetype)) {
    return cb(
      new Error('Ungültiger Dateityp. Erlaubt: JPEG, PNG, WEBP, GIF, HEIC/HEIF')
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter,
});

/* ─────────────────────────────────────────────────────────────
   Cloudinary Helper
   ───────────────────────────────────────────────────────────── */
function uploadBufferToCloudinary(buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: process.env.CLOUDINARY_FOLDER || 'ultreia',
        ...opts,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function cloudinaryEnvConfigured() {
  const cfg = cloudinary.config();
  return Boolean(cfg?.cloud_name && cfg?.api_key && cfg?.api_secret);
}

/* ─────────────────────────────────────────────────────────────
   public_id aus Cloudinary-URL extrahieren
   ───────────────────────────────────────────────────────────── */
function extractPublicIdFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // .../image/upload/<optional transforms>/v123/<folder>/<file.ext>
    const uploadIdx = parts.findIndex((p) => p === 'upload');
    if (uploadIdx === -1 || uploadIdx >= parts.length - 1) return null;

    const afterUpload = parts.slice(uploadIdx + 1);

    // Transformationen (Segmente mit Kommas) überspringen
    let i = 0;
    while (i < afterUpload.length && afterUpload[i].includes(',')) i++;

    // Version "v123" überspringen
    if (i < afterUpload.length && /^v\d+$/.test(afterUpload[i])) i++;

    const pathSegments = afterUpload.slice(i);
    if (pathSegments.length === 0) return null;

    const fileName = pathSegments[pathSegments.length - 1];
    const withoutExt = fileName.replace(/\.[a-zA-Z0-9]+$/, '');

    const folderSegments = pathSegments.slice(0, -1);
    const publicId = folderSegments.length
      ? `${folderSegments.join('/')}/${withoutExt}`
      : withoutExt;

    return publicId || null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   DEV: Debug‑Ping (zeigt, ob ENV sauber geladen sind)
   ───────────────────────────────────────────────────────────── */
router.get('/_debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const cfg = cloudinary.config();
  return res.json({
    configured: cloudinaryEnvConfigured(),
    cloud_name_present: Boolean(cfg?.cloud_name),
    api_key_present: Boolean(cfg?.api_key),
    api_secret_present: Boolean(cfg?.api_secret),
    folder: process.env.CLOUDINARY_FOLDER || 'ultreia',
  });
});

/* ─────────────────────────────────────────────────────────────
   Fehlerhelfer: einheitliche Antwort für Cloudinary-Errors
   ───────────────────────────────────────────────────────────── */
function sendCloudinaryError(res, err) {
  const status =
    (Number.isInteger(err?.http_code) && err.http_code) ||
    (err?.name === 'Error' ? 400 : 500);

  // In DEV mehr Details zurückgeben
  const isDev = process.env.NODE_ENV !== 'production';
  const payload = {
    ok: false,
    error: err?.message || 'Upload fehlgeschlagen',
  };
  if (isDev) {
    payload.details = err?.error || err;
  }
  return res.status(status).json(payload);
}

/* ─────────────────────────────────────────────────────────────
   SINGLE UPLOAD
   POST /api/uploads
   Body: multipart/form-data  (field: "image")
   ───────────────────────────────────────────────────────────── */
router.post('/', (req, res) => {
  if (!cloudinaryEnvConfigured()) {
    return res.status(500).json({
      ok: false,
      error:
        'Cloudinary ist nicht konfiguriert. Prüfe CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.',
    });
  }

  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(413)
            .json({
              ok: false,
              error: `Bild zu groß. Maximal ${Math.round(
                MAX_FILE_SIZE / (1024 * 1024)
              )}MB.`,
            });
        }
        return res.status(400).json({ ok: false, error: `Upload-Fehler: ${err.code}` });
      }
      return res.status(400).json({ ok: false, error: err.message || 'Ungültige Datei' });
    }

    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ ok: false, error: 'Kein Bild erhalten (Feldname "image").' });
      }
      const folder = req.query.folder || process.env.CLOUDINARY_FOLDER || 'ultreia';
      const result = await uploadBufferToCloudinary(req.file.buffer, { folder });

      return res.json({
        ok: true,
        image: {
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
        },
      });
    } catch (error) {
      console.error('[Cloudinary Upload Error]', error);
      return sendCloudinaryError(res, error);
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   MULTI UPLOAD
   POST /api/uploads/images
   Body: multipart/form-data  (field: "images")
   ───────────────────────────────────────────────────────────── */
router.post('/images', (req, res) => {
  if (!cloudinaryEnvConfigured()) {
    return res.status(500).json({
      ok: false,
      error:
        'Cloudinary ist nicht konfiguriert. Prüfe CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.',
    });
  }

  upload.array('images')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(413)
            .json({
              ok: false,
              error: `Bild zu groß. Maximal ${Math.round(
                MAX_FILE_SIZE / (1024 * 1024)
              )}MB pro Datei.`,
            });
        }
        return res.status(400).json({ ok: false, error: `Upload-Fehler: ${err.code}` });
      }
      return res.status(400).json({ ok: false, error: err.message || 'Ungültige Dateien' });
    }

    try {
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ ok: false, error: 'Keine Bilder erhalten (Feldname "images").' });
      }

      const folder = req.query.folder || process.env.CLOUDINARY_FOLDER || 'ultreia';
      const uploaded = [];

      for (const f of files) {
        const r = await uploadBufferToCloudinary(f.buffer, { folder });
        uploaded.push({
          url: r.secure_url,
          public_id: r.public_id,
          width: r.width,
          height: r.height,
          bytes: r.bytes,
          format: r.format,
        });
      }

      return res.json({ ok: true, images: uploaded });
    } catch (error) {
      console.error('[Cloudinary Multi Upload Error]', error);
      return sendCloudinaryError(res, error);
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   DELETE
   DELETE /api/uploads
   POST   /api/uploads/delete  (Alias)
   Body: { url?: string, public_id?: string }
   ───────────────────────────────────────────────────────────── */
async function handleDelete(req, res) {
  try {
    if (!cloudinaryEnvConfigured()) {
      return res.status(500).json({
        ok: false,
        error:
          'Cloudinary ist nicht konfiguriert. Prüfe CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.',
      });
    }

    const { url, public_id } = req.body || {};

    let pid = public_id;
    if (!pid && url) pid = extractPublicIdFromUrl(url);

    if (!pid) {
      return res
        .status(400)
        .json({ ok: false, error: 'Bitte public_id oder gültige Bild-URL angeben.' });
    }

    const result = await cloudinary.uploader.destroy(pid, { resource_type: 'image' });

    if (result?.result === 'ok' || result?.result === 'not found') {
      return res.json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Bild konnte nicht gelöscht werden.' });
  } catch (error) {
    console.error('[Cloudinary Delete Error]', error);
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      ok: false,
      error: 'Serverfehler beim Löschen',
      details: isDev ? String(error?.message || error) : undefined,
    });
  }
}

router.delete('/', express.json(), handleDelete);
router.post('/delete', express.json(), handleDelete);

export default router;
