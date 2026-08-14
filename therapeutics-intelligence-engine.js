(()=>{
'use strict';
const $=id=>document.getElementById(id);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').trim().toLowerCase();
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const state={master:null,activeTab:'context',selectedCondition:'',selectedDrug:'',searchResults:[],lastContext:null,open:true};

function getCurrent(){try{return typeof current!=='undefined'?current:null}catch(_){return null}}
function src(id){return state.master?.sources?.find(x=>x.id===id)}
function drug(id){return state.master?.drugs?.find(x=>x.id===id)}
function condition(id){return state.master?.conditions?.find(x=>x.id===id)}
function statusMsg(msg,bad=false){try{if(typeof status==='function')status(msg,bad)}catch(_){}}
function currentComplaint(){
 const c=getCurrent()?.complaint||{};
 return c.primary || (Array.isArray(c.items)&&c.items[0]?.term) || (Array.isArray(c.items)&&typeof c.items[0]==='string'?c.items[0]:'') || $('primaryComplaint')?.value || '';
}
function currentDiagnosis(){
 const r=getCurrent(),p=r?.prescription||{};
 return p.finalDiagnosis || p.provisionalDiagnosis || $('finalDiagnosis')?.value || $('provisionalDiagnosis')?.value || (Array.isArray(p.diagnosisTerms)&&p.diagnosisTerms[0]?.term) || (Array.isArray(p.diagnosisTerms)&&typeof p.diagnosisTerms[0]==='string'?p.diagnosisTerms[0]:'') || '';
}
function currentMeds(){
 const r=getCurrent();
 return (r?.prescription?.medicines||[]).map(m=>m.name||'').concat((r?.ayurveda?.prescriptionData?.medicines||[]).map(m=>m.name||'')).filter(Boolean);
}
function age(){const n=Number(getCurrent()?.patient?.age);return Number.isFinite(n)?n:null}
function safety(){
 const r=getCurrent(),s=r?.safety||{},ms=r?.ayurveda?.medicationSafety||{};
 const egfrRaw=String(s.egfr??'').trim();
 return {
   pregnancy:String(s.pregnancy||ms.pregnancy_review||''),
   lactation:String(s.lactation||''),
   egfr:egfrRaw===''?null:Number(egfrRaw),
   renal:String(s.renal||ms.renal_review||''),
   hepatic:String(s.hepatic||ms.hepatic_review||''),
   bleeding:String(s.bleeding||''),
   respiratory:String(s.respiratory||''),
   allergies:String(s.allergies||r?.clinical?.allergy||ms.allergy_details||''),
   comorbidities:String(s.comorbidities||'')
 };
}
function findComplaintMap(text){
 const n=norm(text); if(!n)return null;
 let best=null,score=0;
 (state.master?.complaint_maps||[]).forEach(m=>{
   (m.keywords||[]).forEach(k=>{
     const nk=norm(k); let s=0;
     if(n===nk)s=100; else if(n.includes(nk)||nk.includes(n))s=60+Math.min(n.length,nk.length); else {
       const words=n.split(/\s+/),kw=nk.split(/\s+/); s=kw.filter(x=>words.includes(x)).length*12;
     }
     if(s>score){score=s;best=m}
   })
 });
 return score>=20?best:null;
}
function findConditionByText(text){
 const n=norm(text); if(!n)return null;
 const rows=(state.master?.conditions||[]).map(c=>{
   const terms=[c.name,...(c.aliases||[])].map(norm);
   let s=0;
   terms.forEach(t=>{if(n===t)s=Math.max(s,120); else if(t.includes(n)||n.includes(t))s=Math.max(s,80-Math.abs(t.length-n.length)/10);});
   return {c,s};
 }).sort((a,b)=>b.s-a.s);
 return rows[0]?.s>=55?rows[0].c:null;
}
function conditionRecorded(c){
 if(!c)return false;
 const dx=norm(currentDiagnosis());if(!dx)return false;
 const terms=[c.name,...(c.aliases||[])].map(norm).filter(Boolean);
 return terms.some(t=>dx===t||dx.includes(t)||t.includes(dx));
}
function search(q){
 const n=norm(q);if(!n){state.searchResults=[];renderSearchResults();return}
 const out=[];
 (state.master?.conditions||[]).forEach(c=>{
   const hay=[c.name,c.system,...(c.aliases||[])].join(' ').toLowerCase();
   let sc=hay.startsWith(n)?90:hay.includes(n)?70:0;
   if(norm(c.name).startsWith(n))sc=110;
   if(sc)out.push({type:'condition',id:c.id,label:c.name,meta:c.system,score:sc});
 });
 (state.master?.drugs||[]).forEach(d=>{
   const hay=[d.generic,d.class,...(d.brand_examples_india||[]),...(d.indications||[])].join(' ').toLowerCase();
   let sc=hay.includes(n)?60:0;if(norm(d.generic).startsWith(n))sc=105;
   if((d.brand_examples_india||[]).some(b=>norm(b).startsWith(n)))sc=100;
   if(sc)out.push({type:'drug',id:d.id,label:d.generic,meta:`${d.class}${d.brand_examples_india?.length?' • '+d.brand_examples_india.join(', '):''}`,score:sc});
 });
 state.searchResults=out.sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label)).slice(0,30);
 renderSearchResults();
}
function renderSearchResults(){
 const box=$('tiSearchResults');if(!box)return;
 if(!state.searchResults.length){box.classList.add('hidden');box.innerHTML='';return}
 box.classList.remove('hidden');
 box.innerHTML=state.searchResults.map(x=>`<button type="button" class="ti-search-row" data-ti-result="${esc(x.type)}:${esc(x.id)}"><span><b>${esc(x.label)}</b><small>${esc(x.meta)}</small></span><span class="ti-kind">${x.type==='condition'?'DIAGNOSIS':'DRUG'}</span></button>`).join('');
}
function patientGate(){
 const r=getCurrent(),s=safety(),a=age(),issues=[],warnings=[];
 if(!r?.patient?.name)issues.push('Select patient before loading a therapy into prescription.');
 if(a===null)warnings.push('Age not documented.');
 if(a!==null&&a<18)issues.push('Pediatric dose auto-fill is disabled in this starter engine; use weight/age-specific source.');
 if(!s.allergies)warnings.push('Drug allergy history not documented.');
 if(!Number.isFinite(s.egfr)&&/renal|kidney|ckd/i.test([s.renal,s.comorbidities].join(' ')))warnings.push('Renal disease noted but eGFR not entered.');
 if(/pregnant|trimester|planning/i.test(s.pregnancy)&&!/not applicable|no/i.test(s.pregnancy))warnings.push('Pregnancy context detected: verify every drug against current obstetric guidance.');
 if(/severe hepatic/i.test(s.hepatic))warnings.push('Severe hepatic impairment documented.');
 return {issues,warnings,ok:issues.length===0};
}
function riskForDrug(d){
 const s=safety(),a=age(),red=[],amber=[];
 const name=norm(d.generic),all=norm(s.allergies),renal=norm(s.renal),hep=norm(s.hepatic),preg=norm(s.pregnancy),meds=currentMeds().join(' ').toLowerCase();
 if(a!==null&&a<18)red.push('Pediatric auto-dose is disabled.');
 if(all && d.generic.toLowerCase().split(/[ +(]/)[0] && all.includes(d.generic.toLowerCase().split(/[ +(]/)[0]))red.push('Possible allergy-name conflict.');
 if(/pregnant|trimester|planning/.test(preg)&&!/not applicable|no/.test(preg)){
   if(/telmisartan|ramipril|atorvastatin|rosuvastatin|doxycycline|empagliflozin|dapagliflozin/.test(name))red.push('Pregnancy: this candidate generally requires avoidance/replacement; verify current guidance.');
   else amber.push('Pregnancy context requires explicit label/guideline review.');
 }
 const egfr=s.egfr;
 if(name.includes('metformin')&&Number.isFinite(egfr)&&egfr<30)red.push('eGFR <30: metformin contraindication threshold triggered.');
 if(/pregabalin|gabapentin|nitrofurantoin|spironolactone/.test(name)&&(/ckd|aki|dialysis/.test(renal)||Number.isFinite(egfr)))amber.push('Renal function materially affects eligibility/dose.');
 if(/ibuprofen|naproxen|diclofenac/.test(name)&&(/ckd|aki|dialysis/.test(renal)||Number.isFinite(egfr)&&egfr<60))amber.push('NSAID renal-risk context.');
 if(/ibuprofen|naproxen|diclofenac/.test(name)&&/bleed|ulcer|anticoagul/.test(norm(s.bleeding)))red.push('NSAID + bleeding/GI-risk context.');
 if(/telmisartan|ramipril|spironolactone/.test(name)&&/spironolactone|potassium|telmisartan|losartan|ramipril|enalapril/.test(meds))amber.push('RAAS/potassium interaction or duplicate-class review needed.');
 if(/azithromycin|ondansetron|sumatriptan/.test(name))amber.push('Review rhythm/QT/cardiovascular context and interacting medicines.');
 if(/hepatic|liver/.test(hep)&&/duloxetine|atorvastatin|rosuvastatin|pantoprazole|azithromycin/.test(name))amber.push('Hepatic context requires label review.');
 return {red,amber,level:red.length?'red':amber.length?'amber':'green'};
}
function complaintEngineMap(){
 try{
   const ce=window.MAHAMAYA_COMPLAINT_ENGINE,st=ce?.state;if(!st?.master)return null;
   const p=(st.master.protocols||[]).find(x=>x.id===st.protocolId);if(!p)return null;
   const it=st.interpretation||{};
   return {
     ddx:uniq((it.differentials?.length?it.differentials:p.differentials)||[]),
     next_exam:uniq((it.exam?.length?it.exam:p.exam)||[]),
     investigations:uniq((it.investigations?.length?it.investigations:p.investigations)||[]),
     red_flags:uniq((it.urgent?.length?it.urgent:p.redFlags)||[]),
     source:'MCSPI-P1 '+(p.label||p.id)
   };
 }catch(_){return null}
}
function mergeMaps(a,b){
 if(!a)return b;if(!b)return a;
 return {ddx:uniq([...(a.ddx||[]),...(b.ddx||[])]),next_exam:uniq([...(a.next_exam||[]),...(b.next_exam||[])]),investigations:uniq([...(a.investigations||[]),...(b.investigations||[])]),red_flags:uniq([...(a.red_flags||[]),...(b.red_flags||[])]),source:[a.source,b.source].filter(Boolean).join(' + ')};
}
function contextFromCurrent(){
 const dx=currentDiagnosis(),cp=currentComplaint();
 const c=dx?findConditionByText(dx):null;
 if(c)return {kind:'condition',condition:c,source:'Current diagnosis',text:dx};
 const map=cp?mergeMaps(findComplaintMap(cp),complaintEngineMap()):null;
 const inferred=cp?findConditionByText(cp):null;
 if(inferred)return {kind:'condition_suspected',condition:inferred,map,source:'Current complaint',text:cp};
 if(map)return {kind:'complaint',map,source:'Current complaint',text:cp};
 return {kind:'none',source:'Current encounter',text:cp||dx||''};
}
function setCondition(id,source='Search'){
 state.selectedCondition=id;state.selectedDrug='';state.lastContext={kind:'condition',condition:condition(id),source,text:condition(id)?.name||''};
 renderAll();
}
function setDrug(id){state.selectedDrug=id;state.activeTab='drug';renderAll()}
function useCurrent(){state.selectedCondition='';state.selectedDrug='';state.lastContext=contextFromCurrent();renderAll()}
function candidateDrug(card){return drug(card.drug_id)}
function therapyCandidates(ctx){
 const c=ctx?.condition; if(!c)return [];
 return (c.therapy_candidates||[]).map(x=>({...x,drug:candidateDrug(x)})).filter(x=>x.drug);
}
function contextBadge(ctx){
 if(!ctx||ctx.kind==='none')return '<span class="ti-pill amber">No structured match</span>';
 if(ctx.kind==='condition')return '<span class="ti-pill green">Diagnosis context</span>';
 if(ctx.kind==='condition_suspected')return '<span class="ti-pill amber">Complaint → possible condition</span>';
 return '<span class="ti-pill blue">Complaint learning only</span>';
}
function renderContext(){
 const box=$('tiContextPane');if(!box)return;
 const ctx=state.lastContext||contextFromCurrent(),gate=patientGate();state.lastContext=ctx;
 let html=`<div class="ti-context-head">${contextBadge(ctx)}<div><b>${esc(ctx.source||'Context')}</b><div>${esc(ctx.text||'No complaint/diagnosis selected')}</div></div></div>`;
 if(ctx.map){
   html+=`${ctx.map.source?`<div class="ti-alert blue"><b>Complaint protocol bridge:</b> ${esc(ctx.map.source)} findings are carried into this learning view.</div>`:''}<div class="ti-columns"><div class="ti-mini-card"><h5>Possible DDx directions</h5><ul>${(ctx.map.ddx||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="ti-mini-card"><h5>Next examination</h5><ul>${(ctx.map.next_exam||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="ti-mini-card"><h5>Investigations to consider</h5><ul>${(ctx.map.investigations||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>
   <div class="ti-alert red"><b>Red flags:</b> ${esc((ctx.map.red_flags||[]).join(' • ')||'None encoded')}</div>`;
 }
 if(ctx.condition){
   const c=ctx.condition;
   html+=`<div class="ti-condition-card"><div><h4>${esc(c.name)}</h4><small>${esc(c.system)}</small></div><p>${esc(c.diagnostic_note)}</p>
   <div class="ti-columns"><div><h5>Red flags</h5><ul>${(c.red_flags||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Next exam</h5><ul>${(c.next_examination||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Investigations</h5><ul>${(c.suggested_investigations||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></div>`;
 }
 html+=`<div class="ti-gate ${gate.issues.length?'red':gate.warnings.length?'amber':'green'}"><b>Prescription readiness:</b> ${gate.issues.length?esc(gate.issues.join(' ')):gate.warnings.length?esc(gate.warnings.join(' ')):'Basic gate passed; medicine-specific safety review is still required.'}</div>`;
 if(ctx.kind==='condition_suspected')html+=`<div class="ti-alert amber"><b>Important:</b> This condition was inferred only from complaint wording. Confirm/record diagnosis before loading medicine into Rx.</div>`;
 if(ctx.kind==='complaint')html+=`<div class="ti-alert blue"><b>Symptom-only mode:</b> No drug-of-choice list is generated. Use DDx/examination/investigation prompts, then select or confirm a diagnosis.</div>`;
 box.innerHTML=html;
}
function renderTherapies(){
 const box=$('tiTherapyPane');if(!box)return;
 const ctx=state.lastContext||contextFromCurrent(),gate=patientGate();
 if(!ctx.condition){box.innerHTML='<div class="ti-empty"><b>No diagnosis-specific therapy list yet.</b><br>Select/search a diagnosis or record a provisional/final diagnosis. Complaint-only mode intentionally blocks broad drug suggestions.</div>';return}
 const cards=therapyCandidates(ctx);
 const recorded=conditionRecorded(ctx.condition);
 box.innerHTML='';
 if(!recorded)box.innerHTML='<div class="ti-alert amber"><b>Learning mode:</b> Review candidates below, but Load to Draft Rx stays locked until this condition is recorded in Provisional/Final Diagnosis. Use “Add selected condition to Provisional Dx” if clinically appropriate.</div>';
 if(!cards.length){box.innerHTML='<div class="ti-empty">No seeded medicine candidates for this condition in MTLPI v1.0. Use current guideline/label and manual prescription.</div>';return}
 box.innerHTML+=(recorded?'':'')+`<div class="ti-legend"><span class="green">■ Preferred/first-line context</span><span class="blue">■ Alternative/adjunct</span><span class="amber">■ Conditional/monitoring</span><span class="red">■ Patient-specific avoid alert</span></div>`+
 cards.map((c,i)=>{
   const d=c.drug,r=riskForDrug(d),level=r.level==='red'?'red':c.priority==='amber'?'amber':c.priority==='blue'?'blue':r.level==='amber'?'amber':'green';
   const dose=c.regimen_example||d.dose_example;
   return `<article class="ti-drug-card ${level}"><div class="ti-drug-top"><div><span class="ti-rank">${i+1}</span><b>${esc(d.generic)}</b><small>${esc(d.class)}</small></div><span class="ti-pill ${level}">${esc(c.role)}</span></div>
   <div class="ti-dose"><b>Adult learning dose:</b> ${esc(dose||'Indication-specific—verify current label/guideline.')}</div>
   ${c.when_to_consider?`<div><b>When:</b> ${esc(c.when_to_consider)}</div>`:''}
   ${c.avoid_or_caution?`<div><b>Avoid/caution:</b> ${esc(c.avoid_or_caution)}</div>`:''}
   ${r.red.length?`<div class="ti-alert red"><b>Patient-specific alert:</b> ${esc(r.red.join(' '))}</div>`:''}
   ${r.amber.length?`<div class="ti-alert amber"><b>Review:</b> ${esc(r.amber.join(' '))}</div>`:''}
   <div class="ti-card-actions"><button type="button" class="secondary" data-ti-drug="${esc(d.id)}">View monograph</button><button type="button" class="primary" data-ti-load="${esc(c.drug_id)}" data-ti-condition="${esc(ctx.condition.id)}" ${(!gate.ok||ctx.kind==='condition_suspected'||!conditionRecorded(ctx.condition)||r.red.length)?'disabled':''}>Load to Draft Rx</button></div>
   <small>Brand aliases: ${esc((d.brand_examples_india||[]).join(', ')||'None seeded')} • Generic-first</small></article>`;
 }).join('');
}
function renderDrug(){
 const box=$('tiDrugPane');if(!box)return;
 const d=drug(state.selectedDrug);
 if(!d){box.innerHTML='<div class="ti-empty">Select any medicine from therapy cards or search to view a concise monograph.</div>';return}
 const risk=riskForDrug(d),sourceRows=(d.sources||[]).map(src).filter(Boolean);
 box.innerHTML=`<div class="ti-monograph"><div class="ti-monograph-head"><div><h4>${esc(d.generic)}</h4><small>${esc(d.class)} • ${esc(d.common_form)} • ${esc(d.route)}</small></div><span class="ti-pill ${risk.level}">${risk.level==='red'?'Avoid alert':risk.level==='amber'?'Review context':'No local rule triggered'}</span></div>
 <div class="ti-dose"><b>Typical adult learning example:</b> ${esc(d.dose_example)}</div>
 <div class="ti-alert amber">${esc(d.dose_note)}</div>
 <div class="ti-mon-grid"><div><h5>Indications</h5><ul>${d.indications.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Key contraindications</h5><ul>${d.key_contraindications.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Interactions</h5><ul>${d.key_interactions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><h5>Common/important ADRs</h5><ul>${d.common_adrs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>
 <div class="ti-organ-grid"><div><b>Kidney:</b><span>${esc(d.renal)}</span></div><div><b>Liver:</b><span>${esc(d.hepatic)}</span></div><div><b>Pregnancy/Lactation:</b><span>${esc(d.pregnancy_lactation)}</span></div><div><b>Monitoring:</b><span>${esc(d.monitoring)}</span></div></div>
 ${risk.red.length?`<div class="ti-alert red"><b>Patient-specific alert:</b> ${esc(risk.red.join(' '))}</div>`:''}${risk.amber.length?`<div class="ti-alert amber"><b>Patient-specific review:</b> ${esc(risk.amber.join(' '))}</div>`:''}
 <div class="ti-brand"><b>India brand aliases (examples only):</b> ${esc((d.brand_examples_india||[]).join(', ')||'None seeded')}<small>${esc(d.brand_note)}</small></div>
 <div class="ti-sources"><b>Source families:</b> ${sourceRows.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' • ')}</div></div>`;
}
function renderSources(){
 const box=$('tiSourcesPane');if(!box)return;
 box.innerHTML=`<div class="ti-alert blue"><b>Evidence boundary:</b> MTLPI is a clinician-learning layer. It does not replace current product labels, local antibiograms, specialty guidelines, pharmacist review, or patient-specific judgment. Brand aliases are not rankings.</div>
 <div class="ti-source-grid">${(state.master?.sources||[]).map(s=>`<a class="ti-source-card" href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(s.name)}</b><small>${esc(s.scope)}</small></a>`).join('')}</div>`;
}
function renderTabs(){
 qsa('[data-ti-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tiTab===state.activeTab));
 ['context','therapy','drug','sources'].forEach(k=>{const el=$('ti'+k[0].toUpperCase()+k.slice(1)+'Pane');if(el)el.classList.toggle('hidden',k!==state.activeTab)});
}
function renderHeader(){
 const count=$('tiCatalogCount');if(count)count.textContent=`${state.master?.drugs?.length||0} medicines • ${state.master?.conditions?.length||0} condition pathways • v${state.master?.version||''}`;
 const cp=$('tiCurrentComplaint');if(cp)cp.textContent=currentComplaint()||'—';
 const dx=$('tiCurrentDiagnosis');if(dx)dx.textContent=currentDiagnosis()||'—';
}
function renderAll(){renderHeader();renderContext();renderTherapies();renderDrug();renderSources();renderTabs();persist()}
function persist(){
 const r=getCurrent();if(!r)return;
 r.therapeuticsLearning={selectedCondition:state.selectedCondition,selectedDrug:state.selectedDrug,activeTab:state.activeTab,lastContextText:state.lastContext?.text||'',updatedAt:new Date().toISOString()};
}
function restore(o={}){state.selectedCondition=o.selectedCondition||'';state.selectedDrug=o.selectedDrug||'';state.activeTab=o.activeTab||'context';state.lastContext=state.selectedCondition?{kind:'condition',condition:condition(state.selectedCondition),source:'Saved learning context',text:condition(state.selectedCondition)?.name||''}:contextFromCurrent();renderAll()}
function addConditionToAssessment(){
 const ctx=state.lastContext;if(!ctx?.condition)return;
 const r=getCurrent();if(!r)return;
 r.prescription=r.prescription||{};
 const name=ctx.condition.name;
 const old=String(r.prescription.provisionalDiagnosis||'').trim();
 if(!old.toLowerCase().includes(name.toLowerCase()))r.prescription.provisionalDiagnosis=[old,name].filter(Boolean).join(old?'\n':'');
 const el=$('provisionalDiagnosis');if(el)el.value=r.prescription.provisionalDiagnosis;
 try{if(typeof save==='function')save(r)}catch(_){}
 statusMsg('Condition added to provisional diagnosis for clinician editing/confirmation.');
 useCurrent();
}
function addInvestigations(){
 const ctx=state.lastContext;if(!ctx)return;
 const list=ctx.condition?.suggested_investigations||ctx.map?.investigations||[];if(!list.length)return;
 const r=getCurrent();if(!r)return;
 r.investigations=r.investigations||{};r.investigations.advised=Array.isArray(r.investigations.advised)?r.investigations.advised:[];
 list.forEach(t=>{if(!r.investigations.advised.some(x=>norm(x.test||x)===norm(t)))r.investigations.advised.push({category:'Other',test:t,priority:'Routine',note:'MTLPI learning suggestion—clinician review required.'})});
 try{if(typeof save==='function')save(r)}catch(_){}
 statusMsg('Suggested investigations added for clinician review.');
}
function loadToDraft(drugId,conditionId){
 const d=drug(drugId),c=condition(conditionId),card=c?.therapy_candidates?.find(x=>x.drug_id===drugId),gate=patientGate(),risk=d?riskForDrug(d):{red:['Unknown medicine']};
 if(!d||!gate.ok||risk.red.length){statusMsg('Draft load blocked by safety/readiness gate. Review patient context first.',true);return}
 if(!conditionRecorded(c)){statusMsg('Record/confirm this condition in Provisional or Final Diagnosis before loading a medicine draft.',true);return}
 const ctx=state.lastContext;if(ctx?.kind==='condition_suspected'){statusMsg('Confirm/record diagnosis before loading therapy.',true);return}
 if($('medSystem'))$('medSystem').value='Allopathic Generic';
 if($('medName'))$('medName').value=d.generic;
 if($('medStrength'))$('medStrength').value='';
 if($('medDose'))$('medDose').value=card?.regimen_example||d.dose_example;
 if($('medFrequency'))$('medFrequency').value='As directed';
 const routeMap={Oral:'Oral',Inhalation:'Inhalation',Topical:'Local application','Oral/IV':'Oral','Oral/Nasal/SC':'Oral','Nasal':'Other'};
 if($('medRoute'))$('medRoute').value=routeMap[d.route]||'Other';
 if($('medDuration'))$('medDuration').value='';
 if($('medInstruction'))$('medInstruction').value=`EDUCATIONAL DRAFT from MTLPI v1.0 for ${c?.name||'selected context'}. Verify exact strength, dose, frequency, duration, contraindications, interactions and current label/guideline before adding. ${d.monitoring?`Monitoring: ${d.monitoring}`:''}`;
 const notes=$('prescriptionNotes');if(notes){const line=`MTLPI candidate: ${d.generic} — ${card?.role||''}. ${d.brand_examples_india?.length?'Brand aliases (examples only): '+d.brand_examples_india.join(', ')+'. ':''}Clinician confirmation required.`;if(!notes.value.includes(line))notes.value=[notes.value,line].filter(Boolean).join(notes.value?'\n':'')}
 window.scrollTo({top:$('prescriptionEngineCard')?.getBoundingClientRect().top+window.scrollY-110,behavior:'smooth'});
 statusMsg('Medicine loaded into DRAFT fields only. Review/edit, click Add Medicine, then run Safety Screening.');
}
function bind(){
 $('tiSearch')?.addEventListener('input',e=>search(e.target.value));
 $('tiUseCurrentBtn')?.addEventListener('click',useCurrent);
 $('tiAddDxBtn')?.addEventListener('click',addConditionToAssessment);
 $('tiAddInvBtn')?.addEventListener('click',addInvestigations);
 $('tiRefreshBtn')?.addEventListener('click',useCurrent);
 qsa('[data-ti-tab]').forEach(b=>b.addEventListener('click',()=>{state.activeTab=b.dataset.tiTab;renderAll()}));
 document.addEventListener('click',e=>{
   const r=e.target.closest('[data-ti-result]');if(r){const [t,id]=r.dataset.tiResult.split(':');$('tiSearch').value='';state.searchResults=[];renderSearchResults();if(t==='condition'){setCondition(id,'Search')}else setDrug(id);return}
   const d=e.target.closest('[data-ti-drug]');if(d){state.selectedDrug=d.dataset.tiDrug;state.activeTab='drug';renderAll();return}
   const l=e.target.closest('[data-ti-load]');if(l){loadToDraft(l.dataset.tiLoad,l.dataset.tiCondition);return}
 });
 document.addEventListener('click',e=>{if(!e.target.closest('.ti-search-wrap')){$('tiSearchResults')?.classList.add('hidden')}});
}
async function init(){
 try{const r=await fetch('./therapeutics-intelligence-master-v1.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);state.master=await r.json()}
 catch(e){console.error('MTLPI master load failed',e);const box=$('tiContextPane');if(box)box.innerHTML='<div class="ti-alert red">Therapeutics master could not load. Normal prescription remains available.</div>';return}
 bind();restore(getCurrent()?.therapeuticsLearning||{});
 if(new URLSearchParams(location.search).get('action')==='therapeutics')setTimeout(()=>{$('tabPrescription')?.click();useCurrent()},700);
}
window.MAHAMAYA_THERAPEUTICS_ENGINE={init,restore,refresh:useCurrent,state};
init();
})();