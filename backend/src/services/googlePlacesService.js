const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DEFAULT_TIMEOUT_MS = 8000;

function timeoutMs(config) {
  const value = Number(config.googlePlacesTimeoutMs || DEFAULT_TIMEOUT_MS);
  return Number.isInteger(value) && value >= 1000 && value <= 30000 ? value : DEFAULT_TIMEOUT_MS;
}

function apiKey(config) { return String(config.googlePlacesApiKey || '').trim(); }

function configured(config) { return apiKey(config).length > 0; }

function detailsUrl(placeId) { return `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`; }

async function fetchJson(fetchImpl, url, options, config) {
  const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs(config)) });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  return { response, body };
}

function googleError(status) {
  if (status === 400) return 'google_places_invalid_request';
  if (status === 403) return 'google_places_forbidden';
  if (status === 429) return 'google_places_rate_limited';
  if (status >= 500) return 'google_places_upstream_error';
  return 'google_places_request_error';
}

function validLocation(location) {
  const candidate = location?.finalLocation || location;
  const latitude = Number(candidate?.latitude);
  const longitude = Number(candidate?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

function autocompleteBody({ input, scope = 'production', sessionToken, locale = 'de', location }) {
  const localTest = scope === 'local_test';
  const body = {
    input,
    includedRegionCodes: localTest ? ['at'] : ['es', 'fr'],
    includePureServiceAreaBusinesses: false,
    languageCode: locale,
  };
  if (localTest) body.regionCode = 'at';
  if (sessionToken) body.sessionToken = sessionToken;
  const point = validLocation(location);
  if (point) {
    body.locationBias = {
      circle: {
        center: point,
        radius: localTest ? 50000 : 100000,
      },
    };
  }
  return body;
}

export function createGooglePlacesService(config, { fetchImpl = globalThis.fetch } = {}) {
  async function autocomplete({ input, scope = 'production', sessionToken, locale = 'de', location }) {
    if (!configured(config)) return { ok: false, errorClass: 'google_places_not_configured' };
    const body = autocompleteBody({ input, scope, sessionToken, locale, location });
    try {
      const { response, body: responseBody } = await fetchJson(fetchImpl, AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey(config),
          'x-goog-fieldmask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify(body),
      }, config);
      if (!response.ok) return { ok: false, errorClass: googleError(response.status), upstreamStatus: response.status };
      const suggestions = (responseBody.suggestions || [])
        .map((item) => item.placePrediction)
        .filter((item) => item?.placeId)
        .slice(0, 5)
        .map((item) => ({ placeId: item.placeId, text: item.text?.text || '', mainText: item.structuredFormat?.mainText?.text || '', secondaryText: item.structuredFormat?.secondaryText?.text || '' }));
      return { ok: true, suggestions };
    } catch (error) {
      return { ok: false, errorClass: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'google_places_timeout' : 'google_places_network_error' };
    }
  }

  async function details({ placeId, sessionToken, locale = 'de' }) {
    if (!configured(config)) return { ok: false, errorClass: 'google_places_not_configured' };
    try {
      const params = new URLSearchParams({ languageCode: locale });
      if (sessionToken) params.set('sessionToken', sessionToken);
      const { response, body } = await fetchJson(fetchImpl, `${detailsUrl(placeId)}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey(config),
          'x-goog-fieldmask': 'id,displayName,formattedAddress,addressComponents,location,types,googleMapsUri',
        },
      }, config);
      if (!response.ok) return { ok: false, errorClass: googleError(response.status), upstreamStatus: response.status };
      return { ok: true, place: body };
    } catch (error) {
      return { ok: false, errorClass: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'google_places_timeout' : 'google_places_network_error' };
    }
  }

  return { configured: () => configured(config), autocomplete, details };
}

export { AUTOCOMPLETE_URL };
