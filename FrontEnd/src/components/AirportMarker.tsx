import React, { useEffect, useState } from 'react'
import L from 'leaflet'
import { Marker, Polygon, Polyline, Popup } from 'react-leaflet'
import { Airport } from '../common/common'

interface AirportMarkerProps {
  airportData : Airport;
  zoomLevel: number;
  showAirportName: boolean;
  showRunwayDetail: boolean;
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

interface Runway {
  designator: string | null;
  length: number | null;
  width: number | null;
  dimension_uom: string | null;
  surface: string | null;
  lighting_active: number | null;
  lighting_intensity: string | null;
  outline: [number, number][];
}

interface DetailedAirportInfoResponse {
  geometry: [number, number][][];
  runways: Runway[];
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


async function getDetailedAirportInfo(icao_id: string): Promise<DetailedAirportInfoResponse> {
  return await fetch(`/api/detailedAirportInfo?icao_id=${icao_id}`)
  .then(response => response.json())
  .then(data => ({
    geometry: Array.isArray(data?.geometry) ? data.geometry : [],
    runways: Array.isArray(data?.runways) ? data.runways : [],
  }));
}

function formatRunway(runway: Runway): string {
  const parts: string[] = []
  const uom = runway.dimension_uom ? ` ${runway.dimension_uom}` : ''

  if (runway.length && runway.width) {
    parts.push(`${runway.length}${uom} x ${runway.width}${uom}`)
  }

  if (runway.surface) {
    parts.push(runway.surface)
  }

  if (runway.lighting_active) {
    parts.push(runway.lighting_intensity ? `Lighted (${runway.lighting_intensity})` : 'Lighted')
  }

  return parts.length > 0 ? parts.join(' \u00b7 ') : 'No details available'
}

function formatCoordinate(value: unknown): string {
  const numericValue = typeof value === 'string' ? Number(value) : value

  if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
    return numericValue.toFixed(4)
  }

  return formatValue(value)
}

function markerSizeForZoom(zoomLevel: number) {
  const clampedZoom = Math.max(6, Math.min(14, zoomLevel));
  return 12 + ((clampedZoom - 6) / 8) * 18;
}

function AirportDetails(color: string, airportData: Airport, zoomLevel: number, showAirportName: boolean, showRunwayDetail: boolean) {
  if (showRunwayDetail) {
    return L.divIcon({
      html: `
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
          border: 1px solid white;
        "></div>
      `,
      className: '',
      iconSize: [8, 8],
      iconAnchor: [4, 4],
    })
  }

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

function DisplayAirspace({ rings }: { rings: [number, number][][] }) {
  if (!rings || rings.length === 0) {
    return <> </>
  }

  return <Polyline positions={rings}/>;
}

const METERS_PER_DEGREE_LAT = 111320
const RUNWAY_WIDTH_EXAGGERATION_FACTOR = 2.5
const RUNWAY_MIN_VISUAL_WIDTH_METERS = 12

function toLocalMeters(point: [number, number], refLat: number): [number, number] {
  const [lat, lon] = point
  const x = lon * METERS_PER_DEGREE_LAT * Math.cos(refLat * Math.PI / 180)
  const y = lat * METERS_PER_DEGREE_LAT
  return [x, y]
}

function toLatLon(point: [number, number], refLat: number): [number, number] {
  const [x, y] = point
  const lon = x / (METERS_PER_DEGREE_LAT * Math.cos(refLat * Math.PI / 180))
  const lat = y / METERS_PER_DEGREE_LAT
  return [lat, lon]
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function midpointMeters(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

interface RunwayLayout {
  outline: [number, number][];
  endA: [number, number];
  endB: [number, number];
  bearingAtoB: number;
}

// Rebuilds the runway rectangle so its length matches the real-world footprint
// exactly, while widening it (up to a visible minimum) purely for legibility on the map.
function computeRunwayLayout(outline: [number, number][], refLat: number): RunwayLayout | null {
  if (!outline || outline.length < 4) {
    return null
  }

  const corners = outline.slice(0, 4).map((point) => toLocalMeters(point, refLat))
  const edgeLengths = corners.map((corner, i) => distanceMeters(corner, corners[(i + 1) % 4]))

  const edge0IsWidth = edgeLengths[0] <= edgeLengths[1]
  const [wIdxA1, wIdxA2, wIdxB1, wIdxB2] = edge0IsWidth ? [0, 1, 2, 3] : [1, 2, 3, 0]

  const endA = midpointMeters(corners[wIdxA1], corners[wIdxA2])
  const endB = midpointMeters(corners[wIdxB1], corners[wIdxB2])

  const actualWidth = edge0IsWidth
    ? (edgeLengths[0] + edgeLengths[2]) / 2
    : (edgeLengths[1] + edgeLengths[3]) / 2

  const lengthVectorX = endB[0] - endA[0]
  const lengthVectorY = endB[1] - endA[1]
  const centerlineLength = Math.hypot(lengthVectorX, lengthVectorY)

  if (centerlineLength === 0) {
    return null
  }

  const unitX = lengthVectorX / centerlineLength
  const unitY = lengthVectorY / centerlineLength
  const perpX = -unitY
  const perpY = unitX

  const visualWidth = Math.max(actualWidth * RUNWAY_WIDTH_EXAGGERATION_FACTOR, RUNWAY_MIN_VISUAL_WIDTH_METERS)
  const halfWidth = visualWidth / 2

  const widenedCorners: [number, number][] = [
    [endA[0] + perpX * halfWidth, endA[1] + perpY * halfWidth],
    [endB[0] + perpX * halfWidth, endB[1] + perpY * halfWidth],
    [endB[0] - perpX * halfWidth, endB[1] - perpY * halfWidth],
    [endA[0] - perpX * halfWidth, endA[1] - perpY * halfWidth],
  ]

  // Compass bearing (clockwise from north) of the centerline, from endA to endB.
  const bearingAtoB = (Math.atan2(unitX, unitY) * (180 / Math.PI) + 360) % 360

  return {
    outline: widenedCorners.map((corner) => toLatLon(corner, refLat)),
    endA: toLatLon(endA, refLat),
    endB: toLatLon(endB, refLat),
    bearingAtoB,
  }
}

function headingFromDesignatorPart(part: string): number | null {
  const match = part.match(/^(\d{1,2})/)
  if (!match) {
    return null
  }

  return (parseInt(match[1], 10) * 10) % 360
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// Matches each designator half (e.g. "16C"/"34C") to the physical end it belongs to,
// using the centerline bearing so the label sits at the correct threshold.
function getRunwayEndLabels(designator: string | null, bearingAtoB: number): { endALabel: string; endBLabel: string } | null {
  if (!designator) {
    return null
  }

  const parts = designator.split('/').map((part) => part.trim()).filter(Boolean)
  if (parts.length !== 2) {
    return null
  }

  const heading1 = headingFromDesignatorPart(parts[0])
  const heading2 = headingFromDesignatorPart(parts[1])

  if (heading1 === null || heading2 === null) {
    return { endALabel: parts[1], endBLabel: parts[0] }
  }

  const distTo1 = angularDifference(bearingAtoB, heading1)
  const distTo2 = angularDifference(bearingAtoB, heading2)

  return distTo1 <= distTo2
    ? { endALabel: parts[1], endBLabel: parts[0] }
    : { endALabel: parts[0], endBLabel: parts[1] }
}

function RunwayEndLabel({ position, label }: { position: [number, number]; label: string }) {
  const icon = L.divIcon({
    html: `<div style="
      color: #f8fafc;
      font-size: 11px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
      white-space: nowrap;
      transform: translate(-50%, -50%);
    ">${label}</div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })

  return <Marker position={position} icon={icon} interactive={false} />
}

function RunwayShapes({ runways, refLat }: { runways: Runway[]; refLat: number }) {
  if (!runways || runways.length === 0) {
    return <> </>
  }

  return (
    <>
      {runways.map((runway, index) => {
        const layout = computeRunwayLayout(runway.outline, refLat)
        if (!layout) {
          return null
        }

        const endLabels = getRunwayEndLabels(runway.designator, layout.bearingAtoB)

        return (
          <React.Fragment key={`${runway.designator ?? 'runway'}-${index}`}>
            <Polygon
              positions={layout.outline}
              pathOptions={{ color: '#e5e7eb', weight: 1, fillColor: '#374151', fillOpacity: 0.95 }}
            />
            {endLabels && (
              <>
                <RunwayEndLabel position={layout.endA} label={endLabels.endALabel} />
                <RunwayEndLabel position={layout.endB} label={endLabels.endBLabel} />
              </>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}


function AirportMarker( { airportData, zoomLevel, showAirportName, showRunwayDetail, isWaypoint, onToggleWaypoint }: AirportMarkerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [airportInfo, setAirportInfo] = useState<Record<string, unknown> | null>(null)
  const [isLoadingAirportInfo, setIsLoadingAirportInfo] = useState(false)
  const [airportInfoError, setAirportInfoError] = useState<string | null>(null)
  const [metarText, setMetarText] = useState<string | null>(null)
  const [isLoadingMetar, setIsLoadingMetar] = useState(false)
  const [runways, setRunways] = useState<Runway[]>([])
  const [airspaceRings, setAirspaceRings] = useState<[number, number][][]>([])
  const [isLoadingRunways, setIsLoadingRunways] = useState(false)
  
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

  async function loadDetailedAirportInfo() {
    setIsLoadingRunways(true)

    try {
      const data = await getDetailedAirportInfo(airportData.id)
      setAirspaceRings(data.geometry)
      setRunways(data.runways)
    } catch (_) {
      setAirspaceRings([])
      setRunways([])
    } finally {
      setIsLoadingRunways(false)
    }
  }

  useEffect(() => {
    if (showRunwayDetail && runways.length === 0 && !isLoadingRunways) {
      loadDetailedAirportInfo()
    }
  }, [showRunwayDetail])

  const airportName = typeof airportInfo?.name === 'string' ? airportInfo.name : airportData.name
  const airportAttributes = (airportInfo?.attributes || {}) as Record<string, unknown>

  const privateValue = normalizePrivateValue(airportInfo?.private ?? airportAttributes.PRIVATEUSE ?? airportData.private)
  const isPrivateAirport = privateValue === 1
  const airportIcao = formatValue(airportInfo?.icao_id ?? airportAttributes.ICAO_ID ?? airportData.id)

  const latValue = formatCoordinate(airportInfo?.latitude ?? airportAttributes.LATITUDE ?? airportData.lat)
  const lonValue = formatCoordinate(airportInfo?.longitude ?? airportAttributes.LONGITUDE ?? airportData.lon)

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
      <Marker position={[airportData.lat, airportData.lon]} icon={AirportDetails(color, airportData, zoomLevel, showAirportName, showRunwayDetail)} eventHandlers={{
          click: () => {
            setShowDetails(!showDetails)
            loadAirportInfo()
            loadAirportMetar()
            loadDetailedAirportInfo()
          }
        }}>
        {showDetails && <DisplayAirspace rings={airspaceRings}/>}
        {showRunwayDetail && <RunwayShapes runways={runways} refLat={airportData.lat}/>}

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

                <div className="airport-runways-section">
                  <span className="airport-runways-title">Runways</span>
                  {isLoadingRunways && <div className="airport-runways-value">Loading runways...</div>}
                  {!isLoadingRunways && runways.length === 0 && (
                    <div className="airport-runways-value">No runway data available</div>
                  )}
                  {!isLoadingRunways && runways.map((runway, index) => (
                    <div key={`${runway.designator ?? 'runway'}-${index}`} className="airport-detail-row">
                      <span className="airport-detail-key">{runway.designator || 'Runway'}</span>
                      <span className="airport-detail-value">{formatRunway(runway)}</span>
                    </div>
                  ))}
                </div>

                <div className="airport-detail-row">
                  <span className="airport-detail-key">Lat/Lon</span>
                  <span className="airport-detail-value">{`${latValue} / ${lonValue}`}</span>
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