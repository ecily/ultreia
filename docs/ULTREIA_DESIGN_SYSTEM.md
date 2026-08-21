# Ultreia design system – V1

Stand: 2026-08-21. Dieses kleine System hält die öffentliche Startseite,
Provider-Weboberfläche und Admin-Oberfläche visuell zusammen, ohne neue
Produktlogik einzuführen.

## Visuelle DNA

- Camino-Blau trägt Orientierung, Text und Primärstruktur.
- Camino-Gelb markiert eine konkrete nächste Handlung oder relevante Nähe.
- Warmes Cream/Stone bildet einen ruhigen, nicht-technischen Hintergrund.
- Grün bleibt sekundär für bestätigte, verfügbare oder positive Zustände.
- Pfeil/Wayfinding ist ein sparsames Funktionszeichen, kein dekoratives Muster.
- Das Shell-Zeichen bleibt sekundäre Identität; es ersetzt keine verständliche
  Produktbotschaft.

## Typografie und Layout

- Systemschrift ohne zusätzliche Font-Abhängigkeit.
- Breite Inhaltszeile: `1120px`; mobile Innenabstände: mindestens `20px`.
- H1/H2 führen über klare Verben und konkrete Situationen, nicht über
  technische Begriffe.
- Karten und Panels erhalten sichtbare Grenzen, kurze Metadaten und große
  Touch-Ziele.

## Interaktionsregeln

- Primäre Aktionen sind gelb auf blauem oder hellem Grund und haben mindestens
  44px nutzbare Höhe.
- Sekundäre Aktionen bleiben ruhig und konkurrieren nicht mit dem relevanten
  Hinweis.
- Jede fokussierbare Aktion erhält einen sichtbaren `:focus-visible`-Zustand.
- Provider- und Admin-Technikdetails bleiben zugänglich, aber visuell
  nachgeordnet.
- Öffnungs- und Verfügbarkeitsaussagen werden nicht stärker formuliert, als
  die gespeicherten Daten es erlauben.

## Produktgrenzen

Die Gestaltung unterstützt ausschließlich den bestehenden V1-Flow: Need
auswählen, passenden Hinweis erhalten, lokale Anbieterinformationen prüfen.
Sie implementiert keine Navigation, Routenberechnung, Hintergrund-Matching,
automatische Push-Zustellung, Bewertungen oder Monetarisierung.
