# Ultreia Context

## Provider-Offer-Bildreihenfolge (2026-08-21)

Die Reorder-Aktion sendet eine vollständige Liste der bestehenden `publicIds`.
Der Backend-Contract verlangt jedes Bild genau einmal, prüft Ownership und Scope
und persistiert anschließend `sortOrder` atomar. Ein Live-400 entstand, weil das
Frontend zuvor auch die `data-photo-id`-Attribute der Nach-oben/Nach-unten-
Buttons einsammelte und dadurch doppelte IDs sendete. Der Selector liest nun nur
noch die Bildzeilen; nach erfolgreichem Reorder wird die Serverreihenfolge neu
geladen. Cloudinary wird beim Reorder nicht aufgerufen.

Bei Offer-Mutationen mit anschließendem Reload bewahrt der Provider-Editor
Scrollposition und aktives Feld beziehungsweise Foto-Aktion. Der erneute Render
fokussiert dadurch nicht mehr automatisch den Seitentitel; gezieltes Springen
zum ersten Validierungsfehler bleibt weiterhin möglich.

Der Offer-Fotoeditor unterstützt zusätzlich natives Desktop-Drag-and-Drop mit
sichtbarem Handle und Drop-Ziel. Der bestehende Nach-oben/Nach-unten-Contract
bleibt der Keyboard- und Mobile-Fallback; Touch-Drag wird nicht simuliert.

Die Camino-UX-Recherche vom 21.08.2026 ist in
`docs/ULTREIA_CAMINO_UX_RESEARCH_2026-08-21.md` dokumentiert. Sie bestätigt
eine ruhige, route- und serviceorientierte Darstellung mit lokal konkreten
Angebotsdaten statt eines generischen Verzeichnis- oder SaaS-Eindrucks.

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

## Realer Android-Hardwaretest und Permission-Refresh (2026-08-17)

Der angeschlossene Hardwaretest lief auf Xiaomi `23090RA98G`, Android 16,
HyperOS/V816, mit ADB-Serial `V4RKTOIF6TBAIR5L`. Die APK bleibt ein
Production-Standalone-Build mit Target SDK 35.

### Permission-Befund

Der Android-Systemzustand wurde direkt und nicht aus dem Technikpanel gelesen:

- `ACCESS_FINE_LOCATION`: `granted=true`, AppOp `allow`
- `ACCESS_COARSE_LOCATION`: `granted=true`, AppOp `allow`
- `ACCESS_BACKGROUND_LOCATION`: `granted=true`
- `POST_NOTIFICATIONS`: `granted=true`
- `FOREGROUND_SERVICE`: `granted=true`
- `FOREGROUND_SERVICE_LOCATION`: `granted=true`
- Standortüberwachung/Foreground-Start: AppOps aktiv; Android hielt die
  Location-Bindung der Ultreia-App an den Google Location Manager.

### Root Cause und Fix für `Background: denied`

Der Widerspruch war ein veralteter React-State, keine verweigerte Android-
Permission. Die App las den Permission-Status bisher nur beim expliziten
Permission-Button und aktualisierte ihn nicht zuverlässig nach Rückkehr aus
den Systemeinstellungen. Android konnte deshalb bereits `Always allow` haben,
während das Panel noch `denied` anzeigte. Der erneute echte Permission-Flow
lieferte auf demselben Gerät `granted/granted`.

Die mobile Diagnostik verwendet jetzt `getForegroundPermissionsAsync()` und
`getBackgroundPermissionsAsync()` für den initialen Status sowie für jeden
`AppState=active`-Resume. Zusätzlich werden der Background-Location-Task und
der Geofence-Task über die nativen Expo-Task-APIs aktualisiert. Die neue APK
wurde installiert; direkt nach dem Start zeigte das Panel `Background:
erlaubt`, `Task: aktiv` und `Foreground-Service: aktiv`.

### Hardware-real bewiesen

- Standalone-APK installiert und stabil gestartet; kein `FATAL EXCEPTION` und
  kein `ExpoAsset`-Fehler.
- Device-ID `ultreia-msxhx1mg-hmc3d7sx3v` über den Production-Endpoint
  registriert; das Panel meldete `Gerät registrieren: OK`.
- Foreground-Location gelesen; die Genauigkeit wurde technisch verarbeitet,
  konkrete Koordinaten werden hier nicht dokumentiert.
- Heartbeat erfolgreich an die Production-API gesendet; der Serverkontakt und
  der Heartbeat-Zeitpunkt erschienen im Panel.
- Notification-Permission, Expo-Project-ID, Expo-Push-Token-Erzeugung und
  Backend-Registrierung erfolgreich; Tokenwerte erscheinen weder im Panel
  noch im Testlog.
- Lokale Notification ausgelöst; Android zeigte den Eintrag `Ultreia lokaler
  Test` auf dem Channel `ultreia-attention-v1`.
- Technischer Geofence `ultreia-technical-test` registriert; Expo
  `TaskService` und Google Location Manager bestätigten die Registrierung.
- App-Prozess und Location-Task blieben beim Ausschalten des Bildschirms
  erhalten; nach dem konfigurierten 120-Sekunden-Fenster kam ohne physische
  Bewegung kein neuer Heartbeat. Das ist wegen `distanceInterval: 50` kein
  Beweis für einen blockierten Task.

### Serverseitig bzw. noch offen

- Live `/api/health` und `/api/ready` bleiben grün; `/api/push/status` meldet
  eigene Project-ID-Konfiguration und aktivierten geschützten Push-Test.
- Der App-interne Server-Push-Aufruf ohne Runtime-Testschlüssel wurde korrekt
  mit `404 not_found` abgewiesen. Es wurde kein Schutz umgangen und keine
  Push-Zustellung behauptet.
- Ein Geofence-ENTER und ein neuer Background-Heartbeat nach echter Bewegung
  sind nicht simuliert und bleiben physische Hardwarebeweise.
- Die sichtbare Zustellung eines Server-Pushes bleibt bis zu einem
  geschützten externen Testaufruf und der Gerätebestätigung offen.

## Sicherer operatorseitiger Server-Push-Test (2026-08-18)

Der geschützte Production-Test ist ausschließlich `POST
/api/push/test`. Er erwartet den Header `x-ultreia-test-key` und einen JSON-
Body mit `deviceId` sowie optional `title` und `message`. Die APK sendet
keinen Testschlüssel und enthält keinen solchen Schlüssel.

Der versionierte Operator-Testweg ist auf genau das registrierte technische
Gerät begrenzt:

```powershell
npm run push:test -- --device ultreia-msxhx1mg-hmc3d7sx3v
```

Das Script verwendet ausschließlich `https://api.ultreia.app/api`, liest
`PUSH_TEST_KEY` nur aus der aktuellen lokalen Prozessumgebung und gibt weder
Schlüssel noch Expo-Push-Token aus. Die Backend-Testantwort enthält nur
Ticket-/Receipt-Statusklassen, niemals Ticket-IDs oder Payloads.

Wenn der Schlüssel lokal nicht gesetzt ist, kann er für genau einen
PowerShell-Aufruf verdeckt eingegeben und danach automatisch aus der Umgebung
entfernt werden:

```powershell
$ultreiaSecret = Read-Host 'PUSH_TEST_KEY (verdeckt)' -AsSecureString
$ultreiaSecretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ultreiaSecret)
try { $env:PUSH_TEST_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ultreiaSecretPtr); npm run push:test -- --device ultreia-msxhx1mg-hmc3d7sx3v }
finally { Remove-Item Env:PUSH_TEST_KEY -ErrorAction SilentlyContinue; [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ultreiaSecretPtr) }
```

Das Technikpanel bietet keinen lokalen Server-Push-Button mehr. Es weist
stattdessen auf den externen Operator-Testweg hin. Der Production-Button ist
entfernt; die APK kann den Operator-Test nicht selbst auslösen.

## Konsolidierter V1-Produktstand (2026-08-19)

Die fachliche Produktdefinition für die erste tatsächlich nutzbare Ultreia-
Version ist jetzt zentral in
[`docs/ULTREIA_V1_PRODUCT_SPEC.md`](ULTREIA_V1_PRODUCT_SPEC.md) dokumentiert.
Diese Datei ist die fachliche Source of Truth für Pilgerverhalten,
PilgrimUser/Device, Magic-Link-Onboarding, Trip, Needs, Provider-Self-Service,
POI/Service/Offer, route-first Matching, Push-Policy, Navigation, Offline,
Track/Historie, Trust, Datenschutz, DE/EN/ES, lokale Beta, Camino-Beta und
V1-Definition-of-Done.

`ULTREIA_CONTEXT.md` bleibt auf technischem Projektstand, Architektur,
Infrastruktur, Nachweisen, Risiken und offenen technischen Arbeitsblöcken.
Ältere ADRs mit früheren Produktannahmen sind in der Spezifikation bzw. direkt
an den betroffenen ADRs als übersteuert markiert. In diesem Dokumentationsblock
wurde die gemeinsame V1-Basis inzwischen implementiert: Magic-Link-Auth mit
gehashten One-Time-Tokens, User/Rollen (`pilgrim`, `provider`, `admin`),
Pilgrim-/Provider-Profile, opaque Access-/Refresh-Sessions, Gerätebindung,
Account-Soft-Delete, Scope-Sessionbindung (`production`/`local_test`) sowie
ein race-sicherer Trip-Lifecycle mit genau einem nicht abgeschlossenen Trip je
Pilger und Scope. Die Mobile-Technikoberfläche enthält nur den technischen
Auth-/Deep-Link-/Session-/Logout-Fluss; kein Secret liegt in der APK.
## Web-Auth-Einstieg und Production-Scope (2026-08-19)

Das statische Webfrontend besitzt jetzt einen sichtbaren Provider-/Admin-
Einstieg auf `/provider/login` und `/admin/login`, die Verify-Route
`/auth/verify` sowie reduzierte, echte Startseiten unter `/provider/` und
`/admin/`. Websessions verwenden HttpOnly-Cookies mit `SameSite=Lax`,
Origin-Prüfung für schreibende Cookie-Anfragen und serverseitige
`/auth/me`-/Rollenprüfung. Die drei Sprachen verwenden dieselbe
Landingpage-Sprachwahl.

`local_test` ist im produktiven Backend grundsätzlich technisch verfügbar,
aber nur für serverseitig autorisierte Admin-/Test-Accounts (`admin`,
`testAccess` oder explizite `LOCAL_TEST_EMAILS`-Runtimekonfiguration). Normale
Accounts erhalten `scope_not_available`; ein Scope-Wechsel innerhalb einer
Session bleibt verboten. Die Production-App verwendet
`https://ultreia.app/auth/verify` als Magic-Link-Ziel.

Der Production-Mailprovider ist weiterhin ein externer Restpunkt. Ohne
konfigurierte Provider-Runtime meldet der Auth-Request explizit
`mail_provider_not_configured` und behauptet keinen Versand.

Die dauerhaften Entscheidungen stehen in
[`docs/adr/ADR-0026-v1-auth-sessions-and-scope.md`](adr/ADR-0026-v1-auth-sessions-and-scope.md).

Der technische Testmodus wird beim Magic-Link-Flow ausdrücklich über
`X-Ultreia-Scope: local_test` angefordert und ist im Production-Backend nur
für serverseitig autorisierte Admin-/Test-Accounts verfügbar. Production-
Sessions bleiben auf `production`; ein Scope-Wechsel innerhalb einer Session
wird abgewiesen. Magic-Link-URLs werden nur im lokalen technischen
Diagnose-Outbox-Fluss verfügbar gemacht; in Production ist ein Mail-Provider
erforderlich. Provider-Dashboard, Needs,
Offers, Matching, Route, Navigation, Offline-Cache und Hero-/Frontend-Arbeit
gehören ausdrücklich nicht zu diesem Foundation-Block.

## Microsoft-Graph-Mail fuer Production-Magic-Links

Der Production-Mailversand folgt dem produktiv bestätigten `ecily.com`-Muster:
Microsoft Graph, OAuth-2.0-Client-Credentials, Scope
`https://graph.microsoft.com/.default`, Application Permission `Mail.Send`
und `POST /v1.0/users/{MAIL_FROM}/sendMail`. `einfachsparen` bleibt als
abweichender SMTP-/STARTTLS-Referenzstand ausschließlich lesend und wird nicht
übernommen. Ultreia verwendet eine eigene App-Registration und eine eigene
Absender-Mailbox.

Die Runtime-Konfiguration ist in
[`docs/ULTREIA_MICROSOFT_MAIL_OPERATOR.md`](ULTREIA_MICROSOFT_MAIL_OPERATOR.md)
dokumentiert. Lokale und automatisierte Tests bleiben in der Diagnose-Outbox;
Production fällt ohne vollständige Microsoft-Konfiguration mit
`mail_provider_not_configured` aus. Tokenabruf und Mailversand loggen keine
Secrets oder Access-Tokens; der Graph-Versand wird nach einem Timeout nicht
blind wiederholt.

## Production-Magic-Link-400 (2026-08-19)

Der Live-Request von `/provider/login` wurde mit exakt dem Web-Payload
`{"email":"<redacted>"}` reproduziert. Die API antwortete mit HTTP 400 und
`invalid_request: displayName is invalid`. Der Fehler entstand in der
Backend-Validierung beim Anlegen eines bisher unbekannten Users; Tokenabruf,
Microsoft Graph `sendMail` und Exchange-Mailbox wurden noch nicht erreicht.

Ursache war zweifach: Das Webfrontend sendete weder `role` noch
`preferredLocale`, und der Backend-Auth-Service behandelte neue Web-Provider
als Pilger und verlangte einen nicht vorhandenen Anzeigenamen. Der Provider-
Webintent sendet jetzt `role=provider` und Locale. Neue Provider erhalten
serverseitig eine pending `providerProfile`-Grundlage und einen sicheren
technischen Anzeigenamen aus der E-Mail-Adresse; neue Admin-Accounts werden
nicht automatisch erzeugt. Bestehende Accounts werden serverseitig anhand der
angeforderten Rolle geprüft. Der korrigierte Pfad ist durch die Auth-Suite
abgedeckt; Microsoft-/Graph-Zustellung wird nach dem Deploy separat live
verifiziert.

## Provider-V1-Self-Service (2026-08-19)

Der erste Provider-V1-Workflow ist jetzt als eigener Scope-/Ownership-
gesicherter Backend- und Web-Block implementiert: Providerprofil, Google-
validierter Standort, Need-Katalog, Offer-Erstellung/-Bearbeitung,
Pausieren/Reaktivieren und 30-Tage-Bestätigung. Matching, Navigation und Push
bleiben außerhalb dieses Blocks.

ProviderProfile und Offers tragen den autorisierten Session-Scope
`production` oder `local_test`. Provider-Routen leiten Scope serverseitig aus
der Session ab und prüfen die Eigentümerschaft. Ein Provider-Account bleibt in
V1 an genau einen physischen Standort gebunden, kann aber mehrere Offers haben.

Der kuratierte V1-Katalog aus der Produktspezifikation ist in der gemeinsamen
Taxonomie als 40 aktive Needs mit DE/EN/ES-Übersetzungen angelegt und wird in die
Mongo-Collection `needs` idempotent eingespielt. Nicht freigegebene historische
oder kontrollierte Schlüssel bleiben inaktiv.

Google Places (New) wird über einen Backend-Proxy mit expliziten Field Masks
verwendet. Der Google-Key bleibt ein serverseitiges Runtime-Secret
`GOOGLE_PLACES_API_KEY`; der Browser erhält keinen Key. Place Details wird beim
Speichern erneut geladen, GeoJSON verwendet `[longitude, latitude]`, und eine
Marker-Korrektur über 25 m wird serverseitig abgewiesen. Die genaue externe
Einrichtung steht in `docs/ULTREIA_GOOGLE_PLACES_OPERATOR.md`.

Der Block wurde mit Commit `9d0b601` nach `origin/main` gepusht und auf
DigitalOcean sowie dem statischen Web deployt. Live-Smoke: `/api/health` 200,
`/api/ready` 200, `/api/needs?locale=en` 200 mit 40 aktiven V1-Needs,
`/api/provider/profile` ohne Session 401 und `/provider/` 200 mit der neuen
Provider-Oberfläche. Die aktuelle DO-Runtime enthält noch keinen
`GOOGLE_PLACES_API_KEY`; deshalb ist der reale Login→Google-Auswahl→Offer-
Smoke bis zur manuellen Google-Cloud-Einrichtung offen. Es wurden keine
Production-Testdaten angelegt.

## Repeated-Provider-Magic-Link (2026-08-19)

Der bestehende Provider-Pfad erzeugt bei jedem Request einen neuen gehashten
One-Time-Magic-Link und legt ihn mit eigener TTL erneut in `magicLinks` ab; ein
neuer Request legt keinen zweiten User an. Der alte Link wird nicht durch den
neuen Request ersetzt, bleibt aber bis zur TTL bzw. einmaligen Verwendung
unabhängig gültig. Der atomare Verify-Filter verhindert Wiederverwendung.

Es gibt keine E-Mail-Deduplizierung oder dauerhafte Suppression. Der einzige
Schutz ist der prozesslokale Auth-Request-Limiter mit 8 Requests je IP in einem
60-Sekunden-Fenster; danach ist ein neuer legitimer Request wieder möglich.

Der korrigierte Production-Request für den bestehenden Provider wurde live
ausgeführt: HTTP 200 `accepted`, Readiness HTTP 200. Der Backend-Log meldete
ohne Empfänger-, Token- oder Secret-Daten `magic_link_delivered`,
`channel=microsoft`, `upstreamStatus=202`. Damit ist der zweite Graph-
`sendMail`-Aufruf technisch nachgewiesen. Die Zustellung in das Postfach selbst
ist durch den Backend-Nachweis nicht weiter verifizierbar.

## Provider-Places-Geografie und Autocomplete (2026-08-19)

Die erste Places-Implementierung verwendete fuer alle Provider-Sessions
hartkodiert `includedRegionCodes: ["fr", "es"]`. Dadurch konnten lokale
`local_test`-Eingaben wie `8111 Gratwein-Strassengel` unpassende franzoesische
Treffer erhalten. Der Request sendete zwar den vollstaendigen Eingabestring,
aber ohne `regionCode`, serverseitigen Scope-Bias oder Abbruch veralteter
Browser-Requests.

Autocomplete leitet die Geografie jetzt ausschliesslich aus der autorisierten
Session ab. `local_test` verwendet `includedRegionCodes: ["at"]` und
`regionCode: "at"`; `production` verwendet ausschliesslich
`includedRegionCodes: ["es", "fr"]`. Eine vorhandene, bestaetigte
Provider-Position wird serverseitig als begrenzter `locationBias` verwendet,
ohne Browser-Geolocation zur Voraussetzung zu machen. Der Client kann keine
Laenderfilter setzen. `includePureServiceAreaBusinesses: false` bevorzugt
physische Standorte; Place Details und Koordinaten bleiben beim Speichern
serverseitig zwingend.

Der Provider-Client behaelt den vollstaendigen aktuellen String, debounced mit
250 ms, bricht laufende aeltere Requests per `AbortController` ab und verwirft
zusaetzlich Antworten mit veralteter Sequenznummer. Sprache wird unabhaengig
von Region als `de`, `en` oder `es` an Places uebergeben. Der gemeinsame
Session-Token wird fuer Autocomplete und die nachfolgende Place-Details-
Auswahl weitergereicht.

Nachweis: Backend 42/42 Tests, Frontend-Autocomplete 2/2 Tests, inklusive
vollstaendiger Adresse, lokaler/produktiver Scope-Policy und out-of-order-
Response. Der reale Production-Smoke muss nach dem Deploy mit einer
autorisierten `local_test`-Session gegen `8111 Gratwein` und eine vollstaendige
Adresse wiederholt werden.

Der Fix `04bcf0a` ist auf Backend und Web deployed; beide DigitalOcean-
Deployments wurden ACTIVE, Health/Ready liefern weiterhin HTTP 200. Der
geschuetzte Live-Provider-Endpunkt antwortet ohne Session mit 401. Eine
autorisierte Places-Liveabfrage wurde nicht vorgetaeuscht: In der aktuell
abrufbaren DigitalOcean-Backend-Komponentenkonfiguration ist kein
`GOOGLE_PLACES_API_KEY`-Runtime-Eintrag sichtbar, obwohl die externe
Betriebsannahme von einem gesetzten Secret ausging. Der echte
`local_test`-Autocomplete-Nachweis bleibt deshalb bis zur Korrektur dieser
Runtime-Diskrepanz offen.

## Provider-local-test-Sessionwechsel (2026-08-19)

Der erste Places-Live-Befund betrachtete nur die Service-Ebene der
DigitalOcean-App. Der Google-Key liegt tatsaechlich als App-Level-Secret vor
und ist im Backend-Runtime-Prozess vorgesehen. Fuer den autorisierten
Testzugang wurde App-Level `LOCAL_TEST_EMAILS` mit Andreas' bekannter
Provider-Adresse gesetzt; der Wert ist keine Secret-Ausgabe und bleibt aus
Antworten und Logs heraus.

Der Provider-Bereich besitzt jetzt einen expliziten Umschalter zwischen
`production` und `local_test`. Der Server prueft beim Wechsel die aktuelle
authentifizierte User-Session und autorisiert `local_test` nur fuer Admins,
Test-Claims oder die serverseitige Allowlist. Der Wechsel widerruft die
aktuelle Session und stellt eine neue Session mit dem Ziel-Scope aus. Der
Browser-Storage dient nur der Anzeige/Anfrage; Provider-, Offer- und Places-
Routen verwenden den serverseitigen Session-Scope.

`providerProfiles` und `offers` werden ausschliesslich mit `userId` plus Scope
gelesen. Ein lokaler Test sieht damit keine Production-Providerdaten und
umgekehrt. `local_test` wird im Dashboard sichtbar als `TESTDATEN - NICHT
PRODUKTIV` markiert. Der echte Andreas-Login-/Umschalt-/Places-Smoke folgt nach
dem Code-Deploy; vorher wird kein Erfolg behauptet.

Der nachfolgende Production-Deploy `42ce028` wurde ACTIVE. Der Google-Key ist
als App-Level-Secret vorhanden; `LOCAL_TEST_EMAILS` ist fuer Andreas als
serverseitige, nicht-geheime Allowlist konfiguriert. Live Health/Ready und die
ausgelieferten Provider-Bundles sind erfolgreich. Der konkrete persönliche
Andreas-Smoke mit bestehender Browser-Session wurde nicht simuliert: Ohne
seine autorisierte Session bzw. eine interaktive Magic-Link-Bestätigung wäre
ein angeblicher Places-Treffer kein echter Nachweis.

## Provider-CORS-Preflight (2026-08-19)

Die Provider-Weboberflaeche verwendet PUT fuer `/api/provider/profile` und
`/api/provider/location`. Die Backend-CORS-Middleware hatte PUT bisher nicht
in `Access-Control-Allow-Methods`; dadurch wurden die Browser-Preflights trotz
korrekter Origin-Allowlist blockiert. Die Allowlist erlaubt jetzt GET, POST,
PUT, PATCH, DELETE und OPTIONS. Die Origins bleiben auf `CORS_ORIGINS`
beschraenkt, Credentials bleiben aktiviert, und es gibt keine Wildcard-Origin.

## Provider-Onboarding-Feedback (2026-08-19)

Provider-Onboarding bleibt fachlich die Folge `Anbieter -> Standort ->
Erstes Angebot`. Die API persistiert die Schritte getrennt und liefert bereits
den aktualisierten Profil-/Offer-Zustand zurueck. Der unklare reale UI-Zustand
entstand, weil das Frontend alle Mutationsfehler auf einen generischen Text
reduzierte und Feedback nach `load()`/`render()` verlor. Ein unvollstaendiges
Offer reproduziert serverseitig weiterhin einen fachlich korrekten
`400 invalid_request` mit erhaltenem Entwicklercode; die UI zeigt diesen nun
kontextbezogen am betroffenen Feld.

Provider-Web verwendet jetzt ein zentrales Loading-/Success-/Error-Feedback,
persistente Schritt- und Statusanzeige aus dem Backend sowie DE/EN/ES-Texte.
Autorisierte `local_test`-Sessions sehen zusaetzlich nur kompakte technische
Diagnostik (Methode, HTTP-Status, Scope und relevante Statusfelder); Production-
Provider sehen keine solche Diagnostik und keine Secrets, Tokens oder IDs.

Der Offer-Editor zeigt fachliche Aufgaben statt interner Datenstrukturen:
Needs werden aus der zentralen Taxonomie gesucht, als Chips gewaehlt und
schrittweise gruppiert. Preis, Verfuegbarkeit und Radius werden progressiv
eingeblendet; eine Live-Vorschau und responsive Desktop-/Mobile-Darstellung
bleiben auf denselben bestehenden API-Feldern. Dauerhaftes UX-Prinzip:
Komplexitaet wird schrittweise eingeblendet.

## Offer-Submit-Validierung (2026-08-19)

Der Offer-Editor verwendet fuer seinen Submit eine eigene fachliche
Validierung. Das Formular ist deshalb jetzt mit `novalidate` versehen; native
Browser-Validierung kann keine eingeklappte Zeitzeile oder ein anderes nicht
fokussierbares Control mehr als Submit-Blocker verwenden. Titel und
Beschreibung bleiben fachlich Pflichtfelder und werden bei Leerwert sichtbar
am aktiven Feld gemeldet. Bei fehlenden Zeiten wird der Stundenbereich
aufgeklappt, die erste Zeitzeile sichtbar gemacht und fokussiert.

Die erzeugten Preis- und Profil-Selects sind explizit geschlossen. Es wird nur
ein Offer-Formular gerendert; die Preview ist keine zweite Eingabekopie. Ein
401 bei `/api/auth/me` bleibt ein separater Session-Zustand: der bestehende
Refresh wird einmal versucht, danach leitet das Frontend ohne gueltige Session
zum Provider-Login weiter und laesst keinen scheinbar aktiven Editor stehen.

## Provider-Offer-Uebersicht und Admin-Grundlage (2026-08-20)

Die Provider-Startseite laedt `GET /api/provider/offers` nach jedem Reload und
nach jeder Aktion neu. Die eigene Sektion `Meine Angebote` zeigt Titel,
Taxonomie-Needs, Preis, Status, Radius sowie letzte und naechste Bestaetigung.
Die Zaehler beschraenken sich auf echte `active`, `paused` und `draft` Offers.
Aktionen entsprechen dem serverseitigen Statusmodell; die Daten bleiben an
User-ID und Session-Scope gebunden. Autorisiertes `local_test` zeigt nur die
kompakte, nicht-geheime GET-Diagnostik.

Unbekannte Admin-Adressen werden weiterhin nicht automatisch angelegt. Der
sichere One-shot-Operatorpfad liegt in
`backend/scripts/provision-admin.mjs`, benoetigt Produktionsmodus, die
Runtime-Variable `MONGODB_URI`, `ADMIN_PROVISION_EMAIL` und die exakte
Bestaetigungsvariable `ADMIN_PROVISION_CONFIRM=ULTREIA_ADMIN_PROVISION_V1`;
er hat keine HTTP-Route und gibt keine Geheimnisse aus. Andreas wurde damit
einmalig serverseitig als `admin` provisioniert. Der anschliessende reale
Admin-Magic-Link-Request lieferte HTTP 200; der Backend-Delivery-Log bestaetigt
den Microsoft-Graph-`sendMail`-Status 202. Token-Verify, Session-Cookie und
Redirect sind erst nach dem Oeffnen des Links im Postfach ein interaktiv
beobachtbarer Schritt.

## Implementierungs-Audit und Scope-Konsistenz (2026-08-20)

Der aktuelle V1-Stand wurde ueber Backend, Web-Provider, Mobile-Technical-App,
Mongo-Indizes, Auth-/Scope-Logik, Places-Integration, CORS und Deployment-
Konfiguration geprueft. Die bestehenden Provider-, Places- und Auth-Smokes
sowie Backend-, Frontend- und Mobile-Checks waren gruen; veraltete fruehere
Audittexte ohne Provider-/Auth-Stand gelten nicht als aktueller Quellstand.

Behoben wurden zwei belastbare Scope-/Datenfehler: Device-Dokumente erhalten
bei Registrierung, Push-Registrierung und Heartbeat jetzt den autorisierten
Request-/Session-Scope statt pauschal `production`. Dadurch bleiben technische
local_test-Daten auch bei nachgelagerten Device-Reads korrekt getrennt. Die
Account-Loeschung markiert jetzt Providerprofile in allen Scopes statt nur des
ersten gefundenen Profils als geloescht. Der Mobile-Client klassifiziert HTTP
503 nun korrekt als `backend_not_ready`.

Regressionstests decken die Scope-Persistenz technischer Writes, die
mehrfachen Providerprofile bei Account-Loeschung, One-Time-Magic-Links,
Provider-Ownership, Places-Scope-Filter, CORS-Preflight, race-sichere lange
Autocomplete-Eingaben und Mobile-Typecheck/Lint ab. Die fremden
Hero-/Landingpage-Dateien bleiben bewusst ausserhalb dieses Audits und werden
nicht staged.

## Gemeinsame Multi-Role-Identitaet (2026-08-20)

Der Login-Fehler bei derselben E-Mail in Provider- und Admin-Einstieg lag in
der fehlenden Rollenbindung des Magic-Links und dem fehlenden aktiven
Session-Kontext. `User.roles` bleibt die zentrale Berechtigungsmenge; ein
Magic-Link speichert jetzt `requestedRole`, und Verify erzeugt eine neue
Session mit `activeRole`, `allowedRoles` und dem unveraenderten Scope.

Ein bestehender User bekommt durch den Login keine neue Rolle und verliert
keine Rolle. Provider- und Admin-Login pruefen die jeweils angeforderte Rolle;
unbekannte Admins werden weiterhin nicht angelegt. `requireRole` prueft jetzt
User-Rolle und aktiven Session-Kontext, sodass ein Provider-Login keinen
Admin-Kontext und ein Admin-Login keinen Provider-Kontext vortaeuscht.
`GET /api/auth/me` liefert die zentrale Useridentitaet, Rollen sowie aktiven
Rollen- und Scope-Kontext. Ein neuer Magic-Link-Verify ersetzt die bestehenden
Web-Cookies durch die neue Session.

Der neue Multi-Role-Stand wurde mit dem realen autorisierten Andreas-Account
gegen Production geprüft. Provider-Request A, Admin-Request B und der erneute
Provider-Request C lieferten jeweils HTTP 200. Die zugehörigen geschützten
Deployment-Logs enthalten drei `magic_link_delivered`-Ereignisse mit jeweils
Microsoft-Graph-`sendMail`-Status 202 und keine Delivery-Fehler. Damit sind
beide Rollen serverseitig zugelassen und wiederholbarer Versand ist belegt;
die drei One-Time-Links selbst sowie Tokens werden nicht ausgegeben. Das
Öffnen und die anschließende Anzeige von `/provider/` bzw. `/admin/` bleibt
der externe Browser-Schritt durch Andreas.

## Admin-Browser-Smoke und Offer-UX (2026-08-20)

Der aktuelle Production-Admin-Request fuer den provisionierten Andreas-Account
sendet aus dem Web-Login explizit `role=admin` und liefert HTTP 200 mit dem
neutralen Accepted-Status. Der zugehoerige Delivery-Log bestaetigt erneut
Microsoft-Graph `sendMail` HTTP 202 ohne Delivery-Fehler. Die fruehere Anzeige
des generischen Frontend-Fehlers war damit kein Backend- oder Graph-Fehler;
der Web-Client hatte fuer fachliche Fehler nur einen pauschalen Fallback und
konnte einen veralteten statischen Clientstand aus dem Cache verwenden. Der
Client setzt den Submit waehrend des Requests auf busy, mappt bekannte
Berechtigungs-/Mailfehler freundlich und zeigt technische HTTP-/Statusdaten
nur im autorisierten `local_test`.

Die Provider-Offer-Uebersicht ist als Kartenansicht umgesetzt: Status-Badge,
kompakte Needs, lokalisierte Waehrungsformatierung, heutige Verfuegbarkeit,
Radius sowie letzte/naechste Bestaetigung stehen vor den statusgerechten
Aktionen. Die lokale Technikdiagnose ist ein separates aufklappbares Detail;
der Produktionsbereich zeigt sie nicht. Eine leere Liste bietet direkt das
Anlegen des ersten Offers an. Die Darstellung bleibt ohne Zeitzonen-Engine
und nutzt fuer die heutige Kurzinfo die lokale Browserzeit.

## Responsive Provider-Offer-Cards (2026-08-20)

Der reale Browserbefund zeigte zeichenweise Umbrueche in der Offer-Card. Die
Ursache war die allgemeine schmale `520px`-Auth-Karte in Kombination mit
einer reservierten Aktionsspalte; ausserdem erbte der Inhalt
`overflow-wrap:anywhere`. Provider-Seiten verwenden jetzt bis zu `1100px`,
die Card nutzt auf Desktop eine flexible Inhalts- und Aktionsaufteilung und
wechselt ab Tablet in eine Einspaltenstruktur. Normale Needs und Titel werden
nicht mehr zeichenweise gebrochen; nur normale Wortgrenzen beziehungsweise
lange untrennbare Werte duerfen umbrechen.

Die Card-Hierarchie bleibt Titel/Status, kompakte Needs, Preis/Heute/Radius,
sekundaere Bestaetigungsdaten und statusgerechte Aktionen. Bearbeiten ist die
primaere Aktion, weitere Aktionen sind dezenter. Der Fix ist rein responsives
Frontend-Layout und fuehrt keine neue Produktfunktion ein.

## Provider-Arbeitsmodus nach dem Onboarding (2026-08-21)

Der Provider-Webbereich leitet seinen Zustand jetzt aus den geladenen
Backend-Daten ab: Ohne vollstaendiges Profil oder gespeicherten Standort bleibt
der dreistufige Onboarding-Wizard sichtbar. Sobald Profil und Standort
vorhanden sind, wechselt die Seite in einen kompakten Arbeitsbereich; ohne
Offer zeigt er einen Empty State mit `Erstes Angebot anlegen`, mit mindestens
einem Offer das normale Dashboard.

Im Dashboard stehen Anbietername, Scope, Status und die Offer-Liste im
Vordergrund. Profil und Standort werden nur noch als kompakte Zusammenfassung
angezeigt und ueber `Profil & Standort bearbeiten` editiert. Der Offer-Editor
erscheint ausschliesslich fuer ein neues oder bestehendes Offer, hat immer
Abbrechen und kehrt nach Speichern zur aktualisierten Liste zurueck.

Need-Labels stammen aus der zentral geladenen DE/EN/ES-Taxonomie; unbekannte
Keys werden nicht als technische Rohtexte ausgegeben. Feedback bleibt fuer
Nutzer klar sichtbar, waehrend lokale technische Details einklappbar unter
`Technikdetails` liegen. Onboarding-UI verschwindet damit aus der primaeren
Oberflaeche, sobald die wiederkehrende Provider-Arbeitsaufgabe beginnen kann.

## Provider-Fotos und Standortkarte (2026-08-21)

Offer-Fotos sind auf drei Bilder je Offer begrenzt. Die API speichert nur
Cloudinary-Metadaten (`publicId`, `secureUrl`, Dimensionen, Format, Bytes,
Sortierung und Erstellzeit); Upload, Loeschen und Sortieren sind geschuetzte,
provider- und scope-gebundene Operationen. Bilder werden serverseitig als
Multipart-Daten geprueft und signiert zu Cloudinary hochgeladen. Base64 und
lokale Dateien sind nicht Teil des Uploadwegs. Die logische Ablage trennt
`local_test` und `production` sowie Provider und Offer.

Die Provider-Standortkarte nutzt einen separaten, browserseitig
eingeschraenkten Google-Maps-JavaScript-Key. Er wird nur fuer eine autorisierte
Provider-Session ueber `/api/provider/maps-config` geliefert und ist nicht der
serverseitige Places-Key. Nach einer Place-Auswahl werden Original- und
Korrekturmarker angezeigt; der Server bleibt mit der 25-Meter-Grenze
massgeblich. Die Maps-Routen-API wird nicht verwendet. Ohne die externen
Cloudinary- bzw. Maps-Runtimewerte bleiben Foto-Upload bzw. Kartenansicht
geschlossen oder als Text-Fallback sichtbar. Die vier Cloudinary-
Runtimevariablen sind in DigitalOcean inzwischen konfiguriert; ihre Werte
werden weder hier noch in Logs dokumentiert.

Die Provider-Karte trennt seit 2026-08-21 Anzeige und Bearbeitung klar: Im
Dashboard ist der Marker nicht verschiebbar und die Karte zeigt weder
Distanzfeedback noch Editierhinweise; die Aktion bleibt ausserhalb der Karte
`Profil & Standort bearbeiten`. Im Edit-Modus kennzeichnen lokalisierter
Drag-Hinweis, Distanzfeedback und Save/Cancel die Bearbeitung. Bei 0 m wird
`Google-Position unveraendert` angezeigt, bei mehr als 25 m wird der Marker
visuell als fehlerhaft markiert und Speichern clientseitig blockiert. Die
serverseitige 25-Meter-Validierung bleibt unveraendert verbindlich. Der
local_test-Banner und einklappbare Technikdetails bleiben davon getrennt.

Der Offer-Editor zeigt ausgewählte Bilder bereits vor dem Submit als lokale
Browser-Vorschau. Bei einem bereits bestehenden Offer startet der Upload nach
der Dateiauswahl unmittelbar über die geschützte Image-Route. Der Upload nutzt
`XMLHttpRequest.upload.onprogress` mit echten Browser-Bytes; Zustände sind
`selected`, `uploading`, `processing`, `uploaded` und `error`. Nach 100 Prozent
Browsertransfer wechselt die Anzeige ehrlich auf indeterminate Verarbeitung
für Backend/Cloudinary; es wird kein künstlicher Gesamtfortschritt behauptet.
Save bleibt während eines Uploads deaktiviert. Normale UI-Texte zeigen keine
technischen Dateinamen; Titelbild und Zählung sind in DE/EN/ES lokalisiert.
Nach erfolgreichem Server-Upload wird das Offer erneut geladen, sodass nur
persistierte Cloudinary-Metadaten als Erfolg gelten. Bei Teilfehlern bleiben
nicht hochgeladene Bilder zur sicheren Wiederholung erhalten. Ein
Cloudinary-Delete erfolgt vor der DB-Änderung; bei fehlender
Runtime-Konfiguration oder Delete-Fehler bleibt das Offer-Dokument
unverändert.

Ein gemeldeter Offer-Edit-Request mit `HTTP 504` und generischem
`request_failed` konnte im aktuellen DigitalOcean-Run-Log nicht einem
internen Backend-Fehler zugeordnet werden. Der inzwischen korrelierte echte
Foto-Request erreichte dagegen alle Phasen bis
`cloudinary_upload_started`; Cloudinary antwortete nach 885 bzw. 906 ms mit
HTTP 403 (`cloudinary_http_error` im damaligen Log), worauf der Backendpfad
`media_upload_failed` klassifizierte. Es gab keinen Timeout und keine Mongo-
Persistenz. Der Browser meldete für denselben Livebefund 504; ein
`response_sent`-Event war bis dahin nicht vorhanden, daher ist die Abweichung
zwischen Gateway-/Browserstatus und dem protokollierten Cloudinary-403 nicht
weiter rückwirkend auflösbar. Die neue Klassifizierung unterscheidet künftig
Authentifizierungsfehler von Forbidden-Fehlern, ohne Antwortinhalte zu loggen.

Der Uploadpfad verwendet weiterhin einen begrenzten Cloudinary-Request mit strukturierter
Phasenprotokollierung (`offer_image_upload_started`,
`offer_image_multipart_parsed`,
`offer_image_validation_passed`, `cloudinary_upload_started`,
`cloudinary_upload_completed`/`cloudinary_upload_failed`,
`offer_image_persisted`) eingegrenzt. Der Backend-Timeout beträgt standardmäßig
30 Sekunden und wird als `504 media_upload_timeout` zurückgegeben; Netzwerk-
und HTTP-Fehler werden kontrolliert als 502 klassifiziert. Logs enthalten nur
Correlation-ID, Scope, Bytes, MIME, Dauer, Upstream-Status und Error-Klasse.
Ein direkter Cloudinary-Test aus der lokalen Agent-Umgebung war wegen eines
Netzwerkfehlers nicht aussagekräftig; eine authentifizierte Production-
Offer-Session bzw. ein App-Platform-Exec für einen echten Runtime-Smoke steht
hier nicht zur Verfügung.
