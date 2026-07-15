import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { LeafletMouseEvent, latLng } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PositionsList from './PositionsList'
import { Position } from '../common/common'
import AirportMarker from './AirportMarker'
import { Airport } from '../common/common'

function AirportMarkers({ positions, setPositions }: { positions: Position[]; setPositions: React.Dispatch<React.SetStateAction<Position[]>> }) {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(10);
  const airportNameZoomThreshold = 10;

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
      {airports.map((airport: Airport, idx: number) => (
        <AirportMarker
          key={`${airport.id}-${idx}`}
          airportData={airport}
          zoomLevel={zoomLevel}
          showAirportName={zoomLevel >= airportNameZoomThreshold}
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
            <AirportMarkers positions={positions} setPositions={setPositions} />
        </MapContainer>
      </div>

      {/* Positions list rendered outside the map so state is elevated */}
      <PositionsList positions={positions} setPositions={setPositions} />
    </div>
  )
}
