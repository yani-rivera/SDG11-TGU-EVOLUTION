"""Read a north-up GeoTIFF (EPSG:4326 or EPSG:3857) and write image tiles."""
import math
import numpy as np
import tifffile
from PIL import Image

R = 6378137.0


def _crs(tags):
    keys = tags["GeoKeyDirectoryTag"].value if "GeoKeyDirectoryTag" in tags else ()
    geo = dict(zip(keys[4::4], keys[7::4])) if keys else {}
    if geo.get(3072) in (3857, 900913):
        return "EPSG:3857"
    text = str(tags["GeoAsciiParamsTag"].value) if "GeoAsciiParamsTag" in tags else ""
    if "Pseudo-Mercator" in text or "Pseudo Mercator" in text:
        return "EPSG:3857"
    if geo.get(2048) == 4326 or geo.get(1024) == 2:
        return "EPSG:4326"
    raise ValueError("only EPSG:4326 or EPSG:3857 GeoTIFFs are supported; reproject in QGIS first")


def read_geotiff(path):
    """Return (rgb or rgba uint8 array, (west, south, east, north) in degrees, crs)."""
    page = tifffile.TiffFile(path).pages[0]
    tags = page.tags
    if "ModelPixelScaleTag" not in tags or "ModelTiepointTag" not in tags:
        raise ValueError(f"{path} has no GeoTIFF pixel scale / tiepoint tags")
    sx, sy = tags["ModelPixelScaleTag"].value[:2]
    tp = tags["ModelTiepointTag"].value
    data = page.asarray()
    if data.ndim != 3 or data.shape[2] < 3:
        raise ValueError(f"expected an RGB raster, got shape {data.shape}")
    data = data[..., :4]
    if np.issubdtype(data.dtype, np.floating) and np.nanmax(data[..., :3]) <= 1.0:
        data = data * 255.0          # reflectance-style 0–1 floats (e.g. Sentinel Hub exports)
    img = np.clip(np.nan_to_num(data), 0, 255).astype(np.uint8)
    h, w = img.shape[:2]
    x0, y0 = tp[3], tp[4]
    x1, y1 = x0 + w * sx, y0 - h * sy
    crs = _crs(tags)
    if crs == "EPSG:3857":
        lon = lambda x: math.degrees(x / R)
        lat = lambda y: math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)
        return img, (lon(x0), lat(y1), lon(x1), lat(y0)), crs
    return img, (x0, y1, x1, y0), crs


def write_tile(rgba, path, fmt="WEBP", quality=82):
    img = Image.fromarray(rgba, "RGBA")
    if fmt.upper() == "WEBP":
        img.save(path, "WEBP", quality=quality, method=6)
    else:
        img.save(path, "PNG", optimize=True)
