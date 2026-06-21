# ADR-0008: Shared Taxonomy Consumption

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is an independent Camino product with German, English, and Spanish as required languages from project start. ADR-0005 defines i18n as a product foundation. ADR-0006 defines NeedCategory, PlaceType, ContentType, TrustLabel, and PushSuitability as core modeling concepts. ADR-0007 defines `shared/` as the place for non-secret shared product configuration.

The first shared taxonomy configuration now exists in `shared/taxonomy/`.

## Decision

Ultreia uses `shared/taxonomy/` as the central source for static product configuration.

This includes:

- supported languages
- NeedCategories
- PlaceTypes
- ContentTypes
- TrustLabels
- PushSuitability

This configuration is the common foundation for:

- Backend
- Mobile app
- public web
- provider frontend
- later admin and content tools

## Rationale

Ultreia is trilingual from the start: `de`, `en`, and `es`.

Categories, PlaceTypes, and TrustLabels must not be duplicated independently per application layer.

Backend, mobile, and frontend must use the same keys.

JSON is intentionally simple and framework-neutral for the project start.

Ultreia does not introduce an internal shared package at the beginning, to avoid unnecessary tooling complexity.

Validation is mandatory when taxonomy files are changed.

## Start Rule

For the start:

- `shared/taxonomy/*.json` remains simple JSON configuration.
- No TypeScript code generation.
- No internal npm package.
- No build pipeline.
- No duplicates in `backend/`, `mobile/`, or `frontend/`.
- Thin adapters or loaders per layer are allowed later.
- The JSON files must not contain secrets.
- The JSON files must not contain runtime-specific environment values.

## Backend Consumption

The backend should later:

- derive allowed NeedCategory keys from `shared/taxonomy/needCategories.json`
- derive allowed PlaceType keys from `shared/taxonomy/placeTypes.json`
- derive allowed ContentTypes and TrustLabels from `shared/taxonomy/`
- validate API inputs against shared keys
- use PushSuitability and category priority as product logic input
- avoid maintaining a separate hardcoded category list

## Mobile Consumption

The mobile app should later:

- derive needs selection from `shared/taxonomy/needCategories.json`
- display labels in the selected language
- respect fallback rules from ADR-0005
- avoid maintaining a separate hardcoded category list
- derive push and local notification texts later from i18n/templates, not hardcode them in components

## Frontend and Provider UI Consumption

The frontend should later:

- support `de`, `en`, and `es`
- derive provider place creation from `shared/taxonomy/placeTypes.json` and `shared/taxonomy/needCategories.json`
- display ContentTypes and TrustLabels correctly
- support Spanish provider UX as first-class
- avoid maintaining a separate hardcoded category or PlaceType list

## Validation Rule

Every change in `shared/taxonomy/` must be followed by:

```bash
node shared/taxonomy/validate-taxonomy.mjs
```

Expected success output:

```text
taxonomy validation ok
```

Validation is not optional. A taxonomy change that does not validate must not be committed.

## Non-Goals

- No backend implementation
- No mobile implementation
- No frontend implementation
- No TypeScript type generation
- No npm workspace or package setup
- No database schema
- No build pipeline
- No StepsMatch file adoption
- No secrets
- No deploy
- No remote

## Relationship to StepsMatch

StepsMatch remains a technical reference for implementation patterns.

Ultreia does not consume StepsMatch categories, wording, demo data, or provider logic.

The shared taxonomy is an Ultreia-specific product configuration and must remain Camino-specific, multilingual, and independent.

## Consequences

Future backend, mobile, frontend, provider, and admin work must consume the shared taxonomy instead of duplicating static product keys.

If a layer needs convenience helpers, it may add a thin local adapter later, but the source data remains `shared/taxonomy/`.
