from arcgis.features import FeatureLayer
from arcgis.geometry import Envelope
from arcgis.geometry.filters import intersects

from utils import longLatFlipper
import redis

redisClient = redis.Redis(host='localhost', port=6379, db=0)

airspace_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0"
airspace_client = FeatureLayer(airspace_layer_url)

airport_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/US_Airport/FeatureServer/0"
airport_client = FeatureLayer(airport_layer_url)

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
        airportIdent = airport.attributes["ICAO_ID"]
        if(airportIdent is None):
            airportIdent = airport.attributes["IDENT"]

        type_code = airport.attributes["TYPE_CODE"]

        if(airport.attributes["OPERSTATUS"] == "OPERATIONAL"):
            airports.append({
                "icao_id": airportIdent,
                "longitude": airport.geometry["x"],
                "latitude": airport.geometry["y"],
                "type": airport.attributes["TYPE_CODE"],
                "name": airport.attributes["NAME"],
                "private": airport.attributes["PRIVATEUSE"]
            })

    return airports
