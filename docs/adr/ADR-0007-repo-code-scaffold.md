# ADR-0007: Repo Code Scaffold

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is an independent Camino product. ADR-0001 defines selective technical learning from StepsMatch without copying or rebranding. ADR-0003 defines the full Camino Frances MVP scope. ADR-0004, ADR-0005, and ADR-0006 define need taxonomy, i18n from start, and data model principles.

This ADR decides the repository and code scaffold strategy before any code scaffold is created.

## Decision

Ultreia will be built as an independent monorepo.

Planned top-level structure:

- `backend/`
- `mobile/`
- `frontend/`
- `shared/`
- `docs/`

## Rationale

Backend, mobile app, provider frontend, and public web belong to the same product.

Shared taxonomies, language codes, TrustLabels, ContentTypes, PushSuitability values, and later TypeScript types should not be duplicated independently across backend, mobile, and frontend.

`shared/` will serve as a controlled common source for static, non-secret product configuration.

StepsMatch remains a technical reference, but it will not be copied.

Ultreia must account for i18n, route context, and Camino-specific taxonomy from the beginning.

## Planned Areas

### backend/

Node.js, Express, and MongoDB are likely starting points because StepsMatch provides useful learnings in this area.

This ADR does not implement schemas.

The backend must later support RouteContext, Place, NeedCategory, MatchEvent, NotificationLog, PushToken, and Provider/Owner concepts.

### mobile/

Expo and React Native are likely starting points because StepsMatch provides Background Location and Push learnings.

Mobile must later support:

- i18n for `de`, `en`, and `es`
- explicit language choice
- needs selection
- Background Location
- Push and Local Notifications
- map and navigation

Android-first implementation is possible. iOS remains strategically important later, but is not implemented by this ADR.

### frontend/

The frontend covers public web and the provider frontend.

It must support `de`, `en`, and `es` from the start.

The provider frontend is important because Spanish providers along the Camino will likely use Spanish as their first working language.

### shared/

`shared/` will later contain non-secret shared configuration:

- `supportedLanguages`: `de`, `en`, `es`
- NeedCategory configuration
- PlaceType configuration
- TrustLabels
- ContentTypes
- PushSuitability
- possibly shared TypeScript types

`shared/` must not contain secrets.

`shared/` must not contain runtime-specific environment values.

### docs/

`docs/` contains the source of truth and ADRs.

`docs/ULTREIA_CONTEXT.md` remains the operative project source.

ADRs document decisions and decision boundaries.

## What Does Not Happen

- No full copy from StepsMatch
- No blind copying of StepsMatch files
- No adoption of StepsMatch demo data
- No adoption of StepsMatch texts or categories
- No database structure implementation
- No deploy
- No remote
- No secrets

## Technical Start Order After This ADR

Recommended next steps:

### A. Minimal repo scaffold

Create only minimal placeholders:

- `backend/.gitkeep`
- `mobile/.gitkeep`
- `frontend/.gitkeep`
- `shared/.gitkeep`
- optionally `README.md`

### B. Shared taxonomy/i18n config

After the minimal scaffold, the first real code/config work should be shared taxonomy and i18n configuration, still without backend or mobile complexity.

### C. Backend base

Then create a backend base structure.

### D. Mobile base

Then create a mobile base structure.

## Relationship to StepsMatch

StepsMatch serves as reference for push, Background Location, heartbeat, matching, and logging.

Ultreia adopts only consciously reviewed building blocks.

Every adoption must fit Camino context, i18n, and the route model.

## Consequences

The next implementation-facing step may be a minimal repo scaffold.

That scaffold should create structure only. It should not import StepsMatch files, define schemas, introduce secrets, set a remote, or deploy anything.
