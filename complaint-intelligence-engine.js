(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u0900-\u097f]+/g,' ').trim();
  const state = { master:null, loaded:false, protocolId:'', values:{}, interpretation:null, generatedSummary:'', restored:false };
  const fallback = {version:'MCSPI-P1 fallback',genericResearchFields:[],protocols:[{id:'generic',label:'Generic Complaint / Custom Phenotype',system:'General / Custom',aliases:['other'],fields:[],redFlags:[],exam:[],investigations:[],differentials:[],management:[]}]};
  let protocolIndex=[];

  function protocolById(id){ return (state.master?.protocols||[]).find(p=>p.id===id) || (state.master?.protocols||[]).find(p=>p.id==='generic'); }
  function scoreMatch(term,p){
    const n=norm(term); if(!n)return 0;
    const candidates=[p.label,...(p.aliases||[])].map(norm);
    if(candidates.includes(n))return 100;
    let score=0;
    for(const c of candidates){ if(!c)continue; if(n.includes(c)||c.includes(n))score=Math.max(score,70); const parts=c.split(' '); const hit=parts.filter(x=>x.length>2&&n.includes(x)).length; score=Math.max(score,hit*15); }
    return score;
  }
  function matchProtocol(term){
    let best={p:protocolById('generic'),score:0};
    for(const p of state.master?.protocols||[]){ if(p.id==='generic')continue; const s=scoreMatch(term,p); if(s>best.score)best={p,score:s}; }
    return best.score>=30?best.p:protocolById('generic');
  }
  function currentProtocol(){return protocolById(state.protocolId)||matchProtocol($('primaryComplaint')?.value||'');}
  function checkedRedFlags(){return [...document.querySelectorAll('input[name="redFlag"]:checked')].map(x=>x.value);}

  function renderField(f){
    const v=state.values[f.id];
    const help=f.help?`<div class="ci-help">${esc(f.help)}</div>`:'';
    if(f.type==='select')return `<div class="ci-field"><label>${esc(f.label)}</label><select data-ci-field="${esc(f.id)}"><option value=""></option>${(f.options||[]).map(o=>`<option ${String(v)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select>${help}</div>`;
    if(f.type==='number')return `<div class="ci-field"><label>${esc(f.label)}</label><input data-ci-field="${esc(f.id)}" type="number" ${f.min!==undefined?`min="${f.min}"`:''} ${f.max!==undefined?`max="${f.max}"`:''} step="${f.step||1}" value="${esc(v??'')}">${help}</div>`;
    if(f.type==='textarea')return `<div class="ci-field ci-span-2"><label>${esc(f.label)}</label><textarea data-ci-field="${esc(f.id)}" placeholder="${esc(f.placeholder||'')}">${esc(v??'')}</textarea>${help}</div>`;
    if(f.type==='multi'){
      const arr=Array.isArray(v)?v:[];
      return `<div class="ci-field ci-span-2"><label>${esc(f.label)}</label><div class="ci-multi">${(f.options||[]).map(o=>`<label class="ci-chip"><input type="checkbox" data-ci-multi="${esc(f.id)}" value="${esc(o)}" ${arr.includes(o)?'checked':''}><span>${esc(o)}</span></label>`).join('')}</div>${help}</div>`;
    }
    return `<div class="ci-field"><label>${esc(f.label)}</label><input data-ci-field="${esc(f.id)}" value="${esc(v??'')}" placeholder="${esc(f.placeholder||'')}">${help}</div>`;
  }
  function renderFields(fields){return `<div class="ci-field-grid">${(fields||[]).map(renderField).join('')}</div>`;}

  function completeness(){
    const p=currentProtocol(), fields=[...(state.master?.genericResearchFields||[]),...(p?.fields||[])];
    if(!fields.length)return 0; let answered=0;
    for(const f of fields){const v=state.values[f.id]; if(Array.isArray(v)?v.length>0:String(v??'').trim()!=='')answered++;}
    return Math.round(answered/fields.length*100);
  }
  function burdenSnapshot(){
    const n=Number($('complaintSeverity')?.value||0);
    const map=v=>{const s=String(v||''); if(s.startsWith('4+'))return 4;if(s.startsWith('3+'))return 3;if(s.startsWith('2+'))return 2;if(s.startsWith('1+'))return 1;return 0;};
    const f=map(state.values.ci_function), sl=map(state.values.ci_sleep), d=map(state.values.ci_patient_distress);
    if(!n&&!f&&!sl&&!d)return null;
    return Math.round(((Math.min(10,n)/10)*4 + (f/4)*2.5 + (sl/3)*1.75 + (d/3)*1.75)*10)/10;
  }
  function updateKpis(){
    const p=currentProtocol(); if($('ciKpiProtocol'))$('ciKpiProtocol').textContent=p?.label||'Generic';
    const c=completeness(); if($('ciKpiComplete'))$('ciKpiComplete').textContent=c+'%'; if($('ciKpiCompleteBar'))$('ciKpiCompleteBar').style.width=c+'%';
    const b=burdenSnapshot(); if($('ciKpiBurden'))$('ciKpiBurden').textContent=b==null?'— /10':b+' /10';
    if($('ciKpiRed'))$('ciKpiRed').textContent=checkedRedFlags().length;
  }

  function syncLegacy(){
    const sev=state.values.ci_severity_nrs; if(sev!==undefined&&$('complaintSeverity')&&!$('complaintSeverity').value)$('complaintSeverity').value=sev;
    const p=currentProtocol(); const durClass=state.values.cough_duration_class;
    if(p?.id==='cough' && durClass && $('complaintDuration') && !$('complaintDuration').value && durClass!=='Auto from duration if possible')$('complaintDuration').placeholder=durClass;
  }

  function evaluate(){
    collectDOM(); const p=currentProtocol();
    const values=state.values, urgent=[], signals=[], exam=[...(p.exam||[])], inv=[...(p.investigations||[])], ddx=[...(p.differentials||[])], management=[...(p.management||[])];
    const has=(k,needle)=>{const n=String(needle).toLowerCase();return Array.isArray(values[k])?values[k].some(v=>String(v).toLowerCase().includes(n)):String(values[k]||'').toLowerCase().includes(n);};
    const yes=k=>/present|yes/.test(String(values[k]||'').toLowerCase())&&!/absent|no/.test(String(values[k]||'').toLowerCase());
    const red=checkedRedFlags(); urgent.push(...red);
    if(p.id==='cough'){
      const hem=String(values.hemoptysis||'');
      const chronic=String(values.cough_duration_class||'').includes('>8') || /month|year/.test(String($('complaintDuration')?.value||'').toLowerCase());
      const systemic=yes('fever')||yes('weight_loss')||yes('night_sweats')||yes('weakness');
      if(/Large|ongoing/.test(hem)){urgent.push('Large/ongoing hemoptysis needs urgent airway, breathing and hemodynamic assessment.');}
      if(yes('dyspnea'))signals.push('Cough + dyspnea: prioritize respiratory severity assessment, SpO₂ and focused chest examination.');
      if(yes('wheeze') || (has('cough_timing','Night')||has('cough_timing','Early morning'))){signals.push('Variable cough/wheeze with nocturnal or early-morning pattern supports an asthma/eosinophilic-airway direction; confirm objectively rather than diagnosing from symptoms alone.');}
      if((systemic || hem!=='Not assessed'&&hem!=='Absent'&&hem) && (has('exposures','TB household') || chronic || String($('complaintDuration')?.value||'').match(/2\s*week|3\s*week|month/i))){signals.push('Prolonged cough plus constitutional/hemoptysis/TB-contact features raises a TB evaluation direction.'); inv.unshift('TB evaluation: WHO-recommended rapid molecular diagnostic testing and chest imaging according to local/NTEP pathway.'); ddx.unshift('Pulmonary tuberculosis');}
      if(chronic){signals.push('Chronic adult cough (>8 weeks): use a structured chronic-cough pathway rather than repeated empiric symptom treatment.'); inv.unshift('Chronic-cough baseline: CXR + spirometry (preferably reversibility); consider FeNO/blood eosinophils and sputum culture when clinically indicated.');}
      if(has('exposures','Current tobacco')||has('exposures','Former tobacco')||has('exposures','Biomass')){ if(chronic||yes('dyspnea')||String(values.sputum_presence||'').match(/Scanty|Moderate|Copious/)){signals.push('Exposure + chronic cough/sputum/dyspnea supports COPD/chronic-airway-disease assessment.'); inv.push('Post-bronchodilator spirometry to confirm persistent airflow obstruction if COPD is suspected.'); ddx.unshift('COPD / chronic bronchitis');}}
      if(String(values.sputum_presence||'').match(/Moderate|Copious/) && (chronic||has('resp_context','Recurrent pneumonia'))){signals.push('Chronic productive cough or recurrent chest infections can justify bronchiectasis-focused assessment.'); inv.push('Sputum culture; consider thin-section CT chest when bronchiectasis is clinically suspected.'); ddx.unshift('Bronchiectasis / chronic suppurative airway disease');}
      if(yes('cough_paroxysm') && (yes('cough_whoop')||yes('cough_posttussive_vomit'))){signals.push('Paroxysmal cough with inspiratory whoop and/or post-tussive vomiting is a pertussis-compatible pattern.'); ddx.unshift('Pertussis');}
      if(yes('fever') && (yes('dyspnea')||String(values.chest_pain||'').includes('pleuritic')||has('known_sounds','Crackles')||has('known_sounds','Bronchial breathing'))){signals.push('Cough + fever with dyspnea/pleuritic or focal chest findings supports pneumonia/LRTI assessment.'); inv.push('CXR and severity assessment when pneumonia is suspected.'); ddx.unshift('Community-acquired pneumonia / LRTI');}
      if((has('upper_airway','Rhinorrhea')||has('upper_airway','Post-nasal')||has('upper_airway','Throat clearing'))){signals.push('Upper-airway symptoms support rhinitis/post-nasal/upper-airway cough direction.'); ddx.unshift('Upper airway cough syndrome / rhinitis');}
      if(has('reflux_features','Heartburn')||has('reflux_features','Regurgitation')||has('reflux_features','Recumbent')||has('reflux_features','Post-meal')){signals.push('Meal/recumbency plus reflux symptoms supports a reflux-associated cough direction.'); ddx.unshift('GERD-associated cough');}
      if(yes('ace_inhibitor')){signals.push('ACE-inhibitor exposure can be a medication-related cough clue; review chronology and medication indication before any change.'); ddx.unshift('ACE-inhibitor–associated cough');}
      if((values.sputum_color||[]).some(x=>/Yellow|Green/.test(x))){signals.push('Yellow/green sputum is a phenotype descriptor, not by itself proof of bacterial infection; integrate fever, exam, severity, duration and microbiology when indicated.');}
      if(has('known_sounds','Stridor'))urgent.push('Stridor is an upper-airway red flag; confirm immediately and assess airway severity.');
    }
    // complaint-agnostic severity signals
    const sev=Number($('complaintSeverity')?.value||0); if(sev>=8)signals.push('High symptom intensity (NRS ≥8/10): reassess red flags, function and physiological severity before routine workflow.');
    if(state.values.ci_function?.startsWith('4+'))signals.push('Disabling functional impact: prioritize cause, safety, and timely reassessment.');
    const uniq=a=>[...new Set(a.filter(Boolean))];
    state.interpretation={generatedAt:new Date().toISOString(),urgent:uniq(urgent),signals:uniq(signals),exam:uniq(exam),investigations:uniq(inv),differentials:uniq(ddx),management:uniq(management)};
    renderInterpretation(); renderGuidance($('primaryComplaint')?.value||p?.label||'', red); updateKpis(); return state.interpretation;
  }

  function renderInterpretation(){
    const box=$('ciInterpretation'); if(!box)return; const x=state.interpretation;
    if(!x){box.innerHTML='<div class="ci-empty">Complete relevant fields and press <b>Interpret & Learn</b>. The engine explains patterns; it does not make an autonomous diagnosis.</div>';return;}
    const section=(title,arr,cls='')=>arr?.length?`<div class="ci-interpret-section ${cls}"><h4>${title}</h4>${arr.map(v=>`<div class="ci-line">${esc(v)}</div>`).join('')}</div>`:'';
    box.innerHTML=`${section('🚨 Urgent / red-flag review',x.urgent,'ci-danger')}${section('🧠 Pattern signals / meaning',x.signals)}${section('🩺 Next focused examination',x.exam)}${section('🧪 Suggested investigations for clinician review',x.investigations)}${section('🔎 Differential directions — not diagnoses',x.differentials)}${section('📋 Management direction',x.management)}` || '<div class="ci-empty">No rule triggered. Use clinical judgment and the generic structured HPI.</div>';
  }

  function generateSummary(){
    collectDOM(); const p=currentProtocol(); const lines=[];
    lines.push(`Complaint phenotype: ${p?.label||$('primaryComplaint')?.value||'Custom complaint'}`);
    const legacy=[];
    if($('complaintDuration')?.value)legacy.push('Duration '+$('complaintDuration').value);
    if($('complaintSeverity')?.value)legacy.push('Severity '+$('complaintSeverity').value+'/10');
    if($('complaintOnset')?.value)legacy.push('Onset '+$('complaintOnset').value);
    if($('complaintProgression')?.value)legacy.push('Course '+$('complaintProgression').value);
    if(legacy.length)lines.push(legacy.join(' • '));
    const fields=[...(state.master?.genericResearchFields||[]),...(p?.fields||[])];
    for(const f of fields){const v=state.values[f.id]; if(Array.isArray(v)&&v.length)lines.push(`${f.label}: ${v.join(', ')}`); else if(v!==undefined&&String(v).trim())lines.push(`${f.label}: ${v}`);}
    const rf=checkedRedFlags(); if(rf.length)lines.push('Red flags selected: '+rf.join('; '));
    const i=state.interpretation||evaluate(); if(i.signals?.length)lines.push('CDS pattern signals: '+i.signals.join(' '));
    state.generatedSummary=lines.join('\n'); if($('ciSummary'))$('ciSummary').value=state.generatedSummary; return state.generatedSummary;
  }
  function addToHPI(){const s=generateSummary(),h=$('hpi');if(!h)return;h.value=(h.value.trim()?h.value.trim()+'\n\n':'')+'[MCSPI-P1 Structured Complaint Phenotype]\n'+s; h.dispatchEvent(new Event('input',{bubbles:true})); statusMsg('Structured complaint phenotype added to HPI. Review before saving.');}
  function statusMsg(msg){const st=$('status');if(st)st.textContent=msg;}

  function collectDOM(){
    document.querySelectorAll('[data-ci-field]').forEach(el=>{state.values[el.dataset.ciField]=el.value});
    document.querySelectorAll('[data-ci-multi]').forEach(el=>{const id=el.dataset.ciMulti; if(!Array.isArray(state.values[id]))state.values[id]=[];});
    const ids=[...new Set([...document.querySelectorAll('[data-ci-multi]')].map(x=>x.dataset.ciMulti))];
    ids.forEach(id=>state.values[id]=[...document.querySelectorAll(`[data-ci-multi="${CSS.escape(id)}"]:checked`)].map(x=>x.value));
    return state.values;
  }
  function collect(){collectDOM(); return {version:state.master?.version||'MCSPI-P1',protocolId:currentProtocol()?.id||'generic',protocolLabel:currentProtocol()?.label||'',system:currentProtocol()?.system||'',values:(typeof structuredClone==='function'?structuredClone(state.values):JSON.parse(JSON.stringify(state.values))),interpretation:state.interpretation,generatedSummary:state.generatedSummary,completeness:completeness(),burdenSnapshot:burdenSnapshot(),updatedAt:new Date().toISOString()};}
  function restore(data={}){state.protocolId=data.protocolId||'';state.values={...(data.values||{})};state.interpretation=data.interpretation||null;state.generatedSummary=data.generatedSummary||'';state.restored=true; render(); if(state.generatedSummary&&$('ciSummary'))$('ciSummary').value=state.generatedSummary;}

  function renderGuidance(term,selectedRed=[]){
    const p=(state.protocolId?currentProtocol():matchProtocol(term)); if(!p)return;
    const red=$('redFlags'),ex=$('suggestedExam'),inv=$('suggestedInv'),dx=$('suggestedDx');
    if(red){const sel=new Set(selectedRed||[]);red.innerHTML=(p.redFlags||[]).map(x=>`<label class="check"><input type="checkbox" name="redFlag" value="${esc(x)}" ${sel.has(x)?'checked':''}>${esc(x)}</label>`).join('')||'<span class="small">No protocol-specific red flag preset. Use clinical judgment.</span>';}
    const pills=a=>(a||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('');
    if(ex)ex.innerHTML=pills(state.interpretation?.exam?.length?state.interpretation.exam:p.exam);
    if(inv)inv.innerHTML=pills(state.interpretation?.investigations?.length?state.interpretation.investigations:p.investigations);
    if(dx)dx.innerHTML=(state.interpretation?.differentials?.length?state.interpretation.differentials:p.differentials||[]).map((x,i)=>`<span class="pill">${i+1}. ${esc(x)}</span>`).join('');
    const alert=$('redFlagAlert');if(alert){const count=checkedRedFlags().length;alert.className='alert '+(count?'alert-red':'alert-green');alert.textContent=count?`${count} red flag(s) selected — clinician review required before routine workflow.`:'No red flag selected.';}
    updateKpis();
  }
  function getDifferentials(){return state.interpretation?.differentials?.length?state.interpretation.differentials:(currentProtocol()?.differentials||[]);}

  function render(){
    const root=$('complaintIntelligenceRoot'); if(!root)return; const typed=$('primaryComplaint')?.value||'';
    if(!state.protocolId||!protocolById(state.protocolId))state.protocolId=matchProtocol(typed)?.id||'generic';
    const p=currentProtocol();
    const opts=(state.master?.protocols||[]).filter(x=>x.id!=='generic').map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.system)} — ${esc(x.label)}</option>`).join('');
    root.innerHTML=`
      <div class="ci-shell">
        <div class="ci-head"><div><h3>🔬 Advanced Complaint Phenotyping</h3><div class="ci-sub">MCSPI-P1 • adaptive HPI • explainable CDS • research-ready structured history</div></div><span class="ci-badge">Clinician review required</span></div>
        <div class="ci-protocol-row"><div><label>Adaptive Complaint Protocol</label><select id="ciProtocolSelect"><option value="generic">General / Custom — Generic phenotype</option>${opts}</select><div class="ci-help">Auto-detected from the primary complaint. You can override it without changing the patient’s wording.</div></div><div class="ci-auto-note"><b>Detected system:</b> ${esc(p.system||'General')}<br><b>Protocol:</b> ${esc(p.label||'Generic')}</div></div>
        <div class="ci-nav"><button type="button" class="active" data-ci-view="phenotype">1 • Phenotype</button><button type="button" data-ci-view="details">2 • Protocol details</button><button type="button" data-ci-view="learn">3 • Interpret & Learn</button><button type="button" data-ci-view="research">4 • Research summary</button></div>
        <div class="ci-kpis"><div><small>Protocol</small><b id="ciKpiProtocol">${esc(p.label)}</b></div><div><small>Completeness</small><b id="ciKpiComplete">0%</b><span class="ci-bar"><i id="ciKpiCompleteBar"></i></span></div><div><small>Burden snapshot*</small><b id="ciKpiBurden">— /10</b></div><div><small>Red flags</small><b id="ciKpiRed">0</b></div></div>
        <section class="ci-view active" data-ci-panel="phenotype"><div class="ci-note"><b>Research phenotype:</b> frequency, function, sleep and patient-perceived distress are stored as separate raw dimensions. The 0–10 burden snapshot is a <b>custom non-validated summary</b>, not a disease-severity scale.</div>${renderFields(state.master?.genericResearchFields||[])}</section>
        <section class="ci-view" data-ci-panel="details"><div class="ci-note"><b>${esc(p.label)} protocol:</b> show only complaint-specific questions. Findings that belong to physical examination are labelled and should be confirmed in General/Systemic Examination.</div>${renderFields(p.fields||[])}</section>
        <section class="ci-view" data-ci-panel="learn"><div class="ci-actions"><button type="button" class="primary" id="ciInterpretBtn">🧠 Interpret & Learn</button><button type="button" class="secondary" id="ciGenerateBtn">📝 Generate Structured HPI</button><button type="button" class="secondary" id="ciAddHpiBtn">＋ Add to HPI</button></div><div id="ciInterpretation" class="ci-interpret"></div></section>
        <section class="ci-view" data-ci-panel="research"><div class="ci-research-note">Structured output preserves the patient complaint separately from protocol-derived features. It is suitable for longitudinal comparison/research export after governance and validation.</div><label>Structured HPI / Research Summary</label><textarea id="ciSummary" class="ci-summary" placeholder="Generate Structured HPI…">${esc(state.generatedSummary||'')}</textarea><div class="ci-actions"><button type="button" class="secondary" id="ciCopyBtn">📋 Copy Summary</button><button type="button" class="secondary" id="ciJsonBtn">⬇ Export Research JSON</button></div></section>
      </div>`;
    bindRendered(); renderInterpretation(); renderGuidance(typed,checkedRedFlags()); updateKpis();
  }
  function switchView(view){document.querySelectorAll('[data-ci-view]').forEach(b=>b.classList.toggle('active',b.dataset.ciView===view));document.querySelectorAll('[data-ci-panel]').forEach(p=>p.classList.toggle('active',p.dataset.ciPanel===view));}
  function exportJSON(){const data=collect();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MCSPI_${(currentProtocol()?.id||'complaint')}_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  let evalTimer; function scheduleEvaluate(){clearTimeout(evalTimer);evalTimer=setTimeout(()=>{try{evaluate()}catch(err){console.warn('Complaint CDS auto-evaluate',err)}},220)}
  function bindRendered(){
    $('ciProtocolSelect')?.addEventListener('change',e=>{state.protocolId=e.target.value;state.values={};state.interpretation=null;state.generatedSummary='';render();});
    document.querySelectorAll('[data-ci-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.ciView)));
    document.querySelectorAll('[data-ci-field],[data-ci-multi]').forEach(el=>el.addEventListener('change',()=>{collectDOM();syncLegacy();updateKpis();scheduleEvaluate();}));
    document.querySelectorAll('[data-ci-field]').forEach(el=>el.addEventListener('input',()=>{collectDOM();updateKpis();}));
    $('ciInterpretBtn')?.addEventListener('click',evaluate); $('ciGenerateBtn')?.addEventListener('click',()=>{generateSummary();switchView('research')}); $('ciAddHpiBtn')?.addEventListener('click',addToHPI);
    $('ciCopyBtn')?.addEventListener('click',async()=>{const s=$('ciSummary')?.value||generateSummary();try{await navigator.clipboard.writeText(s);statusMsg('Structured HPI copied.')}catch{statusMsg('Copy not available; select the summary manually.')}});
    $('ciJsonBtn')?.addEventListener('click',exportJSON);
  }
  function onPrimaryChanged(){const typed=$('primaryComplaint')?.value||'';const matched=matchProtocol(typed);if(!state.restored||state.protocolId==='generic'||scoreMatch(typed,currentProtocol())<30){state.protocolId=matched.id;state.values={};state.interpretation=null;state.generatedSummary='';}state.restored=false;render();}
  function bindGlobal(){
    let timer; $('primaryComplaint')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(onPrimaryChanged,260)}); $('primaryComplaint')?.addEventListener('change',onPrimaryChanged);
    document.addEventListener('click',e=>{if(e.target.closest('[data-quick-term],[data-smart-term],[data-set-primary]'))setTimeout(onPrimaryChanged,30)});
    document.addEventListener('change',e=>{if(e.target?.name==='redFlag')updateKpis();});
    ['complaintDuration','complaintSeverity','complaintOnset','complaintProgression','complaintLaterality','complaintSite','complaintCharacter'].forEach(id=>{const el=$(id);if(el){el.addEventListener('change',scheduleEvaluate);el.addEventListener('input',scheduleEvaluate);}});
  }
  async function load(){
    try{const r=await fetch('./complaint-intelligence-master-v1.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);state.master=await r.json();state.loaded=true;}catch(err){console.warn('Complaint intelligence fallback mode',err);state.master=fallback;state.loaded=false;}
    protocolIndex=state.master.protocols||[]; render();
  }
  bindGlobal(); load();
  if(new URLSearchParams(location.search).get('action')==='complaint')setTimeout(()=>$('tabComplaint')?.click(),650);
  window.MAHAMAYA_COMPLAINT_ENGINE={state,load,render,collect,restore,evaluate,renderGuidance,getDifferentials,generateSummary,setComplaint(term){if($('primaryComplaint'))$('primaryComplaint').value=term;state.protocolId=matchProtocol(term).id;state.values={};state.interpretation=null;render();}};
})();
