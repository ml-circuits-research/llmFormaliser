import {validateCnlRecords} from './cnl-validation.mjs';
import {throwIssues,diagnosticIssues,locateIssues} from './validation.mjs';
import {flattenCnlRecords,expandCnlRecords,assertFlatCnlRecords} from './cnl-records.mjs';
import {formalizationInput,normalizeModifierLabels} from './formalization-input.mjs';
import {parseSopLng,serializeSopLng} from './sop-lng.mjs';
const ref=v=>v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.$ref==='string';
function valueText(v){
 if(ref(v))return v.$ref;
 if(Array.isArray(v))return v.map(valueText).join(', ');
 if(v&&typeof v==='object'){
  if(v.join)return '('+v.items.map(valueText).join(v.join==='alt'?' OR-UNRESOLVED ':` ${v.join.toUpperCase()} `)+')';
  if(v.focus)return `${v.focus.toUpperCase()}(${v.items.map(valueText).join(', ')})`;
  return JSON.stringify(v);
 }
 return String(v);
}
export function convertClauseSop(raw,{legacy=false}={}){
 let stage='presentation',normalizations=[],sourceText='';
 try{
  const input=formalizationInput(raw);normalizations=input.normalizations;sourceText=input.text;stage='syntax';
  let records;
  try{records=parseSopLng(input.text);}catch(originalError){
   if(!legacy)throw originalError;
   const normalized=normalizeModifierLabels(input.text);
   if(!normalized.normalizations.length)throw originalError;
   records=parseSopLng(normalized.text);normalizations.push(...normalized.normalizations);
  }
  stage='structure';
  for(const r of records)for(const key of ['flags','adj']){
   if(typeof r.fields[key]==='string'){r.fields[key]=[r.fields[key]];normalizations.push({record:r.id,field:key,action:'singleton-list'});}
   if(key==='flags'&&Array.isArray(r.fields.flags)&&new Set(r.fields.flags).size!==r.fields.flags.length){r.fields.flags=[...new Set(r.fields.flags)];normalizations.push({record:r.id,field:key,action:'deduplicate-flags'});}
  }

  const issues=[];
  const collect=fn=>{try{return fn();}catch(error){issues.push(...diagnosticIssues(error,stage));return null;}};
  if(!legacy)collect(()=>assertFlatCnlRecords(records));
  const expanded=collect(()=>expandCnlRecords(records));
  collect(()=>validateCnlRecords(expanded??records.filter(r=>!['G','MOD'].includes(r.type))));
  throwIssues(issues);
  records=expanded;
  const lines=[];
  for(const r of records){
   const f=r.fields;
   if(['DISC','UM'].includes(r.type)){
    const target=f.target?`attached to ${f.target.$ref}`:'applies to the whole utterance';
    lines.push(r.type==='DISC'?`Discourse marker ${r.id}, ${target}: function=${f.t}; source wording=${JSON.stringify(f.span)}.`:`Uninterpreted wording ${r.id}, ${target}: source wording=${JSON.stringify(f.span)}${f.reason?'; reason='+f.reason:''}.`);
    continue;
   }
   if(r.type==='E'){
    let text=`Entity ${r.id}`;
    if(f.q!=null)text+=`; quantifier=${valueText(f.q)}`;
    if(f.adj?.length)text+=`; adjectives=${f.adj.join(' ')}`;
    if(f.plural!=null)text+=`; plural=${f.plural}`;
    for(const m of f.mods??[])text+=`; noun modifier ${m.label}=${m.not?'NOT ':''}${valueText(m.value)}`;
    lines.push(text+'.');continue;
   }
   const status={asserted:'It is asserted that',unasserted:'Unasserted embedded content:',queried:f.embed?'Embedded question whether':'Direct question whether',directive:'It is requested or ordered that',expressive:'Expressive utterance:'}[f.st??'asserted'];
   let body=f.st==='expressive'?valueText(f.obj):f.formula!=null?`FORMULA(${f.formula})`:f.logic!=null?`${f.logic.toUpperCase()}(${f.args.map(valueText).join(', ')})`:`${valueText(f.subj)} ${f.p}${f.obj!=null?' '+valueText(f.obj):''}`;
   if(f.neg)body=`NOT(${body})`;
   const details=[`tense=${f.t??'present'}`];if(f.flags?.length)details.push(`flags=${f.flags.join(',')}`);
   for(const m of f.mods??[])details.push(`event modifier ${m.label}=${m.not?'NOT ':''}${valueText(m.value)}`);
   lines.push(`${r.id}: ${status} ${body}${details.length?' ['+details.join('; ')+']':''}.`);
  }
  return {ok:true,normalizations,cnl:lines.join('\n'),sopLng:serializeSopLng(flattenCnlRecords(records)),ir:records,notation:'Clause-SOP: grammatical subject/predicate/complement. Present is the default tense when the SOP t field is absent. Unasserted content is not a speaker claim. Modal event modifiers apply to the possibly negated verb; NOT on the modifier negates the modal. PERF perfect; PROG progressive; HABIT habitual; POLITE polite; EMPH emphatic. OR-UNRESOLVED retains alternatives with the preferred candidate first. Noun and event modifiers have different attachment. DISC preserves pragmatic or discourse function and its scope; it is not a new factual event. An unspecified function is not an invented emotion. UM retains source wording whose meaning has not been formalized; do not automatically equate retained wording with preserved semantics.'};
 }catch(error){return {ok:false,stage,error:error.message,errors:locateIssues(diagnosticIssues(error,stage),sourceText),normalizations};}
}

// Translate prototype examples into the one SOP surface syntax, keeping their semantics.
export function nativeCnlToSop(document){
 const ids=new Set([...document.entities,...document.events].map(x=>x.id));
 const link=v=>typeof v==='string'?ids.has(v)?{$ref:v}:v:Array.isArray(v)?v.map(link):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,link(x)])):v;
 const records=document.entities.map(e=>({id:e.id,type:'E',fields:Object.fromEntries(Object.entries(e).filter(([k])=>k!=='id').map(([k,v])=>[k==='quant'?'q':k,k==='mods'?link(v):v]))}));
 for(const e of document.events){
  const fields={st:({fact:'asserted',unasserted:'unasserted',question:'queried',embedded_question:'queried',directive:'directive',expressive:'expressive'})[e.type??'fact']};
  if(e.type==='embedded_question')fields.embed=true;
  for(const [from,to] of [['who','subj'],['verb','p'],['what','obj'],['not','neg'],['tags','mods'],['formula','formula'],['logic','logic'],['args','args']])if(Object.hasOwn(e,from))fields[to]=['who','what','tags','args'].includes(from)?link(e[from]):e[from];
  if(e.flags?.includes('PAST'))fields.t='past';if(e.flags?.includes('FUTURE'))fields.t='future';
  const rest=(e.flags??[]).filter(x=>!['PAST','FUTURE'].includes(x));if(rest.length)fields.flags=rest;
  records.push({id:e.id,type:'EV',fields});
 }
 return serializeSopLng(flattenCnlRecords(records));
}
