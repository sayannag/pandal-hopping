/* Pujo Parikrama — bootstrap: hero, calendar, food browser, tabs, events, theme, Google key, routing. */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit, G = PP.google, S = PP.S, MU = PP.mapUI, esc = PP.esc, $ = PP.$, $$ = PP.$$;
  const META = PP.D.meta || { days: [], sources: [] };

  /* ---------- hero ---------- */
  function heroStats() {
    $('#stat-pandals').textContent = PP.pandals.length;
    $('#stat-themes').textContent = PP.pandals.filter((p) => p.theme).length;
    $('#stat-food').textContent = PP.food.length;
    $('#stat-metro').textContent = PP.D.metro.stations.filter((s) => (T.servedBy.get(s.id) || new Set()).size).length;
  }
  const dayStart = (d) => Date.parse(d + 'T00:00:00+05:30');
  const dayEnd = (d) => Date.parse(d + 'T23:59:59+05:30');
  function dayState(d, now) {
    const s = dayStart(d.date), e = dayEnd(d.end || d.date);
    return now > e ? 'past' : now >= s ? 'today' : 'future';
  }
  function renderDays() {
    const now = Date.now();
    let nextMarked = false;
    $('#days-strip').innerHTML = META.days.map((d) => {
      let st = dayState(d, now);
      let cls = st === 'past' ? 'past' : st === 'today' ? 'today' : '';
      if (st === 'future' && !nextMarked && !META.days.some((x) => dayState(x, now) === 'today')) { cls = 'next'; nextMarked = true; }
      const dd = new Date(d.date + 'T12:00:00Z');
      const label = d.end ? `${dd.getUTCDate()}–${new Date(d.end + 'T12:00:00Z').getUTCDate()}` : dd.getUTCDate();
      return `<button class="day ${cls}" type="button" data-day="${d.date}" ${d.key === 'mahalaya' ? 'disabled' : ''} title="${esc(d.note)}">
        <span class="d">${label}<small style="font-size:12px;font-weight:700;color:var(--dim)"> Oct</small></span><span class="n">${esc(d.name)}</span><span class="b">${esc(d.bn)}</span></button>`;
    }).join('');
    $('#cal-grid').innerHTML = META.days.map((d) => {
      const st = dayState(d, now);
      const dd = new Date(d.date + 'T12:00:00Z');
      return `<article class="cal-card ${st === 'past' ? 'past' : st === 'today' ? 'today' : ''}">
        <div class="mon">${dd.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })} · Oct</div>
        <div class="date">${d.end ? dd.getUTCDate() + '–' + new Date(d.end + 'T12:00:00Z').getUTCDate() : dd.getUTCDate()}</div>
        <div class="nm">${esc(d.name)}</div><div class="bn">${esc(d.bn)}</div><p>${esc(d.note)}</p></article>`;
    }).join('');
  }
  function tickCountdown() {
    const now = Date.now();
    const days = META.days.filter((d) => d.key !== 'mahalaya');
    const today = days.find((d) => dayState(d, now) === 'today');
    const box = $('#countdown');
    if (today) {
      box.innerHTML = `<div class="label">Today is</div><div class="big">${esc(today.name)} <span class="bn" style="font-family:var(--font-bn-display);font-weight:400;color:var(--gold)">${esc(today.bn)}</span></div><div class="sub">${esc(today.note)}</div>`;
      return;
    }
    const next = days.find((d) => dayState(d, now) === 'future');
    if (!next) {
      box.innerHTML = '<div class="label">Bijoya greetings</div><div class="big bn" style="font-family:var(--font-bn-display);font-weight:400">আসছে বছর আবার হবে</div><div class="sub">“It’ll happen again next year!”</div>';
      return;
    }
    let ms = dayStart(next.date) - now;
    const dd = Math.floor(ms / 864e5); ms -= dd * 864e5;
    const hh = Math.floor(ms / 36e5); ms -= hh * 36e5;
    const mm = Math.floor(ms / 6e4);
    box.innerHTML = `<div class="label">${esc(next.name)} begins in</div><div class="big">${dd ? dd + 'd ' : ''}${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m</div><div class="sub">${esc(PP.dateLabel(next.date, { weekday: 'long' }))} · ${esc(next.note)}</div>`;
  }

  /* ---------- Metro timetable ---------- */
  function renderMetroTable() {
    const sch = PP.D.metro.schedule;
    const fmt = (h) => {
      if (!h) return '<span class="closed">Not running</span>';
      const s = PP.parseHM(h[0]), e = PP.parseHM(h[1]);
      return `${PP.fmtClock(s)} – ${PP.fmtClock(e)}${e < s ? ' <small class="dim">(next morning)</small>' : ''}<br><small class="dim">every ~${h[2]} min at peak</small>`;
    };
    const head = sch.periods.map((p) => `<th>${esc(p.label)}<br><small>${esc(PP.dateLabel(p.from, { weekday: undefined }))}${p.to !== p.from ? ' – ' + esc(PP.dateLabel(p.to, { weekday: undefined })) : ''}</small></th>`).join('');
    const rows = PP.D.metro.lines.map((l) => `<tr><td class="line"><span class="metro-dot" style="background:${l.color}"></span>${esc(l.name)}<br><small class="dim">${esc(T.stations.get(l.stations[0]).name)} – ${esc(T.stations.get(l.stations[l.stations.length - 1]).name)}</small></td>${sch.periods.map((p) => `<td>${fmt(p.hours[l.id])}</td>`).join('')}</tr>`).join('');
    $('#metro-table').innerHTML = `<thead><tr><th>Line</th>${head}</tr></thead><tbody>${rows}</tbody>`;
    $('#metro-note').textContent = sch.note;
  }

  /* ---------- food browser ---------- */
  function renderFoodCats() {
    const counts = {};
    PP.food.forEach((f) => { counts[f.cat] = (counts[f.cat] || 0) + 1; });
    $('#food-cats').innerHTML = [['all', 'All', PP.food.length]].concat(Object.keys(PP.CATS).map((k) => [k, PP.CATS[k].icon + ' ' + PP.CATS[k].short, counts[k] || 0]))
      .map(([k, l, n]) => `<button class="chip" type="button" data-fcat="${k}" aria-pressed="${S.food.cat === k}">${l} <span class="dim">${n}</span></button>`).join('');
  }
  PP.renderFood = function () {
    const F = S.food, q = PP.norm(F.q);
    const c = MU.map.getCenter();
    const ref = F.sort === 'me' && S.me ? S.me : { lat: c.lat, lon: c.lng };
    let list = PP.food.filter((f) => (F.cat === 'all' || f.cat === F.cat) && (!F.picks || f.tier) && (!F.nochain || !f.chain) && (!q || q.split(' ').every((w) => f._s.includes(w))))
      .map((f) => ({ f, km: PP.hav(ref, f) }));
    const tierN = (f) => (f.tier === 'legend' ? 0 : f.tier === 'fave' ? 1 : 2);
    if (F.sort === 'picks') list.sort((a, b) => tierN(a.f) - tierN(b.f) || a.km - b.km);
    else if (F.sort === 'az') list.sort((a, b) => a.f.name.localeCompare(b.f.name));
    else list.sort((a, b) => a.km - b.km);
    $('#food-meta').textContent = `${list.length} places · distances from ${F.sort === 'me' && S.me ? 'you' : 'the map centre'}`;
    const shown = list.slice(0, F.limit);
    $('#food-list').innerHTML = shown.length
      ? shown.map((x) => PP.foodCard(x.f, x.km)).join('') + (list.length > shown.length ? `<button class="btn btn-ghost btn-sm btn-block" type="button" data-more-food>Show more (${list.length - shown.length} left)</button>` : '')
      : '<div class="empty"><b>Nothing matches</b>Try another word or category.</div>';
    if (S.tab === 'food' || S.layers.food) MU.drawFoodLayer(list);
  };

  /* ---------- tabs ---------- */
  PP.switchTab = function (tab) {
    if (S.tab === tab) return;
    S.tab = tab;
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + tab));
    $('#panel-body').scrollTop = 0;
    if (tab === 'food') { MU.toggle('food', true); PP.renderFood(); }
    else if (S.layers.food && !$('#lyr-food').dataset.user) MU.toggle('food', false);
    if (tab !== 'pandals') MU.layers.near.clearLayers();
    else if (S.sel) PP.renderDetailFood();
    if (tab === 'plan') { PP.renderPlanPicks(); PP.syncPlanForm(); }
  };

  /* ---------- location ---------- */
  PP.locate = function (fly) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { PP.toast('Location is not available in this browser'); resolve(null); return; }
      PP.toast('Finding you…');
      navigator.geolocation.getCurrentPosition((pos) => {
        S.me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        MU.showMe(S.me, fly);
        if (PP.hav(S.me, { lat: 22.57, lon: 88.38 }) > 40) PP.toast('You seem to be outside Kolkata — distances will be large');
        else PP.toast('Got your location');
        PP.renderPandals();
        if (S.tab === 'food') PP.renderFood();
        resolve(S.me);
      }, () => { PP.toast('Could not get your location (permission denied?)'); resolve(null); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  };

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    PP.store.set('theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#fff8ee' : '#12070a');
    if (MU.map) MU.setTiles();
  }

  /* ---------- Google key ---------- */
  function updateLivePill() {
    const on = G.enabled() && G.state !== 'error';
    $('#live-pill').classList.toggle('on', on);
    $('#live-pill-txt').textContent = on ? 'Live Google ratings' : 'Google ratings';
    $('#key-status').innerHTML = !G.enabled() ? 'Using keyless Google cards (tap ★ on any place).'
      : G.state === 'error' ? `<span style="color:var(--sindoor)">⚠ ${esc(G.error)}</span>`
        : G.state === 'ready' ? '<span style="color:var(--leaf)">✓ Connected — live ratings appear on every pandal page.</span>'
          : 'Key saved — live ratings load when you open a pandal.';
    if ($('#pl-minrating-wrap')) $('#pl-minrating-wrap').hidden = !G.enabled();
  }
  function bindKeyUI() {
    const input = $('#key-input');
    if (G.key) input.value = G.key;
    $('#key-save').addEventListener('click', async () => {
      const v = input.value.trim();
      if (!/^AIza[0-9A-Za-z_\-]{20,}$/.test(v)) { $('#key-status').innerHTML = '<span style="color:var(--sindoor)">That doesn\'t look like a Google API key (they start with “AIza”).</span>'; return; }
      if (G.setKey(v) === 'reload') { PP.toast('Key saved — reloading to apply'); setTimeout(() => location.reload(), 800); return; }
      $('#key-status').textContent = 'Testing the key…';
      try {
        const r = await G.nearby(22.5745, 88.3637, 400);
        $('#key-status').innerHTML = `<span style="color:var(--leaf)">✓ Connected — found ${r.length} places around College Square.</span>`;
        PP.syncPlanForm();
        if (S.sel) PP.openPandal(S.sel, { fly: false });
      } catch (e) { updateLivePill(); }
      updateLivePill();
    });
    $('#key-remove').addEventListener('click', () => {
      input.value = '';
      S.liveMap.clear();
      if (G.setKey('') === 'reload') { PP.toast('Key removed — reloading'); setTimeout(() => location.reload(), 800); return; }
      updateLivePill();
      PP.toast('Google key removed from this browser');
    });
    document.addEventListener('pp:google', updateLivePill);
    updateLivePill();
  }

  /* ---------- events ---------- */
  function bindEvents() {
    $('#pandal-q').addEventListener('input', PP.debounce((e) => { S.q = e.target.value; PP.renderPandals(); }, 140));
    $('#pandal-sort').addEventListener('change', async (e) => { S.sort = e.target.value; if (S.sort === 'near' && !S.me) await PP.locate(false); PP.renderPandals(); });
    $('#food-q').addEventListener('input', PP.debounce((e) => { S.food.q = e.target.value; S.food.limit = 50; PP.renderFood(); }, 160));
    $('#food-sort').addEventListener('change', async (e) => { S.food.sort = e.target.value; if (S.food.sort === 'me' && !S.me) await PP.locate(true); PP.renderFood(); });
    MU.map.on('moveend', PP.debounce(() => { if (S.tab === 'food' && S.food.sort === 'map') PP.renderFood(); }, 250));
    $('#theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
    $('#live-pill').addEventListener('click', () => $('#live').scrollIntoView({ behavior: 'smooth' }));
    $('#btn-locate').addEventListener('click', () => PP.locate(true));
    ['pandals', 'food', 'metro'].forEach((k) => $('#lyr-' + k).addEventListener('click', (e) => {
      e.currentTarget.dataset.user = '1';
      MU.toggle(k, !S.layers[k]);
      if (k === 'food' && S.layers.food) PP.renderFood();
    }));
    $('#plan-clear').addEventListener('click', () => {
      const ids = S.plan.ids.slice();
      S.plan.ids = []; S.plan.foods = [];
      PP.savePlan(); PP.renderPlanPicks();
      ids.forEach((id) => PP.refreshPlanMarks(id));
      $('#plan-result').hidden = true; MU.drawRoute(null);
      PP.toast('Plan cleared');
    });
    $('#add-custom').addEventListener('click', startCustomAdd);
    $('#add-visible').addEventListener('click', () => {
      const vis = PP.visiblePandals().slice(0, 25);
      vis.forEach((p) => { if (!S.plan.ids.includes(p.id)) S.plan.ids.push(p.id); });
      PP.savePlan(); PP.renderPlanPicks(); PP.renderPandals();
      PP.toast(`${S.plan.ids.length} pandals in your plan`);
    });

    document.addEventListener('click', async (e) => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-add]'))) { e.stopPropagation(); PP.togglePlan(el.dataset.add); return; }
      if ((el = t.closest('[data-addfood]'))) { PP.toggleFoodStop(el.dataset.addfood); return; }
      if ((el = t.closest('[data-embed]'))) { PP.toggleEmbed(el); return; }
      if ((el = t.closest('[data-back]'))) { PP.closeDetail(); return; }
      if ((el = t.closest('[data-open]'))) { PP.openPandal(el.dataset.open, { fly: true }); return; }
      if ((el = t.closest('[data-zone]'))) { S.zone = el.dataset.zone; PP.renderZoneChips(); PP.renderPandals(); if (S.zone !== 'all') fitList(); return; }
      if ((el = t.closest('[data-filter]'))) { const k = el.dataset.filter; S.filters.has(k) ? S.filters.delete(k) : S.filters.add(k); PP.renderZoneChips(); PP.renderPandals(); return; }
      if ((el = t.closest('[data-radius]'))) { S.dFood.radius = Number(el.dataset.radius); S.dFood.limit = 30; $$('#dfood-radius button').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); PP.renderDetailFood(); return; }
      if ((el = t.closest('[data-dcat]'))) { S.dFood.cat = el.dataset.dcat; S.dFood.limit = 30; PP.renderDetailFood(); return; }
      if ((el = t.closest('[data-more-dfood]'))) { S.dFood.limit += 30; PP.renderDetailFood(); return; }
      if ((el = t.closest('[data-fcat]'))) { S.food.cat = el.dataset.fcat; S.food.limit = 50; renderFoodCats(); PP.renderFood(); return; }
      if ((el = t.closest('[data-more-food]'))) { S.food.limit += 50; PP.renderFood(); return; }
      if ((el = t.closest('#food-picks'))) { S.food.picks = !S.food.picks; el.setAttribute('aria-pressed', String(S.food.picks)); PP.renderFood(); return; }
      if ((el = t.closest('#food-nochain'))) { S.food.nochain = !S.food.nochain; el.setAttribute('aria-pressed', String(S.food.nochain)); PP.renderFood(); return; }
      if ((el = t.closest('[data-gq]'))) {
        const p = PP.pandalById.get(S.sel);
        $$('#gmap-q .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === el)));
        if (p) $('#gmap-embed').src = PP.embedNearby(el.dataset.gq, p.lat, p.lon, 17);
        return;
      }
      if ((el = t.closest('[data-trail]'))) { PP.loadTrail(Number(el.dataset.trail)); return; }
      if ((el = t.closest('[data-rm]'))) { PP.togglePlan(el.dataset.rm); PP.renderPandals(); return; }
      if ((el = t.closest('[data-rmfood]'))) { PP.toggleFoodStop(el.dataset.rmfood); return; }
      if ((el = t.closest('[data-tab]'))) { PP.switchTab(el.dataset.tab); return; }
      if ((el = t.closest('[data-go]'))) { PP.switchTab(el.dataset.go); if (el.dataset.go === 'pandals' && S.sel) PP.closeDetail(); return; }
      if ((el = t.closest('[data-day]'))) {
        S.settings.day = el.dataset.day; PP.saveSettings(); PP.syncPlanForm(); PP.switchTab('plan');
        $('#app').scrollIntoView({ behavior: 'smooth' });
        PP.toast('Planning for ' + PP.dateLabel(S.settings.day, { weekday: 'long' }));
        return;
      }
      if ((el = t.closest('[data-rm-custom]'))) { if (window.confirm('Remove this pandal you added?')) PP.removeCustom(el.dataset.rmCustom); return; }
      if ((el = t.closest('[data-share-pandal]'))) { share(location.origin + location.pathname + '#p=' + el.dataset.sharePandal, PP.pandalById.get(el.dataset.sharePandal).name); return; }
      if ((el = t.closest('[data-plan-share]'))) { share(PP.planLink(), 'My Pujo Parikrama plan'); return; }
      if ((el = t.closest('[data-plan-copy]'))) { copy(PP.itineraryText(), 'Itinerary copied — paste it into WhatsApp'); return; }
    });
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'dfood-nochain') { S.dFood.nochain = e.target.checked; S.dFood.limit = 30; PP.renderDetailFood(); }
    });
    $('#pandal-list').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('p-card')) PP.openPandal(e.target.dataset.open);
    });
  }
  function fitList() {
    const list = PP.visiblePandals();
    if (list.length) MU.map.fitBounds(list.map((p) => [p.lat, p.lon]), { padding: [30, 30], maxZoom: 15 });
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); PP.toast(msg || 'Copied'); }
    catch (e) { window.prompt('Copy this:', text); }
  }
  async function share(url, title) {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { /* cancelled */ } }
    copy(url, 'Link copied');
  }

  /* ---------- custom pandals (saved in this browser) ---------- */
  function registerCustom(c) {
    const near = PP.pandals.filter((p) => !p.custom).map((p) => [PP.hav(p, c), p]).sort((a, b) => a[0] - b[0])[0];
    const p = { id: c.id, name: c.name, bn: '', area: c.area || (near ? near[1].area : 'Kolkata'), zone: near ? near[1].zone : 'central', lat: c.lat, lon: c.lon, prec: 'exact', tags: ['custom'], crowd: 3, note: 'Added by you — saved only in this browser.', custom: true };
    p._s = PP.norm(p.name + ' ' + p.area);
    p._st = T.nearestStation(p);
    p._nf = PP.food.reduce((n, f) => n + (PP.hav(p, f) <= 0.8 ? 1 : 0), 0);
    p._score = PP.planner.pandalScore(p);
    PP.pandals.push(p);
    PP.pandalById.set(p.id, p);
    return p;
  }
  function loadCustom() { (PP.store.get('custom', []) || []).forEach(registerCustom); }
  function startCustomAdd() {
    const name = (window.prompt('Name of the pandal (e.g. “Hindusthan Park Sarbojanin”):') || '').trim();
    if (!name) return;
    S.pickingCustom = name;
    document.getElementById('map').style.cursor = 'crosshair';
    if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    PP.toast('Now tap the map where “' + name + '” is', 5000);
  }
  function finishCustomAdd(lat, lon) {
    const name = S.pickingCustom;
    S.pickingCustom = null;
    document.getElementById('map').style.cursor = '';
    const c = { id: 'custom-' + Date.now().toString(36), name, lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
    const list = PP.store.get('custom', []) || [];
    list.push(c);
    PP.store.set('custom', list);
    const p = registerCustom(c);
    PP.renderZoneChips(); PP.renderPandals();
    PP.openPandal(p.id, { fly: false });
    PP.toast('Added ' + name);
  }
  PP.removeCustom = function (id) {
    PP.store.set('custom', (PP.store.get('custom', []) || []).filter((c) => c.id !== id));
    const i = PP.pandals.findIndex((p) => p.id === id);
    if (i >= 0) PP.pandals.splice(i, 1);
    PP.pandalById.delete(id);
    S.plan.ids = S.plan.ids.filter((x) => x !== id); PP.savePlan();
    PP.closeDetail(); PP.renderZoneChips(); PP.renderPandals(); PP.renderPlanPicks();
    PP.toast('Removed');
  };

  /* ---------- routing ---------- */
  function route() {
    const h = location.hash;
    if (h.startsWith('#p=')) {
      const id = decodeURIComponent(h.slice(3));
      if (PP.pandalById.has(id)) { PP.openPandal(id); setTimeout(() => $('#app').scrollIntoView({ block: 'nearest' }), 50); }
    } else if (h.startsWith('#plan=')) {
      if (PP.loadSharedPlan(h.slice(6))) {
        PP.syncPlanForm(); PP.renderPlanPicks(); PP.renderPandals(); PP.switchTab('plan');
        setTimeout(() => { $('#app').scrollIntoView({ block: 'nearest' }); PP.runOptimise(); }, 80);
      }
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    PP.art.draw();
    heroStats();
    renderDays();
    tickCountdown();
    setInterval(tickCountdown, 30000);
    renderMetroTable();
    $('#sources-list').innerHTML = (META.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
    $('#data-updated').textContent = PP.dateLabel(META.updated || '2026-10-11', { weekday: undefined, year: 'numeric' });
    MU.init();
    loadCustom();
    MU.map.on('click', (e) => { if (S.pickingCustom) finishCustomAdd(e.latlng.lat, e.latlng.lng); });
    PP.renderZoneChips();
    PP.renderPandals();
    renderFoodCats();
    PP.renderTrails();
    PP.renderPlanPicks();
    PP.initPlanForm();
    bindEvents();
    bindKeyUI();
    route();
    window.addEventListener('hashchange', route);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
