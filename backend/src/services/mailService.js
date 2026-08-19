import { createHash, randomBytes } from 'node:crypto';

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createMailService(config) {
  const devOutbox = new Map();

  async function sendMagicLink({ emailNormalized, verificationUrl }) {
    if (config.mailProvider === 'resend' && config.mailApiKey && config.mailFrom) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${config.mailApiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: config.mailFrom, to: [emailNormalized], subject: 'Dein Ultreia-Zugang', html: `<p><a href="${verificationUrl}">Ultreia öffnen</a></p>` }),
        signal: AbortSignal.timeout(10000),
      });
      return { delivered: response.ok, channel: 'resend' };
    }

    if (config.runtimeMode !== 'production') {
      const diagnosticId = randomBytes(16).toString('hex');
      devOutbox.set(diagnosticId, { emailHash: digest(emailNormalized), verificationUrl, createdAt: Date.now() });
      return { delivered: false, channel: 'dev', diagnosticId };
    }

    return { delivered: false, channel: 'none' };
  }

  function readDevLink(diagnosticId) {
    const item = devOutbox.get(diagnosticId);
    if (!item || Date.now() - item.createdAt > config.magicLinkTtlSeconds * 1000) return null;
    return item.verificationUrl;
  }

  function isConfigured() {
    return config.mailProvider === 'resend' && Boolean(config.mailApiKey && config.mailFrom);
  }

  return { sendMagicLink, readDevLink, isConfigured };
}
