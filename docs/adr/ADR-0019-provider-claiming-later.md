# ADR-0019: Provider Claiming Later / Provider Self-Service

Status: Accepted
Date: 2026-06-22

## Context

ADR-0016 already defines an early, simple claim / correction / remove / opt-out path for pre-filled Providers / POIs.

That early path is MVP-near and allows real operators to request correction, claim, removal, or deactivation when Ultreia has pre-filled a Provider / POI.

ADR-0019 defines the later full Provider Claiming and Provider Self-Service system.

Provider Claiming is product value, but also an abuse risk. It therefore needs verification, roles, rights, review, auditability, and cautious communication.

## Decision

Ultreia distinguishes between:

1. Early simple claim / correction / remove / opt-out path from ADR-0016.
2. Later full Provider Claiming and Provider Self-Service system from ADR-0019.

ADR-0019 decides the full later expansion for verified providers:

- provider onboarding
- claim review
- roles / rights
- master data maintenance
- Service / Offer management
- abuse protection
- clear communication

Core principle:

Providers may later maintain their own data, Services, and Offers, but only after clean verification and clear separation from:

- data pre-filled by Ultreia
- public / curated data
- provider-confirmed data
- disputed / uncertain data
- `local_test` data

## Provider Value

Provider onboarding must clearly explain why a confirmed Provider Account is useful:

- Provider can keep master data current.
- Provider can maintain opening hours, availability, photos, descriptions, and Service hints.
- Provider can later create and maintain Offers / Services.
- Provider can configure desired radius / route relevance where the system allows it.
- Ultreia does not broadcast to all users, but can reach pilgrims with matching Need and route context.
- Ultreia can alert matching pilgrims to relevant Offers / hints.
- Ultreia can guide pilgrims by Directions / route to the concrete POI / Service location.
- This can reduce waste compared with classic advertising.
- Provider-maintained data can receive a higher trust level.

Allowed wording:

```text
Mit einem bestätigten Provider-Konto können Sie Ihre Informationen und Angebote selbst aktuell halten. Ultreia kann passende Pilger im richtigen Wegkontext auf relevante Angebote hinweisen und sie per Route zum Standort führen.
```

Not allowed:

```text
Wir bringen garantiert Pilger zu Ihrem Geschäft.
Sie erreichen garantiert alle Pilger in der Nähe.
Ihr Angebot wird garantiert gepusht.
Wir garantieren mehr Umsatz.
Offizieller Partner.
```

The last statement is only allowed when official partner status is actually confirmed.

## No Guarantees

Provider onboarding, Provider Frontend, and public communication must not guarantee:

- number of pilgrims reached
- revenue
- visibility
- push delivery
- ranking
- free beds
- availability
- prices
- opening hours
- medical safety

## ProviderAccount

ProviderAccount is the login / operator account.

It remains separate from PilgrimUser.

Conceptual fields:

- `id`
- `email`
- `authProvider` optional
- `roles`
- `status`: `active` | `disabled` | `pending`
- `preferredLanguage`
- `createdAt`
- `updatedAt`

## ProviderProfile

ProviderProfile contains operator / business master data.

Conceptual fields:

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

Routing-relevant location data belongs primarily to the POI, not generally to ProviderProfile.

ProviderProfile may have a public operator address, admin address, or billing address.

Directions and Matching use the concrete POI / Service location.

## Claim

Claim describes that a Provider requests or receives management / confirmation rights for a POI.

Conceptual fields:

- `id`
- `providerId`
- `poiId`
- `status`: `pending` | `approved` | `rejected` | `revoked`
- `evidence` optional
- `reviewedAt` optional
- `reviewedBy` optional
- `createdAt`
- `updatedAt`

Conceptual claim / request statuses:

- `claim_pending`
- `approved`
- `rejected`
- `revoked`
- `correction_requested`
- `removal_requested`
- `hidden_by_request`
- `provider_confirmed`

## Claim Process v1

Conceptual flow:

1. Provider finds own entry or is invited through a claim link.
2. Provider creates ProviderAccount.
3. Provider confirms email.
4. Provider sees a clear notice:
   - entry was pre-filled by Ultreia or taken from a public source
   - entry is not yet provider-confirmed
   - claim enables correction / maintenance
5. Provider requests Claim for POI.
6. Provider submits basic evidence when required.
7. Admin reviews Claim.
8. If approved:
   - Claim becomes approved
   - POI / Services can become provider-confirmed / provider-maintained
   - Provider may maintain defined fields
9. If rejected:
   - Claim becomes rejected
   - data remains unchanged or enters review
10. If remove / opt-out is requested:
   - `removal_requested` or `hidden_by_request`
   - Admin reviews and decides visibility

## Relationship to Early Claim / Remove From ADR-0016

The early simple claim / correction / remove / opt-out path remains MVP-near.

Rules:

- For pre-filled data, Providers must have a simple way to request correction, claim, removal, or deactivation.
- The early path can be simple, for example form / email / admin review.
- Full self-service comes later with ADR-0019 expansion.

## Provider Self-Service Later

After verification, depending on roles / rights, Providers may later maintain:

ProviderProfile:

- `displayName`
- `description`
- contact
- website
- languages
- logo / photos

POI:

- address / contact data, proposed or maintained when authorized
- photos
- `publicInfoText`
- opening hours when POI-wide
- proposed corrections to location data

Services:

- NeedCategory-related Services
- `serviceLabel`
- `description`
- `openingHoursOverride`
- `seasonalAvailability`
- `priceInfo`
- `availabilityNote`
- photos
- `visibilityStatus`

## Offers

ADR-0019 records that provider-maintained Offers should be possible later.

Conceptual fields:

- `offerId`
- `providerId`
- `poiId`
- `serviceId` optional
- `title`
- `description`
- `needCategory`
- `priceInfo` optional
- `validFrom` optional
- `validTo` optional
- radius / route relevance config optional
- `availabilityNote` optional
- photos optional
- language variants DE / EN / ES
- `visibilityStatus`
- source / providerMaintained
- `createdAt`
- `updatedAt`

Offers may influence Matching / Push, but push delivery remains controlled by ADR-0014 and ADR-0015.

The Provider cannot force pilgrims to receive push notifications.

The system decides based on Need, route context, data quality, cooldowns, and policy.

## Radius / Route Relevance

Providers may later configure desired reach / route relevance where system rules allow it.

Rules:

- No arbitrary broadcast.
- No push advertising without active Need.
- No bypassing cooldowns.
- No push to unsuitable pilgrims.
- No false route context.
- No visibility outside allowed environment / DataScope.

Allowed wording:

```text
Angebote können so konfiguriert werden, dass sie im passenden Wegkontext berücksichtigt werden.
```

Not allowed:

```text
Sie wählen frei einen Radius und erreichen alle Pilger.
```

## Abuse Protection

Provider Claiming needs protection against:

- claiming someone else's POIs
- fake Providers
- false addresses
- misleading prices / availability
- spam Offers
- aggressive push intent
- false medical / safety-critical statements
- false partner claims

ADR-0019 decides the conceptual full Claiming expansion.

The exact implementation of verification, review UI, roles, and moderation can be specified later.

## Admin / Review

Admin must later see / manage:

- Claim requests
- ProviderAccount
- ProviderProfile
- claimedPoiIds
- evidence
- Claim status
- correction requests
- removal / opt-out requests
- disputed data
- provider-confirmed vs Ultreia-prefilled vs public data
- change history
- who changed what

## Audit

Provider changes should be auditable:

- `changedBy`
- `changedAt`
- `previousValue` optional
- `newValue` optional
- `reviewStatus` optional

## Data Trust

Provider-confirmed data receives a higher trust level, but no guarantee.

Visible communication:

- DE: "Vom Anbieter gepflegt. Bitte Angaben vor Ort prüfen."
- DE: "Von Ultreia vorab eingepflegt. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen."
- DE: "Aus öffentlichen Daten übernommen. Noch nicht vom Anbieter bestätigt. Bitte Angaben vor Ort prüfen."
- DE: "Angaben unsicher. Bitte vor Ort oder direkt beim Anbieter prüfen."

These are conceptual German labels. DE / EN / ES variants remain required where visible.

## i18n / Languages

German, English, and Spanish are mandatory from the start.

This applies to:

- Provider onboarding
- Provider Frontend
- Claim forms
- remove / opt-out forms
- status messages
- data source labels
- responsibility labels
- disclaimers
- Offer / Service fields when publicly visible
- push / notification-relevant Offer data
- Admin-visible labels when shown in UI

No hardcoded single-language Provider text.

Provider should later be able to maintain content in DE / EN / ES or at least use a fallback model.

ADR-0019 does not implement final translation rules, but makes i18n capability mandatory.

## Privacy / Security

Rules:

- do not show secrets
- only show Provider contact data publicly according to purpose / settings
- do not automatically expose admin / billing addresses publicly
- strictly separate ProviderAccount and PilgrimUser
- protect access to Provider Frontend
- do not show Claim evidence publicly
- prevent abuse and false Claims

## Relationship to Existing ADRs

- ADR-0010 defines Route, Segment, RouteKm, Corridor, and Development/Test Route.
- ADR-0011 defines Pilgrim Identity / Auth / Onboarding.
- ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim.
- ADR-0013 defines distance strategy with RouteKm, corridor, and Walking Directions.
- ADR-0014 defines Matching v1.
- ADR-0015 defines Notification Policy, Cooldowns, data / guarantee communication, and i18n for notifications.
- ADR-0016 defines MVP Data Source Strategy, including early claim / correction / remove / opt-out path.
- ADR-0017 defines Mobile MVP Scope.
- ADR-0018 defines Admin and Diagnostics v1.
- ADR-0019 defines Provider Claiming Later / Provider Self-Service.

## Non-Goals

- No implementation
- No Provider Frontend
- No Claiming code
- No Auth code
- No Offer code
- No full MongoDB schema implementation
- No production data import
- No final onboarding copy
- No payment / billing logic
- No ads / auction / ranking model
- No DNS change
- No database mutation
- No deploy
- No infrastructure change
- No secrets

## Consequences

Future Provider features must distinguish early claim / remove requests from verified Provider self-service.

Provider-maintained content can improve trust and freshness, but must never bypass Matching, Notification Policy, cooldowns, DataScope, or route context.

Provider-facing UX and public communication must be multilingual and cautious, without guarantees of reach, revenue, visibility, push delivery, availability, prices, opening hours, or medical safety.
