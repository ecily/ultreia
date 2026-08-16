# Ultreia Backend

Minimal Node.js/Express backend foundation for Ultreia Phase 1.

## Scope

- Own Ultreia MongoDB database connection and health/readiness checks.
- Technical device registration and Expo push-token lifecycle.
- Location heartbeat, temporary geospatial records and technical geofence events.
- Controlled, disabled-by-default server push test endpoint.
- No authentication, Camino product logic, matching, offers or provider marketplace.
- No StepsMatch runtime, API, database, package or secret dependency.
- No secrets in repository files.

## Scripts

```bash
npm install
npm start
npm test
```

Development mode:

```bash
npm run dev
```

## Environment

Copy `.env.example` to a local `.env` file if needed. Keep real values out of Git.

```bash
cp .env.example .env
```

`MONGODB_URI` is optional. If it is empty, the backend still starts and health reports `not_configured`.
`npm start` loads a local `.env` file when present. It does not log env values.

## Technical endpoints

```text
GET /api/health
GET /api/ready
POST /api/devices/register
POST /api/push/register
GET /api/push/status
POST /api/push/test
POST /api/location/heartbeat
POST /api/location/geofence-enter
GET /api/location/nearby
POST /api/diagnostics/log
```

`/api/health` confirms process-level health and includes optional database status.
`/api/ready` returns HTTP 200 only when the own MongoDB database is connected.
The push test is disabled unless explicitly enabled with a runtime secret.
