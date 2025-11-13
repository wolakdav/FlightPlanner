import React, { useEffect, useState } from 'react'
import { CircleMarker, Marker, Polyline , Popup, Tooltip } from 'react-leaflet'
import { Airport } from '../common/common'

interface AirportMarkerProps {
  airportData : Airport;
}


async function getDetailedAirportInfo(icao_id: string): Promise<[number, number][][]> {
  return await fetch(`http://localhost:5000/detailedAirportInfo?icao_id=${icao_id}`)
  .then(response => response.json())
  .then(data => {
    let allRings = []
    //console.log("Received airspace data:", data);
    data["geometry"].forEach((rawRings) => {
        //console.log("Ring latLngs:", rawRings);
        allRings = allRings.concat([rawRings]);
    });

    return allRings
  });
}

function AirportDetails(color, airportData: Airport) {
  return L.divIcon({
    html: `
      <div style="
        background: ${color};;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border: 2px solid white;
      ">
        ${airportData.id} - ${airportData.name}
      </div>
    `,
    className: '', // prevents Leaflet default styles
    iconSize: [30, 30],
  })
}

function DisplayAirspace({ airportData }: { airportData: Airport }) {

  const [ringDescriptions, setRingDescriptions] = useState([]);

  if(airportData == undefined) {
    return <> </>
  }
  useEffect(() => {
    async function fetchRings() {
      const allRings = await getDetailedAirportInfo(airportData.id)
      setRingDescriptions([<Polyline positions={allRings}/>])
    }

    fetchRings()
  }, [airportData])

  return <>{ringDescriptions}</>;
}


function AirportMarker( { airportData }: AirportMarkerProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  let color = "blue"
  if(airportData.private) {
    color = "red"
  }

  return (<>
      <Marker position={[airportData.lat, airportData.lon]} icon={AirportDetails(color, airportData)} eventHandlers={{
          click: () => setShowDetails(!showDetails)
        }}>
        {showDetails && <DisplayAirspace airportData={airportData}/>}

      </Marker>
    </>
  );
}

export default AirportMarker;