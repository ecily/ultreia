# StepsMatch Release Runbook (April 1, 2026)

## Ziel
Release-fähiger MVP für Demo-Publikum mit stabiler Kernfunktion:
Background-Standort + Geofence/Heartbeat + Angebotsausspielung.

## Technischer Status (bereits geprüft)
- `mobile`: `npm run lint` erfolgreich.
- `frontend`: `npm run lint` erfolgreich.
- `frontend`: `npm run build` erfolgreich.
- `backend`: `node --check backend/server.js` erfolgreich.
- Live-Smoketest gegen Prod-API (`2026-03-31`) erfolgreich:
  - `/api/health` = 200
  - `/api/ping` = 200
  - `/api/_readyz` = 200
  - `/apk` = 302

## Kritische Änderungen vor Release
- Home-Feed zeigt aktive Nearby-Angebote robuster (`activeNow`, Geo-Parameter, Radius-Fallback).
- Map-Tab verbessert: aktive/alle Toggle, Refresh, Layer-Wechsel, sinnvolle FABs.
- Profil: `Hintergrunddienst stoppen` inkl. harter Stop-Mechanik bis App-Neustart.
- Logout/Reset stoppt Hintergrunddienst ebenfalls hart.
- Push/Heartbeat-Stack respektiert Hard-Stop auch in `init`, `headlessBootstrap`, Onboarding-Rearm.
- Frontend-Routes auf Lazy-Loading umgestellt (bessere Initial-Performance, kleinere Start-Bundles).
- Anbieter-Dashboard: KPIs, Filter, Suche, robustere Status-Logik.
- Investor-Pitch: Competitive Lens + klare Investor-Signale.

## Go/No-Go Kriterien
- GO nur wenn alle Punkte `PASS`:
1. API health endpoints antworten (`/api/health`, `/api/ping`, `/api/_readyz`).
2. APK-Redirect (`/apk`) liefert Redirect (302).
3. Mobile App startet ohne Crash und Tabs laden.
4. Home zeigt aktive Angebote im Radius.
5. Map zeigt Marker + Bottom Sheet + Route-Start.
6. Profil-Stop deaktiviert Hintergrunddienst bis App-Neustart.
7. Nach App-Neustart kann Dienst wieder laufen.
8. Anbieter kann Angebot anlegen/bearbeiten/löschen.
9. Push-Flow: Enter-Event löst Serverkontakt + Notification-Flow aus.

## Smoke-Test Ablauf (Morgen, Reihenfolge)
1. Backend/API
   - `pwsh -File docs/release-smoke.ps1 -ApiBase "https://lobster-app-ie9a5.ondigitalocean.app"`
2. Frontend
   - Landing öffnen, Login/Register, Anbieter-Dashboard prüfen.
3. Mobile User-Flow
   - Onboarding, Interessen setzen, Home/Map/Profile öffnen.
4. USP-Flow (entscheidend)
   - Mit Testgerät in Angebotsradius:
   - App im Hintergrund/geschlossen.
   - Prüfen: Heartbeat + Geofence-Enter + Notification.
   - Danach Profil: `Hintergrunddienst stoppen` und verifizieren, dass kein weiterer Heartbeat/Push läuft.

## Offene Rest-Risiken (realistisch)
- OEM-Energiesparmodi (z. B. MIUI/EMUI) können Background-Intervalle drosseln.
- Deshalb vor Demo auf Testgeräten:
  - Akku-Optimierung für die App deaktivieren.
  - Standort auf "Immer erlauben".
  - Benachrichtigungen vollständig aktiv.

## Monitoring während Demo
- Backend Logs:
  - `/location/heartbeat`
  - `/location/geofence-enter`
  - `/push/service-state`
  - ggf. `/diag/log`
- App-seitig:
  - Diagnostics-Tab bei Bedarf für schnelle Verifikation.

## Rollback (wenn kritischer Fehler)
1. Mobile: Hard-Stop im Profil (sichert Ruhe im Hintergrunddienst).
2. Backend: Poller optional deaktivieren (`OFFER_POLLER_ENABLED=0`) und neu starten.
3. Frontend: letzte stabile Build-Artefakte redeployen.

## Release-Entscheidung
- Wenn alle Go/No-Go Punkte `PASS`: Release freigeben.
- Wenn ein Punkt `FAIL`: kein öffentlicher Rollout, nur kontrollierte Demo.
