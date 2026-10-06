import {publicSop} from './sop-fields.mjs';
import {symbolicDiscourse,roleLexicon} from './symbolic-discourse.mjs';
import {parseSopLng,serializeSopLng} from './sop-lng.mjs';
const ref=id=>({$ref:id});
export function symbolicDraft(source,dialect){
 if(!['clause-sop','event-sop'].includes(dialect))throw new Error('Unknown symbolic export dialect');
 const graph=symbolicDiscourse(source),records=[],event=dialect==='event-sop';let serial=0;
 const add=(type,fields,prefix=type.toLowerCase())=>{const id=prefix+(++serial);records.push({id,type,fields});return id;};
 const nodes=new Map();
 if(event)add('S',{},'s');
 function participant(n){
  if(!event&&(n.proper||n.pronoun))return n.raw;
  const fields=event?{h:n.label}:{};
  if(n.determiner){
   if(event&&n.determiner==='the')fields.d='def';
   else fields.q=['a','an'].includes(n.determiner)?'some':n.determiner;
  }
  if(event&&n.proper)fields.n=n.raw;
  const prefix=event?'x':n.label.replace(/[^A-Za-z0-9_-]+/g,'-')+'-';
  return ref(add('E',fields,prefix));
 }
 function frame(c){
  if(event && c.predicate!=='be' && !roleLexicon[c.predicate]){
   const reason='No reliable symbolic role mapping for predicate '+c.predicate;
   const text=source.slice(...c.span);
   graph.unresolved.push({span:c.span,text,reason});
   graph.diagnostics.push({code:'unmapped-role',message:reason,span:c.span});
   const id=add('UM',{span:text,reason},'u');nodes.set(c.id,id);return id;
  }
  const subj=participant(c.subject),obj=c.content?ref(frame(c.content)):c.object?participant(c.object):null;
  let fields,id;
  if(!event){
   fields={subj,p:c.predicate,st:c.status};if(obj!=null)fields.obj=obj;
   if(c.tense!=='present')fields.t=c.tense;if(c.neg)fields.neg=true;if(c.flags.length)fields.flags=c.flags;
   id=add('EV',fields,'e');
   if(c.modal)add('MOD',{target:ref(id),label:'mode',value:c.modal},'m');
   if(c.time)add('MOD',{target:ref(id),label:'time',value:c.time},'m');
  }else{
   const roles=c.predicate==='be'?['th','val']:roleLexicon[c.predicate];
   // Unknown roles remain diagnostic data rather than guessed agent/theme slots.
   if(!roles)throw new Error('Symbolic frame lacks a role mapping: '+c.predicate);
   fields={p:c.predicate,[roles[0]]:subj,t:c.tense,st:c.status==='directive'?'requested':c.status==='queried'?'unasserted':c.status};
   if(obj!=null)fields[c.content?'ct':roles[1]??'th']=obj;
   if(c.flags.includes('PROG'))fields.as='progressive';if(c.flags.includes('PERF'))fields.as='perfect';if(c.time)fields.tm=c.time;
   id=add(c.predicate==='be'?'ST':'EV',fields,'e');let root=id;
   if(c.neg)root=add('OP',{t:'negation',sc:ref(root)},'o');
   if(c.modal){const deontic=['must','should','may'].includes(c.modal);root=add('OP',{t:deontic?'deontic':'modal',v:c.modal,sc:ref(root)},'o');}
   if(root!==id)fields.root=ref(root);
   if(c.status==='queried')add('Q',{t:'yn',target:ref(root),exp:'truth-value'},'q');
  }
  nodes.set(c.id,id);return id;
 }
 for(const c of graph.clauses)frame(c);
 for(const l of graph.links){
  if(event)add('L',{t:l.type,f:ref(nodes.get(l.from)),to:ref(nodes.get(l.to))},'l');
  else if(l.type==='contrast')add('MOD',{target:ref(nodes.get(l.to)),label:'but',value:ref(nodes.get(l.from))},'m');
 }
 for(const m of graph.markers)add('DISC',{target:ref(nodes.get(m.target)),t:m.function,span:m.span},'d');
 for(const u of graph.unresolved)add('UM',{span:u.text.trim(),reason:u.reason},'u');
 return {dialect,graph,raw:publicSop(records,event?'event':'clause'),recordCount:records.length};
}
// Lexical/structural retention is diagnostic only: preserved declarations can
// still be wrong and renamed equivalents can look different. Never score it as
// semantic success. Reference names are removed from signatures to reduce noise.
export function draftRetention(draft,raw){
 try{
  const signature=r=>JSON.stringify([r.type,Object.entries(r.fields).map(([k,v])=>[k,JSON.stringify(v).replace(/"\$ref":"[^"]+"/g,'"$ref":"reference"')]).sort()]);
  const a=parseSopLng(draft).filter(r=>!['S','UM','DISC'].includes(r.type)),b=parseSopLng(raw).filter(r=>!['S','UM','DISC'].includes(r.type));
  const counts=new Map();for(const r of b){const key=signature(r);counts.set(key,(counts.get(key)??0)+1);}
  let retained=0;for(const r of a){const key=signature(r);if(counts.get(key)>0){retained++;counts.set(key,counts.get(key)-1);}}
  return {draftRecords:a.length,finalRecords:b.length,matchedSignatures:retained,draftRetention:a.length?retained/a.length:null,note:'Approximate declaration-signature overlap, not semantic reuse or equivalence; Declaration IDs and reference names ignored; role fields, status, tense and literal values compared.'};
 }catch{return {draftRetention:null,note:'Retention unavailable because one SOP document is not parseable.'};}
}
