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
