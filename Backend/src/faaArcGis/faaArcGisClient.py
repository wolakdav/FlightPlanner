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

runway_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/Runways/FeatureServer/0"
runway_client = FeatureLayer(runway_layer_url)

DETAILED_AIRPORT_INFO_TTL_SECONDS = 15 * 60


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

def _detailed_airport_cache_key(icao_id):
    return f"airport:detailed:{icao_id}"


def _normalize_runway_feature(feature):
    attributes = feature.attributes

    return {
        "designator": attributes.get("DESIGNATOR"),
        "length": attributes.get("LENGTH"),
        "width": attributes.get("WIDTH"),
        "dimension_uom": attributes.get("DIM_UOM"),
        "surface": attributes.get("COMP_CODE"),
        "lighting_active": attributes.get("LIGHTACTV"),
        "lighting_intensity": attributes.get("LIGHTINTNS"),
        "outline": [],
    }


def _fetch_airspace_geometry(icao_id):
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
    return allAirspaces


def _fetch_runways(icao_id):
    airport_info = get_airport_info_from_redis(icao_id)
    if airport_info is None:
        return []

    global_id = (airport_info.get("attributes") or {}).get("GLOBAL_ID")
    if not global_id:
        return []

    result = runway_client.query(
        where=f"AIRPORT_ID = '{global_id}'",
        out_fields="*",
        out_sr=4326,
        return_geometry=True
    )

    runways = []
    for feature in result.features:
        runway = _normalize_runway_feature(feature)

        rings = feature.geometry.get('rings') if feature.geometry else None
        if rings:
            outline = [list(rings[0])]
            longLatFlipper.flipLatToLong(outline)
            runway["outline"] = outline[0]

        runways.append(runway)

    return runways


def get_detailed_airport_info(icao_id):

    print("Querying for ICAO ID Airspaces: ", icao_id)

    cache_key = _detailed_airport_cache_key(icao_id)
    cached_raw = redisClient.get(cache_key)

    detailed_info = {}
    if cached_raw:
        print("Found something in cache for ", icao_id)
        if isinstance(cached_raw, bytes):
            cached_raw = cached_raw.decode("utf-8")
        detailed_info = json.loads(cached_raw)
    else:
        print("Did not find anything in cache for ", icao_id)

    needs_cache_refresh = False

    if "geometry" not in detailed_info:
        print("Airspace geometry missing from cache for ", icao_id)
        detailed_info["geometry"] = _fetch_airspace_geometry(icao_id)
        needs_cache_refresh = True

    if "runways" not in detailed_info:
        print("Runway info missing from cache for ", icao_id)
        detailed_info["runways"] = _fetch_runways(icao_id)
        needs_cache_refresh = True

    if needs_cache_refresh:
        redisClient.set(
            cache_key,
            json.dumps(detailed_info),
            ex=DETAILED_AIRPORT_INFO_TTL_SECONDS
        )

    return detailed_info


TOWERED_AIRSPACE_CLASSES = ("B", "C", "D")


def _get_towered_icao_ids_in_box(bounded_box):
    class_filter = " OR ".join(f"CLASS = '{cls}'" for cls in TOWERED_AIRSPACE_CLASSES)

    result = airspace_client.query(
        where=f"({class_filter})",
        out_fields="ICAO_ID",
        geometry_filter=intersects(bounded_box),
        return_geometry=False
    )

    return {
        feature.attributes.get("ICAO_ID")
        for feature in result.features
        if feature.attributes.get("ICAO_ID")
    }


HARD_SURFACE_KEYWORDS = ("ASPH", "CONC", "PFC", "AFSC", "BRICK")


def _is_hard_surface(comp_code):
    if not comp_code:
        return False

    comp_code_upper = comp_code.upper()
    return any(keyword in comp_code_upper for keyword in HARD_SURFACE_KEYWORDS)


def _get_runway_summary_by_airport_in_box(bounded_box):
    result = runway_client.query(
        where="1=1",
        out_fields="AIRPORT_ID,LENGTH,COMP_CODE",
        geometry_filter=intersects(bounded_box),
        return_geometry=False
    )

    summary = {}
    for feature in result.features:
        global_id = feature.attributes.get("AIRPORT_ID")
        length = feature.attributes.get("LENGTH")
        comp_code = feature.attributes.get("COMP_CODE")
        if not global_id or length is None:
            continue

        entry = summary.setdefault(global_id, {
            "longest_runway_ft": None,
            "has_hard_surface": False,
            "longest_hard_surface_runway_ft": None,
        })

        if entry["longest_runway_ft"] is None or length > entry["longest_runway_ft"]:
            entry["longest_runway_ft"] = length

        if _is_hard_surface(comp_code):
            entry["has_hard_surface"] = True
            if entry["longest_hard_surface_runway_ft"] is None or length > entry["longest_hard_surface_runway_ft"]:
                entry["longest_hard_surface_runway_ft"] = length

    return summary


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

    towered_icao_ids = _get_towered_icao_ids_in_box(boundedBox)
    runway_summary_by_global_id = _get_runway_summary_by_airport_in_box(boundedBox)

    airports = []
    for airport in result:
        if(airport.attributes["OPERSTATUS"] == "OPERATIONAL"):
            normalized_airport = _normalize_airport_feature(airport)
            _cache_airport_info(normalized_airport)

            global_id = (normalized_airport.get("attributes") or {}).get("GLOBAL_ID")
            runway_summary = runway_summary_by_global_id.get(global_id, {})

            airports.append({
                "icao_id": normalized_airport["icao_id"],
                "longitude": normalized_airport["longitude"],
                "latitude": normalized_airport["latitude"],
                "type": normalized_airport["type"],
                "name": normalized_airport["name"],
                "private": normalized_airport["private"],
                "towered": normalized_airport["icao_id"] in towered_icao_ids,
                "longest_runway_ft": runway_summary.get("longest_runway_ft"),
                "has_hard_surface_runway": runway_summary.get("has_hard_surface", False),
                "longest_hard_surface_runway_ft": runway_summary.get("longest_hard_surface_runway_ft")
            })

    return airports
