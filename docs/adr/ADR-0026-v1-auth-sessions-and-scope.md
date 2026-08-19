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
- `production` ist der Default. `local_test` wird nur von einem Nicht-
  Production-Backend akzeptiert, wenn die Serverkonfiguration es erlaubt und
  der technische Client den Scope beim Auth-Flow ausdrücklich anfordert.
  Danach ist der Scope an die Session gebunden; ein Wechsel wird abgewiesen.
  Der Scope wird nicht aus einer beliebigen Query- oder Body-Angabe
  übernommen.
- Der lokale Mail-Provider ist eine technische Outbox-Diagnose. Production
  benötigt einen konfigurierten Transactional-Mail-Provider; Secrets werden
  ausschließlich aus der Runtime gelesen.

## Konsequenzen

Trips, technische Diagnose-/Location-/Push-Registrierungsdaten und spätere
Provider-/Offer-Daten können dieselben Modelle und Services mit getrennten
Scopes verwenden. Die Trip-Collection garantiert per partiellem Unique-Index
maximal einen nicht abgeschlossenen Trip (`active` oder `paused`) je Pilger und
Scope. Eine vollständige Löschkaskade für spätere Domänen bleibt ein späterer
Service-Hook; die aktuelle Account-Basis wird sofort soft-deaktiviert,
Sessions werden widerrufen und Devices entkoppelt.
