# ADR-0028: Provider V1 Self-Service

Status: Accepted
Date: 2026-08-19

## Decision

Ultreia implements a small provider self-service flow on the existing shared
Magic-Link/session foundation:

`profile -> Google-validated location -> offer -> pause/resume/confirm`.

One provider account represents one physical location in V1. A provider may
own multiple offers, but offers are always filtered by the authenticated user
and the session scope (`production` or `local_test`). Scope is never taken from
a client body or query parameter.

## Provider profile

`providerProfiles` stores `userId`, `scope`, status, business/contact fields,
source locale, structured location, timestamps, and completion state. Provider
activation requires a business name and a server-validated Google location.

## Google location

The backend uses Places API (New) Autocomplete and Place Details with a
server-side restricted runtime key. Place Details is fetched again on save;
the client cannot submit an arbitrary address or coordinate. A marker change is
accepted only within 25 metres of the Google coordinate, and both original and
final GeoJSON coordinates are stored.

## Needs and offers

The curated V1 Need catalog is seeded into the `needs` collection from the
shared taxonomy and exposed through `GET /api/needs`. Offers store one or more
active Need keys, structured price data, weekly hours, exceptions, radius,
translation state, and 30-day confirmation fields. No matching, navigation, or
push logic is part of this block.

## Security and limits

Provider routes require an authenticated provider/admin role, enforce ownership
server-side, and return no cross-provider offer data. Google credentials and
provider secrets are never sent to the browser or committed.
