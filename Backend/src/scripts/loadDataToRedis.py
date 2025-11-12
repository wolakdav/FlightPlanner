import requests
import redis
import csv

##resources\databaseData\airports.csv
def loadDataFromLocalFile(redisClient, filePath):

    with open(filePath, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            try:
                lat = float(row['latitude_deg'])
                lon = float(row['longitude_deg'])
                icao = row.get('icao_code') or row.get('ident') or row.get('local_code') or ''
                if icao and icao.startswith('K'):  # only include valid entries
                    coords = (lon, lat, icao)
                    ##print("Adding airport to Redis: ", coords)
                    redisClient.geoadd("airports", coords)
            except (ValueError, KeyError):
                continue  # skip malformed lines

def loadDataFromAirportGap(redisClient):
    requestUrl = "https://airportgap.com/api/airports?page=88"

    initalLoad = requests.get(requestUrl).json()
    while initalLoad["links"]["next"] is not None:
        ##print(initalLoad["data"])
        for airport in initalLoad["data"]:
            if airport["attributes"]["country"] == "United States":
                icea = airport["attributes"]["icao"]
                lat = airport["attributes"]["latitude"]
                long = airport["attributes"]["longitude"]
                coords = (long, lat, icea)
                print("Adding airport to Redis: ", coords)
                redisClient.geoadd("airports", coords)
            
            
        nextUrl = initalLoad["links"]["next"]
        initalLoad = requests.get(nextUrl).json()



def createRedisConnection():
    client = redis.from_url("redis://localhost")
    return client

def testQuery(redisClient):
    results = redisClient.georadius("airports", -122.942, 45.428, 5, unit="mi", withdist=True, withcoord=True)
    print("Query Results: ", results)

if __name__ == "__main__":
    print("Starting data load to Redis...")
    redisClient = createRedisConnection()

    ##print("Loading airport data from AirportGap API...")
    ##loadDataFromAirportGap(redisClient)

    print("Loading airport data from local CSV file...")
    loadDataFromLocalFile(redisClient, "resources/databaseData/airports.csv")

    print("Testing query...")
    testQuery(redisClient)


