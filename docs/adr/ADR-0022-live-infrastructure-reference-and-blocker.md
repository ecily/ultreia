# ADR-0022: Live-Infrastruktur nach bestehendem Betriebsmodell

Stand: 2026-08-16

## Entscheidung

Ultreia verwendet für die technische Startbasis das bereits lokal bewährte
Muster aus DigitalOcean App Platform und MongoDB Atlas:

- eigene DigitalOcean-App `ultreia-backend` aus
  `deploy/digitalocean-app.yaml`,
- eigenes Backend mit `npm ci` und `npm start`,
- Runtime-Secrets ausschließlich in der geschützten App-Konfiguration,
- eigene Datenbank `ultreia_production` innerhalb des bestehenden Atlas-
  Betriebsmodells mit projektgetrenntem Datenbanknamen,
- TLS bleibt aktiv; kein Zertifikat wird in das Repository übernommen,
- `/api/health` beschreibt den Prozesszustand, `/api/ready` verlangt eine
  verbundene Datenbank,
- `api.ultreia.app` bleibt der dokumentierte spätere API-Hostname.

## Nachweis

Der echte Ultreia-Backend-Code wurde gegen `ultreia_production` ausgeführt.
Mongo-Ping, Health 200, Ready 200 mit `database.connected=true`, kontrollierter
Write/Read, Geo-Abfrage, `2dsphere`-Indizes und Heartbeat-TTL-Index waren
erfolgreich. Temporäre Auditdaten wurden entfernt.

## Sicherheitsgrenze

Kein fremder Secretwert, keine fremde Collection und keine fremde Produktlogik
wurde kopiert oder committed. Die lokale Atlas-Prüfung verwendete nur einen
bereits autorisierten lokalen Runtime-Kontext; dieser Wert bleibt außerhalb
von Ultreia-Git, Dokumentation und Antwort.

## Aktueller Stand (2026-08-19)

Die DO-App ist inzwischen live und die technische Production-API unter
`api.ultreia.app` wurde mit Health/Ready und der eigenen MongoDB-Konfiguration
verifiziert. Runtime-Secrets bleiben außerhalb des Repositories. Für spätere
Operator- oder Console-Aktionen kann weiterhin ein DigitalOcean-Zugriff mit
passender App-Platform-Berechtigung erforderlich sein.
