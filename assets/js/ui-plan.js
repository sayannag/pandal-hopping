/* Pujo Parikrama — "My plan" tab: picks, trails, settings, optimise, timeline, export. */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit, G = PP.google, S = PP.S, MU = PP.mapUI, esc = PP.esc, $ = PP.$;
  const META = PP.D.meta || {};

  PP.renderTrails = function () {
    $('#trails').innerHTML = (META.trails || []).map((t, i) => {
      const n = t.ids.filter((id) => PP.pandalById.has(id)).length;
      return `<button class="trail" type="button" data-trail="${i}"><b>${esc(t.name)}</b><span>${esc(t.desc)} · ${n} pandals</span></button>`;
    }).join('');
  };

  PP.renderPlanPicks = function () {
    const ps = S.plan.ids.map((id) => PP.pandalById.get(id)).filter(Boolean);
    const fs = S.plan.foods.map((id) => PP.foodById.get(id)).filter(Boolean);
    $('#sel-list').innerHTML = ps.map((p) => `<span class="sel-chip">${esc(p.name)}<button type="button" data-rm="${p.id}" aria-label="Remove ${esc(p.name)}">×</button></span>`).join('') +
      fs.map((f) => `<span class="sel-chip food">${(PP.CATS[f.cat] || PP.CATS.multi).icon} ${esc(f.name)}<button type="button" data-rmfood="${esc(f.id)}" aria-label="Remove ${esc(f.name)}">×</button></span>`).join('') ||
      '<span class="muted" style="font-size:13px">Nothing yet — your night is a blank canvas.</span>';
    $('#plan-count').textContent = ps.length ? String(ps.length) : '';
    $('#sel-hint').innerHTML = ps.length ? 'Want a different night? Load a ready-made trail (replaces your picks):' : 'Tap <b>+</b> on any pandal, or start from a ready-made trail:';
  };

  PP.loadTrail = function (i) {
    const t = (META.trails || [])[i];
    if (!t) return;
    S.plan.ids = t.ids.filter((id) => PP.pandalById.has(id));
    PP.savePlan();
    PP.renderPlanPicks();
    PP.renderPandals();
    if (t.hours) { S.settings.hours = t.hours; PP.syncPlanForm(); PP.saveSettings(); }
    PP.toast(`Loaded “${t.name}” — ${S.plan.ids.length} pandals`);
  };

  /* ---------- settings form ---------- */
  function seg(id, key) {
    const el = $('#' + id);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      S.settings[key] = b.dataset.v;
      PP.saveSettings();
      PP.syncPlanForm();
    });
  }
  PP.initPlanForm = function () {
    $('#pl-day').innerHTML = PP.dayOptions.map((o) => `<option value="${o.date}">${esc(o.label)}</option>`).join('');
    const stations = PP.D.metro.stations.filter((s) => (T.servedBy.get(s.id) || new Set()).size).sort((a, b) => a.name.localeCompare(b.name));
    $('#pl-start').innerHTML = '<option value="first">The first pandal on the route</option><option value="me">My current location</option><option value="pin">A point I tap on the map</option>' +
      `<optgroup label="A Metro station">${stations.map((s) => `<option value="st:${s.id}">${esc(s.name)}</option>`).join('')}</optgroup>`;
    $('#pl-cravings').innerHTML = Object.entries(PP.CATS).filter(([k]) => k !== 'multi').map(([k, c]) => `<button class="chip" type="button" data-crave="${k}" aria-pressed="false">${c.icon} ${esc(c.short)}</button>`).join('');
    $('#pl-day').addEventListener('change', (e) => { S.settings.day = e.target.value; PP.saveSettings(); });
    $('#pl-time').addEventListener('change', (e) => { S.settings.time = e.target.value || '17:00'; PP.saveSettings(); });
    $('#pl-hours').addEventListener('input', (e) => { S.settings.hours = Number(e.target.value); $('#pl-hours-out').textContent = S.settings.hours + ' h'; PP.saveSettings(); });
    $('#pl-start').addEventListener('change', (e) => {
      S.settings.start = e.target.value; PP.saveSettings();
      if (S.settings.start === 'pin' && !S.pin) PP.startPinPick();
      if (S.settings.start === 'me' && !S.me) PP.locate(false);
    });
    $('#pl-end').addEventListener('change', (e) => { S.settings.end = e.target.value; PP.saveSettings(); });
    seg('pl-mode', 'mode'); seg('pl-pace', 'pace'); seg('pl-food', 'food');
    $('#pl-cravings').addEventListener('click', (e) => {
      const b = e.target.closest('[data-crave]');
      if (!b) return;
      const k = b.dataset.crave, i = S.settings.cravings.indexOf(k);
      if (i >= 0) S.settings.cravings.splice(i, 1); else S.settings.cravings.push(k);
      PP.saveSettings(); PP.syncPlanForm();
    });
    $('#pl-chains').addEventListener('change', (e) => { S.settings.skipChains = e.target.checked; PP.saveSettings(); });
    $('#pl-fill').addEventListener('change', (e) => { S.settings.fill = e.target.checked; PP.saveSettings(); });
    $('#pl-minrating').addEventListener('input', (e) => { S.settings.minRating = Number(e.target.value); $('#pl-minrating-out').textContent = S.settings.minRating.toFixed(1); PP.saveSettings(); });
    $('#btn-optimise').addEventListener('click', () => PP.runOptimise());
    PP.syncPlanForm();
  };
  PP.syncPlanForm = function () {
    const st = S.settings;
    $('#pl-day').value = st.day;
    $('#pl-time').value = st.time;
    $('#pl-hours').value = st.hours;
    $('#pl-hours-out').textContent = st.hours + ' h';
    if (![...$('#pl-start').options].some((o) => o.value === st.start)) st.start = 'first';
    $('#pl-start').value = st.start;
    $('#pl-end').value = st.end;
    [['pl-mode', 'mode'], ['pl-pace', 'pace'], ['pl-food', 'food']].forEach(([id, k]) => PP.$$('#' + id + ' button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st[k]))));
    PP.$$('#pl-cravings [data-crave]').forEach((b) => b.setAttribute('aria-pressed', String(st.cravings.includes(b.dataset.crave))));
    $('#pl-chains').checked = !!st.skipChains;
    $('#pl-fill').checked = !!st.fill;
    $('#pl-minrating-wrap').hidden = !G.enabled();
    $('#pl-minrating').value = st.minRating;
    $('#pl-minrating-out').textContent = Number(st.minRating).toFixed(1);
  };

  PP.startPinPick = function () {
    S.pickingPin = true;
    document.getElementById('map').style.cursor = 'crosshair';
    if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    PP.toast('Tap the map to set your start point', 4000);
  };

  /* ---------- optimise ---------- */
  async function liveRatingsForPlan() {
    if (!G.enabled() || G.state === 'error') return null;
    const ps = S.plan.ids.map((id) => PP.pandalById.get(id)).filter(Boolean).slice(0, 8);
    try {
      const all = await Promise.all(ps.map((p) => G.nearby(p.lat, p.lon, PP.config.liveRadius)));
      all.forEach((places, i) => {
        const ours = PP.food.filter((f) => PP.hav(ps[i], f) <= 1.5);
        G.match(ours, places).forEach((v, k) => S.liveMap.set(k, v));
      });
    } catch (e) { /* fall back to curated ranking */ }
    return S.liveMap.size ? S.liveMap : null;
  }

  PP.runOptimise = async function () {
    const st = S.settings;
    let start = null;
    if (st.start === 'me') {
      const me = S.me || (await PP.locate(false));
      if (me) start = { name: 'Your location', lat: me.lat, lon: me.lon };
      else PP.toast('Location unavailable — starting at the first pandal instead');
    } else if (st.start === 'pin') {
      if (!S.pin) { PP.startPinPick(); return; }
      start = { name: 'Your start point', lat: S.pin.lat, lon: S.pin.lon };
    } else if (st.start.startsWith('st:')) {
      const s = T.stations.get(st.start.slice(3));
      if (s) start = { name: s.name + ' Metro', lat: s.lat, lon: s.lon };
    }
    const btn = $('#btn-optimise');
    btn.disabled = true;
    btn.innerHTML = PP.icon('spark', 18) + ' Optimising…';
    const ratings = await liveRatingsForPlan();
    await new Promise((r) => setTimeout(r, 30));
    let res;
    try {
      res = PP.optimise({
        ids: S.plan.ids, foodIds: S.plan.foods, date: st.day, startMin: PP.parseHM(st.time), hours: st.hours,
        start, end: st.end, mode: st.mode, pace: st.pace, food: st.food, cravings: st.cravings.slice(),
        skipChains: st.skipChains, fill: st.fill, minRating: st.minRating, ratings
      });
    } catch (e) {
      console.error(e);
      res = { ok: false, error: 'Something went wrong while optimising — try fewer pandals or a different mode.' };
    }
    btn.disabled = false;
    btn.innerHTML = PP.icon('spark', 18) + ' Optimise again';
    S.result = res;
    renderResult(res);
    MU.drawRoute(res);
    if (res.ok) {
      S.plan.ids.forEach((id) => MU.refreshMarker(id));
      $('#plan-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  /* ---------- result ---------- */
  const clock = (t) => `${PP.fmtClock(t)}${t >= 1440 ? '<small>+1 day</small>' : ''}`;
  function renderResult(r) {
    const box = $('#plan-result');
    box.hidden = false;
    if (!r.ok) { box.innerHTML = `<div class="warn">${esc(r.error)}</div>`; return; }
    const sim = r.sim;
    const pandals = sim.items.filter((i) => i.type === 'pandal');
    const foods = sim.items.filter((i) => i.type === 'food');
    let n = 0;
    const rows = sim.items.map((it) => {
      const leg = it.leg ? `<li class="tl-item legrow"><div></div><div class="tl-leg"><span class="mode" aria-hidden="true">${PP.modeIcon(it.leg.mode)}</span><span>${esc(T.describe(it.leg))}</span></div></li>` : '';
      if (it.type === 'start') return `<li class="tl-item start"><div class="tl-time">${clock(it.arrive)}</div><div class="tl-card"><h4>Start · ${esc(it.node.name)}</h4></div></li>`;
      if (it.type === 'end') return leg + `<li class="tl-item end"><div class="tl-time">${clock(it.arrive)}</div><div class="tl-card"><h4>${it.noMetro ? '⚠ ' : 'Finish · '}${esc(it.node.name)}</h4>${it.node.lines ? `<div class="sub">${PP.lineDots(it.node.lines)}${esc(it.node.lines.map((l) => T.lineName(l)).join(' · '))}</div>` : ''}</div></li>`;
      if (it.type === 'pandal') {
        const p = it.node.ref;
        return leg + `<li class="tl-item pandal"><div class="tl-time">${clock(it.arrive)}<small>${PP.fmtDur(it.depart - it.arrive)}</small></div><div class="tl-card">
          <h4><span class="num">${++n}</span>${esc(p.name)}</h4>
          <div class="sub">${it.queue ? `Queue ~${it.queue} min · ` : ''}visit ~${it.dwell} min · ${esc(p.area)}${p.theme ? ' · “' + esc(p.theme.t) + '”' : ''}${r.added.includes(it.node) ? ' · <b style="color:var(--ganga)">auto-added</b>' : ''}${p.tags.includes('heritage') && ((it.arrive % 1440) < 480 || (it.arrive % 1440) > 1320) ? ' · <b style="color:var(--marigold)">may be closed at this hour</b>' : ''}</div>
          <div class="acts"><button class="btn btn-ghost btn-xs" type="button" data-open="${p.id}">${PP.icon('temple', 14)} Details</button><a class="btn btn-ghost btn-xs" href="${esc(PP.dirLink(p))}" target="_blank" rel="noopener">${PP.icon('dir', 14)} Directions</a></div>
        </div></li>`;
      }
      const f = it.node.ref;
      return leg + `<li class="tl-item food"><div class="tl-time">${clock(it.arrive)}<small>${it.dwell} min</small></div><div class="tl-card">
        <h4>${(PP.CATS[f.cat] || PP.CATS.multi).icon} ${esc(it.node.label || 'Your food stop')}: ${esc(f.name)}</h4>
        <div class="sub">${f.must ? 'Try ' + esc(f.must.slice(0, 2).join(', ')) + ' · ' : ''}${esc((PP.CATS[f.cat] || PP.CATS.multi).label)}${it.node.detour > 1 ? ` · +${Math.round(it.node.detour)} min detour` : ''}</div>
        <div class="acts">${PP.ratingHTML(f)}<a class="btn btn-ghost btn-xs" href="${esc(PP.gmapsLink(f))}" target="_blank" rel="noopener">${PP.icon('pin', 14)} Maps</a>${f.hub ? '' : `<a class="btn btn-ghost btn-xs" href="${esc(PP.menuLink(f))}" target="_blank" rel="noopener">${PP.icon('menu', 14)} Menu</a>`}</div>
        <div class="embed-slot"></div></div></li>`;
    }).join('');
    box.innerHTML = `
      <h3>Your parikrama <span class="result-meta">${esc(PP.dateLabel(r.opts.date, { weekday: 'long' }))}</span></h3>
      <div class="summary">
        <div class="sum"><b>${pandals.length}</b><span>pandals</span></div>
        <div class="sum"><b>${foods.length}</b><span>food stops</span></div>
        <div class="sum"><b>${PP.fmtDurShort(sim.total)}</b><span>door to door</span></div>
        <div class="sum"><b>${sim.walkKm.toFixed(1)}</b><span>km walking</span></div>
        <div class="sum"><b>${sim.metroRides}${sim.cabRides ? ' + ' + sim.cabRides : ''}</b><span>${sim.cabRides ? 'Metro + cab rides' : 'Metro rides'}</span></div>
        <div class="sum"><b>${PP.fmtClock(sim.endMin)}</b><span>finish${sim.endMin >= 1440 ? ' (next day)' : ''}</span></div>
      </div>
      ${r.added.length ? `<div class="warn" style="background:rgba(52,214,192,.08);border-color:rgba(52,214,192,.35)">✦ Added ${r.added.length} nearby pandal${r.added.length > 1 ? 's' : ''} that fit your time: ${esc(r.added.map((x) => x.name).join(', '))}.</div>` : ''}
      ${r.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
      <ol class="timeline">${rows}</ol>
      <div class="export-row">
        ${gmapsChunks(r).map((u, i, a) => `<a class="btn btn-ghost btn-sm" href="${esc(u)}" target="_blank" rel="noopener">${PP.icon('ext')} Google Maps route${a.length > 1 ? ` ${i + 1}/${a.length}` : ''}</a>`).join('')}
        <button class="btn btn-ghost btn-sm" type="button" data-plan-copy>${PP.icon('copy')} Copy itinerary</button>
        <button class="btn btn-ghost btn-sm" type="button" data-plan-share>${PP.icon('share')} Share plan</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="window.print()">${PP.icon('print')} Print / PDF</button>
      </div>
      <p class="fine">Estimates only: queues follow a crowd model for the day and hour, walking assumes festival crowds and barricades, and Metro legs use the announced 2026 Puja timetable. Follow police diversions on the ground.</p>`;
  }

  function gmapsChunks(r) {
    const pts = r.sim.items.filter((it) => it.node && it.node.lat != null && !it.noMetro).map((it) => it.node);
    const mode = r.opts.mode === 'cab' ? 'driving' : 'walking';
    const out = [];
    for (let i = 0; i < pts.length - 1; i += 4) {
      const c = pts.slice(i, i + 5);
      if (c.length < 2) break;
      const w = c.slice(1, -1).map((x) => `${x.lat.toFixed(6)},${x.lon.toFixed(6)}`).join('|');
      out.push(`https://www.google.com/maps/dir/?api=1&origin=${c[0].lat.toFixed(6)},${c[0].lon.toFixed(6)}&destination=${c[c.length - 1].lat.toFixed(6)},${c[c.length - 1].lon.toFixed(6)}${w ? '&waypoints=' + encodeURIComponent(w) : ''}&travelmode=${mode}`);
    }
    return out;
  }

  PP.itineraryText = function () {
    const r = S.result;
    if (!r || !r.ok) return '';
    const lines = [`Pujo Parikrama · ${PP.dateLabel(r.opts.date, { weekday: 'long' })}`];
    let n = 0;
    r.sim.items.forEach((it) => {
      if (it.leg) lines.push(`   ↓ ${T.describe(it.leg)}`);
      const t = PP.fmtClock(it.arrive).padEnd(9);
      if (it.type === 'start') lines.push(`${t}Start: ${it.node.name}`);
      else if (it.type === 'pandal') lines.push(`${t}${++n}. ${it.node.name}${it.queue ? ` (queue ~${it.queue} min)` : ''}`);
      else if (it.type === 'food') lines.push(`${t}🍽 ${it.node.label || 'Food stop'}: ${it.node.name}${it.node.ref.must ? ' — try ' + it.node.ref.must.slice(0, 2).join(', ') : ''}`);
      else lines.push(`${t}${it.node.name}`);
    });
    lines.push(`Total ${PP.fmtDur(r.sim.total)} · ${n} pandals · ${r.sim.walkKm.toFixed(1)} km on foot`);
    lines.push(PP.planLink());
    return lines.join('\n');
  };

  /* ---------- share links ---------- */
  const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  PP.planLink = function () {
    const st = S.settings;
    const data = { i: S.plan.ids, f: S.plan.foods, s: { d: st.day, t: st.time, h: st.hours, m: st.mode, p: st.pace, fo: st.food, e: st.end, c: st.cravings, st: st.start.startsWith('st:') ? st.start : 'first', fi: st.fill ? 1 : 0 } };
    return location.origin + location.pathname + '#plan=' + b64(JSON.stringify(data));
  };
  PP.loadSharedPlan = function (code) {
    try {
      const d = JSON.parse(unb64(code));
      S.plan.ids = (d.i || []).filter((id) => PP.pandalById.has(id));
      S.plan.foods = (d.f || []).filter((id) => PP.foodById.has(id));
      const s = d.s || {};
      Object.assign(S.settings, {
        day: s.d || S.settings.day, time: s.t || S.settings.time, hours: s.h || S.settings.hours, mode: s.m || S.settings.mode,
        pace: s.p || S.settings.pace, food: s.fo || S.settings.food, end: s.e || S.settings.end, cravings: s.c || [], start: s.st || 'first', fill: s.fi !== 0
      });
      if (!PP.dayOptions.some((o) => o.date === S.settings.day)) PP.dayOptions.push({ date: S.settings.day, label: PP.dateLabel(S.settings.day) });
      PP.savePlan(); PP.saveSettings();
      return true;
    } catch (e) { return false; }
  };
})();
