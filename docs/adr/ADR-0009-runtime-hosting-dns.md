# ADR-0009: Runtime Hosting and DNS

Status: Accepted
Date: 2026-06-21

## Context

Ultreia is an independent Camino product and monorepo. ADR-0001 defines strict separation from StepsMatch. ADR-0003 defines the full Camino Frances MVP scope. ADR-0005 requires German, English, and Spanish from project start. ADR-0006 defines data model principles that require a real backend and database later. ADR-0007 defines the monorepo scaffold. ADR-0008 defines `shared/taxonomy/` as shared static product configuration.

This ADR decides the initial runtime, hosting, database, and DNS strategy. It does not create infrastructure.

## Decision

Ultreia will remain locally developable, but will be oriented from the start toward DigitalOcean staging and later live infrastructure.

Target platform:

- DigitalOcean App Platform for backend
- DigitalOcean App Platform for public web and frontend
- DigitalOcean Managed MongoDB as database
- DNS remains at EDIS initially, but the domain `ultreia.app` should later point to DigitalOcean targets

## Environment Strategy

Minimum environments:

- `local`
- `staging`

Production will be introduced separately later.

Rules:

- Local remains mandatory for fast development and tests.
- Staging on DigitalOcean is mandatory from the beginning.
- Production requires later explicit approval.
- No deploys without explicit approval.
- No database mutations without explicit approval.

## Domains

Target domains:

- `ultreia.app` -> public web/frontend
- `www.ultreia.app` -> public web/frontend
- `api.ultreia.app` -> backend API

Optional later domains:

- `provider.ultreia.app`
- `admin.ultreia.app`

Current DNS provider:

- EDIS

Current known DNS state:

- `@` A record currently points to an EDIS IP.
- `*` A record currently points to an EDIS IP.
- `mail` A / MX / SPF records exist for mail.

Rules:

- Do not touch mail records while mail runs through EDIS.
- Do not change DNS before DigitalOcean provides concrete target records for App Platform.
- Later, review the wildcard A record at EDIS deliberately because it sends unknown subdomains to EDIS.
- `api.ultreia.app` needs an explicit DNS record pointing to the DigitalOcean target.
- `ultreia.app` and `www.ultreia.app` need explicit records pointing to the DigitalOcean target.

## MongoDB

Decision:

- Ultreia gets a real Managed MongoDB from the beginning.
- No temporary JSON or SQLite product data basis.
- MongoDB is needed for Place, RouteContext, NeedCategory usage, MatchEvents, NotificationLogs, and later Provider/Owner structures.

Rules:

- No connection strings in the repository.
- No secrets in docs.
- `.env.example` is allowed, but only without real values.
- `MONGODB_URI` will later be set as an environment variable in DigitalOcean App Platform.
- Local may later use a local MongoDB or staging MongoDB, but secrets stay local or in DigitalOcean runtime configuration.

## App Platform

### Backend

The backend should later run as its own DigitalOcean App Platform web service or component.

The API should later be reachable through `api.ultreia.app`.

Environment variables belong only in the DigitalOcean UI/runtime context, not in the repository.

### Frontend

The frontend should later run as a DigitalOcean App Platform static site or web app.

It should later be reachable through `ultreia.app` and `www.ultreia.app`.

## Security and Operations Rules

- Do not commit secrets.
- Do not put complete tokens, URIs, passwords, or keys in docs or answers.
- Do not paste DigitalOcean credentials into Codex prompts.
- Deploys require explicit approval.
- DNS changes require concrete DigitalOcean target values first.
- MongoDB Trusted Sources must be configured deliberately later.
- Smoke tests after every infrastructure step must be documented.

## Non-Goals

- No code
- No backend scaffold
- No frontend scaffold
- No MongoDB creation
- No DigitalOcean app creation
- No DNS record changes
- No deploys
- No remotes
- No secrets

## Relationship to StepsMatch

StepsMatch provides technical learnings from DigitalOcean, backend, MongoDB, and push work.

Ultreia remains its own project.

Ultreia must not use StepsMatch deploys, databases, secrets, or domains.

## Consequences

Future backend and frontend setup should be compatible with local and DigitalOcean staging operation.

Infrastructure work must be split into explicit, approved steps: app creation, MongoDB creation, environment variables, DNS records, deploy, and smoke tests.
