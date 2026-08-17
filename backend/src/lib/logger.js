const SENSITIVE_KEY = /(token|authorization|password|secret|credential|connection|string|uri|key)/i;

function redactText(value) {
  return String(value)
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'mongodb://[redacted]')
    .replace(/(?:Exponent|Expo)PushToken\[[^\]]+\]/g, 'ExpoPushToken[redacted]');
}

function safeValue(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (typeof value === 'string') return redactText(value).slice(0, 500);
  return value;
}

export function logEvent(level, event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'ultreia-backend',
    event,
    ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, safeValue(value, key)])),
  };
  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}
