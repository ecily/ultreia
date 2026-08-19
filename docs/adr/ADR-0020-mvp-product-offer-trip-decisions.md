# ADR-0020: MVP Product, Offer, Trip and Push Decisions

Status: Accepted
Date: 2026-07-28

## Context

Die bisherigen ADRs definieren Route-first-Matching und die Trennung von Match
und Push. Für die nächste Architekturentscheidung müssen Provider, Offers,
aktive Trips, Offer-Zustände, Geh-Erreichbarkeit und der konkrete MVP-Push-
Zeitpunkt verbindlich zusammengeführt werden.

StepsMatch liefert hierfür nur ein abstraktes technisches Muster:
Radius + Interesse + Verfügbarkeit + Zeitfenster + Cooldown. Ultreia bleibt ein
eigenständiges Camino-Produkt mit eigener Taxonomy, eigenen Daten und eigener
Architektur.

## Decision

### Matching und Push

Der Offer-Radius ist im MVP der erste technische Kandidaten-Trigger. Der
Radius ist ein einfacher Kreis um die final bestätigten Provider-Koordinaten;
Mindest-, Standard- und Maximalannahmen sind 50 m, 250 m und 1000 m.

Ein Push ist nur zulässig, wenn zusätzlich alle folgenden Bedingungen gelten:

- aktiver Camino-Trip
- aktiver Pilger-Need und Schnittmenge mit den Offer-NeedCategories
- zeitlich aktives Offer mit plausibler Verfügbarkeit
- Pilger im Offer-Radius
- sinnvolle Geh-Erreichbarkeit
- Richtung und „nicht sinnvoll verpasst“
- kein `completed_for_trip`
- kein `expired_by_distance`
- kein Cooldown/Dedupe-Konflikt

Der MVP-Push erfolgt beim Eintritt in den gültigen Offer-Radius. Mehrere
passende Offers desselben Providers werden gebündelt. Bei mehreren Providern
wird nur der beste relevante Provider ausgewählt. Ohne Premium zählt die
Priorität der Needs vor passender Need-Anzahl, Geh-Erreichbarkeit, Richtung,
Fußweg, Datenvertrauen und Cooldown. Premium darf diese Relevanz später nicht
ersetzen.

Der Push-Tap öffnet einen aktuellen Offer-Stack. Der Stack wird nach
Need-Priorität und Erreichbarkeit sortiert. Ein Offer-Dismissal gilt nur für
dieses Offer; nach einem Need-abhängigen Cooldown darf es wieder erscheinen,
solange es weiterhin sinnvoll erreichbar ist. Wird es zu weit entfernt,
entsteht `expired_by_distance`. Gemerkte Offers verfallen ebenfalls bei
überschrittener Geh-Erreichbarkeit.

### Provider und Standort

Ein Provider-Account repräsentiert im MVP genau einen physischen Standort.
Weitere Standorte erhalten eigene Accounts. Ein Standort kann beliebig viele
Offers haben, die dieselben final bestätigten Koordinaten verwenden.

Provider-Standorte werden über Google Places/Autocomplete gewählt. Eine
Feinjustierung des Markers ist maximal 25 m zulässig. Gespeichert werden
konzeptionell Google-Place-Referenz, formatierte Adresse, Google-Koordinaten,
angepasste Koordinaten, Anpassungsflag und die Quelle `google_places`.
Matching, Radius und Navigation verwenden ausschließlich den final bestätigten
Standort. Ohne gültigen Google-basierten Standort wird der Provider nicht aktiv.

### Kategorien und Offers

Provider dürfen nur offizielle, kuratierte NeedCategories verwenden. Eine
sichtbare Kategorie „Sonstiges“ gibt es nicht. Eine Sonderanfrage für nicht
abgedeckte Leistungen geht ausschließlich an Betreiber/Admin und ist weder in
der Pilger-App sichtbar noch pushfähig.

Ein Offer benötigt Titel, Kurzbeschreibung, eine oder mehrere Needs, Radius,
Preisangabe, Verfügbarkeit/Zeitfenster, Source-Locale, Status und letzte
Bestätigung. Preisarten sind `free`, `fixed`, `from`, `range`, `donativo` und
`on_request`.

Offers müssen alle 30 Tage bestätigt werden. Sieben und einen Tag vor Ablauf
wird erinnert. Ohne Bestätigung wird ein Offer pausiert und nicht sichtbar oder
pushfähig.

### Trip und Offer-Zustände

Ein aktiver Trip ist Voraussetzung für automatisches Push-Matching. Beim
Pausieren werden alle automatischen Pushes deaktiviert; aktive Needs und
Verlauf bleiben erhalten.

Nach Navigation und plausibler Ankunft bestätigt der Pilger erledigte Needs
einzeln. Erst dadurch werden Needs deaktiviert. Sobald mindestens ein Need am
Provider erledigt wurde, wird das konkrete Offer für die aktuelle Reise
`completed_for_trip`; das ist kein globaler Ausschluss.

### Consent und Navigation

Pilger-Account, Standort-Consent und Push-Consent sind MVP-relevant. Die
Permission-Erklärungen erscheinen kurz vor dem bewussten Trip-Start. Ein
abgelehnter Push verhindert automatische Pushes, aber nicht den Trip oder die
manuelle Offer-Ansicht.

In-App-Google-Navigation ist Zielbild, externer Maps-Absprung bleibt Fallback.
Ankunft wird aus Navigation/Route-Ende und GPS-Nähe zum finalen Provider-Punkt
abgeleitet; ein vorläufiger Schwellenwert von 25–50 m ist eine technische
Annahme. Nach Ankunft zeigt die App „Du bist da!“ und die Need-Checkliste.

### Offline und i18n

Route und Offers werden für aktuelle und nächste Etappen vorbereitet. Ein
großzügiger Offline-Korridor von ungefähr 1 km dient der Datenvorladung, nicht
als Push-Relevanzgrenze. Push bleibt route-, need-, gehzeit-, richtungs- und
cooldown-gefiltert.

DE/EN/ES sind für Pilger- und Providertexte verpflichtend. Provider können in
einer Quellsprache starten; Übersetzungen werden assistiert erzeugt und später
prüfbar gemacht.

## Consequences

Die Implementierung braucht getrennte Zustände für Match, Notification,
OfferUserState und Trip. Radius kann früh Kandidaten liefern, darf aber keine
Gehbarkeit, Richtung, Availability oder Userentscheidung ersetzen.

Provider-Self-Service ist Bestandteil von V1; die frühe MVP-Datenquelle kann
operativ weiterhin kontrolliert durch Andreas geseedet werden. Payment und
Premium bleiben vorbereitet, aber außerhalb des MVP.

## Non-Goals

- keine Implementierung in diesem ADR
- kein Payment oder Premium/Boost
- keine vollständige Provider-Self-Service-Oberfläche
- keine Produktionsdatenmigration
- keine StepsMatch-Daten oder operative Kopplung
- keine Secrets, Deploys oder Infrastrukturänderungen
