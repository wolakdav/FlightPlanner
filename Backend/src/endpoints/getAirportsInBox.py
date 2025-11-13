from flask import Flask, request, jsonify

from faaArcGis import faaArcGisClient

app = Flask(__name__)

def register_routes(app):
    
    @app.route('/detailedAirportInfo', methods=['GET'])
    def detailed_airport_info():
        icao_id = request.args.get('icao_id')

        if icao_id == None:
            return jsonify()

        print("Querying for ICAO ID: ", icao_id)
        airSpaceGeometry = faaArcGisClient.get_detailed_airport_info(icao_id)

        response = jsonify(airSpaceGeometry)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response


    @app.route('/airportsInBox', methods=['GET'])
    def get_airports_in_box():

        xmin = float(request.args.get('xmin'))
        ymin = float(request.args.get('ymin'))
        xmax = float(request.args.get('xmax'))
        ymax = float(request.args.get('ymax'))

        airports = faaArcGisClient.get_all_airports_in_box(xmin, ymin, xmax, ymax)
        response = jsonify({'airports': airports})  
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

    @app.route('/')
    def hello_world():
        return "add a route?"
