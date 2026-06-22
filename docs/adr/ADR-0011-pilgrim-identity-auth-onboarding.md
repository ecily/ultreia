# ADR-0011: Pilgrim Identity, Auth and Onboarding

Status: Accepted
Date: 2026-06-22

## Context

Ultreia is a calm Camino companion for pilgrims. The MVP needs personalization, onboarding state, push behavior, and field-test diagnostics across mobile and web/frontend surfaces.

ADR-0003 defines the Camino Frances MVP scope. ADR-0005 requires German, English, and Spanish from project start. ADR-0006 defines data model principles. ADR-0008 defines shared taxonomy as the source for static product configuration.

Without a pilgrim identity, Ultreia cannot reliably persist selected needs, permissions, disclaimer acceptance, device binding, or notification dedupe state.

## Decision

Ultreia needs its own pilgrim identity from the MVP onward, with registration, login, and onboarding for mobile and web/frontend.

The pilgrim account is not a social feature. It is the technical basis for:

- personalization
- onboarding state
- push and device binding
- disclaimer and terms acceptance
- notification dedupe
- field-test diagnostics

## MVP Purpose

The MVP pilgrim identity must support storing:

- selected language: `de`, `en`, or `es`
- active Needs
- location permission status
- push permission status
- push token / device binding
- disclaimer / terms acceptance
- already seen hints / notification dedupe state
- field-test / diagnostic assignment

## Separation

PilgrimUser and ProviderUser remain strictly separate.

Provider claiming comes later and is not part of the pilgrim identity decision.

The pilgrim account must not introduce provider ownership, social profiles, or marketplace logic in the MVP.

## Mobile MVP Requirements

The mobile MVP needs:

- registration / login
- language selection
- disclaimer flow
- location permission flow
- push permission flow
- Need selection
- diagnostic mode for field tests

## Web / Frontend MVP Requirements

The web/frontend MVP needs at least:

- pilgrim registration / login or account access
- basic profile / account data
- privacy and disclaimer context
- later optional planning or profile settings

## Non-Goals

- No provider claiming
- No social graph
- No provider account implementation
- No backend implementation in this ADR
- No mobile implementation in this ADR
- No database schema in this ADR
- No secrets
- No deploy

## Relationship to StepsMatch

StepsMatch may provide technical learnings about push tokens, diagnostics, onboarding, and field-test behavior.

Ultreia must not copy StepsMatch user data, provider logic, account semantics, branding, or production implementation blindly.

## Consequences

Future backend, mobile, and frontend work must model pilgrim identity as a first-class product foundation.

Authentication and onboarding choices must preserve the strict separation between pilgrim users and provider users.

Push and diagnostic implementation must be designed around explicit consent, language, selected needs, and dedupe state.
