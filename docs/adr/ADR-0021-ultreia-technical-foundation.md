# ADR-0021: Eigenständiges technisches Fundament

Stand: 2026-08-16

## Entscheidung

Ultreia erhält ein eigenes Node/Express-Backend, eine eigene MongoDB-Datenbank,
eine eigene Android-first Expo-App, eigene Environment-Namen und ein eigenes
DigitalOcean-Deployment. StepsMatch bleibt ausschließlich technische Referenz.

Die erste mobile Basis enthält nur technische Fähigkeiten: stabile Device-ID,
Notification-/Location-Permissions, aktueller Standort, Background Location,
Heartbeat, Push-Token-Registrierung, lokaler Push, technischer Server-Push-Test
und Geofence-ENTER. Produktdomäne und Matching folgen separat.

## Konsequenzen

- Keine Cross-Repo-Abhängigkeit, kein gemeinsames Package, keine gemeinsame API,
  keine gemeinsame Datenbank und keine StepsMatch-Produktmodelle.
- MongoDB-Collections sind auf technische Laufzeitdaten begrenzt und erhalten
  eigene Indizes/Retention.
- Server-Push-Test ist standardmäßig deaktiviert und braucht eine Runtime-
  Freigabe; produktives automatisches Matching ist nicht Teil dieser Basis.
- Android wird zuerst als reale APK validiert. iOS ist out of scope.

## Verworfen

Ein Kopieren des StepsMatch-Backends oder der Offers-/Provider-/Marketplace-
Modelle würde technische und fachliche Kopplung erzeugen und wird deshalb nicht
verwendet.
