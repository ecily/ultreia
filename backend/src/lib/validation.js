const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const PUSH_TOKEN_PATTERN = /^(Exponent|Expo)PushToken\[[^\]]{8,256}\]$/;

export function readString(value, { name, min = 0, max = 256, required = false } = {}) {
  if (typeof value !== 'string') {
    if (required) throw new Error(`${name} is required`);
    return null;
  }

  const result = value.trim();
  if (!result && required) throw new Error(`${name} is required`);
  if (result.length < min) throw new Error(`${name} is too short`);
  if (result.length > max) throw new Error(`${name} is too long`);
  return result || null;
}

export function readDeviceId(value) {
  const deviceId = readString(value, { name: 'deviceId', max: 128, required: true });
  if (!DEVICE_ID_PATTERN.test(deviceId)) throw new Error('deviceId has an invalid format');
  return deviceId;
}

export function readPushToken(value) {
  const token = readString(value, { name: 'token', max: 280, required: true });
  if (!PUSH_TOKEN_PATTERN.test(token)) throw new Error('token has an invalid Expo format');
  return token;
}

export function readCoordinate(value, name) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a number`);
  const limit = name === 'lat' ? 90 : 180;
  if (number < -limit || number > limit) throw new Error(`${name} is out of range`);
  return number;
}

export function readOptionalNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${name} is invalid`);
  return number;
}

export function readLimit(value, fallback = 20, max = 100) {
  const limit = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > max) throw new Error('limit is invalid');
  return limit;
}

export function asPoint(lat, lng) {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function badRequest(res, error) {
  return res.status(400).json({ ok: false, status: 'invalid_request', error: error.message });
}

export function databaseRequired(res, databaseService) {
  if (databaseService.getStatus().connected) return databaseService.getDb();
  res.status(503).json({ ok: false, status: 'database_not_ready' });
  return null;
}
