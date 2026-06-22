# ADR-0016: MVP Data Source Strategy

Status: Accepted
Date: 2026-06-22

## Context

Ultreia needs useful MVP data along the Camino Frances before provider onboarding and provider claiming are available.

ADR-0010 defines the route model and development/test route. ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim. ADR-0015 defines cautious data / guarantee communication and i18n requirements for notification-related labels.

Data strategy is not only import technique. For Ultreia, data strategy is trust architecture.

## Decision

Ultreia does not fill the MVP primarily through provider onboarding.

The MVP uses a controlled, curated initial data set along the Camino Frances plus strictly separated local test data.

Every public POI / Service entry needs:

- source
- confidence
- verification status
- clear communication of responsibility

## MVP Goal

The MVP should:

- treat the full Camino Frances as the geographic corridor
- start functionally with limited but useful POI / Service coverage
- not claim completeness
- not claim false partnerships
- not guarantee opening hours, availability, free beds, prices, or medical safety
- allow initial data to be improved later through provider claiming, provider maintenance, and pilgrim feedback

## Allowed MVP Data Sources

Allowed sources:

1. manually curated initial data by Ultreia
2. public sources where legally and practically acceptable
3. OpenStreetMap or comparable open data as a starting point, not blindly as truth
4. official / published websites of individual providers or places, where allowed
5. provider-maintained data once provider frontend / claiming exists later
6. pilgrim feedback later as a signal, not immediately as primary truth
7. local test data for development / staging

## Not Allowed / Not A Goal

Ultreia must not:

- blindly adopt third-party closed databases
- define scraping as the product core
- imply partnership when no provider has confirmed it
- claim full Camino coverage
- mark unverified data as safe or provider-confirmed
- show local test data publicly as real Camino data

## Data Quality Fields

Each POI / Service should conceptually carry at least:

- `sourceType`
- `sourceUrl` optional
- `confidence`: `low` | `medium` | `high`
- `verificationStatus`: `unverified` | `curated` | `provider_confirmed` | `disputed`
- `lastVerifiedAt` optional
- `dataScope`: `real_camino` | `local_test`
- `environmentScope`: `production` | `staging` | `development`
- `visibilityStatus`: `draft` | `active` | `hidden` | `archived`

Data source classes:

- `manual`
- `osm`
- `official_website`
- `provider_claim`
- `provider_maintained`
- `pilgrim_feedback`
- `public_data`
- `other`

## Visibility Rule

Public display is allowed only when `visibilityStatus` is active and `dataScope` / `environmentScope` match.

Examples:

- `real_camino` + `production`: may appear publicly when active
- `real_camino` + `staging`: staging only
- `local_test` + `development`: local development only
- `local_test` + `staging`: explicit test mode only
- `local_test` + `production`: must not appear publicly as real Camino content

## Initial Data By Ultreia

Ultreia may pre-fill Providers / POIs / Services at the beginning so that the MVP is testable.

Rules:

- mark clearly as pre-filled by Ultreia
- do not present as provider-confirmed
- do not imply official partner status
- store source and verification status
- allow visible notice:

```text
Von Ultreia vorab eingepflegt. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen.
```

## Provider-Confirmed Data

Once provider claiming / provider maintenance exists later:

- `provider_confirmed` / `provider_maintained` may receive higher trust
- still no guarantee of availability, opening hours, prices, or free beds
- allow visible notice:

```text
Vom Anbieter gepflegt. Bitte Angaben vor Ort prüfen.
```

## Early Claim / Remove Path

Because Ultreia may pre-fill Providers / POIs / Services before full provider onboarding exists, the real operator must get a simple early path to:

- claim the entry
- correct master data
- later maintain offers / Services themselves
- request removal or deactivation when they do not want to be listed

This early path is part of ADR-0016's trust-first data strategy. It is not the full provider claiming process.

ADR-0019 will decide the complete process for verification, claim review, roles, rights, abuse protection, and provider frontend.

Provider onboarding must explain the benefit carefully:

- Providers can keep their data current.
- Providers can maintain offers later.
- Providers can influence route / radius relevance of offers where the system allows it.
- Ultreia does not broadcast to all users, but can reach pilgrims with matching Need and route context.
- Ultreia can guide pilgrims by route / directions to the concrete location.
- This reduces waste compared with classic advertising.
- No partner label is shown before confirmation.

Allowed conceptual wording:

```text
Mit einem bestätigten Provider-Konto können Sie Ihre Informationen und Angebote selbst aktuell halten. Ultreia kann passende Pilger im richtigen Wegkontext auf relevante Angebote hinweisen und sie per Route zum Standort führen.
```

Disallowed wording:

```text
Wir bringen garantiert Pilger zu Ihrem Geschäft.
```

Ultreia must not guarantee:

- number of pilgrims reached
- revenue
- visibility
- push delivery
- free beds / availability
- prices
- opening hours

Conceptual status values for the early path:

- `claim_pending`
- `provider_confirmed`
- `correction_requested`
- `removal_requested`
- `hidden_by_request`
- `rejected_claim`

## OSM / Public Data

OSM and public sources may be starting points.

Rules:

- do not treat as truth blindly
- store `sourceType` / `sourceUrl` where possible
- set confidence low or medium depending on verification
- do not mark as provider-confirmed
- allow visible notice:

```text
Aus öffentlichen Daten übernommen. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen.
```

## Pilgrim Feedback

Pilgrim feedback is valuable later, but not the primary truth in the MVP.

Rules:

- feedback can create `disputed`, `correction_suggested`, or `needs_review`
- feedback does not automatically change public data
- admin / review decides later
- repeated consistent feedback may influence confidence, but not blindly

## Legal / Communication Rule

This ADR is not legal advice.

Architecture rules:

- Use only data that can be documented with a source.
- Do not adopt third-party closed data sets without explicit permission.
- Do not make partnership claims without confirmation.
- Do not make medical or safety-critical guarantees.
- Data source and data responsibility must be visible or at least internally auditable.

## Data Source Labels / i18n

German, English, and Spanish are mandatory from the start.

This applies to:

- data source labels
- trust / verification status
- disclaimers
- provider notices
- Ultreia pre-filled notices
- public data notices
- pilgrim feedback notices
- admin / diagnostics text when visible

Conceptual labels:

Provider-confirmed data:

- DE: "Vom Anbieter gepflegt. Bitte Angaben vor Ort prüfen."
- EN: "Maintained by the provider. Please check details on site."
- ES: "Gestionado por el proveedor. Comprueba los detalles en el lugar."

Initial data pre-filled by Ultreia:

- DE: "Von Ultreia vorab eingepflegt. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen."
- EN: "Pre-filled by Ultreia. Not yet confirmed by the provider. Please check details on site."
- ES: "Prellenado por Ultreia. Aún no confirmado por el proveedor. Comprueba los detalles en el lugar."

Public data source:

- DE: "Aus öffentlichen Daten übernommen. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen."
- EN: "Taken from public data. Not yet confirmed by the provider. Please check details on site."
- ES: "Tomado de datos públicos. Aún no confirmado por el proveedor. Comprueba los detalles en el lugar."

Uncertain data:

- DE: "Angaben unsicher. Bitte vor Ort oder direkt beim Anbieter prüfen."
- EN: "Information uncertain. Please check on site or directly with the provider."
- ES: "Información incierta. Comprueba en el lugar o directamente con el proveedor."

These are conceptual labels, not final copy.

## Data Ingestion v1

ADR-0016 does not decide a concrete import implementation.

MVP-suitable sequence:

1. Prepare route / test route.
2. Create local test POIs / test Services manually.
3. Define a small curated Camino Frances initial data set.
4. Add `sourceType`, `confidence`, and `verificationStatus` to POIs / Services.
5. Make admin / diagnostics usable.
6. Later use OSM / public data as support.
7. Later enable provider claiming.

## Prioritized NeedCategories For Initial Data

High priority:

- `sleep`
- `water`
- `eat`
- `grocery`
- `pharmacy`
- `medical`
- `transport`

Medium priority:

- `laundry`
- `cash`
- `gear`
- `stamp`

Lower priority:

- `sightseeing`
- `quiet_place`

Need prioritization for data filling is not identical to push priority, but should be compatible with ADR-0015.

## MVP Data Scope

The MVP should support the full Camino Frances as geographic frame.

Data coverage may be thin at the beginning.

Rule:

Thin, honest data coverage is better than broad, unclear, or falsely communicated data quality.

## Development / Test Anchor

The local Development/Test Route is a mandatory part of the data strategy.

Test data must allow:

- local test POIs / test Services around the current GPS position of the test phone
- test data with `dataScope` `local_test`
- test data in `development` / `staging`
- the same data structure as real Camino data
- the same matching / push / diagnostics pipeline
- clear separation from real Camino data

Test data may:

- be used actively for local verification
- trigger pushes when test mode is active
- feed admin / diagnostics

Test data must not:

- appear publicly as real Camino content
- overwrite real Camino data
- simulate provider claiming or real provider status without clear marking

## Admin / Review Requirements

Future admin / ops functions must make data quality manageable.

Admin must later see / manage:

- source
- `sourceUrl`
- confidence
- verificationStatus
- `lastVerifiedAt`
- dataScope
- environmentScope
- visibilityStatus
- disputed / feedback status
- provider-confirmed vs Ultreia-prefilled vs public data
- claim / correction / removal request status
- why a POI / Service is publicly visible or not

## Relationship to Other ADRs

- ADR-0010 defines Route, Segment, RouteKm, Corridor, and Development/Test Route.
- ADR-0011 defines Pilgrim Identity / Auth / Onboarding.
- ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim.
- ADR-0013 defines distance strategy with RouteKm, corridor, and Walking Directions.
- ADR-0014 defines Matching v1.
- ADR-0015 defines Notification Policy, Cooldowns, data / guarantee communication, and i18n for notifications.
- ADR-0016 defines MVP Data Source Strategy.
- ADR-0019 remains open and will define full provider claiming, including verification, claim review, roles, rights, abuse protection, and provider frontend.

## Non-Goals

- No implementation
- No import code
- No production data ingestion
- No scraper
- No full MongoDB schema implementation
- No provider frontend
- No full claiming implementation
- No legal assessment of individual sources
- No DNS change
- No database mutation
- No deploy
- No infrastructure change
- No secrets

## Relationship to StepsMatch

StepsMatch may provide technical learnings for diagnostics, test data handling, and field-test workflows.

Ultreia must not copy StepsMatch data, provider logic, product semantics, branding, or to-dos.

Ultreia's data source strategy remains Camino-specific and trust-first.

## Consequences

Future data work must treat source, confidence, verification, scope, and visibility as first-class fields.

Provider onboarding can improve data later, but does not block the MVP.

Pre-filled provider entries need an early claim, correction, and remove / opt-out request path without implying provider confirmation.

Test data must be deliberately separated from real Camino data from the beginning.
