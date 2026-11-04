// Build GeoJSON base layers for the globe from Natural Earth (world-atlas).
const fs = require('fs'), path = require('path');
const [,, modDir, outDir] = process.argv;
const tc = require(path.join(modDir, 'topojson-client'));
const t110 = JSON.parse(fs.readFileSync(path.join(modDir, 'world-atlas/land-110m.json')));
const t50 = JSON.parse(fs.readFileSync(path.join(modDir, 'world-atlas/countries-50m.json')));
const round = g => JSON.parse(JSON.stringify(g, (k, v) => typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v));
fs.writeFileSync(path.join(outDir, 'land.geojson'), JSON.stringify(round(tc.feature(t110, t110.objects.land))));
fs.writeFileSync(path.join(outDir, 'borders.geojson'), JSON.stringify(round(tc.mesh(t50, t50.objects.countries, (a, b) => a !== b))));
const ca = tc.feature(t50, t50.objects.countries);
ca.features = ca.features.filter(f => f.properties.name === 'Honduras');
fs.writeFileSync(path.join(outDir, 'honduras.geojson'), JSON.stringify(round(ca)));
const land50 = tc.feature(t50, t50.objects.land);
fs.writeFileSync(path.join(outDir, 'land50.geojson'), JSON.stringify(round(land50)));
