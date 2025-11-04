import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { useMapEvents } from 'react-leaflet/hooks'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function LocationMarker() {
  const [position, setPosition] = useState(null)
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng)
    }
  })

  return position === null ? null : (
    <div>
      <Marker position={position}>
        <Popup>{`position: ${position.lat}, ${position.lng}`}</Popup>
      </Marker>
    </div>

  )
}


export default function MapView() {

  return (
    <MapContainer center={{lat: 45.435, lng: -122.7}} zoom={10} scrollWheelZoom style={{ height: '70vh', width: '100%' }}>
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
      <LocationMarker />

    </MapContainer>
  )
}
