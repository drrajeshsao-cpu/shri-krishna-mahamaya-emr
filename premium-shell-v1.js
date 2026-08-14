/* Mahamaya Clinic EMR V5.50 — responsive/performance/navigation shell only.
   This file does not alter Firebase, PIN, login, logout, roles, credentials, or record security. */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function locked(){
    const o=$('#lockOverlay');
    if(!o) return false;
    const cs=getComputedStyle(o);
    return cs.display!=='none' && cs.visibility!=='hidden' && !o.classList.contains('hidden');
  }

  function setViewportClass(){
    const w=window.innerWidth;
    const cls=w<768?'vp-mobile':w<1024?'vp-tablet':w<1400?'vp-desktop':'vp-wide';
    document.body.classList.remove('vp-mobile','vp-tablet','vp-desktop','vp-wide');
    document.body.classList.add(cls);
    document.documentElement.style.setProperty('--app-vh',`${window.innerHeight*0.01}px`);
  }

  function optimizeStaticMedia(){
    $$('img:not(.brand-logo)').forEach(img=>{
      if(!img.hasAttribute('loading')) img.loading='lazy';
      if(!img.hasAttribute('decoding')) img.decoding='async';
    });
  }

  const commands=[
    ['🏠','Dashboard','Clinical command center','tabDashboard'],
    ['➕','New Visit','Start a fresh patient encounter','tabPatient'],
    ['🔎','Patient Search','Find patient / UHID / mobile','tabRecords'],
    ['🧭','Complaints & HPI','Structured complaint phenotyping','tabComplaint'],
    ['🩺','History & Vitals','Clinical history and vitals','tabClinical'],
    ['🧬','Prakriti & Lifestyle','Ahara • Nidra • activity','tabLifestyle'],
    ['🔍','General Examination','General clinical examination','tabExam'],
    ['🫀','Systemic Examination','CVS • respiratory • CNS • abdomen','tabSystemic'],
    ['🧠','Assessment & Diagnosis','Provisional • DDx • final diagnosis','tabAssessment'],
    ['🧪','Investigations','Orders • reports • SLAIE','tabInvestigations'],
    ['🌿','Ayurveda Assessment','Pariksha • samprapti • planning','tabAyurveda'],
    ['💊','Prescription','Treatment plan and medicines','tabPrescription'],
    ['🛡','Safety Review','Contraindications • interactions • alerts','tabSafety'],
    ['📄','Preview / PDF','Final review • print • share','tabPreview'],
    ['📅','Appointments','Clinic calendar','tabAppointments'],
    ['💰','Billing','Billing workspace','tabBilling'],
    ['📚','Knowledge','Clinical learning workspace','tabKnowledge'],
    ['⚙','Settings & Backup','Backup • restore • settings','tabSettings']
  ];

  let palette, input, results;
  function buildPalette(){
    if($('#premiumCommandPalette')) return;
    palette=document.createElement('div');
    palette.id='premiumCommandPalette';
    palette.className='premium-command-backdrop no-print';
    palette.setAttribute('aria-hidden','true');
    palette.innerHTML=`<div class="premium-command" role="dialog" aria-modal="true" aria-label="Quick command">
      <div class="premium-command-head">
        <input id="premiumCommandInput" type="search" autocomplete="off" placeholder="Quick command — type module name…" aria-label="Search modules">
        <button type="button" class="premium-command-close" aria-label="Close quick command">✕</button>
      </div>
      <div class="premium-command-results" id="premiumCommandResults"></div>
    </div>`;
    document.body.appendChild(palette);
    input=$('#premiumCommandInput');results=$('#premiumCommandResults');
    palette.addEventListener('click',e=>{if(e.target===palette)closePalette()});
    $('.premium-command-close',palette)?.addEventListener('click',closePalette);
    input?.addEventListener('input',renderCommands);
    results?.addEventListener('click',e=>{
      const b=e.target.closest('[data-command-tab]');
      if(!b) return;
      const id=b.dataset.commandTab;
      const target=document.getElementById(id) || document.querySelector(`[data-modern-tab="${CSS.escape(id)}"]`);
      closePalette();
      if(target) target.click();
    });
    renderCommands();
  }

  function renderCommands(){
    if(!results) return;
    const q=(input?.value||'').trim().toLowerCase();
    const list=commands.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q));
    results.innerHTML=list.length?list.map((x,i)=>`<button type="button" class="premium-command-item" data-command-tab="${x[3]}">
      <span class="premium-command-icon">${x[0]}</span><span class="premium-command-copy"><b>${x[1]}</b><small>${x[2]}</small></span><span class="premium-command-key">${i===0?'Enter':''}</span>
    </button>`).join(''):'<div class="premium-command-empty">No matching module. Try “Rx”, “exam”, “Ayurveda”, “lab” or “records”.</div>';
  }

  function openPalette(){
    if(locked()) return;
    buildPalette();
    palette.classList.add('is-open');palette.setAttribute('aria-hidden','false');
    input.value='';renderCommands();setTimeout(()=>input.focus(),0);
  }
  function closePalette(){
    if(!palette) return;
    palette.classList.remove('is-open');palette.setAttribute('aria-hidden','true');
  }

  function addCommandButton(){
    const host=$('.command-inner');
    if(!host || $('#premiumQuickCommandBtn')) return;
    const b=document.createElement('button');
    b.type='button';b.id='premiumQuickCommandBtn';b.className='command-btn';b.innerHTML='⌘ Quick Command';b.title='Ctrl/Cmd + K';
    b.addEventListener('click',openPalette);
    const drawerBtn=host.querySelector('[data-open-drawer]');
    host.insertBefore(b,drawerBtn||null);
  }

  function bindKeyboard(){
    document.addEventListener('keydown',e=>{
      const isK=(e.key||'').toLowerCase()==='k';
      if((e.ctrlKey||e.metaKey)&&isK){e.preventDefault(); if(palette?.classList.contains('is-open')) closePalette(); else openPalette(); return;}
      if(e.key==='Escape'&&palette?.classList.contains('is-open')){e.preventDefault();closePalette();return;}
      if(e.key==='Enter'&&palette?.classList.contains('is-open')&&document.activeElement===input){
        const first=results?.querySelector('[data-command-tab]');if(first){e.preventDefault();first.click();}
      }
    });
  }

  function init(){
    setViewportClass();
    optimizeStaticMedia();
    addCommandButton();
    buildPalette();
    bindKeyboard();
    let raf=0;
    window.addEventListener('resize',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(setViewportClass)},{passive:true});
    window.addEventListener('orientationchange',setViewportClass,{passive:true});
    document.documentElement.dataset.premiumShell='v1';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
