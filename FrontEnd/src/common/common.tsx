import { LatLng } from "leaflet";

export interface Position {
    latlng: LatLng;
    name?: string;
}

export interface Airport {
    id: string;
    lat: number;
    lon: number;
    airspaceDescription?: LatLng[];
}