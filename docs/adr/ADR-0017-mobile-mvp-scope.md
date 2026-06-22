# ADR-0017: Mobile MVP Scope

Status: Accepted
Date: 2026-06-22

## Context

Ultreia's core product value happens while a pilgrim is walking.

The positively tested StepsMatch technical pipeline remains a relevant reference:

Mobile GPS heartbeat -> backend comparison -> match detection -> push triggering -> push arrives even when the app is closed and the screen is off -> logging / diagnostics verify the flow.

Ultreia adopts this technical pattern as reference, but keeps its own route-first logic, taxonomy, data model, i18n rules, documentation, and branding.

## Decision

The Mobile App is the main product of the Ultreia MVP.

MVP does not mean many features. For Ultreia, MVP means the complete core loop:

Register / login -> onboarding -> language DE / EN / ES -> location permission -> push permission -> select Need -> send GPS heartbeat -> enable backend matching -> receive push -> view detail -> open route / directions to POI -> inspect diagnostics in test mode.

Core principle:

Pilgrims want to walk, not constantly search.

The Mobile App must therefore stay calm, clear, and minimal. It must not pull pilgrims into a complex map, search, or social app.

The central use case is:

The pilgrim selects a Need, puts the phone away, and Ultreia only reports plausibly relevant hints.

## MVP Screens / Scope

### 1. Registration / Login

Purpose:

- create PilgrimUser
- store language
- store active Needs
- store push / location status
- enable push token / device binding
- store disclaimer / terms acceptance
- enable already-seen hints / dedupe
- enable field-test / diagnostics assignment

MVP scope:

- simple registration / login
- no mandatory social login
- no social features
- ProviderUser remains separate

### 2. Onboarding

Onboarding must explain:

- Ultreia is for pilgrims on the Camino
- the app uses background location
- the app can send push notifications
- there is no guarantee for opening hours, availability, free beds, prices, medical safety, or completeness
- data may be provider-maintained, pre-filled by Ultreia, researched from public sources, or uncertain
- details should be checked on site or directly with the provider

Onboarding must support DE, EN, and ES.

### 3. Language / Locale

German, English, and Spanish are mandatory from the start.

The Mobile App must not hardcode single-language visible labels for:

- Need names
- buttons
- onboarding
- disclaimers
- push permission explanation
- location permission explanation
- match / detail text
- data source / responsibility labels
- error text
- visible diagnostics / status messages

### 4. Permission Flow

The MVP must cover:

- location permission
- background location, where technically required
- push notifications
- explanation why these permissions are needed
- status when a permission is missing or revoked

Permission communication must not be manipulative.

It must clearly state:

- without location, route-first matching cannot work
- without push, the app cannot reliably alert the pilgrim to relevant hints

### 5. Need Selection

The MVP needs a simple Need selection from `shared/taxonomy`.

Prioritized Needs:

- `sleep`
- `water`
- `eat`
- `grocery`
- `pharmacy`
- `medical`
- `transport`
- `laundry`
- `gear`
- `cash`
- `stamp`
- `sightseeing`
- `quiet_place`

Rules:

- NeedCategories come from `shared/taxonomy`.
- Mobile must not maintain duplicated category lists.
- Need selection is UserState and influences matching / push.

### 6. Home / Current Pilgrim State

The home state must simply show:

- active mode: Camino or Test Mode
- active Needs
- location / push status
- last known route context, when available
- calm status, for example that Ultreia is watching for relevant hints along the way
- no overloaded map as mandatory start screen

### 7. Match / Hint Detail

When a match / push is opened, the app must show:

- POI / Service
- Need relevance
- distance / walking distance, when available
- data source / responsibility
- understandable confidence / uncertainty
- opening hours / prices / availability, when stored
- no guarantee wording
- route / directions action

### 8. Route / Directions

The MVP must allow opening navigation / directions to the POI.

Preferred options are Google Maps, Apple Maps, or system-native solutions.

Directions are guidance, not a guarantee.

The target point is the POI / Service location, not the ProviderProfile address.

### 9. Push Interaction

When a push is received:

- tapping it opens the matching hint detail screen
- the push must be linked to a MatchEvent / NotificationEvent
- the app must be able to load relevant data
- i18n must match the user locale

### 10. Diagnostics / Field-Test Mode

Diagnostics mode is mandatory for the MVP.

Reason:

The Camino Frances is not geographically reachable during daily development. Progress must be verifiable with the current GPS position of the test phone and local test POIs.

Diagnostics mode must show:

- current GPS status
- last heartbeat
- last server response
- detected Route / Test Route
- routeKm / Segment / corridor status, when available
- active Needs
- recent MatchEvents
- recent NotificationEvents
- push sent / suppressed with reason
- `local_test` vs `real_camino`
- error states

Diagnostics mode may later be hidden or protected. For MVP / field-test it is mandatory.

### 11. Development / Test Mode

The Mobile MVP must conceptually support two modes.

Camino Mode:

- real Camino Frances route
- `real_camino` data
- production / staging depending on environment

Development / Test Mode:

- local Development/Test Route
- `local_test` data
- real GPS position of the test phone
- local test POIs / test Services
- same heartbeat / matching / push / diagnostics pipeline
- clear separation from real Camino data

Test data must never appear publicly as real Camino content.

### 12. Offline / Poor Connectivity

The MVP does not need full offline capability.

But the Mobile App must:

- handle poor connectivity clearly
- show last known hints when available
- avoid claiming false live freshness
- make heartbeat / push / match failures diagnosable

### 13. Account / Settings

MVP settings:

- change language
- change active Needs
- show push status
- show location status
- Silence / Pause Mode
- show disclaimer / privacy
- logout
- Test Mode, when authorized / enabled

## Non-Goals For Mobile MVP

- no social feed
- no chat
- no pilgrim profile as community profile
- no booking
- no payment
- no public rating system
- no complex route planning
- no full offline map
- no provider frontend inside the pilgrim app
- no admin UI inside the pilgrim app
- no advertising
- no generic nearby browsing as core product

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

## Non-Goals

- No implementation
- No mobile code
- No Expo / build / store setup change
- No backend code
- No final UI design
- No final copy
- No production data import
- No DNS change
- No database mutation
- No deploy
- No infrastructure change
- No secrets

## Consequences

Mobile implementation must prioritize the complete heartbeat, matching, push, detail, directions, and diagnostics loop over secondary product features.

DE / EN / ES must be built into visible Mobile UX from the start.

Camino Mode and Development/Test Mode must be considered from the beginning so field tests can verify the same pipeline that will later support the Camino Frances.
