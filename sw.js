/* Pujo Parikrama — offline support. App shell + data are cached (stale-while-revalidate);
   map tiles and Google content always come from the network. */
const CACHE = 'pujo-parikrama-v1';
const FONT_CACHE = 'pujo-fonts';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest',
  'assets/css/style.css', 'assets/img/logo.svg',
  'assets/vendor/leaflet/leaflet.js', 'assets/vendor/leaflet/leaflet.css',
  'assets/js/core.js', 'assets/js/transit.js', 'assets/js/planner.js', 'assets/js/google.js', 'assets/js/art.js',
  'assets/js/ui-state.js', 'assets/js/ui-map.js', 'assets/js/ui-pandals.js', 'assets/js/ui-plan.js', 'assets/js/app.js',
  'data/meta.js', 'data/metro.js', 'data/pandals.js', 'data/food.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pujo-parikrama-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req, { ignoreSearch: true });
        const net = fetch(req)
          .then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; })
          .catch(() => hit || Response.error());
        return hit || net;
      })
    );
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const r = await fetch(req);
          if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
          return r;
        } catch (err) {
          return Response.error();
        }
      })
    );
  }
});
