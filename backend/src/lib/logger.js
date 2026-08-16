function safeValue(value) {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'string') return value.slice(0, 500);
  return value;
}

export function logEvent(level, event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'ultreia-backend',
    event,
    ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, safeValue(value)])),
  };
  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}
