# Ultreia.app

Ultreia ist ein Camino-Francés-spezifischer Begleiter für Pilger. Pilger
aktivieren konkrete Bedürfnisse und sollen nur bei einem plausibel relevanten
Angebot im Weg- und Zeitkontext aufmerksam gemacht werden.

## Aktueller Entwicklungsstand

Das Monorepo enthält heute:

- eine öffentliche Webpräsenz sowie Provider-, Admin- und Auth-Webflächen;
- ein Node.js-/Express-Backend mit eigener MongoDB;
- Magic-Link-Auth, Rollen, Sessions und getrennte Scopes `production` und
  `local_test`;
- Provider-Self-Service, Offers, Fotos, Google Places/Maps und eine
  Admin-Grundfläche;
- Pilger-, Trip- und Need-Grundlagen sowie ein manuell ausgelöstes
  Haversine-/Radius-Basis-Matching;
- eine Android-first Expo-App mit technischem Device-, Location-, Heartbeat-,
  Geofence- und Push-Unterbau.

Route-first Matching, tatsächlicher Gehweg/Umweg, automatische Match-Pushes,
Navigation, Arrival, Erledigt, Provider-Funnel, Ratings, Track/Export und der
Offline-Endausbau sind noch nicht fertig.

## Architektur und Dokumentation

- [Operative Source of Truth](docs/ULTREIA_CONTEXT.md) – aktueller gebauter,
  getesteter und live verifizierter Stand
- [V1-Produktspezifikation](docs/ULTREIA_V1_PRODUCT_SPEC.md) – fachliches
  Zielbild, einschließlich noch offener Implementierung
- [Architekturentscheidungen](docs/adr/) – dauerhafte ADRs

Historische Auditdateien sind Momentaufnahmen und keine aktuelle Source of
Truth. Ultreia bleibt technisch, fachlich und betrieblich von StepsMatch und
anderen Projekten getrennt.

## Repository

- `backend/` – API, Auth, MongoDB und Domänenservices
- `frontend/` – öffentliche, Provider-, Admin- und Auth-Webflächen
- `mobile/` – Android-first Expo-/React-Native-App
- `shared/` – zentrale Taxonomie
- `deploy/` – secretfreies DigitalOcean-App-Manifest
- `docs/` – Context, Produktspezifikation, ADRs und Operator-Dokumentation

## Lokale Checks

```powershell
npm run verify:backend
node shared/taxonomy/validate-taxonomy.mjs
node --test frontend/*.test.mjs
npm run verify:mobile
```

`verify:mobile` führt ein frisches `npm ci` im Mobile-Verzeichnis aus. Weitere
Operatorpfade sind im [Backend-README](backend/README.md),
[Frontend-README](frontend/README.md) und [Mobile-README](mobile/README.md)
dokumentiert. Reale Secrets bleiben außerhalb des Repositories.
