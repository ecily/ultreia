# Ultreia – operativer Projektkontext

Stand: 2026-08-28

Repository: `C:\coding\ultreia`

Branch: `main`

Dieses Dokument ist die operative Source of Truth für den aktuell gebauten,
getesteten und live verifizierten Stand von Ultreia. Es beschreibt den Iststand,
nicht automatisch den vollständigen V1-Zielumfang.

## Dokumenthierarchie

1. `docs/ULTREIA_CONTEXT.md` beschreibt den aktuellen operativen Gesamtstand.
2. `docs/ULTREIA_V1_PRODUCT_SPEC.md` beschreibt die verbindliche fachliche
   V1-Spezifikation und damit auch noch nicht implementiertes Zielbild.
3. `docs/adr/` enthält dauerhafte Architekturentscheidungen. Spätere
   Konsolidierungen übersteuern historische Annahmen ausdrücklich.
4. Auditdateien sind datierte historische Momentaufnahmen und keine operative
   Source of Truth.

Eine normative Aussage in der V1-Spezifikation oder einer ADR ist für sich kein
Implementierungs- oder Hardware-Nachweis. Für den Iststand gilt dieses Dokument
zusammen mit dem aktuellen Code, Tests und explizit dokumentierten Live- oder
Hardwareprüfungen.

## Projektgrenze

Ultreia.app ist ein eigenständiges Produkt für Pilger am Camino Francés von
Saint-Jean-Pied-de-Port bis Santiago de Compostela. Kaufklug und StepsMatch
gehören nicht zu diesem Projekt. StepsMatch darf ausschließlich als technische
Referenz dienen; Daten, Collections, Env-Werte, Credentials, Produktlogik,
Branding und Deployments werden nicht übernommen.

Secrets, Tokens, Passwörter, Connection Strings und Zertifikatsinhalte gehören
weder in Git noch in Dokumentation, Logs oder Antworten.

## Aktueller Status in Kurzform

### Implementiert

- öffentliches Webfrontend sowie Provider-, Admin- und Auth-Webflächen;
- Node.js-/Express-Backend und verbundene eigene MongoDB;
- Magic-Link-Auth, Access-/Refresh-Sessions und Rollen;
- strikt gebundene Scopes `production` und `local_test`;
- Provider-Self-Service mit Google-validiertem Standort;
- Offers mit Availability, Preisen, Radius, Bestätigung und bis zu drei Fotos;
- Google Places API (New), Google Maps JavaScript und Cloudinary-Anbindung;
- geschützte Admin-Grundfläche;
- Pilgerprofil-, Trip- und Need-Grundlage;
- manuell ausgelöstes serverseitiges Basis-Matching;
- technische Android-Grundlage für Device, Location, Heartbeat, Geofence und
  Push-Registrierung.

### Noch nicht implementiert oder nicht End-to-End bewiesen

- Route-first Matching, RouteKm, Korridor und Bewegungsrichtung;
- tatsächlicher Gehweg, Gehzeit und Umweg sowie eine Routes API;
- persistierte MatchEvents und getrennte Notification Policy;
- automatischer Match-Push;
- Offer-Stack, Navigation, Arrival und „Erledigt?“/`completed_for_trip`;
- Provider-Funnelstatistik;
- Ratings, strukturierte Meldungen und Trust-Moderation;
- Track, Stops, Export und persönliche Rückschau;
- produktseitiger Offline-Endausbau;
- vollständiger realer `local_test`-Hardware-/Browser-E2E des neuen
  Pilger-/Matching-Flows.

## A. Produkt und USP

Pilger wählen aktive Needs, stecken das Telefon weg und gehen weiter. Ultreia
soll nur dann aufmerksam machen, wenn ein passendes Angebot im aktuellen Weg-
und Zeitkontext plausibel relevant ist. Der gewünschte Aha-Moment lautet:
„Ich musste gar nicht suchen.“

Ultreia ist keine allgemeine Such-App, kein Branchenverzeichnis, Dealportal,
Booking- oder Maps-Ersatz. Sichtbarkeit entsteht durch Kontextrelevanz, nicht
durch beliebige Werbung. Es gibt keine Garantien für Öffnungszeiten,
Verfügbarkeit, freie Betten, Preise, medizinische Sicherheit,
Datenvollständigkeit, Reichweite, Umsatz oder Push-Zustellung.

Das fachliche Zielbild bleibt route-first:

```text
Camino-Route
+ aktiver Trip und aktive Needs
+ RouteKm, Korridor und Richtung
+ Offer-Radius als Kandidatenfilter
+ tatsächliche Geh-Erreichbarkeit
+ Verfügbarkeit, Trust, Dedupe und Cooldowns
=> erklärbarer Match
=> getrennte Notification Policy
=> zurückhaltender Push
```

Der aktuelle Basis-Matcher erfüllt dieses vollständige Zielbild noch nicht.

## B. Git und Live

Verifiziert am 2026-08-28:

- `HEAD`, lokales `origin/main` und GitHub `main`:
  `8ae5ba4b28951111815dc9f50266c470f40cd6e2`;
- `https://api.ultreia.app/api/health`: HTTP 200, Production,
  `commitShort=8ae5ba4`, Mongo verbunden;
- `https://api.ultreia.app/api/ready`: HTTP 200, `status=ready`;
- `https://ultreia.app/`: HTTP 200; das ausgelieferte HTML entsprach
  normalisiert dem lokalen `frontend/index.html`;
- `/provider/`, `/admin/`, `/auth/verify/` und das Hero-Video waren erreichbar.

DigitalOcean App Platform deployt Backendänderungen von `main` automatisch.
Das Deploymentmanifest bindet `COMMIT_SHA` an `${_self.COMMIT_HASH}`, sodass
Health den tatsächlich gebauten Commit meldet.

## C. Backend und API

Das Backend verwendet Node.js, Express 5 und den nativen MongoDB-Treiber. Es
enthält heute folgende Funktionsbereiche:

- Health und Readiness;
- zentrale Taxonomie und aktive Needs;
- Device-, Push-, Location-, Geofence- und technische Diagnostikrouten;
- Magic-Link-Auth, Sessionrefresh, Scopewechsel, Logout und Accountlöschung;
- Pilger-/Providerprofile und Trip-Lifecycle;
- Providerstandort, Offers und Medien;
- geschützte Adminrouten;
- Pilger-Needs und aktuelles Basis-Matching.

Requestgrößen, CORS, sensible technische Routen und Fehlerausgaben sind
begrenzt. Logs redigieren Tokens, URIs, Credentials und Schlüsselwerte. Eine
Routes API, Route-Domäne, automatische Notification Policy und
Produktnavigation existieren noch nicht.

## D. MongoDB

Production verwendet die eigene Datenbank `ultreia_production`. Live Health
und Ready belegen die aktuelle Verbindung. Beim Startup werden Indizes
idempotent angelegt.

Vorhandene technische Datenbereiche umfassen `devices`, `pushRegistrations`,
`locationHeartbeats`, `geofenceEvents` und `diagnosticEvents`. Fachliche und
Auth-Bereiche umfassen unter anderem `users`, `pilgrimProfiles`,
`providerProfiles`, `magicLinks`, `sessions`, `trips`, `needs`,
`pilgrimNeeds`, `offers` und `auditEvents`.

Geoindizes bestehen für Geräte-/Heartbeatpositionen. Heartbeats,
Diagnoseevents, Magic Links und Sessions besitzen passende TTL-Indizes. Ein
partieller Unique-Index erzwingt höchstens einen nicht abgeschlossenen Trip je
Pilger und Scope.

Track-, MatchEvent-, NotificationEvent-, Arrival-, Rating- und
Provider-Funnelmodelle sind noch nicht implementiert.

## E. Auth, Sessions und Rollen

Die gemeinsame Auth-Basis verwendet die Rollen `pilgrim`, `provider` und
`admin`; die fachlichen Profile bleiben getrennt. Ein User kann mehrere Rollen
besitzen. Ein Magic Link speichert die angeforderte Rolle, und eine Session
enthält `activeRole`, serverseitig abgeleitete `allowedRoles` sowie den Scope.

Magic Links sind kryptographisch zufällig, kurzlebig, nur einmal verwendbar und
werden in MongoDB nur gehasht gespeichert. Access-Tokens sind kurzlebig;
Refresh-Tokens werden serverseitig gehasht und bei Nutzung rotiert. Die
Refresh-Session bleibt bis zu 30 Tage Inaktivität nutzbar. Scope und aktive
Rolle bleiben bei Rotation erhalten.

Provider- und Admin-Websessions verwenden HttpOnly-/Secure-Cookies mit
`SameSite=Lax` und Origin-Prüfung bei schreibenden Cookie-Anfragen. Logout
widerruft die Serversession und löscht die Cookies. Ein neuer Magic-Link-Verify
ersetzt den bestehenden Web-Sessionkontext.

Production-Magic-Links werden über Microsoft Graph mit einer dedizierten,
außerhalb des Repositories konfigurierten Ultreia-Absendermailbox versendet.
Mehrere Live-Requests lieferten HTTP 200; die geschützten Backend-Events
belegen Graph `sendMail` mit Upstream HTTP 202. Der konkrete `MAIL_FROM`-Wert
wird nicht im Repository dokumentiert. Eine spätere zusätzliche Exchange-
Application-RBAC-Begrenzung bleibt optionale Härtung.

## F. `production` und `local_test`

`production` ist der Default. `local_test` ist im Production-Backend nur für
serverseitig autorisierte Admin-/Test-Accounts verfügbar. Der Scope wird beim
Auth-Flow ausdrücklich angefordert oder über die geschützte Scopewechselroute
gewechselt. Der Server widerruft dabei die alte Session und erzeugt eine neue
Session mit dem Ziel-Scope.

Provider-, Offer-, Pilger-, Trip-, Device-, Location- und Matchingzugriffe
werden an den Session-/Request-Scope gebunden. Ein Browserheader, Querywert,
Bodyfeld oder Local Storage kann den Scope nicht eigenmächtig festlegen.
Cross-Scope-Anfragen werden abgewiesen. `local_test` wird in den Oberflächen
als „TESTDATEN – NICHT PRODUKTIV“ markiert.

Die Matchingpipeline soll später fachlich dieselbe wie in Production sein.
Heute ist in beiden Scopes nur das Basis-Matching vorhanden.

## G. Provider

Der Provider-V1-Flow ist implementiert:

```text
Magic-Link-Login
→ Providerprofil
→ Google-validierter Standort
→ erstes oder weiteres Offer
→ laufende Pflege
```

Ein Provider-Account repräsentiert in V1 genau einen physischen Standort und
kann mehrere Offers besitzen. Providerprofile und Offers werden ausschließlich
über `userId` plus Session-Scope gelesen und verändert. Der Server prüft Rolle,
Ownership und Scope.

Die Weboberfläche besitzt einen Onboardingmodus sowie nach vollständigem
Profil/Standort einen kompakten Arbeitsbereich mit Offer-Liste und Editor.
DE/EN/ES, responsive Darstellung, nachvollziehbare Validierung und nur im
autorisierten `local_test` sichtbare kompakte Technikdetails sind vorhanden.

Ein vollständiger aktueller Realnachweis derselben Browserkette von Login über
Scopewechsel und Places bis zum Offer bleibt Teil des nächsten E2E-Blocks.

## H. Offers und Fotos

Offers unterstützen:

- eine oder mehrere aktive Need-Kategorien;
- Titel, Beschreibung und Quellsprache;
- strukturierte Preisarten `free`, `fixed`, `from`, `range`, `donativo` und
  `on_request`;
- strukturierte wöchentliche Availability und Ausnahmen;
- Radius von 50 bis 1000 m;
- Status, Pause, Reaktivierung und 30-Tage-Bestätigung;
- bis zu drei Bilder.

Fotos werden als validierte Multipart-Daten serverseitig signiert an
Cloudinary übertragen. MongoDB speichert nur Metadaten. Upload, Löschen und
Reorder prüfen Ownership und Scope; die logischen Cloudinary-Pfade trennen
`production` und `local_test` sowie Provider und Offer. Reorder speichert die
vollständige `publicId`-Reihenfolge atomar. Desktop-DnD, Pointer-/Touch-Drag
und Nach-oben-/Nach-unten-Buttons als Keyboard-/Mobile-Fallback sind vorhanden.

Der Upload funktioniert im eingerichteten Entwicklungsstand. Die dafür
temporär erweiterte Product-Environment-Admin-Berechtigung ist ausdrücklich
keine finale Sicherheitskonfiguration. Vor einer externen Beta muss Cloudinary
auf die tatsächlich benötigten Upload-/Folder-Rechte nach Least Privilege
zurückgeführt und erneut real getestet werden.

## I. Google Places und Maps

Google Places API (New) wird ausschließlich serverseitig über einen
authentifizierten Backend-Proxy mit expliziten Field Masks verwendet. Der
Places-Key wird weder an den Browser geliefert noch in Git gespeichert.

Geografie wird aus dem autorisierten Scope abgeleitet:

- `local_test`: Österreich (`at`);
- `production`: Spanien und Frankreich (`es`, `fr`).

Beim Speichern lädt der Server Place Details erneut. Original- und finale
GeoJSON-Koordinaten werden unterschieden; eine Marker-Korrektur ist auf 25 m
begrenzt. Für die Providerkarte existiert ein separater, browserseitig
eingeschränkter Google-Maps-JavaScript-Key, der nur nach Provider-
Authentifizierung ausgeliefert wird. Anzeige- und Editiermodus der Karte sind
getrennt.

Es gibt noch keine Google Routes API, keine Walking-Directions-Integration und
keine Produktnavigation.

## J. Admin

Die Admin-Grundfläche ist über `requireAuth`, Adminrolle, `activeRole` und
Session-Scope geschützt. Vorhanden sind:

- Übersicht und Statuszählungen;
- Provider- und Offer-Listen mit Suche/Filter;
- Need-Liste und begrenzte Need-Mutationen;
- berechenbare Datenqualitätsprobleme;
- Provider-/Offer-Statusmutationen;
- schlanke `auditEvents` für Mutationen.

Adminrouten lesen oder verändern nur den aktiven Session-Scope. Pilgerdaten,
Livepositionen, Routes, Match-/Notificationdiagnostik, Ratings/Meldungen,
vollständige Übersetzungsverwaltung, Seedwerkzeuge, Audit-Historienansicht und
Provider-Funnelstatistik sind noch nicht Teil dieser Grundfläche.

## K. Pilger

Die gemeinsame Auth-Basis kann Pilger anlegen und anmelden. Pilgerprofil und
Device bleiben getrennte Identitäten. Die Android-App enthält einen reduzierten
Pilgerbereich mit DE/EN/ES für Trip, Need-Auswahl und aktuelle Matches sowie
weiterhin ein technisches Diagnosepanel.

Der derzeitige UI-Flow ist eine Test-/Foundation-Oberfläche, noch nicht das
vollständige V1-Onboarding. Insbesondere fehlen automatische Routenerkennung,
Offer-Stack, Navigation, Arrival, Erledigt, Track, Offline, Ratings und
Rückschau.

## L. Trips

Trips besitzen die Zustände `active`, `paused` und `completed`. Pro Pilger und
Scope ist höchstens ein nicht abgeschlossener Trip erlaubt. Create, Current,
List, Pause, Resume und Complete sind implementiert und race-sicher durch den
Mongo-Index abgesichert.

Ein pausierter Trip behält Needs und Zustand, liefert aber keine Matches. Die
aktuelle Test-App startet einen Trip mit einfachem Route-Context-Text. Eine
echte Camino-Routen-/Abschnittserkennung und die fachliche Startbestätigung
existieren noch nicht.

## M. Needs

Der kuratierte V1-Katalog enthält 40 aktive, zentral verwaltete Needs mit
DE/EN/ES-Labels. Er wird aus der Shared Taxonomy idempotent in MongoDB
eingespielt und über `/api/needs` konsumiert.

Pilger-Needs werden je `userId + tripId + scope + needKey` gespeichert. Sie
unterstützen `active`, `urgency` (`now`, `today`, `always`), `pushEnabled` und
`priorityOrder`. Die eindeutige Kombination ist durch einen Mongo-Index
gesichert. Die Android-Grundfläche kann Needs aktivieren/deaktivieren; der
vollständige Priorisierungs- und Push-Einstellungsflow der V1-Spezifikation ist
noch nicht umgesetzt.

## N. Basis-Matching

`POST /api/pilgrim/matches/current` ist für eine aktive Pilger-Session
implementiert. Die aktuelle Logik prüft:

1. aktiven, nicht pausierten Trip;
2. aktive Pilger-Needs;
3. letzte an den Pilger gebundene Geräteposition im selben Scope;
4. aktiven Provider im selben Scope;
5. aktives Offer im selben Scope;
6. gültige Offer-Bestätigung;
7. aktuell strukturierte Öffnungs-/Availability-Fenster;
8. Need-Überschneidung und gültigen Offer-Radius;
9. Haversine-Distanz zwischen Geräte- und Providerkoordinate.

Sortiert wird nach `now`, `today`, `always` und danach nach technischer
Distanz. `local_test` darf kompakte Matchgründe sehen; Production erhält keine
Diagnosegründe.

**Diese Distanz ist keine Gehstrecke und kein Umweg.** Sie ist eine
Haversine-/Radius-Basisdistanz. Route, RouteKm, Korridor, Bewegungsrichtung,
Walking Directions, MatchEvents, Notification Policy und automatischer Push
sind noch nicht implementiert.

## O. Android, Device, Location und Push-Unterbau

Die Android-first-App verwendet Expo SDK 53, React Native 0.79.5 und das Paket
`com.ecily.ultreia`. Der Standalone-Production-Build enthält sein JS-Bundle,
verwendet `https://api.ultreia.app/api` und benötigt weder Expo Go noch Metro.
Ultreia besitzt einen eigenen Expo-/Firebase-/FCM-Kontext; geschützte Dateien
und Credentials bleiben außerhalb von Git.

Technisch implementiert sind stabile SecureStore-Device-ID,
Notification-Channels, Expo-Push-Token-Registrierung, Foreground-/Background-
Location-Task, Heartbeat, lokale Notification, technischer Geofence und eine
geschützte operatorseitige Server-Push-Testschleuse.

Dieser Unterbau ist noch keine automatische Produkt-Pushpipeline. Die APK
enthält keinen Push-Testschlüssel und kann den geschützten Production-Test
nicht selbst auslösen.

## P. UX und Design

Die öffentliche Startseite, Provider-Weboberfläche und Admin-Oberfläche folgen
dem kleinen V1-Designsystem:

- Camino-Blau für Orientierung und Primärstruktur;
- Gelb nur für nächste Handlung oder relevante Nähe;
- warme Cream-/Stone-Flächen;
- Grün sekundär für bestätigte positive Zustände;
- klare Sprache, große Touch-Ziele und sichtbare Fokuszustände.

Die Camino-UX-Recherche bestätigt eine ruhige, route- und serviceorientierte
Darstellung konkreter lokaler Informationen. Die Landingpage kommuniziert den
Kernfluss „Need benennen, Telefon weglegen, nur bei relevanter Nähe wieder
Aufmerksamkeit erhalten“. Das optionale Hero-Video wird auf Desktop verzögert
geladen; Mobile, Reduced Motion und Data Saver verwenden das Poster.

Diese Gestaltung ist kein Nachweis für Routes, Navigation, Background-
Matching, automatische Pushes, Ratings oder Monetarisierung.

## Q. Security und Privacy

- Runtime-Secrets liegen nicht im Repository.
- Magic-Link-, Access- und Refresh-Tokens werden serverseitig gehasht.
- Webcookies sind HttpOnly/Secure; schreibende Cookie-Anfragen prüfen Origin.
- Rollen, aktiver Rollen-Kontext, Ownership und Scope werden serverseitig
  geprüft.
- Provider erhalten keine personenbezogenen Pilger-, Positions- oder
  Tripdaten.
- Productionantworten zeigen keine `local_test`-Matchdiagnosen.
- Logs und öffentliche Statusantworten geben keine Tokens, Keys oder URIs aus.
- Accountlöschung deaktiviert den Account, widerruft Sessions und behandelt
  bestehende Providerprofile scopeübergreifend.

Noch offen sind die vollständigen Retentionregeln, künftige Track-/Export-
Löschkaskaden, Rating-/Meldungsdaten, finale Adminrechte und Auditaufbewahrung.

## R. Tests und reale Nachweise

### Automatisiert getestet

Am 2026-08-28 liefen lokal ohne fachliche Live-Mutationen:

- Backend: 55/55 Tests grün;
- Frontend: 14/14 Tests grün;
- Shared-Taxonomy-Validator: grün;
- `git diff --check`: grün bis auf den bereits vorhandenen erwarteten
  Zeilenendhinweis im AndroidManifest.

Die Tests decken unter anderem Auth, One-Time-Magic-Links, Sessions, Rollen,
Scope, Trips, Provider-Ownership, Places-Verträge, Offers, Fotos, Admin-Scope,
Pilger-Needs, Basis-Matching, CORS und technische Routen ab. Automatisierte
Tests ersetzen keinen Browser- oder Hardware-E2E.

### Live API getestet

- Health und Ready sind HTTP 200;
- MongoDB ist verbunden;
- Live-Commit entspricht GitHub `main`;
- Microsoft-Graph-Magic-Link-Requests wurden serverseitig mit Upstream 202
  belegt;
- geschützte Routen weisen nicht authentifizierte Zugriffe ab.

### Real im Browser getestet

Historisch dokumentiert sind reale Provider-/Admin-Loginrequests, Provider-
Offer-UX-Befunde, responsive Korrekturen und Foto-/Reorder-Befunde. Die
öffentlichen Webflächen sind aktuell erreichbar. Ein neuer vollständiger,
durchgängiger Browser-E2E von Providerlogin über `local_test`, Places und Offer
bis zum Pilger-Match ist noch nicht durchgeführt.

### Real auf Android-Hardware getestet

Auf einem Xiaomi `23090RA98G` mit Android 16 wurden real nachgewiesen:

- Installation und stabiler Start der Standalone-APK;
- Foreground-, Background-Location- und Notification-Permissions;
- Device-Registrierung;
- Foreground-Position und Production-Heartbeat;
- Expo-Push-Token-Erzeugung und Backendregistrierung;
- sichtbare lokale Notification;
- technische Geofence-Registrierung;
- fortbestehender App-/Location-Task bei ausgeschaltetem Bildschirm.

Nicht real nachgewiesen sind ein neuer Background-Heartbeat nach tatsächlicher
Bewegung, ein physischer Geofence-ENTER, sichtbare Server-Push-Zustellung und
die vollständige neue Pilger-/Trip-/Need-/Basis-Match-Kette auf Hardware.

## S. Offene MVP-Blöcke

### `local_test`-MVP-Ampel

| Glied | Status | Begründung |
|---|---|---|
| Provider | GELB | Self-Service, Auth, Scopewechsel, Places und Standortmodell sind vorhanden; die vollständige aktuelle reale Browserkette ist noch nicht durchgehend bewiesen. |
| Offer | GELB | CRUD, Availability, Radius, Bestätigung und Fotos sind vorhanden; der vollständige aktuelle `local_test`-E2E mit externen Diensten bleibt zu beweisen. |
| Need | GRÜN | Zentraler 40-Need-Katalog und tripgebundene Pilger-Needs sind vorhanden und automatisiert getestet. |
| Pilger | GELB | Auth, Trip-/Need-UI, Position und Heartbeat sind vorhanden; die neue Produktkette ist noch kein Hardware-E2E. |
| Match | GELB | Das Basis-Matching ist implementiert und automatisiert getestet, aber noch nicht real als vollständige lokale Hardwarekette bewiesen und noch nicht route-first. |
| Push | ROT | Der technische Unterbau existiert, aber automatische Match-Pushes und Notification Policy fehlen. |
| Navigation | ROT | Keine Produktnavigation und keine Routes API. |
| Arrival | ROT | Keine Ankunftserkennung. |
| Erledigt | ROT | Kein „Erledigt?“-Flow und kein `completed_for_trip`. |
| Statistik | ROT | Keine Provider-Funnelstatistik; Admin-Bestandszähler sind kein Funnel. |

### Nächstes operatives Ziel

Vollständiger realer `local_test`-Hardware-/Browser-Nachweis bis zum
Basis-Match:

```text
Provider
→ Standort
→ Offer
→ Pilger
→ Test-Trip
→ Need
→ reale Android-Position
→ Basis-Match
```

Dieser Beweisblock enthält noch keinen automatischen Push, keine Routes API und
keine Navigation.

### Danach geplante Reihenfolge

1. `local_test` Hardware-/Browser-E2E bis Basis-Match;
2. Route, RouteKm, Richtung, tatsächlicher Gehweg und Umweg;
3. MatchEvents, Notification Policy und automatischer Push;
4. Offer-Stack, Navigation, Arrival und Erledigt;
5. Provider-Funnel und erweiterte Admin-Diagnostik.

### OPEN – nicht eigenmächtig entscheiden

- konkrete globale, Need- und Offer-Cooldowns;
- tägliches Pushlimit und kritische Übersteuerungsregeln;
- konkrete Routegeometrie und Routes-/Directions-Anbieter;
- finale Arrival-Schwelle und Stop-Erkennungsparameter;
- Track-, Log- und Diagnose-Retention;
- Offline-Synchronisations- und Konfliktregeln;
- Bewertungsaggregation und Eskalationsschwellen;
- endgültiger Provider-Verifikations-/Moderationsworkflow;
- finale Adminrechte und Auditaufbewahrung.

## Historische Dokumentation

Frühere Audits und ältere datierte ADR-Abschnitte bleiben als
Entstehungsgeschichte nützlich, beschreiben aber nicht den heutigen
Implementierungsstand. Insbesondere `docs/ULTREIA_REPO_AUDIT.md` dokumentiert
einen frühen Foundation-Commit. Lokale, nicht versionierte Audit- oder
Hero-Arbeitsdateien werden nicht automatisch Teil der operativen Source of
Truth.

Historische Detailchronologie wird nicht mehr in diesem Context wiederholt.
Die Git-Historie und ADRs bewahren die einzelnen Entwicklungsschritte.

## Arbeitsregeln

- Vor technischen Aufgaben zuerst dieses Dokument und für Produktregeln die
  V1-Spezifikation lesen.
- Implementiert, automatisiert getestet, live geprüft, im Browser geprüft und
  auf Hardware geprüft immer getrennt benennen.
- Keine V1-Zielanforderung ohne Evidenz als bestehende Funktion ausgeben.
- Keine Secrets oder personenbezogenen Testdaten dokumentieren.
- Keine Fremdprojektartefakte übernehmen.
- Kein Push oder Deployment ohne ausdrückliche Freigabe.

## Temporäre Abschaltung neuer Magic Links (2026-09-13)

Zum Schutz vor unerwünschter/missbräuchlicher Nutzung während der Entwicklung
sind neue Magic-Link-Requests temporär deaktiviert. `MAGIC_LINK_ENABLED=false`
ist der serverseitige Default in allen Umgebungen und der vorgesehene
Production-Runtimewert. Nur explizites `true` aktiviert die Anforderung wieder;
die Runtimekonfiguration wird beim Prozessstart gelesen (Redeploy erforderlich).

`POST /api/auth/magic-link/request` liefert für alle Rollen und Scopes HTTP 503
mit `status=magic_link_temporarily_disabled`, bevor Accountsuche, Token-Erzeugung,
Datenbankmutationen oder Microsoft Graph erreicht werden. Es gibt keinen
Operator-/Client-Bypass. Die Service-Methode prüft den Flag zusätzlich.
Bestehende Accounts, Profile, Rollen, activeRole, allowedRoles und Scopes werden
durch die Abschaltung nicht geändert. Access-/Refresh-Sessions, Logout und Verify
bereits versendeter One-Time-Links bleiben erhalten; die Link-TTL beträgt
standardmäßig 15 Minuten. Die Autharchitektur wird nicht zurückgebaut.

Die vorhandenen Provider-/Admin-Weblogins behandeln den Serverstatus mit einer
DE/EN/ES-Meldung und deaktivieren den Sende-Button nach der Antwort. Ein eigener
Pilger-Weblogin existiert derzeit nicht; die Sperre schützt auch den Pilger-API-
und Mobile-Request. Der gemeinsame Web-Loginhandler ist für alle Rollen getestet.

Automatisiert: Backend 63/63 und Frontend 23/23 Tests grün, einschließlich
Sperre ohne DB-/Mailzugriff, Rollen-/Scope-Erhalt, Refresh, Logout und Verify.
Details zur Reaktivierung und zu den bestehenden Rate-Limit-Grenzen stehen in
`docs/ULTREIA_MICROSOFT_MAIL_OPERATOR.md`. Live-Nachweise werden nach dem
Deployment getrennt ergänzt; ältere Versandnachweise oben sind historisch.
