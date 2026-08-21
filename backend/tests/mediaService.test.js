import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMediaService, cloudinarySignature } from '../src/services/mediaService.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('provider media service', () => {
  it('creates deterministic Cloudinary signatures without exposing secrets', () => {
    assert.equal(cloudinarySignature({ timestamp: 1700000000, folder: 'ultreia/local_test/offers/a/b', public_id: 'photo-1' }, 'secret'), '91e510515193e577eb70a8f88f9afe6df04faa8f');
  });

  it('fails closed without Cloudinary configuration and rejects invalid content', async () => {
    const service = createMediaService({});
    await assert.rejects(() => service.uploadImage({ buffer: png, mimeType: 'image/png', scope: 'local_test', userId: 'u', offerId: 'o', sortOrder: 0 }), /media_provider_not_configured/);
    const configured = createMediaService({ cloudinaryCloudName: 'test', cloudinaryApiKey: 'key', cloudinaryApiSecret: 'secret' });
    await assert.rejects(() => configured.uploadImage({ buffer: Buffer.from('not-an-image'), mimeType: 'image/png', scope: 'local_test', userId: 'u', offerId: 'o', sortOrder: 0 }), /image_content_invalid/);
  });

  it('uploads only transformed delivery metadata and deletes within the scoped folder', async () => {
    const calls = [];
    const service = createMediaService({ cloudinaryCloudName: 'test-cloud', cloudinaryApiKey: 'key', cloudinaryApiSecret: 'secret', cloudinaryFolder: 'ultreia' }, {
      now: () => new Date('2026-08-21T00:00:00.000Z'),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(url.endsWith('/image/upload') ? { public_id: 'ultreia/local_test/offers/u/o/photo-1', width: 1200, height: 800, format: 'png', bytes: 9 } : { result: 'ok' }), { status: 200 });
      },
    });
    const image = await service.uploadImage({ buffer: png, mimeType: 'image/png', scope: 'local_test', userId: 'u', offerId: 'o', sortOrder: 0 });
    assert.equal(image.width, 1200);
    assert.match(image.secureUrl, /c_limit,w_1600,h_1600,q_auto,f_auto/);
    assert.equal((await service.destroyImage({ publicId: image.publicId, scope: 'local_test', userId: 'u', offerId: 'o' })).ok, true);
    await assert.rejects(() => service.destroyImage({ publicId: 'other/photo', scope: 'local_test', userId: 'u', offerId: 'o' }), /media_ownership_invalid/);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.method, 'POST');
  });
});
