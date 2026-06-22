# ADR-0012: POI / Service / Provider Data Model

Status: Accepted
Date: 2026-06-22

## Context

Ultreia must model route-relevant places, pilgrim-facing services, provider accounts, provider profiles, and later claims without creating false partner signals or blocking the MVP on provider onboarding.

ADR-0010 defines Route, Segment, RouteKm, Corridor, and development/test routes. ADR-0011 defines pilgrim identity, auth, and onboarding. ADR-0013 defines route-first distance strategy with RouteKm, corridor, and walking directions.

The MVP needs a curated, neutral data basis along the Camino Frances, while still allowing later provider participation and clean test data separation.

## Decision

Ultreia strictly separates:

- POI
- Service
- ProviderAccount
- ProviderProfile
- Claim

Core principle:

POI != Service != Provider

## Terms

### POI

A POI is a concrete physical place along or near a route.

It describes where something is.

The POI is route-relevant. Address, coordinates, route context, RouteKm, distance from the Camino, and directions context belong primarily to the POI, not generally to the provider.

### Service

A Service describes which concrete pilgrim value a POI may provide.

It answers what may be available there for a Need.

Examples:

- sleep
- eat
- water
- grocery
- pharmacy
- medical help
- cash
- stamp
- gear
- laundry
- sightseeing
- quiet place
- transport

Services are assigned to NeedCategories from `shared/taxonomy/`.

Backend, mobile, public web, provider frontend, and admin must not maintain duplicate category lists.

### ProviderAccount

A ProviderAccount is the login / operator account.

It is used for auth, access, roles, and management.

### ProviderProfile

A ProviderProfile contains real master data for an operator or business.

This can include name, description, contact, languages, photos/logo, and optional address data.

The route-relevant location address belongs to the POI.

A provider address may also exist, for example as operator, billing, contact, or public main address.

A provider may manage or claim zero, one, or multiple POIs.

### Claim

A Claim describes that a provider has requested or received management or confirmation rights for a POI.

Claiming comes later and must not block the MVP.

## MVP Principle

A POI may exist without a Provider.

A Service may exist without a claimed Provider.

Provider claiming is not required for the MVP.

## Conceptual Fields

### POI

- `id`
- `name`
- `realAddress`
- `location.lat`
- `location.lng`
- `geocodingStatus`: `ungeocoded` | `geocoded` | `failed` | `manual_verified`
- `geocodedAt` optional
- `routeContext.nearestRouteId`
- `routeContext.nearestSegmentId`
- `routeContext.routeKm`
- `routeContext.distanceFromRouteMeters`
- `addressLine` optional
- `postalCode` optional
- `locality` optional
- `region` optional
- `country`
- `publicInfoText` optional
- `photos` optional
- `source`
- `sourceUrl` optional
- `sourceType`: `manual` | `osm` | `official_website` | `provider_claim` | `pilgrim_feedback` | `other`
- `confidence`: `low` | `medium` | `high`
- `lastVerifiedAt` optional
- `verificationStatus`: `unverified` | `curated` | `provider_confirmed` | `disputed`
- `dataScope`: `real_camino` | `local_test`
- `environmentScope`: `production` | `staging` | `development`
- `visibilityStatus`: `draft` | `active` | `hidden` | `archived`
- `createdAt`
- `updatedAt`

### Service

- `id`
- `poiId`
- `needCategory`
- `serviceLabel`
- `description` optional
- `openingHours` optional
- `openingHoursOverride` optional
- `seasonalAvailability` optional
- `languages` optional
- `priceInfo` optional
- `availabilityNote` optional
- `photos` optional
- `disclaimerLevel`: `normal` | `uncertain` | `sensitive`
- `confidence`: `low` | `medium` | `high`
- `lastVerifiedAt` optional
- `verificationStatus`: `unverified` | `curated` | `provider_confirmed` | `disputed`
- `visibilityStatus`: `draft` | `active` | `hidden` | `archived`
- `createdAt`
- `updatedAt`

### ProviderAccount

- `id`
- `email`
- `authProvider` optional
- `roles`
- `status`: `active` | `disabled` | `pending`
- `preferredLanguage`
- `createdAt`
- `updatedAt`

### ProviderProfile

- `id`
- `accountId`
- `legalName` optional
- `displayName`
- `description` optional
- `contactEmail` optional
- `phone` optional
- `website` optional
- `languagesSpoken` optional
- `logo` optional
- `photos` optional
- `publicAddress` optional
- `adminAddress` optional
- `billingAddress` optional
- `primaryPoiId` optional
- `verificationStatus`: `unverified` | `pending` | `verified` | `rejected`
- `createdAt`
- `updatedAt`

### Claim

- `id`
- `providerId`
- `poiId`
- `status`: `pending` | `approved` | `rejected` | `revoked`
- `evidence` optional
- `reviewedAt` optional
- `reviewedBy` optional
- `createdAt`
- `updatedAt`

## MVP Rules

- POIs can be manually curated or imported later.
- Services are assigned to NeedCategories from `shared/taxonomy/`.
- Every public entry needs a source and confidence level.
- Uncertain data must be visible and manageable.
- Opening hours, availability, free beds, prices, or medical safety must not be guaranteed.
- Opening hours may be modeled at POI or Service level.
- Service opening hours override or refine POI opening hours when they differ.
- Test POIs must be clearly separated from real Camino data.
- Local development/test routes and test POIs must never appear publicly as real Camino content.
- Photos are allowed, but must be clearly assigned to a POI, Service, or ProviderProfile.
- Provider master data matters, but is not automatically identical to a route-relevant location.

## Routing Rule

RouteKm, segment, corridor, Google walking directions, and distance calculation primarily refer to POI locations.

ProviderProfile may have an address, but that address is not automatically the pilgrim destination.

For navigation and matching, the concrete POI or Service location counts.

## Rationale

The MVP must not be blocked by provider onboarding.

Ultreia first needs a curated, neutral data basis along the Camino Frances.

Provider claiming comes later.

The model must separate public / curated POIs, later provider entries, test data, and pilgrim feedback.

The model must not create false partner effects.

Route-first matching needs stable location data on the POI.

Providers may later have multiple locations, secondary locations, or different services.

## Boundaries

ProviderAccount and PilgrimUser remain strictly separate.

ProviderProfile and POI remain separate.

Provider claiming comes later and must not block the MVP.

Pilgrim feedback may later improve data quality, but it is not the primary source of truth.

This ADR decides the conceptual data model, not the final MongoDB schema.

## Non-Goals

- No full MongoDB schema implementation
- No import implementation
- No provider frontend implementation
- No claiming implementation
- No production data ingestion
- No matching logic decision; that follows in ADR-0014
- No Google Directions as the primary matching engine; that is ADR-0013
- No secrets
- No deploy

## Relationship to StepsMatch

StepsMatch may provide technical learnings for provider/place creation patterns, logging, diagnostics, and field tests.

Ultreia must not copy StepsMatch provider logic, categories, demo data, Graz test data, partner semantics, or offer wording.

Ultreia's POI, Service, ProviderAccount, ProviderProfile, and Claim model remains Camino-specific.

## Consequences

Future backend and admin work must model POIs, Services, ProviderAccounts, ProviderProfiles, and Claims as separate concepts.

Route context belongs primarily to POIs.

Services must consume NeedCategories from `shared/taxonomy/`.

Provider claiming can be added later without blocking the MVP data basis.
