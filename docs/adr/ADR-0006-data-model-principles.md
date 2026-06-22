# ADR-0006: Data Model Principles

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is a Camino-specific, route-based companion for pilgrims. It is not a deal portal, not a booking replacement, and not a clone of the StepsMatch offer model.

ADR-0003 defines the MVP scope as the full Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela. ADR-0004 defines the early need/category taxonomy. ADR-0005 requires German, English, and Spanish from project start.

This ADR defines data model principles before concrete MongoDB or Mongoose schemas are implemented.

## Decision

Ultreia will not simply remodel StepsMatch offers.

Ultreia needs its own Camino core objects. The data structure must account for NeedCategory, PlaceType, RouteContext, PromptRules, TrustLabels, i18n, and logging from the beginning.

This ADR defines fachliche and technical modeling principles only. It does not define final field names, collections, indexes, migrations, or Mongoose schemas.

## Core Objects

The following objects are expected as fachliche concepts. Their exact schema remains a later decision.

### PilgrimUser / User

Purpose: Auth, language, base profile, privacy, and push preferences.

The model must support explicit language preference, consent/privacy state, and a path for authenticated or lightweight user profiles.

### PilgrimProfile

Purpose: selected needs, language, notification preferences, and possible Camino status.

The model should be able to store selected NeedCategories, preferred notification intensity, active route, progress state, and stage or section context when available.

### PushToken / Device

Purpose: device identity, language, platform, token status, location capability, and push capability.

The model should support token validity, preferred language, platform, push permission state, location permission state, last relevant device state, and pseudonymous device identity.

### Place

Purpose: a place along or near the Camino.

Examples: `albergue`, `bar`, `cafe`, `farmacia`, `supermarket`, `church`, `fountain`, `viewpoint`.

Place must allow i18n-capable titles and descriptions. It must contain source, trust, and content type information. It must contain geolocation. It must later allow route distance and detour information.

### NeedCategory

Purpose: a pilgrim need such as `sleep`, `eat`, `water`, `pharmacy`, `medical`, `grocery`, `cash`, or `stamp`.

NeedCategory must support labels in `de`, `en`, and `es`. It is fachlich configurable and must not be hidden as hardcoded application logic.

### PlaceType

Purpose: concrete place types such as `albergue`, `hostel`, `pharmacy`, `cafe`, `supermarket`, or `church`.

PlaceType must support labels in `de`, `en`, and `es`. A PlaceType may map to multiple NeedCategories.

### Route / CaminoRoute

Purpose: represents the Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela.

The model must later allow route geometry or polyline data and route-level metadata.

### RouteSegment / Stage

Purpose: stage or section logic, later distance along route, direction, and route context.

Segments do not have to equal final daily stages, but they are useful for UX, caching, prompt logic, and explaining where a pilgrim is on the route.

### PromptRule / NotificationRule

Purpose: decides when a Place/Need may trigger a push, local notification, or in-app hint.

Prompt rules must consider need, time of day, distance, RouteContext, repetition, suppression state, and priority.

### MatchEvent

Purpose: records which candidates were evaluated, why a candidate matched or did not match, and which rules applied.

MatchEvent must enable product learning and debugging. It is a core model, not an afterthought.

### NotificationLog

Purpose: records local or remote push, language, template, success/error state, and opening or non-opening.

NotificationLog must help explain notification quality, delivery behavior, and user response while staying privacy-conscious.

### Provider / Owner

Purpose: manage official participating places or providers later.

The model must support Spanish as a likely main working language. It must never make editorial places look like official providers.

### ContentSource / TrustLabel

Purpose: distinguish source and trust state.

Required early distinctions:

- `editorial_place`
- `official_participating_place`
- `demo_test_place`
- possibly `imported_public_reference` later

This distinction is important to prevent false partner claims.

### ContentTranslation

Purpose: support multilingual titles, descriptions, disclaimers, push templates, and labels.

Fallback follows ADR-0005:

1. Selected language
2. English
3. Available original language
4. Neutral fallback or no unsafe text

## Route-Based Modeling

Ultreia must not rely only on straight-line radius.

StepsMatch radius logic is a useful technical reference, but it is not the final Ultreia product model.

Ultreia additionally needs:

- Distance from user to Place
- Distance from Place to Camino route
- Detour distance from route
- Direction, ahead of user, or behind user
- RouteSegment or Stage context

For the MVP, implementation may start with a simplified variant, but the schema must allow later RouteContext expansion.

## i18n Consequences

System labels must fully support `de`, `en`, and `es`.

User-generated and provider-generated content may have translation gaps.

Fallback rules from ADR-0005 apply.

Push templates must be language-dependent.

The provider frontend must support Spanish content entry.

## Content and Trust Boundaries

Editorial places must not look like official partners.

Official participating places require consent or registration.

Demo/test places must be clearly marked.

Ultreia must not guarantee opening hours, availability, prices, or free beds.

Source, `lastVerifiedAt`, and `verificationStatus` are important concepts, but exact fields remain a later schema decision.

## Logging as Core Model

MatchEvent and NotificationLog are not secondary diagnostics. Ultreia must learn from real use.

Logs must be designed with minimal personal data and pseudonymization in mind.

Important questions for logs:

- Why was a prompt sent?
- Why was a prompt not sent?
- Was it opened?
- Was map or navigation used?
- What was the user's language?
- What was the app or device state?
- What was the route context?
- What suppression reason applied?

## Non-Goals

- No code
- No Mongoose schemas
- No MongoDB indexes
- No migrations
- No seed data
- No copying of StepsMatch files
- No final field-name decisions
- No route geometry implementation

## Relationship to StepsMatch

StepsMatch provides reference for push, heartbeat, location, matching, and logging.

Ultreia will not blindly adopt the StepsMatch offer model.

Ultreia models the Camino domain independently and specifically for route-based pilgrim use.

## Consequences

The next implementation-facing decision can be a repo/code scaffold strategy or a concrete backend/mobile bootstrap strategy.

Before building schemas, Ultreia should decide how the core objects map to collections, references, embedded multilingual content, route geometry, event logs, and privacy boundaries.
