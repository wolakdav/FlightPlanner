# Backend Project Overview

## Purpose
The backend provides geospatial flight-planning data APIs for the frontend map experience. It exposes airport discovery in the current map viewport and detailed airspace geometry lookup by airport identifier.

## Architecture
The backend follows a small Flask-based service structure:

- Application entry point: `src/app.py`
- Route registration module: `src/endpoints/getAirportsInBox.py`
- External data client and query logic: `src/faaArcGis/faaArcGisClient.py`
- Utility helpers: `src/utils/longLatFlipper.py`
- Data-loading scripts: `src/scripts/loadDataToRedis.py`
- Static geospatial resources (shapefiles and VRT files): `resources/`

### Runtime flow
1. Flask app starts and registers routes from the endpoints module.
2. `/airportsInBox` accepts a lat/lon bounding box.
3. The ArcGIS airport `FeatureLayer` is queried with an `intersects` geometry filter.
4. Results are normalized into lightweight airport objects and returned as JSON.
5. `/detailedAirportInfo` accepts an `icao_id` and returns airport airspace polygon rings.
6. Detailed airspace responses are read from Redis when cached; otherwise fetched from ArcGIS and transformed.

## Technologies Used
- Python 3.8+
- Flask for HTTP API routing
- ArcGIS Python API (`arcgis.features`, `arcgis.geometry`) for FAA-hosted geospatial layers
- Redis for caching/query support
- Requests + CSV for data ingestion scripts
- Setuptools packaging (`setup.py`)
- Developer tooling in requirements: `pytest`, `black`, `flake8`

## Key API Endpoints
- `GET /airportsInBox`
  - Query params: `xmin`, `ymin`, `xmax`, `ymax`
  - Returns: `{ "airports": [...] }` with ICAO/ident, coordinates, type, name, private-use flag.
- `GET /detailedAirportInfo`
  - Query param: `icao_id`
  - Returns: detailed airspace geometry rings for the airport.
- `GET /`
  - Basic placeholder text response.

## Current Capabilities
- Query airports that intersect a viewport bounding box.
- Filter to operational airports before returning response data.
- Fetch and return detailed class airspace geometry by airport identifier.
- Apply coordinate-order transformation utility for returned geometry.
- Add permissive CORS response headers (`Access-Control-Allow-Origin: *`) for frontend integration.
- Use Redis as a cache lookup for detailed airport geometry.
- Provide standalone script support for loading airport data into Redis.

## Data Sources
- FAA ArcGIS-hosted feature services:
  - US Airport layer
  - Class Airspace layer
- Local geospatial files under `resources/shapefiles` and `resources/vrtFiles`.

## Notes and Limitations
- Error handling is minimal for missing/invalid query parameters.
- CORS handling is route-level and permissive; no centralized policy middleware.
- `setup.py` currently lists dev tools as install requirements, which may not reflect production runtime dependencies.
- The Redis caching path for detailed airport info currently reads from Redis and computes fallback results when missing; persistence strategy for computed fallback data is not documented in code.
