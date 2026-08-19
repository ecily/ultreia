import { createHash, randomBytes } from 'node:crypto';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const DEFAULT_TIMEOUT_MS = 10000;
const TOKEN_ATTEMPTS = 2;

const COPY = {
  de: { subject: 'Dein Ultreia-Anmeldelink', heading: 'Bei Ultreia anmelden', intro: 'Nutze den folgenden Link, um dich sicher bei Ultreia anzumelden.', button: 'Bei Ultreia anmelden', expiry: 'Der Link ist kurz gültig und kann nur einmal verwendet werden.', ignore: 'Wenn du diese Anmeldung nicht angefordert hast, kannst du diese E-Mail ignorieren.' },
  en: { subject: 'Your Ultreia sign-in link', heading: 'Sign in to Ultreia', intro: 'Use the link below to securely sign in to Ultreia.', button: 'Sign in to Ultreia', expiry: 'The link is valid for a short time and can only be used once.', ignore: 'If you did not request this sign-in, you can ignore this email.' },
  es: { subject: 'Tu enlace de acceso a Ultreia', heading: 'Acceder a Ultreia', intro: 'Usa el siguiente enlace para acceder de forma segura a Ultreia.', button: 'Acceder a Ultreia', expiry: 'El enlace es válido durante poco tiempo y solo puede utilizarse una vez.', ignore: 'Si no solicitaste este acceso, puedes ignorar este correo.' },
};

function digest(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function safeHeader(value) { return String(value || '').replace(/[\r\n]+/g, ' ').trim(); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function normalizeLocale(value) { return Object.hasOwn(COPY, value) ? value : 'de'; }
function timeoutMs(config) { const value = Number(config.microsoftGraphTimeoutMs || DEFAULT_TIMEOUT_MS); return Number.isInteger(value) && value >= 1000 && value <= 30000 ? value : DEFAULT_TIMEOUT_MS; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }

export function getMicrosoftMailConfigStatus(config) {
  const provider = String(config.mailProvider || 'none').trim().toLowerCase();
  if (provider !== 'microsoft') return { provider, configured: false, missing: ['MAIL_PROVIDER=microsoft'] };
  const missing = [];
  if (!String(config.microsoftTenantId || '').trim()) missing.push('MICROSOFT_TENANT_ID');
  if (!String(config.microsoftClientId || '').trim()) missing.push('MICROSOFT_CLIENT_ID');
  if (!String(config.microsoftClientSecret || '').trim()) missing.push('MICROSOFT_CLIENT_SECRET');
  if (!validEmail(config.mailFrom)) missing.push('MAIL_FROM');
  return { provider, configured: missing.length === 0, missing };
}

function classifyTokenError(status, body) {
  const code = String(body?.error || body?.error?.code || '').toLowerCase();
  if (code.includes('tenant')) return 'microsoft_token_invalid_tenant';
  if (code === 'invalid_client') return 'microsoft_token_invalid_client';
  if (code === 'unauthorized_client') return 'microsoft_token_unauthorized_client';
  if (code === 'invalid_scope') return 'microsoft_token_invalid_scope';
  if (status >= 500) return 'microsoft_token_upstream_error';
  return 'microsoft_token_request_error';
}

function classifyGraphError(status) {
  if (status === 401) return 'microsoft_graph_unauthorized';
  if (status === 403) return 'microsoft_graph_forbidden';
  if (status === 429) return 'microsoft_graph_throttled';
  if (status >= 500) return 'microsoft_graph_upstream_error';
  return 'microsoft_graph_request_error';
}

function networkErrorClass(error, prefix) { return error?.name === 'TimeoutError' || error?.name === 'AbortError' ? `${prefix}_timeout` : `${prefix}_network_error`; }
async function readJson(response) { const text = await response.text(); if (!text) return {}; try { return JSON.parse(text); } catch { return {}; } }
async function fetchWithTimeout(fetchImpl, url, options, config) { return fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs(config)) }); }

export async function requestMicrosoftGraphToken(config, { fetchImpl = globalThis.fetch } = {}) {
  const status = getMicrosoftMailConfigStatus(config);
  if (!status.configured) return { status: 'not_configured', errorClass: 'mail_provider_not_configured', missing: status.missing };
  const tenant = encodeURIComponent(String(config.microsoftTenantId).trim());
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({ client_id: String(config.microsoftClientId).trim(), client_secret: String(config.microsoftClientSecret).trim(), scope: GRAPH_SCOPE, grant_type: 'client_credentials' });
  for (let attempt = 1; attempt <= TOKEN_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }, config);
      const responseBody = await readJson(response);
      if (response.ok && typeof responseBody.access_token === 'string' && responseBody.access_token.length > 0) return { status: 'token_acquired', accessToken: responseBody.access_token };
      const errorClass = classifyTokenError(response.status, responseBody);
      if (attempt < TOKEN_ATTEMPTS && response.status >= 500) continue;
      return { status: 'failed', errorClass, upstreamStatus: response.status };
    } catch (error) {
      const errorClass = networkErrorClass(error, 'microsoft_token');
      if (attempt < TOKEN_ATTEMPTS) continue;
      return { status: 'failed', errorClass, upstreamStatus: null };
    }
  }
  return { status: 'failed', errorClass: 'microsoft_token_request_error', upstreamStatus: null };
}

export function buildMagicLinkMail({ verificationUrl, locale = 'de', expiresAt }) {
  const copy = COPY[normalizeLocale(locale)];
  const safeUrl = escapeHtml(verificationUrl);
  const minutes = expiresAt ? Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000)) : 15;
  const plain = [copy.heading, '', copy.intro, '', `${copy.button}: ${verificationUrl}`, '', `${copy.expiry} (${minutes} min.)`, copy.ignore, '', 'Ultreia'].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#05284a"><h2>${escapeHtml(copy.heading)}</h2><p>${escapeHtml(copy.intro)}</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#05284a;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(copy.button)}</a></p><p>${escapeHtml(copy.expiry)} (${minutes} min.)</p><p>${escapeHtml(copy.ignore)}</p></div>`;
  return { subject: copy.subject, plain, html };
}

function buildMimeMessage({ sender, recipient, mail }) {
  const boundary = `ultreia-${randomBytes(12).toString('hex')}`;
  return [`From: ${safeHeader(sender)}`, `To: ${safeHeader(recipient)}`, `Subject: ${safeHeader(mail.subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', mail.plain, '', `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', mail.html, '', `--${boundary}--`].join('\r\n');
}

export async function sendMicrosoftGraphMail({ config, accessToken, recipient, mail, fetchImpl = globalThis.fetch }) {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(String(config.mailFrom).trim())}/sendMail`;
  try {
    const response = await fetchWithTimeout(fetchImpl, graphUrl, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'text/plain' }, body: Buffer.from(buildMimeMessage({ sender: config.mailFrom, recipient, mail }), 'utf8').toString('base64') }, config);
    await response.text();
    if (response.status === 202) return { status: 'sent', delivered: true };
    return { status: 'failed', delivered: false, errorClass: classifyGraphError(response.status), upstreamStatus: response.status };
  } catch (error) {
    return { status: 'failed', delivered: false, errorClass: networkErrorClass(error, 'microsoft_graph'), upstreamStatus: null };
  }
}

export function createMailService(config, { fetchImpl = globalThis.fetch } = {}) {
  const devOutbox = new Map();
  async function sendMagicLink({ emailNormalized, verificationUrl, preferredLocale, expiresAt }) {
    if (config.runtimeMode !== 'production') {
      const diagnosticId = randomBytes(16).toString('hex');
      devOutbox.set(diagnosticId, { emailHash: digest(emailNormalized), verificationUrl, createdAt: Date.now() });
      return { delivered: false, channel: 'dev', diagnosticId };
    }
    const configStatus = getMicrosoftMailConfigStatus(config);
    if (!configStatus.configured) return { delivered: false, channel: 'microsoft', errorClass: 'mail_provider_not_configured' };
    const token = await requestMicrosoftGraphToken(config, { fetchImpl });
    if (token.status !== 'token_acquired') return { delivered: false, channel: 'microsoft', errorClass: token.errorClass, upstreamStatus: token.upstreamStatus };
    const mail = buildMagicLinkMail({ verificationUrl, locale: preferredLocale, expiresAt });
    const delivery = await sendMicrosoftGraphMail({ config, accessToken: token.accessToken, recipient: emailNormalized, mail, fetchImpl });
    return { delivered: delivery.delivered, channel: 'microsoft', errorClass: delivery.errorClass, upstreamStatus: delivery.upstreamStatus };
  }
  function readDevLink(diagnosticId) { const item = devOutbox.get(diagnosticId); if (!item || Date.now() - item.createdAt > config.magicLinkTtlSeconds * 1000) return null; return item.verificationUrl; }
  return { sendMagicLink, readDevLink, isConfigured: () => getMicrosoftMailConfigStatus(config).configured, getConfigStatus: () => getMicrosoftMailConfigStatus(config) };
}
