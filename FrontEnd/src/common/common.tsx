import { LatLng } from "leaflet";

export interface Position {
    latlng: LatLng;
    name?: string;
}