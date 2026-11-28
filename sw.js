var CACHE = 'name-swipe-v1.9.1';
var ASSETS = [
  './', './index.html', './styles.css', './app.js', './sync.js', './config.js',
  './vendor/supabase.js', './data/names.js', './data/changelog.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-512-maskable.png', './icons/icon-180.png'
];
// No skipWaiting here on purpose: the new version sits and waits, the app shows
// the "new version ready" bar, and the tap below is what activates it.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;      // never cache Supabase or fonts
  if (url.pathname.indexOf('sw.js') > -1) return;        // always fetch the worker fresh
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
