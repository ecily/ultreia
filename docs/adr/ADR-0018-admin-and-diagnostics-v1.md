# ADR-0018: Admin and Diagnostics v1

Status: Accepted
Date: 2026-06-22

## Context

Ultreia's MVP depends on route-first matching, push policy, data quality, and a local Development/Test Mode.

These decisions are context-heavy and cannot be verified reliably without diagnostics.

StepsMatch has positively tested the technical heartbeat-to-push pipeline. Ultreia uses that technical pattern as reference, but keeps its own route-first logic, taxonomy, data model, i18n rules, documentation, and branding.

## Decision

Ultreia needs Admin and Diagnostics functions from the MVP onward.

Admin / Diagnostics is not a nice-to-have. It is required to verify field tests, local development, matching, push delivery, and data quality.

Core principle:

What the system decides must be explainable in the MVP.

## Why Diagnostics Are Required

Ultreia makes many context-dependent decisions:

- GPS position
- Route / Test Route
- RouteKm
- Segment
- Corridor
- active Needs
- POI / Service candidates
- data source
- confidence
- verificationStatus
- Directions
- MatchScore
- cooldowns
- PushPermission
- PushToken
- Notification Policy

Without diagnostics, failures cannot be attributed clearly to GPS, route matching, Need selection, data quality, Directions, cooldowns, PushToken state, or provider data.

## 1. Mobile / Heartbeat Diagnostics

Admin / Diagnostics v1 must be able to answer:

- Which PilgrimUser / TestUser?
- Which device?
- Last GPS heartbeat?
- Time of last heartbeat?
- latitude / longitude
- location accuracy, when available
- app version, when available
- platform: iOS / Android
- foreground / background status, when available
- battery / permission status, when available
- PushPermission status
- location permission status
- PushToken present / valid?

## 2. Route Context Diagnostics

Admin / Diagnostics v1 must show:

- detected Route
- Camino Mode or Development/Test Mode
- `routeId`
- `routeType`: `official` | `dev_test`
- `dataScope`: `real_camino` | `local_test`
- `environmentScope`: `production` | `staging` | `development`
- `nearestSegmentId`
- `routeKm`
- `distanceFromRouteMeters`
- inside or outside corridor
- direction plausibility
- unknown route state
- location quality sufficiency

## 3. Pilgrim State / Needs Diagnostics

Admin / Diagnostics v1 must show:

- active Needs
- language / locale
- Silence / Pause Mode
- onboarding completion
- terms / disclaimer acceptance
- recently seen hints / dedupe state
- Test Mode active state

## 4. POI / Service Diagnostics

Admin / Diagnostics v1 must show:

- candidate POIs / Services
- rejected POIs / Services
- rejection reasons
- `needCategory`
- `poiId`
- `serviceId`
- POI `routeKm`
- `distanceAheadKm`
- `distanceFromRouteMeters`
- walking distance / duration, when available
- `sourceType`
- `confidence`
- `verificationStatus`
- `visibilityStatus`
- `lastVerifiedAt`
- provider-confirmed / provider-maintained status
- provider opt-out / removal / correction status, when relevant
- `real_camino` or `local_test`

## 5. Matching Diagnostics

Admin / Diagnostics v1 must show:

- whether a MatchEvent was created
- score
- confidence
- decision: `matched` | `rejected`
- `rejectionReasons`
- whether Directions were used
- Directions cache hit / miss
- Directions failure
- relevant scoring components
- why a Match was created
- why a Match was not created

## 6. Notification Diagnostics

Admin / Diagnostics v1 must show:

- whether a NotificationEvent was created
- `policyDecision`: `send` | `suppress`
- `suppressReasons`
- whether push was sent or suppressed
- MatchEvent link
- `messageKey`
- `locale`
- `messageParams`
- optional `renderedTitle` / `renderedBody` for audit
- `cooldownState`
- global cooldown active state
- Need cooldown active state
- POI / Service cooldown active state
- daily limit state
- PushToken valid state
- provider: `expo` | `fcm` | `apns` | `other`
- optional `providerMessageId`
- `deliveryStatus`: `queued` | `sent` | `failed` | `unknown`
- optional `errorCode`

## 7. Data Quality / Trust Diagnostics

Admin must later make visible:

- source of an entry
- whether it was pre-filled by Ultreia
- whether it was taken from a public source
- whether it is provider-maintained / provider-confirmed
- whether it is disputed
- whether `removal_requested` or `hidden_by_request` applies
- confidence
- verificationStatus
- `lastVerifiedAt`
- why it is public or hidden

ADR-0018 may make early claim / correction / remove / opt-out status visible.

ADR-0019 remains responsible for the complete Provider Claiming process.

## 8. Development / Test Anchor

Admin / Diagnostics must support local tests with the current GPS position of the test phone.

A tester in Austria must be able to verify:

- test phone sends heartbeat
- local Development/Test Route is detected
- local test POIs / test Services are found
- MatchEvents are created
- NotificationEvents are created
- push is sent or correctly suppressed
- push arrives when the app is closed and the screen is off
- send / suppress reasons are visible
- `local_test` is never confused with `real_camino`

The local Development/Test Mode must be diagnosable in the MVP.

## 9. Admin v1 Scope

Admin v1 does not need to be beautiful.

Admin v1 must be explainable and testable.

MVP-suitable functions:

- overview of recent heartbeats
- detail view for a TestUser / PilgrimUser
- RouteContext display
- active Needs
- recent MatchEvents
- recent NotificationEvents
- recent rejection / suppress reasons
- POI / Service data quality
- `local_test` vs `real_camino` filter
- `production` / `staging` / `development` filter
- clear distinction between test data and real data

Admin v1 may optionally allow:

- viewing test POIs / test Services
- inspecting test data status
- marking data quality
- seeing POI / Service visible / hidden state
- seeing feedback / correction / removal status

ADR-0018 does not require productive data mutation. Mutation and review workflows can be decided later.

## 10. Logging / Events

Conceptually relevant events:

- HeartbeatEvent
- RouteMatchEvent or RouteContextSnapshot
- MatchEvent
- NotificationEvent
- DirectionsLookupEvent
- PushTokenEvent
- PermissionStateEvent
- optional DataQualityEvent
- optional AdminAuditEvent

Logs must not contain secrets.

PushTokens must not be shown in full unless strictly necessary and protected.

Personal data must be minimized and used only for diagnostics.

## 11. Privacy / Safety

Admin / Diagnostics must be useful without being unnecessarily invasive.

Rules:

- do not expose secrets
- do not show API keys
- mask PushTokens when displayed
- use personal location data only as needed for diagnostics
- protect Admin / Diagnostics access later
- separate test data clearly from real pilgrim data
- do not infer medical or safety-critical conclusions from diagnostics

## 12. i18n / Languages

German, English, and Spanish remain mandatory when Admin / Diagnostics text is visible in UI.

This applies to:

- visible status labels
- Reject Reasons
- Suppress Reasons
- permission status
- data quality labels
- provider / source hints
- Test Mode hints

Internal technical codes may remain English:

- `wrong_need`
- `outside_corridor`
- `behind_pilgrim`
- `global_cooldown`
- `push_token_invalid`
- `directions_failed`

Visible UI labels must be translatable.

## Relationship to ADR-0019

ADR-0018 may make early claim / correction / remove / opt-out state visible.

ADR-0019 will decide the full Provider Claiming process:

- verification
- rights / roles
- claim review
- abuse protection
- provider onboarding
- provider self-service
- offer management

## StepsMatch Reference

StepsMatch remains a technical reference for:

- Background Location
- GPS heartbeats
- backend comparison
- match detection
- push when the app is closed
- push when the screen is off
- logging / diagnostics

Ultreia adopts the technical pattern, not the StepsMatch product logic.

## Relationship to Other ADRs

- ADR-0010 defines Route, Segment, RouteKm, Corridor, and Development/Test Route.
- ADR-0011 defines Pilgrim Identity / Auth / Onboarding.
- ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim.
- ADR-0013 defines distance strategy with RouteKm, corridor, and Walking Directions.
- ADR-0014 defines Matching v1.
- ADR-0015 defines Notification Policy, Cooldowns, data / guarantee communication, and i18n for notifications.
- ADR-0016 defines MVP Data Source Strategy.
- ADR-0017 defines Mobile MVP Scope.
- ADR-0018 defines Admin and Diagnostics v1.

## Non-Goals

- No implementation
- No admin code
- No backend code
- No mobile code
- No final UI design
- No final copy
- No production data import
- No full admin product
- No elaborate dashboard design
- No provider frontend
- No final claiming workflow
- No complete review system
- No required productive data mutation
- No analytics / marketing dashboard
- No advertising tracking
- No DNS change
- No database mutation
- No deploy
- No infrastructure change
- No secrets

## Consequences

Future MVP implementation must treat observability as part of the product, not as an afterthought.

Development/Test Mode must expose enough diagnostics to verify the same heartbeat, route context, matching, notification, push delivery, and data quality pipeline that will later support the Camino Frances.

Visible Admin / Diagnostics labels must remain compatible with DE / EN / ES.
