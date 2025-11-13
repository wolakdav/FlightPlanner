from flask import Flask
from endpoints import getAirportsInBox

app = Flask(__name__)

# Register routes defined in folder_a/file_a.py
getAirportsInBox.register_routes(app)

if __name__ == "__main__":
    app.run(debug=True)