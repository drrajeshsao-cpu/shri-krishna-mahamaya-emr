(()=>{
  let deferredPrompt = null;
  const buttons = () => [...document.querySelectorAll('[data-pwa-install],#pwaInstallBtn')];
  const setVisible = visible => buttons().forEach(b => b.style.display = visible ? 'inline-flex' : 'none');

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; setVisible(true); });
  document.addEventListener('click', async e => {
    const btn=e.target.closest('[data-pwa-install],#pwaInstallBtn'); if(!btn)return;
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; setVisible(false);
  });
  window.addEventListener('appinstalled', () => setVisible(false));

  if ('serviceWorker' in navigator) window.addEventListener('load', async () => {
    try { const reg = await navigator.serviceWorker.register('./service-worker.js', {scope:'./'}); if (reg.waiting) reg.waiting.postMessage?.({type:'SKIP_WAITING'}); }
    catch (err) { console.warn('PWA service worker registration failed:', err); }
  });

  window.addEventListener('load',()=>{const a=new URLSearchParams(location.search).get('action');setTimeout(()=>{if(a==='slaie')document.getElementById('tabSLAIE')?.click();else if(a==='records')document.getElementById('tabRecords')?.click();else if(a==='new')document.getElementById('dashNewPatient')?.click()},500)});
})();
