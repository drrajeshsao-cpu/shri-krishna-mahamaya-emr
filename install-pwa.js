/* Mahamaya Clinic EMR V5.54 — installability controller only.
   Authentication, PIN, Firebase, roles and clinical save logic are intentionally untouched. */
(()=>{
  'use strict';
  let deferredPrompt = null;
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const buttons = () => qa('[data-pwa-install],#pwaInstallBtn,#pwaInstallHomeBtn');
  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = () => /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  const isSecureInstallContext = () => window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  function setButtons(visible, label='📲 Install App'){
    buttons().forEach(btn=>{
      btn.style.display = visible ? 'inline-flex' : 'none';
      if(visible) btn.textContent = label;
      btn.setAttribute('aria-hidden', visible ? 'false':'true');
    });
  }

  function ensureHelp(){
    let el=q('#pwaInstallHelp');
    if(el) return el;
    el=document.createElement('div');
    el.id='pwaInstallHelp';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.setAttribute('aria-labelledby','pwaInstallHelpTitle');
    el.style.cssText='position:fixed;inset:0;z-index:120000;background:rgba(8,32,38,.58);display:none;align-items:center;justify-content:center;padding:18px';
    el.innerHTML=`<div style="width:min(520px,100%);background:#fff;border-radius:18px;padding:20px;box-shadow:0 18px 60px rgba(0,0,0,.28);border:1px solid #cbdde3">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <img src="./icon-192.png" alt="" width="54" height="54" style="border-radius:12px;border:1px solid #d6e4e7">
        <div><h2 id="pwaInstallHelpTitle" style="margin:0;color:#0b6f78;font-size:20px">Install Mahamaya EMR</h2><div style="font-size:12px;color:#4d6570">V5.54 • Standalone clinical app</div></div>
      </div>
      <div id="pwaInstallHelpBody" style="line-height:1.55;color:#17333d;font-size:14px"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button type="button" id="pwaInstallHelpClose" class="primary" style="min-width:100px">OK</button></div>
    </div>`;
    document.body.appendChild(el);
    q('#pwaInstallHelpClose')?.addEventListener('click',()=>{el.style.display='none'});
    el.addEventListener('click',e=>{if(e.target===el)el.style.display='none'});
    return el;
  }

  function showHelp(message){
    const el=ensureHelp();
    const body=q('#pwaInstallHelpBody');
    if(body) body.innerHTML=message;
    el.style.display='flex';
  }

  async function requestInstall(){
    if(isStandalone()){
      setButtons(false);
      return;
    }
    if(!isSecureInstallContext()){
      showHelp('<b>Installation requires HTTPS.</b><br>GitHub Pages par publish hone ke baad HTTPS automatically milta hai; wahi live link open karke Install App use karein.');
      return;
    }
    if(deferredPrompt){
      const prompt=deferredPrompt;
      deferredPrompt=null;
      try{
        await prompt.prompt();
        await prompt.userChoice;
      }catch(err){ console.warn('PWA install prompt failed:',err); }
      if(!isStandalone()) setButtons(false);
      return;
    }
    if(isIOS()){
      showHelp('<b>iPhone/iPad:</b><br>Safari me page open karein → <b>Share</b> button → <b>Add to Home Screen</b> → <b>Add</b>.<br><br>Install hone ke baad Mahamaya EMR apne app icon se standalone mode me khulega.');
    }else{
      showHelp('<b>Install option browser menu me available ho sakta hai.</b><br><b>Chrome/Edge:</b> address bar ka Install icon ya menu → <b>Install Mahamaya EMR</b> / <b>Install app</b> use karein.<br><br>Agar option na aaye to page ko ek baar reload karein aur ensure karein ki live GitHub Pages HTTPS link open hai.');
    }
  }

  window.MAHAMAYA_PWA={requestInstall,isStandalone};
  window.mahamayaInstallApp=requestInstall;

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    setButtons(true,'📲 Install App');
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    setButtons(false);
    try{localStorage.setItem('mahamaya-pwa-installed','1')}catch(_){ }
  });
  window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change',e=>{if(e.matches)setButtons(false)});

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-pwa-install],#pwaInstallBtn,#pwaInstallHomeBtn');
    if(!btn)return;
    e.preventDefault();
    requestInstall();
  });

  // iOS has no beforeinstallprompt; keep the existing Install button useful via platform guidance.
  window.addEventListener('DOMContentLoaded',()=>{
    if(isStandalone()) setButtons(false);
    else if(isIOS() && isSafari()) setButtons(true,'📲 Add to Home Screen');
  });

  // Register/update the service worker without forcing a page reload. This avoids interrupting login or active clinical work.
  if('serviceWorker' in navigator){
    window.addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
        // Ask for an update check, but never auto-reload the current page.
        reg.update().catch(()=>{});
      }catch(err){ console.warn('PWA service worker registration failed:',err); }
    });
  }

  // Preserve existing deep-link shortcuts.
  window.addEventListener('load',()=>{
    const a=new URLSearchParams(location.search).get('action');
    setTimeout(()=>{
      if(a==='slaie') q('#tabSLAIE')?.click();
      else if(a==='records') q('#tabRecords')?.click();
      else if(a==='new') q('#dashNewPatient')?.click();
    },500);
  });
})();
