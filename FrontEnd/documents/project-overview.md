# Frontend Project Overview

## Purpose
The frontend provides an interactive map-based flight-planning UI. Users can pan/zoom the map to load airports in view, inspect airport details, and visualize airport airspace geometry.

## Architecture
The frontend is a React + TypeScript single-page app built with Vite.

- App bootstrap: `src/main.tsx`
- Root app shell: `src/App.tsx`
- Main map experience: `src/components/MapView.tsx`
- Airport rendering and detail logic: `src/components/AirportMarker.tsx`
- Position list/editor UI: `src/components/PositionsList.tsx`
- Shared types: `src/common/common.tsx`

### Runtime flow
1. `main.tsx` mounts the React app.
2. `App.tsx` renders the map-centric UI.
3. `MapView` initializes Leaflet map tiles and listens for map `moveend` events.
4. On each move end, frontend calls backend `GET /airportsInBox` with current bounds.
5. Returned airports are rendered as custom Leaflet markers.
6. Clicking a marker triggers backend `GET /detailedAirportInfo` for that ICAO ID.
7. Returned ring geometry is drawn as map polylines for airspace display.

## Technologies Used
- React 18
- TypeScript
- Vite 5 build/dev tooling
- Leaflet + React-Leaflet for map rendering
- CSS for styling (`src/index.css`)

### Package highlights
- `leaflet`, `react-leaflet`, `leaflet.nauticscale`
- `react`, `react-dom`
- Type definitions for React and Leaflet

## Current Capabilities
- Interactive map rendering with Leaflet tile layer.
- Dynamic airport fetch based on visible bounding box.
- Display airport markers with custom icon markup.
- Marker click interaction to fetch and show detailed airspace geometry.
- Basic visual distinction for private vs non-private airports (marker color logic).
- Position list UI with editable names and row-level removal actions.
- Polyline rendering support between selected positions (state scaffolding present).

## Backend Integration
The frontend currently expects a backend at `http://localhost:5000` with:
- `GET /airportsInBox` for visible-airports retrieval.
- `GET /detailedAirportInfo` for airport airspace geometry.

## Notes and Limitations
- Airport accumulation on repeated map movement appends to existing state and may produce duplicates.
- Error/loading states for network requests are not currently surfaced in the UI.
- Some files are scaffolding or partially used (for example `src/pages/mainPage.tsx` is present but empty).
- Tile source is configured to `/resources/tiles/{z}/{x}/{y}.png`, which requires tiles to be served by the frontend or backend.
- `node-redis`/`redis` dependencies appear in frontend `package.json` but are typically server-side libraries.
