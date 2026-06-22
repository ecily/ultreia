# Ultreia Context

Stand: 2026-06-22

## Projektgrenze

Projekt: Ultreia.app
Lokales Repo: `C:\coding\ultreia`
Branch: `main`
Remote: `https://github.com/ecily/ultreia.git`
Operative Source of Truth: `docs/ULTREIA_CONTEXT.md`

Ultreia.app ist ein eigenständiges Produkt für Pilger am Camino Francés.

Strikte Grenzen:

- Keine Vermischung mit Kaufklug.
- Keine Vermischung mit StepsMatch.
- Keine fremden Daten, Commits, Deploys, Anbieterlogik, Branding-Entscheidungen oder To-dos übernehmen.
- Keine blinde Codeübernahme aus anderen Projekten.
- Keine Secrets, vollständigen Tokens, Passwörter oder Connection Strings in Docs, Logs oder Antworten.
- Kein Push, Deploy, App-Build, DB-, DNS- oder Infrastrukturänderung ohne explizite Freigabe.
- Codex muss vor technischen Aufgaben zuerst `docs/ULTREIA_CONTEXT.md` lesen.

StepsMatch bleibt nur technische Referenz / Labor. Relevant ist vor allem die dort positiv getestete Pipeline:

Mobile GPS Heartbeat -> Backend-Abgleich -> Match-Erkennung -> Push-Auslösung -> Push kommt auch bei geschlossener App und ausgeschaltetem Bildschirm an -> Logging / Diagnostics zur Verifikation.

Ultreia übernimmt daraus nur das technische Muster, nicht Produktlogik, Daten, Anbieterlogik, Kategorien, Branding oder Radius-only-Denken.

## Produktkern

Ultreia ist eine ruhige App für Pilger am Camino Francés.

Pilger wählen aktive Needs, stecken das Handy weg und gehen weiter. Ultreia meldet sich nur, wenn ein Hinweis plausibel relevant ist: im passenden Wegkontext, zur passenden Need, mit ausreichender Datenqualität und ohne Cooldown-/Policy-Konflikt.

Kernsatz:

Pilger wollen gehen, nicht ständig suchen.

Ultreia ist ausdrücklich nicht:

- kein generisches Dealportal
- kein klassisches Branchenverzeichnis
- kein Google-Maps-Ersatz
- kein Booking-Ersatz
- kein Gutscheinportal
- kein lauter Tourismus-Guide
- kein Anbieter-Marktplatz ohne Pilgernutzen
- kein Produkt mit Garantien auf freie Betten, Kunden, Umsatz, Öffnungszeiten, Preise oder Verfügbarkeit

## MVP-Scope

Geografischer MVP-Scope:

- gesamter Camino Francés
- Saint-Jean-Pied-de-Port bis Santiago de Compostela
- funktional MVP, geografisch komplett gedacht
- keine Garantie auf vollständige POI- oder Anbieterabdeckung

Funktionaler Kern:

- Pilgrim Identity und Onboarding
- DE / EN / ES ab Start
- aktive Need-Auswahl
- Route-first Matching
- starke Notification Policy
- Mobile GPS Heartbeat
- Push nur bei plausibel relevanten Hinweisen
- Detailansicht und Directions zum POI / Service
- Development/Test Mode
- Admin / Diagnostics v1
- saubere Datenqualität und Trust-Kommunikation

## i18n

Deutsch, Englisch und Spanisch sind ab Projektstart Pflicht.

Das gilt für:

- Mobile App
- öffentliches Web / Frontend
- Provider-Frontend
- Provider-Onboarding
- Push-Texte
- Notification Titles / Bodies
- Need-Labels
- Buttons und sichtbare Systemtexte
- Disclaimer und Permission-Erklärungen
- Datenquellen- und Verantwortlichkeitslabels
- sichtbare Admin-/Diagnostics-Texte
- Claim-, Correction-, Remove-/Opt-out- und Provider-Statusmeldungen

Interne technische Codes dürfen Englisch bleiben. Sichtbare UI-Labels müssen übersetzbar sein.

## Shared Taxonomy

`shared/taxonomy/` ist zentrale Quelle für statische Produktkonfiguration.

Regeln:

- Keine duplizierten Kategorienlisten in Backend, Mobile, Frontend, Provider-Frontend oder Admin.
- NeedCategories, Labels und statische Keys kommen aus `shared/taxonomy/`.
- Kanonische MVP-Keys verwenden `eat` statt `food` und `medical` statt `medical_help`.
- Taxonomy-Änderungen mit `node shared/taxonomy/validate-taxonomy.mjs` validieren.
- Aktuelle Systemlabels sind dreisprachig (`de`, `en`, `es`).

Wichtige MVP-Needs:

- `sleep`
- `water`
- `eat`
- `grocery`
- `pharmacy`
- `medical`
- `transport`
- `laundry`
- `gear`
- `cash`
- `stamp`
- `sightseeing`
- `quiet_place`

`warning` bleibt eine spätere, riskante Kategorie und ist nicht als einfacher Standard-Push zu behandeln.

## ADR-Architekturanker

ADR-0010 bis ADR-0019 sind Accepted.

- ADR-0010: Camino Route Model
- ADR-0011: Pilgrim Identity, Auth and Onboarding
- ADR-0012: POI / Service / Provider Data Model
- ADR-0013: Distance Strategy: RouteKm, Corridor and Walking Directions
- ADR-0014: Matching v1 Along Route
- ADR-0015: Notification Policy and Cooldowns
- ADR-0016: MVP Data Source Strategy
- ADR-0017: Mobile MVP Scope
- ADR-0018: Admin and Diagnostics v1
- ADR-0019: Provider Claiming Later / Provider Self-Service

Weitere feste Grundlagen:

- ADR-0001: StepsMatch ist technische Referenz, Ultreia bleibt eigenständig.
- ADR-0003: MVP ist geografisch der gesamte Camino Francés.
- ADR-0005: DE / EN / ES ab Start.
- ADR-0007: Monorepo mit `backend/`, `mobile/`, `frontend/`, `shared/`, `docs/`.
- ADR-0008: `shared/taxonomy/` als zentrale Quelle.
- ADR-0009: Runtime-/Hosting-Ziel DigitalOcean App Platform plus Managed MongoDB; Production nur mit expliziter Freigabe.

## Route-First Architektur

Ultreia ist keine normale Nearby-App. Der Camino ist ein linearer Korridor.

Zentrale Konzepte:

- Route
- RouteGeometry / Polyline
- RouteSegment
- RouteKm als lineare Position entlang der Route
- Corridor als Toleranzbereich links und rechts der Route
- optionale Stage Metadata

Camino Francés:

- zentrale offizielle Produkt-Route
- Etappen dürfen UX-/Content-Hilfe sein
- Etappen sind keine harte Matching-Basis
- Relevanz hängt davon ab, ob ein POI sinnvoll vor dem Pilger und im Wegkontext liegt
- Luftlinie ist keine fachliche Relevanzdistanz

Development/Test Route:

- Pflichtbestandteil für Entwicklung und Verifikation
- nutzt reale GPS-Position des Testtelefons
- erlaubt lokale Test-POIs/Test-Services
- verwendet dieselbe Heartbeat-, Matching-, Push- und Diagnostics-Pipeline wie der echte Camino
- `local_test` darf nie öffentlich als `real_camino` erscheinen

## Pilgrim Identity

Ultreia braucht ab MVP eine eigene Pilger-Identität mit Registrierung, Login und Onboarding.

PilgrimUser speichert bzw. ermöglicht:

- Sprache (`de`, `en`, `es`)
- aktive Needs
- Standort-Permission
- Push-Permission
- PushToken / Gerätebindung
- Disclaimer-/Terms-Akzeptanz
- bereits gesehene Hinweise / Dedupe
- Field-Test- und Diagnose-Zuordnung

PilgrimUser und ProviderUser / ProviderAccount bleiben strikt getrennt.

## Datenmodell

POI, Service, ProviderAccount, ProviderProfile und Claim sind getrennte Konzepte.

Regeln:

- POI != Service != Provider.
- POI ist ein konkreter route-relevanter Ort.
- RouteContext gehört primär an den POI.
- Service beschreibt den Need-bezogenen Nutzen an einem POI.
- Services verwenden NeedCategories aus `shared/taxonomy/`.
- ProviderAccount ist Login / Zugriff / Rollen.
- ProviderProfile enthält Betreiber-Stammdaten.
- Claim beschreibt spätere Verwaltung oder Bestätigung eines POI.
- Ein Provider kann null, einen oder mehrere POIs claimen.
- POIs und Services dürfen ohne Provider existieren.
- Provider-Claiming blockiert den MVP nicht.

Directions und Matching nutzen den konkreten POI-/Service-Standort, nicht pauschal eine ProviderProfile-Adresse.

## Distance Strategy

Luftlinie ist höchstens technischer Vorfilter.

Fachliche Distanz basiert auf:

- RouteKm
- Segment- und Korridorlogik
- Walking Directions für wenige Top-Kandidaten

Google Walking Directions:

- nicht primäre Matching Engine
- nur für wenige Top-Kandidaten pro Heartbeat / Need
- Ergebnisse müssen gecacht werden
- Fehler oder Unsicherheit führen zu vorsichtiger Kommunikation

Keine Push-Texte mit garantierter exakter Verfügbarkeit, Öffnungszeit, Bettensituation, Preis oder medizinischer Sicherheit.

## Matching v1

Matching entscheidet Relevanz, nicht Push.

Pipeline:

1. Mobile sendet GPS Heartbeat.
2. Backend bestimmt RouteContext.
3. Backend lädt PilgrimUser / UserState.
4. Aktive Needs werden gelesen.
5. POI-/Service-Kandidaten werden nach Route, Korridor, RouteKm, DataScope, EnvironmentScope, Sichtbarkeit und Need gefiltert.
6. Kandidaten werden gescored.
7. Wenige Top-Kandidaten werden per Walking Directions validiert / gecacht.
8. Ergebnis wird als MatchEvent gespeichert.
9. ADR-0015 entscheidet, ob daraus eine NotificationEvent / Push wird.

MatchEvents müssen diagnosierbar sein, inklusive Reject Reasons wie `wrong_need`, `outside_corridor`, `behind_pilgrim`, `route_unknown`, `low_confidence`, `already_seen`, `directions_failed`, `environment_scope_mismatch`, `data_scope_mismatch`.

## Notification Policy

Matching != Push.

Push ist nur erlaubt, wenn:

- aktiver Need vorhanden ist
- Match ausreichend stark ist
- RouteKm / Korridor / Distanz plausibel sind
- Datenqualität ausreichend ist
- Push-Permission aktiv ist
- PushToken gültig ist
- kein Global-, Need- oder POI-/Service-Cooldown greift
- Tageslimit nicht erreicht ist
- Silence/Pause Mode nicht dagegen spricht

Push muss unterdrückt werden bei schwachen Matches, fehlender Permission, ungültigem Token, zu niedriger Datenqualität, unklarem RouteContext, archivierten/hidden Daten, Wiederholungen oder Policy-Konflikten.

NotificationEvent muss Send/Suppress, Suppress Reasons, Cooldown-State, Locale, `messageKey`, `messageParams`, Push-Provider und DeliveryStatus diagnosierbar machen.

DE / EN / ES gelten für Push-Texte, Notification Keys, Disclaimer, Datenquellenlabels und sichtbare Systemtexte.

Daten anzeigen: ja. Garantieren: nein.

## Data Source Strategy

Ultreia befüllt den MVP nicht primär über Provider-Onboarding.

MVP-Datenbasis:

- kontrolliert kuratierte Startdaten entlang des Camino Francés
- OSM / öffentliche Quellen nur als Ausgangspunkt, nicht blind als Wahrheit
- veröffentlichte Anbieter-/Ortswebseiten, soweit rechtlich und praktisch akzeptabel
- später Provider-Pflege
- später Pilger-Feedback als Signal, nicht direkt als Wahrheit
- lokale Testdaten für Development/Staging

Jeder öffentliche POI / Service braucht:

- `sourceType`
- `confidence`
- `verificationStatus`
- `dataScope`
- `environmentScope`
- `visibilityStatus`
- klare Verantwortlichkeitskommunikation

Trust-Regeln:

- Ultreia-prefilled muss sichtbar markiert werden.
- Public/OSM-Daten sind nicht provider-confirmed.
- Provider-confirmed / provider-maintained ist höherwertig, aber keine Garantie.
- `local_test` bleibt strikt von `real_camino` getrennt.
- Früh muss ein einfacher Claim-, Correction-, Remove-/Opt-out-Pfad für vorab eingepflegte Provider/POIs möglich sein.

## Mobile MVP

Mobile ist das Hauptprodukt des MVP.

Kernschleife:

Registrierung/Login -> Onboarding -> Sprache -> Standortfreigabe -> Pushfreigabe -> Need-Auswahl -> GPS Heartbeat -> Matching -> Push -> Detail -> Directions -> Diagnosemodus.

Mobile MVP muss enthalten:

- Registrierung / Login
- Onboarding mit Disclaimer und Permission-Erklärung
- DE / EN / ES
- Need-Auswahl aus `shared/taxonomy`
- Home / Current Pilgrim State
- Permission Flow für Standort, Hintergrundstandort und Push
- Match-/Hinweisdetail
- Route / Directions zum POI
- Push Interaction
- Diagnosemodus / Field-Test Mode
- Camino Mode und Development/Test Mode
- Umgang mit schlechter Verbindung ohne falsche Live-Aktualität
- Settings: Sprache, Needs, Pushstatus, Standortstatus, Silence/Pause, Disclaimer/Datenschutz, Logout, Test Mode wenn berechtigt

Die App soll ruhig bleiben und nicht zu einer komplexen Karten-, Such- oder Social-App werden.

## Admin / Diagnostics

Admin/Diagnostics ist ab MVP Pflicht.

Grundsatz:

Was das System entscheidet, muss nachvollziehbar sein.

MVP-Diagnostics muss sichtbar machen:

- letzte Heartbeats
- PilgrimUser/TestUser und Gerät
- GPS-Status und letzter Heartbeat-Zeitpunkt
- RouteContext
- Camino Mode oder Development/Test Mode
- RouteKm, Segment, Korridorstatus
- aktive Needs
- Locale
- Standort-/Push-Permissions
- PushToken-Status, ohne unnötige vollständige Offenlegung
- MatchEvents
- NotificationEvents
- Send/Suppress und Gründe
- Datenqualität / Trust-Status
- `local_test` vs `real_camino`
- `production` / `staging` / `development`

Keine Secrets, API Keys oder vollständigen PushTokens in Diagnoseausgaben. Personenbezogene Standortdaten nur im notwendigen Diagnoseumfang.

## Provider Claiming

Es gibt zwei Stufen:

1. Früh: einfacher Claim-/Correction-/Remove-/Opt-out-Pfad aus ADR-0016.
2. Später: vollständiger Provider Claiming / Self-Service aus ADR-0019.

Früher Pfad:

- Betreiber können Korrektur, Claim oder Entfernung/Deaktivierung vorab eingepflegter Einträge anfordern.
- Umsetzung kann zunächst einfach sein, z. B. Formular/E-Mail/Admin-Review.
- Kein falsches Partnerlabel vor Bestätigung.

Späterer Provider Self-Service:

- ProviderAccount / ProviderProfile
- Claim-Prüfung
- Rollen / Rechte
- Stammdatenpflege
- Services und Offers pflegen
- Radius-/Route-Relevanz nur innerhalb Systemregeln
- Admin Review
- Audit
- Missbrauchsschutz

Provider-Nutzen darf erklärt werden:

"Mit einem bestätigten Provider-Konto können Sie Ihre Informationen und Angebote selbst aktuell halten. Ultreia kann passende Pilger im richtigen Wegkontext auf relevante Angebote hinweisen und sie per Route zum Standort führen."

Nicht erlaubt:

- garantierte Pilgerzahl
- garantierter Umsatz
- garantierte Sichtbarkeit
- garantierte Push-Ausspielung
- garantiertes Ranking
- garantierte freie Betten, Verfügbarkeit, Preise oder Öffnungszeiten
- "offizieller Partner", solange nicht bestätigt

Provider kann Matching oder Push nicht erzwingen. Systemregeln aus Matching, Notification Policy, Datenqualität, Cooldowns, DataScope und RouteContext bleiben maßgeblich.

## Kommunikationsregeln

Erlaubt:

- "Hinweis entlang des Camino"
- "Ort in deiner Nähe"
- "knapp abseits des Wegs"
- "redaktionell erfasster Ort"
- "offizieller teilnehmender Ort", nur wenn zutreffend
- "Information bitte vor Ort prüfen"
- "laut verfügbaren Daten"
- "vom Anbieter gepflegt", wenn zutreffend
- "noch nicht vom Anbieter bestätigt", wenn zutreffend

Nicht erlaubt:

- falscher Partnerstatus
- Garantien auf freie Betten
- Garantien auf Öffnungszeiten
- Garantien auf Preise
- Garantien auf Kunden, Besuche, Umsatz oder Reichweite
- garantierte Push-Ausspielung
- fremde Logos/Bilder ohne Rechte
- übertriebene Tourismus-, Deal- oder Werbesprache

## MVP-Bau-Reihenfolge

Diese Reihenfolge ist Planung, keine Implementierung.

### Phase 0: Repo-/Kontext-Basis

- Projektstruktur prüfen.
- `docs/ULTREIA_CONTEXT.md` als Source of Truth nutzen.
- `shared/taxonomy` prüfen.
- i18n-Grundstruktur planen.
- Keine Feature-Implementierung ohne Kontextcheck.

### Phase 1: Backend-Basis

- Express/API-Grundstruktur oder vorhandene Struktur prüfen.
- Health Endpoint.
- Env-Konzept ohne Secrets-Ausgabe.
- MongoDB-Verbindung für Staging vorbereiten, ohne Credentials zu dokumentieren.
- Basismodelle konzeptionell an ADRs ausrichten.

### Phase 2: Shared Taxonomy + i18n

- NeedCategories zentral in `shared/taxonomy`.
- Keine duplizierten Listen.
- DE / EN / ES Labels.
- Message Keys für Push und Systemtexte vorbereiten.

### Phase 3: Auth / Pilgrim Identity

- PilgrimUser.
- Registrierung/Login.
- Sprache.
- Onboarding / Disclaimer / Terms.
- aktive Needs.
- Push-/Standortstatus.
- Geräte-/PushToken-Konzept.

### Phase 4: Route/Test-Route

- Route / Segment / RouteKm / Corridor Modell.
- Camino-Francés-Struktur vorbereiten.
- Development/Test Route für lokale Verifikation.
- `local_test` und `real_camino` sauber trennen.

### Phase 5: POI/Service-Datenbasis

- POI / Service / ProviderAccount / ProviderProfile / Claim konzeptionell in Schema/Models überführen.
- Lokale Test-POIs/Test-Services.
- Kleine kuratierte Camino-Startdaten später.
- `sourceType`, `confidence`, `verificationStatus`, `dataScope`, `environmentScope`, `visibilityStatus`.

### Phase 6: Heartbeat Pipeline

- Mobile GPS Heartbeat.
- Backend empfängt Standort.
- RouteContext-Berechnung vorbereiten.
- HeartbeatEvents / Diagnostics speichern.
- StepsMatch nur als technische Referenzpipeline nutzen.

### Phase 7: Admin/Diagnostics v1 früh bauen

- Letzter Heartbeat.
- RouteContext.
- aktive Needs.
- Testmodus.
- MatchEvents / NotificationEvents später sichtbar.
- `local_test` vs `real_camino` Filter.
- Keine Secrets / PushToken-Leaks.

### Phase 8: Matching v1

- aktive Needs + RouteContext + POI/Service-Kandidaten.
- Scoring.
- MatchEvents.
- Reject Reasons.
- Noch kein Push-Zwang.

### Phase 9: Distance Enrichment

- Google Walking Directions nur für Top-Kandidaten.
- Cache.
- DirectionsLookupEvent.
- Fallback bei Unsicherheit.

### Phase 10: Notification Policy / Push

- NotificationEvent.
- Send / Suppress.
- Cooldowns.
- Tageslimit.
- Silence / Pause.
- Push bei geschlossener App / Screen off verifizieren.
- i18n Message Keys.

### Phase 11: Mobile MVP UI

- Login.
- Onboarding.
- Need-Auswahl.
- Home / Status.
- Permission Flow.
- Hinweisdetail.
- Directions.
- Diagnosemodus.
- Camino/Test Mode.

### Phase 12: Provider Early Claim Path

- Einfacher Claim-/Correction-/Remove-/Opt-out-Pfad.
- Noch kein vollständiger Self-Service.
- Klare Kommunikation: vorab eingepflegt / nicht providerbestätigt.

### Phase 13: Provider Self-Service später

- Vollständiges Claiming.
- Verifizierte Provider.
- Angebote/Services selbst pflegen.
- Radius-/Route-Relevanz innerhalb Systemregeln.
- Admin / Review / Audit.

## Infrastrukturstand

GitHub:

- Remote: `https://github.com/ecily/ultreia.git`
- Branch: `main`

DigitalOcean:

- Projekt: Ultreia
- Managed MongoDB Staging existiert.
- Frontend Static Site Staging existiert.
- `ultreia.app` und `www.ultreia.app` funktionieren grundsätzlich.
- Keine Backend-App.
- Keine API-Domain `api.ultreia.app`.
- Keine dokumentierten Secrets, Tokens, Credentials oder Connection Strings.

DNS bleibt beim bestehenden Provider, bis Änderungen explizit freigegeben werden. Keine DNS-, DB-, Deploy- oder Infrastrukturänderung ohne Freigabe.

## Backend-Stand

Minimale Backend-Basis in `backend/` existiert.

Eigenschaften:

- Node.js / Express
- `GET /api/health`
- Health zeigt optionalen MongoDB-Status ohne Secrets oder Connection String
- `GET /api/taxonomy/needs?locale=de|en|es`
- Backend liest NeedCategories direkt aus `shared/taxonomy/`
- DE / EN / ES Need-Labels sind technisch verfuegbar
- Locale-Fallback: gewuenschte Locale -> `en` -> Key
- `backend/.env.example` ohne echte Werte
- MongoDB-Konzept ist env-basiert: `MONGODB_URI` bleibt leer, `MONGODB_DB_NAME` ist Beispielname
- `backend/package.json` und `backend/package-lock.json`
- Health-Test mit Node Test Runner
- MongoDB-Service-Test mit Node Test Runner
- Taxonomy-Service- und Route-Tests mit Node Test Runner
- keine Auth
- keine erzwungene MongoDB-Verbindung ohne Env-Konfiguration
- keine Domain-Models
- keine DB-Mutation, keine Collections, kein Import
- MongoDB-Staging ist nur fuer Ultreia vorgesehen; keine StepsMatch-DB-Nutzung
- kein Heartbeat, Matching, Push oder Google Directions
- kein Deploy

## Frontend-Stand

Statische Landingpage in `frontend/`.

Eigenschaften:

- kein Framework
- kein Backend
- kein Formular
- kein Tracking
- keine API-Anbindung
- DE / EN / ES Sprachumschaltung
- eigene lokale Camino-/Jakobsmuschel-Bilder
- Camino-Farbwelt
- aktuelles Hero-Foto aus Nutzerfundus

Landingpage-Änderungen wurden in früheren Commits gepusht und live verifiziert. Neue Deploys werden nicht manuell erzwungen ohne Freigabe.

## Offene Umsetzung

Die Architektur ADR-0010 bis ADR-0019 ist entschieden. Die Backend-Basis und Shared-Taxonomy-/i18n-Anbindung sind angelegt; fachliche Produktimplementierung ist noch offen.

Nächster sinnvoller Schritt nach dieser Konsolidierung:

Phase 1/3 vorbereiten: Backend-Konfiguration, Logging-Konzept, spaetere MongoDB-Anbindung und Pilgrim Identity planen, ohne Secrets zu dokumentieren oder fachliche Features vorwegzunehmen.
