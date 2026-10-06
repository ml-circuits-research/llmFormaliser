// Semantics-preserving CNL renderer for Event IR v4.
// Goal: every semantic distinction in the IR has a visible textual destination.

function propText(p){
  if(typeof p==='string')return p;
  if(!p)return '';
  if(p.value!==undefined){
    if(p.predicate==='of') return `of ${p.value}`;
    return `${p.predicate} ${p.value}`;
  }
  return p.predicate||'';
}
function entityText(e){
  if(!e)return '[UNKNOWN]';
  if(e.name)return e.name;
  const pre=[],post=[];
  for(const p of e.properties||[]){const t=propText(p);if(!t)continue;if(t.startsWith('of '))post.push(t);else pre.push(t);}
  let q='';const x=e.quantifier;
  if(x?.kind==='exact')q=`exactly ${x.value} `;
  else if(x?.kind==='at_least')q=`at least ${x.value} `;
  else if(x?.kind==='at_most')q=`at most ${x.value} `;
  else if(x?.kind==='all')q='every ';
  else if(x?.kind==='none')q='no ';
  else if(x?.kind==='some')q='some ';
  else if(e.definiteness==='definite')q='the ';
  else if(e.definiteness==='indefinite')q='a ';
  const core=`${q}${pre.length?pre.join(' ')+' ':''}${e.head||e.surface||e.id}`.trim();
  return `${core}${post.length?' '+post.join(' '):''}`;
}
function stable(v){
  if(v===null)return 'null';
  if(Array.isArray(v))return `[${v.map(stable).join(', ')}]`;
  if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${k}=${stable(v[k])}`).join('; ')}}`;
  return String(v);
}

export function toCNLv4(ir){
  const emap=new Map((ir.entities||[]).map(e=>[e.id,e]));
  const fmap=new Map((ir.frames||[]).map(f=>[f.id,f]));
  const refText=id=>emap.has(id)?entityText(emap.get(id)):fmap.has(id)?`proposition ${id}`:`${id}`;
  const renderRefStructure=v=>{
    if(typeof v==='string')return (emap.has(v)||fmap.has(v))?refText(v):v;
    if(Array.isArray(v))return `[${v.map(renderRefStructure).join(', ')}]`;
    if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${k}=${renderRefStructure(v[k])}`).join('; ')}}`;
    return String(v);
  };

  function coreFrame(f){
    const a={};for(const x of f.arguments||[])(a[x.role]??=[]).push(refText(x.ref));
    const one=r=>a[r]?.[0]; let core;
    if(f.kind==='state')core=`${one('experiencer')||one('theme')||one('agent')||'[UNKNOWN]'} is ${f.predicate}`;
    else if(f.kind==='comparison'){
      const c=f.comparison||{};core=`${one('theme')||one('agent')||'[UNKNOWN]'} is ${c.relation||f.predicate}${c.dimension?` on ${c.dimension}`:''} relative to ${one('standard')||'[UNKNOWN]'}`;
    } else if(f.kind==='existence')core=`there exists ${one('theme')||one('patient')||'[UNKNOWN]'}`;
    else if(f.kind==='identity')core=`${one('theme')||one('agent')||'[UNKNOWN]'} is identical to ${one('value')||one('standard')||one('patient')||'[UNKNOWN]'}`;
    else if(f.kind==='definition')core=`${one('theme')||one('agent')||'[UNKNOWN]'} is defined as ${one('value')||one('content')||'[UNKNOWN]'}`;
    else {
      const s=one('agent')||one('experiencer')||one('theme')||'[UNKNOWN]';const z=[`${s} ${f.predicate}`];
      for(const r of ['patient','theme'])for(const v of a[r]||[])if(v!==s)z.push(v);
      for(const v of a.recipient||[])z.push(`to ${v}`);
      for(const v of a.beneficiary||[])z.push(`for ${v}`);
      for(const v of a.instrument||[])z.push(`using ${v}`);
      for(const v of a.source||[])z.push(`from ${v}`);
      for(const v of a.destination||[])z.push(`to ${v}`);
      for(const v of a.location||[])z.push(`at ${v}`);
      for(const v of a.possessor||[])z.push(`with possessor ${v}`);
      for(const v of a.possessed||[])z.push(`with possessed item ${v}`);
      for(const v of a.value||[])z.push(`with value ${v}`);
      for(const v of a.standard||[])z.push(`relative to ${v}`);
      for(const v of a.topic||[])z.push(`about ${v}`);
      for(const v of a.content||[])z.push(`with content ${v}`);
      core=z.join(' ');
    }
    for(const t of f.time||[])core+=` [time ${t.relation||'at'} ${t.value??t.anchor??stable(t)}]`;
    for(const l of f.location||[])core+=` [location ${l.value??stable(l)}]`;
    for(const m of f.manner||[])core+=` [manner ${m.value??stable(m)}]`;
    if(f.tense&&f.tense!=='unknown')core+=` [tense=${f.tense}]`;
    if(f.aspect&&f.aspect!=='simple')core+=` [aspect=${f.aspect}]`;
    return core;
  }

  function operators(f,text){
    const ops=new Map((f.operators||[]).map(o=>[o.id,o]));
    const render=id=>{
      if(id===f.id)return text;const o=ops.get(id);if(!o)return text;const inner=render(o.scope);
      if(o.type==='negation')return `it is not the case that (${inner})`;
      if(o.type==='epistemic')return `it is epistemically ${o.value} that (${inner})`;
      if(o.type==='deontic')return `it is deontically ${o.value} that (${inner})`;
      if(o.type==='dynamic'&&o.value==='capable')return `${refText(o.target)||'the participant'} is capable of (${inner})`;
      if(o.type==='focus'&&o.value==='exclusive')return `${inner}; ONLY-focus applies to ${refText(o.target)} over ${emap.has(o.domain)?refText(o.domain):(o.domain||'a contextual alternative set')}`;
      if(o.type==='focus'&&o.value==='scalar_even')return `${inner}; EVEN-focus marks ${refText(o.target)} as unexpected/extreme on ${o.domain||'a contextual scale'}`;
      if(o.type==='focus'&&o.value==='cleft_exhaustive')return `${inner}; cleft-focus is exhaustive for ${refText(o.target)} over the relevant role`;
      if(o.type==='approximation'&&o.value==='almost')return `ALMOST(${inner}); occurrence is not entailed`;
      if(o.type==='phase'&&o.value==='stop')return `STOP(${inner})`;
      if(o.type==='phase'&&o.value==='start')return `START(${inner})`;
      if(o.type==='phase'&&o.value==='continue')return `CONTINUE(${inner})`;
      if(o.type==='iteration'&&o.value==='again')return `AGAIN(${inner})`;
      if(o.type==='iteration'&&o.value==='twice')return `TWICE(${inner})`;
      if(o.type==='success'&&o.value==='manage')return `MANAGE(${inner}); success is entailed`;
      if(o.type==='success'&&o.value==='fail')return `FAIL-TO(${inner}); success is not entailed`;
      if(o.type==='volitional'&&o.value==='deliberate')return `DELIBERATELY(${inner})`;
      const extras=[];for(const k of ['target','domain','entails_occurrence','entails_success'])if(o[k]!==undefined)extras.push(`${k}=${renderRefStructure(o[k])}`);
      return `${o.type}${o.value?`:${o.value}`:''}(${inner})${extras.length?` [${extras.join('; ')}]`:''}`;
    };
    return f.operator_root?render(f.operator_root):text;
  }

  const lines=[];
  lines.push(`Sentence form: ${ir.form}. Speech act: ${ir.speech_act}.${ir.speech_act_details?` Illocution details: ${stable(ir.speech_act_details)}.`:''}`);
  for(const e of ir.entities||[]){
    const extras=[];if(e.type!==undefined)extras.push(`type=${stable(e.type)}`);if(e.coreference)extras.push(`coreference=${refText(e.coreference)}`);
    lines.push(`Entity ${e.id}: ${entityText(e)}${extras.length?`; ${extras.join('; ')}`:''}.`);
  }
  for(const f of ir.frames||[]){
    let t=operators(f,coreFrame(f));
    const p={asserted:'It is asserted that',queried:'It is queried whether',hypothetical:'Hypothetically',conditional:'Conditionally',believed:`According to ${f.source||'the reported source'},`,reported:`According to ${f.source||'the reported source'},`,commanded:'It is commanded that',requested:'It is requested that',suggested:'It is suggested that',desired:'It is desired that',intended:'It is intended that',promised:'It is promised that',alternative:'Alternative',presupposed:'It is presupposed that',attributed:`Attributed to ${f.source||'the reported source'},`}[f.status||'asserted'];
    lines.push(`${f.id}: ${p?p+' ':''}${t}.`);
  }
  for(const r of ir.relations||[]){let s=`Relation: ${r.from} ${r.type} ${r.to}`;for(const k of ['mood','semantics','achievement','scope','anchor'])if(r[k]!==undefined)s+=`; ${k}=${renderRefStructure(r[k])}`;lines.push(s+'.');}
  for(const r of ir.entity_relations||[]){let s=`Entity relation: ${refText(r.from||r.modifier)} ${r.type} ${refText(r.to||r.head)}`;for(const k of ['semantics','scope','excluding'])if(r[k]!==undefined)s+=`; ${k}=${renderRefStructure(r[k])}`;lines.push(s+'.');}
  for(const r of ir.discourse_relations||[])lines.push(`Discourse relation: ${r.from} ${r.type} ${r.to}${r.semantics?`; semantics=${renderRefStructure(r.semantics)}`:''}.`);
  for(const g of ir.logical_groups||[])lines.push(`Logical group ${g.id}: ${g.status||'asserted'} ${String(g.type).toUpperCase()}(${(g.members||[]).map(refText).join(', ')}); semantics=${g.semantics||'standard'}${g.inclusive!==undefined?`; inclusive=${g.inclusive}`:''}.`);
  for(const x of ir.logical_scope||[])lines.push(`Logical scope: ${renderRefStructure(x)}.`);
  for(const q of ir.quantifier_scopes||[])lines.push(`Quantifier: ${q.kind}(${refText(q.entity)}) scopes over ${refText(q.scope)}; order=${q.order??'unspecified'}${q.dependent_on?`; depends-on=${q.dependent_on.map(refText).join(', ')}`:''}${q.distributivity?`; distributivity=${q.distributivity}`:''}${q.semantics?`; semantics=${q.semantics}`:''}.`);
  for(const p of ir.presuppositions||[])lines.push(`Presupposition: ${p.type}; target=${refText(p.target??p.entity??'context')}${p.content?`; content=${renderRefStructure(p.content)}`:''}.`);
  for(const p of ir.conventional_implicatures||[])lines.push(`Conventional implicature: ${p.type}; target=${p.target?refText(p.target):'context'}${p.content?`; content=${renderRefStructure(p.content)}`:''}.`);
  for(const d of ir.context_dependencies||[])lines.push(`Context dependency: span=${JSON.stringify(d.span)}; type=${d.type}; status=${d.status}; components=${renderRefStructure(d.components)}.`);
  for(const m of ir.mentions||[])lines.push(`Mention: ${JSON.stringify(m.span)} refers to ${refText(m.ref)}.`);
  for(const a of ir.ambiguities||[])lines.push(`Ambiguity: span=${JSON.stringify(a.span)}; type=${a.type}; options=${(a.options||[]).map(renderRefStructure).join(' | ')}; preferred=${a.preferred===null?'none':renderRefStructure(a.preferred)}.`);
  for(const m of ir.missing||[])lines.push(`Missing: ${typeof m==='string'?m:renderRefStructure(m)}.`);
  for(const u of ir.unmapped||[])lines.push(`Unmapped: ${typeof u==='string'?u:renderRefStructure(u)}.`);
  if(ir.question)lines.push(`Question: type=${ir.question.type}; target=${ir.question.target?refText(ir.question.target):'proposition'}; expected=${ir.question.expected_type??'truth-value'}.`);
  return lines.join('\n');
}
