"""Split an image into tiles and compute each tile's corner coordinates."""
import math
from .mercator import lat_at


def tile_grid(width, height, max_px):
    nx, ny = math.ceil(width / max_px), math.ceil(height / max_px)
    for j in range(ny):
        for i in range(nx):
            yield j, i, (width * i // nx, width * (i + 1) // nx, height * j // ny, height * (j + 1) // ny)


def corners(box, size, bounds, mercator=True):
    """MapLibre image-source corners: top-left, top-right, bottom-right, bottom-left."""
    x0, x1, y0, y1 = box
    width, height = size
    west, south, east, north = bounds
    lon = lambda x: west + (east - west) * x / width
    lat = (lambda y: lat_at(y / height, north, south)) if mercator else (lambda y: north - (north - south) * y / height)
    return [[lon(x0), lat(y0)], [lon(x1), lat(y0)], [lon(x1), lat(y1)], [lon(x0), lat(y1)]]
