/* Pujo Parikrama — Google ratings.
   Keyless: Google's own embedded map cards (rating, reviews, hours) via iframes.
   Optional: with a Maps Platform key, live Places (New) nearby search shows ratings inside lists.
   Nothing returned by Google is stored beyond this page session. */
(function () {
  'use strict';
  const PP = window.PP;
  const G = (PP.google = { key: '', state: 'off', error: '', lib: null, loading: null, cache: new Map(), scriptKey: null });
  G.key = PP.store.get('gkey', '') || PP.config.googleMapsApiKey || '';
  G.enabled = () => !!G.key;

  G.setKey = (k) => {
    k = (k || '').trim();
    PP.store.set('gkey', k || null);
    const prevScript = G.scriptKey;
    G.key = k || PP.config.googleMapsApiKey || '';
    G.cache.clear();
    G.state = G.key ? 'idle' : 'off';
    G.error = '';
    if (prevScript && prevScript !== G.key) return 'reload';
    G.loading = null;
    return 'ok';
  };

  G.load = function () {
    if (!G.key) return Promise.reject(new Error('No Google Maps key set.'));
    if (G.loading) return G.loading;
    G.state = 'loading';
    G.loading = new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.importLibrary) { resolve(); return; }
      window.__ppGoogleReady = () => resolve();
      window.gm_authFailure = () => {
        G.state = 'error';
        G.error = 'Google rejected the key — check that Maps JavaScript API and Places API (New) are enabled and the key allows this site.';
        document.dispatchEvent(new CustomEvent('pp:google', { detail: { state: 'error' } }));
      };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(G.key) + '&v=weekly&loading=async&libraries=places&language=en&region=IN&callback=__ppGoogleReady';
      s.async = true;
      s.onerror = () => reject(new Error('Could not load Google Maps (offline or blocked).'));
      G.scriptKey = G.key;
      document.head.appendChild(s);
    })
      .then(() => google.maps.importLibrary('places'))
      .then((lib) => {
        G.lib = lib;
        G.state = 'ready';
        document.dispatchEvent(new CustomEvent('pp:google', { detail: { state: 'ready' } }));
        return lib;
      })
      .catch((e) => {
        G.state = 'error';
        G.error = e.message || String(e);
        G.loading = null;
        document.dispatchEvent(new CustomEvent('pp:google', { detail: { state: 'error' } }));
        throw e;
      });
    return G.loading;
  };

  const FIELDS = ['id', 'displayName', 'location', 'rating', 'userRatingCount', 'priceLevel', 'websiteURI', 'googleMapsURI', 'primaryTypeDisplayName', 'formattedAddress', 'businessStatus', 'regularOpeningHours', 'utcOffsetMinutes'];
  const TYPES = ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'fast_food_restaurant', 'dessert_shop', 'ice_cream_shop', 'coffee_shop'];
  const SAFE_TYPES = ['restaurant', 'cafe', 'bakery', 'meal_takeaway'];
  const PRICE = { FREE: 0, INEXPENSIVE: 1, MODERATE: 2, EXPENSIVE: 3, VERY_EXPENSIVE: 4 };

  G.nearby = async function (lat, lon, radius) {
    radius = Math.round(radius || PP.config.liveRadius || 800);
    const k = lat.toFixed(4) + ',' + lon.toFixed(4) + ',' + radius;
    if (G.cache.has(k)) return G.cache.get(k);
    const lib = await G.load();
    const req = {
      fields: FIELDS,
      locationRestriction: { center: { lat, lng: lon }, radius },
      includedTypes: TYPES,
      maxResultCount: 20,
      rankPreference: lib.SearchNearbyRankPreference ? lib.SearchNearbyRankPreference.POPULARITY : 'POPULARITY',
      language: 'en',
      region: 'in'
    };
    let res;
    try { res = await lib.Place.searchNearby(req); }
    catch (e) { req.includedTypes = SAFE_TYPES; res = await lib.Place.searchNearby(req); }
    const places = (res.places || [])
      .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
      .map((p) => {
        const plat = p.location.lat(), plon = p.location.lng();
        return {
          _p: p, gid: p.id, name: p.displayName, lat: plat, lon: plon,
          rating: p.rating, count: p.userRatingCount, price: PRICE[p.priceLevel],
          web: p.websiteURI, maps: p.googleMapsURI, type: p.primaryTypeDisplayName, addr: p.formattedAddress,
          km: PP.hav({ lat, lon }, { lat: plat, lon: plon })
        };
      });
    await Promise.all(places.map(async (x) => { try { x.openNow = await x._p.isOpen(); } catch (e) { x.openNow = undefined; } }));
    G.cache.set(k, places);
    return places;
  };

  /* Match our curated / OSM places to live Google results (same name, within 250 m). */
  const STOP = new Set(['the', 'and', 'restaurant', 'restaurants', 'kolkata', 'calcutta', 'cafe', 'hotel', 'sweets', 'sweet', 'shop', 'bhandar', 'and', 'sons', 'co', 'pvt', 'ltd', 'kitchen']);
  const toks = (s) => PP.norm(s).replace(/\(.*?\)/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w));
  function sim(a, b) {
    const A = new Set(toks(a.replace(/\(.*?\)/g, ''))), B = new Set(toks(b));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach((w) => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
  }
  G.match = function (foods, places) {
    const out = new Map();
    for (const f of foods) {
      let best = null;
      for (const p of places) {
        const d = PP.hav(f, p);
        if (d > 0.25) continue;
        const s = sim(f.name, p.name);
        if (s < 0.6) continue;
        const score = s - d;
        if (!best || score > best.score) best = { p, score };
      }
      if (best) out.set(f.id, best.p);
    }
    return out;
  };

  G.stars = (r) => {
    if (r == null) return '';
    const full = Math.round(r * 2) / 2;
    let s = '';
    for (let i = 1; i <= 5; i++) s += full >= i ? '★' : full >= i - 0.5 ? '⯪' : '☆';
    return s;
  };
  G.fmtCount = (n) => (n == null ? '' : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n));
})();
