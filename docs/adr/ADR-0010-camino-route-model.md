# ADR-0010: Camino Route Model

Status: Accepted
Date: 2026-06-22

## Context

Ultreia is not a normal nearby app. A pilgrim is moving along a route, and relevance depends on position along the Camino, direction, before/after relationship, corridor, timing, and selected Need.

ADR-0003 defines the full Camino Frances MVP scope from Saint-Jean-Pied-de-Port to Santiago de Compostela. ADR-0013 defines that air distance is not the functional distance for relevance or push.

To make matching, push, and diagnostics testable before field work on the Camino, Ultreia also needs an explicit development/test route.

## Decision

Ultreia models the Camino and all testable routes route-first.

The central route model consists of:

- Route
- RouteGeometry / Polyline
- RouteSegment
- RouteKm / linear position along the route
- Corridor / tolerance area left and right of the route
- optional Stage Metadata

## Camino Frances

For the Camino Frances:

- The Camino Frances is the central official product route.
- The MVP covers the full Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela.
- Stages may be used as human UX or content structure.
- Stages are not a hard matching basis.
- Matching is based on RouteKm, segment, and corridor.
- Relevance depends on whether a POI is meaningfully ahead of the pilgrim and in route context.
- Air distance is not a functional relevance distance.

## Development / Test Route

Because the Camino Frances is not geographically reachable during normal development and field tests, Ultreia needs an explicit development/test route.

This test route is a mandatory architectural component for development and verification.

It must allow Ultreia to:

- use the current GPS position of a test phone as a real location
- create local test POIs / test offers
- test matching along a local or artificial test route
- test RouteKm, segment, corridor, and walking directions in real conditions
- trigger real push notifications
- verify admin / diagnostics output
- use the same matching, push, and diagnostics pipeline as the real Camino

## Separation

Test routes and test POIs must not pollute real Camino data.

Test data must be clearly marked as development, staging, or test data.

Test data must not appear publicly as real Camino content.

Productive Camino data and local test data must be separable through Environment, DataScope, RouteType, or a comparable concept.

## Conceptual Fields

### Route

- `id`
- `name`
- `routeType`: `official` | `dev_test`
- `environmentScope`: `production` | `staging` | `development`
- `geometry`
- `totalDistanceKm`
- `defaultCorridorMeters`

### RouteSegment

- `routeId`
- `segmentIndex`
- `fromKm`
- `toKm`
- `geometry`
- `corridorMetersOverride` optional
- `stageName` optional

### POI Route Context

- `nearestRouteId`
- `nearestSegmentId`
- `routeKm`
- `distanceFromRouteMeters`
- `dataScope`: `real_camino` | `local_test`
- `source`
- `confidence`

## Rationale

The Camino is a linear corridor.

Ultreia relevance depends on position along the way, direction, before/after relationship, corridor, and Need.

Development cannot be verified reliably without a local test route.

The same pipeline must be testable locally; otherwise Camino-specific blind spots will appear only during real field tests.

## Non-Goals

- No full segment graph in the MVP
- No complex alternative route engine in the MVP
- No public release of local test data
- No hard stage boundaries as matching logic
- No Google Directions as the primary matching engine; that is ADR-0013
- No implementation in this ADR
- No route data import in this ADR
- No database schema in this ADR
- No secrets
- No deploy

## Relationship to StepsMatch

StepsMatch may provide technical learnings for background location, heartbeat, geofencing, push, matching, logging, throttling, and field-test behavior.

Ultreia must not copy StepsMatch route data, demo data, product semantics, or radius-only logic.

Ultreia's route model remains Camino-specific and product-specific.

## Consequences

Future matching, push, diagnostics, admin, and data model work must treat route context as a first-class concept.

Local development and staging must support an explicit dev/test route that exercises the same pipeline as the official Camino route.

POIs must carry enough route context to support RouteKm, segment, corridor, and data-scope separation.
