# Ultreia Context

Stand: 2026-07-28

Dieses Dokument ist die operative Source of Truth für das eigenständige Projekt
Ultreia.app im Repository `C:\coding\ultreia`.

## Projektgrenze

Ultreia.app ist ausschließlich für Pilger am Camino Francés gedacht. Produkt,
Daten, Branding, Roadmap, Infrastruktur und operative Entscheidungen sind von
Kaufklug und StepsMatch getrennt.

- Kaufklug ist kein Bestandteil dieses Projekts.
- StepsMatch ist ausschließlich technisches Labor bzw. Referenz.
- Keine StepsMatch-Daten, Collections, Env-Werte, DB-Namen, API-/DB-Logik,
  Providerlogik, Texte oder Deployments übernehmen.
- Technische Push-/Matching-Prinzipien dürfen nur abstrakt und mit eigener
  Ultreia-Architektur, eigenen Keys, Env-Variablen und Daten übernommen werden.
- Keine Secrets, Tokens, Passwörter, Connection Strings oder Zertifikatsinhalte
  in Dokumentation, Logs oder Antworten.
- Kein Push ohne ausdrückliche Freigabe.

## Produktkern und USP

Pilger wählen aktive Needs, priorisieren sie per Drag & Drop, stecken das Handy
weg und gehen weiter. Ultreia meldet sich nur, wenn ein plausibel relevantes
Angebot im Camino-Wegkontext fußläufig erreichbar wird.

Ultreia ist keine allgemeine Such-App, kein Dealportal, Branchenverzeichnis,
Maps- oder Booking-Ersatz. Viele Pilger gehen denselben bekannten Camino
Francés, sind zu Fuß und müde. Anbieter wenige Meter abseits der Hauptroute
werden sichtbar, wenn sie zu einem aktiven Need passen und sinnvoll erreichbar
sind. Sichtbarkeit entsteht durch Kontextrelevanz, nicht durch klassische
Werbung.

Es gibt keine Garantien auf Öffnungszeiten, Verfügbarkeit, freie Betten,
Preise, medizinische Sicherheit, Vollständigkeit, Reichweite, Kunden, Umsatz
oder Push-Ausspielung. Wichtige Angaben müssen vor Ort geprüft werden.

## Produktentscheidungen

- MVP-Gebiet ist der Camino Francés von Saint-Jean-Pied-de-Port bis Santiago.
- Aktive Needs und ihre Priorität gehören zu einem aktiven Camino-Trip.
- Ohne aktiven Trip gibt es kein automatisches Push-Matching.
- Der Offer-Radius ist im MVP der erste technische Trigger: ein einfacher Kreis
  um die final bestätigten Provider-Koordinaten.
- Radius-only-Matching ist nicht das finale Ultreia-Modell. Zusätzlich gelten
  Need-Match, aktive Zeit, Geh-Erreichbarkeit, Richtung, Dedupe und Trip-Status.
- Ein Offer kann mehrere offizielle NeedCategories bedienen.
- Mehrere passende Offers eines Providers werden zu einem Push gebündelt.
- Bei mehreren Providern wird im MVP nur der beste relevante Provider gepusht.
- Premium/Boost und Payment sind Zukunft; Relevanz darf niemals ersetzt werden.
- Push-Tap öffnet den aktuellen Offer-Stack, nicht nur eine einzelne Detailseite.

## Abstrakte Matching-Abbildung

```text
Camino-Francés-Route
+ aktiver Pilger-Need
+ Offer-Radius
+ Geh-Erreichbarkeit
+ Richtung / Route-Kontext
+ plausible Zeit/Verfügbarkeit
+ Cooldown/Dedupe
=> zurückhaltender Push
```

Ein Kandidat muss zusätzlich einen aktiven Trip haben, darf nicht
`completed_for_trip` sein und darf nicht `expired_by_distance` sein.

## Provider und Offer

Im MVP entspricht ein Provider-Account genau einem physischen Anbieterstandort.
Weitere physische Standorte benötigen eigene Provider-Accounts. Ein Standort
kann mehrere Offers besitzen; alle Offers verwenden dieselben final bestätigten
Provider-Koordinaten.

Jedes Offer besitzt eigene NeedCategories, Radius-, Preis-, Verfügbarkeits-,
Bestätigungs- und Statusdaten. Pflichtdaten sind Titel, Kurzbeschreibung,
offizielle NeedCategories, Radius, Preisangabe, Verfügbarkeit/Zeitfenster,
Source-Locale, Aktivstatus und letzte Bestätigung.

Provider verwenden ausschließlich den kuratierten Kategorienkatalog. Es gibt
keine sichtbare Kategorie „Sonstiges“. Der Provider-Portal-Button „Nicht dabei,
was du anbietest?“ erzeugt eine nicht-pilgerseitige Betreiber-Anfrage an
Andreas/Ultreia; sie ist nicht pushfähig und wird per E-Mail/Admin-Dashboard
bearbeitet.

Provider-Standorte müssen über Google Places/Autocomplete gefunden werden.
Nach Auswahl ist eine Marker-Feinjustierung bis maximal 25 m erlaubt. Für
Matching, Radius, Detailseite und Navigation gelten die final bestätigten
Koordinaten. Ein Provider wird erst mit gültigem Google-basiertem Standort
aktiv.

Provider dürfen pro Offer einen Radius wählen. Technische MVP-Annahmen:
Mindest-Radius 50 m, Standard 250 m, harter Maximalradius 1000 m. Das spätere
Pricing ist vorbereitet als `prepared_linear_by_radius`; Payment und Premium
sind nicht Teil des MVP.

Für die frühe MVP-Datenquelle legt Andreas Test-/Seed-Provider und Offers
manuell an. Später darf ein verifizierter Provider nach E-Mail-Bestätigung,
Google-validiertem Standort und gültigen Pflichtdaten Offers direkt live stellen.
Admin kann nachträglich korrigieren, sperren, archivieren oder blockieren.

## Trip, Navigation und Ankunft

Ein aktiver Camino-Trip speichert aktive Needs, Prioritätsreihenfolge,
Route-Fortschritt, Etappenlogik sowie Offer-Zustände. Der Trip startet nach
bewusster Auswahl von Startort/Etappe und „Camino starten“. Das Ende wird nahe
Santiago vorgeschlagen, aber vom Pilger bestätigt. Trips können pausiert werden;
bei Pause sind alle automatischen Pushes aus, Zustände bleiben erhalten.

In-App-Google-Navigation ist MVP-Ziel; externer Google-Maps-Absprung bleibt
Fallback. Navigation startet bewusst über „Zu Fuß hinführen“. Ankunft wird aus
Navigation/Route-Ende und GPS-Nähe zu finalen Provider-Koordinaten abgeleitet;
der vorläufige Schwellenwert beträgt 25–50 m.

Nach „Du bist da!“ markiert der Pilger erledigte Needs einzeln. Erst bestätigte
Needs werden deaktiviert. Sobald mindestens ein Need erledigt ist, wird das
konkrete Offer für diese Reise `completed_for_trip`; es gibt keinen erneuten
automatischen Push für dieses Offer während derselben Reise.

## Verfügbarkeit, Preise und Bestätigung

Verfügbarkeit/Zeitfenster sind für ein aktives und pushfähiges Offer Pflicht.
Ultreia prüft nur plausibel und garantiert keine tatsächliche Öffnung oder
Leistung. `sleep` bedeutet im MVP lediglich, dass Unterkunft grundsätzlich zu
den angegebenen Zeiten angeboten wird; freie Betten werden nicht garantiert.

Erlaubte Preisarten sind `free`, `fixed`, `from`, `range`, `donativo` und
`on_request`. Preise stammen vom Anbieter und sind nicht garantiert.

Jedes Offer muss alle 30 Tage aktiv bestätigt werden. Vor Ablauf erfolgen
Erinnerungen sieben Tage und einen Tag vorher. Ohne Bestätigung wird das Offer
pausiert, unsichtbar und nicht pushfähig.

## Pilger-Account und Consent

Ein Pilger-Account ist im MVP Pflicht, damit Standort-Consent, Trip, Needs,
Prioritäten, Push-Token sowie saved/dismissed/completed-Zustände zuverlässig
gebunden werden können. Magic Link ist bevorzugter Login; E-Mail/Passwort ist
Fallback, Google/Apple bleiben optional/später.

Standort- und Push-Erlaubnis werden erst nach Erklärung kurz vor „Camino
starten“ angefragt, nicht direkt beim App-Start. Wird Push abgelehnt, darf der
Trip starten; automatische Pushes bleiben aus, manuelle aktuelle Offers sind
weiterhin möglich. Ein freiwilliger Akkusparmodus ist standardmäßig aus und
kann Hinweise verzögern.

Während eines aktiven Trips darf die Standortverarbeitung genau und häufig
sein, um rechtzeitig zu warnen; Zweck, Umfang und Akkuauswirkung müssen
transparent erklärt werden. Bei pausiertem oder beendetem Trip gibt es kein
automatisches Matching.

## Offline und Route

Die Route wird aus einer manuell kuratierten, versionierten und lizenzierten
Repo-Datei vorbereitet; externe APIs sind keine primäre Laufzeitquelle.
Varianten und Alternativrouten werden von Beginn an modelliert. Offline werden
Route und Offers zunächst für die aktuelle und nächste Etappe vorgeladen,
später möglichst für zwei bis drei Etappen.

Der Offline-Datenkorridor darf ungefähr 1 km links/rechts der Route umfassen.
Push-Relevanz bleibt strenger und prüft Need, Gehweg, Richtung, Zeitfenster und
Cooldown. Offers an der Hauptlinie dürfen bei einer Variante erscheinen, wenn
sie fußläufig sinnvoll erreichbar sind.

## i18n

DE, EN und ES sind für Pilger- und Provideroberflächen ab Start Pflicht.
Provider müssen nicht alle Sprachen selbst pflegen. Ein Offer kann in einer
Quellsprache eingegeben und von Ultreia in die drei Sprachen übersetzt werden.
Übersetzungen dürfen keine Garantien verschärfen oder erfinden.

Konzeptionelle Zustände: `pending`, `machine_translated`,
`provider_reviewed`, `admin_reviewed`.

## Admin und Datenqualität

Andreas/Betreiber-Admin hat im MVP alle Rechte für Provider, Offers,
Kategorien, Übersetzungen, Preise und Pushfähigkeit. Jede Aktion braucht ein
Audit mit Wer, Was, Wann, Vorher/Nachher und gegebenenfalls Grund. Soft Delete
und Archivieren sind Standard; Hard Delete ist ein bestätigungspflichtiges
Sonderrecht.

Provider-/POI-/Offer-Daten benötigen Quelle, Confidence,
Verifikationsstatus, Scope, Sichtbarkeit und letzte Bestätigung. Testdaten
bleiben als `local_test` getrennt und dürfen nie als echte Camino-Daten
öffentlich erscheinen.

## Repository- und Infrastrukturstand

Vorhanden sind statisches `frontend/`, ein eigenständiges technisches `backend`,
Android-first `mobile/`, `shared/taxonomy/`, Tests, Deployment-Manifest und ADRs.
Nicht vorhanden sind weiterhin Auth-, Camino-Domänen-, Matching-, Directions-,
Provider- oder Admin-Implementierungen.

Objektiv bereits implementiert sind die statische Landingpage mit DE/EN/ES-
Sprachumschaltung, ein startbarer Express-Server, `GET /api/health`,
`GET /api/taxonomy/needs`, lokale Env-Ladung, sichere MongoDB-Status-/Ping-
Grundlage sowie automatisierte Backend-/Taxonomy-Tests. Diese technischen
Grundlagen sind kein Nachweis für die Produktreife des Camino-MVP.

MongoDB Phase 1b ist nicht abgeschlossen, solange der Health-Status nicht
`database.connected=true` meldet. Bekannter Blocker ist die TLS-Prüfung
`unable to verify the first certificate`; keine Zertifikatsinhalte posten.

Der generische Taxonomy-Endpunkt liefert derzeit 21 Kategorien inklusive
`warning`; ein späterer Mobile-Consumer muss explizit die 13 MVP-Keys filtern
und `warning` ausschließen. Root `npm test` existiert nicht; Backend-Tests und
Taxonomy-Validator sind separat auszuführen.

## MVP-Scope

## Hero-Video-Status (2026-08-06)

Die Landingpage ist für einen optionalen, nach dem Initial-Render geladenen
Desktop-Hintergrundloop vorbereitet. Poster, HTML-Inhalt und Overlays bleiben
der primäre Hero; Smartphone, Data Saver und `prefers-reduced-motion: reduce`
verwenden ausschließlich das statische Bild. Bei fehlendem oder nicht
abspielbarem Video fällt der Hero still auf das Bild zurück.

Die Quelle `ULTREIA.app.mp4` wurde mit portablem FFmpeg außerhalb des
Repositories geprüft. Der frühere Ping-Pong-Loop wurde wegen sichtbarer
Richtungsumkehr verworfen. Ersetzt wurde er durch einen ca. 10,2-sekündigen,
ausschließlich vorwärts laufenden H.264-Loop aus 20,5–28,5 s mit weichem
Ende-zu-Anfang-Übergang. Mobile, Reduced Motion und Data Saver verwenden
weiterhin ausschließlich das Poster. Details stehen in
`docs/ULTREIA_HERO_VIDEO.md`.

Zuerst zu beweisen sind Route-/Variantenmodell, aktive Needs mit Priorisierung,
Provider-/Offer-Grundmodell, Offer-Radius, kontrollierte Seed-Daten,
Need-/Radius-/Zeit-/Gehbarkeits-Matching, Offer-Stack, Navigation,
`completed_for_trip` sowie Offline-/Route-Cache-Architektur.

Noch nicht bauen: Payment, Premium/Boost, vollständiges Provider-Self-Service,
echte Deploys, Secrets, StepsMatch-Kopplung und sonstige Fremdprojekt-To-dos.

## Änderungsregeln

Vor technischen Aufgaben dieses Dokument lesen. Keine Features im Rahmen einer
Dokumentations- oder Audit-Aufgabe bauen. Nach relevanten Dokuänderungen
Git-Status und Diff prüfen. Kein Push ohne ausdrückliche Freigabe.

## Fundament-Transfer-Audit (2026-08-16)

Ultreia first ist ab jetzt die operative Priorität. StepsMatch wurde als
technische Referenz geprüft, aber nicht als Produktvorlage übernommen. Es gibt
keine gemeinsame Runtime, kein Shared Package, keine gemeinsame API und keine
gemeinsame MongoDB.

### Aktuelle Architektur

- Backend: Node.js/Express 5, native MongoDB Driver, sichere Environment-Ladung,
  strukturierte Logs, Health/Ready, technische Geräte-/Push-/Location-/Geofence-
  Routen und eine kontrollierte Push-Testschleuse.
- MongoDB: eigene Datenbank aus `MONGODB_DB_NAME` (Default
  `ultreia_production`) mit `devices`, `pushRegistrations`,
  `locationHeartbeats`, `geofenceEvents` und `diagnosticEvents`. `devices` und
  Heartbeats verwenden eigene `2dsphere`-Indizes; Heartbeats haben TTL.
- Mobile: Expo SDK 53, React Native 0.79.5, Android-Paket `com.ecily.ultreia`,
  SecureStore-Device-ID, Notification-Channels, Foreground-/Background-
  Location, Heartbeat, lokaler Push und technischer Geofence-ENTER-Handler.
- Deployment: deklaratives DigitalOcean-App-Manifest unter
  `deploy/digitalocean-app.yaml`; es enthält keine Secretwerte.

### Übernommene technische Prinzipien

Übernommen wurden ausschließlich abstrakte Muster aus dem StepsMatch-Audit:
stabile Device-ID, Push-Token-Registrierungsgrundlage, Android-Notification-
Channels, Background-Location mit Heartbeat, 2dsphere-Geoindex, Ready-Checks,
TTL-Diagnostik und sichtbare Fehler-/Diagnosezustände. Nicht übernommen wurden
Offers, Provider, Marketplace, Matchinglogik, StepsMatch-API-Namen, Daten,
Branding, Firebase-Dateien oder Deployments.

### Verifizierter Stand

- Backend: 19 Tests grün, Syntaxchecks grün, lokaler Health-Smoke `200`, Ready
  ohne Datenbank korrekt `503`.
- Mobile: `npm install`, Expo-Konfiguration, Lint und TypeScript grün.
- Android: Release-APK für `arm64-v8a` erfolgreich gebaut; lokales Artefakt liegt
  unter `mobile/android/app/build/outputs/apk/release/app-release.apk`.
- Nicht verifiziert: echter Smartphone-Install, Notification-/FCM-Token,
  Background-Heartbeat, Geofence-ENTER und Server-Push gegen eine live
  erreichbare Ultreia-API. Es war kein Android-Gerät verbunden.

### Environment, Risiken und nächster Block

Versionierbar sind nur Beispielnamen in `backend/.env.example` und
`mobile/.env.example`. Für einen Live-Stand fehlen noch `MONGODB_URI`, eigene
Expo/Firebase-Projektkonfiguration, DigitalOcean Runtime-Secrets und eine live
API-Domain. Die lokale MongoDB-Prüfung ist deshalb noch nicht
`database.connected=true`.

Background Location, Geofence und Push bleiben Android-/OEM-/Batterie-
abhängig. Der Release-Build nutzt vorerst Debug-Signing als lokale APK-Baseline;
vor Veröffentlichung ist ein eigener Release-Keystore erforderlich.

Nach Einrichtung der eigenen MongoDB-/DigitalOcean-/Expo-Credentials folgt ein
einziger technischer Android-E2E-Block gegen die eigene live Ultreia-API:
APK installieren, Permissions erteilen, Device-/Push-Registration, lokalen
Push, Heartbeat, Background-Heartbeat, Geofence-ENTER und kontrollierten
Server-Push verifizieren. Danach erst Route/Trip/Need neutral modellieren.

## Infrastruktur-Referenzaudit und Live-Mongo-Nachweis (2026-08-16)

Zur Vorbereitung der echten Ultreia-Infrastruktur wurden ausschließlich lokale
Projektunterlagen als technische Referenz gelesen: `ecily`, `einfachsparen`,
`qr2buy` und `stepsmatch`. Übernommen wurden nur abstrakte Betriebsprinzipien:
DigitalOcean App Platform mit `main`-Autodeploy, getrennte Backend-/Frontend-
Komponenten, Runtime-Secrets außerhalb von Git, Atlas mit projektgetrennten
Datenbanknamen, TLS, `/api/health`-Smoke, Readiness-Prüfung und explizite
Post-Deploy-Verifikation. Keine fremden Daten, Collections, API-Namen oder
Credentials wurden in Ultreia übernommen.

Der technische Ultreia-Backend-Code wurde am 2026-08-16 gegen eine separat
benannte Atlas-Datenbank `ultreia_production` ausgeführt. Nach erfolgreichem
Mongo-Ping meldeten die echten Routen `/api/health` HTTP 200 mit
`database.connected=true` und `/api/ready` HTTP 200 mit `status=ready`.
Ein kontrollierter Diagnose-Write/Read, eine minimale `$geoNear`-Abfrage sowie
die Live-Indizes `lastLocation_2dsphere`, `location_2dsphere` und
`createdAt_ttl` waren erfolgreich. Die temporären Diagnose- und Gerätedaten
wurden danach gelöscht.

Das vorhandene lokale DO-Mongo-Staging-Environment zeigt aktuell auf einen
nicht auflösbaren Staging-Endpunkt und wurde nicht als Ultreia-Livebasis
verwendet. Die deklarative App-Spezifikation unter
`deploy/digitalocean-app.yaml` bleibt eigenständig und secretfrei; der
Ziel-Hostname `api.ultreia.app` folgt ADR-0009, DNS wurde nicht verändert.

Die DigitalOcean-App konnte in diesem Audit noch nicht angelegt oder deployt
werden: `doctl` ist nicht als ausführbares Tool installiert und das vorhandene
lokale DO-Profil wird von der API mit `401 Unauthorized` abgewiesen. Das ist
der verbleibende externe Deployment-Blocker. Zusätzlich fehlen für die
Sicherheitsanforderung ein dedizierter Atlas-Runtimeuser und für echten Push
ein eigenes Expo-Projekt beziehungsweise dessen Projekt-ID. Mobile bleibt
über `EXPO_PUBLIC_API_BASE_URL` auf die spätere eigene Live-API konfigurierbar;
eine produktive lokale IP wurde nicht festgeschrieben.

## Technischer MVP-Testbuild (2026-08-16)

Der mobile Testbuild verwendet standardmäßig `https://api.ultreia.app/api`.
Eine lokale Emulator-URL ist nur noch als ausdrückliche
`EXPO_PUBLIC_API_BASE_URL`-Überschreibung für lokale Entwicklung vorgesehen.

Das sichtbare Android-Testpanel zeigt jetzt API-/indirekten Mongo-Status,
Device-ID, Location- und Background-Permissions, Push-Registrierung,
Geofence-Registrierung, letzten Heartbeat, letzten Serverkontakt, letzten
Geofence-Status und den letzten Fehler. Die technischen Aktionen für Device,
Location, Heartbeat, Background Location, Push, lokale Notification und
Geofence bleiben unverändert produktlogikfrei.

Der aktuelle Android-Release-Testbuild wurde mit der öffentlichen API-Konfigu-
ration erfolgreich gebaut:

- Paket: `com.ecily.ultreia`
- `minSdkVersion=24`, `targetSdkVersion=35`
- APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- keine StepsMatch-, Firebase- oder `google-services.json`-Datei
- lokales APK-Artefakt mit Debug-Testsignierung

## Konsolidierter technischer Betriebsstand (2026-08-17)

Die Runtime-Konfiguration ist jetzt explizit in `local`, `lan` und
`production` getrennt. Production-Mobile-Builds verwenden ausschließlich
`https://api.ultreia.app/api`; lokale Emulator- und LAN-URLs werden nur über
explizite Environment-Profile gesetzt. Das LAN-Profil ermittelt die private
IPv4-Adresse automatisch und aktiviert Android-Cleartext nur app-lokal für
`lan`, nie für Production.

Der Backend-Production-Start validiert `MONGODB_URI`,
`MONGODB_DB_NAME=ultreia_production`, CORS und aktivierte Push-Testvariablen
vor dem Listen. Der DO-Healthcheck zeigt auf `/api/ready`. Mongo-Startup
initialisiert idempotent Device-, Push-, Geo-, Heartbeat-, Geofence- und
Diagnose-Indizes; Heartbeats und Diagnoseevents haben TTL. Diagnose-/Push-
Testflächen sind rate-limitiert, und Logger redigieren Tokens, URIs und
Schlüsselwerte.

Automatisierbare Pfade:

- `npm run verify:backend`
- `npm run verify:mobile`
- `npm run verify:db`
- `npm run verify:live`
- `npm run lan:backend` plus `npm run lan:mobile`
- `npm --prefix mobile run build:production`

Der Mobile-Statusbereich zeigt jetzt Modus, Version, Expo-Konfiguration,
Health/Ready/Mongo-Indikator, API-/Serverkontakt, Permissions, Background-
Task, Push-/Local-/Server-Push-Status, Heartbeat, Geofence-Daten, letzten
Geofence-Event und Fehlerklasse. Diese Anzeige ist technische Diagnostik und
keine Pilger-UX.

## Kostenlimit und Provisionierungsgrenze (2026-08-17)

Die DO-Spezifikation verwendet jetzt die aktuelle App-Platform-Größe
`apps-s-1vcpu-0.5gb`, exakt eine Instance und kein Autoscaling. Die aktuelle
DO-Preisdokumentation weist dafür 5 USD/Monat aus; Managed Database,
zusätzliche DO-Komponenten und Autoscaling sind nicht vorgesehen.

Die externe Provisionierung wurde in diesem Lauf nicht gestartet, weil
`DIGITALOCEAN_ACCESS_TOKEN` in der Codex-Shell nicht vorhanden war. Es wurde
keine kostenpflichtige Ressource angelegt und kein Ersatz- oder Fremdtoken
verwendet. Vor dem Deploy müssen Größe/Verfügbarkeit per DO-API bestätigt,
danach App, Runtime-Secrets und `api.ultreia.app` eingerichtet werden.

Die App `ultreia-backend` wurde nach erfolgreicher Kosten-Proposition mit
HTTP 201 in DigitalOcean angelegt. Der erste Build war erfolgreich, der
Start scheiterte an der bisherigen `source_dir: backend`-Isolation, weil der
Backend-Code die versionierte gemeinsame Taxonomie unter `shared/taxonomy`
liest. Die Spezifikation verwendet deshalb den Repository-Root als Source,
führt aber weiterhin ausschließlich `backend` mit `npm --prefix backend` aus.
Der nächste Deploy benötigt danach weiterhin den dedizierten
`MONGODB_URI`-Runtime-Secret.

## Reale DO-Provisionierung (2026-08-17)

Die DO-App `ultreia-backend` wurde nach einer erfolgreichen Kosten-Proposition
mit genau einer `apps-s-1vcpu-0.5gb`-Instance und der Domain
`api.ultreia.app` angelegt. Die Kosten-Proposition meldete 5 USD/Monat.

Der erste Build war erfolgreich, scheiterte aber beim Start an der isolierten
`source_dir: backend`-Struktur und dem fehlenden Zugriff auf
`shared/taxonomy`. Nach Umstellung auf den Repo-Root mit
`npm --prefix backend ci` und `npm --prefix backend start` war Build und
Containerstart erfolgreich. Der zweite Deploy erreichte die eigene
Production-Validierung und stoppte ausschließlich mit
`invalid_runtime_config`, fehlend ist `MONGODB_URI`.

Die App ist deshalb angelegt, aber noch nicht ready/live. Es wurde kein
fremder Atlas-Zugang verwendet. Nach dem Setzen des dedizierten
`MONGODB_URI`-Runtime-Secrets folgt Redeploy, DNS-/TLS-Prüfung und der
kontrollierte Live-Smoke.

## Tatsächlich verifizierter Live- und Android-Stand (2026-08-17)

Die öffentliche API ist live unter `https://api.ultreia.app/api`. Der
vorhandene Befehl `npm run verify:live` war erfolgreich:

- DNS und HTTPS erfolgreich
- `/api/health`: HTTP 200, `database.connected=true`
- `/api/ready`: HTTP 200, `status=ready`

Der produktive technische API-Smoke war ebenfalls erfolgreich und verwendete
ausschließlich markierte Diagnose-Testdaten mit der Device-ID
`diagnostic-live-smoke-20260817`:

- Device Registration: HTTP 200
- Heartbeat-Write: HTTP 200
- GeoNear-Read über `/api/location/nearby`: HTTP 200, Testgerät gefunden
- Geofence-ENTER-Write: HTTP 200
- Diagnostic-Write: HTTP 202

Die Daten sind keine Pilgerdaten. Der DO-Exec-Kanal ist für den aktuellen
Operator-Token mit HTTP 403 nicht freigeschaltet; deshalb wurden keine
direkten Mongo-Indexlisten aus dem Container behauptet. Der erfolgreiche
GeoNear-Read beweist den produktiven Geo-Pfad; TTL-/Indexdefinitionen bleiben
im Backend-Startup idempotent versioniert.

Die aktive DO-App entspricht der Spezifikation: `ultreia-backend`, eine
`apps-s-1vcpu-0.5gb`-Instance, Port 3000, `/api/ready`,
`MONGODB_DB_NAME=ultreia_production`, `MONGODB_URI` als Runtime-Secret-Key,
keine DO-Datenbank und Domain `api.ultreia.app`.

Der aktuelle Production-Testbuild wurde erfolgreich gebaut:

- Paket: `com.ecily.ultreia`
- APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- Größe: ca. 22,2 MB
- API: `https://api.ultreia.app/api`
- Expo SDK 53, Android Cleartext in Production deaktiviert
- keine StepsMatch-, Firebase- oder `google-services.json`-Artefakte

`adb devices` enthält weiterhin kein angeschlossenes Gerät. Expo/EAS konnte
in dieser Shell nicht authentifiziert werden (`expo whoami`: Network fetch
failed; EAS-Aufruf: Timeout), und `EXPO_PROJECT_ID` bleibt leer. Push,
Background Location und Geofence sind daher implementiert und im Panel
vorbereitet, aber nicht als Hardwarelauf bewiesen.

Der temporäre DO-Operator-Token ist nicht versioniert, nicht dokumentiert und
nicht in Logs übernommen. Nach Abschluss der Infrastrukturarbeiten soll er
außerhalb dieses Repo-Scope gelöscht oder rotiert werden.

## Standalone-APK- und Push-Integrationsstand (2026-08-17)

Die aktuelle Release-APK ist eigenständig installierbar. Der ZIP-Inhalt
enthält `assets/index.android.bundle`, ein natives Android-Manifest und DEX-
Dateien; es gibt keine Expo-Go-/Metro-Artefakte. `expo-updates` ist deaktiviert,
die Production-API ist fest auf `https://api.ultreia.app/api` konfiguriert und
das Paket ist `com.ecily.ultreia`.

Das Technikpanel zeigt Environment, API URL, App-Version, Device-ID,
Health/Ready/Mongo, Permissions, aktuelle Position, Heartbeat,
Background-Task, Push-/Local-/Server-Push-Status, Geofence-Daten und Fehler.
Der technische Test-Geofence liegt etwa 40 m nördlich der aktuellen Position
und hat 25 m Radius; sein Identifier ist `ultreia-technical-test`. Damit ist
ein kurzer, reproduzierbarer ENTER-Test möglich, ohne Camino- oder
Providerdaten zu verwenden.

Der Push-Lifecycle ist vorbereitet: stabile Device-ID, eigene Expo Project ID
als Konfigurationswert, Token-Registrierung, Token-Replacement,
`DeviceNotRegistered`-Deaktivierung und geschützte Server-Push-Schleuse.
Production bleibt solange `PUSH_TEST_ENABLED=false`, bis ein eigenes Expo-
Projekt und ein eigener Firebase/FCM-Kontext vorhanden sind.

Für lokale Standalone-Push-Builds wird eine eigene `mobile/google-services.json`
benötigt; diese Datei ist git-ignoriert. Alternativ kann EAS den eigenen
Firebase-Kontext geschützt bereitstellen. StepsMatch-IDs, FCM-Dateien und
Credentials werden nicht übernommen. `npx expo whoami` schlug mit Network
Fetch fehl, `npx eas whoami` lief in einen Timeout; die eigene Project ID ist
noch nicht vorhanden.

## Next operator action

1. Gültigen DigitalOcean-App-Platform-Zugriff sowie Atlas-Berechtigung für
   einen dedizierten Ultreia-Runtimeuser bereitstellen.
2. Expo-Projektzugang/Project-ID bereitstellen, falls echter Push-Test im
   selben Block gewünscht ist.
3. Codex mit `Provision Ultreia now` fortsetzen; App, Runtime-Secrets,
   Deployment, öffentliche Smokes und den finalen Production-APK werden dann
   automatisch abgearbeitet. Der physische Android-Test bleibt danach der
   einzige manuelle Gerätetest.

Nicht bewiesen sind weiterhin die öffentliche DO-API, Expo-Projekt-/Push-
Credentials und ein physischer Smartphone-Lauf. `adb devices` hatte beim
Build keinen angeschlossenen Gerätetestkandidaten.

## EAS-Verknüpfung und Firebase-Grenze (2026-08-17)

Die globale EAS-CLI ist jetzt mit dem eigenen Account `ecily` angemeldet;
`eas whoami` bestätigt `andreas.franz@ecily.com`. Ultreia ist mit dem eigenen
Expo-Projekt `@ecily/ultreia` verknüpft:

- Project ID: `a6310341-1133-4528-91fd-4dd33c27dab6`
- Slug: `ultreia`
- Android-Paket: `com.ecily.ultreia`
- EAS-Projektprüfung: `eas project:info` erfolgreich

Die Project ID steht in `mobile/app.config.js`; die dynamische Konfiguration
setzt sie für lokale und EAS-Builds. Ein eigenes Firebase/GCM-Projekt sowie
ein eigener Android-Firebase-App-Eintrag sind auf diesem Rechner noch nicht
vorhanden. Firebase CLI, Google Cloud CLI und lokale Firebase-Credentials sind
nicht eingerichtet. Deshalb bleiben `google-services.json`, FCM-Credentials,
Production-Server-Push und der echte Push-Token bis zur manuellen Einrichtung
des eigenen Firebase-Projekts offen. Es wurden keine StepsMatch-Artefakte
verwendet.

`adb devices` enthält weiterhin kein physisches Android-Gerät. APK-Installation,
Permission-Lauf, Token-Erzeugung, Background-Heartbeat, Geofence-ENTER und
Server-Push können daher erst nach Firebase-Einrichtung und Anschluss eines
Testgeräts als Hardwarebeweis gelten.

## Eigener Firebase/FCM- und Live-Push-Stand (2026-08-17)

Die eigene Datei `mobile/google-services.json` ist vorhanden, bleibt über
`.gitignore` außerhalb des Repositories und wurde validiert:

- Firebase Project ID: `ultreia-37602`
- Android-Paket: `com.ecily.ultreia`
- genau ein Android-Client, keine StepsMatch-Konfiguration

Expo Prebuild kopiert diese Datei kontrolliert nach
`mobile/android/app/google-services.json` (ebenfalls ignoriert), ergänzt das
Google-Services-Gradle-Plugin und bindet die Google-Play-Services-Abhängigkeiten
in die native Release-APK ein. Das aktuelle EAS-Credential für genau
`@ecily/ultreia` und `com.ecily.ultreia` ist FCM v1 mit Firebase-Projekt
`ultreia-37602`; ein Legacy-FCM-Credential ist für diese App nicht gesetzt.

Der technische Server-Push-Test ist in DigitalOcean aktiviert und geschützt.
Nur die eigene Expo Project ID, `PUSH_TEST_ENABLED=true` und ein außerhalb des
Repos gespeicherter `PUSH_TEST_KEY` sind gesetzt; ein optionaler Expo-Access-
Token wird vom aktuellen Backend nicht benötigt. Der aktive DO-Deploy ist
`0baf20ee-7c43-49e2-a42e-293fada1ceea`. Live sind `/api/health` und `/api/ready`
grün, `/api/push/status` meldet `projectConfigured=true` und
`testPushEnabled=true`, ein Push-Test ohne Schlüssel bleibt `404 not_found`.
Eine echte Zustellung ist ohne registriertes Gerät noch nicht bewiesen.

Die aktuelle APK wurde mit der eigenen FCM-Konfiguration gebaut:

- Datei: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- Paket: `com.ecily.ultreia`
- Target SDK: 35, `debuggable=false`
- Production-API: `https://api.ultreia.app/api`
- Production-Bundle und natives Manifest vorhanden
- Google Play Services/FCM im APK vorhanden
- keine Expo-Go-, Metro- oder Dev-Client-Artefakte

Das Technikpanel zeigt Push-Registrierung und Backend-Registrierung ohne
Tokenwerte oder Tokenpräfixe an. Backend-Tests (23/23), Mobile-Verify, Live-
Health/Ready, APK-Analyse und Security-Scan sind grün. `adb devices` zeigt
weiterhin kein Gerät; Installation, Permission-Lauf, Token, Background-
Heartbeat, Geofence-ENTER und tatsächliche Server-Push-Zustellung bleiben daher
Hardwarebeweise.

## Expo-Asset-Standalone-Fix und Realgerät (2026-08-17)

Der erste Production-APK-Lauf auf echter Hardware startete nicht. Der
Logcat-Befund war eindeutig:

`[runtime not ready]: Error: Cannot find native module 'ExpoAsset'`

Ursache war keine Firebase-, FCM- oder Backend-Konfiguration. `expo-asset`
war nur als transitive, verschachtelte Expo-Abhängigkeit vorhanden und nicht
als direkte App-Abhängigkeit registriert. Dadurch fehlte das Modul in der
Expo-SDK-53-Autolinking-Auflösung für den Standalone-Release-Lauf.

Die Korrektur ist reproduzierbar umgesetzt:

- `mobile/package.json` enthält direkt `expo-asset: ~11.1.7`, passend zu
  Expo 53.
- `mobile/package-lock.json` wurde aktualisiert; ein frisches
  `npm ci --ignore-scripts --no-audit --no-fund` installiert `expo-asset`
  auf Root-Ebene.
- `npx expo-modules-autolinking resolve --platform android --json` enthält
  danach `expo-asset` und `expo.modules.asset.AssetModule`.
- `npm --prefix mobile run build:production` baut die Release-APK mit
  `expo-asset (11.1.7)` erfolgreich.

Der korrigierte APK wurde am angeschlossenen Gerät installiert und per
`adb shell monkey -p com.ecily.ultreia -c android.intent.category.LAUNCHER 1`
gestartet. Nach mindestens 15 Sekunden lief der Prozess weiter, die
`MainActivity` war resumed/visible, und Logcat zeigte `Running "main"` sowie
erfolgreiche Firebase-/ExpoModulesCore-Initialisierung. Es gab keinen
`FATAL EXCEPTION`-Eintrag und keinen `ExpoAsset`-Fehler.

Damit ist der ursprüngliche Start-Crash auf diesem Realgerät behoben. Nicht
behauptet werden dadurch Token-Zustellung, Background-Location oder
Geofence-ENTER; diese bleiben separate manuelle Funktionsnachweise.
