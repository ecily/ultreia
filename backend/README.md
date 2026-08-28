# Ultreia Backend

Das Backend ist die eigenständige Node.js-/Express-API von Ultreia. Es nutzt
den nativen MongoDB-Treiber und enthält heute technische Foundation- sowie
erste V1-Domänenfunktionen.

## Umfang

- Health/Readiness und sichere Production-Konfiguration
- eigene MongoDB mit Geo-, Unique- und TTL-Indizes
- Device-, Push-, Location-, Geofence- und Diagnostikgrundlage
- Magic-Link-Auth über lokale Diagnose-Outbox oder Microsoft Graph
- gehashte Access-/Refresh-Sessions, Rollen und Multi-Role-Kontext
- strikt gebundene Scopes `production` und `local_test`
- Pilger-/Providerprofile, Accountlöschung und Trip-Lifecycle
- zentraler Need-Katalog und tripgebundene Pilger-Needs
- Provider-Self-Service, Google-validierte Standorte, Offers und Medien
- geschützte Admin-Grundfläche und AuditEvents
- manuell ausgelöstes Haversine-/Radius-Basis-Matching

Noch nicht vorhanden sind Route-first Matching, RouteKm, Walking Directions,
MatchEvents, Notification Policy, automatische Match-Pushes, Navigation,
Arrival, Erledigt und Provider-Funnelstatistik. Siehe
[operativer Context](../docs/ULTREIA_CONTEXT.md).

## Lokal starten

```powershell
npm install
npm start
```

Bei Bedarf `backend/.env.example` als lokale Vorlage verwenden. Reale Werte
dürfen nicht in Git gelangen. Ohne `MONGODB_URI` startet ein lokaler Server mit
`database.status=not_configured`; Production validiert die erforderliche
Runtime-Konfiguration vor dem Start.

## Prüfen

```powershell
npm test
npm run verify
```

Vom Repository-Root:

```powershell
npm run verify:backend
npm run verify:db
npm run verify:live
```

`verify:db` benötigt einen bewusst bereitgestellten autorisierten
Runtime-Kontext. Tests verwenden keine Production-Secrets.

## API-Bereiche

```text
/api/health          /api/ready
/api/auth            /api/account       /api/profiles
/api/trips           /api/needs         /api/pilgrim
/api/provider        /api/admin
/api/devices         /api/location      /api/push
/api/diagnostics     /api/taxonomy
```

Geschützte Routen prüfen Auth, Rolle, Ownership und Scope serverseitig.
Secrets, vollständige Tokens und Connection Strings werden nicht ausgegeben.
