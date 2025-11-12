from flask import Flask, request, jsonify
from arcgis.gis import GIS
from arcgis.features import FeatureLayer
import redis
import requests

import longLatFlipper

app = Flask(__name__)

redis = redis.from_url("redis://localhost")
## This middle thing is prb a key. Gotta figure out later.
airspace_layer_url = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0"
airspace_client = FeatureLayer(airspace_layer_url)

@app.route('/detailedAirportInfo', methods=['GET'])
def detailed_airport_info():
    icao_id = request.args.get('icao_id')

    if icao_id == None:
        return jsonify()

    print("Querying for ICAO ID: ", icao_id)
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

    responseBody = {'geometry': allAirspaces}
    response = jsonify(responseBody)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response


@app.route('/airportsInBox', methods=['GET'])
def get_airports_in_box():
    long = float(request.args.get('long'))
    lat = float(request.args.get('lat'))
    width = float(request.args.get('width'))
    height = float(request.args.get('height'))
    results = redis.geosearch("airports",
                              unit="km",
                              longitude=long,
                              latitude=lat,
                              width=width,
                                height=height,  
                                withcoord=True
    )
    
    airports = []
    for airport in results:
        print(airport)
        airports.append({
            "id": airport[0].decode('utf-8'),
            "longitude": airport[1][0],
            "latitude": airport[1][1]
        })

    response = jsonify({'airports': airports})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/')
def hello_world():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)