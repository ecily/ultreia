import polyline from '@mapbox/polyline';

/**
 * Robust Google Directions fetcher (Android-tauglich)
 * - Timeout via AbortController
 * - Saubere Fehlertexte inkl. Google-Status
 * - Optional: avoid=stairs (falls Kunden das benötigen)
 * - Rückgabe: Array<{ latitude, longitude }>
 */

const ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';

// Utility: baue URL mit sicheren Parametern
function buildUrl(origin, destination, apiKey, mode = 'walking', opts = {}) {
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode,
    key: apiKey,
    language: 'de',
    region: 'at',
    units: 'metric',
  });

  if (opts.avoidStairs) {
    // Google Directions kennt kein "stairs" offiziell; häufig wird "tolls|ferries" etc. genutzt.
    // Für Barrierefreiheit (Treppen meiden) gibt es kein standardisiertes Flag in der Directions API.
    // Wir lassen die Option bewusst kommentiert. Falls ihr eine interne Logik habt, könnt ihr hier anpassen.
    // params.set('avoid', 'stairs');
  }

  if (opts.alternatives === true) params.set('alternatives', 'true');

  return `${ENDPOINT}?${params.toString()}`;
}

// Utility: Timeout mit AbortController
async function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal, headers: { 'Accept': 'application/json' } });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Utility: decode polyline -> [{latitude, longitude}, ...]
function decodePolyline(points) {
  const decoded = polyline.decode(points); // [[lat, lng], ...]
  return decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

/**
 * fetchRoute
 * @param {{latitude:number, longitude:number}} origin
 * @param {{latitude:number, longitude:number}} destination
 * @param {string} apiKey
 * @param {'walking'|'driving'|'bicycling'|'transit'} mode
 * @param {{ avoidStairs?: boolean, timeoutMs?: number, retryUnknown?: boolean }} options
 * @returns {Promise<Array<{latitude:number, longitude:number}>>}
 */
export async function fetchRoute(origin, destination, apiKey, mode = 'walking', options = {}) {
  if (!apiKey) throw new Error('Google Directions: API-Key fehlt');
  if (!origin || !destination) throw new Error('Google Directions: origin/destination fehlen');

  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 10000;
  const url = buildUrl(origin, destination, apiKey, mode, options);

  let res, json;
  try {
    res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
  } catch (e) {
    // Abort oder Netzwerkfehler
    throw new Error(`Google Directions: Netzwerk-/Timeout-Fehler (${e?.name || 'fetch error'})`);
  }

  if (!res.ok) {
    throw new Error(`Google Directions: HTTP ${res.status}`);
  }

  try {
    json = await res.json();
  } catch {
    throw new Error('Google Directions: Ungültige JSON-Antwort');
  }

  const status = json?.status;
  const errMsg = json?.error_message;

  // Bekannte Statusfälle der Directions API
  switch (status) {
    case 'OK': {
      const points = json.routes?.[0]?.overview_polyline?.points;
      if (!points) throw new Error('Google Directions: Keine Polyline gefunden');
      return decodePolyline(points);
    }
    case 'ZERO_RESULTS':
      throw new Error('Google Directions: ZERO_RESULTS (keine Route gefunden)');
    case 'OVER_QUERY_LIMIT':
      throw new Error('Google Directions: OVER_QUERY_LIMIT (Kontingent überschritten)');
    case 'REQUEST_DENIED':
      throw new Error(`Google Directions: REQUEST_DENIED${errMsg ? ` – ${errMsg}` : ''}`);
    case 'INVALID_REQUEST':
      throw new Error('Google Directions: INVALID_REQUEST (ungültige Parameter)');
    case 'NOT_FOUND':
      throw new Error('Google Directions: NOT_FOUND (Ort nicht gefunden)');
    case 'UNKNOWN_ERROR': {
      // Optionaler einmaliger Retry bei transienten Google-Fehlern
      if (options.retryUnknown !== false) {
        await new Promise((r) => setTimeout(r, 350));
        return fetchRoute(origin, destination, apiKey, mode, { ...options, retryUnknown: false });
      }
      throw new Error('Google Directions: UNKNOWN_ERROR');
    }
    default:
      throw new Error(`Google Directions: ${status || 'Unbekannter Status'}` + (errMsg ? ` – ${errMsg}` : ''));
  }
}

export default fetchRoute;
