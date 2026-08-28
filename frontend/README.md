# Ultreia Webfrontend

`frontend/` enthält die statisch ausgelieferten Weboberflächen von Ultreia.
Es gibt keinen Framework- oder Build-Schritt; HTML, CSS und Vanilla JavaScript
werden direkt über DigitalOcean App Platform bereitgestellt.

## Flächen

- öffentliche DE/EN/ES-Startseite mit optionalem Desktop-Hero-Video;
- Provider- und Admin-Magic-Link-Login;
- gemeinsame Magic-Link-Verify-Seite;
- Provider-Onboarding, Profil, Standortkarte, Offer-Liste und Offer-Editor;
- Offer-Foto-Upload, Löschen und Reorder;
- geschützte Admin-Grundfläche für Übersicht, Provider, Offers, Needs und
  Datenqualität.

Die Webclients integrieren die Ultreia-API mit Cookie-Sessions. Provider-
Autocomplete und Place Details laufen über den serverseitigen Google-Places-
Proxy. Die Standortkarte verwendet einen getrennten, eingeschränkten Google-
Maps-JavaScript-Key. Medien werden über geschützte Backendrouten an Cloudinary
übertragen.

Die Oberflächen unterstützen DE/EN/ES und zeigen `local_test` klar als
„TESTDATEN – NICHT PRODUKTIV“. Technische Details bleiben in Production
ausgeblendet. Es gibt noch keine Routes API oder Produktnavigation.

## Lokale statische Nutzung

Die Dateien können über einen beliebigen lokalen Static-File-Server aus
`frontend/` ausgeliefert werden. Für echte Auth-/Provider-/Admin-Flows muss die
konfigurierte API erreichbar sein und die Origin in der Backend-CORS-Allowlist
stehen.

## Tests

Vom Repository-Root:

```powershell
node --test frontend/*.test.mjs
```

Den vollständigen aktuellen Umfang und die Implementierungsgrenzen beschreibt
der [operative Context](../docs/ULTREIA_CONTEXT.md).

## Hosting

Zieldomains:

- `https://ultreia.app`
- `https://www.ultreia.app`

DNS bleibt bei EDIS; das statische Frontend wird über DigitalOcean App
Platform ausgeliefert.
