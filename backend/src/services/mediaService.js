import { createHash, randomUUID } from 'node:crypto';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function cloudinarySignature(params, apiSecret) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
}

function hasJpegHeader(buffer) { return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; }
function hasPngHeader(buffer) { return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); }
function hasWebpHeader(buffer) { return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'; }

function validateImage(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) throw new Error('image_too_large_or_empty');
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error('image_type_not_allowed');
  const validHeader = mimeType === 'image/jpeg' ? hasJpegHeader(buffer) : mimeType === 'image/png' ? hasPngHeader(buffer) : hasWebpHeader(buffer);
  if (!validHeader) throw new Error('image_content_invalid');
}

function scopeFolder(config, scope, userId, offerId) {
  const root = String(config.cloudinaryFolder || 'ultreia').replace(/^\/+|\/+$/g, '');
  return `${root}/${scope}/offers/${userId}/${offerId}`;
}

function deliveryUrl(cloudName, publicId, format) {
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/c_limit,w_1600,h_1600,q_auto,f_auto/${publicId}.${format}`;
}

export function createMediaService(config, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const now = dependencies.now || (() => new Date());
  const configured = Boolean(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);

  async function uploadImage({ buffer, mimeType, scope, userId, offerId, sortOrder }) {
    validateImage(buffer, mimeType);
    if (!configured) throw new Error('media_provider_not_configured');
    const timestamp = Math.floor(now().getTime() / 1000);
    const folder = scopeFolder(config, scope, userId, offerId);
    const publicId = `photo-${randomUUID()}`;
    const params = { folder, public_id: publicId, timestamp };
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `offer-${sortOrder}.${EXTENSIONS[mimeType]}`);
    form.append('api_key', config.cloudinaryApiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('signature', cloudinarySignature(params, config.cloudinaryApiSecret));
    const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudinaryCloudName)}/image/upload`, { method: 'POST', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.public_id || !payload.width || !payload.height) throw new Error('media_upload_failed');
    return {
      publicId: payload.public_id,
      secureUrl: deliveryUrl(config.cloudinaryCloudName, payload.public_id, payload.format || EXTENSIONS[mimeType]),
      width: payload.width,
      height: payload.height,
      format: payload.format || EXTENSIONS[mimeType],
      bytes: payload.bytes || buffer.length,
      sortOrder,
      createdAt: now(),
    };
  }

  async function destroyImage({ publicId, scope, userId, offerId }) {
    if (!configured) throw new Error('media_provider_not_configured');
    const folder = scopeFolder(config, scope, userId, offerId);
    if (!publicId || !String(publicId).startsWith(`${folder}/`)) throw new Error('media_ownership_invalid');
    const timestamp = Math.floor(now().getTime() / 1000);
    const params = { invalidate: 'true', public_id: publicId, timestamp };
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('timestamp', String(timestamp));
    form.append('invalidate', 'true');
    form.append('api_key', config.cloudinaryApiKey);
    form.append('signature', cloudinarySignature(params, config.cloudinaryApiSecret));
    const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudinaryCloudName)}/image/destroy`, { method: 'POST', body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !['ok', 'not found'].includes(payload.result)) throw new Error('media_delete_failed');
    return { ok: true };
  }

  return { configured, uploadImage, destroyImage, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES };
}

export { cloudinarySignature, validateImage, scopeFolder };
