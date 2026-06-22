# Ultreia Backend

Minimal Node.js/Express backend foundation for Ultreia Phase 1.

## Scope

- Health endpoint only.
- No authentication.
- No MongoDB connection.
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

## Health

```text
GET /api/health
```

The response confirms process-level health only. It does not imply database connectivity or product feature readiness.
