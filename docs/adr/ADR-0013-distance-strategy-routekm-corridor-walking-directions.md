# ADR-0013: Distance Strategy: RouteKm, Corridor and Walking Directions

Status: Accepted
Date: 2026-06-22

## Context

Ultreia is route-first. A pilgrim is not just somewhere in a radius; the pilgrim is moving along the Camino Frances.

Simple straight-line distance is not a reliable product distance for Camino relevance or push decisions. A place can be close by air distance but behind the pilgrim, across terrain, away from the route, or impractical to reach.

ADR-0003 defines the full Camino Frances MVP scope. ADR-0006 defines route context and prompt rules as core data model concerns.

## Decision

Ultreia does not use air distance as the functional distance for relevance or push.

Functional distance is based on:

1. Camino RouteKm / position along the route
2. segment and corridor logic
3. Google Directions walking distance / duration for a few top candidates

Route-first matching creates candidates.

Google Directions validates only a small number of relevant candidates.

Google Directions is not the primary matching engine.

Air distance may be used only as a technical prefilter.

## Rationale

Air distance is often wrong on the Camino.

RouteKm can determine whether a POI is ahead of or behind the pilgrim.

Corridor logic can determine whether a POI is meaningfully on or near the Camino.

Walking directions can provide realistic walking distance and duration for selected candidates.

Using directions only for a few candidates keeps API cost, latency, and rate limits controlled.

## MVP Rules

For the MVP:

- Air distance is only a technical prefilter.
- RouteKm and corridor logic are mandatory.
- Directions are used only for the top 3-5 candidates per heartbeat / Need.
- Directions results must be cached.
- Push is allowed only when the distance is plausible enough.
- Missing or uncertain directions must produce cautious wording.
- Cautious wording example: "liegt voraussichtlich am Weg" instead of exact walking time.
- Push copy must not guarantee exact availability, opening hours, free beds, prices, or medical safety.

## Non-Goals

- No implementation in this ADR
- No Google API integration in this ADR
- No route geometry file in this ADR
- No backend schema in this ADR
- No push implementation in this ADR
- No secrets
- No deploy

## Relationship to StepsMatch

StepsMatch radius logic may be useful as a technical prefilter reference.

Ultreia must not adopt radius-only matching as product logic.

Ultreia's product logic is route-first: RouteKm, corridor, direction, timing, selected Need, and notification policy decide relevance.

## Consequences

Future matching, notification, and data model work must include route position and corridor concepts.

Any implementation using air distance must document it as a technical prefilter, not as the product relevance distance.

Directions usage must be bounded, cached, and treated as validation for selected candidates only.
