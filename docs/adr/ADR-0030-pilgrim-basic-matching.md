# ADR-0030: Pilger-Needs und serverseitiges Basis-Matching

Status: Accepted — 2026-08-21

## Entscheidung

Der erste Pilger-Matching-Block verwendet bestehende Auth-, Trip-, Device-
Heartbeat-, Provider- und Offer-Modelle. Pilger-Needs werden als eigene
`pilgrimNeeds`-Dokumente mit `userId`, `tripId`, `scope`, `needKey`, `active`,
`urgency`, `pushEnabled`, `priorityOrder`, `createdAt` und `updatedAt`
gespeichert.

`POST /api/pilgrim/matches/current` prüft serverseitig aktive Session, Scope,
aktiven Trip, letzte gebundene Geräteposition, aktive Needs, aktiven Provider,
aktives und bestätigtes Offer, gültigen Radius, Providerkoordinaten sowie
aktuelle strukturierte Öffnungszeiten. Die technische Distanz ist eine
Haversine-Basisdistanz innerhalb des Offer-Radius. Ergebnisse werden zuerst
nach `now`, `today`, `always`, danach nach Distanz sortiert.

`local_test` und `production` bleiben strikt getrennt. Provider erhalten keine
Pilgerdaten. Die Matchdiagnose wird nur im autorisierten `local_test` an den
Pilger zurückgegeben. Push, Notification Policy, Route, Gehweg, Richtung,
Navigation und Arrival sind ausdrücklich nicht Teil dieses Blocks.
