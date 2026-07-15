from arcgis.features import FeatureLayer
from arcgis.geometry import Envelope
from arcgis.geometry.filters import intersects

from utils import longLatFlipper
import json
import redis
from urllib import parse, request

redisClient = redis.Redis(host='localhost', port=6379, db=0)

airspace_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0"
airspace_client = FeatureLayer(airspace_layer_url)

airport_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/US_Airport/FeatureServer/0"
airport_client = FeatureLayer(airport_layer_url)


def get_airport_metar(icao_id):
    query_params = parse.urlencode({
        "ids": icao_id,
        "format": "json",
    })
    metar_url = f"https://aviationweather.gov/api/data/metar?{query_params}"

    with request.urlopen(metar_url, timeout=10) as response:
        payload = response.read().decode("utf-8")

    metar_data = json.loads(payload)
    if not isinstance(metar_data, list) or len(metar_data) == 0:
        return None

    first_report = metar_data[0]
    if isinstance(first_report, dict):
        return first_report.get("rawOb")

    return None


def _airport_cache_key(icao_id):
    return f"airport:info:{icao_id}"


def _cache_airport_info(airport_info):
    icao_id = airport_info.get("icao_id")
    if not icao_id:
        return

    redisClient.set(_airport_cache_key(icao_id), json.dumps(airport_info))


def _normalize_airport_feature(feature):
    attributes = feature.attributes
    airport_ident = attributes.get("ICAO_ID") or attributes.get("IDENT")

    return {
        "icao_id": airport_ident,
        "longitude": feature.geometry.get("x"),
        "latitude": feature.geometry.get("y"),
        "type": attributes.get("TYPE_CODE"),
        "name": attributes.get("NAME"),
        "private": attributes.get("PRIVATEUSE"),
        "attributes": attributes,
    }


def get_airport_info_from_redis(icao_id):
    cached_airport_info = redisClient.get(_airport_cache_key(icao_id))

    if cached_airport_info:
        if isinstance(cached_airport_info, bytes):
            cached_airport_info = cached_airport_info.decode("utf-8")
        return json.loads(cached_airport_info)

    result = airport_client.query(
        where=f"ICAO_ID = '{icao_id}' OR IDENT = '{icao_id}'",
        out_fields="*",
        out_sr={'wkid': 4326, 'latestWkid': 4326},
        return_geometry=True
    )

    if len(result.features) == 0:
        return None

    airport_info = _normalize_airport_feature(result.features[0])
    _cache_airport_info(airport_info)
    return airport_info

def get_detailed_airport_info(icao_id):
    
    print("Querying for ICAO ID Airspaces: ", icao_id)

    airSpaceGeometry = redisClient.get(icao_id)

    if(airSpaceGeometry is None):
        print("Did not find anything in cache for ", icao_id)
        result = airspace_client.query(
            where=f"ICAO_ID = '{icao_id}'",
            out_fields="",
            out_sr=4326,
            return_geometry=True
        )

        allAirspaces = []
        for feature in result.features:
            allAirspaces.append(feature.geometry['rings'][0])

        longLatFlipper.flipLatToLong(allAirspaces)

        airSpaceGeometry = {'geometry': allAirspaces}
    else:
        print("Found something in cache for ", icao_id)
    
    return airSpaceGeometry


def get_all_airports_in_box(xmin, ymin, xmax, ymax):
    boundedBox = Envelope({
        "xmin": xmin,
        "ymin": ymin,
        "xmax": xmax,
        "ymax": ymax,
        "spatialReference": {"wkid": 4326}
    })

    result = airport_client.query(
        where="1=1",
        out_fields="*",
        out_sr={'wkid': 4326, 'latestWkid': 4326},
        geometry_filter=intersects(boundedBox)
    )    

    airports = []
    for airport in result:
        if(airport.attributes["OPERSTATUS"] == "OPERATIONAL"):
            normalized_airport = _normalize_airport_feature(airport)
            _cache_airport_info(normalized_airport)

            airports.append({
                "icao_id": normalized_airport["icao_id"],
                "longitude": normalized_airport["longitude"],
                "latitude": normalized_airport["latitude"],
                "type": normalized_airport["type"],
                "name": normalized_airport["name"],
                "private": normalized_airport["private"]
            })

    return airports
