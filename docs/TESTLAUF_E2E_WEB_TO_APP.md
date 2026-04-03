# Stepsmatch E2E Testlauf (Web -> App -> Backend-Service)

## Ziel
End-to-End pruefen, dass ein neu angelegtes Anbieter-Angebot ueber `ultreia.app` fuer einen neuen Mobile-User relevant ist und der Backend-Service inkl. Background-Kette sauber arbeitet.

## Voraussetzungen
- Backend/API auf Produktion erreichbar.
- Mobile-App auf Testgeraet installiert.
- Standortdienste am Geraet aktiviert.
- Testort in deiner Naehe vorab festgelegt (Adresse + ungefaehre Koordinaten).

## 1. Anbieter im Frontend registrieren und Angebot anlegen
1. Oeffne `https://www.ultreia.app`.
2. Registriere einen neuen Anbieter-Account (oder melde einen frischen Test-Account an).
3. Gehe in den Anbieterbereich und erstelle einen neuen Provider/Standort:
   - Name: eindeutig, z. B. `E2E Test Anbieter <Datum/Uhrzeit>`
   - Adresse: reale Adresse in deiner Naehe
   - Kategorie/Subkategorie: passend zur spaeteren User-Interessewahl
4. Erstelle ein Angebot fuer diesen Anbieter:
   - Angebotsname: eindeutig, z. B. `E2E Test Angebot <Datum/Uhrzeit>`
   - Radius: 100-250 m (fuer Feldtest sinnvoll)
   - Gueltigkeit: **jetzt aktiv**
   - Tage/Uhrzeit: aktueller Wochentag + aktuelles Zeitfenster
   - Beschreibung/Kontakt: ausfuellen
5. Speichern und in der Angebotsliste verifizieren, dass es als aktiv gefuehrt wird.

## 2. Neuen User in der App registrieren und Interessen setzen
1. App frisch starten.
2. Neuen User registrieren (neue E-Mail/Identitaet).
3. Onboarding komplett durchlaufen:
   - Notification Permission: erlauben
   - Foreground Location: erlauben
   - Background Location: erlauben ("Immer")
4. Interessen waehlen, die exakt zur Angebots-Kategorie/Subkategorie passen.
5. Pruefen, dass der Home/Feed geladen ist und kein offensichtlicher Fehler angezeigt wird.

## 3. Service- und Hintergrundtest in der App
1. In der App auf Diagnostics wechseln (`/(tabs)/diagnostics`).
2. Soll-Zustand pruefen:
   - Notification permission: `granted`
   - Location FG/BG: `granted`
   - BG Location healthy: `true`
   - BackgroundFetch: `available`
   - Fetch Task registered: `true`
3. App in Hintergrund schicken, Screen sperren.
4. Zum Anbieterstandort bewegen (innerhalb Angebotsradius).
5. Beobachten:
   - Push kommt an (bei App im Hintergrund/gesperrt).
   - Push-Tap oeffnet Angebotsdetail.
   - Kein Push-Spam bei mehrfacher Bewegung rein/raus in kurzer Zeit (Dedupe wirksam).

## 4. Backend-Service Verifikation
1. Optional in Diagnostics:
   - `last heartbeat` aktualisiert sich regelmaessig.
2. API-Basischeck:
   - `GET /api/health` liefert `ok: true`.
3. Falls Push ausbleibt:
   - Pruefen, ob Angebot wirklich "active now" ist.
   - Pruefen, ob User-Interessen matchen.
   - Pruefen, ob Service-State in der App auf aktiv steht (nicht paused/disabled).

## 5. Akzeptanzkriterien (Pass/Fail)
- PASS:
  - Angebot wurde im Web erfolgreich erstellt.
  - Neuer App-User mit passenden Interessen kann Angebot erhalten.
  - Background-Service bleibt aktiv und verarbeitet Heartbeats.
  - Push kommt bei gesperrtem Bildschirm an.
- FAIL:
  - Registrierung/Anlage scheitert.
  - Keine Heartbeats / BG unhealthy.
  - Kein Push trotz aktivem, passendem Angebot im Radius.

## 6. Testprotokoll (kurz ausfuellen)
- Datum/Uhrzeit:
- Anbieter-Account:
- Angebot-ID/Name:
- Test-User:
- Standort:
- Diagnostics-Werte (wichtigste):
- Push erhalten (ja/nein):
- Push-Tap routing ok (ja/nein):
- Ergebnis: PASS/FAIL
- Auffaelligkeiten:


