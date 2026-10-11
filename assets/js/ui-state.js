/* Pujo Parikrama — UI state + shared renderers. */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit, G = PP.google, esc = PP.esc;

  const DEFAULTS = { day: null, time: '17:00', hours: 6, start: 'first', end: 'open', mode: 'smart', pace: 'balanced', food: 'meals', cravings: [], skipChains: true, fill: true, minRating: 4.0 };
  const S = (PP.S = {
    tab: 'pandals', zone: 'all', q: '', filters: new Set(), sort: 'rec', sel: null,
    plan: Object.assign({ ids: [], foods: [] }, PP.store.get('plan', {})),
    settings: Object.assign({}, DEFAULTS, PP.store.get('settings', {})),
    me: null, pin: null, pickingPin: false,
    food: { q: '', cat: 'all', picks: false, nochain: false, sort: 'map', limit: 50 },
    dFood: { radius: 1, cat: 'all', nochain: false, limit: 30 },
    layers: { pandals: true, food: false, metro: true },
    result: null, liveMap: new Map()
  });
  PP.savePlan = () => PP.store.set('plan', { ids: S.plan.ids, foods: S.plan.foods });
  PP.saveSettings = () => PP.store.set('settings', S.settings);

  /* ---------- planning days ---------- */
  const META = PP.D.meta || { days: [] };
  PP.dayOptions = (() => {
    const named = {};
    META.days.forEach((d) => {
      named[d.date] = d.name;
      if (d.end) named[d.end] = d.name + ' · Bodhon';
    });
    const out = [];
    for (let d = '2026-10-13'; d <= '2026-10-21'; d = PP.addDays(d, 1)) {
      let label = PP.dateLabel(d) + ' — ' + (named[d] || 'pre-Pujo (early openings)');
      if (d >= '2026-10-17' && d <= '2026-10-20') label += ' · all-night Metro';
      out.push({ date: d, label });
    }
    return out;
  })();
  (function pickDefaultDay() {
    const today = PP.istNow().date;
    if (S.settings.day && PP.dayOptions.some((o) => o.date === S.settings.day)) return;
    const next = PP.dayOptions.find((o) => o.date >= today && o.date >= '2026-10-15');
    S.settings.day = next ? next.date : today >= '2026-10-21' ? today : '2026-10-15';
    if (!PP.dayOptions.some((o) => o.date === S.settings.day)) PP.dayOptions.push({ date: S.settings.day, label: PP.dateLabel(S.settings.day) + ' — today' });
  })();

  /* ---------- precomputed per-pandal facts ---------- */
  PP.pandals.forEach((p) => {
    p.tags = p.tags || [];
    p._st = T.nearestStation(p);
    p._nf = PP.food.reduce((n, f) => n + (PP.hav(p, f) <= 0.8 ? 1 : 0), 0);
    p._score = PP.planner.pandalScore(p);
  });

  /* ---------- small renderers ---------- */
  PP.lineDots = (lines) => (lines || []).map((l) => `<span class="metro-dot" style="background:${T.lines.get(l).color}" title="${esc(T.lineName(l))}"></span>`).join('');
  PP.badges = (p) => {
    const b = [];
    if (p.tags.includes('must')) b.push('<span class="badge badge-must">★ Must-see</span>');
    if (p.theme) b.push(`<span class="badge badge-theme">’26 · ${esc(p.theme.t)}</span>`);
    if (p.tags.includes('heritage')) b.push('<span class="badge badge-heritage">Bonedi · heritage</span>');
    if (p.custom) b.push('<span class="badge badge-pick">Your pin</span>');
    b.push(PP.crowdHTML(p.crowd));
    return b.join('');
  };
  PP.shortName = (p) => p.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/ (Sarbojanin|Sarbajanin|Durgotsav|Durgotsab|Durga Puja|Sadharan)\b.*$/i, '').trim();

  PP.pandalCard = (p, i) => {
    const inPlan = S.plan.ids.includes(p.id);
    const st = p._st;
    const dist = S.me ? ` · ${PP.fmtKm(PP.hav(S.me, p))} away` : '';
    return `<div class="p-card ${S.sel === p.id ? 'active' : ''}" data-open="${p.id}">
      <div class="lamp c${p.crowd}" aria-hidden="true">${i + 1}</div>
      <div style="min-width:0">
        <h3><button class="link-reset" data-open="${p.id}">${esc(p.name)}</button></h3>
        <div class="bnname">${esc(p.bn || '')}</div>
        <div class="meta"><span>${esc(p.area)}${dist}</span>${st ? `<span>${PP.lineDots(st.lines)}${esc(st.station.name)} · ${Math.round(st.walkMin)} min</span>` : ''}${p._nf ? `<span>🍽 ${p._nf} nearby</span>` : ''}</div>
        <div class="badges">${PP.badges(p)}</div>
      </div>
      <button class="add-btn ${inPlan ? 'in' : ''}" data-add="${p.id}" aria-pressed="${inPlan}" aria-label="${inPlan ? 'Remove from' : 'Add to'} plan: ${esc(p.name)}" title="${inPlan ? 'In your plan — tap to remove' : 'Add to plan'}">${PP.icon(inPlan ? 'check' : 'plus', 18)}</button>
    </div>`;
  };

  PP.ratingHTML = (f) => {
    const live = S.liveMap.get(f.id);
    if (live && live.rating) return `<span class="rating" title="Live from Google">★ ${live.rating.toFixed(1)} <span class="g-attr">${G.fmtCount(live.count)} reviews · Google</span></span>`;
    return `<button class="rating" type="button" data-embed="${f.id}" aria-expanded="false" title="Show Google's live rating card">${PP.icon('star', 13)} ${f.hub ? 'Live on Google' : 'Google rating'}</button>`;
  };

  PP.foodCard = (f, km) => {
    const cat = PP.CATS[f.cat] || PP.CATS.multi;
    const live = S.liveMap.get(f.id);
    const walkMin = km != null ? Math.max(1, Math.round(((km * 1.3) / 4.2) * 60)) : null;
    const tier = f.tier === 'legend' ? '<span class="badge badge-legend">Legend</span>' : f.tier === 'fave' ? '<span class="badge badge-pick">Pujo pick</span>' : f.chain ? '<span class="badge badge-chain">Chain</span>' : '';
    const sub = [cat.label, PP.price(f.price), f.since ? 'since ' + f.since : '', !f.tier && f.cuisine ? f.cuisine : ''].filter(Boolean);
    const web = (live && live.web) || f.web;
    const inPlan = S.plan.foods.includes(f.id);
    return `<article class="f-card" id="fc-${esc(f.id)}" data-food="${esc(f.id)}">
      <div class="f-head"><div class="f-icon" aria-hidden="true">${cat.icon}</div>
        <div style="min-width:0;flex:1"><h4>${esc(f.name)} ${tier}</h4>
          <div class="f-sub">${km != null ? `<span class="f-dist">${PP.fmtKm(km)} · ${walkMin} min walk</span>` : ''}<span>${esc(sub.join(' · '))}</span>${f.area && !f.tier ? '' : ''}</div>
        </div></div>
      ${f.why ? `<p class="f-why">${esc(f.why)}</p>` : ''}
      ${f.must ? `<div class="f-try"><b>Try:</b> ${esc(f.must.join(', '))}</div>` : ''}
      ${f.hours ? `<div class="f-sub" style="margin-top:6px">🕒 ${esc(f.hours)}</div>` : ''}
      ${f.addr ? `<div class="f-sub" style="margin-top:4px">📍 ${esc(f.addr)}</div>` : f.prec && f.prec !== 'exact' ? `<div class="f-sub" style="margin-top:4px">📍 ${f.hub ? 'Food area' : 'Approximate pin'} · ${esc(f.area || '')} — Google Maps has the exact spot</div>` : ''}
      <div class="f-actions">${PP.ratingHTML(f)}
        <a class="btn btn-ghost btn-xs" href="${esc(PP.gmapsLink(f))}" target="_blank" rel="noopener">${PP.icon('pin', 14)} Maps</a>
        ${f.hub ? '' : `<a class="btn btn-ghost btn-xs" href="${esc(PP.menuLink(f))}" target="_blank" rel="noopener">${PP.icon('menu', 14)} Menu</a>`}
        ${web ? `<a class="btn btn-ghost btn-xs" href="${esc(web)}" target="_blank" rel="noopener">${PP.icon('globe', 14)} Website</a>` : ''}
        <button class="btn btn-ghost btn-xs" type="button" data-addfood="${esc(f.id)}" aria-pressed="${inPlan}">${PP.icon(inPlan ? 'check' : 'plus', 14)} Food stop</button>
      </div>
      <div class="embed-slot"></div>
    </article>`;
  };

  /* Toggle Google's live place card under a food card / timeline item. */
  PP.toggleEmbed = (btn) => {
    const f = PP.foodById.get(btn.dataset.embed);
    const host = btn.closest('.f-card, .tl-card');
    if (!f || !host) return;
    const slot = host.querySelector('.embed-slot');
    if (!slot) return;
    if (slot.firstChild) { slot.innerHTML = ''; btn.setAttribute('aria-expanded', 'false'); return; }
    const src = f.hub ? PP.embedNearby((f.must && f.must[0]) || 'restaurants', f.lat, f.lon, 17) : PP.embedPlace(f);
    slot.innerHTML = `<div class="embed"><iframe src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Maps card for ${esc(f.name)}"></iframe></div>`;
    btn.setAttribute('aria-expanded', 'true');
  };

  PP.modeIcon = (m) => ({ walk: '🚶', metro: '🚇', cab: '🚕' }[m] || '•');
})();
