/* Pujo Parikrama — travel-time model: walking, cab and Kolkata Metro (with 2026 Puja hours). */
(function () {
  'use strict';
  const PP = window.PP;
  const M = PP.D.metro || { lines: [], stations: [], schedule: {} };
  const ST = new Map(M.stations.map((s) => [s.id, s]));
  const LINES = new Map(M.lines.map((l) => [l.id, l]));

  /* ---------- network ---------- */
  const adj = new Map();
  const servedBy = new Map();
  const push = (id, e) => { if (!adj.has(id)) adj.set(id, []); adj.get(id).push(e); };
  M.lines.forEach((L) => {
    L.stations.forEach((id) => { if (!servedBy.has(id)) servedBy.set(id, new Set()); servedBy.get(id).add(L.id); });
    for (let i = 0; i < L.stations.length - 1; i++) {
      const a = ST.get(L.stations[i]), b = ST.get(L.stations[i + 1]);
      const min = (PP.hav(a, b) / 34) * 60 + 0.7; // ~34 km/h running speed + dwell
      push(a.id, { to: b.id, line: L.id, min });
      push(b.id, { to: a.id, line: L.id, min });
    }
  });
  const lineName = (id) => (LINES.get(id) || { name: id }).name;

  /* ---------- service hours ---------- */
  function hoursFor(dateStr, line) {
    const p = (M.schedule.periods || []).find((x) => dateStr >= x.from && dateStr <= x.to);
    if (p) {
      const h = p.hours[line];
      return h ? { s: PP.parseHM(h[0]), e: PP.parseHM(h[1]), hw: h[2], puja: true } : null;
    }
    const n = M.schedule.normal && M.schedule.normal[line];
    if (!n) return null;
    let s = PP.parseHM(n[0]);
    if (PP.weekday(dateStr) === 0) s = Math.max(s, 9 * 60); // later start on Sundays
    return { s, e: PP.parseHM(n[1]), hw: n[2], puja: false };
  }
  /* Is `line` running at plan time t (minutes from 00:00 of planDate; may exceed 1440)? */
  function lineOpen(line, planDate, t) {
    const off = Math.floor(t / 1440);
    const date = PP.addDays(planDate, off);
    const clock = t - off * 1440;
    const h = hoursFor(date, line);
    if (h) {
      if (h.e > h.s) { if (clock >= h.s && clock < h.e - 5) return h; }
      else if (clock >= h.s) return h;
    }
    const prev = hoursFor(PP.addDays(date, -1), line);
    if (prev && prev.e < prev.s && clock < prev.e - 5) return prev;
    return null;
  }

  /* ---------- crowd model (0..1) ---------- */
  const DAY_F = { '2026-10-12': 0.3, '2026-10-13': 0.4, '2026-10-14': 0.5, '2026-10-15': 0.6, '2026-10-16': 0.75, '2026-10-17': 0.9, '2026-10-18': 1, '2026-10-19': 1, '2026-10-20': 0.95, '2026-10-21': 0.35 };
  const HOUR_F = [0.85, 0.7, 0.5, 0.35, 0.25, 0.15, 0.15, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.65, 0.75, 0.9, 1, 1, 1, 1, 0.95];
  function crowdAt(planDate, t) {
    const off = Math.floor(t / 1440);
    const date = PP.addDays(planDate, off);
    const clock = t - off * 1440;
    let df = DAY_F[date];
    if (clock < 360 && DAY_F[PP.addDays(date, -1)] != null) df = DAY_F[PP.addDays(date, -1)]; // after midnight = previous night
    if (df == null) df = 0.25;
    return df * HOUR_F[Math.floor(clock / 60) % 24];
  }

  /* ---------- modes ---------- */
  function walk(a, b, ctx) {
    const km = PP.hav(a, b) * 1.3; // street detour factor
    const cr = crowdAt(ctx.date, ctx.t);
    const speed = cr > 0.6 ? 3.4 : cr > 0.35 ? 3.9 : 4.4; // km/h, slower in festival crowds
    return { mode: 'walk', km, min: (km / speed) * 60 };
  }
  function cab(a, b, ctx) {
    const km = PP.hav(a, b) * 1.4;
    const cr = crowdAt(ctx.date, ctx.t);
    const speed = cr > 0.6 ? 10 : cr > 0.35 ? 14 : 19;
    const overhead = 6 + (cr > 0.6 ? 10 : cr > 0.35 ? 5 : 0); // finding a ride + walking around no-entry zones
    return { mode: 'cab', km, min: overhead + (km / speed) * 60, overhead };
  }

  function stationsNear(p, k, maxKm) {
    const out = [];
    for (const s of M.stations) {
      if (!servedBy.has(s.id)) continue;
      const km = PP.hav(p, s);
      if (km <= maxKm) out.push({ s, km });
    }
    return out.sort((x, y) => x.km - y.km).slice(0, k);
  }

  const djCache = new Map();
  function dijkstra(fromId, open, crowded) {
    const key = fromId + '|' + [...open].sort().join(',') + '|' + (crowded ? 1 : 0);
    if (djCache.has(key)) return djCache.get(key);
    const dist = new Map(), prev = new Map(), pq = [];
    const transfer = crowded ? 9 : 5;
    for (const l of servedBy.get(fromId) || []) if (open.has(l)) { const k = fromId + '|' + l; dist.set(k, 0); pq.push([0, k]); }
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0]);
      const [d, k] = pq.shift();
      if (d > dist.get(k)) continue;
      const [id, line] = k.split('|');
      for (const e of adj.get(id) || []) {
        if (e.line !== line) continue;
        const nk = e.to + '|' + line, nd = d + e.min;
        if (nd < (dist.has(nk) ? dist.get(nk) : Infinity)) { dist.set(nk, nd); prev.set(nk, k); pq.push([nd, nk]); }
      }
      for (const l2 of servedBy.get(id) || []) {
        if (l2 === line || !open.has(l2)) continue;
        const nk = id + '|' + l2, nd = d + transfer;
        if (nd < (dist.has(nk) ? dist.get(nk) : Infinity)) { dist.set(nk, nd); prev.set(nk, k); pq.push([nd, nk]); }
      }
    }
    const res = { dist, prev };
    djCache.set(key, res);
    return res;
  }

  function metro(a, b, ctx) {
    const cr = crowdAt(ctx.date, ctx.t);
    const crowded = cr > 0.6;
    const O = stationsNear(a, 4, 3.0), Dn = stationsNear(b, 4, 3.0);
    if (!O.length || !Dn.length) return null;
    let best = null;
    for (const o of O) {
      const wA = walk(a, o.s, ctx);
      const tBoard = ctx.t + wA.min;
      const open = new Set(M.lines.filter((L) => lineOpen(L.id, ctx.date, tBoard + 4)).map((L) => L.id));
      if (![...(servedBy.get(o.s.id) || [])].some((l) => open.has(l))) continue;
      const res = dijkstra(o.s.id, open, crowded);
      for (const dn of Dn) {
        if (dn.s.id === o.s.id) continue;
        let bestK = null, bestD = Infinity;
        for (const l of servedBy.get(dn.s.id) || []) {
          const d = res.dist.get(dn.s.id + '|' + l);
          if (d != null && d < bestD) { bestD = d; bestK = dn.s.id + '|' + l; }
        }
        if (!bestK) continue;
        const chain = [];
        for (let k = bestK; k; k = res.prev.get(k)) chain.unshift(k);
        const firstLine = chain[0].split('|')[1];
        const h = lineOpen(firstLine, ctx.date, tBoard + 4);
        const wait = (h ? h.hw : 8) / 2;
        const entry = crowded ? 10 : cr > 0.35 ? 6 : 4;
        const exit = crowded ? 5 : 3;
        const wB = walk(dn.s, b, { date: ctx.date, t: tBoard + bestD + entry + wait });
        const total = wA.min + entry + wait + bestD + exit + wB.min;
        if (!best || total < best.min) {
          const segs = [];
          let cur = null;
          chain.forEach((ck) => {
            const [sid, l] = ck.split('|');
            if (!cur || cur.line !== l) { cur = { line: l, ids: [sid] }; segs.push(cur); } else cur.ids.push(sid);
          });
          best = {
            mode: 'metro', min: total, km: wA.km + wB.km, walkA: wA.min, walkB: wB.min, rideMin: bestD,
            from: o.s, to: dn.s,
            segs: segs.filter((s) => s.ids.length > 1).map((s) => ({ line: s.line, from: ST.get(s.ids[0]), to: ST.get(s.ids[s.ids.length - 1]), stops: s.ids.length - 1, path: s.ids.map((id) => ST.get(id)) }))
          };
        }
      }
    }
    return best;
  }

  /* Pick the best way to get from a to b under a travel policy. */
  function leg(a, b, mode, ctx) {
    const w = walk(a, b, ctx);
    if (mode === 'walk' || w.km < 0.45) return w;
    let best = w;
    if (mode === 'metro' || mode === 'smart') {
      const m = metro(a, b, ctx);
      if (m && m.segs.length && m.min < best.min - 4) best = m;
    }
    if ((mode === 'cab' || mode === 'smart') && w.km > 0.9) {
      const c = cab(a, b, ctx);
      const penalty = mode === 'smart' ? (w.km < 2 ? 10 : 6) : 0; // smart mode: cabs are scarce near pandals, so prefer walking/Metro for short hops
      if (c.min + penalty < best.min) best = c;
    }
    if (mode === 'metro' && best.mode === 'walk' && w.km > 3.5) {
      const c = cab(a, b, ctx); // no useful Metro link: don't make people walk for hours
      if (c.min < best.min) { best = c; best.fallback = true; }
    }
    return best;
  }

  /* ---------- time at a pandal ---------- */
  const QBASE = [0, 1, 3, 10, 25, 50]; // peak-hour queue minutes by crowd level
  const queueMin = (p, ctx) => Math.round((QBASE[p.crowd || 2] * crowdAt(ctx.date, ctx.t)) / 5) * 5;
  const visitMin = (p, pace) => ({ relaxed: 20, balanced: 12, marathon: 7 }[pace] || 12) + ((p.tags || []).includes('heritage') && pace !== 'marathon' ? 5 : 0);

  /* ---------- text & geometry ---------- */
  function describe(l) {
    if (!l) return '';
    if (l.mode === 'walk') return `Walk ${PP.fmtKm(l.km)} · ${PP.fmtDur(l.min)}`;
    if (l.mode === 'cab') return `Cab/auto ~${PP.fmtDur(l.min)} · ${PP.fmtKm(l.km)} (incl. ~${Math.round(l.overhead)} min to find a ride & skirt barricades)`;
    const rides = l.segs.map((s) => `${lineName(s.line)}: ${s.from.name} → ${s.to.name} (${s.stops} stop${s.stops > 1 ? 's' : ''})`).join(', then ');
    return `Walk ${Math.round(l.walkA)} min → ${rides} → walk ${Math.round(l.walkB)} min · ${PP.fmtDur(l.min)} door to door`;
  }
  function legParts(a, b, l) {
    if (!l || l.mode !== 'metro') return [{ kind: l ? l.mode : 'walk', pts: [[a.lat, a.lon], [b.lat, b.lon]] }];
    const parts = [{ kind: 'walk', pts: [[a.lat, a.lon], [l.from.lat, l.from.lon]] }];
    l.segs.forEach((s) => parts.push({ kind: 'metro', line: s.line, pts: s.path.map((x) => [x.lat, x.lon]) }));
    parts.push({ kind: 'walk', pts: [[l.to.lat, l.to.lon], [b.lat, b.lon]] });
    return parts;
  }

  /* Nearest station for display (walking estimate at an ordinary pace). */
  function nearestStation(p) {
    const x = stationsNear(p, 1, 99)[0];
    if (!x) return null;
    return { station: x.s, km: x.km, walkMin: ((x.km * 1.3) / 4.2) * 60, lines: [...servedBy.get(x.s.id)] };
  }
  /* Nearest station with a line running at time t (for "finish at a Metro"). */
  function nearestOpenStation(p, date, t) {
    for (const x of stationsNear(p, 60, 8)) {
      const lines = [...servedBy.get(x.s.id)].filter((l) => lineOpen(l, date, t + ((x.km * 1.3) / 3.8) * 60));
      if (lines.length) return { station: x.s, km: x.km, lines };
    }
    return null;
  }

  PP.transit = { hoursFor, lineOpen, crowdAt, walk, cab, metro, leg, queueMin, visitMin, describe, legParts, nearestStation, nearestOpenStation, stationsNear, lineName, lines: LINES, stations: ST, servedBy };
})();
