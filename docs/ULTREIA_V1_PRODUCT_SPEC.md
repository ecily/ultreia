# Ultreia V1 – Produkt- und Fachspezifikation

Status: verbindliche fachliche Source of Truth für V1
Stand: 2026-08-19
Geltungsbereich: Ultreia.app, Camino Francés, Pilger-, Provider- und Admin-Domäne

## 1. Zweck und Verhältnis zur technischen Dokumentation

Diese Datei beschreibt, was Ultreia V1 fachlich leisten und wie sich das
Produkt verhalten soll. Sie ist die fachliche Source of Truth für die erste
tatsächlich nutzbare Produktversion.

`docs/ULTREIA_CONTEXT.md` bleibt die Source of Truth für den aktuellen
technischen Projektstand: Architektur, Infrastruktur, implementierte und
verifizierte Funktionen, Risiken und offene technische Arbeit. Der Context
beschreibt nicht erneut die vollständige Produktlogik.

Die ADRs bleiben für bereits getroffene Architekturentscheidungen relevant.
Wo eine ältere ADR noch einen früheren Produktstand beschreibt, gilt die in
dieser Spezifikation dokumentierte V1-Entscheidung. Solche Übergänge sind in
den betroffenen ADRs ausdrücklich markiert.

Normative Begriffe:

- **MUST / muss**: verbindliche V1-Anforderung.
- **SHOULD / soll**: V1-Regel, von der nur mit begründetem Architekturentscheid
  abgewichen werden darf.
- **MAY / kann**: zulässige, aber nicht zwingende Ausprägung.
- **OPEN**: fachlich noch nicht entschieden; keine Implementierung darf dafür
  eine eigene Produktentscheidung erfinden.

Diese Spezifikation enthält keine Implementierung, keine Secrets und keine
Produktionsdaten.

## 2. Produktvision und Grenzen

Ultreia wird primär für **Erstpilger am Camino Francés** optimiert. Der
Pilger sagt vorher, was ihm wichtig ist, geht danach weiter und wird nur dann
angesprochen, wenn ein Bedarf im aktuellen Weg- und Zeitkontext sinnvoll
erfüllbar wird.

Der Kernablauf lautet:

```text
Need vorher definieren
→ Camino gehen
→ Kontext entsteht
→ relevanter Hinweis
→ direkte Handlung
```

Der gewünschte Aha-Moment lautet:

> „Ich musste gar nicht suchen.“

Ultreia ist keine allgemeine Such-App, kein klassisches Branchenverzeichnis,
kein Google-Maps-Ersatz und kein Dealportal. Die App darf nicht zu einer
werblichen Umgebungsliste oder zu einem sozialen Feed werden.

V1 macht keine Garantien für Öffnungszeiten, Verfügbarkeit, freie Betten,
Preise, medizinische Sicherheit, Datenvollständigkeit, Reichweite, Umsatz oder
Push-Zustellung. Angaben werden mit Quelle, Vertrauen und Aktualität behandelt
und müssen vor Ort geprüft werden.

## 3. Rollen, Identität und Authentifizierung

### 3.1 Gemeinsame Auth-Basis

Es gibt eine gemeinsame Authentifizierungsbasis mit fachlich getrennten Rollen:

- `pilgrim`
- `provider`
- `admin`

Die Rollen teilen keine unklaren Profile. `PilgrimUser`, `ProviderAccount` und
Admin-Berechtigungen bleiben fachlich und zugriffsseitig getrennt. Die
gemeinsame Auth-Basis muss spätere Erweiterungen ermöglichen, ohne das
Accountmodell neu zu bauen.

### 3.2 Pilger-Registrierung und Login

Ein Pilger registriert sich nicht beim ersten App-Start. Die verbindliche
Registrierung wird beim bewussten Schritt **„Camino starten“** ausgelöst.

V1 verwendet ausschließlich **Magic Link per E-Mail**. Eine Passwortpflicht
gibt es nicht. Passwort-Login, Google, Apple oder weitere Methoden sind spätere
Erweiterungen und dürfen das V1-Modell nicht blockieren.

Pflichtdaten des Pilgerprofils:

- E-Mail-Adresse
- frei gewählter Anzeigename

Eine Klarnamenpflicht gibt es nicht. Weitere Stammdaten müssen später ergänzt
werden können.

### 3.3 Account, Gerät und Wiederherstellung

Die fachliche Identität ist der Account; die Device-ID ist nur technische
Identität:

```text
PilgrimUser
→ ein oder mehrere Devices
→ maximal ein aktiver Trip
→ Needs, Prioritäten und Offer-Zustände
```

Ein Gerät kann Push-Token, Berechtigungen, App-Version und technische
Diagnostik liefern. Es ersetzt niemals den Pilgeraccount.

Bei Gerätewechsel oder Neuinstallation müssen – nach erneutem Login – aktiver
Trip, Needs, Prioritäten, Match-/Offer-Zustände und relevante Reisehistorie
wiederherstellbar sein. Token und Gerätebindung dürfen dabei ersetzt werden,
ohne den fachlichen Trip zu verlieren.

## 4. Trip-Modell und Camino-Start

Ein Pilger darf in V1 maximal einen aktiven Trip besitzen. Abgeschlossene Trips
bleiben grundsätzlich erhalten.

Trip-Zustände:

- `active`
- `paused`
- `completed`

### 4.1 Camino starten

Der Start benötigt kein verpflichtendes manuelles Etappenformular:

1. Der Pilger drückt „Camino starten“.
2. Ultreia liest den aktuellen Standort mit Consent.
3. Route und Abschnitt werden automatisch ermittelt.
4. Der erkannte Abschnitt wird kurz bestätigt.
5. Der Trip wird aktiv.

Nur bei unsicherer Routenzuordnung wird nachgefragt. Ohne ausreichenden
Standort- oder Routenkontext darf der Start nicht stillschweigend eine falsche
Route annehmen.

### 4.2 Tagesbetrieb und Pause

Ein Trip bleibt über mehrere Tage aktiv. Es gibt keinen täglichen Pflichtstart.
Ultreia darf aus längerer Inaktivität, Uhrzeit, Standort, möglicher Unterkunft
oder Bewegungsmuster ein Tagesende vermuten, aber niemals automatisch
pausieren.

Stattdessen kann die App zurückhaltend fragen: **„Für heute angekommen?“**
Erst die Nutzerbestätigung pausiert den Trip.

Beim Pausieren bleiben Trip, Needs und Verlauf erhalten; automatische Matches
und Pushes werden unterdrückt. Ein pausierter Trip kann bewusst fortgesetzt
werden.

## 5. Consent, Background Location und Datenschutz

Standort- und Push-Erlaubnis werden erklärt und kurz vor dem bewussten
Trip-Start angefragt, nicht ungefragt beim ersten App-Start.

Während eines aktiven Trips darf Background Location aktiv sein. Die Pilger-
Oberfläche muss jederzeit klar zeigen:

- Trip aktiv oder pausiert
- Background Location aktiv oder pausiert
- Push aktiv oder deaktiviert

Der Pilger muss Background Location jederzeit manuell deaktivieren können.
Bei Deaktivierung:

- bleiben Account, Trip, Needs und Verlauf erhalten;
- pausieren automatisches Matching und automatische Pushes;
- erklärt Ultreia klar, dass dadurch automatische Hinweise ausbleiben;
- darf eine zurückhaltende Reaktivierungserinnerung erscheinen.

Ein abgelehnter Push blockiert den Trip nicht. Manuelle aktuelle Offers dürfen
weiterhin sichtbar sein, automatische Pushes bleiben aus.

Provider sehen niemals personenbezogene Pilgerdaten. Insbesondere dürfen sie
nicht sehen:

- Name oder E-Mail
- individuelle Position
- Bewegungsverlauf
- persönliche Tripdetails

Provider erhalten nur zulässige, anonymisierte und aggregierte Statistiken.

## 6. Need-System

Der Need-Katalog ist kuratiert, adminverwaltet, dreisprachig und jederzeit
erweiterbar. Need-Kategorien dürfen nicht als unveränderliche UI-Liste in der
App dupliziert werden. Die App konsumiert die serverseitig gültige Taxonomie.

Die folgende V1-Ausgangsmenge ist fachlich vorgesehen; stabile technische
Schlüssel und Übersetzungen werden in der gemeinsamen Taxonomie gepflegt, nicht
in einzelnen Clients:

1. Wasser
2. Essen
3. Frühstück
4. Kaffee / Getränkepause
5. Supermarkt / Lebensmittel
6. Bäckerei
7. Apotheke
8. Medikamente
9. Blasen-/Fußversorgung
10. Medizinische Hilfe / Arzt
11. Physiotherapie / Massage
12. Unterkunft
13. Pilgerherberge / Albergue
14. Privates Zimmer / Hotel
15. Wäsche waschen
16. Wäschetrockner
17. Dusche
18. Toilette
19. Ruheplatz / Sitzplatz
20. Schatten / Hitzepause
21. Ausrüstung / Outdoor-Shop
22. Schuhgeschäft / Ersatzschuhe
23. Schuh-/Ausrüstungsreparatur
24. Wanderstöcke / Ersatzteile
25. Regenausrüstung
26. Sonnenschutz
27. Hygieneartikel
28. Damenhygiene
29. Geldautomat / Bargeld
30. Kartenzahlung
31. Handy laden / Steckdose
32. Powerbank / Ladezubehör
33. WLAN / Internet
34. Mobilfunk / SIM
35. Gepäcktransport zur nächsten Etappe
36. Paket / Gepäck nach Santiago oder nach Hause senden
37. Fahrradservice / Reparatur
38. Pilgerausweis / Credencial
39. Pilgerstempel / Sello
40. Kirche / spiritueller Ort / Messe

Admin muss Needs anlegen, bearbeiten, übersetzen, aktivieren, deaktivieren
und sortieren können sowie Push-Eignung und Kritikalität konfigurieren.

### 6.1 Need-Zustände

Jeder aktive Need besitzt mindestens:

```text
active: boolean
urgency: always | today | now
pushEnabled: boolean
priorityOrder: number
```

Die Dringlichkeit ist systemisch geordnet: `now > today > always`.
Drag-and-drop-Sortierung erfolgt nur innerhalb derselben Dringlichkeitsgruppe.
Needs, Dringlichkeit und Push-Einstellung können während eines aktiven Trips
geändert werden. Das System liefert sinnvolle Defaults.

### 6.2 Kritische Needs

Needs können als kritisch klassifiziert werden, etwa medizinische Hilfe,
Apotheke oder Wasser bei akutem Bedarf. Kritische Needs dürfen Soft-Limits und
Cooldowns unter kontrollierten Regeln übersteuern, erhalten stärkere
Priorität und eine klarere, aber nicht alarmistische UX.

## 7. Provider, POI, Service und Offer

### 7.1 Anbieterzulassung

Es gibt keine starre Branchenliste. Ein Anbieter darf teilnehmen, wenn er
mindestens einen gültigen Ultreia-Need sinnvoll bedient. Das schließt kleine
lokale Betriebe, Einzelanbieter und Betriebe ohne Website ein.

Ausgeschlossen werden auf Plattformebene insbesondere illegale oder betrügerische
Angebote, irreführende Leistungen, Glücksspiel, Erotik, rein digitale Angebote
ohne lokalen Camino-Nutzen, unseriöse sicherheitskritische Angebote und
wiederholt falsche Daten. Alkohol und Tabak werden nicht pauschal
ausgeschlossen.

### 7.2 Provider-Self-Service in V1

V1 besitzt einen funktionsfähigen Provider-Self-Service. Der operative Start
kann trotzdem mit kontrolliertem Seed erfolgen; Seed ist eine Betriebsstrategie
und kein Ersatz für die V1-Funktion.

Provider-Workflow:

1. Provider registriert sich.
2. E-Mail wird verifiziert.
3. Standort wird über Google Places/Autocomplete validiert.
4. Pflichtdaten und mindestens ein gültiges Offer werden erfasst.
5. Nach erfolgreicher Validierung kann das Offer live gehen.
6. Admin kann jederzeit korrigieren, pausieren, sperren oder archivieren.

Eine manuelle Standardfreigabe durch Admin ist nicht Voraussetzung für jedes
gültig geprüfte Offer. Admin-Rechte und Audit bleiben erhalten.

### 7.3 Begriffe und Standort

- **POI** ist der konkrete physische Ort.
- **Service** beschreibt, welchen Need der Ort bedienen kann.
- **ProviderAccount** ist der Login-/Operator-Account.
- **ProviderProfile** enthält Anbieter- und Stammdaten.
- **Offer** ist das konkrete oder generische Angebot für einen oder mehrere
  Needs.

Ein ProviderAccount entspricht im MVP einem physischen Standort. Weitere
Standorte benötigen eigene ProviderAccounts. Ein Standort kann mehrere Offers
besitzen; diese verwenden dieselben final bestätigten Koordinaten.

Provider-Standorte müssen über Google Places/Autocomplete gefunden werden.
Marker-Feinjustierung ist auf etwa 25 m begrenzt. Finale Koordinaten gelten für
Matching, Radius, Detailseite und Navigation. Ohne gültigen Google-basierten
Standort wird ein Provider nicht aktiv.

### 7.4 Offer-Pflichtdaten

Jedes Offer benötigt mindestens:

- Titel
- kurze Beschreibung
- eine oder mehrere NeedCategories
- Preisart und Preisangabe
- strukturierte Öffnungszeiten / Verfügbarkeit / Zeitfenster
- Radius
- Quellsprache
- Aktivstatus
- letzte Bestätigung

Bilder sind optional, aber empfohlen. Zulässige Preisarten sind:
`free`, `fixed`, `from`, `range`, `donativo`, `on_request`.

Jedes Offer muss alle 30 Tage bestätigt werden. Erinnerungen erfolgen sieben
Tage und einen Tag vor Ablauf. Ohne Bestätigung wird es pausiert, nicht normal
angezeigt und nicht pushfähig.

### 7.5 Anbieterkommunikation

Provider dürfen keine Reichweite, Umsätze, Push-Zustellung, freien Betten,
Preise, Öffnungszeiten oder medizinische Sicherheit versprechen. Provider
können gewünschte Radius-/Wegrelevanz konfigurieren, aber niemals beliebig an
alle Pilger senden oder Matching-/Cooldown-Regeln umgehen.

## 8. Route, Matching und Relevanz

Der geografische V1-Rahmen ist der vollständige Camino Francés von
Saint-Jean-Pied-de-Port bis Santiago de Compostela. Funktionale Abdeckung darf
anfangs dünn sein; Vollständigkeit wird nicht versprochen.

Matching ist route-first und nicht generische Nearby-Suche. Fachliche Relevanz
berücksichtigt:

- Route und Abschnitt
- `RouteKm` / Position entlang der Route
- Korridor und Abweichung
- Bewegungsrichtung
- tatsächliche Gehstrecke und Gehzeit
- aktive Needs und Prioritäten
- Offer-Zeitfenster und Verfügbarkeit
- Datenvertrauen und letzte Bestätigung
- Dedupe, Cooldowns und Nutzerentscheidungen

Luftlinie darf nur als technischer Vorfilter dienen. Ein Kandidat, der etwa
400 m Luftlinie entfernt, aber 1,8 km tatsächlichen Geh-Umweg erfordert, darf
kein sinnvoller Match sein.

### 8.1 Matching-Pipeline

1. GPS-Heartbeat oder zulässiger lokaler Geofence liefert Standortkontext.
2. Backend ordnet Camino oder Development/Test Route zu.
3. Route, Segment, RouteKm, Korridor und Richtung werden bestimmt.
4. Aktiver Trip, Needs, Sprache, Permissions und bisherige Zustände werden
   geladen.
5. Sichtbare POIs, Services und Offers werden fachlich vorgefiltert.
6. Der Offer-Radius ist der erste technische Kandidaten-Trigger.
7. Need, Route, Richtung, Gehbarkeit, Zeitfenster, Trust und Zustände werden
   geprüft.
8. Kandidaten werden erklärbar bewertet; Provider-Angebote werden gebündelt.
9. Für wenige Top-Kandidaten können Walking Directions geprüft und gecacht
   werden.
10. Das Ergebnis wird als MatchEvent diagnostizierbar gespeichert.
11. Erst danach entscheidet die Notification Policy über Push oder Suppression.

Der Offer-Radius hat fachlich mindestens 50 m, standardmäßig 250 m und maximal
1000 m als technische V1-Annahmen. Radius-Eintritt allein ist nie ausreichend.

### 8.2 Provider-Auswahl und Offer-Stack

Mehrere passende Offers desselben Providers werden in einem Hinweis gebündelt.
Bei mehreren Providern wird im MVP nur der beste relevante Provider ausgewählt.
Der Push-Tap öffnet einen aktuellen Offer-Stack:

1. bestes aktuelles Match
2. darunter passende Alternativen

Der Stack wird nach Need-Priorität und Geh-Erreichbarkeit geordnet und bleibt
mit klaren Buttons für müde Pilger bedienbar.

## 9. Push- und Notification-Policy

Push ist Need-spezifisch und nicht gleich aggressiv für alle Needs. Ein Push
ist nur zulässig, wenn mindestens gilt:

- aktiver Trip
- aktiver, passender Need
- ausreichend relevanter Match
- plausibler Route-/Korridor-/Richtungskontext
- sinnvolle Geh-Erreichbarkeit
- gültige Verfügbarkeit und ausreichende Datenqualität
- kein `completed_for_trip` und kein `expired_by_distance`
- kein globaler, Need- oder Offer-Cooldown
- Push-Erlaubnis und gültiger Token
- keine Pause-, Ruhe- oder Silence-Regel, die den Hinweis unterdrückt

Kein Push für generische Werbung, schwache Nearby-Hinweise, unklare Daten,
falsche Garantien oder übermäßige Wiederholung.

### 9.1 Limits und Ruhe

V1 verwendet ein weiches globales Tageslimit. Mit jedem weiteren Push muss die
Relevanz steigen. Kritische Needs dürfen das Soft-Limit kontrolliert
übersteuern.

Zusätzlich gibt es:

- globalen Cooldown
- Need-Cooldown
- POI-/Service-Cooldown
- Offer-Dedupe
- „Nicht nochmals anzeigen“ für den gewählten Scope

`Trip paused` unterdrückt automatische Pushes. Nach vermuteter Tagesankunft
wird die Schwelle erhöht. Komfort-Needs werden nachts stark reduziert oder
ausgesetzt; kritische Needs können relevant bleiben.

### 9.2 Push-Inhalt und Sprache

Push-Texte sind immer DE/EN/ES-fähig und werden aus `messageKey`, Locale und
Parametern erzeugt. Sie dürfen Öffnungszeiten, Verfügbarkeit, Preise,
medizinische Sicherheit oder Partnerschaft nicht garantieren. Cautious Copy wie
„laut verfügbaren Angaben“ und „bitte vor Ort prüfen“ ist verpflichtend, wenn
Daten nicht providerbestätigt sind.

Ein NotificationEvent muss konzeptionell mindestens Policy-Entscheidung,
Suppress-Gründe, Match-Verknüpfung, Locale, Message-Key, Cooldown-Zustand,
Tokenstatus, Provider und Delivery-Status nachvollziehbar machen.

## 10. Navigation, Ankunft und Erledigt

In-App-Navigation ist V1-Priorität. Ein externer Google-Maps-/System-Absprung
ist Fallback. Ultreia unterscheidet Luftlinie, Providerdistanz, tatsächlichen
Gehweg/Umweg und Bewegungsrichtung.

Das Navigationsziel ist der konkrete POI-/Service-Standort, nicht automatisch
die Adresse des ProviderProfiles.

Ankunft wird technisch aus Navigation, Route-Ende und GPS-Nähe abgeleitet.
Ultreia markiert ein Offer oder einen Need aber nicht automatisch als erledigt.
Nach plausibler Ankunft fragt die App **„Erledigt?“** und der Pilger bestätigt
Needs einzeln.

Erst Nutzerbestätigung:

- deaktiviert den bestätigten Need;
- setzt das konkrete Offer für den aktiven Trip auf `completed_for_trip`;
- verhindert denselben automatischen Offer-Push in diesem Trip.

Im Ereignismodell bleiben Impression/View, Push-Match, Navigation gestartet,
angekommen und angenommen/Need erledigt getrennt.

## 11. Offline und schwache Verbindung

V1 hält offline oder bei schlechter Verbindung mindestens verfügbar:

- aktuellen Trip
- aktive Needs und Dringlichkeiten
- Route und erkannten Abschnitt
- zuletzt geladene Matches
- bekannte Ziele
- Navigation zu bereits bekannten Zielen

Vorzuladen sind aktuelle und die nächsten zwei bis drei Etappen. Neue
Server-Matches dürfen ohne Netz verzögert eintreffen. Vollständiges Offline-
Matching ist kein zwingendes V1-Ziel. Die App darf keine Live-Aktualität
behaupten, wenn nur alte Daten vorliegen.

## 12. Track, Historie, Export und persönliche Rückschau

V1 speichert den tatsächlichen Weg ausreichend detailliert und nicht nur den
letzten Standort. Ein Trip-Track umfasst konzeptionell:

- Zeitstempel
- Positionsdaten
- Genauigkeit
- Stop-/Stationsableitung
- Etappenzuordnung

Abgeschlossene Trips bleiben grundsätzlich dauerhaft gespeichert, bis der
Pilger sie oder den Account löscht. Der Pilger kann Tripdaten als GPX, CSV und
JSON exportieren.

Nach Tripabschluss erhält er eine persönliche Rückschau mit Route, Etappen,
Stationen, Distanz, angenommenen Offers und – soweit vorhanden – Stops, Bildern
und Notizen. Das muss iterativ ausgebaut werden können; das V1-Datenmodell darf
die Rückschau nicht verbauen.

Persönliche Notizen und Fotos dürfen Trip, Tag, Station, Ort und Zeitpunkt
zugeordnet werden. Sie sind nicht Teil des Matchings.

Stops werden aus Bewegungsmustern vorgeschlagen. Pilger können sie bestätigen,
korrigieren, ergänzen oder löschen.

## 13. Trust, Bewertungen und Datenqualität

Pilger können ein Offer bzw. einen Anbieter mit 1–5 Sternen bewerten und
strukturierte Signale abgeben, zum Beispiel:

- war offen
- Information korrekt
- hilfreich
- Preis stimmte
- Standort stimmte

Zusätzlich können Probleme gemeldet werden:

- geschlossen
- Preis falsch
- Angebot existiert nicht
- Standort falsch
- weitere definierte Gründe

Meldungen werden abgestuft behandelt. Standort falsch oder Offer nicht existent
hat hohe Priorität und kann Pushfähigkeit temporär entziehen. Eine einzelne
leichte Preisabweichung senkt zunächst Confidence oder erzeugt eine Prüfung;
nicht jede einzelne Meldung nimmt den Eintrag sofort vollständig offline.

Jeder öffentliche POI/Service/Offer braucht Quelle, Confidence,
Verifikationsstatus, Scope, Sichtbarkeit und – wenn möglich –
`lastVerifiedAt`. Providerbestätigte, von Ultreia vorab gepflegte, öffentliche
und unsichere Angaben müssen unterscheidbar bleiben. Trust ersetzt keine
Garantie.

## 14. Admin V1 und Provider-Statistiken

### 14.1 Admin-Funktionen

Admin V1 muss mindestens ermöglichen:

- Provider suchen, ansehen, sperren und entsperren
- Offers ansehen, bearbeiten, pausieren und archivieren
- Needs/Kategorien verwalten
- Übersetzungen korrigieren
- Pilgermeldungen bearbeiten
- Seed-Provider und Seed-Offers anlegen
- technische Pushfähigkeit prüfen
- Audit-Historie ansehen
- Datenqualitätswarnungen bearbeiten

Die Admin-Karte zeigt Provider, Offers, Radien und Route, um Seed-Qualität,
Lücken, Überschneidungen und falsche Standorte zu prüfen.

Ein eigener Datenqualitätsblock erkennt mindestens fehlende/ungültige
Koordinaten, alte Bestätigungen, fehlende Öffnungszeiten oder Übersetzungen,
fehlende Pushfähigkeit, unplausible Standorte/Radien und Trust-/Meldungsprobleme.

Admin-/Diagnosezugriff ist geschützt. Admin sieht für technische Nachvollzieh-
barkeit notwendige Standortdaten, aber keine unnötigen Pilgerdaten. Push-
Tokens, Secrets und Schlüssel werden niemals vollständig angezeigt.

### 14.2 Provider-Statistiken

Provider sieht in V1 ausschließlich aggregierte Funnel-Statistiken:

```text
Views
→ Push-Matches
→ Navigation gestartet
→ angekommen
→ Angebot angenommen
```

Später können Tageszeiten, Need-Typen und Conversion ergänzt werden. Es gibt
keine Live-Pilgerzahl in der Umgebung und keine Rückschlüsse auf einzelne
Pilger, Positionsverläufe oder Tripdetails.

## 15. DE / EN / ES

Deutsch, Englisch und Spanisch sind von Anfang an vollständig erforderlich.
Die Sprache ist jederzeit wechselbar und gilt für:

- Pilger-, Provider- und Admin-Oberflächen
- Onboarding, Berechtigungs- und Datenschutztexte
- Needs, Offers und Öffnungszeiten-/Verfügbarkeitskommunikation
- Push-Titel und Push-Text
- Datenquellen, Trust, Unsicherheit und Meldungen
- relevante Diagnose- und Systemmeldungen

Provider kann in einer Quellsprache starten. Übersetzungen dürfen zunächst
maschinell live gehen und werden mit Status wie `machine_translated`,
`provider_reviewed` oder `admin_reviewed` nachvollziehbar gemacht.

## 16. Lokaler Testmodus und Beta-Reihenfolge

`production` und `local_test` sind strikt getrennte Datenscopes. Zusätzlich
werden Umgebungen wie `production`, `staging` und `development` getrennt.

`local_test` darf vollständige Provider-/Offer-, Need-, Radius-, Zeitfenster-,
Matching-, Push-, Navigation-, Ankunft-, Erledigt- und Statistiktests
ermöglichen. Es darf aber niemals normalen Pilgern als reales Camino-Angebot
angezeigt oder gepusht werden. Admin und Test-App müssen klar **TESTDATEN –
NICHT PRODUKTIV** anzeigen.

Matching-, Push-, Navigations- und Statistikpipeline soll im Testmodus so weit
wie möglich identisch mit Production sein. Nur Daten- und Umgebungsscope
unterscheiden sich.

Beta-Reihenfolge:

1. **Lokale technische und produktnahe Beta in Österreich**: vollständige
   Kette mit lokalen Testdaten und realem Gerät.
2. **Geschlossene Camino-Beta**: zunächst begrenzter Abschnitt, sinnvoll etwa
   Burgos–León, mit echten Pilgern.
3. **Breitere öffentliche Beta** erst nach belastbarer Ketten- und
   Qualitätsprüfung.

## 17. Architekturprinzipien für die spätere Implementierung

Die V1-Implementierung muss folgende Grenzen einhalten:

- Produktlogik bleibt von technischem Device-/Push-Diagnosecode getrennt.
- Account und Device bleiben getrennte Identitäten.
- Matching und Notification Policy sind getrennte Schritte.
- POI, Service, ProviderProfile, ProviderAccount und Offer bleiben getrennte
  Konzepte.
- RouteKm, Segment, Korridor und Richtung sind fachliche Matchingdaten.
- Need-Taxonomie ist zentral und nicht in Clients dupliziert.
- `dataScope` und `environmentScope` werden bei Lesen, Matching, Push und Admin
  geprüft.
- Ereignisse bleiben erklärbar: Match, Notification, Navigation, Ankunft,
  Erledigung, Trust und Audit sind unterscheidbar.
- Spätere Authmethoden, Needs, Sprachen, Verfügbarkeiten, Monetarisierung,
  Routen und Exporte dürfen das V1-Modell erweitern können.

## 18. Account-Löschung und Datenrechte

Der Pilger kann den Account direkt in der App löschen. Die Löschung umfasst:

- persönliche Daten
- aktive und abgeschlossene Trips
- Standort- und Trackdaten
- persönliche Notizen und Fotos
- persönliche Match-/Offer-Zustände

Nur rechtlich oder betrieblich zwingende, anonymisierte Aggregatdaten dürfen
gegebenenfalls verbleiben. Export und Löschung dürfen keine Provider- oder
anderen Pilgerdaten offenlegen.

## 19. V1-Definition of Done

V1 ist erst fachlich abgeschlossen, wenn alle folgenden Aussagen belastbar
gelten:

### Pilger und Trip

- Magic-Link-Registrierung startet erst beim bewussten Camino-Start.
- Account, Device, Trip, Needs und Prioritäten sind getrennt modelliert.
- Maximal ein aktiver Trip sowie Pause/Completion funktionieren.
- Camino-Route und Abschnitt werden automatisch erkannt oder bei Unsicherheit
  bestätigt.
- Background Location und Push sind transparent, widerrufbar und consentbasiert.

### Need, Match und Push

- Kuratierter Need-Katalog ist dreisprachig und adminverwaltet.
- Needs haben Dringlichkeit, Priorität und Push-Einstellung.
- Matching ist route-first, richtungs- und gehbarkeitsbezogen.
- Radius ist nur Kandidaten-Trigger, nicht Relevanzentscheidung.
- Match und Notification Policy sind getrennt und diagnostizierbar.
- Cooldowns, Tageslimit, Pause und Trust-/Datenregeln unterdrücken unpassende
  Pushes.
- Ein Push öffnet den relevanten Offer-Stack in der passenden Sprache.

### Provider, Daten und Trust

- Provider-Self-Service, E-Mail-Verifikation, Google-validierter Standort und
  Offer-Pflichtdaten funktionieren.
- Seed-Daten sind als solche markiert und können später über Providerpflege
  verbessert werden.
- Öffnungszeiten, Preise, Verfügbarkeit, Trust und Quellen sind sichtbar und
  ohne Garantiesprache kommuniziert.
- Ratings, strukturierte Signale und abgestufte Problemberichte sind
  nachvollziehbar.

### Navigation, Verlauf und Offline

- In-App-Navigation mit Fallback führt zum konkreten POI/Service.
- Ankunft wird vorgeschlagen, aber Needs/Offers erst nach Nutzerbestätigung
  erledigt.
- Track, Stops, Notizen, Fotos, Rückschau und GPX/CSV/JSON-Export sind mit
  Datenschutz und Löschung vereinbar.
- Aktuelle und nächste Etappen sowie bekannte Ziele sind bei schwacher
  Verbindung brauchbar; Live-Frische wird nicht vorgetäuscht.

### Admin, Statistik und Betrieb

- Admin kann Provider, Offers, Needs, Übersetzungen, Meldungen, Seed und
  Datenqualität verwalten.
- Providerstatistiken sind aggregiert und bilden den definierten Funnel ab.
- Lokaler Testmodus beweist dieselbe fachliche Pipeline ohne Vermischung mit
  Production.
- DE/EN/ES sind in Pilger-, Provider- und relevanten Admin-Flächen vollständig.
- Datenschutz, Audit, Scope-Trennung und Fehlerdiagnostik sind belastbar.

Der qualitative DoD ist zusätzlich erforderlich: Hinweise müssen im richtigen
Moment relevant sein und dürfen nicht nerven. Ein technisch funktionierender,
aber irrelevanter oder zu aggressiver Push-Kanal ist kein V1-Erfolg.

## 20. Bewusst offene Entscheidungen

Folgende Punkte sind für V1 als Architektur-/Produktgrenze klar, aber noch
konkret zu entscheiden:

- finale stabilen Taxonomie-Keys und vollständige Übersetzungstexte für den
  erweiterten Need-Katalog;
- konkrete Minuten-/Stundenwerte für globale, Need- und Offer-Cooldowns;
- genaue tägliche Push-Grenzen und kritische Übersteuerungsregeln;
- finaler Anbieter-Verifikations- und Moderationsworkflow innerhalb des
  grundsätzlich beschlossenen Self-Service;
- konkrete Route-Geometrie, Etappen- und Directions-Anbieter;
- endgültige Aufbewahrungsfristen für Rohtracks, Logs und Diagnoseereignisse;
- genaue Account-/Admin-Rechte und Audit-Aufbewahrung;
- finale Ankunftsschwellen und Stop-Erkennungsparameter;
- endgültige Offline-Synchronisations- und Konfliktregeln;
- konkrete Bewertungsaggregation und Eskalationsschwellen.

Diese offenen Punkte dürfen in der Implementierung nicht stillschweigend durch
zufällige Defaults zu Produktentscheidungen werden.
