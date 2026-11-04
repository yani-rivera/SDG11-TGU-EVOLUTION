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

Each layer's `.json` file (`sheet.json`, `osm2026.json`, `s2_2026.json`) records its corner coordinates and provenance: script version, source file SHA-256, settings and creation time.

## Repository layout

```
index.html          the globe (MapLibre GL JS 5.6.0)
*.json, *.webp      the three baselines as image tiles
*.geojson           Natural Earth base map
tools/              sheet_to_globe: the toolkit that rebuilds every layer
```

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
