const forms=new Set(['declarative','interrogative','imperative','exclamative','fragment']);
const speechActs=new Set(['assert','ask','request','command','suggest','offer','promise','intend','wish','permit','prohibit','define','acknowledge','other']);
const frameKinds=new Set(['event','state','relation','existence','identity','definition','comparison']);

export function validateIR(ir){
 const errors=[];
 if(!forms.has(ir.form))errors.push(`invalid form ${ir.form}`);
 if(!speechActs.has(ir.speech_act))errors.push(`invalid speech_act ${ir.speech_act}`);
 for(const k of ['entities','frames','relations','missing','ambiguities','unmapped'])if(!Array.isArray(ir[k]))errors.push(`${k} must be array`);
 const entityIds=new Set((ir.entities||[]).map(e=>e.id));
 const frameIds=new Set((ir.frames||[]).map(f=>f.id));
 const all=new Set([...entityIds,...frameIds]);
 if(all.size!==(ir.entities||[]).length+(ir.frames||[]).length)errors.push('duplicate entity/frame id');
 for(const e of ir.entities||[]){
  if(!e.id) errors.push('entity missing id');
  if(typeof e.type!=='string') errors.push(`${e.id}: entity type must be string`);
  if(!e.head&&!e.name&&!e.surface) errors.push(`${e.id}: entity missing lexical anchor`);
 }
 for(const f of ir.frames||[]){
  if(!frameKinds.has(f.kind))errors.push(`${f.id}: invalid kind ${f.kind}`);
  if(!f.predicate)errors.push(`${f.id}: missing predicate`);
  for(const a of f.arguments||[])if(!all.has(a.ref))errors.push(`${f.id}: dangling ref ${a.ref}`);
  const opIds=new Set((f.operators||[]).map(o=>o.id));
  if(opIds.size!==(f.operators||[]).length)errors.push(`${f.id}: duplicate operator id`);
  for(const o of f.operators||[]){
   if(o.scope!==f.id&&!opIds.has(o.scope))errors.push(`${f.id}: dangling operator scope ${o.scope}`);
   if(o.target && !all.has(o.target)) errors.push(`${f.id}: dangling operator target ${o.target}`);
  }
  if(f.operator_root && !opIds.has(f.operator_root)) errors.push(`${f.id}: bad operator_root ${f.operator_root}`);
 }
 for(const r of ir.relations||[])if(!frameIds.has(r.from)||!frameIds.has(r.to))errors.push(`dangling relation ${r.from}->${r.to}`);
 for(const r of ir.entity_relations||[]){
   const from=r.from||r.modifier, to=r.to||r.head;
   if(!all.has(from)||!all.has(to))errors.push(`dangling entity_relation ${from}->${to}`);
 }
 for(const g of ir.logical_groups||[])for(const m of g.members||[])if(!frameIds.has(m)&&!entityIds.has(m))errors.push(`logical group dangling ${m}`);
 for(const q of ir.quantifier_scopes||[])if(!entityIds.has(q.entity)||!frameIds.has(q.scope))errors.push(`bad quantifier scope ${q.entity}/${q.scope}`);
 for(const p of ir.presuppositions||[]){
   const t=p.target||p.entity;
   if(t && !all.has(t))errors.push(`bad presupposition target ${t}`);
 }
 for(const p of ir.conventional_implicatures||[]){
   if(p.target && !all.has(p.target))errors.push(`bad implicature target ${p.target}`);
 }
 return errors;
}

export function automaticScore(ir){
 const errors=validateIR(ir);
 let s=100-errors.length*10-(ir.unmapped||[]).length*5;
 if((ir.frames||[]).some(f=>String(f.predicate).includes('[UNKNOWN]')))s-=10;
 return Math.max(0,s);
}
