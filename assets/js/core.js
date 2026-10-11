/* Pujo Parikrama — core helpers shared by every module. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const D = (PP.D = window.PP_DATA || {});
  PP.config = Object.assign({ googleMapsApiKey: '', liveRadius: 800 }, window.PP_CONFIG || {});
  PP.config.tiles = Object.assign({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
    darkFilter: true
  }, PP.config.tiles || {});

  /* ---------- DOM ---------- */
  PP.$ = (sel, root) => (root || document).querySelector(sel);
  PP.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PP.icon = (id, size) => `<svg width="${size || 16}" height="${size || 16}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  PP.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  let toastTimer;
  PP.toast = (msg, ms) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
  };

  /* ---------- storage ---------- */
  PP.store = {
    get(k, def) { try { const v = localStorage.getItem('pp.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { if (v == null) localStorage.removeItem('pp.' + k); else localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ---------- geo ---------- */
  const R = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  PP.hav = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  };
  PP.fmtKm = (km) => (km < 1 ? Math.max(10, Math.round((km * 1000) / 10) * 10) + ' m' : (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km');
  PP.fmtDur = (min) => {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  };
  PP.fmtDurShort = (min) => {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + 'm';
    const h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? String(m).padStart(2, '0') : '');
  };

  /* ---------- time (all plan times are IST minutes from midnight of the plan day) ---------- */
  PP.parseHM = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  PP.fmtClock = (t) => {
    const day = Math.floor(t / 1440);
    let m = Math.round(t - day * 1440);
    if (m >= 1440) m -= 1440;
    let h = Math.floor(m / 60), mm = m % 60;
    const ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
  };
  PP.addDays = (dateStr, n) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  PP.istNow = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const g = (t) => parts.find((p) => p.type === t).value;
    return { date: `${g('year')}-${g('month')}-${g('day')}`, min: Number(g('hour')) * 60 + Number(g('minute')), ts: now.getTime() };
  };
  PP.dateLabel = (dateStr, opts) => new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-IN', Object.assign({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }, opts || {}));
  PP.weekday = (dateStr) => new Date(dateStr + 'T12:00:00Z').getUTCDay();

  /* ---------- taxonomy ---------- */
  PP.ZONES = {
    north: { label: 'North', long: 'North Kolkata' },
    central: { label: 'Central', long: 'Central Kolkata' },
    south: { label: 'South', long: 'South Kolkata' },
    southeast: { label: 'Kasba–Jadavpur', long: 'Kasba, Jadavpur & Garia' },
    behala: { label: 'Behala', long: 'Behala & South-West' },
    east: { label: 'Salt Lake & East', long: 'Salt Lake & East' },
    dumdum: { label: 'Lake Town–Dum Dum', long: 'Lake Town & Dum Dum' }
  };
  PP.CATS = {
    bengali: { label: 'Bengali meals', short: 'Bengali', icon: '🍛' },
    mughlai: { label: 'Biryani & Mughlai', short: 'Biryani', icon: '🍗' },
    cabin: { label: 'Cabins & cutlets', short: 'Cabins', icon: '🥩' },
    street: { label: 'Rolls & street food', short: 'Street', icon: '🌯' },
    sweets: { label: 'Mishti & sweets', short: 'Mishti', icon: '🍮' },
    cafe: { label: 'Cafés & bakes', short: 'Cafés', icon: '☕' },
    chinese: { label: 'Chinese & Asian', short: 'Chinese', icon: '🥢' },
    multi: { label: 'Multi-cuisine & more', short: 'Multi', icon: '🍽️' }
  };
  PP.PREC = {
    exact: 'Exact venue (OpenStreetMap)',
    street: 'Approximate — street level',
    area: 'Approximate — neighbourhood'
  };
  PP.crowdText = (c) => ({
    5: 'Mega crowds — 30–90 min queues at peak',
    4: 'Very busy — 15–40 min queues at peak',
    3: 'Busy evenings — short queues',
    2: 'Comfortable — little or no queue',
    1: 'Calm'
  })[c] || '';
  PP.bestTime = (c) => ({
    5: 'Before noon, or after 2 am',
    4: 'Afternoons, or after midnight',
    3: 'Early evening is lovely',
    2: 'Any time',
    1: 'Any time'
  })[c] || 'Any time';
  PP.crowdHTML = (c) => '<span class="crowd" title="' + PP.esc(PP.crowdText(c)) + '">' + [1, 2, 3, 4, 5].map((i) => `<i class="${i <= c ? 'on' : ''}"></i>`).join('') + '</span>';
  PP.price = (p) => (p ? '₹'.repeat(p) : '');

  /* ---------- indexes ---------- */
  PP.pandals = D.pandals || [];
  PP.food = D.food || [];
  PP.pandalById = new Map(PP.pandals.map((p) => [p.id, p]));
  PP.foodById = new Map(PP.food.map((f) => [f.id, f]));
  PP.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0980-\u09ff ]+/g, ' ').replace(/\s+/g, ' ').trim();
  PP.pandals.forEach((p) => { p._s = PP.norm([p.name, p.area, p.bn, (p.theme && p.theme.t) || '', PP.ZONES[p.zone] && PP.ZONES[p.zone].long].join(' ')); });
  PP.food.forEach((f) => { f._s = PP.norm([f.name, f.area, f.cuisine, (f.must || []).join(' '), PP.CATS[f.cat] && PP.CATS[f.cat].label].join(' ')); });

  /* ---------- outbound links ---------- */
  const enc = encodeURIComponent;
  PP.placeQuery = (x) => [x.name, x.area, 'Kolkata'].filter(Boolean).join(', ');
  PP.gmapsLink = (x) => (x.area
    ? `https://www.google.com/maps/search/?api=1&query=${enc(PP.placeQuery(x))}`
    : `https://www.google.com/maps/search/${enc(x.name)}/@${x.lat},${x.lon},18z`);
  PP.dirLink = (x, mode) => `https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}&travelmode=${mode || 'walking'}`;
  PP.embedPlace = (x) => `https://maps.google.com/maps?q=${enc(PP.placeQuery(x))}&ll=${x.lat},${x.lon}&z=17&output=embed`;
  PP.embedNearby = (q, lat, lon, z) => `https://maps.google.com/maps?q=${enc(q)}&ll=${lat},${lon}&z=${z || 17}&output=embed`;
  PP.menuLink = (f) => f.menu || `https://www.google.com/search?q=${enc([f.name, f.area, 'Kolkata menu'].filter(Boolean).join(' '))}`;
  PP.osmLink = (x) => `https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lon}#map=18/${x.lat}/${x.lon}`;
})();
