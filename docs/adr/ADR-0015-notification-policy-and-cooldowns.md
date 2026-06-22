# ADR-0015: Notification Policy and Cooldowns

Status: Accepted
Date: 2026-06-22

## Context

Ultreia must be useful without becoming noisy. Pilgrims want to walk, not constantly manage their phone.

ADR-0014 decides whether a POI / Service is relevant enough to become a MatchEvent. A MatchEvent is not automatically a push notification.

StepsMatch has positively tested the technical heartbeat-to-push pipeline. Ultreia uses that technical pattern as reference, but keeps its own route-first matching, taxonomy, data model, i18n rules, documentation, and branding.

## Decision

Ultreia strictly separates matching and push.

ADR-0014 decides whether something is functionally relevant.

ADR-0015 decides whether, when, and how that Match may become a push notification.

Core principle:

Ultreia must not annoy pilgrims.

Push is allowed only when the hint is plausibly useful now for the pilgrim's active Need.

## Push Is Not Allowed For

Push must not be used for:

- generic advertising
- nearby hints without an active Need
- unclear or weak matches
- content with too-low data quality
- false guarantees
- excessive repetition
- false partner effects

## Push Is Allowed When

Push may be sent when:

- an active Need is set
- a MatchEvent has high enough score
- POI / Service is meaningfully ahead of the pilgrim
- RouteKm / corridor are plausible
- walking distance / duration is available or plausibly inferable
- data quality is sufficient
- cooldowns do not apply
- daily limit is not exceeded
- push permission is active
- push token is valid
- user is not in silence / pause mode

## Push Must Be Suppressed When

Push must be suppressed when:

- no active Needs are set
- Match is uncertain or too weak
- POI is clearly behind the pilgrim
- route is unknown
- location quality is poor
- direction is unclear and relevance is not robust
- data status is disputed, hidden, or archived
- same or similar notification was recently sent
- global cooldown is active
- Need cooldown is active
- POI / Service cooldown is active
- daily limit is reached
- user disabled push
- app / system status does not allow push

## Need Classes For MVP

High push relevance:

- `water`
- `sleep`
- `pharmacy`
- `medical`
- `grocery`
- `eat`
- `transport`

Only with explicit Need and cautious handling:

- `laundry`
- `gear`
- `cash`
- `stamp`

Usually not automatic push:

- `sightseeing`
- `quiet_place`

High push relevance does not mean automatic push. Score, data quality, distance, cooldowns, and user status always apply.

## Cooldown Concept

The MVP requires multiple cooldown layers:

1. Global Cooldown
   - prevents too many pushes overall
   - example concept: no new push shortly after a previous push
2. Need Cooldown
   - prevents too many pushes for the same Need
   - example: water hints should not repeat constantly
3. POI / Service Cooldown
   - prevents duplicate hints for the same place or Service
4. Daily Push Limit
   - limits pushes per day
5. Silence / Pause Mode
   - allows pilgrims to temporarily reduce or pause push notifications

Concrete minute / hour values are not decided in this ADR.

Cooldowns are mandatory and should remain configurable at implementation time.

## Data Display Versus Guarantee

Ultreia may display prices, opening hours, seasonal availability, provider information, photos, Service descriptions, and offer details when these data are stored.

This applies to:

- provider-maintained data
- initial data pre-filled by Ultreia
- manually curated data
- public data sources
- later pilgrim feedback, when approved / verified

Ultreia does not guarantee these data.

Rules:

- Data source must be visible or manageable.
- Responsibility must be communicated clearly.
- Confidence / verification status must be modeled internally.
- Freshness / `lastVerifiedAt` should be used when available.
- Data pre-filled by Ultreia must be recognizable as not provider-confirmed.
- Provider-confirmed data may be marked provider-maintained / provider-confirmed.
- Public or curated data must remain recognizable as such.
- Uncertain data must use cautious wording.

## Conceptual Data Responsibility Labels

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

## Push Wording With Data

Allowed examples:

- "Albergue in ca. 1,2 km am Weg. Laut hinterlegten Angaben ab 14:00 geöffnet. Bitte prüfen."
- "Menü um 12 EUR bei Casa Camino. Angabe vom Anbieter, bitte vor Ort prüfen."
- "Apotheke in ca. 900 m am Weg. Öffnungszeiten laut verfügbaren Daten. Bitte prüfen."

Not allowed:

- "Albergue ist geöffnet und hat Betten frei."
- "Menü kostet garantiert 12 EUR."
- "Apotheke ist sicher geöffnet."
- "Offizieller Partner", unless confirmed.
- "Garantiert verfügbar."

## Guarantee Ban

Push text must never guarantee:

- opening hours
- free beds
- availability
- prices
- medical safety
- completeness of data
- official partnership when no provider has confirmed it

Allowed cautious wording:

- "liegt voraussichtlich am Weg"
- "bitte Details prüfen"
- "laut verfügbaren Daten"
- "laut hinterlegten Angaben"
- "vom Anbieter gepflegt"
- "noch nicht vom Anbieter bestätigt"
- "möglicherweise geöffnet"
- "Angaben ohne Gewähr"

Not allowed wording:

- "ist geöffnet"
- "Bett verfügbar"
- "garantiert"
- "sicher"
- "bester"
- "offizieller Partner", unless confirmed

## NotificationEvent Concept

NotificationEvent should conceptually include:

- `id`
- `pilgrimUserId`
- `matchEventId` optional
- `routeId`
- `segmentId` optional
- `poiId` optional
- `serviceId` optional
- `needCategory`
- `policyDecision`: `send` | `suppress`
- `suppressReasons` optional
- `score`
- `confidence`
- `cooldownState`
- `pushTokenStatus`
- `locale`
- `messageKey`
- `messageParams`
- `renderedTitle` optional
- `renderedBody` optional
- `dataSourceLabel` optional
- `dataResponsibilityLabel` optional
- `providerVerificationStatus` optional
- `provider`: `expo` | `fcm` | `apns` | `other`
- `providerMessageId` optional
- `deliveryStatus`: `queued` | `sent` | `failed` | `unknown`
- `errorCode` optional
- `dataScope`
- `environmentScope`
- `createdAt`

## Suppress / Diagnostic Reasons

Standard suppress reasons:

- `no_active_need`
- `score_too_low`
- `low_confidence`
- `route_unknown`
- `direction_unclear`
- `outside_corridor`
- `behind_pilgrim`
- `distance_not_plausible`
- `data_disputed`
- `hidden_or_archived`
- `already_seen`
- `global_cooldown`
- `need_cooldown`
- `poi_cooldown`
- `daily_limit_reached`
- `push_permission_missing`
- `push_token_missing`
- `push_token_invalid`
- `user_silenced`
- `environment_scope_mismatch`
- `data_scope_mismatch`
- `provider_send_failed`

## i18n / Languages

German, English, and Spanish are mandatory from the start.

This applies to:

- mobile app
- web / frontend
- provider frontend
- push text
- notification title
- notification body
- Need labels
- disclaimers
- data source labels
- responsibility labels
- uncertainty wording
- visible system text
- visible diagnostics / status reasons when shown in UI

Push text must not be single-language or hardcoded in matching / push code.

Notification Policy uses:

- `messageKey`
- `locale`
- `messageParams`
- optional `renderedTitle` / `renderedBody` for audit / diagnostics

Conceptual message keys:

- `notification.water_ahead`
- `notification.sleep_ahead`
- `notification.pharmacy_ahead`
- `notification.match_uncertain`
- `notification.check_details`
- `notification.provider_maintained`
- `notification.pre_filled_by_ultreia`
- `notification.public_data_unconfirmed`

Conceptual example:

`messageKey`: `notification.water_ahead`

Params:

- `distance`
- `placeName`
- `confidenceLabel`
- `dataResponsibilityLabel`

DE:

```text
Wasserstelle in ca. {distance} am Weg. {dataResponsibilityLabel}
```

EN:

```text
Water point in about {distance} on the route. {dataResponsibilityLabel}
```

ES:

```text
Punto de agua a unos {distance} en el camino. {dataResponsibilityLabel}
```

This ADR makes the i18n principle binding, but does not finalize copy.

## Push Priority

The MVP may conceptually use priority classes.

High:

- `medical`
- `pharmacy`
- `water` with active Need
- `sleep` with active Need and fitting time of day

Normal:

- `eat`
- `grocery`
- `transport`
- `laundry`
- `gear`
- `cash`

Low:

- `stamp`
- `sightseeing`
- `quiet_place`

Priority may influence thresholds, but must not fully override cooldowns or data quality.

## Time Of Day Context

Push Policy may consider time of day.

Examples:

- `sleep` becomes more relevant toward evening
- `grocery` / `eat` depend on time of day
- `pharmacy` / `medical` can be prioritized
- `sightseeing` should usually not push without an active Need

## Development / Test Anchor

Notification Policy must be testable in development / staging with a local test route and local test POIs.

Test mode must support:

- real GPS heartbeats from the test phone
- real MatchEvents
- real NotificationEvents
- real push triggering
- push when the app is closed
- push when the screen is off
- diagnostics explaining why push was sent or suppressed
- clear separation of `local_test` and `real_camino`

## StepsMatch Reference

The technical heartbeat / push pipeline was positively tested in StepsMatch and remains a reference:

- background location sends location / heartbeat
- backend receives location
- backend compares against relevant places / services
- match is detected
- push is triggered
- push arrives even when the app is closed and the screen is off
- logging / diagnostics verify the flow

Ultreia adopts the technical pattern, not the StepsMatch product logic.

## Relationship to Other ADRs

- ADR-0010 defines Route, Segment, RouteKm, Corridor, and Development/Test Route.
- ADR-0011 defines Pilgrim Identity / Auth / Onboarding.
- ADR-0012 defines POI, Service, ProviderAccount, ProviderProfile, and Claim.
- ADR-0013 defines distance strategy with RouteKm, corridor, and Walking Directions.
- ADR-0014 defines Matching v1.
- ADR-0015 defines Notification Policy, Cooldowns, push decision, data / guarantee communication, and i18n for notifications.

## Non-Goals

- No implementation
- No push code
- No final push text
- No final hardcoded cooldown minutes / hours, except cooldowns as mandatory concept
- No full MongoDB schema implementation
- No production data ingestion
- No provider frontend
- No DNS change
- No database mutation
- No deploy
- No infrastructure change
- No secrets

## Consequences

Future push implementation must use NotificationEvents, suppress reasons, cooldown state, and i18n message keys.

Notification copy must stay cautious, multilingual, and free of guarantees.

Matching and push policy remain separate stages.

Development and staging must verify the full heartbeat, match, notification decision, delivery, and diagnostics pipeline.
