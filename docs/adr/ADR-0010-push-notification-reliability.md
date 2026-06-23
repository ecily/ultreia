# ADR-0010: Push Notification Reliability Learning

Status: Accepted
Date: 2026-06-23

## Context

Ultreia depends on push notifications as core infrastructure. Pilgrims walk with the phone in a pocket or backpack and should not need to constantly watch the app.

StepsMatch has been used as a technical lab for Android notification delivery. A strong Android notification channel for real nearby / match notifications was tested successfully there.

This ADR documents the learning for Ultreia. It is not a code transfer, not a configuration transfer, and not an adoption of StepsMatch product logic.

## StepsMatch Learning

The StepsMatch lab verified that a technically strong Android channel can make relevant match notifications physically more noticeable.

Observed technical properties:

- versioned strong channel: `stepsmatch-nearby-attention-v1`
- importance `5` / `MAX`
- sound configured
- vibration pattern `[0, 500, 180, 500, 180, 900]`
- Android `NotificationRecord` uses the expected channel
- local / ADB test trigger is reproducible

The test notification was isolated from real offer navigation:

- test payload uses `kind`, `testOnly`, and `noNavigation`
- no `offerId`
- no placeholder ID such as `:id`
- no incorrect navigation to `/offers/:id`
- no backend or database dependency

These details are recorded as architecture and product learning only. Ultreia must design and implement its own notification infrastructure.

## Decision

Ultreia treats push reliability as product-critical infrastructure, not as marketing delivery.

Future Ultreia push implementation must support clearly separated channel classes:

- `critical_need`
- `normal_need`
- `discovery_silent`
- `diagnostics_test`

Critical Needs may include:

- `medical_help`
- `pharmacy`
- `water`
- `sleep` later in the day

Discovery and sightseeing notifications must not use loud or attention-grabbing channels by default.

Test and diagnostics notifications must never be processed like real Place, Service, Need, or navigation notifications.

## Payload Principles

Notification response handlers need explicit payload types.

Rules:

- no navigation without a valid target ID
- no placeholder IDs such as `:id` in navigable payloads
- no fallback navigation to fake detail routes
- diagnostics payloads must be marked as diagnostics / test only
- diagnostics payloads must be non-navigating unless a dedicated diagnostics screen exists
- real Need / Place / Service payloads must carry valid IDs for their intended target
- payload type and navigation target must be validated before opening any screen

## i18n Consequences

ADR-0005 applies to push notifications.

Ultreia push titles, bodies, local notification texts, permission explanations, diagnostics labels, and visible error states must support:

- `de`
- `en`
- `es`

Push texts must use message keys and parameters, not hardcoded single-language strings.

Medical, pharmacy, water, sleep, and other high-relevance notifications require especially cautious and clean translations.

## Diagnostics And Testing

Ultreia needs objective technical verification for push delivery:

- test trigger can be executed locally / in staging
- test notification can be sent without backend or database dependency when needed
- Android channel ID can be verified from platform diagnostics
- delivery can be checked with app closed and screen off
- notification response can be tested without navigating to fake content
- diagnostics events must identify test notifications as test notifications

Codex and local automation can verify technical delivery and payload handling.

Physical perceptibility must later be tested on real devices in field-like conditions. Codex cannot objectively validate whether a pilgrim will notice a notification while walking.

## Relationship To Notification Policy

ADR-0015 decides whether a MatchEvent may become a push notification.

This ADR adds a reliability layer:

- the push channel must fit the urgency class
- diagnostics must prove the channel used by the OS
- test payloads must not contaminate real navigation flows
- response handling must be type-safe at the payload level

Matching, push policy, channel selection, and response handling remain separate concerns.

## Relationship To StepsMatch

StepsMatch remains a technical reference / lab only.

Ultreia does not copy:

- StepsMatch files
- StepsMatch notification channel names
- StepsMatch configuration
- StepsMatch offer navigation
- StepsMatch payload schema as product schema
- StepsMatch backend or database behavior

Ultreia uses only the learning that strong notification channels, isolated diagnostics triggers, and strict payload typing are necessary for reliable pilgrim-facing push behavior.

## Non-Goals

- No implementation
- No mobile code
- No backend code
- No final channel IDs
- No final vibration pattern for Ultreia
- No final notification copy
- No database schema
- No migration
- No deploy
- No push to a remote repository
- No DNS change
- No database mutation
- No secrets
- No copying of StepsMatch files

## Consequences

Future Ultreia implementation must define its own notification channel classes and payload contracts.

Critical Need notifications may be attention-grabbing only when policy, user settings, permissions, data quality, and context justify it.

Discovery / sightseeing must remain quiet.

Diagnostics notifications must be isolated from real Place / Service / Need handling.

No notification response may navigate without a valid, typed target ID.
