# Ultreia Context

Stand: 2026-06-22

## Projekt

Projektname: Ultreia.app
Domain: `ultreia.app`
Lokaler Pfad: `C:\coding\ultreia`
Operative Source of Truth: `docs/ULTREIA_CONTEXT.md`

## Grundsatzentscheidung

Ultreia.app ist ein eigenständiges Produkt für Pilger am Camino.

Ultreia.app nutzt bewährte Technik und Erkenntnisse aus StepsMatch.com, bleibt aber strikt getrennt:

- eigenes Projekt
- eigene Produktlogik
- eigene Marke
- eigene Sprache
- eigene Kategorien
- eigene Daten
- eigene Roadmap
- eigene Commits
- eigene Deploys
- eigene Risiken
- eigene To-dos
- eigene Kontextdatei

StepsMatch.com bleibt das technische Labor. Ultreia.app wird der erste echte, belastbare Beachhead.

Architekturentscheidung: Option C ist entschieden. Ultreia.app nutzt StepsMatch.com gezielt als technisches Labor, bleibt aber eigenständiges Repo und Produkt. Dokumentiert in `docs/adr/ADR-0001-technical-bootstrap-from-stepsmatch.md`.

Architekturanalyse: Das StepsMatch-Modulinventar wurde als reine Analyse angelegt. Dokumentiert in `docs/adr/ADR-0002-stepsmatch-module-inventory.md`.

MVP-Entscheidung: Der fachliche MVP-Scope ist entschieden. Ultreia startet geografisch mit dem gesamten Camino Francés von Saint-Jean-Pied-de-Port bis Santiago de Compostela, bleibt funktional aber ein MVP. Dokumentiert in `docs/adr/ADR-0003-ultreia-mvp-scope.md`.

Taxonomie-Entscheidung: Die Need-/Kategorie-Taxonomie wurde recherchiert und fachlich priorisiert. Dokumentiert in `docs/adr/ADR-0004-need-category-research.md`.

i18n-Entscheidung: Deutsch, Englisch und Spanisch sind ab Projektstart Pflicht. Das gilt für Mobile App, öffentliches Web und Anbieter-/Provider-Frontend. Dokumentiert in `docs/adr/ADR-0005-i18n-from-start.md`.

Datenmodell-Entscheidung: Die fachlichen und technischen Datenmodell-Grundsätze sind entschieden, aber noch ohne Code, Mongoose-Schemas oder MongoDB-Migrationen. Dokumentiert in `docs/adr/ADR-0006-data-model-principles.md`.

Repo-Entscheidung: Ultreia wird als eigenständiges Monorepo mit `backend/`, `mobile/`, `frontend/`, `shared/` und `docs/` aufgebaut. Dokumentiert in `docs/adr/ADR-0007-repo-code-scaffold.md`.

## Projektgrenze

Für Ultreia gilt:

- Keine Vermischung mit StepsMatch.com oder anderen Projekten.
- Keine StepsMatch-spezifischen Demo-Daten, Graz-Testdaten oder Laborentscheidungen übernehmen.
- StepsMatch darf als technische Referenz dienen, aber nicht als operative Source of Truth für Ultreia.
- Operative Source of Truth ist ausschließlich `docs/ULTREIA_CONTEXT.md`.
- Codex muss vor jeder technischen Aufgabe zuerst `docs/ULTREIA_CONTEXT.md` lesen.
- Nach relevanten Erkenntnissen oder Änderungen muss `docs/ULTREIA_CONTEXT.md` schlank aktualisiert werden.
- Keine Secrets, vollständigen Tokens oder vollständigen E-Mails in Docs, Logs oder Antworten.
- Kein Push, Deploy, App-Build oder DB-Mutation ohne explizite Freigabe.

## Produktthese

Ultreia begleitet Pilger ruhig auf dem Camino und meldet sich nur, wenn in der Nähe etwas relevant ist, das zu ihrem aktuellen Bedürfnis und Wegkontext passt.

Der Pilger soll nicht suchen müssen. Er soll gehen können.

Ultreia erkennt:

- wo der Pilger ist
- auf welcher Route/Etappe er sich befindet
- welche Bedürfnisse er ausgewählt hat
- welche Orte, Hinweise oder Services in der Nähe relevant sind
- ob ein Ort direkt am Weg oder knapp abseits liegt
- ob der Zeitpunkt sinnvoll ist
- ob eine Benachrichtigung wirklich gerechtfertigt ist

## Produktkern in einem Satz

Ultreia ist ein ruhiger Camino-Begleiter, der Pilger unterwegs auf relevante Orte, Hinweise und Services aufmerksam macht, ohne sie mit unnötigen Benachrichtigungen zu stören.

## Ultreia ist ausdrücklich nicht

- kein generisches Dealportal
- kein klassisches Branchenverzeichnis
- kein Google-Maps-Ersatz
- kein Booking-Ersatz
- kein Gutscheinportal
- kein lauter Tourismus-Guide
- kein Anbieter-Marktplatz ohne Pilgernutzen
- kein Produkt mit Garantien auf freie Betten, Kunden, Verkäufe oder Besuche

## Beachhead

Geplanter erster Beachhead: Camino Francés.

Fachlich entschieden: Der MVP umfasst geografisch den gesamten Camino Francés von Saint-Jean-Pied-de-Port bis Santiago de Compostela. Er ist nicht auf 3-5 Etappen beschränkt.

Begründung:

- klare Route
- hohe Pilgerfrequenz
- wiederkehrende Bedürfnisse
- ortsfremde Nutzer
- Nutzer wollen gehen, nicht ständig suchen
- kleine Abweichungen vom Weg können relevant sein
- Anbieter knapp neben dem Camino sind oft unsichtbar
- Zielgruppe ist über Camino-Foren, Gruppen, Blogs, Herbergen und Community-Kanäle grundsätzlich erreichbar

Wichtig: Der geografische Raum ist vollständig, aber die Funktionalität und POI-Abdeckung bleiben MVP-begrenzt. Es gibt keine Garantie auf vollständige POI-Abdeckung, Anbieterabdeckung, Verfügbarkeit, freie Betten, Preise oder Öffnungszeiten.

## Nutzer

Primäre Nutzer:

- Pilger am Camino
- Menschen, die den Camino konkret planen
- Erstpilger
- Pilger, die nicht ständig auf das Handy schauen wollen
- Pilger mit klaren Bedürfnissen unterwegs

Wichtige Nutzerbedürfnisse:

- Unterkunft
- Essen
- Wasser
- Supermarkt
- Apotheke
- medizinische Hilfe
- Geldautomat
- Ausrüstung
- Stempelstelle
- Waschmöglichkeit
- Sehenswürdigkeiten
- ruhige Orte
- Bus/Taxi
- Hinweise auf wichtige Abzweigungen oder Services knapp abseits des Wegs

## Anbieter / Orte

Ultreia denkt nicht zuerst in Anbietern, sondern in Pilger-Needs.

Mögliche spätere Anbieter oder Orte:

- Herbergen
- private Unterkünfte
- Cafés
- Bars
- Restaurants
- Supermärkte
- Apotheken
- Ärzte
- Ausrüstungsshops
- Stempelstellen
- Tourismusbüros
- Kirchen
- Sehenswürdigkeiten
- Wasserstellen
- Transportdienste

Wichtig:

Ein Ort darf angezeigt werden, wenn er sauber als öffentlicher/redaktioneller Hinweis gekennzeichnet ist.
Ein Ort darf nur als offizieller Anbieter/Partner erscheinen, wenn er selbst teilnimmt oder zugestimmt hat.

## Content-Typen

Ultreia sollte von Anfang an unterschiedliche Inhaltstypen sauber trennen.

Stand MVP-Scope: ADR-0003 definiert erste Content-Typen als `editorial_place`, `official_participating_place` und `demo_test_place`.

Stand i18n: Alle Oberflächen und Systemtexte müssen Deutsch, Englisch und Spanisch unterstützen. Spanisch ist für Anbieter entlang des Camino wahrscheinlich die erste Arbeitssprache. Push-Texte und Systemlabels müssen die bevorzugte Sprache respektieren.

### 1. Pilgrim Need

Das Bedürfnis des Pilgers.

Beispiele:

- sleep
- eat
- drink
- pharmacy
- medical help
- grocery
- cash
- stamp
- gear
- laundry
- sightseeing
- quiet place
- transport

### 2. Place

Ein Ort entlang oder nahe am Camino.

Beispiele:

- hostel
- café
- farmacia
- supermarket
- church
- fountain
- viewpoint
- shop
- doctor
- tourism office

### 3. Prompt

Der konkrete Hinweis im richtigen Moment.

Beispiele:

- "Apotheke 120 m rechts vom Camino."
- "Supermarkt knapp voraus, heute nur noch bis 14:00 geöffnet."
- "Herberge leicht abseits des Wegs."
- "Wasserstelle vor dem nächsten längeren Abschnitt."
- "Sehenswürdigkeit direkt am Weg."

## Benachrichtigungsprinzip

Ultreia darf nur melden, wenn der Hinweis relevant genug ist.

Grundregeln:

- wenige Pushes
- keine Spam-Wahrnehmung
- Prioritäten nach Bedürfnis
- Tageszeit berücksichtigen
- Entfernung und Wegkontext berücksichtigen
- keine Wiederholungen
- Unterdrückung dokumentieren
- Nutzer muss Kategorien granular steuern können

Beispielhafte Logik:

- Apotheke: wichtiger Push, wenn aktiv gewünscht und in sinnvoller Nähe.
- Unterkunft: eher ab Nachmittag relevant.
- Restaurant: eher zu Essenszeiten relevant.
- Wasser: abhängig von Abschnitt und Distanz.
- Sehenswürdigkeit: eher leiser Hinweis oder In-App, nicht dauernd Push.
- Supermarkt: besonders relevant vor Ladenschluss oder vor dünner Infrastruktur.

## Technischer Unterschied zu StepsMatch

StepsMatch-Laborlogik:

> Nutzer ist irgendwo. Inhalt ist im Radius.

Ultreia-Produktlogik:

> Pilger ist auf einer Route. Ein Ort ist relevant, weil er zum aktuellen Need passt, entlang des Wegs oder knapp abseits liegt und zum Zeitpunkt sinnvoll ist.

Ultreia braucht daher später zusätzlich:

- Camino-Route als Geometrie
- Distanz des Nutzers zum POI
- Distanz des POI zur Route
- Abzweigungsdistanz vom Weg
- Richtung / Etappenlogik
- Tageszeitlogik
- Offline-/Low-connectivity-Verhalten
- Caching relevanter Inhalte
- mehrsprachige UX
- starke Push-Frequenzkontrolle

## Technische Bausteine aus StepsMatch

Option C ist die gültige Bootstrap-Strategie: keine Full-Copy-/Rebranding-Strategie, sondern bewusst geprüfte technische Übernahmen aus StepsMatch.

Stand: Das StepsMatch-Modulinventar liegt als Analyse in ADR-0002 vor. Es erlaubt keine Dateiübernahme und keinen Code-Transfer.

Ultreia darf technische Erkenntnisse und bewährte Bausteine aus StepsMatch übernehmen:

- Background Location
- Heartbeat
- Geofencing/Radiuslogik
- Push/Local Notification
- Interest-/Need-Matching
- Karten-/Navigationslogik
- Provider-/Place-Erstellung als technisches Muster
- Demo-/Content-Kennzeichnung
- Logging- und Diagnosekonzepte
- Match Reasons
- Notification Throttling
- PushToken-State-Erkenntnisse
- Feed-Retry-Erkenntnisse
- Field-Test-Erkenntnisse

Nicht ungeprüft übernehmen:

- StepsMatch-Wording
- StepsMatch-Kategorien
- StepsMatch-Anbieterlogik
- Graz-Testdaten
- generische Offer-Sprache
- Web-UX ohne Camino-Anpassung
- Radius-only-Logik als finale Produktlogik

## Erste harte Hypothesen

Ultreia funktioniert nur, wenn folgende Annahmen stimmen:

1. Pilger haben unterwegs echte orts- und zeitabhängige Bedürfnisse.
2. Pilger wollen nicht ständig aktiv suchen.
3. Pilger akzeptieren Standort und Push, wenn Nutzen und Vertrauen klar sind.
4. Wenige, passende Hinweise sind wertvoller als viele Informationen.
5. Der Camino ist strukturiert genug, um route-basiertes Matching besser zu machen als freie Stadtsuche.
6. Orte knapp neben dem Weg haben ein echtes Sichtbarkeitsproblem.
7. Pilger-Communities sind erreichbar genug für erste Tester.
8. Redaktionell kuratierte Orte können den ersten Nutzen liefern, bevor Anbieter aktiv mitmachen.
9. Anbieter werden erst interessant, wenn Pilgernutzen sichtbar ist.
10. Akkuverbrauch, Offline-Fähigkeit und Push-Frequenz entscheiden über Vertrauen.

## MVP-Richtung

Der erste Ultreia-MVP soll den Beachhead Camino Francés fachlich prüfen.

Entschiedener geografischer MVP-Scope:

- gesamter Camino Francés
- Start: Saint-Jean-Pied-de-Port
- Ziel: Santiago de Compostela
- keine Beschränkung auf wenige Etappen

Funktionaler MVP-Scope:

- vorläufige Need-Arbeitsliste, nicht final
- route-basiertes Matching
- starke Push-Regeln
- Offline-/Cache-Konzept
- mehrsprachige Basis-UX
- keine Garantie auf Verfügbarkeit
- keine falschen Partnerclaims
- klare Unterscheidung zwischen redaktionellem Hinweis und offiziellem teilnehmenden Ort

Die Need-Kategorien sind nur eine Arbeitsliste aus ADR-0003. Vor einer MongoDB-Schema-Entscheidung braucht es weitere Recherche und fachliche Prüfung, gegebenenfalls inklusive Wettbewerbs-, Forum- und Pilger-Community-Auswertung. Das Datenmodell muss flexibel genug bleiben, um Kategorien später zu ändern.

Stand nach ADR-0004: Need-/Kategorie-Taxonomie ist fachlich priorisiert, aber noch kein MongoDB-Schema. Kategorien werden vorläufig als Zusammenspiel aus `NeedCategory`, `PlaceType`, `PushSuitability` und `DataRisk` gedacht. Die nächste Architekturentscheidung muss Datenmodell und Schema klären.

Stand nach ADR-0005: Mehrsprachigkeit ist Produktgrundlage ab Projektstart. Systemtexte und Kernlabels müssen vollständig in `de`, `en` und `es` gepflegt werden; redaktionelle und provider-generierte Inhalte müssen mehrsprachig möglich sein und klare Fallback-Regeln bekommen.

Stand nach ADR-0006: Ultreia modelliert eigene Camino-Kernobjekte statt StepsMatch-Offers nachzubauen. Das Datenmodell muss `NeedCategory`, `PlaceType`, `RouteContext`, `PromptRules`, `TrustLabels`, i18n und Logging/MatchEvents berücksichtigen. Noch gibt es kein konkretes Schema; die nächste Entscheidung kann Repo-/Code-Scaffold oder Backend/Mobile-Bootstrap-Strategie sein.

Stand nach ADR-0007: Monorepo-/Scaffold-Strategie ist entschieden. Noch ist kein Code-Scaffold angelegt; der nächste Schritt kann ein minimaler Scaffold mit `backend/`, `mobile/`, `frontend/`, `shared/` und Platzhaltern sein.

Stand Scaffold: Minimaler Monorepo-Scaffold mit `backend/`, `mobile/`, `frontend/` und `shared/` ist angelegt. Es wurden keine Frameworks installiert, kein produktiver Code erstellt und keine StepsMatch-Dateien kopiert.

Stand Shared Taxonomy: Erste gemeinsame Taxonomy-/i18n-Konfiguration liegt in `shared/taxonomy/`. Systemlabels sind vollständig dreisprachig (`de`, `en`, `es`). Validierungsskript vorhanden: `shared/taxonomy/validate-taxonomy.mjs`. Es gibt weiterhin kein Backend-/Mobile-/Frontend-Framework, kein MongoDB-Schema und keine kopierten StepsMatch-Dateien.

Stand nach ADR-0008: `shared/taxonomy/` ist als zentrale Quelle für statische Produktkonfiguration entschieden. Backend, Mobile, öffentliches Web, Provider-Frontend und spätere Admin-/Content-Tools sollen diese Keys und Labels konsumieren, statt eigene harte Listen zu pflegen. Taxonomy-Änderungen müssen mit `node shared/taxonomy/validate-taxonomy.mjs` validiert werden.

Stand nach ADR-0009: Runtime-/Hosting-/DNS-Strategie ist entschieden. Ultreia bleibt lokal entwickelbar und wird auf DigitalOcean App Platform für Backend und Web/Frontend sowie DigitalOcean Managed MongoDB für Staging ausgerichtet. Environments starten mit `local` und `staging`; Production kommt später nur mit ausdrücklicher Freigabe. DNS bleibt zunächst bei EDIS und wird erst geändert, wenn konkrete DigitalOcean-Zielrecords vorliegen. Mail-Records bei EDIS werden nicht angefasst, solange Mail dort läuft.

Stand Frontend Placeholder: Minimaler statischer Frontend-Placeholder in `frontend/` ist angelegt. Zweck ist ein erstes Ziel für DigitalOcean App Platform Frontend und spätere Domain-Schaltung. Es gibt noch kein Framework, kein Backend, keine API und kein Tracking. DNS bei EDIS ist noch nicht geändert.

Stand Landingpage: Erste gestaltete dreisprachige Landingpage in `frontend/` ist umgesetzt. Sticky Sprachmenü `DE`/`EN`/`ES`, kleines eigenes Jakobsmuschel-/Ultreia-Logo und eigene lokale Camino-Fotos für die Frontpage sind vorhanden. Weiterhin gibt es kein Backend, keine API, kein Tracking und kein Formular. `ultreia.app` und `www.ultreia.app` bleiben live über DigitalOcean Frontend-Staging.

Stand Landingpage Fokus: Landingpage wurde marketing-/UX-seitig weiter fokussiert. Die dominanten Hero-Staging-Badges sind entfernt und in den Footer subtilisiert. Der USP ist stärker auf den Pilger-Need fokussiert: müde sein, nicht suchen wollen und relevante Hinweise bekommen. Camino-Blau/Gelb und warme Stein-/Sandtöne werden konsistenter verwendet. Weiterhin gibt es kein Backend, kein Formular, kein Tracking und keine API. Live-Deployment erfolgt erst nach Push zu `origin/main`.

Stand Landingpage App-Klarheit: Landingpage erklärt im Hero klarer die App-Mechanik: Bedürfnisse wählen, App in den Hintergrund schicken und nur bei relevanter Nähe informiert werden. Sprachwahl zeigt sichtbar Flagge plus Code (`DE`, `EN`, `ES`). Hero ist kompakter für Desktop und Mobile. Weiterhin gibt es kein Backend, kein Formular, kein Tracking und keine API.

Stand Landingpage Responsive UX: Statische Landingpage wurde optisch und strukturell überarbeitet. Hero, Abschnitte zu Produktidee, Funktionsweise, Zielgruppe, Mehrsprachigkeit, Camino-Francés-Scope und MVP-Grenzen sind klarer gegliedert. Bestehende lokale Camino-Fotos werden ruhiger eingesetzt. Responsive CSS für Mobile, Tablet und Desktop wurde neu strukturiert; Sprachumschaltung bleibt dreisprachig per bestehender Vanilla-JS-Logik. Weiterhin gibt es kein Framework, kein Backend, kein Formular, kein Tracking und keine API.

Stand Landingpage Live-Verifikation: Commit `9580ce5` ist auf `origin/main` gepusht und live über `ultreia.app` sowie `www.ultreia.app` sichtbar. Geprüft wurden neuer Hero "Gehen. Nicht suchen.", Sprachwahl `DE`/`EN`/`ES`, lokale Camino-Bilder und kein horizontaler Overflow in Mobile-/Desktop-Smoke-Checks. Es wurde kein manuelles Deploy, keine DNS-Änderung und keine Infrastrukturänderung durchgeführt.

## Infrastructure / DigitalOcean / DNS

Stand Infrastruktur: GitHub-Remote ist `https://github.com/ecily/ultreia.git`; `origin/main` zeigt auf den aktuellen Ultreia-Stand.

DigitalOcean:

- Projekt: Ultreia
- Projekt-ID gekürzt: `a4b57180...`
- Region für Staging-Komponenten: `fra1`

Managed MongoDB Staging:

- Name: `ultreia-mongodb-staging`
- DB-ID gekürzt: `5b6fc790...`
- Engine: MongoDB 8
- Region: `fra1`
- Status: online
- Size: `db-s-1vcpu-1gb`
- Kein MongoDB-Connection-String ist im Repo oder in den Docs dokumentiert.

Frontend App Platform Staging:

- Name: `ultreia-frontend-staging`
- App-ID gekürzt: `d6d75367...`
- Type: Static Site
- Component: `ultreia-frontend`
- Source: GitHub `ecily/ultreia`
- Branch: `main`
- Source directory: `frontend`
- Region: `fra1`
- Status: healthy/live
- Default ingress: `sea-turtle-app-kuo98.ondigitalocean.app`

Domains:

- `https://ultreia.app` funktioniert.
- `https://www.ultreia.app` funktioniert.
- DNS Provider bleibt EDIS.
- `ultreia.app` nutzt DigitalOcean App Platform A Records: `162.159.140.98`, `172.66.0.96`.
- `www.ultreia.app` CNAME zeigt auf `sea-turtle-app-kuo98.ondigitalocean.app.`
- Mail-Records bleiben bei EDIS unverändert.
- Wildcard `*` A `91.227.204.35` bleibt vorerst unverändert.

Noch nicht vorhanden:

- Keine Backend-App.
- Keine API-Domain `api.ultreia.app`.
- Keine dokumentierten Secrets, Tokens, Credentials oder Connection Strings.

## Kommunikationsregeln

Erlaubt:

- "Hinweis entlang des Camino"
- "Ort in deiner Nähe"
- "knapp abseits des Wegs"
- "redaktionell erfasster Ort"
- "offizieller teilnehmender Ort", nur wenn zutreffend
- "Information bitte vor Ort prüfen"

Nicht erlaubt:

- falscher Partnerstatus
- Garantien auf freie Betten
- Garantien auf Öffnungszeiten
- Garantien auf Preise
- Garantien auf Kunden/Besuche
- fremde Logos/Bilder ohne Rechte
- übertriebene Tourismus- oder Deal-Sprache

## Entscheidungssatz

Ultreia.app wird als eigenständiges Camino-Produkt entwickelt. StepsMatch.com bleibt das technische Labor. Ultreia übernimmt nur bewährte technische Bausteine und Erkenntnisse aus StepsMatch, aber keine vermischten Projektdaten, keine fremde Produktlogik und keine ungeprüften Begriffe.
