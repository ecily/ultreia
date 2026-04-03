# Ultreia Frontend

Produktions-Frontend fuer Ultreia (React + Vite).

## Kernidee

Ultreia zeigt nicht einfach lokale Angebote an, sondern matched **Ort + Zeit + Interesse** und informiert genau im richtigen Moment.

## Start

```bash
npm install
npm run dev
```

## Build (Production)

```bash
npm run build
npm run preview
```

## Wichtige ENV-Variablen

- `VITE_API_BASE_URL` - Backend-API-Basis (`.../api`)
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API Key
- `VITE_GOOGLE_MAPS_MAP_ID` - optional fuer erweiterte Map-Styles/Marker

## Seiten

- `src/pages/LandingPage.jsx` - Haupt-Landingpage
- `src/pages/WhyUltreia.jsx` - Positionierung/USP
- `src/pages/Pitch.jsx` - Investor-Zusammenfassung
- `src/pages/TesterGate.jsx` + `src/pages/NDA.jsx` - Tester-Zugang
- `src/pages/Login.jsx` / `src/pages/Register.jsx` - Anbieter Auth
- `src/pages/PrivacyPage.jsx` - Datenschutzhinweise
- `src/pages/AdminCategoryPage.jsx` / `src/pages/AdminOffersMap.jsx` - Admin-Flows

## Designsystem

Gemeinsame UI-Tokens und Komponentenklassen sind zentral in `src/index.css` definiert.

## Hinweise

- Keine Auto-Commits in Git aus diesem Repo-Stand.
- Fuer Deploy nur nach lokal erfolgreichem `npm run lint` und `npm run build`.
