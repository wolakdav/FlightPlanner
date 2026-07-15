import React, { useEffect, useState } from 'react'
import L from 'leaflet'
import { Marker, Polyline, Popup } from 'react-leaflet'
import { Airport } from '../common/common'

interface AirportMarkerProps {
  airportData : Airport;
  zoomLevel: number;
  showAirportName: boolean;
  isWaypoint: boolean;
  onToggleWaypoint: () => void;
}

interface AirportInfoResponse {
  airport: {
    name?: string;
    attributes?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface MetarResponse {
  metar: string | null;
}

const FILTERED_TOP_LEVEL_KEYS = new Set(['type'])
const FILTERED_ATTRIBUTE_KEYS = new Set([
  'AIRANAL',
  'AK_HIGH',
  'AK_LOW',
  'DODHIFLIP',
  'FAR91',
  'FAR93',
  'TYPE_CODE',
  'ICAO_ID',
  'IDENT',
])

const KEY_LABEL_OVERRIDES: Record<string, string> = {
  SERVCITY: 'Service City',
  OPERSTATUS: 'Operational Status',
  PRIVATEUSE: 'Private Use',
  MIL_CODE: 'Military Code',
  GLOBAL_ID: 'Global ID',
  OBJECTID: 'Object ID',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
}


async function getDetailedAirportInfo(icao_id: string): Promise<[number, number][][]> {
  return await fetch(`/api/detailedAirportInfo?icao_id=${icao_id}`)
  .then(response => response.json())
  .then(data => {
    let allRings: [number, number][][] = []
    //console.log("Received airspace data:", data);
    data["geometry"].forEach((rawRings: [number, number][]) => {
        //console.log("Ring latLngs:", rawRings);
        allRings = allRings.concat([rawRings]);
    });

    return allRings
  });
}

function markerSizeForZoom(zoomLevel: number) {
  const clampedZoom = Math.max(6, Math.min(14, zoomLevel));
  return 12 + ((clampedZoom - 6) / 8) * 18;
}

function AirportDetails(color: string, airportData: Airport, zoomLevel: number, showAirportName: boolean) {
  const markerSize = markerSizeForZoom(zoomLevel);
  const markerBorder = Math.max(1, Math.round(markerSize * 0.1));
  const codeFontSize = Math.max(8, Math.round(markerSize * 0.28));
  const nameFontSize = Math.max(10, Math.round(markerSize * 0.5));

  return L.divIcon({
    html: `
      <div style="
        background: ${color};;
        color: white;
        width: ${markerSize}px;
        height: ${markerSize}px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: ${codeFontSize}px;
        border: ${markerBorder}px solid white;
      ">
        ${airportData.id}
      </div>
      ${showAirportName ? `<div style="
        margin-top: 3px;
        text-align: center;
        color: white;
        font-size: ${nameFontSize}px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
        white-space: nowrap;
      ">${airportData.name}</div>` : ''}
    `,
    className: '', // prevents Leaflet default styles
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  })
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function normalizePrivateValue(value: unknown): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function toDisplayLabel(key: string): string {
  if (KEY_LABEL_OVERRIDES[key]) {
    return KEY_LABEL_OVERRIDES[key]
  }

  const normalized = key
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function DisplayAirspace({ airportData }: { airportData: Airport }) {

  const [ringDescriptions, setRingDescriptions] = useState<React.ReactElement[]>([]);

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


function AirportMarker( { airportData, zoomLevel, showAirportName, isWaypoint, onToggleWaypoint }: AirportMarkerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [airportInfo, setAirportInfo] = useState<Record<string, unknown> | null>(null)
  const [isLoadingAirportInfo, setIsLoadingAirportInfo] = useState(false)
  const [airportInfoError, setAirportInfoError] = useState<string | null>(null)
  const [metarText, setMetarText] = useState<string | null>(null)
  const [isLoadingMetar, setIsLoadingMetar] = useState(false)
  
  let color = "blue"
  if(airportData.private) {
    color = "red"
  }

  async function loadAirportInfo() {
    setIsLoadingAirportInfo(true)
    setAirportInfoError(null)

    try {
      const response = await fetch(`/api/airportInfo?icao_id=${airportData.id}`)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data: AirportInfoResponse = await response.json()
      setAirportInfo(data.airport || null)
    } catch (error) {
      setAirportInfoError(error instanceof Error ? error.message : 'Could not load airport info')
    } finally {
      setIsLoadingAirportInfo(false)
    }
  }

  async function loadAirportMetar() {
    setIsLoadingMetar(true)

    try {
      const response = await fetch(`/api/airportMetar?icao_id=${airportData.id}`)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data: MetarResponse = await response.json()
      setMetarText(data.metar)
    } catch (_) {
      setMetarText(null)
    } finally {
      setIsLoadingMetar(false)
    }
  }

  const airportName = typeof airportInfo?.name === 'string' ? airportInfo.name : airportData.name
  const airportAttributes = (airportInfo?.attributes || {}) as Record<string, unknown>

  const privateValue = normalizePrivateValue(airportInfo?.private ?? airportAttributes.PRIVATEUSE ?? airportData.private)
  const isPrivateAirport = privateValue === 1
  const airportIcao = formatValue(airportInfo?.icao_id ?? airportAttributes.ICAO_ID ?? airportData.id)

  const latValue = airportInfo?.latitude ?? airportAttributes.LATITUDE ?? airportData.lat
  const lonValue = airportInfo?.longitude ?? airportAttributes.LONGITUDE ?? airportData.lon

  const topLevelDetails = Object.entries(airportInfo || {})
    .filter(([key]) => (
      key !== 'name'
      && key !== 'attributes'
      && key !== 'private'
      && key !== 'icao_id'
      && key !== 'id'
      && key !== 'latitude'
      && key !== 'longitude'
      && !FILTERED_TOP_LEVEL_KEYS.has(key.toLowerCase())
    ))

  const attributeDetails = Object.entries(airportAttributes)
    .filter(([key]) => (
      key !== 'PRIVATEUSE'
      && key !== 'LATITUDE'
      && key !== 'LONGITUDE'
      && !FILTERED_ATTRIBUTE_KEYS.has(key)
    ))

  return (<>
      <Marker position={[airportData.lat, airportData.lon]} icon={AirportDetails(color, airportData, zoomLevel, showAirportName)} eventHandlers={{
          click: () => {
            setShowDetails(!showDetails)
            loadAirportInfo()
            loadAirportMetar()
          }
        }}>
        {showDetails && <DisplayAirspace airportData={airportData}/>}

        <Popup>
          <div className="airport-popup">
            <div className="airport-popup-header">
              <div className="airport-popup-title-block">
                <h3>{`${airportName} (${airportIcao})`}</h3>
                {isPrivateAirport && <div className="airport-private-label">Private</div>}
              </div>
              <button
                type="button"
                onClick={onToggleWaypoint}
                className="airport-waypoint-btn"
              >
                {isWaypoint ? 'Remove Waypoint' : 'Add Waypoint'}
              </button>
            </div>

            {isLoadingAirportInfo && <p>Loading airport info...</p>}
            {airportInfoError && <p>{airportInfoError}</p>}

            {!isLoadingAirportInfo && !airportInfoError && (
              <div className="airport-popup-details">
                <div className="airport-weather-section">
                  <span className="airport-weather-title">Weather</span>
                  <div className="airport-weather-value">
                    {isLoadingMetar ? 'Loading METAR...' : (metarText || 'No METAR Reported')}
                  </div>
                </div>

                <div className="airport-detail-row">
                  <span className="airport-detail-key">Lat/Lon</span>
                  <span className="airport-detail-value">{`${formatValue(latValue)} / ${formatValue(lonValue)}`}</span>
                </div>

                {topLevelDetails.map(([key, value]) => (
                  <div key={key} className="airport-detail-row">
                    <span className="airport-detail-key">{toDisplayLabel(key)}</span>
                    <span className="airport-detail-value">{formatValue(value)}</span>
                  </div>
                ))}

                {attributeDetails.map(([key, value]) => (
                  <div key={`attr-${key}`} className="airport-detail-row">
                    <span className="airport-detail-key">{toDisplayLabel(key)}</span>
                    <span className="airport-detail-value">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Popup>

      </Marker>
    </>
  );
}

export default AirportMarker;