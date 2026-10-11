/* Pujo Parikrama — pandal browser, pandal detail (with nearby food + live Google). */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit, G = PP.google, S = PP.S, MU = PP.mapUI, esc = PP.esc, $ = PP.$;

  const FILTERS = [
    ['must', '★ Must-see'],
    ['theme', '2026 theme out'],
    ['heritage', 'Heritage & traditional'],
    ['metro', '≤ 10 min from Metro'],
    ['calm', 'Shorter queues']
  ];

  PP.visiblePandals = function () {
    const q = PP.norm(S.q);
    let list = PP.pandals.filter((p) => (S.zone === 'all' || p.zone === S.zone) && (!q || q.split(' ').every((w) => p._s.includes(w))));
    if (S.filters.has('must')) list = list.filter((p) => p.tags.includes('must'));
    if (S.filters.has('theme')) list = list.filter((p) => p.theme);
    if (S.filters.has('heritage')) list = list.filter((p) => p.tags.includes('heritage') || p.tags.includes('traditional'));
    if (S.filters.has('metro')) list = list.filter((p) => p._st && p._st.walkMin <= 10);
    if (S.filters.has('calm')) list = list.filter((p) => p.crowd <= 3);
    const by = {
      rec: (a, b) => b._score - a._score || a.name.localeCompare(b.name),
      near: (a, b) => (S.me ? PP.hav(S.me, a) - PP.hav(S.me, b) : 0) || b._score - a._score,
      calm: (a, b) => a.crowd - b.crowd || b._score - a._score,
      az: (a, b) => a.name.localeCompare(b.name)
    };
    return list.sort(by[S.sort] || by.rec);
  };

  PP.renderZoneChips = function () {
    const counts = {};
    PP.pandals.forEach((p) => { counts[p.zone] = (counts[p.zone] || 0) + 1; });
    const chips = [['all', 'All', PP.pandals.length]].concat(Object.entries(PP.ZONES).map(([k, z]) => [k, z.label, counts[k] || 0]));
    $('#zone-chips').innerHTML = chips.map(([k, l, n]) => `<button class="chip" type="button" data-zone="${k}" aria-pressed="${S.zone === k}">${esc(l)} <span class="dim">${n}</span></button>`).join('');
    $('#filter-chips').innerHTML = FILTERS.map(([k, l]) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${S.filters.has(k)}">${esc(l)}</button>`).join('');
  };

  PP.renderPandals = function () {
    const list = PP.visiblePandals();
    $('#pandal-meta').textContent = `${list.length} pandal${list.length === 1 ? '' : 's'}${S.zone !== 'all' ? ' in ' + PP.ZONES[S.zone].long : ''}`;
    $('#pandal-list').innerHTML = list.length
      ? list.map((p, i) => PP.pandalCard(p, i)).join('')
      : '<div class="empty"><b>No pandals match</b>Try another area or clear a filter.</div>';
    MU.drawPandals(list);
  };

  PP.refreshPlanMarks = function (id) {
    PP.$$(`[data-add="${id}"]`).forEach((b) => {
      const inPlan = S.plan.ids.includes(id);
      b.classList.toggle('in', inPlan);
      b.setAttribute('aria-pressed', String(inPlan));
      if (b.classList.contains('add-btn')) b.innerHTML = PP.icon(inPlan ? 'check' : 'plus', 18);
      else b.innerHTML = inPlan ? PP.icon('check') + ' In your plan' : PP.icon('plus') + ' Add to plan';
    });
    MU.refreshMarker(id);
  };

  PP.togglePlan = function (id) {
    const i = S.plan.ids.indexOf(id);
    if (i >= 0) S.plan.ids.splice(i, 1); else S.plan.ids.push(id);
    PP.savePlan();
    PP.refreshPlanMarks(id);
    PP.renderPlanPicks();
    const p = PP.pandalById.get(id);
    PP.toast(i >= 0 ? `Removed ${p.name}` : `Added ${p.name} · ${S.plan.ids.length} in plan`);
  };
  PP.toggleFoodStop = function (id) {
    const i = S.plan.foods.indexOf(id);
    if (i >= 0) S.plan.foods.splice(i, 1); else S.plan.foods.push(id);
    PP.savePlan();
    PP.$$(`[data-addfood="${CSS.escape(id)}"]`).forEach((b) => {
      const on = S.plan.foods.includes(id);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = PP.icon(on ? 'check' : 'plus', 14) + ' Food stop';
    });
    PP.renderPlanPicks();
    const f = PP.foodById.get(id);
    PP.toast(i >= 0 ? `Removed food stop: ${f.name}` : `Food stop added: ${f.name}`);
  };

  /* ---------- detail ---------- */
  PP.openPandal = function (id, o) {
    o = o || {};
    const p = PP.pandalById.get(id);
    if (!p) return;
    const prev = S.sel;
    S.sel = id;
    if (prev && prev !== id) MU.refreshMarker(prev);
    MU.refreshMarker(id);
    if (!o.keepTab) PP.switchTab('pandals');
    if (S.tab === 'pandals') {
      renderDetail(p);
      $('#pandal-browse').hidden = true;
      $('#pandal-detail').hidden = false;
      $('#panel-body').scrollTop = 0;
    }
    if (o.fly === false) MU.map.panTo([p.lat, p.lon]);
    else MU.map.flyTo([p.lat, p.lon], Math.max(MU.map.getZoom(), 15), { duration: 0.6 });
    history.replaceState(null, '', '#p=' + id);
    if (G.enabled() && G.state !== 'error' && S.tab === 'pandals') loadLive(p);
  };

  PP.closeDetail = function () {
    const prev = S.sel;
    S.sel = null;
    if (prev) MU.refreshMarker(prev);
    $('#pandal-detail').hidden = true;
    $('#pandal-detail').innerHTML = '';
    $('#pandal-browse').hidden = false;
    MU.layers.near.clearLayers();
    if (location.hash.startsWith('#p=')) history.replaceState(null, '', location.pathname + location.search);
    const card = document.querySelector(`.p-card[data-open="${prev}"]`);
    PP.$$('.p-card.active').forEach((c) => c.classList.remove('active'));
    if (card) { card.classList.add('active'); card.scrollIntoView({ block: 'nearest' }); }
  };

  function queueNow(p) {
    const day = S.settings.day, now = PP.istNow();
    const t = now.date === day ? now.min : 20 * 60;
    const q = T.queueMin(p, { date: day, t });
    return `${now.date === day ? 'Right now' : 'At 8 pm ' + PP.dateLabel(day)}: queue ~${q} min`;
  }

  function renderDetail(p) {
    const st = p._st, inPlan = S.plan.ids.includes(p.id), z = PP.ZONES[p.zone];
    const themeBox = p.theme
      ? `<div class="theme-box"><div class="label">2026 theme</div><div class="t">“${esc(p.theme.t)}”</div><p>${esc(p.theme.d)}</p></div>`
      : p.tags.includes('must') ? '<div class="theme-box"><div class="label">2026 theme</div><p>Not announced yet — the big reveals usually come around Panchami.</p></div>' : '';
    $('#pandal-detail').innerHTML = `
      <div class="detail-top"><button class="back" type="button" data-back>${PP.icon('back', 16)} All pandals</button></div>
      <div class="detail-hero">
        <div class="zone">${esc(z.long)} · ${esc(p.area)}${p.custom ? ' · added by you' : ''}</div>
        <h2>${esc(p.name)}</h2><div class="bnname">${esc(p.bn || '')}</div>
        <div class="badges">${PP.badges(p)}</div>
      </div>
      ${themeBox}
      <div class="facts">
        <div class="fact"><div class="k">Nearest Metro</div><div class="v">${st ? PP.lineDots(st.lines) + esc(st.station.name) : '—'}</div><div class="s">${st ? `${PP.fmtKm(st.km)} · ~${Math.round(st.walkMin)} min walk` : ''}</div></div>
        <div class="fact"><div class="k">Crowd</div><div class="v">${PP.crowdHTML(p.crowd)}</div><div class="s">${esc(PP.crowdText(p.crowd))}</div></div>
        <div class="fact"><div class="k">Best time</div><div class="v">${esc(PP.bestTime(p.crowd))}</div><div class="s">${esc(queueNow(p))}</div></div>
        <div class="fact"><div class="k">${p.since ? 'Since' : 'Pin accuracy'}</div><div class="v">${p.since ? p.since : esc(PP.PREC[p.prec] || '')}</div><div class="s">${p.since ? esc(PP.PREC[p.prec] || '') : 'Use Directions for the exact gate'}</div></div>
      </div>
      <p class="note">${esc(p.note || '')}</p>
      <div class="detail-actions">
        <button class="btn btn-primary btn-sm" type="button" data-add="${p.id}">${inPlan ? PP.icon('check') + ' In your plan' : PP.icon('plus') + ' Add to plan'}</button>
        <a class="btn btn-ghost btn-sm" href="${esc(PP.dirLink(p))}" target="_blank" rel="noopener">${PP.icon('dir')} Directions</a>
        <a class="btn btn-ghost btn-sm" href="${esc(PP.gmapsLink(p))}" target="_blank" rel="noopener">${PP.icon('pin')} Google Maps</a>
        ${p.custom ? `<button class="btn btn-ghost btn-sm" type="button" data-rm-custom="${p.id}">${PP.icon('x')} Remove</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-share-pandal="${p.id}">${PP.icon('share')} Share</button>`}
      </div>
      <div class="sub-head"><h3>Food near ${esc(PP.shortName(p))}</h3><span class="result-meta" id="dfood-meta"></span></div>
      <div class="food-controls">
        <div class="row between">
          <div class="seg" id="dfood-radius" role="group" aria-label="Distance">${[[0.5, '500 m'], [1, '1 km'], [2, '2 km']].map(([v, l]) => `<button type="button" data-radius="${v}" aria-pressed="${S.dFood.radius === v}">${l}</button>`).join('')}</div>
          <label class="check" style="font-size:12.5px"><input type="checkbox" id="dfood-nochain" ${S.dFood.nochain ? 'checked' : ''}> Hide chains</label>
        </div>
        <div class="chip-row scroll" id="dfood-cats"></div>
      </div>
      <div id="live-block"></div>
      <div class="f-list" id="dfood-list"></div>
      <div class="sub-head"><h3>Every restaurant around · live on Google</h3></div>
      <div class="gmap-box">
        <p>Google's own map around this pandal — tap any pin for its star rating, reviews, photos, hours and menu.</p>
        <div class="chip-row" id="gmap-q">${['Restaurants', 'Biryani', 'Sweet shop', 'Street food', 'Cafe', 'Chinese restaurant'].map((q, i) => `<button class="chip" type="button" data-gq="${q}" aria-pressed="${i === 0}">${q}</button>`).join('')}</div>
        <div class="embed tall" style="margin-top:10px"><iframe id="gmap-embed" src="${esc(PP.embedNearby('Restaurants', p.lat, p.lon, 17))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Live Google map of restaurants near ${esc(p.name)}"></iframe></div>
      </div>
      <div style="height:20px"></div>`;
    renderDetailFood(p);
  }

  function nearFood(p) {
    const r = S.dFood.radius;
    return PP.food
      .map((f) => ({ f, km: PP.hav(p, f) }))
      .filter((x) => x.km <= r && (!S.dFood.nochain || !x.f.chain));
  }
  const rank = (x) => {
    const live = S.liveMap.get(x.f.id);
    const base = x.f.tier === 'legend' ? 30 : x.f.tier === 'fave' ? 20 : x.f.chain ? 0 : 8;
    return base - x.km * 8 + (live && live.rating ? (live.rating - 4) * 12 : 0);
  };

  function renderDetailFood(p) {
    const all = nearFood(p);
    const counts = {};
    all.forEach((x) => { counts[x.f.cat] = (counts[x.f.cat] || 0) + 1; });
    if (S.dFood.cat !== 'all' && !counts[S.dFood.cat]) S.dFood.cat = 'all';
    const cats = $('#dfood-cats');
    if (cats) cats.innerHTML = [['all', 'All', all.length]].concat(Object.keys(PP.CATS).filter((k) => counts[k]).map((k) => [k, PP.CATS[k].icon + ' ' + PP.CATS[k].short, counts[k]]))
      .map(([k, l, n]) => `<button class="chip" type="button" data-dcat="${k}" aria-pressed="${S.dFood.cat === k}">${l} <span class="dim">${n}</span></button>`).join('');
    const list = all.filter((x) => S.dFood.cat === 'all' || x.f.cat === S.dFood.cat).sort((a, b) => rank(b) - rank(a));
    const shown = list.slice(0, S.dFood.limit);
    const meta = $('#dfood-meta');
    if (meta) meta.textContent = `${list.length} within ${PP.fmtKm(S.dFood.radius)}`;
    const box = $('#dfood-list');
    if (box) {
      box.innerHTML = shown.length
        ? shown.map((x) => PP.foodCard(x.f, x.km)).join('') + (list.length > shown.length ? `<button class="btn btn-ghost btn-sm btn-block" type="button" data-more-dfood>Show ${Math.min(30, list.length - shown.length)} more</button>` : '')
        : `<div class="empty"><b>No listed spots in this radius</b>Widen the radius, or use the live Google map below — it shows every restaurant around.</div>`;
    }
    MU.drawNear(list);
  }
  PP.renderDetailFood = () => { const p = PP.pandalById.get(S.sel); if (p) renderDetailFood(p); };

  async function loadLive(p) {
    const box = $('#live-block');
    if (!box) return;
    box.innerHTML = '<div class="sub-head" style="margin-top:0"><h3>Top rated nearby</h3><span class="badge badge-live">Live · Google</span></div><div class="live-list"><div class="empty">Fetching live ratings…</div></div>';
    try {
      const places = await G.nearby(p.lat, p.lon, PP.config.liveRadius);
      if (S.sel !== p.id || !$('#live-block')) return;
      const ours = PP.food.filter((f) => PP.hav(p, f) <= 1.5);
      G.match(ours, places).forEach((v, k) => S.liveMap.set(k, v));
      const bay = (x) => (x.rating * x.count + 4.1 * 80) / (x.count + 80);
      const top = places.filter((x) => x.rating && x.count).sort((a, b) => bay(b) - bay(a)).slice(0, 10);
      $('#live-block').innerHTML = `<div class="sub-head" style="margin-top:0"><h3>Top rated within ${PP.fmtKm(PP.config.liveRadius / 1000)}</h3><span class="badge badge-live">Live · Google</span></div>
        <div class="live-list">${top.length ? top.map(liveItem).join('') : '<div class="empty">Google returned no rated places here.</div>'}
        <div class="g-attr" style="text-align:right">Ratings, hours &amp; links: Google Maps</div></div>`;
      renderDetailFood(p);
    } catch (e) {
      const b = $('#live-block');
      if (b) b.innerHTML = `<div class="warn" style="margin:0 14px 10px">Live Google ratings unavailable: ${esc(G.error || e.message)}</div>`;
    }
  }
  function liveItem(x) {
    const open = x.openNow === true ? ' · <b style="color:var(--leaf)">Open now</b>' : x.openNow === false ? ' · Closed now' : '';
    return `<div class="live-item"><div class="top"><h5>${esc(x.name)}</h5><span class="rating">★ ${x.rating.toFixed(1)} <span class="g-attr">${PP.google.fmtCount(x.count)}</span></span></div>
      <div class="sub">${esc(x.type || 'Food')} · ${PP.fmtKm(x.km)}${x.price ? ' · ' + PP.price(x.price) : ''}${open}</div>
      <div class="acts">${x.maps ? `<a class="btn btn-ghost btn-xs" href="${esc(x.maps)}" target="_blank" rel="noopener">${PP.icon('pin', 14)} Google Maps</a>` : ''}
      ${x.web ? `<a class="btn btn-ghost btn-xs" href="${esc(x.web)}" target="_blank" rel="noopener">${PP.icon('globe', 14)} Website</a>` : ''}
      <a class="btn btn-ghost btn-xs" href="${esc(PP.menuLink({ name: x.name, area: '' }))}" target="_blank" rel="noopener">${PP.icon('menu', 14)} Menu</a></div></div>`;
  }

  /* Map food pin → scroll its card into view (or show a popup with its details). */
  PP.focusFood = function (id) {
    const card = document.getElementById('fc-' + id);
    PP.$$('.f-card.highlight').forEach((c) => c.classList.remove('highlight'));
    if (card && card.offsetParent !== null) {
      card.classList.add('highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const f = PP.foodById.get(id);
    if (!f) return;
    L.popup({ maxWidth: 300 }).setLatLng([f.lat, f.lon]).setContent(`<b>${esc(f.name)}</b><br>${esc((PP.CATS[f.cat] || PP.CATS.multi).label)}${f.why ? '<br>' + esc(f.why) : ''}<br><a href="${esc(PP.gmapsLink(f))}" target="_blank" rel="noopener">Google Maps (rating, menu) ↗</a>`).openOn(MU.map);
  };
})();
