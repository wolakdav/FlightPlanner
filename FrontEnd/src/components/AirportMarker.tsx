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

function AirportDetails({ airportData }: { airportData: Airport }) {
  

  return (<>
    <div>Airport Name: {airportData.id}</div>
    <div>Type: {airportData.type}</div>
    
  
  </>)
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
  console.log("Show deets ", showDetails)
  
  let color = "blue"
  if(airportData.private) {
    color = "red"
  }

  return (<>
      <CircleMarker center={[airportData.lat, airportData.lon]} radius={20} pathOptions={{ color: color }} eventHandlers={{
          click: () => setShowDetails(!showDetails)
        }}>
        {showDetails && <DisplayAirspace airportData={airportData}/>}
        <Popup autoClose={true}>
          <AirportDetails airportData={airportData}/>
        </Popup>
      </CircleMarker>
    </>
  );
}

export default AirportMarker;