# sheet_to_globe

Prepares a georeferenced map sheet (an EPSG:4326 RGB GeoTIFF) as image tiles that a MapLibre globe can drape at the right coordinates. Used for the *Tegucigalpa, 1983* globe.

## Input
The input is one GeoTIFF. For the Tegucigalpa globe that file is a **mosaic of two sheets** (Tegucigalpa and Lepaterique) merged in QGIS. The `[source]` section of `config.toml` lists the original sheets, and it is copied into `sheet.json`, so the provenance names both sheets, not just the merged file. To add more sheets, merge them first (Raster → Miscellaneous → Merge) and add them to `sheets`.

## What it does
1. Reads the GeoTIFF (uint8, or float 0–255 as QGIS sometimes writes) and its corner coordinates.
2. Makes the paper collar and nodata border transparent (only white/black areas touching the edge).
3. Resamples rows from equal-degree to Web Mercator spacing, because MapLibre stretches images linearly in Mercator.
4. Splits the image into tiles of at most 4096 px (safe for phone GPUs) and writes WebP or PNG.
5. Writes `sheet.json`: each tile's four corners, the bounds, and provenance (script version, source SHA-256, config, UTC time).

## Configs (one per layer)
| Config | Layer | Source file in the repo's `data/` folder | Where to get it |
|---|---|---|---|
| `config.toml` | 1983 survey sheets | `alltgu_rendered.tiff` | Perry-Castañeda Library Map Collection (Tegucigalpa + Lepaterique sheets), merged and georeferenced in QGIS |
| `config_2026.toml` | 2026 map | `tgu2026.tiff` | OpenTopoMap layer in QGIS, exported as rendered image, 6000 columns, same extent |
| `config_s2.toml` | 2026 satellite | `s2_2026-02-09_true_color.tiff` | EO Browser, Sentinel-2 L2A true color, 9 Feb 2026, clipped to `tegucigalpa_extent` |

Each source file's SHA-256 is recorded in the output `.json`, so you can check you have the same file.

## Output
Configs write to `../layers/`, so running from `tools/` updates the repo's `layers/` folder directly; the page reads layers from `layers/` and the base map from `basemap/`.

## Run
```
pip install numpy scipy tifffile imagecodecs pillow
python -m sheet_to_globe config.toml
python -m sheet_to_globe config_2026.toml
python -m sheet_to_globe config_s2.toml
```
Python 3.11+ (uses `tomllib`). Paths in the configs are relative to the config file: sources are read from `../data/`, outputs written to `../layers/`.

## Export from QGIS
Right-click the layer → Export → Save As… → GeoTIFF, CRS EPSG:4326, Columns 6000. If the result shows as a grey block in QGIS, it is a float raster; the script reads it correctly anyway.

## Other files
- `make_land.js` builds the coastline, border and Honduras GeoJSON (place them in the repo's `basemap/` folder) from Natural Earth (`npm i world-atlas@2.0.2 topojson-client@3.1.0`, then `node make_land.js node_modules out_dir`).
- `globe_page_template.html` is the globe page. Replace `/*MAPLIBRE_CSS*/` with the contents of `maplibre-gl@5.6.0/dist/maplibre-gl.css`, and serve it next to the tiles, `sheet.json` and the GeoJSON files.

## Limits
- Assumes a north-up raster in EPSG:4326 (no rotation terms).
- Row resampling is nearest-neighbor; over a sheet this size (about 0.17° of latitude) the shift is under one pixel.
