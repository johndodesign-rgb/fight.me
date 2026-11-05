// Network first, so updates show up as soon as they're pushed.
// The cache is only a fallback for when you're offline.
const CACHE = 'fightfit-v3';
const ASSETS = [
  'index.html', 'train.html', 'training.js', 'program-generator.js',
  'dashboard.html', 'onboarding.html', 'fight-me-hub.html', 'fit-me-hub.html',
  'fight-me.html', 'fight-me-coaches.html', 'fight-me-fighter.html', 'fight-me-analyzer.html',
  '90day-plan.html', 'methodology.html', 'my-program.html', 'session-log.html',
  'manifest.json', 'icon-192.svg', 'icon-512.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('train.html'))
    )
  );
});
