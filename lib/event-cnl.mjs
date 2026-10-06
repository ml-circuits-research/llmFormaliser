import {fieldNames} from './sop-fields.mjs';
import {throwIssues} from './validation.mjs';
// Native typed SOP graph -> controlled natural language. Every supplied field has
// an explicit textual destination; no conversion through the narrower v4 IR.
const frameTypes=new Set(['EV','ST','RE','EX','ID','DF','CP']);
const types=new Set(['S','E',...frameTypes,'OP','L','ER','G','QS','LS','PS','CI','CX','AM','MS','Q','MN','UM','DISC']);
const names={S:'Discourse',E:'Entity',EV:'Event proposition',ST:'State proposition',RE:'Relation proposition',EX:'Existence proposition',ID:'Identity proposition',DF:'Definition proposition',CP:'Comparison proposition',OP:'Scoped operator',L:'Propositional link',ER:'Entity relation',G:'Logical group',QS:'Quantified proposition',LS:'Logical scope',PS:'Presupposition',CI:'Conventional implicature',CX:'Context dependency',AM:'Unresolved alternatives',MS:'Missing information',Q:'Question',MN:'Mention',UM:'Unmapped information',DISC:'Discourse marker'};
const labels={h:'lexical head',ty:'semantic type',n:'proper name',d:'definiteness',q:'quantifier',qv:'numeric quantity',pr:'properties',of:'of/possessor/origin',co:'coreference',sf:'surface form',p:'predicate',st:'semantic status',t:'tense',as:'aspect',root:'outermost operator',tm:'time',pl:'place',man:'manner',ag:'agent',pa:'patient',th:'theme',xp:'experiencer',sm:'stimulus',rc:'recipient',bn:'beneficiary',ins:'instrument',src:'source',dst:'destination',loc:'location',psr:'possessor',psd:'possessed item',val:'value',std:'standard',top:'topic',ct:'propositional content',by:'attributed source',cause:'cause',cur:'currency',target:'target',trg:'target',sc:'scope',v:'operator value',o:'scope order',ent:'quantified entity',dep:'depends on',dist:'distribution',dim:'comparison dimension',cmp:'comparison relation',dom:'domain',alts:'alternatives',cue:'surface cue',scale:'scale',embed:'embedded',exp:'expected answer type',a:'endpoint A',b:'endpoint B',f:'from',to:'to',item:'item',owner:'owner',m:'members',exists:'existence of',unique:'uniqueness of',prior:'prior occurrence',true:'truth presupposed',pref:'preferred alternative',span:'source span'};
export const isReference=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&typeof v.$ref==='string';
const refs=v=>isReference(v)?[v.$ref]:v&&typeof v==='object'?Object.values(v).flatMap(refs):[];

export function eventGraphCnl(records){
 const byId=new Map(records.map(r=>[r.id,r]));
 const warnings=[],issues=[];
 const add=(record,field,message,code='invalid-structure')=>issues.push({code,record,field,message});
 if(records.filter(r=>r.type==='S').length!==1)add(null,null,'Exactly one sentence/discourse S record is required');
 for(const r of records){
  const f=r.fields;
  if(!types.has(r.type)){add(r.id,'type',`Unknown event record type: ${r.type}`);continue;}
  if(r.type==='DISC'){
   if(typeof f.t!=='string'||!f.t)add(r.id,'t',`${r.id}: discourse record needs function and source span`);
   if(typeof f.span!=='string'||!f.span.trim())add(r.id,'span',`${r.id}: discourse record needs function and source span`);
  }

  if(frameTypes.has(r.type)&&f.p==null){
   if(r.type!=='EX'&&(r.type!=='CP'||(!f.t&&!f.cmp)))add(r.id,'p',`${r.id}: missing predicate`);
   else if(r.type==='CP')warnings.push({record:r.id,code:'comparison-without-predicate',detail:'Comparison kind/dimension are preserved as given; no direction or predicate is invented.'});
  }
  if(r.type==='OP'){
   if(!f.t)add(r.id,'t',`${r.id}: operator needs type and referenced scope`);
   if(!isReference(f.sc))add(r.id,'sc',`${r.id}: operator needs type and referenced scope`);
  }
  if(r.type==='L'){
   if(!f.t)add(r.id,'t',`${r.id}: link needs type and referenced endpoints`);
   for(const key of ['f','to'])if(!isReference(f[key]))add(r.id,key,`${r.id}: link needs type and referenced endpoints`);
  }
  if(r.type==='QS'){
   if(!f.k)add(r.id,'k',`${r.id}: quantifier needs kind, entity and scope references`);
   for(const key of ['ent','sc'])if(!isReference(f[key]))add(r.id,key,`${r.id}: quantifier needs kind, entity and scope references`);
   // A missing/ill-formed reference already has its own diagnostic; do not also
   // describe its nonexistent target as the wrong record type.
   if(isReference(f.ent)&&byId.has(f.ent.$ref)&&byId.get(f.ent.$ref).type!=='E')add(r.id,'ent',`${r.id}: quantified entity is not an E record`);
  }
  if(r.type==='Q'){
   if(!f.t)add(r.id,'t',`${r.id}: question needs type and target`);
   if(f.target==null)add(r.id,'target',`${r.id}: question needs type and target`);
  }
  for(const [key,v] of Object.entries(f)){
   for(const id of new Set(refs(v)))if(!byId.has(id))add(r.id,key,`${r.id}: unresolved reference ${id}`);
   if(typeof v==='string'&&v.includes('_'))warnings.push({record:r.id,field:key,code:'non-atomic-spelling',value:v});
  }
 }
 const reportedCycles=new Set();
 for(const r of records.filter(r=>r.type==='OP')){
  const seen=[];let current=r;
  while(current?.type==='OP'){
   if(seen.includes(current.id)){
    const cycle=seen.slice(seen.indexOf(current.id)).sort().join(',');
    if(!reportedCycles.has(cycle)){add(current.id,'sc',`${current.id}: cyclic operator scope`);reportedCycles.add(cycle);}
    break;
   }
   seen.push(current.id);current=isReference(current.fields.sc)?byId.get(current.fields.sc.$ref):null;
  }
 }
 throwIssues(issues);
 const embedded=new Set(),queried=new Set(),operands=new Set(),conditional=new Set();
 const mark=(id,set,seen=new Set())=>{
  if(seen.has(id))return;seen.add(id);const node=byId.get(id);if(!node)return;
  set.add(id);
  if(['OP','QS','LS'].includes(node.type))for(const target of refs(node.fields.sc))mark(target,set,seen);
 };
 for(const r of records){
  if(r.type==='OP')for(const target of refs(r.fields.sc))operands.add(target);
  if(r.type==='Q')for(const target of refs(r.fields.target))mark(target,queried);
  if(frameTypes.has(r.type))for(const target of refs(r.fields.ct))mark(target,embedded);
  if(r.type==='L'&&['if','unless','whenever','only_if'].includes(r.fields.t))for(const id of [...refs(r.fields.f),...refs(r.fields.to)])mark(id,conditional);
  if(r.type==='L'&&r.fields.t==='content')for(const target of refs(r.fields.to))mark(target,embedded);
 }
 function value(v){
  if(isReference(v)){
   const r=byId.get(v.$ref);const anchor=r.type==='E'?(r.fields.n??r.fields.h??r.fields.sf):null;
   return `${names[r.type].toLowerCase()} ${v.$ref}${anchor?' ('+JSON.stringify(anchor)+')':''}`;
  }
  if(Array.isArray(v))return '['+v.map(value).join('; ')+']';
  if(v&&typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>k+'='+value(x)).join('; ')+'}';
  return typeof v==='string'?JSON.stringify(v):String(v);
 }
 function label(type,key,value){
  if(type==='CP'&&key==='t'&&['superlative','comparative'].includes(value))return 'comparison kind';
  if(type==='CP'&&key==='ent')return 'compared entity';
  if(type==='S')return {f:'sentence form',a:'speech act'}[key]??labels[key]??key;
  if(key==='t'&&!frameTypes.has(type))return 'kind';
  if(key==='k')return type==='QS'?'quantifier kind':'comparison direction';
  return labels[key]??key;
 }
 const lines=[];
 for(const r of records){
  const f=r.fields,details=[];
  if(r.type==='S'){
   if(f.f==null)details.push('sentence form "decl"');if(f.a==null)details.push('speech act "assert"');
  }
  if(frameTypes.has(r.type)){
   if(f.st==null){
    if(conditional.has(r.id))details.push('not independently asserted: part of a conditional relation');
    else if(queried.has(r.id))details.push('not independently asserted: question target');
    else if(embedded.has(r.id))details.push('not independently asserted: embedded content');
    else if(operands.has(r.id)||f.root)details.push('assertion applies to the scoped proposition, not its bare operand');
    else details.push('status asserted by default');
   }
   if(queried.has(r.id))details.push('used inside a question');
   if(embedded.has(r.id))details.push('used as propositional content');
  }
  for(const [k,v] of Object.entries(f))details.push(`${label(r.type,k,v)} (${fieldNames('event',r.type)[k]??k}) = ${value(v)}`);
  lines.push(`${names[r.type]} ${r.id}: ${details.join('; ')}.`);
 }
 return {cnl:lines.join('\n'),ir:{format:'Event-SOP-native/1',records},warnings};
}
export const eventNotation='Event-SOP CNL is a typed proposition graph. References to operators mean the fully scoped proposition; references to Q mean a question and to QS mean a quantified proposition. Entity declarations introduce discourse referents, not factual existence assertions unless stated. A frame used only as a question target or embedded content is not independently asserted unless explicitly st=asserted. An operator operand is not asserted without its operators. Both endpoints of if/unless/whenever/only_if links are conditional content, not independent facts unless explicitly status=asserted. Conditional antecedents do not establish their own truth. An explicit status is preserved, including contradictions with question use. OP sc means application/nesting; root is the outermost operator. L links whole propositions. ER fields identify the relation and its participants; t/p are relation-kind/predicate spellings, a/b or f/to endpoints, item/owner and psd/psr express possession. CP comparison kind and dimension alone do not supply a missing minimum/maximum direction. PS existence does not imply uniqueness unless unique is supplied. Every field is displayed; unrecognized annotations retain their spelling, never inferred meaning. DISC states pragmatic/discourse function and scope, not a new factual event; unspecified function is not an invented emotion. UM retains uninterpreted wording, which does not automatically establish semantic preservation. Null denotes unspecified. Use the written roles, scopes, quantifiers and statuses without repairing omissions from the source.';
