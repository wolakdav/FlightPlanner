from pathlib import Path

from flask import Flask, send_from_directory
from endpoints import getAirportsInBox

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
TILES_DIR = BASE_DIR / "resources" / "tiles"


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response


@app.route('/resources/tiles/<path:tile_path>')
def serve_tiles(tile_path):
    return send_from_directory(TILES_DIR, tile_path)

# Register routes defined in folder_a/file_a.py
getAirportsInBox.register_routes(app)

if __name__ == "__main__":
    app.run(debug=True)