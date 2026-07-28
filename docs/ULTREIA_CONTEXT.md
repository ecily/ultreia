# Ultreia Context

Stand: 2026-07-28

Dieses Dokument ist die operative Source of Truth für das eigenständige Projekt
Ultreia.app im Repository `C:\coding\ultreia`.

## Projektgrenze

Ultreia.app ist ausschließlich für Pilger am Camino Francés gedacht. Das
Produkt, seine Daten, sein Branding, seine Roadmap und seine Infrastruktur sind
vollständig von Kaufklug und StepsMatch getrennt.

- Kaufklug ist kein Bestandteil dieses Projekts.
- StepsMatch ist ausschließlich technisches Labor bzw. Referenz.
- Es werden keine StepsMatch-Daten, Collections, Env-Werte, DB-Namen,
  API-Logik, Providerlogik, Texte oder Deployments übernommen.
- Referenz-Learnings müssen fachlich eigenständig geprüft werden.
- Keine Secrets, Tokens, Passwörter, Connection Strings oder Zertifikatsinhalte
  in Dokumentation, Logs oder Antworten.
- Kein Push, Deploy, DNS-, DB- oder Infrastrukturumbau ohne ausdrückliche
  Freigabe.

## Produktdefinition

Pilger wählen aktive Needs, stecken das Handy weg und gehen weiter. Ultreia
meldet sich nur bei plausibel relevanten Hinweisen im Wegkontext, zur passenden
Need, mit ausreichender Datenqualität und ohne Policy-/Cooldown-Konflikt.

Ultreia ist kein Dealportal, Branchenverzeichnis, Maps- oder Booking-Ersatz,
Gutscheinportal oder lauter Tourismus-Guide. Es gibt keine Garantien auf
Öffnungszeiten, Verfügbarkeit, freie Betten, Preise, medizinische Sicherheit,
Vollständigkeit, Reichweite, Kunden, Umsatz oder Push-Ausspielung. Wichtige
Informationen müssen vor Ort geprüft werden.

MVP-geografisch: Camino Francés von Saint-Jean-Pied-de-Port bis Santiago de
Compostela. Eine vollständige POI-/Anbieterabdeckung wird nicht garantiert.

## Sprachen

DE, EN und ES sind ab Start für Mobile, Web, Provider-Frontend, Onboarding,
Push-Texte, Labels, Disclaimers, sichtbare Systemtexte sowie
Datenquellen-/Verantwortlichkeitslabels verpflichtend. Interne technische Keys
dürfen Englisch bleiben; sichtbare Texte müssen übersetzbar sein.

## Repository- und Architekturstand

Das Repo ist ein Monorepo mit:

- `frontend/`: statische, lokale Landingpage ohne Framework, Build-Schritt,
  Backend/API, Formular, Tracking, Cookies oder externe Assets.
- `backend/`: Node.js/Express-Basis mit `GET /api/health` und
  `GET /api/taxonomy/needs?locale=de|en|es`.
- `shared/taxonomy/`: zentrale statische Produktkonfiguration.
- `docs/adr/`: 20 akzeptierte ADR-Dateien; ADR-0010 existiert bewusst zweimal
  für Route Model und Push-Reliability-Learning.
- Kein `mobile/`, Provider-Frontend oder Admin-Frontend im aktuellen Repo.

ADR-0001 bis ADR-0019 sind Accepted. Die ADRs beschreiben Zielarchitektur und
Reihenfolge, sind aber keine Behauptung, dass Auth, Models, Heartbeat,
Matching, Push, Provider-Self-Service oder Mobile bereits implementiert sind.

Die Zielarchitektur ist route-first: RouteKm, Korridor und Wegkontext sind
fachlich maßgeblich; Luftlinie ist höchstens ein technischer Vorfilter.
Matching und Notification Policy bleiben getrennt. StepsMatch-Push-
Reliability ist nur in `docs/adr/ADR-0010-push-notification-reliability.md`
als Referenz dokumentiert.

## Shared Taxonomy

Quelle ist ausschließlich `shared/taxonomy/`. Kanonische MVP-NeedCategory-Keys:

`sleep`, `eat`, `water`, `grocery`, `pharmacy`, `medical`, `cash`, `stamp`,
`gear`, `laundry`, `sightseeing`, `quiet_place`, `transport`.

`food`, `medical_help` und `quiet place` sind ungültige Legacy-Keys. `warning`
ist eine kontrollierte spätere Kategorie und kein normaler MVP-Need für Mobile.
Die Dateien enthalten vollständige DE/EN/ES-Systemlabels. Validierung:

```text
node shared/taxonomy/validate-taxonomy.mjs
```

Der aktuelle generische Backend-Taxonomy-Endpunkt liefert alle 21 Taxonomy-
Kategorien. Solange kein Mobile-Modul existiert, ist daraus keine tatsächliche
Mobile-Ausspielung ableitbar; ein späterer MVP-Consumer muss die 13 MVP-Keys
explizit filtern und `warning` ausschließen.

## Backend und MongoDB

Die Backend-Basis nutzt Express, lädt optional `backend/.env` lokal und hält
Env-Dateien durch `.gitignore` aus Git heraus. `backend/.env.example` enthält
keine echten Werte. MongoDB wird nur bei konfigurierter URI angesprochen;
Health-Status enthalten keine URI oder Rohfehler.

DigitalOcean Managed MongoDB für Ultreia-Staging ist vorgesehen bzw. vorhanden.
Der zuletzt bekannte Staging-Blocker ist die TLS-Zertifikatsprüfung:
`unable to verify the first certificate`. Phase 1b gilt ausschließlich dann
als abgeschlossen, wenn der Health-Status `database.connected=true` zeigt.
Dieser Zustand wurde im lokalen Audit nicht mit Staging-Secrets verifiziert.

Es gibt im Repo keine DB-Mutation, keine Collections, keine Domain-Models,
keine Auth-, Heartbeat-, Matching-, Push- oder Directions-Implementierung.

## Hostingstand

Im Repo sichtbar ist die Frontend-Zielkonfiguration für DigitalOcean App
Platform in `frontend/README.md`: Root/Output `frontend/`, statische
`index.html`, Ziel-Domains `ultreia.app` und `www.ultreia.app`. Eine live
wirksame Deployment-Konfiguration oder ein Backend-App-Setup ist im Repo nicht
vorhanden. Externe DigitalOcean-Zustände werden nicht spekulativ ergänzt.

## Änderungsregeln

Vor technischen Aufgaben dieses Dokument lesen. Keine neuen Produktfeatures
im Rahmen eines Audits bauen. Nach relevanten Dokuänderungen Git-Status und
Diff prüfen. Kein Push ohne ausdrückliche Freigabe.
