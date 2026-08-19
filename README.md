# Ultreia.app

Ultreia ist ein Camino-spezifischer Wegbegleiter für Pilger am Camino Francés.

## Geografischer MVP-Scope

Gesamter Camino Francés von Saint-Jean-Pied-de-Port bis Santiago de Compostela.

## Sprachen ab Start

- Deutsch
- Englisch
- Spanisch

## Monorepo-Struktur

- `backend/`
- `mobile/`
- `frontend/`
- `shared/`
- `docs/`

## Fachliche Source of Truth

Die konsolidierte fachliche V1-Definition steht in
[`docs/ULTREIA_V1_PRODUCT_SPEC.md`](docs/ULTREIA_V1_PRODUCT_SPEC.md).
Der aktuelle technische Projektstand, die Infrastruktur und verifizierte
Nachweise stehen in [`docs/ULTREIA_CONTEXT.md`](docs/ULTREIA_CONTEXT.md).

## Projektgrenze

StepsMatch.com bleibt technisches Labor.

Ultreia ist ein eigenständiges Produkt.

Technik und Learnings aus StepsMatch dürfen bewusst übernommen werden.

Keine StepsMatch-Daten, Branding, Demo-Inhalte, Commits oder Deploys vermischen.

## Aktueller Hinweis

- Die technische Android-/Backend-Basis ist vorhanden und separat verifiziert.
- Die fachliche V1-Implementierung ist noch nicht gebaut; die Produktspezifikation
  ist dafür jetzt verbindlich.
- Die vollständige Mongo-/Domänen-/Auth-/Matching-Implementierung folgt in
  eigenen, geplanten Arbeitsblöcken.
- Live-Infrastruktur und Repository-Remote bestehen; Secrets bleiben außerhalb
  des Repositories.
