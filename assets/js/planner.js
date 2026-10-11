/* Pujo Parikrama — route optimiser.
   1. Order the chosen pandals (nearest-neighbour seeds + 2-opt + Or-opt on a travel-time matrix).
   2. Drop low-value stops if the night overruns the time budget; auto-add nearby pandals if time is left.
   3. Insert food stops at meal times, choosing places by quality, cravings and detour.
   All times are estimates from the transit model (walking, cab, Metro, queues). */
(function () {
  'use strict';
  const PP = window.PP, T = PP.transit;

  const WINDOWS = [
    { kind: 'breakfast', s: 420, e: 570, label: 'Breakfast', dur: 30 },
    { kind: 'meal', s: 750, e: 870, label: 'Lunch', dur: 45 },
    { kind: 'snack', s: 990, e: 1080, label: 'Evening snack', dur: 20 },
    { kind: 'meal', s: 1200, e: 1350, label: 'Dinner', dur: 45 },
    { kind: 'late', s: 1470, e: 1590, label: 'Late-night bite', dur: 25 },
    { kind: 'dawn', s: 1740, e: 1860, label: 'Dawn breakfast', dur: 30 }
  ];
  const PACE_F = { relaxed: 1.2, balanced: 1, marathon: 0.7 };
  const SUIT = {
    meal: { bengali: 12, mughlai: 12, cabin: 6, chinese: 6, multi: 4, street: -2, sweets: -8, cafe: -4 },
    snack: { street: 12, cabin: 10, sweets: 8, cafe: 6, chinese: 0, mughlai: -2, bengali: -4, multi: -4 },
    breakfast: { cafe: 10, sweets: 10, street: 4, cabin: 2, chinese: 0, bengali: -2, mughlai: -6, multi: -2 },
    late: { street: 12, mughlai: 8, chinese: 2, cabin: 2, cafe: -2, sweets: -6, bengali: -8, multi: -6 },
    dawn: { chinese: 10, cafe: 6, sweets: 6, street: 4, cabin: 0, bengali: -6, mughlai: -6, multi: -6 }
  };

  const pandalScore = (p) => {
    const tags = p.tags || [];
    return 10 + (p.crowd || 2) * 4 + (tags.includes('must') ? 30 : 0) + (p.theme ? 8 : 0) + (tags.includes('heritage') ? 5 : 0);
  };
  const nodeFromPandal = (p) => ({ kind: 'pandal', id: p.id, ref: p, lat: p.lat, lon: p.lon, name: p.name, score: pandalScore(p) });
  const nodeFromFood = (f, dur, label, kind) => ({ kind: 'food', id: f.id, ref: f, lat: f.lat, lon: f.lon, name: f.name, dur, label, mealKind: kind, fixed: !label });

  /* ---------- leg cache (30-minute time buckets) ---------- */
  let cache = new Map();
  function legC(a, b, opts, t) {
    const k = a.id + '>' + b.id + '@' + opts.mode + Math.floor(t / 30);
    let v = cache.get(k);
    if (!v) { v = T.leg(a, b, opts.mode, { date: opts.date, t }); cache.set(k, v); }
    return v;
  }

  /* ---------- ordering ---------- */
  function buildMatrix(nodes, start, opts) {
    const t = opts.startMin + 90;
    const m = nodes.map((a) => nodes.map((b) => (a === b ? 0 : legC(a, b, opts, t).min)));
    const s = start ? nodes.map((x) => legC(start, x, opts, opts.startMin).min) : null;
    return { m, s };
  }
  function pathCost(order, M, back) {
    let c = M.s ? M.s[order[0]] : 0;
    for (let i = 0; i < order.length - 1; i++) c += M.m[order[i]][order[i + 1]];
    if (back) c += M.s ? M.s[order[order.length - 1]] : M.m[order[order.length - 1]][order[0]];
    return c;
  }
  function nearestNeighbour(first, n, M) {
    const seen = new Set([first]), order = [first];
    while (order.length < n) {
      const last = order[order.length - 1];
      let bi = -1, bd = Infinity;
      for (let j = 0; j < n; j++) if (!seen.has(j) && M.m[last][j] < bd) { bd = M.m[last][j]; bi = j; }
      seen.add(bi); order.push(bi);
    }
    return order;
  }
  function improve(order, M, back) {
    let best = pathCost(order, M, back), improved = true, iter = 0;
    while (improved && iter++ < 40) {
      improved = false;
      for (let i = 0; i < order.length - 1; i++) {
        for (let k = i + 1; k < order.length; k++) {
          const cand = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
          const c = pathCost(cand, M, back);
          if (c < best - 0.01) { order = cand; best = c; improved = true; }
        }
      }
      for (let i = 0; i < order.length; i++) {
        for (let j = 0; j < order.length; j++) {
          if (i === j) continue;
          const cand = order.slice();
          const [x] = cand.splice(i, 1);
          cand.splice(j, 0, x);
          const c = pathCost(cand, M, back);
          if (c < best - 0.01) { order = cand; best = c; improved = true; }
        }
      }
    }
    return { order, cost: best };
  }
  function seeds(nodes) {
    if (nodes.length <= 6) return nodes.map((_, i) => i);
    const idx = (f) => nodes.reduce((bi, n, i) => (f(n) > f(nodes[bi]) ? i : bi), 0);
    const c = { lat: nodes.reduce((s, n) => s + n.lat, 0) / nodes.length, lon: nodes.reduce((s, n) => s + n.lon, 0) / nodes.length };
    return [...new Set([idx((n) => n.lat), idx((n) => -n.lat), idx((n) => n.lon), idx((n) => -n.lon), idx((n) => PP.hav(n, c))])];
  }
  function orderNodes(nodes, start, opts) {
    if (nodes.length <= 1) return nodes.slice();
    const M = buildMatrix(nodes, start, opts);
    const back = opts.end === 'return';
    const firsts = start ? [M.s.indexOf(Math.min(...M.s))] : seeds(nodes);
    let best = null;
    for (const f of firsts) {
      const r = improve(nearestNeighbour(f, nodes.length, M), M, back);
      if (!best || r.cost < best.cost) best = r;
    }
    return best.order.map((i) => nodes[i]);
  }

  /* ---------- simulation ---------- */
  function simulate(seq, opts) {
    let t = opts.startMin, prev = opts.start || null;
    let walkKm = 0, metroRides = 0, cabRides = 0, queueTot = 0, travelMin = 0;
    const items = [];
    const tally = (lg) => {
      travelMin += lg.min;
      if (lg.mode === 'walk') walkKm += lg.km;
      else if (lg.mode === 'metro') { metroRides++; walkKm += lg.km; }
      else cabRides++;
    };
    if (prev) items.push({ type: 'start', node: prev, arrive: t, depart: t });
    for (const n of seq) {
      let lg = null;
      if (prev) { lg = legC(prev, n, opts, t); t += lg.min; tally(lg); }
      const arrive = t;
      let queue = 0, dwell;
      if (n.kind === 'pandal') { queue = T.queueMin(n.ref, { date: opts.date, t }); dwell = T.visitMin(n.ref, opts.pace); }
      else dwell = n.dur;
      t += queue + dwell;
      queueTot += queue;
      items.push({ type: n.kind, node: n, arrive, depart: t, queue, dwell, leg: lg, from: prev });
      prev = n;
    }
    if (prev && opts.end === 'return') {
      const target = opts.start || seq[0];
      if (target && target !== prev) {
        const lg = legC(prev, target, opts, t); t += lg.min; tally(lg);
        items.push({ type: 'end', node: Object.assign({}, target, { name: 'Back to ' + (opts.start ? opts.start.name : target.name) }), arrive: t, depart: t, leg: lg, from: prev });
      }
    } else if (prev && opts.end === 'metro') {
      const ns = T.nearestOpenStation(prev, opts.date, t);
      if (ns) {
        const node = { id: 'st-' + ns.station.id, kind: 'station', name: ns.station.name + ' Metro', lat: ns.station.lat, lon: ns.station.lon, lines: ns.lines };
        const lg = ns.km > 1.2 && opts.mode !== 'walk' ? T.leg(prev, node, opts.mode === 'metro' ? 'smart' : opts.mode, { date: opts.date, t }) : T.walk(prev, node, { date: opts.date, t });
        t += lg.min; tally(lg);
        items.push({ type: 'end', node, arrive: t, depart: t, leg: lg, from: prev });
      } else {
        items.push({ type: 'end', node: { name: 'No Metro running nearby at this hour — take a cab', lat: prev.lat, lon: prev.lon }, arrive: t, depart: t, noMetro: true });
      }
    }
    return { items, startMin: opts.startMin, endMin: t, total: t - opts.startMin, walkKm, metroRides, cabRides, queueTot, travelMin };
  }
  const itemOf = (sim, node) => sim.items.find((it) => it.node === node);
  const familyOpen = (t) => { const c = ((t % 1440) + 1440) % 1440; return c >= 480 && c <= 1320; };

  /* ---------- fit to the time budget ---------- */
  function fitBudget(seq, opts, budget, protectedIds) {
    const dropped = [];
    let sim = simulate(seq, opts);
    while (sim.total > budget && seq.filter((n) => n.kind === 'pandal').length > 1) {
      let bi = -1, bestRatio = Infinity;
      seq.forEach((n, i) => {
        if (n.kind !== 'pandal') return;
        const it = itemOf(sim, n);
        const nextNode = seq[i + 1];
        const nextIt = nextNode ? itemOf(sim, nextNode) : null;
        const prevNode = i > 0 ? seq[i - 1] : opts.start;
        const inMin = it.leg ? it.leg.min : 0;
        const outMin = nextIt && nextIt.leg ? nextIt.leg.min : 0;
        const bridge = prevNode && nextNode ? legC(prevNode, nextNode, opts, it.arrive - inMin).min : 0;
        const saved = inMin + it.queue + it.dwell + outMin - bridge;
        if (saved <= 0) return;
        // drop the least valuable stop first; time saved only breaks near-ties (keeps famous pandals)
        const key = n.score + (protectedIds.has(n.id) ? 20 : 0) - 0.25 * saved;
        if (key < bestRatio) { bestRatio = key; bi = i; }
      });
      if (bi < 0) break;
      dropped.push(seq[bi]);
      seq = orderNodes(seq.filter((_, i) => i !== bi), opts.start, opts);
      sim = simulate(seq, opts);
    }
    return { seq, sim, dropped };
  }

  /* ---------- auto-add nearby pandals while time allows ---------- */
  function autoFill(seq, opts, budget) {
    const added = [];
    const inSet = new Set(seq.map((n) => n.id));
    const anchors = seq.length ? seq : opts.start ? [opts.start] : [];
    if (!anchors.length) return { seq, added };
    const R = { walk: 1.6, metro: 3.2, smart: 3.6, cab: 4.5 }[opts.mode] || 3;
    let pool = PP.pandals
      .filter((p) => !inSet.has(p.id))
      .map((p) => ({ p, d: Math.min(...anchors.map((a) => PP.hav(a, p))) }))
      .filter((x) => x.d <= R)
      .sort((a, b) => a.d - b.d)
      .slice(0, 30)
      .map((x) => nodeFromPandal(x.p));
    let sim = simulate(seq, opts);
    let guard = 0;
    while (pool.length && guard++ < 30 && seq.filter((n) => n.kind === 'pandal').length < 22) {
      const slack = budget - sim.total;
      if (slack < 15) break;
      let best = null;
      for (const c of pool) {
        const near = seq.map((n, i) => [PP.hav(n, c), i]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);
        const positions = new Set([0, seq.length]);
        near.forEach((i) => { positions.add(i); positions.add(i + 1); });
        for (const pos of positions) {
          const prev = pos === 0 ? opts.start : seq[pos - 1];
          const next = seq[pos] || null;
          const tPrev = pos === 0 ? opts.startMin : itemOf(sim, seq[pos - 1]).depart;
          const lin = prev ? legC(prev, c, opts, tPrev).min : 0;
          if (!prev && next == null) continue;
          const q = T.queueMin(c.ref, { date: opts.date, t: tPrev + lin });
          const dw = T.visitMin(c.ref, opts.pace);
          const lout = next ? legC(c, next, opts, tPrev + lin + q + dw).min : 0;
          const old = prev && next ? legC(prev, next, opts, tPrev).min : 0;
          const delta = lin + q + dw + lout - old;
          if (delta > slack) continue;
          const ratio = c.score / Math.max(delta, 6);
          if (!best || ratio > best.ratio) best = { c, pos, ratio };
        }
      }
      if (!best) break;
      const trial = seq.slice(0, best.pos).concat([best.c], seq.slice(best.pos));
      const s2 = simulate(trial, opts);
      pool = pool.filter((x) => x !== best.c);
      if (s2.total > budget) continue;
      seq = trial; sim = s2; added.push(best.c);
    }
    if (added.length) seq = orderNodes(seq, opts.start, opts);
    return { seq, added };
  }

  /* ---------- food stops ---------- */
  function foodReserve(opts, budget) {
    if (opts.food === 'none') return 0;
    const pf = PACE_F[opts.pace] || 1;
    if (opts.food === '2h') return Math.floor(budget / 120) * 25 * pf;
    const s = opts.startMin, e = s + budget;
    return WINDOWS.reduce((acc, w) => acc + (Math.min(w.e, e - 10) - Math.max(w.s, s + 30) >= 20 ? w.dur * pf : 0), 0);
  }
  function kindAt(t) {
    const c = ((t % 1440) + 1440) % 1440;
    if (c >= 1410 || c < 300) return 'late';
    if (c < 420) return 'dawn';
    if (c < 600) return 'breakfast';
    return 'snack';
  }
  function foodTargets(sim, opts, budget) {
    const s = opts.startMin, e = Math.min(Math.max(sim.endMin, s + 60), s + budget);
    const out = [];
    if (opts.food === '2h') {
      for (let t = s + 120; t < e - 20; t += 120) {
        const w = WINDOWS.find((x) => x.kind === 'meal' && t >= x.s - 30 && t <= x.e);
        const k = w ? 'meal' : kindAt(t);
        out.push({ t, kind: k, label: w ? w.label : k === 'late' ? 'Late-night bite' : 'Snack break', dur: w ? w.dur : 20 });
      }
      return out;
    }
    for (const w of WINDOWS) {
      const a = Math.max(w.s, s + 30), b = Math.min(w.e, e - 10);
      if (b - a >= 20) out.push({ t: a + Math.min(30, (b - a) / 2), kind: w.kind, label: w.label, dur: w.dur });
    }
    return out;
  }
  function pickFood(a, b, used, opts, tg, tAt) {
    const ctx = { date: opts.date, t: tAt };
    const base = b ? legC(a, b, opts, tAt).min : 0;
    let best = null;
    for (const f of PP.food) {
      if (used.has(f.id)) continue;
      if (opts.skipChains && f.chain) continue;
      const da = PP.hav(a, f), db = b ? PP.hav(b, f) : Infinity;
      if (Math.min(da, db) > 0.9) continue;
      if (f.id === 'hub-tiretta' && tg.kind !== 'dawn' && tg.kind !== 'breakfast') continue;
      let q = f.tier === 'legend' ? 34 : f.tier === 'fave' ? 24 : f.chain ? 2 : 10;
      const live = opts.ratings && opts.ratings.get(f.id);
      if (live && live.rating) {
        if (live.rating < opts.minRating) continue;
        q += (live.rating - 4) * 30 + Math.log10((live.count || 0) + 1) * 3;
      }
      if (opts.cravings && opts.cravings.length) q += opts.cravings.includes(f.cat) ? 16 : -14;
      q += (SUIT[tg.kind] || {})[f.cat] || 0;
      const fNode = { id: f.id, lat: f.lat, lon: f.lon };
      const toF = T.walk(a, fNode, ctx).min;
      const fromF = b ? legC(fNode, b, opts, tAt + toF + tg.dur).min : 0;
      const detour = Math.max(0, toF + fromF - base);
      const val = q - 1.5 * detour;
      if (!best || val > best.val) best = { f, val, detour };
    }
    return best;
  }
  function insertFood(seq, opts, budget, maxStops) {
    let sim = simulate(seq, opts);
    if (opts.food === 'none') return { seq, sim, missed: [] };
    const used = new Set(seq.filter((n) => n.kind === 'food').map((n) => n.id));
    const missed = [];
    let added = 0;
    for (const tg of foodTargets(sim, opts, budget)) {
      if (maxStops != null && added >= maxStops) break;
      if (sim.items.some((it) => it.type === 'food' && Math.abs(it.arrive - tg.t) < 75)) continue;
      const stops = sim.items.filter((it) => it.type === 'pandal' || it.type === 'food');
      if (!stops.length) break;
      let idx = stops.findIndex((it) => it.depart >= tg.t);
      if (idx < 0) idx = stops.length - 1;
      const prevNode = stops[idx].node, nextNode = stops[idx + 1] ? stops[idx + 1].node : null;
      const pick = pickFood(prevNode, nextNode, used, opts, tg, stops[idx].depart);
      if (!pick) { missed.push(tg.label); continue; }
      const node = nodeFromFood(pick.f, Math.round(tg.dur * (PACE_F[opts.pace] || 1)), tg.label, tg.kind);
      node.detour = pick.detour;
      const pos = seq.indexOf(prevNode) + 1;
      seq = seq.slice(0, pos).concat([node], seq.slice(pos));
      used.add(pick.f.id);
      added++;
      sim = simulate(seq, opts);
    }
    return { seq, sim, missed };
  }

  /* ---------- main entry ---------- */
  PP.optimise = function (input) {
    cache = new Map();
    const opts = Object.assign({ mode: 'smart', pace: 'balanced', food: 'meals', end: 'open', cravings: [], skipChains: true, fill: true, minRating: 4.0, ids: [], foodIds: [] }, input);
    const budget = Math.round(opts.hours * 60);
    const warnings = [];
    const chosen = opts.ids.map((id) => PP.pandalById.get(id)).filter(Boolean).map(nodeFromPandal);
    const fixedFood = opts.foodIds.map((id) => PP.foodById.get(id)).filter(Boolean).map((f) => nodeFromFood(f, Math.round(35 * (PACE_F[opts.pace] || 1)), null, 'meal'));
    if (opts.start) opts.start = Object.assign({ id: 'start', kind: 'start' }, opts.start);
    if (!chosen.length && !fixedFood.length && !(opts.fill && opts.start)) {
      return { ok: false, error: 'Add at least one pandal (tap + on any card), load a trail, or pick a start point with “Add nearby pandals” switched on.' };
    }
    const protectedIds = new Set(chosen.map((n) => n.id));
    let seq = orderNodes(chosen.concat(fixedFood), opts.start, opts);
    const reserve = foodReserve(opts, budget);

    const fit = fitBudget(seq, opts, Math.max(30, budget - reserve), protectedIds);
    seq = fit.seq;
    let added = [];
    if (opts.fill && !fit.dropped.length) {
      const r = autoFill(seq, opts, budget - reserve);
      seq = r.seq; added = r.added;
    }
    if (!opts.start && opts.end !== 'return' && seq.length > 2) {
      const rev = seq.slice().reverse();
      if (simulate(rev, opts).total < simulate(seq, opts).total - 3) seq = rev; // queue-aware: big pandals at quieter hours
    }

    let fr = insertFood(seq, opts, budget);
    let guard = 0;
    const squeezed = [];
    while (fr.sim.total > budget + 10 && guard++ < 10) {
      const base = fr.seq.filter((n) => !(n.kind === 'food' && !n.fixed));
      const pandalsLeft = base.filter((n) => n.kind === 'pandal');
      if (pandalsLeft.length <= 1) break;
      const autoAdded = pandalsLeft.filter((n) => !protectedIds.has(n.id));
      const pool = autoAdded.length ? autoAdded : pandalsLeft;
      const victim = pool.reduce((a, b) => (b.score < a.score ? b : a));
      squeezed.push(victim);
      fr = insertFood(orderNodes(base.filter((n) => n !== victim), opts.start, opts), opts, budget);
    }
    // use any slack left after food stops to bring back pandals that were cut (most valuable first)
    const cut = fit.dropped.concat(squeezed).filter((n) => protectedIds.has(n.id)).sort((a, b) => b.score - a.score);
    const restored = [];
    for (const n of cut.slice(0, 12)) {
      if (budget - fr.sim.total < 20) break;
      const base = orderNodes(fr.seq.filter((x) => !(x.kind === 'food' && !x.fixed)).concat([n]), opts.start, opts);
      let trial = insertFood(base, opts, budget);
      if (trial.sim.total > budget + 5) {
        // a pandal the user asked for beats a newly triggered meal window
        const autoStops = fr.seq.filter((x) => x.kind === 'food' && !x.fixed).length;
        trial = insertFood(base, opts, budget, autoStops);
      }
      if (trial.sim.total <= budget + 5) { fr = trial; restored.push(n); }
    }
    seq = fr.seq;
    const sim = fr.sim;

    const dropped = fit.dropped.concat(squeezed).filter((n) => protectedIds.has(n.id) && !restored.includes(n));
    const addedFinal = added.filter((n) => seq.includes(n));
    if (dropped.length) warnings.push(`Left out ${dropped.length} of your pandals to fit ${PP.fmtDur(budget)}: ${dropped.map((n) => n.name).join(', ')}. Peak-hour queues are long — add time, start in the afternoon, go after midnight, or split the list over two nights.`);
    const shut = sim.items.filter((it) => it.type === 'pandal' && (it.node.ref.tags || []).includes('heritage') && !familyOpen(it.arrive));
    if (shut.length) warnings.push(`Family (bonedi) pujas usually welcome visitors only from morning till about 10 pm — ${shut.map((it) => it.node.name).join(', ')} may be closed when you arrive. Move them earlier or start sooner.`);
    if (sim.total > budget + 10) warnings.push(`This route needs about ${PP.fmtDur(sim.total)} — more than the ${PP.fmtDur(budget)} you set.`);
    if (fr.missed.length) warnings.push(`No good food stop near the route for: ${fr.missed.join(', ')}. Try the live Google map on any pandal page.`);
    if (['metro', 'smart'].includes(opts.mode)) {
      if (opts.date >= '2026-10-17' && opts.date <= '2026-10-21') warnings.push('Orange Line (Kavi Subhash–Beleghata) is suspended 17–21 Oct; Blue & Green run all night 17–20 Oct.');
      if (opts.date === '2026-10-21') warnings.push('On Dashami the Blue and Green Lines stop around 10:30 pm.');
    }
    const fallbacks = sim.items.filter((it) => it.leg && it.leg.fallback);
    if (fallbacks.length) warnings.push(`No useful Metro link for ${fallbacks.length} long hop${fallbacks.length > 1 ? 's' : ''} (e.g. to ${fallbacks[0].node.name}) — a cab/auto is assumed there.`);
    const pandalNodes = seq.filter((n) => n.kind === 'pandal');
    const farFood = seq.filter((n) => n.kind === 'food' && n.fixed && pandalNodes.length && Math.min(...pandalNodes.map((p) => PP.hav(p, n))) > 3);
    if (farFood.length) warnings.push(`${farFood.map((n) => n.name).join(', ')} ${farFood.length > 1 ? 'are' : 'is'} more than 3 km from your pandals — remove ${farFood.length > 1 ? 'them' : 'it'} from your plan for a tighter route.`);
    const endIt = sim.items[sim.items.length - 1];
    if (endIt && endIt.noMetro) warnings.push('No Metro line is running near your last stop at that hour — plan a cab home.');
    if (sim.items.some((it) => it.type === 'food' && ['late', 'dawn'].includes(it.node.mealKind))) warnings.push('Late-night food: many kitchens close by midnight even during Pujo — tap the ★ Google card to check opening hours.');

    return { ok: true, sim, seq, added: addedFinal, dropped, warnings, opts, budget };
  };

  PP.planner = { simulate, orderNodes, pandalScore, WINDOWS };
})();
