/* Mahamaya Clinic EMR V5.55.1 — Clinical Examination Scientist Command Center v3.1.
   Performance hotfix: removes self-triggering MutationObserver loop from v3.
   UI/navigation enhancement only. Clinical schemas, login and Firebase remain unchanged. */
(function(){
'use strict';
const VERSION='V5.55.1',BUILD='2026.08.15-R32H1',UI='MCE-CC3.1';
const $=id=>document.getElementById(id);
const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const section=()=>document.getElementById('examSection');
const ws=()=>section()?.querySelector('.gei-workspace');
const state={tools:false,active:'Core',refreshQueued:false};

function tabLabel(btn){return (btn?.textContent||'').replace(/^[^A-Za-z0-9]+/,'').trim()||'Module'}
function setActiveLabel(btn){
 const badge=$('geiCcActiveModule'); if(!badge||!btn)return;
 const next=tabLabel(btn);
 state.active=next;
 if(badge.textContent!==next) badge.textContent=next;
}
function ensureHeader(){
 const w=ws(),s=section(); if(!w||!s)return;
 s.classList.add('gei-cc3');
 const head=w.querySelector(':scope > .section-head');
 if(head&&!head.classList.contains('gei-cc-header')){
   head.classList.add('gei-cc-header');
   const h=head.querySelector('h2');if(h)h.textContent='Clinical Examination — Scientist Command Workspace';
   const k=head.querySelector('.section-kicker');if(k)k.textContent='Screen → Focus → Interpret → Research QA → Save • structured observations with explicit missingness and clinician-controlled decisions';
   const old=head.querySelector('.evidence-badge');
   if(old){old.outerHTML=`<div class="gei-cc-badges"><span class="gei-cc-badge primary">${VERSION} • ${UI}</span><span class="gei-cc-badge">⚡ Fast-flow</span><span class="gei-cc-badge">🧪 Research-ready</span><span class="gei-cc-badge">🔒 Clinician-controlled</span></div>`}
 }
}
function consolidateConsole(){
 const w=ws();if(!w)return false;
 const cmd=w.querySelector('.gei-rff-command'),tabbar=w.querySelector('.gei-tabbar');
 if(!cmd||!tabbar)return false;
 cmd.classList.add('gei-cc-console');
 if(!cmd.contains(tabbar)){
   const top=cmd.querySelector('.gei-rff-command-top');
   if(top)top.insertAdjacentElement('afterend',tabbar);else cmd.prepend(tabbar);
 }
 const actions=cmd.querySelector('.gei-rff-actions');
 if(actions&&!$('geiCcToolsToggle')){
   const b=document.createElement('button');b.type='button';b.id='geiCcToolsToggle';b.className='secondary';b.textContent='⚙ Quick tools';b.title='Show or hide bulk screening/documentation utilities';
   actions.prepend(b);b.addEventListener('click',()=>{state.tools=!state.tools;cmd.classList.toggle('cc-tools-open',state.tools);b.textContent=state.tools?'✕ Hide tools':'⚙ Quick tools'});
 }
 const tools=cmd.querySelector('.gei-rff-tools');
 if(tools&&!$('geiCcActiveWrap')){
   const span=document.createElement('span');span.id='geiCcActiveWrap';span.className='gei-cc-active';span.innerHTML='Active: <b id="geiCcActiveModule">Core</b>';
   tools.appendChild(span);
 }
 qa('.gei-tabbtn',tabbar).forEach((b,i)=>{
   const nextTitle=`Open ${tabLabel(b)}${i<8?` • Alt+${i+1}`:''}`;
   if(b.title!==nextTitle)b.title=nextTitle;
   if(!b.dataset.cc3Bound){b.dataset.cc3Bound='1';b.addEventListener('click',()=>setActiveLabel(b));}
 });
 setActiveLabel(tabbar.querySelector('.gei-tabbtn.active')||tabbar.querySelector('.gei-tabbtn'));
 return true;
}
function stateClass(value){
 const v=String(value||'').toLowerCase();
 if(!v||v.includes('not assessed'))return ['','—'];
 if(v==='present'||(v.includes('concern')&&!v.includes('no concern')))return ['cc-positive','Present'];
 if(v==='absent'||v.includes('absent / no concern'))return ['cc-negative','Absent'];
 return ['cc-partial',String(value).replace(' / no concern identified','').slice(0,12)];
}
function enhanceMoreSigns(){
 const map={pallor:'geiSuitePallorStatus',icterus:'geiSuiteIcterusStatus',nodes:'geiSuiteNodeStatus',hydration:'geiSuiteHydrationStatus',nutrition:'geiSuiteFrailtyStatus'};
 Object.entries(map).forEach(([key,id])=>{
   const btn=document.querySelector(`[data-gei-more="${key}"]`);if(!btn)return;
   let badge=btn.querySelector('.gei-cc-substate');
   if(!badge){badge=document.createElement('span');badge.className='gei-cc-substate';btn.appendChild(badge)}
   const [cls,label]=stateClass($(id)?.value);
   const nextClass=['cc-positive','cc-negative','cc-partial'].includes(cls)?cls:'';
   ['cc-positive','cc-negative','cc-partial'].forEach(c=>{if(c!==nextClass&&btn.classList.contains(c))btn.classList.remove(c)});
   if(nextClass&&!btn.classList.contains(nextClass))btn.classList.add(nextClass);
   if(badge.textContent!==label)badge.textContent=label;
 });
}
function refresh(){
 ensureHeader();consolidateConsole();enhanceMoreSigns();wrapShowExam();
}
function queueRefresh(){
 if(state.refreshQueued)return;
 state.refreshQueued=true;
 requestAnimationFrame(()=>{state.refreshQueued=false;refresh()});
}
function keyboardNav(e){
 if(!section()||section().classList.contains('hidden'))return;
 if(!(e.altKey&&!e.ctrlKey&&!e.metaKey))return;
 const n=Number(e.key);if(n>=1&&n<=8){const btn=qa('#examSection .gei-tabbar .gei-tabbtn')[n-1];if(btn){e.preventDefault();btn.click();btn.scrollIntoView({block:'nearest',inline:'nearest'})}}
}
function bindLive(){
 /* IMPORTANT: no MutationObserver here. V3 observed its own text-node changes and could loop forever. */
 document.addEventListener('change',e=>{if(e.target.closest('#examSection'))queueRefresh()});
 document.addEventListener('input',e=>{if(e.target.closest('#examSection'))queueRefresh()});
 document.addEventListener('keydown',keyboardNav);
 window.addEventListener('pageshow',()=>setTimeout(queueRefresh,80));
}
function wrapShowExam(){
 if(typeof window.showExam!=='function'||window.showExam.__cc31Wrapped)return;
 const old=window.showExam;
 window.showExam=function(){const r=old.apply(this,arguments);setTimeout(queueRefresh,20);return r};
 window.showExam.__cc31Wrapped=true;
}
function init(){
 refresh();bindLive();
 /* bounded one-shot retries only; never observe or poll continuously */
 setTimeout(queueRefresh,250);
 setTimeout(queueRefresh,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,20),{once:true});else setTimeout(init,20);
window.MAHAMAYA_EXAM_COMMAND_CENTER={version:VERSION,build:BUILD,ui:UI,refresh:queueRefresh};
})();
