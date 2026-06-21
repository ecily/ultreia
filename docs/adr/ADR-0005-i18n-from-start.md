# ADR-0005: i18n from Start

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is a Camino-specific companion for international pilgrims on the Camino Frances. ADR-0003 defines the geographic MVP scope as the full Camino Frances from Saint-Jean-Pied-de-Port to Santiago de Compostela. ADR-0004 defines the early need/category taxonomy as a fachlich prioritized working basis, not as a database schema.

Ultreia must support multilingual use from the start. This applies not only to the pilgrim mobile app and public web presence, but also to the provider frontend for places and services along the Camino.

## Decision

Ultreia supports three languages from project start:

- `de`: Deutsch
- `en`: English
- `es`: Español

These languages must be supported in all user interfaces:

- Mobile app for pilgrims
- Public web / landing page
- Provider frontend

The user must be able to choose the language explicitly.

## Rationale

Ultreia serves international pilgrims on the Camino Frances.

German is relevant for German-speaking pilgrims.

English is the international baseline language.

Spanish is mandatory because the Camino Frances is mostly in Spain and providers, places, and services along the route will likely use Spanish as their first working language.

For providers along the Camino, Spanish is probably the most important language. Therefore, i18n cannot apply only to the pilgrim side.

## Provider Frontend Scope

The provider frontend must be prepared for three languages from project start.

Affected areas:

- Registration
- Login
- Master data
- Place, service, and prompt creation
- Location selection
- Opening hours and validity
- Category and need assignment
- Preview
- Trust and disclaimer notices
- Error messages
- Help text
- Later display of missing translations

## Technical Principles

- No hardcoded UI texts in components.
- UI and system texts must be maintained through i18n.
- NeedCategory labels must be translatable.
- PlaceType labels must be translatable.
- Trust labels must be translatable.
- Push templates must be translatable.
- Disclaimers must be translatable.
- Onboarding texts must be translatable.
- Navigation, buttons, error messages, and empty states must be translatable.

## Backend and Data Model Consequences

The later backend and MongoDB data model must support multilingual editorial content.

This ADR does not define a final MongoDB schema.

This ADR defines only the i18n requirement and architecture principles.

User-generated or provider-generated content may initially have incomplete translations.

System texts and core labels must be maintained completely in German, English, and Spanish.

Conceptual later content shape, not a final schema:

```text
title:
  de?: string
  en?: string
  es?: string

description:
  de?: string
  en?: string
  es?: string
```

## Fallback Rules

Text resolution should follow this order:

1. Selected language
2. If missing: English
3. If missing: available original language
4. If nothing is available: neutral fallback or no unsafe text

## Language Preference

- Language preference must be stored in mobile.
- Language preference must be stored in web/frontend.
- If a user profile exists, preferred language should also be stored there.
- Push notifications must respect the user's preferred language.
- The provider frontend must also store or locally remember the preferred language.

## Push Notifications

Push and local notification texts must not be hardcoded.

Push texts must use the user's preferred language.

If a translation is missing, the fallback order from this ADR applies.

Medical, safety-relevant, or trust-relevant push texts must be especially careful and cleanly translated.

## Content and Admin Consequences

Later content creation must show which language versions are missing.

Editorial hints need translation status over time.

Official providers and places may initially enter content in their original language.

Ultreia must handle the case where providers supply Spanish content while pilgrims have selected German or English.

## Non-Goals

This ADR implements nothing.

Non-goals:

- No code
- No i18n package selection
- No translation files
- No MongoDB schema
- No UI
- No StepsMatch file adoption
- No decision on automatic translations

## Relationship to StepsMatch

StepsMatch provides technical learnings.

Ultreia i18n is decided independently and Camino-specifically.

No StepsMatch texts, categories, or UI terms are adopted blindly.

Multilingual support is a product foundation for Ultreia, not a later add-on.

## Consequences

All future UI, content, push, and schema work must account for German, English, and Spanish from the start.

The next data model ADR must include multilingual content handling, translation completeness, original-language tracking, fallback behavior, and provider-entered content with incomplete translations.
