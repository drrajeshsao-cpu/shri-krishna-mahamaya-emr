const CACHE_NAME = 'mahamaya-emr-v3.80-20260814-r13';
const CORE_ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './logo.jpg', './clinical-terminology-master.json', './slaie-omega-exact-row-v1.json', './systemic-exam-master-v1.json', './investigation-catalog-v1.json', './ayurveda-lifestyle-master-v1.json',
  './complaint-intelligence-master-v1.json',
  './complaint-intelligence-engine.js',
  './therapeutics-intelligence-master-v1.json', './therapeutics-intelligence-engine.js',
  './ayurveda-therapeutics-master-v1.json', './ayurveda-therapeutics-engine.js',
  './mission-assurance-master-v1.json', './mission-assurance-engine.js', './mission-integrity-manifest-v1.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        return resp;
      }).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && resp.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, resp.clone()));
        return resp;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
