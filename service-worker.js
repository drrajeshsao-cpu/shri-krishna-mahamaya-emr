const CACHE_NAME = 'mahamaya-emr-v5.52-20260815-r29';
const ESSENTIAL_ASSETS = [
  './', './index.html', './manifest.webmanifest', './install-pwa.js',
  './premium-responsive-v1.css', './premium-shell-v1.js', './ayurveda-bilingual-v1.css',
  './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png',
  './apple-touch-icon.png', './logo.jpg'
];
const CLINICAL_ASSETS = [
  './clinical-terminology-master.json', './slaie-omega-exact-row-v1.json',
  './systemic-exam-master-v1.json', './investigation-catalog-v1.json', './ayurveda-lifestyle-master-v1.json',
  './complaint-intelligence-master-v1.json', './complaint-intelligence-engine.js',
  './therapeutics-intelligence-master-v1.json', './antibiotic-intelligence-v1.json',
  './chronic-pharmacology-intelligence-v1.json', './therapeutics-intelligence-engine.js',
  './ayurveda-therapeutics-master-v1.json', './ayurveda-formulary-index-v1.json', './ayurveda-devanagari-map-v1.json',
  './ayurveda-safety-selection-v1.json', './ayurveda-therapeutics-engine.js',
  './mission-assurance-master-v1.json', './mission-assurance-engine.js', './mission-integrity-manifest-v1.json'
];

async function cacheOptional(cache, paths){
  await Promise.allSettled(paths.map(async path=>{
    const res=await fetch(path,{cache:'reload'});
    if(res.ok) await cache.put(path,res.clone());
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(ESSENTIAL_ASSETS);
    await cacheOptional(cache,CLINICAL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return; // Firebase/CDN/auth requests are not intercepted.

  if(req.mode==='navigate'){
    // Always prefer the network for HTML so fresh login/UI code is used; cache is offline fallback only.
    event.respondWith((async()=>{
      try{
        const resp=await fetch(req,{cache:'no-store'});
        if(resp?.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put('./index.html',resp.clone());
        }
        return resp;
      }catch(_){
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Fast cache response with background refresh for same-origin static/clinical assets.
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const refresh=fetch(req).then(async resp=>{
      if(resp?.ok){ const cache=await caches.open(CACHE_NAME); await cache.put(req,resp.clone()); }
      return resp;
    }).catch(()=>null);
    return cached || await refresh || Response.error();
  })());
});
