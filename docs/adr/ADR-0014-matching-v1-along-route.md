# ADR-0014: Matching v1 Along Route

Status: Accepted
Date: 2026-06-22

## Context

Ultreia's core value is not generic nearby search. A pilgrim selects active Needs, keeps walking, and Ultreia should recognize when something relevant is meaningfully on the way ahead.

ADR-0010 defines route, segment, RouteKm, corridor, and development/test route. ADR-0011 defines pilgrim identity and user state. ADR-0012 defines POI and Service data. ADR-0013 defines route-first distance strategy.

StepsMatch has positively tested the technical heartbeat-to-push pipeline. Ultreia uses that technical pattern as reference, but keeps its own route-first product logic.

## Decision

Ultreia Matching v1 decides route-first along the Camino or a Development/Test Route.

It does not decide by generic proximity or air distance.

Core question:

Not: "What is nearby?"

But: "What is useful for this pilgrim with this active Need now on the way ahead?"

## Matching v1 Pipeline

1. Mobile app sends GPS heartbeat to the backend.
2. Backend assigns the location to a route:
   - Camino Frances
   - Development/Test Route
3. Backend determines:
   - `nearestRouteId`
   - `nearestSegmentId`
   - pilgrim `routeKm`
   - distance from route / corridor
   - movement direction, if reliably inferable
4. Backend loads pilgrim state:
   - active Needs
   - language
   - push / location status
   - already seen hints
   - diagnostics / test context
5. Backend searches matching Services / POIs:
   - NeedCategory matches
   - POI is on the same route or test route
   - POI is inside the corridor or acceptable deviation
   - POI is meaningfully ahead of the pilgrim
   - POI / Service is visible and not archived or blocked
   - dataScope and environmentScope match
6. Backend scores candidates.
7. Only a few top candidates are validated / cached with Google Walking Directions.
8. Result is stored as MatchEvent.
9. ADR-0015 decides later whether a Match becomes a push notification.

## Separation From Notification Policy

ADR-0014 decides relevance and matching.

ADR-0015 decides push policy, cooldowns, and notification frequency.

Matching must not automatically mean push.

## Matching Input

Matching v1 uses:

- PilgrimUser / UserState
- current GPS position
- RouteContext
- active Needs
- POIs
- Services
- RouteSegments
- RouteKm
- Corridor
- data confidence
- opening / availability information, if present
- already seen matches / hints
- development / test context

## Prefilter

Candidates must pass basic filters:

- same `routeId` / `dataScope` / `environmentScope`
- NeedCategory matches
- POI / Service is visible
- POI is in the route corridor or acceptable deviation
- POI is not clearly behind the pilgrim
- data status is not disputed / hidden / archived

Air distance is allowed only as a technical prefilter.

## Scoring Criteria

Scoring may consider:

- Need priority
- distance ahead along RouteKm
- deviation from the route
- Google Walking Distance / Duration, if available
- opening status, if available
- seasonal availability, if available
- data confidence
- last verification time
- Need sensitivity
- already seen / match dedupe
- test mode vs real Camino data

## MVP Scoring Shape

MVP scoring is intentionally simple and explainable.

Positive factors:

- Need relevance
- meaningfully ahead on the way
- low corridor deviation
- plausible walking distance
- high data confidence
- fitting opening / availability information

Negative factors:

- already seen
- uncertain data
- too much deviation
- unclear direction

## MVP Rules

- Air distance is at most a technical prefilter.
- Matching is based on RouteKm, segment, corridor, and Need.
- Google Directions is not the primary matching engine.
- Google Directions validates only top candidates.
- Directions results are cached.
- Uncertain location or unknown route does not create a strong match.
- Uncertain data may create a low-confidence match.
- Push is not decided in ADR-0014.
- Matches must be saved in a diagnosable way.

## MatchEvent Concept

MatchEvent should conceptually include:

- `id`
- `pilgrimUserId`
- `routeId`
- `segmentId`
- `pilgrimRouteKm`
- `poiId`
- `serviceId`
- `needCategory`
- `poiRouteKm`
- `distanceAheadKm`
- `distanceFromRouteMeters`
- `walkingDistanceMeters` optional
- `walkingDurationSeconds` optional
- `score`
- `confidence`
- `decision`: `matched` | `rejected`
- `rejectionReasons` optional
- `directionsCacheKey` optional
- `dataScope`
- `environmentScope`
- `createdAt`

## Rejection / Diagnostic Reasons

Standard rejection reasons:

- `wrong_need`
- `outside_corridor`
- `behind_pilgrim`
- `too_far_ahead`
- `route_unknown`
- `direction_unclear`
- `hidden_or_archived`
- `low_confidence`
- `already_seen`
- `directions_failed`
- `environment_scope_mismatch`
- `data_scope_mismatch`

## Development / Test Anchor

Matching v1 must use the same pipeline for the Development/Test Route as for the Camino Frances.

This is mandatory because the Camino Frances is not geographically reachable during normal development.

Test mode must support:

- real GPS position of the test phone
- local test route
- local test POIs / test Services
- real heartbeats
- real backend comparison
- real MatchEvents
- later real push triggering through ADR-0015
- real admin / diagnostics evaluation

## StepsMatch Reference

The technical heartbeat / push pipeline was positively tested in StepsMatch and is the reference for Ultreia:

- background location sends location / heartbeat
- backend receives location
- backend compares against relevant places / services
- match is detected
- push is triggered
- push arrives even when the app is closed and the screen is off
- logging / diagnostics verify the flow

This technical pipeline is fundamental for Ultreia.

Ultreia adopts the technical pattern, not the StepsMatch product logic.

## Relationship to Other ADRs

- ADR-0010 defines Route, Segment, RouteKm, Corridor, and Development/Test Route.
- ADR-0011 defines Pilgrim Identity / Auth / Onboarding.
- ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim.
- ADR-0013 defines distance strategy with RouteKm, corridor, and Walking Directions.
- ADR-0014 defines Matching v1.
- ADR-0015 will later define Notification Policy, Cooldowns, and Push rules.

## Non-Goals

- No final push frequency decision
- No final cooldown decision
- No final notification copy decision
- No full MongoDB schema implementation
- No matching code
- No Google Directions code
- No production data ingestion
- No provider frontend
- No deploy
- No secrets

## Consequences

Future backend work must separate matching from notification policy.

MatchEvents must be observable enough for diagnostics and field tests.

Development and staging must be able to verify the same heartbeat, backend comparison, matching, and later push pipeline as the real Camino route.

Any implementation using air distance must treat it only as a technical prefilter, not as product relevance logic.
