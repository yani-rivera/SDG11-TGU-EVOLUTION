"""Row resampling from equirectangular (EPSG:4326) to Web Mercator spacing."""
import math
import numpy as np


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def lat_at(fraction, north, south):
    """Latitude at a fraction (0 = top, 1 = bottom) of the Mercator-spaced image height."""
    yn, ys = merc_y(north), merc_y(south)
    return math.degrees(2 * math.atan(math.exp(yn + (ys - yn) * fraction)) - math.pi / 2)


def to_mercator_rows(img, north, south):
    """Nearest-row resampling so equal pixel rows span equal Mercator distances."""
    h = img.shape[0]
    src = [round((north - lat_at((i + .5) / h, north, south)) / (north - south) * h - .5) for i in range(h)]
    return img[np.clip(src, 0, h - 1)]
