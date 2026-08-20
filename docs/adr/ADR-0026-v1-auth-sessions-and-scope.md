# ADR-0026: V1 Auth-Session- und Scope-Grundlage

## Status

Accepted — 2026-08-19

## Kontext

Ultreia benötigt eine gemeinsame Auth-Basis für Pilger, Provider und Admins,
ohne Device-Identität und fachliche User-Identität zu vermischen. Die erste
V1-Grundlage muss außerdem nach Neuinstallation/Gerätewechsel wiederherstellbar
sein und Production-Daten strikt von lokal autorisierten Testdaten trennen.

## Entscheidung

- Magic Links sind kryptographisch zufällige, kurzlebige One-Time-Tokens. In
  MongoDB wird ausschließlich der SHA-256-Hash gespeichert; Nutzung markiert
  den Datensatz atomar als verbraucht.
- Sessions verwenden opaque, serverseitig gehashte Access-Tokens mit kurzer
  Laufzeit und gehashte, rotierbare Refresh-Tokens mit längerer Laufzeit.
  Sessions tragen `userId`, optional `deviceId` und den unveränderlichen Scope.
  Logout widerruft die Session und löst die Device-Bindung, ohne Push-Tokens
  zu löschen.
- `User` ist die gemeinsame Entität mit Rollenarray `pilgrim`, `provider` und
  `admin`; Profile bleiben in eigenen Collections. Rollen werden ausschließlich
  serverseitig geprüft.
- `production` ist der Default. `local_test` wird im Production-Backend nur
  für serverseitig autorisierte Admin-/Test-Accounts akzeptiert, wenn die
  Serverkonfiguration es erlaubt und der technische Client den Scope beim
  Auth-Flow ausdrücklich anfordert. Danach ist der Scope an die Session
  gebunden; ein Wechsel wird abgewiesen. Der Scope wird nicht aus einer
  beliebigen Query- oder Body-Angabe übernommen.
- Der lokale Mail-Provider ist eine technische Outbox-Diagnose. Production
  benötigt einen konfigurierten Transactional-Mail-Provider; Secrets werden
  ausschließlich aus der Runtime gelesen.

## Production-Web-Auth-Ergänzung

`local_test` ist auch im Production-Backend technisch verfügbar, aber nur für
serverseitig autorisierte Admin-/Test-Accounts (`admin`, `testAccess` oder
explizite `LOCAL_TEST_EMAILS`-Runtimekonfiguration). Der Auth-Flow muss den
Scope ausdrücklich anfordern; normale Accounts erhalten keinen Zugriff.

Websessions verwenden HttpOnly-Cookies mit `SameSite=Lax` und Origin-Prüfung
für schreibende Cookie-Anfragen. Das statische Webfrontend stellt Provider-
und Admin-Login, Verify, Rollen-Guards und Logout bereit. Der eigentliche
Production-Mailversand bleibt ein konfigurationsabhängiger externer Dienst.

## Konsequenzen

Trips, technische Diagnose-/Location-/Push-Registrierungsdaten und spätere
Provider-/Offer-Daten können dieselben Modelle und Services mit getrennten
Scopes verwenden. Die Trip-Collection garantiert per partiellem Unique-Index
maximal einen nicht abgeschlossenen Trip (`active` oder `paused`) je Pilger und
Scope. Eine vollständige Löschkaskade für spätere Domänen bleibt ein späterer
Service-Hook; die aktuelle Account-Basis wird sofort soft-deaktiviert,
Sessions werden widerrufen und Devices entkoppelt.

## Expliziter Provider-Scopewechsel (2026-08-19)

Autorisierte Provider/Admin-Testnutzer können über eine geschützte
`POST /api/auth/session/switch-scope`-Aktion zwischen `production` und
`local_test` wechseln. Der Server prüft die Berechtigung gegen Admin-/Test-
Claims oder die serverseitige `LOCAL_TEST_EMAILS`-Allowlist, widerruft die
aktuelle Session und stellt eine neue Session mit dem Ziel-Scope aus. Normale
Accounts erhalten `local_test_not_authorized`.

ProviderProfile- und Offer-Abfragen verwenden ausschließlich `userId` plus
Session-Scope; es gibt keinen Scope-Fallback auf Daten des jeweils anderen
Bereichs. Der Client darf den Scope nicht durch einen Header, Query-Parameter
oder eine reine lokale Variable erzwingen.

## Mehrere Rollen und aktiver Rollen-Kontext (2026-08-20)

Ein User bleibt eine zentrale Identitaet und kann gleichzeitig mehrere
zulaessige Rollen in `User.roles` besitzen, zum Beispiel `provider` und
`admin`. Der Login-Einstieg sendet `requestedRole`; dieser Kontext wird im
One-Time-Magic-Link gespeichert und beim Verify gegen die aktuellen User-
Rollen geprueft. Ein unbekannter Admin wird weiterhin nie automatisch
angelegt; ein bestehender User bekommt durch einen Login keine neue Rolle und
verliert keine vorhandene Rolle.

Jede neue Session traegt neben `userId` und `scope` den `activeRole` sowie die
serverseitig abgeleiteten `allowedRoles`. `scope` und `activeRole` sind
getrennte Dimensionen. `requireRole` prueft sowohl die User-Berechtigung als
auch den aktiven Session-Kontext. Ein Provider-Login kann daher nicht als
Admin-Session auf Admin-Routen verwendet werden und umgekehrt. Ein neuer
Magic-Link-Verify ersetzt die Web-Cookies durch die neue Session; ein
vorhandener Cookie blockiert den anderen Rollen-Login nicht.

`GET /api/auth/me` liefert User-Rollen sowie `session.activeRole`,
`session.allowedRoles` und `session.scope` ohne Access-/Refresh-Token.
