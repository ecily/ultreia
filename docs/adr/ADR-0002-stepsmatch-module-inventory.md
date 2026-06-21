# ADR-0002: StepsMatch Module Inventory for Ultreia

Status: Accepted
Date: 2026-06-21

## Context

ADR-0001 decided Option C for Ultreia: selective technical bootstrap from StepsMatch without full copy, rebranding, or blind product transfer.

This ADR records a coarse technical inventory of StepsMatch modules as an architecture analysis only. StepsMatch was inspected as a read-only technical reference under `C:\coding\stepsmatch`.

## Decision

Ultreia will use this inventory to decide later which technical patterns deserve a targeted, Camino-specific reimplementation.

This ADR does not approve copying source files. It only classifies areas as adoption candidates, technical references, or modules that should be newly modeled for Ultreia.

## Scope and Non-Actions

- No StepsMatch files were copied.
- No StepsMatch files were changed.
- No code was created in Ultreia.
- No deploy, push, remote, or secret handling happened.
- This is only an architecture and inventory decision.

## Classification Scale

1. Candidate for targeted adoption
2. Use only as technical reference
3. Do not adopt / model anew

## Inventory

### Backend: Express/Mongo Base Structure

Classification: 1. Candidate for targeted adoption

Observed shape: Express server, Mongoose connection, route modules, model modules, health endpoints, CORS/security middleware, indexes, and operational startup/shutdown patterns.

Benefit for Ultreia: Gives a proven Node/Express/Mongo skeleton with route separation, health checks, geospatial indexes, and basic operational conventions.

Risk: Contains StepsMatch-specific CORS origins, APK redirect behavior, offer poller behavior, DigitalOcean assumptions, legacy compatibility, and product-specific routes.

Camino-specific adaptation: Ultreia needs its own domain model around route, stage, pilgrim need, place, prompt, and notification decision. Express/Mongo structure may be useful, but API boundaries and collections must be named and shaped for Ultreia.

Open checks:

- Define Ultreia API modules before any implementation.
- Decide whether Mongo geospatial indexes are enough for route/stage matching or whether additional route geometry tooling is needed.
- Remove all StepsMatch deployment, domain, and APK assumptions.

### Backend: Auth/User/PushToken

Classification: 1. Candidate for targeted adoption

Observed shape: User model with email/password/JWT flow, email verification, preferences, and push token storage. PushToken model includes deviceId, projectId, platform, validity flags, last seen timestamps, last heartbeat, last location, interests, and GeoJSON validation.

Benefit for Ultreia: PushToken lifecycle and device identity handling are directly relevant. Auth/User patterns may be useful if Ultreia needs accounts, settings, or preference sync.

Risk: Auth flow is provider/user oriented and includes StepsMatch-specific wording, fallback provider creation, test/master-login behavior, and offer-centric preferences. PushToken logic is coupled to Expo project identity and StepsMatch interest categories.

Camino-specific adaptation: Users must map to pilgrims, route context, selected Camino, selected stage, language, privacy consent, notification categories, and offline state. PushToken should keep the robust device/token/last-location idea, but needs Ultreia-specific needs and route context.

Open checks:

- Decide whether MVP requires accounts or can start with anonymous device identity.
- Separate pilgrim preferences from provider/provider-profile assumptions.
- Verify token rotation, project scope, invalid-token self-heal, and privacy retention rules.

### Backend: Heartbeat/Location/OfferVisibility/Matching

Classification: 2. Use only as technical reference

Observed shape: `/location/heartbeat` accepts token, deviceId, projectId, platform, lat/lng, accuracy, speed, interests, and timestamps. It updates PushToken location and runs server-side geofence/radius checks against offers. OfferVisibility tracks seen/notified/dismissed/snoozed/inside/enter/exit/suppress state. Matching is radius, activity window, interest, and dedupe based.

Benefit for Ultreia: The heartbeat contract, location validation, accuracy handling, enter/exit state, suppress windows, and dedupe concepts are valuable.

Risk: The core product model is radius around offers, not Camino route/stage relevance. OfferVisibility is tied to offer IDs and provider offers. Matching currently treats "nearby" as the primary relevance axis.

Camino-specific adaptation: Ultreia must model route geometry, distance to route, detour from route, stage direction, time of day, pilgrim need priority, offline cache, and prompt frequency. Radius-only logic cannot be the final model.

Open checks:

- Define Ultreia "PromptVisibility" or equivalent independent of offers.
- Design route-aware matching before implementing heartbeat-triggered notifications.
- Decide how often the client sends location while preserving battery and trust.

### Backend: Push/Notification/Logs

Classification: 1. Candidate for targeted adoption

Observed shape: Expo push registration, canary/roundtrip endpoints, service-state endpoint, invalid-token self-heal, receipt checks, notification actions, client diagnostic log model, diag routes, and heartbeat diagnostics.

Benefit for Ultreia: Push reliability, token invalidation, canary diagnostics, receipt handling, notification action persistence, and short-lived client logs are strongly relevant for a location/push-heavy Camino app.

Risk: Notification content, channels, categories, and action labels are StepsMatch/offer-specific. Some diagnostic routes expose operational data and need stricter access control. Logging can accidentally include sensitive location or token context if not carefully redacted.

Camino-specific adaptation: Ultreia needs quiet pilgrim-facing notification language, granular need categories, privacy-conscious diagnostics, short retention, token redaction, and prompt-specific actions.

Open checks:

- Define allowed diagnostic payloads and retention before implementation.
- Rework channels/actions around Camino prompts, not offers.
- Review push frequency controls against Ultreia's "few, relevant pushes" principle.

### Mobile: Background Location / HeartbeatService

Classification: 1. Candidate for targeted adoption

Observed shape: Expo background/geofencing modules were deprecated in favor of a central PushInitializer plus an Android native foreground HeartbeatService. The native service uses fused location, foreground notification, boot receiver, SharedPreferences config, movement thresholds, booster heartbeats, stale ticks, and direct heartbeat POSTs.

Benefit for Ultreia: This is one of the strongest technical candidates. Ultreia will likely need reliable background location, movement-aware heartbeat cadence, foreground service handling, boot recovery, and battery-aware throttling.

Risk: Android-specific native code, StepsMatch package names, channel IDs, notification text, API paths, thresholds, and Expo project coupling must not be copied blindly. iOS behavior is not covered by the Android service. Battery/privacy impact is high.

Camino-specific adaptation: The service must explain location use in pilgrim language, respect route/stage context, reduce tracking when not walking, support low-connectivity behavior, and offer clear service controls.

Open checks:

- Verify Android background behavior on target devices.
- Decide whether iOS background location is in MVP scope.
- Rework service text, channel IDs, package names, API path, and thresholds for Ultreia.

### Mobile: PushToken Registration

Classification: 1. Candidate for targeted adoption

Observed shape: Expo token retrieval with projectId, SecureStore/AsyncStorage persistence, persistent deviceId, token refresh, backend registration, device-state sync, and invalid-token recovery paths.

Benefit for Ultreia: Project-scoped Expo token registration and device identity are directly useful. The self-heal behavior is important for reliable field tests.

Risk: Hard-coded project IDs, StepsMatch keys, API base defaults, and Android-only assumptions must be removed. Token and device identifiers are sensitive operational data.

Camino-specific adaptation: Token registration should include Ultreia app identity, selected language, notification consent, selected needs, and maybe current route context, but must avoid collecting more than needed.

Open checks:

- Define exact token registration contract for Ultreia.
- Ensure token redaction in logs and diagnostics.
- Decide anonymous vs authenticated push registration.

### Mobile: Local Notifications

Classification: 2. Use only as technical reference

Observed shape: Notification channels, foreground suppression, offer dedupe, group summary behavior, local offer notifications, category actions, and local state for last remote/local push.

Benefit for Ultreia: Foreground suppression, local dedupe/throttle, Android channel setup, local state, and notification action mechanics are useful patterns.

Risk: The implementation is deeply offer/provider oriented and uses StepsMatch wording, sounds, categories, and grouping assumptions. Local notification logic may compete with server-side notification rules if not redesigned.

Camino-specific adaptation: Ultreia needs pilgrim-specific notification levels: urgent need prompts, quiet in-app hints, route/stage warnings, and maybe no audible alert for low-priority points. The decision engine must stay consistent with backend throttling.

Open checks:

- Define notification priority classes for Camino.
- Decide which prompts may use local notifications vs remote push.
- Design one dedupe authority or an explicit backend/client split.

### Mobile: Map/Directions

Classification: 2. Use only as technical reference

Observed shape: React Native Maps, Google provider, visible radius, marker display, current-position watch, walking ETA, Google Directions fetch with polyline decoding, timeout, and error handling.

Benefit for Ultreia: Map rendering, current-location display, marker selection, directions fetch, polyline decoding, and basic ETA handling are useful references.

Risk: Current UI is offer-radius based and centered on nearby offers. Google Directions is endpoint-to-endpoint, not Camino route/stage aware. Existing region/language defaults are StepsMatch/Graz oriented.

Camino-specific adaptation: Ultreia needs Camino route overlay, stage progress, distance along route, off-route detour distance, offline/cache strategy, and possibly route data independent of Google Directions.

Open checks:

- Choose route geometry source for Camino Frances.
- Decide whether Google Directions is used only for detours or also for walking navigation.
- Define offline map and route-cache requirements.

### Mobile: Diagnostics

Classification: 1. Candidate for targeted adoption

Observed shape: Diagnostics screen and backend diag routes expose app/build info, permissions, background task state, heartbeat state, last known position, notification channels, token/device identity, nearby candidates, manual heartbeat, local notification test, backend roundtrip, and battery-optimization shortcuts.

Benefit for Ultreia: A field-test diagnostics surface is important because Ultreia depends on location, background behavior, push, permissions, and battery settings in real-world walking conditions.

Risk: The current diagnostics surface is StepsMatch-branded, detailed, and can expose sensitive device/location/token-adjacent information. It is useful for testers, not normal pilgrims.

Camino-specific adaptation: Keep diagnostics behind a tester/debug gate. Redact tokens and exact sensitive fields. Add route/stage state, cache state, last prompt decision, suppressed prompt reasons, and offline status.

Open checks:

- Define debug access model.
- Define safe diagnostic event schema and retention.
- Decide which diagnostics are local-only vs sent to backend.

### Frontend: Provider Flow

Classification: 3. Do not adopt / model anew

Observed shape: Provider dashboard, provider creation, offer creation, Google map input, radius setting, category/subcategory selection, validity dates/times, images, and offer management.

Benefit for Ultreia: Useful as a technical reference for forms, map-based place entry, geocoding, and radius visualization.

Risk: The flow is explicitly provider/offer centered and does not match Ultreia's first principle: pilgrim needs before providers. It also carries StepsMatch wording, categories, and business assumptions.

Camino-specific adaptation: Ultreia needs a place/content curation workflow that distinguishes editorial places from official participating places, route proximity from radius, and pilgrim prompts from commercial offers.

Open checks:

- Design an Ultreia place/POI editor from scratch when needed.
- Decide editorial content model before any provider tooling.
- Avoid false partner claims and unchecked offer language.

## Summary

Strong targeted adoption candidates:

- Express/Mongo skeleton, after removing StepsMatch-specific deployment and product assumptions.
- PushToken lifecycle, project-scoped token registration, invalid-token self-heal, and device identity handling.
- Native/background heartbeat concepts, especially movement-aware cadence and boot recovery.
- Push receipt handling, notification diagnostics, and client diagnostic logging.

Use only as technical reference:

- Heartbeat/location/matching flow because the current model is offer/radius based.
- Local notifications because UX and priority logic must be redesigned for pilgrims.
- Map/directions because Ultreia needs route/stage-aware navigation.

Do not adopt / model anew:

- Provider/offer frontend flow as product UX.
- StepsMatch categories, wording, Graz/Judendorf data, offer assumptions, and technical legacy.

## Consequences

Ultreia can reuse lessons from StepsMatch without inheriting the wrong product model.

The next technical ADRs should define Ultreia-native domain models before implementation: route, stage, pilgrim need, place, prompt, prompt visibility, and notification decision.
