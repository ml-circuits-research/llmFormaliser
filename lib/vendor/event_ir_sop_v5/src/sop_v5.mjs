// Event IR / SOP compact v5
// Wire syntax: @id TYPE key=value ... ; references: $id
// Design rule: semantic values are atomic primitives, never snake_case phrases.
// V5 is converted to/from the legacy V4 IR only to reuse the existing benchmark renderer/validator.

import {toCompact,fromCompact,syntaxPieces} from './compact_v4.mjs';

function splitOutsideQuotes(s,sep=','){
  const out=[];let cur='',q=false,esc=false,depth=0;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(esc){cur+=ch;esc=false;continue;}
    if(ch==='\\'&&q){cur+=ch;esc=true;continue;}
    if(ch==='"'){q=!q;cur+=ch;continue;}
    if(!q){
      if(ch==='{'||ch==='['||ch==='(')depth++;
      else if(ch==='}'||ch===']'||ch===')')depth--;
      if(ch===sep&&depth===0){out.push(cur);cur='';continue;}
    }
    cur+=ch;
  }
  out.push(cur);return out;
}
function tokenizeLine(line){
  const out=[];let cur='',q=false,esc=false;
  for(const ch of line.trim()){
    if(esc){cur+=ch;esc=false;continue;}
    if(ch==='\\'&&q){cur+=ch;esc=true;continue;}
    if(ch==='"'){q=!q;cur+=ch;continue;}
    if(/\s/.test(ch)&&!q){if(cur){out.push(cur);cur='';}}else cur+=ch;
  }
  if(cur)out.push(cur);return out;
}
function decAtom(s){
  if(s.startsWith('$'))return {ref:s.slice(1)};
  if(s==='null')return null;
  if(s==='true')return true;
  if(s==='false')return false;
  if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return Number(s);
  if(s.startsWith('"'))return JSON.parse(s);
  return s;
}
function decValue(s){
  const p=splitOutsideQuotes(s,',');
  const v=p.map(decAtom);return p.length>1?v:v[0];
}
function bare(s){return /^[A-Za-z0-9?+./:\-]+$/.test(s) && !['null','true','false'].includes(s) && !s.includes(',');}
function encAtom(v){
  if(v===null)return 'null'; if(v===true)return 'true'; if(v===false)return 'false';
  if(typeof v==='number')return String(v);
  if(v&&typeof v==='object'&&v.ref)return '$'+v.ref;
  const s=String(v);return bare(s)?s:JSON.stringify(s);
}
function encValue(v){return Array.isArray(v)?v.map(encAtom).join(','):encAtom(v);}
function parse(text){
  return String(text).split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).map(line=>{
    const t=tokenizeLine(line);if(t.length<2)throw new Error('bad line: '+line);
    const id=t[0].replace(/^@/,''); const type=t[1], f={};
    for(const tok of t.slice(2)){const i=tok.indexOf('=');if(i<0)continue;const k=tok.slice(0,i),v=decValue(tok.slice(i+1));f[k]=v;}
    return {id,type,f};
  });
}
function line(id,type,f){
  const parts=['@'+id,type];for(const [k,v] of Object.entries(f))if(v!==undefined)parts.push(`${k}=${encValue(v)}`);return parts.join(' ');
}
const ref=id=>({ref:id});
const unref=v=>v&&typeof v==='object'&&v.ref?v.ref:v;
const mapRefs=(v,idMap)=>Array.isArray(v)?v.map(x=>mapRefs(x,idMap)):(v&&typeof v==='object'&&v.ref?ref(idMap.get(v.ref)||v.ref):v);

function simpleQuant(q){return q==='at_least'?'min':q==='at_most'?'max':q;}
function legacyQuant(q){return q==='min'?'at_least':q==='max'?'at_most':q;}
function simpleCmp(c){return c==='greater_than'?'gt':c==='less_than'?'lt':c==='greater_or_equal'?'ge':c==='less_or_equal'?'le':c;}
function legacyCmp(c){return c==='gt'?'greater_than':c==='lt'?'less_than':c==='ge'?'greater_or_equal':c==='le'?'less_or_equal':c;}

export function toSOPv5(ir,{includeSurface=false,includeText=false}={}){
  const v4=parse(toCompact(ir,{includeSurface,includeText}));
  const idMap=new Map();let oi=0;
  for(const s of v4)idMap.set(s.id,s.type==='OP'?`o${++oi}`:s.id);
  const contentParent=new Map();
  for(const s of v4)if(s.type==='L'&&s.f.t==='content')contentParent.set(unref(s.f.f),unref(s.f.to));
  const out=[];
  for(const s0 of v4){
    const s={id:idMap.get(s0.id),type:s0.type,f:{}};
    const F={};for(const [k,v] of Object.entries(s0.f))F[k]=mapRefs(v,idMap);
    const put=(k,v)=>{if(v!==undefined)s.f[k]=v;};
    if(s.type==='S'){
      put('f',F.f);put('a',F.a);if(F.txt!==undefined)put('txt',F.txt);
      const primary=F['d.primary'];if(primary!==undefined)put('primary',primary);
      if(F['d.implicit_addressee']===true)put('implicit',true);
      if(F['d.surface_form']==='modal_interrogative')put('surface','modal');
      if(F['d.conventionalized_indirect']===true)put('indirect',true);
      if(F['d.politeness']!==undefined)put('polite',F['d.politeness']);
      if(F['d.secondary_reading.type']==='literal_ability_question'){put('secondary','ability');put('secondary.form','question');}
      if(F['d.secondary_reading.status']==='available_but_not_primary'){put('secondary.available',true);put('secondary.primary',false);}
      if(F['d.surface_modal']!==undefined)put('modal',F['d.surface_modal']);
      if(F['d.force']==='recommendation')put('force','recommend');
      if(Array.isArray(F['d.components'])||typeof F['d.components']==='string'){
        const a=Array.isArray(F['d.components'])?F['d.components']:[F['d.components']];
        if(a.includes('assert_negated_belief')){put('parts.assert','belief');put('parts.assert.neg',true);}
        if(a.includes('conditional_request')){put('parts.request',true);put('parts.request.cond',true);}
        if(a.includes('conditional_prohibition')){put('parts.prohibit',true);put('parts.prohibit.cond',true);}
      }
    } else if(s.type==='E'){
      for(const k of ['h','ty','n','d','qv','co','sf'])if(F[k]!==undefined)put(k,F[k]);
      if(F.q!==undefined)put('q',simpleQuant(F.q));
      const props=F.pr===undefined?[]:(Array.isArray(F.pr)?F.pr:[F.pr]);const plain=[];
      for(const p of props){if(typeof p==='string'&&p.startsWith('of:'))put('of',p.slice(3));else plain.push(p);}if(plain.length)put('pr',plain);
    } else if(['EV','ST','RE','EX','ID','DF','CP'].includes(s.type)){
      for(const [k,v] of Object.entries(F)){
        if(k==='p'&&v==='legally_required'){put('p','required');put('mod','legal');}
        else if(k==='p'&&v==='at_home'){put('p','located');put('pl','home');}
        else if(k==='cmp')put('cmp',simpleCmp(v));
        else if(k==='by'&&typeof v==='string'&&v.includes('_')){const parent=contentParent.get(s0.id);put('by',parent?ref(idMap.get(parent)||parent):'context');}
        else if(k==='tm'&&v==='at:yet/not_yet'){put('tm','at:yet');put('done',false);}
        else put(k,v);
      }
    } else if(s.type==='OP'){
      for(const [k,v] of Object.entries(F)){
        if(k==='v'&&v==='scalar_even'){put('v','scalar');put('cue','even');}
        else if(k==='v'&&v==='cleft_exhaustive'){put('v','exclusive');put('cue','cleft');}
        else if(k==='dom'&&v==='contextual_relevant_alternatives'){put('dom','context');put('alts','relevant');}
        else if(k==='dom'&&v==='contextual_scale'){put('dom','context');put('scale','rank');}
        else put(k,v);
      }
    } else if(s.type==='L'){
      for(const [k,v] of Object.entries(F))if(k!=='sem'&&k!=='ach')put(k,v);
      if(F.ach==='not_entailed')put('entails',false);
      if(F.sem==='do_not_restart_before_completion')put('gate',true);
      if(F.sem==='nonfactive')put('factive',false);
      if(F.sem==='content_under_negated_attitude')put('under','neg');
      if(F.sem==='object_control')put('control','object');
      if(F.sem==='subject_control')put('control','subject');
      if(F.sem==='desire_content')put('desire',true);
      if(F.sem==='even_if_does_not_cancel_main_rule'){put('cue','even');put('stable',true);}
      if(F.sem==='cause_within_epistemic_claim')put('inside','epistemic');
      if(F.sem==='else_branch')put('branch','else');
      // exception_condition and content_under_negated_attitude are fully implied by structure.
    } else if(s.type==='ER'){
      if(F.t==='possessed_by'){put('t','possess');put('item',F.f);put('owner',F.to);}
      else {put('t',F.t==='subset_of'?'subset':F.t);put('f',F.f);put('to',F.to);if(F.sc!==undefined)put('sc',F.sc);if(F.exc!==undefined)put('exc',F.exc);}
      // restrictive/nonrestrictive semantics are encoded by restrictor/supplement.
    } else if(s.type==='G'){
      if(F.t==='if_else'){put('t','branch');put('m',F.m);put('st',F.st);const m=String(F.sem||'').match(/condition_([A-Za-z0-9-]+)/);if(m)put('cond',ref(idMap.get(m[1])||m[1]));}
      else {put('t',F.t);put('m',F.m);if(F.st!==undefined)put('st',F.st);if(F.inc!==undefined)put('inc',F.inc==='unspecified'?'unknown':F.inc);}
    } else if(s.type==='QS'){
      put('k',simpleQuant(F.k));put('ent',F.ent);put('sc',F.sc);put('o',F.o);put('dist',F.dist);put('dep',F.dep);
      if(F.sem==='for_each')put('each',true);
      else if(F.sem==='domain_cardinality')put('role','domain');
      else if(F.sem==='lower_bound_subset')put('role','subset');
      else if(F.sem==='existential_recipient')put('role','recipient');
      else if(F.sem==='non_approver_cardinality')put('role','result');
      else if(F.sem==='lower_bound_cardinality')put('role','count');
      // other cardinality semantics are directly encoded by k/qv.
    } else if(s.type==='LS'){
      for(const [k,v] of Object.entries(F)){
        if(k==='semantics')continue;
        if(k==='entails_event_success')put('success',v);else put(k,v);
      }
      if(F.semantics==='exception_condition')put('exrule',true);
    } else if(s.type==='PS'){
      if(F.t==='prior_occurrence'){put('trg',F.trg);put('prior','event');}
      else if(F.t==='prior_occurrence_or_state'){put('trg',F.trg);put('prior',['event','state']);}
      else if(F.t==='factive_content'){put('trg',F.trg);put('true',true);put('cause','factive');}
      else if(F.t==='definite_description_existence_uniqueness'){put('exists',F.ent);put('unique',F.ent);put('cause','def');}
      else if(F.t==='existential_background'){put('trg',F.trg);put('exists',true);put('open',F['content.open_role']);put('p',F['content.predicate']);put('th',F['content.theme']);}
      else throw new Error(`unhandled presupposition type ${F.t}`);
    } else if(s.type==='CI'){
      if(F.t==='scalar_unexpectedness'){put('trg',F.trg);put('unexpected',true);put('p',F['content.predicate']);put('scale','context');put('pos','extreme');}
      else if(F.t==='nontrivial_effort_or_difficulty'){put('trg',F.trg);put('difficulty','high');}
      else throw new Error(`unhandled implicature type ${F.t}`);
    } else if(s.type==='CX'){
      if(F.t==='illocutionary_reading'){put('cue',F.span);put('t','reading');put('st','resolved');put('primary','request');put('secondary','ability');put('preserve',true);}
      else if(F.t==='elliptical_attachment'){put('cue',F.span);put('t','ellipsis');put('st','unresolved');put('modal',F['components.epistemic.value']);put('scope','missing');put('time',F['components.time.value']);put('anchor','context');}
      else if(F.t==='focus_alternative_domain'){put('cue',F.span);put('t','focus');put('st','contextual');put('trg',F['components.target']);if(F['components.role']!==undefined)put('role',F['components.role']);else put('domain','context');}
      else if(F.t==='self_correction'){put('cue',F.span);put('t','correction');put('st','contextual');put('reject',F['components.rejected_or_downgraded_time']);put('replace',F['components.replacement_time']);put('certainty',F['components.certainty']);}
      else if(F.t==='else_branch'){put('cue',F.span);put('t','branch');put('st','resolved');put('mode','else');const m=String(F['components.negated_condition']||'').match(/not\s+(.+)/);if(m)put('cond',ref(idMap.get(m[1])||m[1]));put('neg',true);}
      else throw new Error(`unhandled context type ${F.t}`);
    } else if(s.type==='AM'){
      put('span',F.span);put('t',F.t);put('pref',F.pref);
      const opts=Array.isArray(F.opt)?F.opt:[F.opt];let i=0;
      for(const op of opts){const z=String(op);const m=z.match(/^instrument_of:(.+)$/);const n=z.match(/^modifier_of:(.+)$/);if(m){put(`a${++i}.kind`,'instrument');put(`a${i}.to`,ref(idMap.get(m[1])||m[1]));}else if(n){put(`a${++i}.kind`,'modifier');put(`a${i}.to`,ref(idMap.get(n[1])||n[1]));}else put(`a${++i}.value`,op);}
    } else if(s.type==='MS'){
      if(F.why==='ellipsis_requires_prior_context'){put('t',F.t);put('cause','ellipsis');put('need','prior');}else for(const [k,v] of Object.entries(F))put(k,v);
    } else if(s.type==='Q'){
      if(F.t==='yes_no'){put('t','yn');put('target',F.target);put('exp',F.exp);}
      else if(F.t==='embedded_wh'){put('t','wh');put('embed',true);put('target',F.target);put('exp',F.exp==='subset_identity'?'subset':F.exp);}
      else {put('t',F.t);put('target',F.target);put('exp',F.exp);}
    } else {
      for(const [k,v] of Object.entries(F))put(k,v);
    }
    out.push(line(s.id,s.type,s.f));
  }
  const text=out.join('\n');
  const errors=validateSOPv5(text);if(errors.length)throw new Error('V5 serializer produced invalid SOP: '+errors.join('; '));
  return text;
}

function renderV4Line(id,type,f){
  const parts=[id,type];for(const [k,v] of Object.entries(f))if(v!==undefined)parts.push(`${k}=${encValue(v)}`);return parts.join(' ');
}

export function fromSOPv5(text,{sourceText=''}={}){
  const st=parse(text);const byId=new Map(st.map(s=>[s.id,s]));
  const parentOf=new Map();for(const s of st)if(s.type==='L'&&s.f.t==='content')parentOf.set(unref(s.f.f),unref(s.f.to));
  const lines=[];
  for(const s of st){const F=s.f,O={};const put=(k,v)=>{if(v!==undefined)O[k]=v;};
    if(s.type==='S'){
      put('f',F.f);put('a',F.a);put('txt',F.txt);if(F.primary!==undefined)put('d.primary',F.primary);
      if(F.implicit===true){put('d.implicit_addressee',true);put('d.subject_recovery','licensed_by_imperative_grammar');}
      if(F.surface==='modal')put('d.surface_form','modal_interrogative');if(F.indirect===true)put('d.conventionalized_indirect',true);if(F.polite!==undefined)put('d.politeness',F.polite);
      if(F.secondary==='ability'){put('d.secondary_reading.type','literal_ability_question');if(F['secondary.available']===true&&F['secondary.primary']===false)put('d.secondary_reading.status','available_but_not_primary');}
      if(F.modal!==undefined)put('d.surface_modal',F.modal);if(F.force==='recommend')put('d.force','recommendation');
      const comps=[];if(F['parts.assert']==='belief'&&F['parts.assert.neg']===true)comps.push('assert_negated_belief');if(F['parts.request']===true&&F['parts.request.cond']===true)comps.push('conditional_request');if(F['parts.prohibit']===true&&F['parts.prohibit.cond']===true)comps.push('conditional_prohibition');if(comps.length)put('d.components',comps);
    } else if(s.type==='E'){
      for(const k of ['h','ty','n','d','qv','co','sf'])put(k,F[k]);if(F.q!==undefined)put('q',legacyQuant(F.q));const pr=[];if(F.pr!==undefined)pr.push(...(Array.isArray(F.pr)?F.pr:[F.pr]));if(F.of!==undefined)pr.push('of:'+F.of);if(pr.length)put('pr',pr);
    } else if(['EV','ST','RE','EX','ID','DF','CP'].includes(s.type)){
      for(const [k,v] of Object.entries(F)){
        if(k==='mod')continue;
        if(k==='p'&&v==='required'&&F.mod==='legal')put('p','legally_required');
        else if(k==='p'&&v==='located'&&F.pl==='home'){put('p','at_home');}
        else if(k==='pl'&&F.p==='located'&&v==='home')continue;
        else if(k==='cmp')put('cmp',legacyCmp(v));
        else if(k==='by'&&v&&typeof v==='object'&&v.ref){const p=byId.get(v.ref);const neg=p&&String(p.f.root||'').includes('o')&&[...byId.values()].some(x=>x.type==='OP'&&x.id===unref(p.f.root)&&x.f.t==='negation');if(p?.f.st==='queried')put('by','content_of_questioned_report');else if(p?.f.p==='think'&&neg)put('by','content_of_negated_thought');else if(p?.f.p==='say'&&neg)put('by','content_of_denied_report');else put('by','content_of_report');}
        else if(k==='tm'&&v==='at:yet'&&F.done===false)put('tm','at:yet/not_yet');
        else if(k==='done')continue; else put(k,v);
      }
    } else if(s.type==='OP'){
      for(const [k,v] of Object.entries(F)){
        if(['cue','alts','scale'].includes(k))continue;
        if(k==='v'&&v==='scalar'&&F.cue==='even')put('v','scalar_even');
        else if(k==='v'&&v==='exclusive'&&F.cue==='cleft')put('v','cleft_exhaustive');
        else if(k==='dom'&&v==='context'&&F.alts==='relevant')put('dom','contextual_relevant_alternatives');
        else if(k==='dom'&&v==='context'&&F.scale==='rank')put('dom','contextual_scale');
        else put(k,v);
      }
    } else if(s.type==='L'){
      for(const [k,v] of Object.entries(F))if(!['entails','gate','factive','control','desire','cue','stable','inside','branch','under'].includes(k))put(k,v);
      if(F.t==='unless')put('sem','exception_condition');
      if(F.entails===false)put('ach','not_entailed');if(F.gate===true)put('sem','do_not_restart_before_completion');
      if(F.factive===false)put('sem','nonfactive');if(F.under==='neg')put('sem','content_under_negated_attitude');if(F.control==='object')put('sem','object_control');if(F.control==='subject')put('sem','subject_control');if(F.desire===true)put('sem','desire_content');
      if(F.cue==='even'&&F.stable===true)put('sem','even_if_does_not_cancel_main_rule');if(F.inside==='epistemic')put('sem','cause_within_epistemic_claim');if(F.branch==='else')put('sem','else_branch');
    } else if(s.type==='ER'){
      if(F.t==='possess'){put('t','possessed_by');put('f',F.item);put('to',F.owner);}
      else {put('t',F.t==='subset'?'subset_of':F.t);put('f',F.f);put('to',F.to);put('sc',F.sc);put('exc',F.exc);if(F.t==='restrictor')put('sem','restrictive_relative_clause');if(F.t==='supplement')put('sem','nonrestrictive_relative_clause');}
    } else if(s.type==='G'){
      if(F.t==='branch'){put('t','if_else');put('m',F.m);put('st',F.st);if(F.cond)put('sem','mutually_selected_by_condition_'+unref(F.cond));}
      else {put('t',F.t);put('m',F.m);put('st',F.st);if(F.inc!==undefined){put('inc',F.inc==='unknown'?'unspecified':F.inc);if(F.t==='or')put('sem','inclusive_or_unless_context_resolves_otherwise');}}
    } else if(s.type==='QS'){
      put('k',legacyQuant(F.k));put('ent',F.ent);put('sc',F.sc);put('o',F.o);put('dist',F.dist);put('dep',F.dep);
      if(F.each===true)put('sem','for_each');else if(F.role==='domain')put('sem','domain_cardinality');else if(F.role==='subset')put('sem','lower_bound_subset');else if(F.role==='recipient')put('sem','existential_recipient');else if(F.role==='result')put('sem','non_approver_cardinality');else if(F.role==='count')put('sem','lower_bound_cardinality');
      else if(F.k==='none')put('sem','no_member_satisfies');else if(F.k==='min')put('sem','cardinality_lower_bound');else if(F.k==='max')put('sem','cardinality_upper_bound');else if(F.k==='exact')put('sem','cardinality_exact');else if(F.k==='some'&&F.dep!==undefined)put('sem','existential_per_binder');
    } else if(s.type==='LS'){
      for(const [k,v] of Object.entries(F)){if(k==='exrule')continue;if(k==='success')put('entails_event_success',v);else put(k,v);}if(F.exrule===true)put('semantics','exception_condition');if(F.t==='negation'&&F['scope.type']==='quantifier'&&F['scope.kind']==='all')put('semantics','not_all');
    } else if(s.type==='PS'){
      if(F.prior!==undefined){const a=Array.isArray(F.prior)?F.prior:[F.prior];put('t',a.includes('state')?'prior_occurrence_or_state':'prior_occurrence');put('trg',F.trg);}
      else if(F.true===true&&F.cause==='factive'){put('t','factive_content');put('trg',F.trg);}
      else if(F.cause==='def'){put('t','definite_description_existence_uniqueness');put('ent',F.exists);}
      else if(F.exists===true){put('t','existential_background');put('trg',F.trg);put('content.open_role',F.open);put('content.predicate',F.p);put('content.theme',F.th);}
    } else if(s.type==='CI'){
      if(F.unexpected===true){put('t','scalar_unexpectedness');put('trg',F.trg);put('content.predicate',F.p);put('content.scale','contextual');put('content.relative_position','unexpected/extreme');}
      else if(F.difficulty==='high'){put('t','nontrivial_effort_or_difficulty');put('trg',F.trg);}
    } else if(s.type==='CX'){
      if(F.t==='reading'){put('span',F.cue);put('t','illocutionary_reading');put('st','resolved_primary_with_secondary_preserved');put('components.primary','request');put('components.secondary','ability_question');}
      else if(F.t==='ellipsis'){put('span',F.cue);put('t','elliptical_attachment');put('st','unresolved');put('components.epistemic.value',F.modal);put('components.epistemic.scope','missing_proposition');put('components.time.value',F.time);put('components.time.anchor','speech_time_or_context');}
      else if(F.t==='focus'){put('span',F.cue);put('t','focus_alternative_domain');put('st','contextual');put('components.target',F.trg);if(F.role!==undefined)put('components.role',F.role);else put('components.domain',F.cue==='Only'?'relevant alternatives to Alice':'contextual alternatives');}
      else if(F.t==='correction'){put('span',F.cue);put('t','self_correction');put('st','contextual');put('components.rejected_or_downgraded_time',F.reject);put('components.replacement_time',F.replace);put('components.certainty',F.certainty);}
      else if(F.t==='branch'){put('span',F.cue);put('t','else_branch');put('st','resolved');put('components.negated_condition','not '+unref(F.cond));}
    } else if(s.type==='AM'){
      put('span',F.span);put('t',F.t);const opts=[];for(let i=1;i<10;i++){const k=F[`a${i}.kind`],to=F[`a${i}.to`];if(k==='instrument')opts.push('instrument_of:'+unref(to));else if(k==='modifier')opts.push('modifier_of:'+unref(to));else if(F[`a${i}.value`]!==undefined)opts.push(F[`a${i}.value`]);}put('opt',opts);put('pref',F.pref);
    } else if(s.type==='MS'){
      if(F.cause==='ellipsis'&&F.need==='prior'){put('t',F.t);put('why','ellipsis_requires_prior_context');}else for(const [k,v] of Object.entries(F))put(k,v);
    } else if(s.type==='Q'){
      if(F.t==='yn'){put('t','yes_no');put('target',F.target);put('exp',F.exp);}else if(F.t==='wh'&&F.embed===true){put('t','embedded_wh');put('target',F.target);put('exp',F.exp==='subset'?'subset_identity':F.exp);}else {put('t',F.t);put('target',F.target);put('exp',F.exp);}
    } else {for(const [k,v] of Object.entries(F))put(k,v);}
    lines.push(renderV4Line(s.id,s.type,O));
  }
  return fromCompact(lines.join('\n'),{sourceText});
}

export function validateSOPv5(text){
  const errs=[];let st;
  try{st=parse(text);}catch(e){return [String(e)];}
  const ids=new Set();for(const s of st){if(ids.has(s.id))errs.push(`duplicate @${s.id}`);ids.add(s.id);}
  for(const raw of String(text).split(/\r?\n/).filter(Boolean))if(!raw.startsWith('@'))errs.push(`statement does not start with @: ${raw}`);
  const visit=(v,where)=>{if(Array.isArray(v))return v.forEach(x=>visit(x,where));if(v&&typeof v==='object'&&v.ref){if(!ids.has(v.ref))errs.push(`unresolved $${v.ref} in ${where}`);return;}if(typeof v==='string'&&v.includes('_'))errs.push(`hidden phrase/snake_case value ${JSON.stringify(v)} in ${where}`);};
  for(const s of st)for(const [k,v] of Object.entries(s.f))visit(v,`@${s.id}.${k}`);
  return errs;
}

export {syntaxPieces};
