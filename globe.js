(() => {
  // Everything the page shows comes from configuration, not from this file:
  // globe.config.json picks the city and holds shared settings, and
  // data/<city>/city.json holds that city's title, focus area and baselines.
  // Adding a baseline or a city needs no change here.
  const CONFIG = 'globe.config.json';
  const DATA = 'data/';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const abs = name => new URL(name, location.href).href;
  const $ = id => document.getElementById(id);
  const clamp = x => Math.max(0, Math.min(1, x));

  // ---------- config ----------
  async function getJSON(url, what) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${what}: HTTP ${r.status}`);
    return r.json();
  }

  // the city: ?city=<folder> in the link wins, otherwise the default in globe.config.json
  function chooseCity(shared) {
    const asked = new URLSearchParams(location.search).get('city');
    const city = (asked || shared.city || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(city)) throw new Error(`no valid city given (${asked ? '?city=' + asked : CONFIG})`);
    return city;
  }

  async function loadConfig() {
    const shared = await getJSON(abs(CONFIG), CONFIG);
    const city = chooseCity(shared);
    const cityUrl = new URL(`${DATA}${city}/city.json`, location.href);
    let own;
    try { own = await getJSON(cityUrl, `${DATA}${city}/city.json`); }
    catch (err) { throw new Error(`city "${city}" not found in ${DATA} (${err.message})`); }

    const cfg = { ...shared, ...own, city };
    if (!Array.isArray(cfg.layers)) throw new Error(`${city}/city.json: no layers`);
    cfg.layers = cfg.layers.filter(l => l.show !== false);   // "show": false keeps a baseline listed but off the page
    if (!cfg.layers.length) throw new Error(`${city}/city.json: every layer has show: false`);
    // manifests are written relative to the city folder
    cfg.layers.forEach(l => { l.manifestUrl = new URL(l.manifest, cityUrl).href; });
    if (!cfg.focus || !(cfg.focus.center || cfg.focus.bounds)) throw new Error(`${city}/city.json: focus needs center or bounds`);
    cfg.load_from_zoom ??= 8;      // below this zoom no baseline is downloaded
    cfg.max_loaded ??= 4;          // baselines kept in memory at once
    return cfg;
  }

  // the pair the page opens with: "compare": [first id, second id] in city.json,
  // otherwise the first and last layers listed
  function openingPair(cfg) {
    const byId = id => cfg.layers.find(l => l.id === id);
    const [a, b] = (cfg.compare || []).map(byId);
    return [a || cfg.layers[0], b || cfg.layers[cfg.layers.length - 1]];
  }

  // camera for the focus area: either center + zoom, or bounds [west, south, east, north]
  function focusCamera(map, focus) {
    const base = { pitch: focus.pitch || 0, bearing: focus.bearing || 0 };
    if (focus.bounds) {
      const [w, s, e, n] = focus.bounds;
      return { ...map.cameraForBounds([[w, s], [e, n]], { padding: 40 }), ...base };
    }
    return { center: focus.center, zoom: focus.zoom ?? 12, ...base };
  }
  const focusCenter = f => f.center || [(f.bounds[0] + f.bounds[2]) / 2, (f.bounds[1] + f.bounds[3]) / 2];

  // ---------- page text ----------
  function fillText(cfg) {
    const ys = cfg.layers.map(l => l.year).filter(y => y != null);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const span = !ys.length ? '' : lo === hi ? `, ${lo}` : `, ${lo}–${hi}`;
    $('title').textContent = cfg.title + span;
    document.title = $('title').textContent;
    $('map').setAttribute('aria-label', `Globe with ${$('title').textContent}, as maps and from satellite`);
    if (cfg.kicker) $('kicker').textContent = cfg.kicker;
    if (cfg.intro) $('intro').textContent = cfg.intro;
    $('flyTo').textContent = `Fly to ${cfg.focus.name || 'focus'}`;
    const src = $('source');
    src.textContent = '';
    [...cfg.layers.map(l => l.credit), cfg.base_credit].filter(Boolean).forEach((c, i) => {
      if (i) src.append(document.createElement('br'));
      src.append(c);
    });
  }

  // both pickers list every layer, in the order city.json lists them
  function buildPickers(cfg, [a, b]) {
    for (const [sel, chosen] of [[$('pickA'), a], [$('pickB'), b]]) {
      sel.textContent = '';
      cfg.layers.forEach(l => sel.append(new Option(l.label || String(l.year), l.id, false, l === chosen)));
    }
  }

  // ---------- map ----------
  function graticule(step = 15) {
    const lines = [];
    for (let lon = -180; lon <= 180; lon += step) {
      const c = []; for (let lat = -80; lat <= 80; lat += 2) c.push([lon, lat]);
      lines.push({ type: 'Feature', properties: { kind: lon === 0 ? 'meridian' : 'line' }, geometry: { type: 'LineString', coordinates: c } });
    }
    for (let lat = -75; lat <= 75; lat += step) {
      const c = []; for (let lon = -180; lon <= 180; lon += 2) c.push([lon, lat]);
      lines.push({ type: 'Feature', properties: { kind: lat === 0 ? 'equator' : 'line' }, geometry: { type: 'LineString', coordinates: c } });
    }
    for (const lat of [23.44, -23.44]) {
      const c = []; for (let lon = -180; lon <= 180; lon += 2) c.push([lon, lat]);
      lines.push({ type: 'Feature', properties: { kind: 'tropic' }, geometry: { type: 'LineString', coordinates: c } });
    }
    return { type: 'FeatureCollection', features: lines };
  }

  function makeMap(startCamera) {
    return new maplibregl.Map({
      container: 'map',
      ...startCamera, minZoom: 0.8, maxZoom: 17,
      attributionControl: { compact: true },
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 5, 0.25, 7, 0] },
        sources: {
          land: { type: 'geojson', data: abs(DATA + 'basemap/land50.geojson') },
          borders: { type: 'geojson', data: abs(DATA + 'basemap/borders.geojson'), attribution: 'Natural Earth' },
          honduras: { type: 'geojson', data: abs(DATA + 'basemap/honduras.geojson') },
          grat: { type: 'geojson', data: graticule() }
        },
        layers: [
          { id: 'sea', type: 'background', paint: { 'background-color': '#9fb3a6' } },
          { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#ead9b4' } },
          { id: 'hn', type: 'fill', source: 'honduras', paint: { 'fill-color': '#e3c993' } },
          { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#6e5235', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 8, 1.4] } },
          { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': '#8a6a43', 'line-width': 0.6, 'line-dasharray': [3, 2] } },
          { id: 'tropics', type: 'line', source: 'grat', filter: ['==', ['get', 'kind'], 'tropic'], paint: {
              'line-color': '#7d6240', 'line-width': 0.8, 'line-dasharray': [4, 3],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 6, 0] } },
          { id: 'grat', type: 'line', source: 'grat', filter: ['!=', ['get', 'kind'], 'tropic'], paint: {
              'line-color': '#7d6240',
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 6, 0],
              'line-width': ['match', ['get', 'kind'], ['equator', 'meridian'], 1.1, 0.45] } }
        ]
      }
    });
  }

  // ---------- loader: a baseline is downloaded only when it is about to be seen ----------
  // Each baseline's tiles are pinned by their own corners. New tiles go on top of the
  // other baselines; the renderer then puts the first chosen layer above the second.
  function makeLoader(map, cfg) {
    const loaded = new Map();    // layer id -> { layer, tileIds, lastUsed }
    const pending = new Map();   // layer id -> promise
    const baselineIds = () => [...loaded.values()].flatMap(e => e.tileIds);

    // resolves once every tile image has arrived (or its source was dropped meanwhile)
    function imagesArrived(ids) {
      return new Promise((resolve, reject) => {
        const done = () => ids.every(id => !map.getSource(id) || map.isSourceLoaded(id));
        if (done()) return resolve();
        const finish = fn => { map.off('sourcedata', onData); map.off('error', onError); fn(); };
        const onData = e => { if (ids.includes(e.sourceId) && done()) finish(resolve); };
        const onError = e => { if (ids.includes(e.sourceId)) finish(() => reject(new Error(`${e.sourceId}: image did not load`))); };
        map.on('sourcedata', onData);
        map.on('error', onError);
      });
    }

    async function ensure(layer) {
      if (loaded.has(layer.id)) { loaded.get(layer.id).lastUsed = performance.now(); return; }
      if (pending.has(layer.id)) return pending.get(layer.id);
      const p = (async () => {
        const url = new URL(layer.manifestUrl);
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${layer.manifest}: HTTP ${r.status}`);
        const meta = await r.json();
        const tileIds = meta.tiles.map((t, i) => {
          const id = `${layer.id}_${i}`;
          map.addSource(id, { type: 'image', url: new URL(t.file, url).href, coordinates: t.coordinates });
          map.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' },
            paint: { 'raster-opacity': 1, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, 'tropics');
          return id;
        });
        loaded.set(layer.id, { layer, tileIds, lastUsed: performance.now() });
        await imagesArrived(tileIds);   // the large sheets take a few seconds
      })().finally(() => pending.delete(layer.id));
      pending.set(layer.id, p);
      return p;
    }

    function drop(id) {
      const e = loaded.get(id);
      e.tileIds.forEach(t => { map.removeLayer(t); map.removeSource(t); });
      loaded.delete(id);
    }

    // keep what is needed now; beyond the cap, forget the least recently used
    function trim(needed) {
      const spare = [...loaded.values()].filter(e => !needed.has(e.layer.id)).sort((a, b) => a.lastUsed - b.lastUsed);
      while (loaded.size > cfg.max_loaded && spare.length) drop(spare.shift().layer.id);
    }

    return { ensure, trim, loaded, pending, baselineIds };
  }

  // ---------- state: the two chosen layers, the fade between them, layers on/off ----------
  function makeRenderer(map, cfg, [a, b], loader) {
    const state = { a, b, pos: 0, on: true };
    let onTop = null;   // which layer's tiles are currently stacked on top

    function neededLayers() {
      if (!state.on || map.getZoom() < cfg.load_from_zoom) return [];
      return [...new Set([state.a, state.b])];
    }

    // the first layer must sit above the second so the fade reveals it
    function stack() {
      const top = loader.loaded.get(state.a.id);
      if (!top || onTop === state.a.id) return;
      top.tileIds.forEach(id => map.moveLayer(id, 'tropics'));
      onTop = state.a.id;
    }

    const paint = () => {
      stack();
      const fade = state.a === state.b ? 0 : state.pos / 100;
      for (const { layer, tileIds } of loader.loaded.values()) {
        const opacity = layer === state.a ? 1 - fade : layer === state.b ? 1 : 0;
        tileIds.forEach(id => {
          const visible = state.on && opacity > 0;
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
          if (visible) map.setPaintProperty(id, 'raster-opacity', opacity);
        });
      }
      $('labelA').textContent = state.a.label || state.a.year;
      $('labelB').textContent = state.b.label || state.b.year;
      $('labelA').classList.toggle('on', fade < 0.5);
      $('labelB').classList.toggle('on', fade >= 0.5);
      $('year').setAttribute('aria-valuetext', fade < 0.5 ? (state.a.label || state.a.year) : (state.b.label || state.b.year));
      const waiting = [...new Set([state.a, state.b])].filter(l => loader.pending.has(l.id));
      const zoomedOut = state.on && map.getZoom() < cfg.load_from_zoom;
      const status = $('status');
      status.classList.toggle('loading', waiting.length > 0);
      status.textContent = waiting.length
        ? `Loading ${waiting.map(l => l.label || l.year).join(' and ')}… the maps are large, give them a few seconds.`
        : zoomedOut ? `Zoom in, or use “Fly to ${cfg.focus.name || 'focus'}”, to see the maps.` : '';
    };

    const render = () => {
      const needed = neededLayers();
      paint();
      if (!needed.length) return;
      const keep = new Set(needed.map(l => l.id));
      needed.forEach(l => loader.ensure(l).then(() => { loader.trim(keep); onTop = null; paint(); }).catch(err => {
        console.error(err);
        $('status').textContent = `Could not load ${l.label || l.id}.`;
      }));
      paint();   // shows "Loading…" while the downloads run
      loader.trim(keep);
    };
    map.on('zoomend', render);
    // start downloading as soon as the view passes city level, not when the motion ends
    map.on('zoom', () => {
      const missing = neededLayers().some(l => !loader.loaded.has(l.id) && !loader.pending.has(l.id));
      if (missing) render();
    });

    // fetch the chosen pair right away, e.g. while the "Fly to" flight is still in the air
    const prefetch = () => {
      if (!state.on) return;
      [...new Set([state.a, state.b])].forEach(l => loader.ensure(l).then(paint).catch(err => console.error(err)));
      paint();
    };
    return { state, render, prefetch, reorder: () => { onTop = null; } };
  }

  // ---------- wiring ----------
  function wireControls(cfg, { state, render, reorder }) {
    const byId = id => cfg.layers.find(l => l.id === id);
    const choose = () => {
      state.a = byId($('pickA').value);
      state.b = byId($('pickB').value);
      reorder();
      render();
    };
    $('pickA').addEventListener('change', choose);
    $('pickB').addEventListener('change', choose);
    $('swap').addEventListener('click', () => {
      [$('pickA').value, $('pickB').value] = [$('pickB').value, $('pickA').value];
      $('year').value = String(100 - +$('year').value);   // keep the same picture on screen
      state.pos = +$('year').value;
      choose();
    });
    $('year').addEventListener('input', e => { state.pos = +e.target.value; render(); });
    $('toggleSheet').addEventListener('click', e => {
      state.on = !state.on;
      e.currentTarget.setAttribute('aria-pressed', String(state.on));
      e.currentTarget.textContent = state.on ? 'Layers on' : 'Layers off';
      render();
    });
  }

  function wireCamera(map, cfg, stopSpin, hooks) {
    $('flyTo').addEventListener('click', () => {
      hooks.flyTo();
      stopSpin();
      map.flyTo({ ...focusCamera(map, cfg.focus), duration: reduceMotion ? 0 : 6500, curve: 1.6, essential: true });
    });
    $('flyOut').addEventListener('click', () => {
      stopSpin();
      map.flyTo({ center: focusCenter(cfg.focus), zoom: 1.7, pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 4000, essential: true });
    });
  }

  // the pin at the focus, fading out once the layers are legible
  function addPin(map, cfg) {
    const pinEl = document.createElement('div');
    pinEl.className = 'pin';
    pinEl.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L9.8 6.2 L15 8 L9.8 9.8 L8 15 L6.2 9.8 L1 8 L6.2 6.2 Z" fill="#9b3b2a" stroke="#ead9b4" stroke-width="0.8"/></svg><span></span>';
    pinEl.querySelector('span').textContent = cfg.focus.name || '';
    new maplibregl.Marker({ element: pinEl, anchor: 'top', offset: [0, -8] }).setLngLat(focusCenter(cfg.focus)).addTo(map);
    const update = () => pinEl.classList.toggle('faded', map.getZoom() > 9.5);
    map.on('zoom', update);
    update();
  }

  // gentle spin until someone touches the globe (only when the page opens on the whole globe)
  function addSpin(map, enabled) {
    let spinning = enabled && !reduceMotion;
    const stopSpin = () => { spinning = false; };
    ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(e => map.on(e, stopSpin));
    const spin = () => {
      if (!spinning || map.getZoom() > 3) return;
      const c = map.getCenter(); c.lng -= 4;
      map.easeTo({ center: c, duration: 1000, easing: n => n });
    };
    map.on('moveend', () => { if (spinning) spin(); });
    map.once('load', () => { if (spinning) spin(); });
    return stopSpin;
  }

  // coordinates in degrees and minutes, like the margins of the sheet
  function addReadout(map) {
    const dm = (v, pos, neg) => {
      const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60);
      return `${m === 60 ? d + 1 : d}°${String(m === 60 ? 0 : m).padStart(2, '0')}′ ${v >= 0 ? pos : neg}`;
    };
    const show = ll => { $('readout').textContent = `${dm(ll.lat, 'N', 'S')} · ${dm(ll.lng, 'E', 'W')}`; };
    map.on('mousemove', e => show(e.lngLat));
    map.on('move', () => { if (!matchMedia('(hover: hover)').matches) show(map.getCenter()); });
  }

  // ---------- start ----------
  (async () => {
    let cfg;
    try { cfg = await loadConfig(); }
    catch (err) {
      $('title').textContent = 'Map not found';
      $('intro').textContent = '';
      $('source').textContent = `Could not load the layer settings (${err.message}).`;
      throw err;
    }
    const pair = openingPair(cfg);
    fillText(cfg);
    buildPickers(cfg, pair);

    const prefocus = cfg.start === 'focus';
    const globeCamera = { center: [focusCenter(cfg.focus)[0] + 27, 12], zoom: 1.6 };
    const map = makeMap(prefocus && cfg.focus.center ? focusCamera({}, cfg.focus) : globeCamera);
    const ready = new Promise(res => map.once('load', res));
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    if (prefocus && cfg.focus.bounds) map.once('load', () => map.jumpTo(focusCamera(map, cfg.focus)));

    const stopSpin = addSpin(map, !prefocus);
    addPin(map, cfg);
    addReadout(map);
    const hooks = { flyTo: () => {} };   // filled in once the layers can load
    wireCamera(map, cfg, stopSpin, hooks);

    await ready;
    const renderer = makeRenderer(map, cfg, pair, makeLoader(map, cfg));
    wireControls(cfg, renderer);
    hooks.flyTo = renderer.prefetch;
    renderer.render();
  })();
})();
