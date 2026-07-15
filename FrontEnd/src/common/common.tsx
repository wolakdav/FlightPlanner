import { LatLng } from "leaflet";

export interface Position {
    latlng: LatLng;
    name?: string;
}

export interface Airport {
    id: string;
    lat: number;
    lon: number;
    type: string;
    private: boolean;
    towered: boolean;
    longestRunwayFt: number | null;
    hasHardSurfaceRunway: boolean;
    longestHardSurfaceRunwayFt: number | null;
    name: string;
    airspaceDescription?: RingDescription[];
}

export interface RingDescription {
    point: LatLng[]
}