# Flight Planner

A Python project for planning flights.

## Project Structure

```
FlightPlanner/
│
├── src/           # Source code
├── tests/         # Test files
├── docs/          # Documentation
└── requirements.txt
```

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

2. Activate the virtual environment:
   - Windows:
     ```bash
     .venv\Scripts\activate
     ```
   - Unix/MacOS:
     ```bash
     source .venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Currently just runs a script to process the .tif files into tiles for leaflet in the front end package. Below is a list of useful links

https://www.ephemeral.cx/2023/03/generating-map-tiles-for-faa-sectional-charts-with-gdal/ - How to make sectionals into tiles and how to do so nicely for multiple sectionals