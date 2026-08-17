# ADR-0023: Eindeutige Runtime-Modi und technische Smokes

Stand: 2026-08-17

## Entscheidung

Ultreia verwendet drei explizite technische Modi:

- `local`: lokales Backend; MongoDB ist optional, Health bleibt nutzbar und
  Ready zeigt fehlende DB-Verbindung als `503`.
- `lan`: lokales Backend im WLAN; die Mobile-App erhält die lokale private
  IPv4-Adresse über ein Skript. Android-Cleartext wird ausschließlich in
  diesem App-Build über einen lokalen Config-Plugin-Schritt aktiviert.
- `production`: HTTPS-only zur öffentlichen API
  `https://api.ultreia.app/api`; Backend-Env wird vor Startup strikt validiert.

Die wiederverwendbaren Operatorpfade sind:

- `npm run verify:backend`
- `npm run verify:mobile`
- `npm run verify:db`
- `npm run verify:live`
- `npm run lan:backend` und `npm run lan:mobile`
- `npm --prefix mobile run build:production`

## Sicherheits- und Betriebsregeln

- Production benötigt `MONGODB_URI`,
  `MONGODB_DB_NAME=ultreia_production` und `CORS_ORIGINS`.
- `PUSH_TEST_ENABLED=false` bleibt Production-Default; eine Aktivierung
  benötigt zusätzlich `PUSH_TEST_KEY` und `EXPO_PROJECT_ID`.
- DO verwendet `/api/ready` als Healthcheck und verhindert damit einen
  scheinbar gesunden Dienst ohne Mongo-Verbindung.
- Mongo-Indizes werden idempotent beim Startup initialisiert; Heartbeats und
  Diagnoseereignisse besitzen TTL-Aufbewahrung.
- Diagnose- und Push-Testflächen sind rate-limitiert; Logs redigieren Tokens,
  URIs, Credentials und Schlüsselwerte.
- Keine fremden Projekt-Credentials, Datenbanken oder Runtime-Artefakte werden
  in Ultreia verwendet.

## Nicht durch Code beweisbar

Ein echter DO-Deploy, eine öffentliche DNS-/HTTPS-Prüfung, Expo-Provisionierung
und der physische Android-Test bleiben externe beziehungsweise gerätegebundene
Nachweise. Sie werden nicht als lokal bewiesen ausgegeben.
