# SDG11-TGU-EVOLUTION

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23957998.svg)](https://doi.org/10.5281/zenodo.23957998)

Tegucigalpa, Honduras, across 43 years on an interactive globe: the **1983 topographic survey**, the **2026 OpenStreetMap map** and a **2026 Sentinel-2 satellite image**, aligned on one slider as dated baselines for SDG 11 urban research.

Made for the **#30DayMapChallenge 2026**.

**Live globe:** https://yani-rivera.github.io/SDG11-TGU-EVOLUTION/

## The baselines

| Stop | Source | Date | License / credit |
|---|---|---|---|
| 1983 survey | Tegucigalpa and Lepaterique sheets, 1:50,000 topographic series. Perry-Castañeda Library Map Collection, courtesy of the University of Texas Libraries, The University of Texas at Austin. Mosaic and georeferencing: Yanira A. Rivera | 1983 | Public domain (PCL) |
| 2026 map | Map data © OpenStreetMap contributors, SRTM; map style © OpenTopoMap | captured 4 Nov 2026 | ODbL data, CC-BY-SA style |
| 2026 satellite | Sentinel-2 L2A true color. Contains modified Copernicus Sentinel data 2026 | acquired 9 Feb 2026 | Copernicus free and open data |
| Base map | Natural Earth coastlines and borders | | Public domain |

Each layer's `.json` file in `data/tegucigalpa/` (`sheet.json`, `osm2026.json`, `s2_2026.json`) records its corner coordinates and provenance: script version, source file SHA-256, settings and creation time.

## Repository layout

```
index.html          the globe page (MapLibre GL JS 5.6.0)
globe.js            the page logic: reads the settings, loads layers on demand
globe.config.json   shared settings: which city opens by default, loading limits
data/
  basemap/          Natural Earth coastlines and borders (.geojson)
  tegucigalpa/      city.json + one manifest .json and its .webp tiles per baseline
tools/              sheet_to_globe: the toolkit that rebuilds every layer
```

## Page settings

The page is built entirely from settings files, so `index.html` and `globe.js` don't change when a baseline or a city is added. The year slider, the Map / Satellite switch, the credits and the title's year range all come from them.

**`globe.config.json`** holds what is shared: `city` (the folder in `data/` that opens by default), `load_from_zoom`, `max_loaded` and the base-map credit. A link ending in `?city=<folder>` opens another city, so several can be live from the same page.

**`data/<city>/city.json`** holds what belongs to one city: `title`, `kicker`, `intro`, `focus`, `start` and `layers`. Manifest paths are relative to the city's folder.

**Adding a baseline.** Build it with `sheet_to_globe` (see below; set `output.dir` to the city's folder), then add one entry to that city's `layers`:

```json
{ "id": "osm2027", "year": 2027, "view": "map", "label": "2027 map",
  "manifest": "osm2027.json", "credit": "2027 map: map data © OpenStreetMap contributors…" }
```

`view` is `map` or `satellite`. A year without a satellite image shows its map, with a note. `"show": false` keeps a baseline in the list but off the page.

**Adding a city.** Make a folder in `data/` (lowercase, e.g. `data/sanpedro/`), build its baselines into it, and write its `city.json`. It opens at `…/?city=sanpedro`, or by default if `city` in `globe.config.json` names it.

**Focus area.** `focus` sets where the pin sits and where "Fly to" goes, either as `center` + `zoom` or as `bounds` `[west, south, east, north]`, plus a `name` for the pin and button. `"start": "focus"` opens the page already zoomed there; `"start": "globe"` opens on the spinning globe.

**Loading.** Baselines download only when the view is zoomed in past `load_from_zoom` (default 8), and only the years in use: the two the slider sits between, in the chosen view, plus the next year ahead. At most `max_loaded` baselines (default 4) stay in memory; the least recently used are dropped first.

## Rebuilding the layers

See [`tools/README.md`](tools/README.md). In short:

```
pip install numpy scipy tifffile imagecodecs pillow
cd tools
python -m sheet_to_globe config.toml        # 1983 survey
python -m sheet_to_globe config_2026.toml   # 2026 map
python -m sheet_to_globe config_s2.toml     # 2026 satellite
```

The source GeoTIFFs are not stored here. The tools README says where each one comes from. All downloads use the same area, `tools/tegucigalpa_extent.geojson`.

## Versions

A new baseline is added each year and released as a new version on Zenodo, keeping the same season (early February for the satellite image, early November for the map) and the same extent, so the years stay comparable.

## How to cite

Rivera, Y. A. (2026). *SDG11-TGU-EVOLUTION: Reproducible toolkit for dated urban baselines of Tegucigalpa, 1983–2026*. Zenodo. https://doi.org/10.5281/zenodo.23957998

## License

Code (`tools/`, `index.html`): MIT. Layer images keep their sources' licenses, as listed above; the 2026 map layer is CC-BY-SA.

Author: Yanira A. Rivera · ORCID [0000-0003-3309-5256](https://orcid.org/0000-0003-3309-5256)
