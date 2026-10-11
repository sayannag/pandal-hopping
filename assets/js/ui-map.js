/* Pujo Parikrama — Leaflet map: pandals, Metro, food, routes, my location. */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit, S = PP.S, esc = PP.esc;
  const MU = (PP.mapUI = { map: null, tiles: null, layers: {}, markers: new Map() });

  MU.init = function () {
    const map = (MU.map = L.map('map', { zoomControl: true, preferCanvas: true, worldCopyJump: false, minZoom: 10 }).setView([22.555, 88.372], 12));
    map.setMaxBounds([[22.2, 88.0], [22.95, 88.75]]);
    MU.setTiles();
    const Ly = MU.layers;
    Ly.metro = L.layerGroup().addTo(map);
    Ly.food = L.layerGroup();
    Ly.near = L.layerGroup().addTo(map);
    Ly.pandals = L.layerGroup().addTo(map);
    Ly.route = L.layerGroup().addTo(map);
    Ly.me = L.layerGroup().addTo(map);
    MU.drawMetro();
    map.on('click', (e) => { if (S.pickingPin) MU.setPin(e.latlng.lat, e.latlng.lng, true); });
    setTimeout(() => map.invalidateSize(), 200);
  };

  MU.setTiles = function () {
    const cfg = PP.config.tiles;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    document.getElementById('map').classList.toggle('map-dark', !light && cfg.darkFilter !== false);
    if (MU.tiles) return;
    MU.tiles = L.tileLayer(cfg.url, { maxZoom: cfg.maxZoom || 19, attribution: cfg.attribution }).addTo(MU.map);
  };

  MU.toggle = function (name, on) {
    S.layers[name] = on;
    const lyr = MU.layers[name];
    if (on && !MU.map.hasLayer(lyr)) lyr.addTo(MU.map);
    if (!on && MU.map.hasLayer(lyr)) MU.map.removeLayer(lyr);
    const chip = document.getElementById('lyr-' + name);
    if (chip) chip.setAttribute('aria-pressed', String(on));
  };

  /* ---------- pandals ---------- */
  function pandalIcon(p) {
    const must = p.tags.includes('must');
    const cls = ['pin-pandal', p.crowd <= 2 ? 'calm' : '', must ? 'must' : '', S.sel === p.id ? 'sel' : '', S.plan.ids.includes(p.id) ? 'inplan' : ''].join(' ');
    const size = must ? 22 : 18;
    return L.divIcon({ className: 'pin', html: `<div class="${cls}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  MU.drawPandals = function (list) {
    const Ly = MU.layers.pandals;
    Ly.clearLayers();
    MU.markers.clear();
    list.forEach((p) => {
      const m = L.marker([p.lat, p.lon], { icon: pandalIcon(p), title: p.name, alt: p.name, riseOnHover: true, zIndexOffset: p.tags.includes('must') ? 200 : 0 });
      m.bindTooltip(`${esc(p.name)}${p.theme ? `<br><small>’26: ${esc(p.theme.t)}</small>` : ''}`, { className: 'pp-tip', direction: 'top', offset: [0, -10] });
      m.on('click', () => PP.openPandal(p.id, { fly: false }));
      m.addTo(Ly);
      MU.markers.set(p.id, m);
    });
  };
  MU.refreshMarker = function (id) {
    const m = MU.markers.get(id), p = PP.pandalById.get(id);
    if (m && p) { m.setIcon(pandalIcon(p)); m.setZIndexOffset(S.sel === id ? 1000 : p.tags.includes('must') ? 200 : 0); }
  };

  /* ---------- Metro ---------- */
  MU.drawMetro = function () {
    const Ly = MU.layers.metro;
    Ly.clearLayers();
    PP.D.metro.lines.forEach((ln) => L.polyline(ln.path, { color: ln.color, weight: 4, opacity: 0.7, interactive: false }).addTo(Ly));
    PP.D.metro.stations.forEach((s) => {
      const lines = [...(T.servedBy.get(s.id) || [])];
      if (!lines.length) return;
      L.circleMarker([s.lat, s.lon], { radius: 4.5, color: T.lines.get(lines[0]).color, weight: 2.5, fillColor: '#fff6e8', fillOpacity: 1 })
        .bindTooltip(`🚇 ${esc(s.name)} <span class="bn">${esc(s.bn || '')}</span><br><small>${lines.map((l) => esc(T.lineName(l))).join(' · ')}</small>`, { className: 'pp-tip', direction: 'top' })
        .addTo(Ly);
    });
  };

  /* ---------- food ---------- */
  function foodMarker(f) {
    const legend = f.tier === 'legend';
    const m = L.circleMarker([f.lat, f.lon], {
      radius: f.tier ? 6.5 : 4.5, color: f.tier ? '#fff6e8' : '#0b7f70', weight: f.tier ? 2 : 1,
      fillColor: legend ? '#ffb020' : '#34d6c0', fillOpacity: 0.95
    });
    m.bindTooltip(`${(PP.CATS[f.cat] || PP.CATS.multi).icon} ${esc(f.name)}`, { className: 'pp-tip', direction: 'top' });
    m.on('click', () => PP.focusFood(f.id));
    return m;
  }
  MU.drawNear = function (items) {
    const Ly = MU.layers.near;
    Ly.clearLayers();
    items.forEach((x) => foodMarker(x.f).addTo(Ly));
  };
  MU.drawFoodLayer = function (items) {
    const Ly = MU.layers.food;
    Ly.clearLayers();
    items.slice(0, 700).forEach((x) => foodMarker(x.f).addTo(Ly));
  };

  /* ---------- route ---------- */
  MU.drawRoute = function (r) {
    const Ly = MU.layers.route;
    Ly.clearLayers();
    if (!r || !r.ok) return;
    let n = 0;
    const bounds = [];
    r.sim.items.forEach((it) => {
      if (it.leg && it.from && it.node && it.node.lat != null) {
        T.legParts(it.from, it.node, it.leg).forEach((part) => {
          const style = part.kind === 'metro'
            ? { color: T.lines.get(part.line).color, weight: 7, opacity: 0.95 }
            : part.kind === 'cab'
              ? { color: '#fff6e8', weight: 4, opacity: 0.9, dashArray: '2 9' }
              : { color: '#ffb020', weight: 4, opacity: 0.95, dashArray: '9 9' };
          L.polyline(part.pts, Object.assign({ interactive: false, lineCap: 'round' }, style)).addTo(Ly);
        });
      }
      if (it.node && it.node.lat != null) {
        bounds.push([it.node.lat, it.node.lon]);
        let html;
        if (it.type === 'pandal') html = `<div class="pin-stop"><span>${++n}</span></div>`;
        else if (it.type === 'food') html = `<div class="pin-stop food"><span>${(PP.CATS[it.node.ref.cat] || PP.CATS.multi).icon}</span></div>`;
        else html = `<div class="pin-stop start"><span>${it.type === 'start' ? '▶' : '■'}</span></div>`;
        L.marker([it.node.lat, it.node.lon], { icon: L.divIcon({ className: 'pin', html, iconSize: [30, 30], iconAnchor: [15, 36] }), zIndexOffset: 900, keyboard: false })
          .bindTooltip(`${PP.fmtClock(it.arrive)} · ${esc(it.node.name)}`, { className: 'pp-tip', direction: 'top', offset: [0, -30] })
          .on('click', () => { if (it.type === 'pandal') PP.openPandal(it.node.id, { fly: false, keepTab: true }); })
          .addTo(Ly);
      }
    });
    if (bounds.length) MU.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  /* ---------- me & start pin ---------- */
  MU.showMe = function (pos, fly) {
    if (MU.meMarker) MU.layers.me.removeLayer(MU.meMarker);
    MU.meMarker = L.marker([pos.lat, pos.lon], { icon: L.divIcon({ className: 'pin', html: '<div class="pin-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), zIndexOffset: 1200 })
      .bindTooltip('You are here', { className: 'pp-tip', direction: 'top' })
      .addTo(MU.layers.me);
    if (fly) MU.map.flyTo([pos.lat, pos.lon], 14, { duration: 0.6 });
  };
  MU.setPin = function (lat, lon, announce) {
    S.pin = { lat, lon };
    S.pickingPin = false;
    document.getElementById('map').style.cursor = '';
    if (MU.pinMarker) MU.layers.me.removeLayer(MU.pinMarker);
    MU.pinMarker = L.marker([lat, lon], { draggable: true, icon: L.divIcon({ className: 'pin', html: '<div class="pin-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 26] }), zIndexOffset: 1100 })
      .bindTooltip('Your start point (drag to move)', { className: 'pp-tip', direction: 'top', offset: [0, -24] })
      .on('dragend', (e) => { const ll = e.target.getLatLng(); S.pin = { lat: ll.lat, lon: ll.lng }; })
      .addTo(MU.layers.me);
    if (announce) PP.toast('Start point set — hit “Optimise” again');
  };
})();
