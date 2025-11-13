from flask import Flask, request, jsonify
from arcgis.features import FeatureLayer
from arcgis.geometry import Envelope
from arcgis.geometry.filters import intersects

import json
import redis
import requests

import longLatFlipper

app = Flask(__name__)

redis = redis.from_url("redis://localhost")
## This middle thing is prb a key. Gotta figure out later.
airspace_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0"
airport_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/US_Airport/FeatureServer/0"

airspace_client = FeatureLayer(airspace_layer_url)
airport_client = FeatureLayer(airport_layer_url)

@app.route('/detailedAirportInfo', methods=['GET'])
def detailed_airport_info():
    icao_id = request.args.get('icao_id')

    if icao_id == None:
        return jsonify()

    print("Querying for ICAO ID: ", icao_id)
    airSpaceGeometry = redis.get(icao_id)

    if(airSpaceGeometry is None):
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
        
        redis.set(icao_id, json.dumps(airSpaceGeometry))
    else:
        airSpaceGeometry = json.loads(airSpaceGeometry)


    response = jsonify(airSpaceGeometry)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/airportsInBox', methods=['GET'])
def get_airports_in_box():

    xmin = float(request.args.get('xmin'))
    ymin = float(request.args.get('ymin'))
    xmax = float(request.args.get('xmax'))
    ymax = float(request.args.get('ymax'))

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
        geometry_filter=intersects(boundedBox)
    )    

    ##print(result)
    print("---")
    airports = []
    for airport in result:
        airportIdent = airport.attributes["ICAO_ID"]
        if(airportIdent is None):
            airportIdent = airport.attributes["IDENT"]

        type_code = airport.attributes["TYPE_CODE"]

        if(airport.attributes["OPERSTATUS"] == "OPERATIONAL" and type_code != "HP" ):
            airports.append({
                "icao_id": airportIdent,
                "longitude": airport.geometry["x"],
                "latitude": airport.geometry["y"],
                "type": airport.attributes["TYPE_CODE"],
                "name": airport.attributes["NAME"],
                "private": airport.attributes["PRIVATEUSE"]
            })


    response = jsonify({'airports': airports})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/')
def hello_world():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)