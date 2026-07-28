# Ultreia Repository Audit

Audit-Zeitpunkt: 2026-07-28 14:46:58 +02:00  
Repository: `C:\coding\ultreia`  
Branch: `main`  
HEAD: `c73a1b1f82c638325a42d92f032f40f498eaefe2` (`docs: document push reliability learning`)  
Ausgangsstatus: sauber; `main` war 1 Commit vor `origin/main`.

## Projektgrenze und Produkt

Ultreia.app ist ein eigenständiges Produkt ausschließlich für Pilger am Camino
Francés, geografisch Saint-Jean-Pied-de-Port bis Santiago. Der Produktkern ist
Need-Auswahl, Handy wegstecken und kontextuell zurückhaltende Hinweise.

Es gibt keine Garantien auf Öffnungszeiten, Verfügbarkeit, freie Betten, Preise,
medizinische Sicherheit oder Vollständigkeit. Das Audit behandelt nur Ultreia;
es wurden keine fremden Projektartefakte verwendet.

## Architektur- und Repo-Stand

Vorhanden sind 57 nicht-generierte Repo-Dateien: statisches `frontend/`,
minimales `backend/`, `shared/taxonomy/`, 20 ADRs und Tests. Nicht vorhanden
sind `mobile/`, Provider-Frontend, Admin-Frontend, Auth, Models, Heartbeat,
Matching, Push oder Directions.

Alle ADRs 0001–0019 sind als `Accepted` markiert. ADR-0010 ist ein bewusst
doppelter Nummernpräfix für zwei getrennte Dokumente (Route Model und Push
Reliability). Die ADRs sind Ziel-/Entscheidungsdokumente, keine Implementierungs-
nachweise.

## Frontend/Web

`frontend/` ist eine nachvollziehbare statische Landingpage ohne Framework und
Build-Schritt. Sie hat lokale Camino-Bilder, DE/EN/ES-Umschaltung via Vanilla JS,
keine API-Aufrufe, kein Formular, kein Tracking, keine Cookies und keine
externen Assets/Fonts. Die Seite kommuniziert den Camino-Francés-Scope und
Disclaimers. Sichtbare DigitalOcean-Hinweise nennen statisches Hosting mit
Root `frontend/` sowie `ultreia.app` und `www.ultreia.app`.

Eine live wirksame DO-Deployment-Konfiguration ist im Repo nicht enthalten; ein
externes Deployment wird daher nicht behauptet. Es gibt keine Backend-App und
keine `api.ultreia.app`-Konfiguration im Repo.

## Backend

Die Express-Basis bietet:

- `GET /api/health` mit prozessualem Status und redigiertem Datenbankstatus.
- `GET /api/taxonomy/needs?locale=de|en|es` mit Locale-Fallback auf EN.
- optionale MongoDB-Verbindung über `MONGODB_URI` und `MONGODB_DB_NAME`.
- lokale `.env`-Ladung ohne Überschreiben bestehender Prozesswerte.

Es gibt keine fachlichen Datenmodelle, Collections oder Mutationen. Die Tests
decken Health, Env-Lader, Mongo-Service und Taxonomy-Service/-Route ab.

## MongoDB und Env

`backend/.env.example` ist vorhanden; `backend/.env` ist lokal vorhanden, wird
ignoriert und wurde nicht gelesen oder ausgegeben. Tracked ist nur die Vorlage.
Es wurden keine Werte, Tokens, Passwörter, URIs oder Zertifikate dokumentiert.

Laut operativem Kontext existiert bzw. ist eine DO Managed MongoDB für Ultreia-
Staging vorgesehen. Der zuletzt bekannte Blocker lautet TLS:
`unable to verify the first certificate`. Phase 1b ist nicht als abgeschlossen
zu werten, solange Health nicht `database.connected=true` meldet.

Der lokale API-Smoke ohne Staging-Konfiguration meldete erwartungsgemäß
`database.status=not_configured`, `database.connected=false`. Damit wurde nur
die API-Erreichbarkeit geprüft, keine Staging-Verbindung.

## Taxonomy und i18n

Die zentrale Taxonomy enthält alle 13 kanonischen MVP-Keys und keine Legacy-Keys
`food`, `medical_help` oder `quiet place`. Alle Systemlabels in den geprüften
Taxonomy-Dateien sind DE/EN/ES.

Zusätzlich existieren kontrollierte bzw. Discovery-Keys. `warning` ist als
`controlled_later`/`emergency_or_controlled` gekennzeichnet, darf aber nicht als
normaler MVP-Need in Mobile erscheinen. Der aktuelle Backend-Endpunkt liefert
21 Kategorien und filtert nicht auf die 13 MVP-Keys. Da kein Mobile-Modul im Repo
existiert, ist das aktuell ein Integrationsrisiko, kein nachgewiesener Mobile-
Fehler.

## Checks

| Check | Ergebnis |
|---|---|
| Root `npm test` | Nicht ausführbar: kein Root-`package.json` |
| `npm test` in `backend/` | Bestanden: 16 Tests, 0 Fehler |
| `node shared/taxonomy/validate-taxonomy.mjs` | Bestanden |
| `git diff --check` | Bestanden |
| Backend API-Smoke `/api/health` | Bestanden: HTTP/API-JSON erreichbar |
| Backend Taxonomy-Smoke DE/EN/ES-Pfad | Bestanden: ES-Response mit 21 Items |
| Lint/typecheck/build | Nicht vorhanden bzw. keine entsprechenden Scripts |
| MongoDB Staging | Nicht lokal verifiziert; bekannter TLS-Blocker |

Der Smoke-Test verwendete keine Secrets und keine echte Staging-Verbindung.

## Fremdprojekt- und Kontaminationsprüfung

Kaufklug wurde nur in der Kontext-Abgrenzung gefunden; es gibt keinen
Kaufklug-Code-, Daten-, Branding- oder Betriebsbezug.

StepsMatch-Verweise stehen ausschließlich in ADRs, README und Kontext als
explizit abgegrenzte technische Referenz/Laborbeschreibung. Es wurden keine
StepsMatch-Daten, Collections, Env-Werte, DB-Namen, Domains, Providerlogik oder
operativen Kopplungen gefunden. Diese Referenztexte sind nachvollziehbar, aber
bei späterer Produktdokumentation weiter strikt getrennt zu halten.

## Risiken

1. Der Root-Aufruf `npm test` ist nicht definiert; CI/Entwickler müssen den
   Backend-Test explizit in `backend/` starten oder später einen Root-Runner
   ergänzen.
2. Der Taxonomy-Endpunkt liefert auch Nicht-MVP- und `warning`-Kategorien.
   Ein Mobile-Consumer darf diese Antwort nicht ungefiltert als MVP-Needs
   verwenden.
3. Die MongoDB-Staging-Verbindung ist wegen der bekannten TLS-
   Zertifikatsprüfung nicht als funktionsfähig nachgewiesen.
4. Frontend, Backend und Taxonomy existieren, aber Mobile-, Provider- und
   Admin-/Diagnostics-Oberflächen sind noch nicht implementiert.
5. Eine live wirksame DO-Backend-/API-Konfiguration ist im Repo nicht
   nachvollziehbar.

## Offene Punkte und empfohlene nächste Schritte

- TLS-Zertifikatskette der ausschließlich für Ultreia vorgesehenen Staging-
  MongoDB in der DO-Runtime sicher beheben und anschließend Health mit
  `database.connected=true` verifizieren; keine Zertifikatsinhalte posten.
- Vor Mobile-Implementierung einen expliziten MVP-Need-Filter bzw. Vertrag für
  den Taxonomy-Endpunkt festlegen, der `warning` ausschließt.
- Separat und freigegeben die nächste MVP-Phase planen: Pilgrim Identity,
  i18n-Grundlage und später persistente Datenmodelle.
- Erst bei expliziter Infrastrukturfreigabe Backend-App, API-Domain und
  Deployment-Konfiguration dokumentieren bzw. anlegen.

## Audit-Abschluss

Dieses Audit hat keine Features, Auth, Models, Heartbeat-, Matching-, Push- oder
Mobile-Logik implementiert und keinen Deploy oder Push ausgeführt.
