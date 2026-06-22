# Ultreia Backend

Minimal Node.js/Express backend foundation for Ultreia Phase 1.

## Scope

- Health endpoint only.
- No authentication.
- Optional MongoDB connection foundation.
- No domain models.
- No heartbeat, matching, push, or directions logic.
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

## Health

```text
GET /api/health
```

The response confirms process-level health and includes optional database status. It does not imply product feature readiness.
