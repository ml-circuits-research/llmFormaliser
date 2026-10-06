import {throwIssues} from './validation.mjs';
// SOP surface records; nested objects exist only in the internal representation.
const ref=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&typeof v.$ref==='string';
const joins=new Set(['and','or','alt']),focuses=new Set(['only','even','also']);
export function flattenCnlRecords(records){
 const ids=new Set(records.map(r=>r.id)),extra=[];let serial=0;
 const id=prefix=>{let value;do{value=prefix+(++serial);}while(ids.has(value));ids.add(value);return value;};
 function flat(v){
  if(ref(v)||v===null||typeof v!=='object')return v;
  if(Array.isArray(v))return v.map(flat);
  if((v.join||v.focus)&&Array.isArray(v.items)){
   const key=id('g'),fields={t:v.join??v.focus,m:v.items.map(flat)};
   extra.push({id:key,type:'G',fields});return {$ref:key};
  }
  throw new Error('Inline objects are not SOP surface values');
 }
 const base=records.map(r=>{
  const fields={};for(const [k,v]of Object.entries(r.fields))if(k!=='mods')fields[k]=flat(v);
  for(const mod of r.fields.mods??[]){const fields={target:{$ref:r.id},label:mod.label,value:flat(mod.value)};if(mod.not!=null)fields.neg=mod.not;extra.push({id:id('m'),type:'MOD',fields});}
  return {...r,fields};
 });
 return [...base,...extra];
}
export function expandCnlRecords(records){
 const byId=new Map(records.map(r=>[r.id,r]));
 const issues=[];
 const add=(r,field,message)=>issues.push({code:'invalid-structure',record:r.id,field,message});
 for(const r of records){
  const f=r.fields;
  if(r.type==='G'){
   for(const key of Object.keys(f))if(!['t','m'].includes(key))add(r,key,`${r.id}: invalid participant group`);
   if(!joins.has(f.t)&&!focuses.has(f.t))add(r,'t',`${r.id}: invalid participant group`);
   if(!Array.isArray(f.m)||!f.m.length)add(r,'m',`${r.id}: invalid participant group`);
  }
  if(r.type==='MOD'){
   for(const key of Object.keys(f))if(!['target','label','value','neg'].includes(key))add(r,key,`${r.id}: invalid modifier record`);
   if(!ref(f.target)||!['E','EV'].includes(byId.get(f.target.$ref)?.type))add(r,'target',`${r.id}: invalid modifier record`);
   if(typeof f.label!=='string'||!f.label)add(r,'label',`${r.id}: invalid modifier record`);
   if(!Object.hasOwn(f,'value'))add(r,'value',`${r.id}: invalid modifier record`);
   if(f.neg!=null&&typeof f.neg!=='boolean')add(r,'neg','Invalid modifier negation');
  }
 }
 throwIssues(issues);
 function expand(v,seen=new Set()){
  if(ref(v)&&byId.get(v.$ref)?.type==='MOD')throw new Error('A modifier declaration cannot be a participant or value');
  if(ref(v)&&byId.get(v.$ref)?.type==='G'){
   if(seen.has(v.$ref))throw new Error('Cyclic participant group');
   const next=new Set(seen);next.add(v.$ref);const f=byId.get(v.$ref).fields;
   return {[joins.has(f.t)?'join':'focus']:f.t,items:f.m.map(x=>expand(x,next))};
  }
  if(Array.isArray(v))return v.map(x=>expand(x,seen));
  if(v&&typeof v==='object'&&!ref(v))return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,expand(x,seen)]));
  return v;
 }
 const safeExpand=(v,r,field)=>{try{return expand(v);}catch(error){add(r,field,error.message);return v;}};
 // Inspect each independent field, including otherwise unused group declarations.
 for(const r of records.filter(r=>r.type==='G'))safeExpand({$ref:r.id},r,'m');
 const base=records.filter(r=>!['MOD','G'].includes(r.type)).map(r=>({...r,fields:Object.fromEntries(Object.entries(r.fields).map(([k,v])=>[k,safeExpand(v,r,k)]))}));
 const targets=new Map(base.map(r=>[r.id,r]));
 for(const r of records.filter(r=>r.type==='MOD')){
  const f=r.fields,mod={label:f.label,value:safeExpand(f.value,r,'value')};if(f.neg!=null)mod.not=f.neg;
  (targets.get(f.target.$ref).fields.mods??=[]).push(mod);
 }
 throwIssues(issues);
 return base;
}
export function assertFlatCnlRecords(records){
 const issues=[];
 const add=(r,field,message)=>issues.push({code:'invalid-structure',record:r.id,field,message});
 const check=(v,r,field)=>{
  if(Array.isArray(v)){v.forEach((x,i)=>check(x,r,field+'.'+i));return;}
  if(v&&typeof v==='object'&&!ref(v))add(r,field,'Inline objects are forbidden in SOP; use MOD and G declarations');
 };
 for(const r of records){
  if(Object.hasOwn(r.fields,'mods'))add(r,'mods','Use MOD declarations instead of mods');
  for(const [key,v] of Object.entries(r.fields))if(key!=='mods')check(v,r,key);
 }
 throwIssues(issues);
}
