from flask import Flask, request, jsonify
from urllib.error import URLError

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

    @app.route('/airportInfo', methods=['GET'])
    def get_airport_info():
        icao_id = request.args.get('icao_id')

        if icao_id is None:
            return jsonify({'error': 'icao_id is required'}), 400

        airport_info = faaArcGisClient.get_airport_info_from_redis(icao_id)
        if airport_info is None:
            return jsonify({'error': f'Airport {icao_id} not found'}), 404

        response = jsonify({'airport': airport_info})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

    @app.route('/airportMetar', methods=['GET'])
    def get_airport_metar():
        icao_id = request.args.get('icao_id')

        if icao_id is None:
            return jsonify({'error': 'icao_id is required'}), 400

        try:
            metar = faaArcGisClient.get_airport_metar(icao_id)
        except URLError:
            return jsonify({'metar': None})
        except Exception:
            return jsonify({'metar': None})

        return jsonify({'metar': metar})

    @app.route('/')
    def hello_world():
        return "add a route?"
