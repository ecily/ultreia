import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMagicLinkMail,
  createMailService,
  getMicrosoftMailConfigStatus,
} from '../src/services/mailService.js';

const baseConfig = {
  runtimeMode: 'production',
  mailProvider: 'microsoft',
  mailFrom: 'noreply@ultreia.app',
  microsoftTenantId: 'tenant.example',
  microsoftClientId: 'client.example',
  microsoftClientSecret: 'secret-value-for-test',
  microsoftGraphTimeoutMs: 1000,
  magicLinkTtlSeconds: 900,
};

function response(status, body = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Microsoft Graph magic-link mail service', () => {
  it('validates the provider configuration without exposing values', () => {
    const status = getMicrosoftMailConfigStatus({ mailProvider: 'microsoft', mailFrom: '', microsoftTenantId: '', microsoftClientId: '', microsoftClientSecret: '' });
    assert.deepEqual(status, {
      provider: 'microsoft',
      configured: false,
      missing: ['MICROSOFT_TENANT_ID', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MAIL_FROM'],
    });
    assert.equal(JSON.stringify(status).includes('secret-value-for-test'), false);
  });

  it('keeps local and automated tests on the diagnostic outbox', async () => {
    let calls = 0;
    const service = createMailService({ ...baseConfig, runtimeMode: 'local', mailProvider: 'none' }, { fetchImpl: async () => { calls += 1; return response(500); } });
    const delivery = await service.sendMagicLink({ emailNormalized: 'person@example.test', verificationUrl: 'ultreia://auth/verify?token=opaque', preferredLocale: 'de' });
    assert.equal(delivery.channel, 'dev');
    assert.equal(delivery.delivered, false);
    assert.match(delivery.diagnosticId, /^[a-f0-9]{32}$/);
    assert.equal(await service.readDevLink(delivery.diagnosticId), 'ultreia://auth/verify?token=opaque');
    assert.equal(calls, 0);
  });

  it('builds separate German, English and Spanish functional mail content', () => {
    const url = 'https://ultreia.app/auth/verify?token=opaque%2Bvalue';
    const german = buildMagicLinkMail({ verificationUrl: url, locale: 'de' });
    const english = buildMagicLinkMail({ verificationUrl: url, locale: 'en' });
    const spanish = buildMagicLinkMail({ verificationUrl: url, locale: 'es' });
    assert.equal(german.subject, 'Dein Ultreia-Anmeldelink');
    assert.match(german.plain, /Bei Ultreia anmelden/);
    assert.match(english.html, /Sign in to Ultreia/);
    assert.match(spanish.plain, /Acceder a Ultreia/);
    assert.match(german.html, /token=opaque%2Bvalue/);
    assert.equal(german.html.includes('<script'), false);
  });

  it('acquires an app-only token and sends Graph MIME mail with no retry on send', async () => {
    const calls = [];
    const service = createMailService(baseConfig, { fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? response(200, { access_token: 'access-token-test' }) : new Response('', { status: 202 });
    } });
    const delivery = await service.sendMagicLink({ emailNormalized: 'recipient@example.test', verificationUrl: 'https://ultreia.app/auth/verify?token=opaque', preferredLocale: 'en' });
    assert.deepEqual(delivery, { delivered: true, channel: 'microsoft', errorClass: undefined, upstreamStatus: undefined });
    assert.equal(calls.length, 2);
    const tokenBody = String(calls[0].options.body);
    assert.match(tokenBody, /grant_type=client_credentials/);
    assert.match(tokenBody, /scope=https%3A%2F%2Fgraph.microsoft.com%2F.default/);
    assert.match(calls[1].url, /graph\.microsoft\.com\/v1\.0\/users\/noreply%40ultreia\.app\/sendMail$/);
    assert.equal(calls[1].options.headers.authorization, 'Bearer access-token-test');
    const mime = Buffer.from(calls[1].options.body, 'base64').toString('utf8');
    assert.match(mime, /To: recipient@example\.test/);
    assert.match(mime, /Sign in to Ultreia/);
    assert.equal(JSON.stringify(delivery).includes(baseConfig.microsoftClientSecret), false);
    assert.equal(JSON.stringify(delivery).includes('access-token-test'), false);
  });

  it('classifies Microsoft auth failure and does not call Graph', async () => {
    let calls = 0;
    const service = createMailService(baseConfig, { fetchImpl: async () => { calls += 1; return response(401, { error: 'invalid_client' }); } });
    const delivery = await service.sendMagicLink({ emailNormalized: 'recipient@example.test', verificationUrl: 'https://ultreia.app/auth/verify?token=opaque', preferredLocale: 'de' });
    assert.equal(delivery.delivered, false);
    assert.equal(delivery.errorClass, 'microsoft_token_invalid_client');
    assert.equal(calls, 1);
  });

  it('classifies Graph failure and timeout without retrying the non-idempotent send', async () => {
    let calls = 0;
    const service = createMailService(baseConfig, { fetchImpl: async (_url, options) => {
      calls += 1;
      if (calls === 1) return response(200, { access_token: 'access-token-test' });
      await new Promise((resolve) => setTimeout(resolve, 1));
      throw Object.assign(new Error('request timeout'), { name: 'TimeoutError' });
    } });
    const delivery = await service.sendMagicLink({ emailNormalized: 'recipient@example.test', verificationUrl: 'https://ultreia.app/auth/verify?token=opaque', preferredLocale: 'es' });
    assert.equal(delivery.delivered, false);
    assert.equal(delivery.errorClass, 'microsoft_graph_timeout');
    assert.equal(calls, 2);
  });

  it('fails closed in production without Microsoft configuration', async () => {
    let calls = 0;
    const service = createMailService({ ...baseConfig, mailProvider: 'none' }, { fetchImpl: async () => { calls += 1; return response(200); } });
    assert.equal(service.isConfigured(), false);
    const delivery = await service.sendMagicLink({ emailNormalized: 'recipient@example.test', verificationUrl: 'https://ultreia.app/auth/verify?token=opaque', preferredLocale: 'de' });
    assert.deepEqual(delivery, { delivered: false, channel: 'microsoft', errorClass: 'mail_provider_not_configured' });
    assert.equal(calls, 0);
  });
});
