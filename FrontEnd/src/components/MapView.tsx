import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvent } from 'react-leaflet'
import { useMapEvents } from 'react-leaflet/hooks'
import L, { LatLng, LeafletMouseEvent } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PositionsList from './PositionsList'
import { Position } from '../common/common'
import "leaflet/dist/leaflet.css";
import AirportMarker from './AirportMarker'

function boxFromCorners(sw: LatLng, ne: LatLng) {
  const centerLon = (sw.lng + ne.lng) / 2;
  const centerLat = (sw.lat + ne.lat) / 2;

  // Convert degrees difference to km approximately
  // 1 degree lat ≈ 111 km
  const heightKm = (ne.lat - sw.lat) * 111;
  // 1 degree lon ≈ 111 km * cos(latitude)
  const widthKm = (ne.lng - sw.lng) * 111 * Math.cos(centerLat * Math.PI / 180);

  return { centerLon, centerLat, widthKm, heightKm };
}

function AirportMarkers() {
  const [airports, setAirports] = useState([]);

  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      let box = boxFromCorners(bounds.getSouthWest(), bounds.getNorthEast());
      //console.log("Current box:", box);
      let airports = fetch(`http://localhost:5000/airportsInBox?long=${box.centerLon}&lat=${box.centerLat}&width=${box.widthKm}&height=${box.heightKm}`)
        .then(response => response.json())
        .then(data => {
          data["airports"].forEach((airport: any) => 
            setAirports((prevAirports) => [...prevAirports, {id: airport.id, lat: airport.latitude, lon: airport.longitude}])
          );
          //console.log("Airports in box:", data);
        });
    },
  });

  return (
    <>
      {airports.map((airport: any, idx: number) => (
        <><Marker
          key={idx}
          position={{ lat: airport.lat, lng: airport.lon }}
        >
          <AirportMarker airportData={{ id: airport.id, lat: airport.lat, lon: airport.lon }} />
        </Marker></>
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

  return (
    <div>
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
          url="/resources/tiles/{z}/{x}/{y}.png"
        />
        
        <LocationMarker positions={positions} setPositions={setPositions} />
        <AirportMarkers />
      </MapContainer>

      {/* Positions list rendered outside the map so state is elevated */}
      <PositionsList positions={positions} setPositions={setPositions} />
    </div>
  )
}
