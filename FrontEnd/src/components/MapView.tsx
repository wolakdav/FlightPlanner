import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { LeafletMouseEvent, latLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PositionsList from './PositionsList'
import { Position } from '../common/common'
import AirportMarker from './AirportMarker'
import { Airport } from '../common/common'

interface AirportFilters {
  showPublicAirports: boolean;
  showPrivateAirports: boolean;
  showToweredAirports: boolean;
  showNonToweredAirports: boolean;
  minRunwayLengthFt: number;
}

const MIN_RUNWAY_LENGTH_FT = 0
const MAX_RUNWAY_LENGTH_FT = 12000
const RUNWAY_LENGTH_STEP_FT = 500

function airportPassesFilters(airport: Airport, filters: AirportFilters): boolean {
  if (airport.private && !filters.showPrivateAirports) {
    return false
  }

  if (!airport.private && !filters.showPublicAirports) {
    return false
  }

  if (airport.towered && !filters.showToweredAirports) {
    return false
  }

  if (!airport.towered && !filters.showNonToweredAirports) {
    return false
  }

  if (filters.minRunwayLengthFt > MIN_RUNWAY_LENGTH_FT) {
    if (airport.longestRunwayFt == null || airport.longestRunwayFt < filters.minRunwayLengthFt) {
      return false
    }
  }

  return true
}

function AirportMarkers({ positions, setPositions, filters }: { positions: Position[]; setPositions: React.Dispatch<React.SetStateAction<Position[]>>; filters: AirportFilters }) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(10);
  const airportNameZoomThreshold = 10;
  const runwayDetailZoomThreshold = 12;

  function isAirportWaypoint(airport: Airport): boolean {
    return positions.some((pos) => pos.latlng.lat === airport.lat && pos.latlng.lng === airport.lon)
  }

  function toggleAirportWaypoint(airport: Airport) {
    setPositions((prevPositions: Position[]) => {
      const existingWaypointIndex = prevPositions.findIndex((pos) => pos.latlng.lat === airport.lat && pos.latlng.lng === airport.lon)
      if (existingWaypointIndex >= 0) {
        return prevPositions.filter((_, index) => index !== existingWaypointIndex)
      }

      return [...prevPositions, { latlng: latLng(airport.lat, airport.lon), name: airport.name }]
    })
  }

  const map = useMapEvents({
    zoomend: () => {
      setZoomLevel(map.getZoom());
    },
    moveend: () => {
      const bounds = map.getBounds();      
      fetch(`/api/airportsInBox?ymin=${bounds.getSouthWest().lat}&xmin=${bounds.getSouthWest().lng}&ymax=${bounds.getNorthEast().lat}&xmax=${bounds.getNorthEast().lng}`)
        .then(response => response.json())
        .then(data => {
          data["airports"].forEach((airport: any) => {
          
            const newAirport = {} as Airport
            newAirport.id = airport.icao_id
            newAirport.name = airport.name
            newAirport.type = airport.type
            newAirport.private = airport.private
            newAirport.towered = Boolean(airport.towered)
            newAirport.longestRunwayFt = airport.longest_runway_ft ?? null
            newAirport.hasHardSurfaceRunway = Boolean(airport.has_hard_surface_runway)
            newAirport.longestHardSurfaceRunwayFt = airport.longest_hard_surface_runway_ft ?? null
            newAirport.lat = airport.latitude
            newAirport.lon = airport.longitude

            setAirports((prevAirports) => [...prevAirports, newAirport])
          });
        });
    },
  });

  useEffect(() => {
    setZoomLevel(map.getZoom());
  }, [map]);

  return (
    <>
      {airports.filter((airport) => airportPassesFilters(airport, filters)).map((airport: Airport, idx: number) => (
        <AirportMarker
          key={`${airport.id}-${idx}`}
          airportData={airport}
          zoomLevel={zoomLevel}
          showAirportName={zoomLevel >= airportNameZoomThreshold}
          showRunwayDetail={zoomLevel >= runwayDetailZoomThreshold}
          isWaypoint={isAirportWaypoint(airport)}
          onToggleWaypoint={() => toggleAirportWaypoint(airport)}
        />
      ))}
    </>
  );
}

function LocationMarker({ positions, setPositions }: { positions: Position[]; setPositions: React.Dispatch<React.SetStateAction<Position[]>> }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      setPositions((prev: Position[]) => [...prev, { latlng: e.latlng }])
    }
  })

  if (positions.length === 0) return null

  return (
    <>

      {positions.map((pos, idx) => (<>
        {positions.length > (idx + 1) && 
          <Polyline
            positions={[pos.latlng, positions[(idx + 1)].latlng]}
            pathOptions={{ color: 'blue', weight: 3 }}
          />
        }
        <Marker
          key={idx}
          position={pos.latlng}
          eventHandlers={{
            click: () => setPositions((prev: Position[]) => prev.filter((_: Position, i: number) => i !== idx)),
            mouseover: (event) => event.target.openPopup(),
            mouseout: (event) => event.target.closePopup()
          }}
        >
          <Popup>
            {`${pos?.name || ''} Position ${idx + 1}: ${pos.latlng.lat.toFixed(5)}, ${pos.latlng.lng.toFixed(5)}`}
          </Popup>
        </Marker>
      </>))}
    </>
  )
}

export default function MapView() {
  const [positions, setPositions] = useState<Position[]>([])
  const [isWaypointModeEnabled, setIsWaypointModeEnabled] = useState<boolean>(true)
  const [showPublicAirports, setShowPublicAirports] = useState<boolean>(true)
  const [showPrivateAirports, setShowPrivateAirports] = useState<boolean>(true)
  const [showToweredAirports, setShowToweredAirports] = useState<boolean>(true)
  const [showNonToweredAirports, setShowNonToweredAirports] = useState<boolean>(true)
  const [minRunwayLengthFt, setMinRunwayLengthFt] = useState<number>(MIN_RUNWAY_LENGTH_FT)

  const airportFilters: AirportFilters = {
    showPublicAirports,
    showPrivateAirports,
    showToweredAirports,
    showNonToweredAirports,
    minRunwayLengthFt,
  }

  return (
    <div className="map-view-shell">
      <div className="menu-column">
        <aside className="side-menu open">
          <h2>Map Options</h2>
          <div className="menu-option">
            <label className="switch" htmlFor="waypoint-toggle">
              <input
                id="waypoint-toggle"
                type="checkbox"
                checked={isWaypointModeEnabled}
                onChange={(event) => setIsWaypointModeEnabled(event.target.checked)}
              />
              <span className="slider"></span>
            </label>
            <span>Waypoints {isWaypointModeEnabled ? 'On' : 'Off'}</span>
          </div>

          <div className="menu-filter-group">
            <span className="menu-filter-title">Airport Access</span>
            <label className="menu-checkbox-option">
              <input
                type="checkbox"
                checked={showPublicAirports}
                onChange={(event) => setShowPublicAirports(event.target.checked)}
              />
              Public
            </label>
            <label className="menu-checkbox-option">
              <input
                type="checkbox"
                checked={showPrivateAirports}
                onChange={(event) => setShowPrivateAirports(event.target.checked)}
              />
              Private
            </label>
          </div>

          <div className="menu-filter-group">
            <span className="menu-filter-title">Air Traffic Control</span>
            <label className="menu-checkbox-option">
              <input
                type="checkbox"
                checked={showToweredAirports}
                onChange={(event) => setShowToweredAirports(event.target.checked)}
              />
              Towered
            </label>
            <label className="menu-checkbox-option">
              <input
                type="checkbox"
                checked={showNonToweredAirports}
                onChange={(event) => setShowNonToweredAirports(event.target.checked)}
              />
              Non-towered
            </label>
          </div>

          <div className="menu-filter-group">
            <label htmlFor="min-runway-length" className="menu-filter-title">
              Min Runway Length: {minRunwayLengthFt === MIN_RUNWAY_LENGTH_FT ? 'Any' : `${minRunwayLengthFt.toLocaleString()} ft`}
            </label>
            <input
              id="min-runway-length"
              className="menu-range-slider"
              type="range"
              min={MIN_RUNWAY_LENGTH_FT}
              max={MAX_RUNWAY_LENGTH_FT}
              step={RUNWAY_LENGTH_STEP_FT}
              value={minRunwayLengthFt}
              onChange={(event) => setMinRunwayLengthFt(Number(event.target.value))}
            />
          </div>
        </aside>
      </div>

      <div className="map-canvas">
        <MapContainer center={{ lat: 45.435, lng: -122.7 }} zoom={10} scrollWheelZoom style={{ height: '70vh', width: '100%' }}>
          {/*
            Browsers cannot load tiles from a local filesystem path. Use an HTTP(S) URL
            or a path served by the frontend (place tiles under FrontEnd/public/resources/tiles/)
            so they are available at: /resources/tiles/{z}/{x}/{y}.png
            If your backend serves tiles, use the backend URL (e.g. http://localhost:5000/resources/tiles/{z}/{x}/{y}.png)
            and ensure CORS headers allow requests from the frontend origin.
          */}
          <TileLayer
            attribution='&copy; Tiles'
            url="/api/resources/tiles/{z}/{x}/{y}.png"
          />

          {isWaypointModeEnabled && <LocationMarker positions={positions} setPositions={setPositions} />}
            <AirportMarkers positions={positions} setPositions={setPositions} filters={airportFilters} />
        </MapContainer>
      </div>

      {/* Positions list rendered outside the map so state is elevated */}
      <PositionsList positions={positions} setPositions={setPositions} />
    </div>
  )
}
