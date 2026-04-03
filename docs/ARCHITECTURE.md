# Stepsmatch System Architecture (MVP)

## System Diagram (Text)

```
┌────────────────────┐           ┌─────────────────────┐
│  Provider Frontend │  HTTPS    │   Stepsmatch Backend │
│  (Admin UI)        ├──────────▶│  /api/offers         │
└────────────────────┘           │  /api/providers      │
                                 │  /api/location       │
                                 │  /api/push           │
                                 └──────────┬───────────┘
                                            │
                                            │ MongoDB
                                            ▼
                                 ┌─────────────────────┐
                                 │   Offers / Tokens   │
                                 │   OfferVisibility   │
                                 └─────────────────────┘

┌────────────────────┐           ┌─────────────────────┐
│    Stepsmatch App  │  HTTPS    │   Stepsmatch Backend │
│  (Android Mobile)  ├──────────▶│  /api/location/      │
│                    │ Heartbeat │  heartbeat           │
│  - BG Location     │           │  - match offers       │
│  - Geofencing      │           │  - dedupe             │
│  - BackgroundFetch │           │  - push send           │
│  - ForegroundSvc   │           └──────────┬───────────┘
└─────────┬──────────┘                      │
          │                                ▼
          │                          Expo Push
          ▼                                │
  Local Notifications                       ▼
  (Geofence + UI)                  ┌─────────────────────┐
                                   │  Device Notification │
                                   │  (User)              │
                                   └─────────────────────┘
```

## Core Flow

1. Provider creates an offer in the Frontend.
2. Backend stores offer and makes it queryable.
3. Mobile app sends heartbeats (foreground + background).
4. Backend matches offers (distance + time + interests).
5. Backend triggers push to user.
6. App receives push (foreground or background).

## Background Reliability Layer (Android)

- **Foreground Service** keeps the app’s background execution stable.
- **BackgroundFetch** re-arms background location and sends a heartbeat when stale.
- **Geofencing** provides local-first notifications (no network dependency).


# Stepsmatch Stability Checklist (MVP)

## Mobile
- Notifications permission granted (Android 13+).
- Foreground + Background location granted.
- Foreground Service running (Diagnostics shows BG healthy).
- BackgroundFetch status is `available`.
- BackgroundFetch task registered.
- Last heartbeat timestamp updates.

## Backend
- `/api/location/heartbeat` reachable.
- MongoDB connected and indexes created.
- Push tokens stored (`PushToken`).
- Dedupe via `OfferVisibility` active.

## Product
- Offers are **active now** (time window valid).
- Offer radius is realistic (100–200m for local tests).
- User interests match offer category/subcategory.


# Roadmap (Prioritized)

## 0–30 days (Stability)
1. Adaptive heartbeat intervals (active vs idle).
2. Battery-aware adjustments (reduce frequency when idle).
3. Push receipt monitoring + token hygiene improvements.

## 30–60 days (Trust & Insights)
1. Offer analytics for providers (push sent, opened).
2. App-level “quiet mode” (max pushes/day).
3. Basic A/B test: distance thresholds vs engagement.

## 60–90 days (Scale)
1. Auto “claim listing” flow for providers.
2. Region rollout playbook (1 village → 5 villages).
3. Lightweight pilot dashboards for partners.
