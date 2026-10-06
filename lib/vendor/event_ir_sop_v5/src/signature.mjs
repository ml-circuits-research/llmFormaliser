function entityKey(e){
  const q=e.quantifier?`${e.quantifier.kind}:${e.quantifier.value??''}`:'q:none';
  const props=(e.properties||[]).map(p=>typeof p==='string'?p:p.predicate).sort().join(',');
  return `${e.name||e.head||e.surface}|${q}|${props}`;
}

export function semanticSignature(ir){
  const emap=new Map((ir.entities||[]).map(e=>[e.id,e]));
  const fmap=new Map((ir.frames||[]).map(f=>[f.id,f]));
  const ref=id=>emap.has(id)?`E:${entityKey(emap.get(id))}`:fmap.has(id)?`F:${fmap.get(id).predicate}`:`U:${id}`;
  const atoms=[];
  atoms.push(`FORM:${ir.form}`); atoms.push(`ACT:${ir.speech_act}`);
  for(const e of ir.entities||[]){
    atoms.push(`ENTITY:${entityKey(e)}`);
    if(e.coreference) atoms.push(`COREF:${entityKey(e)}=>${ref(e.coreference)}`);
  }
  for(const f of ir.frames||[]){
    atoms.push(`FRAME:${f.kind}:${f.predicate}:${f.status||'asserted'}:${f.tense||'unknown'}:${f.aspect||'unknown'}`);
    for(const a of f.arguments||[]) atoms.push(`ARG:${f.predicate}:${a.role}:${ref(a.ref)}`);
    const ops=new Map((f.operators||[]).map(o=>[o.id,o]));
    const path=[]; let x=f.operator_root; const seen=new Set();
    while(x&&ops.has(x)&&!seen.has(x)){seen.add(x);const o=ops.get(x);path.push(`${o.type}:${o.value??''}`);x=o.scope;}
    if(path.length) atoms.push(`OPS:${f.predicate}:${path.join('>')}`);
    for(const t of f.time||[]) atoms.push(`TIME:${f.predicate}:${t.relation||'at'}:${t.value??t.anchor??JSON.stringify(t)}`);
    for(const m of f.manner||[]) atoms.push(`MANNER:${f.predicate}:${m.value??JSON.stringify(m)}`);
  }
  for(const r of ir.relations||[]) atoms.push(`REL:${fmap.get(r.from)?.predicate||r.from}:${r.type}:${fmap.get(r.to)?.predicate||r.to}:${r.mood||''}:${r.semantics||''}`);
  for(const r of ir.entity_relations||[]) atoms.push(`EREL:${r.type}:${ref(r.from||r.modifier)}:${ref(r.to||r.head)}`);
  for(const g of ir.logical_groups||[]) atoms.push(`GROUP:${g.type}:${(g.members||[]).map(ref).sort().join('+')}:${g.semantics||''}`);
  for(const q of ir.quantifier_scopes||[]) atoms.push(`QSCOPE:${q.kind}:${ref(q.entity)}:${fmap.get(q.scope)?.predicate||q.scope}:${q.order??''}:${q.distributivity||''}:${q.semantics||''}`);
  for(const p of ir.presuppositions||[]) atoms.push(`PRESUP:${p.type}:${ref(p.target||p.entity)}`);
  for(const p of ir.conventional_implicatures||[]) atoms.push(`IMPL:${p.type}:${p.target?ref(p.target):''}`);
  for(const a of ir.ambiguities||[]) atoms.push(`AMB:${a.type}:${a.span}`);
  if(ir.question) atoms.push(`Q:${ir.question.type}:${ir.question.expected_type||''}`);
  return new Set(atoms.sort());
}

export function signatureF1(gold,candidate){
  const g=semanticSignature(gold), c=semanticSignature(candidate);
  let hit=0; for(const x of c)if(g.has(x))hit++;
  const precision=c.size?hit/c.size:0, recall=g.size?hit/g.size:0;
  const f1=precision+recall?2*precision*recall/(precision+recall):0;
  return {precision,recall,f1,hit,gold:g.size,candidate:c.size};
}
