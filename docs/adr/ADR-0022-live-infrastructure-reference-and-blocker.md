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

## Blocker

Die DO-App ist noch nicht live. `doctl` fehlt als ausführbares Tool und das
vorhandene lokale DigitalOcean-Profil wird mit `401 Unauthorized` abgewiesen.
Für den nächsten externen Schritt wird ein gültiger DigitalOcean-Zugriff mit
App-Platform-Berechtigung benötigt; danach können App, Runtime-Secrets und
Deploy aus der bestehenden Spezifikation angelegt und live gesmokt werden.
