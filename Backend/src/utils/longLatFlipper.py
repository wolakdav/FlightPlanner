

def flipLatToLong(inputArray: [[tuple[float, float]]]):
    for singleRing in inputArray:
        for coords in singleRing:
            temp = coords[0]
            coords[0] = coords[1]
            coords[1] = temp
    return inputArray
