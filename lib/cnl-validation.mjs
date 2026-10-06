import {throwIssues} from './validation.mjs';
const allowed={E:new Set(['q','adj','plural','mods']),DISC:new Set(['target','t','span']),UM:new Set(['target','span','reason']),EV:new Set(['st','embed','subj','p','obj','neg','t','flags','mods','formula','logic','args','question','answer','act'])};
const flags=new Set(['PERF','PROG','HABIT','POLITE','EMPH']);
const statuses=new Set(['asserted','unasserted','queried','directive','expressive']);
const ref=v=>v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.$ref==='string';
export function validateCnlRecords(records){
 const issues=[];
 const add=(r,field,message)=>issues.push({code:'invalid-structure',record:r.id,field,message});
 function value(v,r,field){
  if(typeof v==='string'&&v.length||typeof v==='number'&&Number.isFinite(v)||ref(v))return;
  if(!v||Array.isArray(v)||typeof v!=='object'){add(r,field,'Invalid participant value');return;}
  if(!Array.isArray(v.items)||!v.items.length)add(r,field+'.items','Participant group needs items');
  if(v.join&&!['and','or','alt'].includes(v.join))add(r,field+'.join','Invalid participant join');
  if(v.focus&&!['only','even','also'].includes(v.focus))add(r,field+'.focus','Invalid focus');
  if(!!v.join===!!v.focus||Object.keys(v).some(k=>!['join','focus','items'].includes(k)))add(r,field,'Invalid participant group');
  if(Array.isArray(v.items))v.items.forEach((v,i)=>value(v,r,field+'.items.'+i));
 }
 for(const r of records){
  const f=r.fields;
  if(!allowed[r.type]){add(r,'type',`Unknown Clause-SOP record type: ${r.type}`);continue;}
  for(const key of Object.keys(f))if(!allowed[r.type].has(key))add(r,key,`Unknown ${r.type} field: ${key}`);
  if(f.mods!=null){
   if(!Array.isArray(f.mods))add(r,'mods','mods must be a list');
   else for(const [i,mod] of f.mods.entries()){
    const field='mods.'+i;
    if(!mod||typeof mod!=='object'){add(r,field,'Invalid modifier');continue;}
    if(typeof mod.label!=='string'||!mod.label||!Object.hasOwn(mod,'value')||Object.keys(mod).some(k=>!['label','value','not'].includes(k)))add(r,field,'Invalid modifier');
    if(mod.not!=null&&typeof mod.not!=='boolean')add(r,field+'.not','Invalid modifier negation');
    if(Object.hasOwn(mod,'value'))value(mod.value,r,field+'.value');
   }
  }
  if(['DISC','UM'].includes(r.type)){
   if(typeof f.span!=='string'||!f.span.trim())add(r,'span','Discourse and unmapped records need their source span');
   if(f.target!=null&&!ref(f.target))add(r,'target','Discourse target must be a reference');
   if(r.type==='DISC'&&(typeof f.t!=='string'||!f.t))add(r,'t','Discourse record needs a function');
   if(f.reason!=null&&typeof f.reason!=='string')add(r,'reason','Unmapped reason must be text');
   continue;
  }
  if(r.type==='E'){
   if(f.adj!=null&&(!Array.isArray(f.adj)||!f.adj.every(x=>['string','number','boolean'].includes(typeof x))))add(r,'adj','traits must be a list of literals');
   if(f.q!=null&&typeof f.q!=='string'&&!(typeof f.q==='number'&&Number.isFinite(f.q)))add(r,'q','q must be text or a finite number');
   if(f.plural!=null&&typeof f.plural!=='boolean')add(r,'plural','plural must be boolean');
   continue;
  }
  if(!statuses.has(f.st??'asserted'))add(r,'st','Unknown assertion status');
  if(f.question!=null&&!['wh','yn','alternative'].includes(f.question))add(r,'question','Unknown question kind');
  if(f.answer!=null&&typeof f.answer!=='string')add(r,'answer','Answer description must be text');
  if(f.act!=null&&!['request','command','suggest','offer','promise','wish','ask','assert','express'].includes(f.act))add(r,'act','Unknown speech act');
  if(f.t!=null&&!['past','present','future'].includes(f.t))add(r,'t','Unknown tense');
  if(f.flags!=null&&(!Array.isArray(f.flags)||new Set(f.flags).size!==f.flags.length||f.flags.some(x=>!flags.has(x))))add(r,'flags','Unknown or duplicate flag');
  if(f.neg!=null&&typeof f.neg!=='boolean')add(r,'neg','neg must be boolean');
  if(f.embed!=null&&(typeof f.embed!=='boolean'||f.st!=='queried'))add(r,'embed','embed belongs to queried events');
  if(f.st==='expressive'){if(f.obj==null)add(r,'obj','Expressive event needs obj');}
  else{
   if([f.p!=null,f.formula!=null,f.logic!=null].filter(Boolean).length!==1)add(r,'p/formula/logic','An event needs exactly one p, formula or logic');
   if(f.p!=null&&(typeof f.p!=='string'||!f.p||f.subj==null))add(r,'p/subj','Verbal event needs predicate and subject');
   if(f.formula!=null&&typeof f.formula!=='string')add(r,'formula','Formula must be text');
   if(f.logic!=null&&(!['either','both','not'].includes(f.logic)||!Array.isArray(f.args)||!f.args.length||f.args.some(x=>!ref(x))))add(r,'logic/args','Logic needs referenced args');
  }
  if(f.subj!=null)value(f.subj,r,'subj');if(f.obj!=null)value(f.obj,r,'obj');
 }
 if(!records.some(r=>r.type==='EV'))issues.push({code:'invalid-structure',message:'No events'});
 throwIssues(issues);
}
