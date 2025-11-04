import multiprocessing
import subprocess
import sys
import glob
from osgeo import gdal

regionsToProcess = [ "Seattle", "KlamathFalls" ]

tif2tiles_path = r"C:\Users\micro\miniconda3\envs\gdal\Scripts\gdal2tiles.py"
translate_path = r"gdal_translate"

def convert_to_rgb(region):    
    vrtFile = region + ".vrt"
    croppedFile = region + "Cropped.tif"

    gdal.Translate(
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\vrtFiles\\{vrtFile}",
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\sectionals\\{region}\\{croppedFile}",
        format="VRT",
        rgbExpand ="rgba"
    )
    print("[SUCCESS] Converted to RGB VRT.")

def convert_tif_to_tiles( zoom='6-12'):

    allRegions = glob.glob("C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\vrtFiles\\*.vrt")
    gdal.BuildVRT(
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\vrtFiles\\allRegions.vrt",
        allRegions)

    cmd = [
        sys.executable,
        tif2tiles_path,
        "-z", zoom,
        "-r", "bilinear",
        "--xyz",
        "--processes", "32",
        "--tiledriver", "WEBP",
        "--webp-quality", "50",
        "--exclude",
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\vrtFiles\\allRegions.vrt",
        "C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\tiles"
    ]
    #print(f"[INFO] Running command: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    print(f"[SUCCESS] Tiles generated!")

def warp_tif(region):

    secFile = region + "SEC.tif"
    croppedFile = region + "Cropped.tif"
    shapefile = region + ".shp"

    gdal.Warp(
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\sectionals\\{region}\\{croppedFile}",
        f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\sectionals\\{region}\\{secFile}",
        dstSRS="EPSG:3857",
        format="GTiff",
        cutlineDSName= f"C:\\Users\\micro\\Documents\\Projects\\FlightPlanner\\Backend\\resources\\shapefiles\\{shapefile}",
        cropToCutline=True,
        dstAlpha=True,
        multithread=True,

    )

    print(f"[SUCCESS] Tiles warped for region: {region}")


if __name__ == "__main__":

    gdal.PushErrorHandler('CPLQuietErrorHandler')

    print("[INFO] Starting TIF to Tiles conversion process...")
    for region in regionsToProcess:
        print("--------------------------------")
        print(f"[INFO] Processing region: {region}")
        warp_tif(region)
        convert_to_rgb(region)
        print(f"[INFO] Finished processing region: {region}")
        print("--------------------------------")

    convert_tif_to_tiles()

    print("[INFO] All regions processed successfully.")
