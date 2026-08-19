# Ultreia Google Places Operator Notes

## Implemented integration

Ultreia uses the current Google Places API (New) through a backend-only proxy:

- `POST /api/provider/location/autocomplete`
- `POST /api/provider/location/validate`
- `PUT /api/provider/location`

The backend calls `https://places.googleapis.com/v1/places:autocomplete` and
Place Details (New) with explicit field masks. The Google key is never sent to
the browser, stored in Git, or returned by the API. Autocomplete uses a client
session token to group typing and selection requests, but Ultreia never stores
that token.

## Required Google Cloud setup

Use an Ultreia-owned Google Cloud project. Do not reuse credentials from
StepsMatch, Kaufklug, or another project.

Enable:

1. Places API (New)
2. billing for the Google Cloud project

Create one server-side API key for the DigitalOcean backend. Restrict it to:

- API restriction: Places API (New) only
- application restriction: the DigitalOcean App Platform egress IP/CIDR if
  the deployed egress is stable and known; otherwise use API restriction plus
  quota monitoring until a stable egress policy is documented

The browser does not need a Google key because the implementation proxies the
minimal Places calls through the authenticated Ultreia backend.

## DigitalOcean runtime value

Set the secret runtime variable on the Ultreia backend app:

```text
GOOGLE_PLACES_API_KEY=<server-side restricted key>
```

The non-secret timeout is prepared as `GOOGLE_PLACES_TIMEOUT_MS=8000`.

Provider geography policy:

- `local_test`: `includedRegionCodes: ["at"]`, `regionCode: "at"`
- `production`: `includedRegionCodes: ["es", "fr"]`
- a known confirmed provider location may add a server-side `locationBias`
- `includePureServiceAreaBusinesses: false` is sent so suggestions prefer physical locations
- client-supplied country filters are ignored; the authenticated session scope is authoritative

After saving the secret, deploy and verify `POST /api/provider/location/autocomplete`
with an authenticated provider session. If the key is absent, the API returns
`google_places_not_configured` and provider onboarding remains safely pending.

## Location rules enforced by Ultreia

The server fetches Place Details again for the selected `googlePlaceId`, stores
the structured address and the original Google coordinate, and accepts a final
marker only when it is at most 25 metres away. The final GeoJSON Point uses
`[longitude, latitude]`. Provider activation requires a valid saved location.
