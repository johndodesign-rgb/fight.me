const CACHE = 'fightfit-v1';
const ASSETS = [
  '/fight.me/',
  '/fight.me/index.html',
  '/fight.me/fight-me-hub.html',
  '/fight.me/fit-me-hub.html',
  '/fight.me/fight-me.html',
  '/fight.me/fight-me-coaches.html',
  '/fight.me/fight-me-fighter.html',
  '/fight.me/fight-me-analyzer.html',
  '/fight.me/90day-plan.html',
  '/fight.me/onboarding.html',
  '/fight.me/dashboard.html',
  '/fight.me/session-log.html',
  '/fight.me/program-generator.js',
  '/fight.me/my-program.html',
  '/fight.me/icon-192.svg',
  '/fight.me/icon-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
