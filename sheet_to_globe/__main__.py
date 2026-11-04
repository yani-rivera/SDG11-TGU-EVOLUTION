"""Usage: python -m sheet_to_globe config.toml"""
import json
import sys
import tomllib
from pathlib import Path

import numpy as np

from .io import read_geotiff, write_tile
from .collar import collar_alpha
from .mercator import to_mercator_rows
from .tiles import tile_grid, corners
from .provenance import record


def run(config_path):
    cfg = tomllib.loads(Path(config_path).read_text())
    base = Path(config_path).parent
    src = base / cfg["input"]["geotiff"]
    out = base / cfg["output"]["dir"]
    out.mkdir(parents=True, exist_ok=True)

    img, bounds, crs = read_geotiff(src)
    rgb = img[..., :3]
    west, south, east, north = bounds
    alpha = collar_alpha(rgb, cfg["collar"]["white_threshold"], cfg["collar"]["black_threshold"])
    if img.shape[2] == 4:
        alpha = np.minimum(alpha, img[..., 3])
    rgba = np.dstack([rgb, alpha])
    mercator = cfg["projection"]["resample_rows_to_web_mercator"] or crs == "EPSG:3857"
    if mercator and crs == "EPSG:4326":
        rgba = to_mercator_rows(rgba, north, south)

    height, width = rgba.shape[:2]
    fmt = cfg["output"]["format"].upper()
    ext = "webp" if fmt == "WEBP" else "png"
    prefix = cfg["output"].get("prefix", "sheet")
    tiles = []
    for j, i, box in tile_grid(width, height, cfg["output"]["max_tile_px"]):
        x0, x1, y0, y1 = box
        name = f"{prefix}_{j}_{i}.{ext}"
        write_tile(rgba[y0:y1, x0:x1], out / name, fmt, cfg["output"].get("quality", 82))
        tiles.append({"file": name, "coordinates": corners(box, (width, height), bounds, mercator)})

    meta = {"bounds": [west, south, east, north], "tiles": tiles,
            "source_crs": crs,
            "provenance": record(src, (rgb.shape[1], rgb.shape[0]), cfg)}
    (out / f"{prefix}.json").write_text(json.dumps(meta, indent=1))
    print(f"{len(tiles)} tiles + {prefix}.json written to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    run(sys.argv[1])
