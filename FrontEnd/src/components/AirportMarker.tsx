import React, { useEffect, useState } from 'react'
import { LatLng, Polyline } from 'leaflet'
import { Polygon, Popup } from 'react-leaflet'
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

function DisplayDetailedInfo({ airportData }: { airportData: Airport }) {

  const [ringDescriptions, setRingDescriptions] = useState(new Map());

  if(airportData == undefined) {
    return <> </>
  }
  useEffect(() => {
    async function fetchRings() {
      if(ringDescriptions.has(airportData.id)) {
        return;
      }

      console.log("Fetching rings for ", airportData.id)
      let temp = []
      const allRings = await getDetailedAirportInfo(airportData.id)
      console.log("Found ", allRings.length, " rings for ", airportData.id)
      setRingDescriptions(ringDescriptions.set(airportData.id, [<Polygon positions={allRings} pathOptions={{opacity: 0.75}}/>]))
    }

    fetchRings()
  }, [airportData])

  if(ringDescriptions.keys == 0) {
    return <></>
  } else {
    return <>{ringDescriptions.get(airportData.id)}</>;
  }
  
}


function AirportMarker( { airportData }: AirportMarkerProps) {
  //console.log("Rendering AirportMarker for ID:", airportData.id);
  return (<>
    <div>
       <Popup>
            {`Airport ID: ${airportData.id}\nLat: ${airportData.lat.toFixed(5)}, Lon: ${airportData.lon.toFixed(5)}`}
            <DisplayDetailedInfo airportData={airportData}/>
       </Popup>
    </div>
    </>
  );
}

export default AirportMarker;