// Event IR Compact v4 (EIRC): line-oriented, reference-friendly semantic IR.
// Grammar: <id> <statementType> key=value key=value ...
// References are written as $id. Repeated values are comma-separated.

const FORM_TO_SHORT={declarative:'decl',interrogative:'int',imperative:'imp',exclamative:'excl',fragment:'frag'};
const SHORT_TO_FORM=Object.fromEntries(Object.entries(FORM_TO_SHORT).map(([k,v])=>[v,k]));
const KIND_TO_TYPE={event:'EV',state:'ST',relation:'RE',existence:'EX',identity:'ID',definition:'DF',comparison:'CP'};
const TYPE_TO_KIND=Object.fromEntries(Object.entries(KIND_TO_TYPE).map(([k,v])=>[v,k]));
const ROLE_TO_KEY={agent:'ag',patient:'pa',theme:'th',experiencer:'xp',stimulus:'sm',recipient:'rc',beneficiary:'bn',instrument:'ins',source:'src',destination:'dst',location:'loc',possessor:'psr',possessed:'psd',value:'val',standard:'std',topic:'top',content:'ct'};
const KEY_TO_ROLE=Object.fromEntries(Object.entries(ROLE_TO_KEY).map(([k,v])=>[v,k]));

function safeBare(s){return /^[A-Za-z0-9_?+./:\-]+$/.test(s) && !['null','true','false'].includes(s) && !s.includes(',');}
function encAtom(v,refs=new Set()){
  if(v===null)return 'null';
  if(v===true)return 'true';
  if(v===false)return 'false';
  if(typeof v==='number')return String(v);
  if(typeof v==='string'){
    if(refs.has(v)) return '$'+v;
    return safeBare(v)?v:JSON.stringify(v);
  }
  return '%'+JSON.stringify(v);
}
function encValue(v,refs){
  if(Array.isArray(v)) return v.map(x=>encAtom(x,refs)).join(',');
  return encAtom(v,refs);
}

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
function decAtom(s){
  if(s.startsWith('$'))return s.slice(1);
  if(s.startsWith('%'))return JSON.parse(s.slice(1));
  if(s==='null')return null;
  if(s==='true')return true;
  if(s==='false')return false;
  if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return Number(s);
  if(s.startsWith('"'))return JSON.parse(s);
  return s;
}
function decValue(s,forceArray=false){
  const parts=splitOutsideQuotes(s,',');
  const vals=parts.filter((x,i)=>x!==''||i<parts.length-1).map(decAtom);
  return forceArray||parts.length>1?vals:vals[0];
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

function flatten(obj,prefix='',out=[]){
  if(obj===null||obj===undefined)return out;
  if(Array.isArray(obj)){
    if(obj.every(x=>x===null||['string','number','boolean'].includes(typeof x))){out.push([prefix,obj]);return out;}
    out.push([prefix,obj]);return out;
  }
  if(typeof obj!=='object'){out.push([prefix,obj]);return out;}
  for(const [k,v] of Object.entries(obj)){
    if(v===undefined)continue;
    const p=prefix?`${prefix}.${k}`:k;
    if(v && typeof v==='object' && !Array.isArray(v)) flatten(v,p,out);
    else out.push([p,v]);
  }
  return out;
}
function setPath(obj,path,value){
  const ks=path.split('.');let x=obj;
  for(let i=0;i<ks.length-1;i++)x=x[ks[i]]??=(/^\d+$/.test(ks[i+1])?[]:{});
  x[ks.at(-1)]=value;
}

function kv(k,v,refs){return `${k}=${encValue(v,refs)}`;}
function emitGenericFields(parts,obj,prefix,refs,keyMap={}){
  for(const [path,v] of flatten(obj)){
    const key=keyMap[path]||`${prefix}${path}`;
    parts.push(kv(key,v,refs));
  }
}

function semanticEntity(e,includeSurface){
  const x={h:e.head};
  if(e.type!==undefined && e.type!=='object')x.ty=e.type;
  if(e.name!=null)x.n=e.name;
  if(e.definiteness!=null && e.definiteness!=='definite')x.d=e.definiteness;
  if(e.quantifier){x.q=e.quantifier.kind;if(e.quantifier.value!==undefined)x.qv=e.quantifier.value;}
  if((e.properties||[]).length){
    x.pr=e.properties.map(p=>typeof p==='string'?p:(p.value===undefined?p.predicate:`${p.predicate}:${p.value}`));
  }
  if(e.coreference)x.co=e.coreference;
  if(includeSurface && e.surface!=null)x.sf=e.surface;
  return x;
}
function decodeProperty(s){
  if(typeof s!=='string')return s;
  const i=s.indexOf(':');
  return i<0?{predicate:s}:{predicate:s.slice(0,i),value:s.slice(i+1)};
}

export function toCompact(ir,{includeSurface=false,includeText=false}={}){
  const refs=new Set([...(ir.entities||[]).map(e=>e.id),...(ir.frames||[]).map(f=>f.id)]);
  const lines=[];
  const sp=[ir.sentence_id||'s1','S'];
  if(ir.form!=='declarative')sp.push(kv('f',FORM_TO_SHORT[ir.form]||ir.form,refs));
  if(ir.speech_act!=='assert')sp.push(kv('a',ir.speech_act,refs));
  if(includeText&&ir.text!=null)sp.push(kv('txt',ir.text,refs));
  if(ir.speech_act_details)emitGenericFields(sp,ir.speech_act_details,'d.',refs);
  lines.push(sp.join(' '));

  for(const e of ir.entities||[]){
    const p=[e.id,'E'];
    for(const [k,v] of Object.entries(semanticEntity(e,includeSurface)))p.push(kv(k,v,refs));
    lines.push(p.join(' '));
  }

  const globalOps=new Map();
  for(const f of ir.frames||[]){
    for(const o of f.operators||[])globalOps.set(`${f.id}_${o.id}`,{...o,_frame:f.id,_global:`${f.id}_${o.id}`});
  }
  const globalOpId=(f,id)=> id===f.id?id:`${f.id}_${id}`;
  const opRefs=new Set([...refs,...globalOps.keys()]);

  for(const f of ir.frames||[]){
    const p=[f.id,KIND_TO_TYPE[f.kind]||'EV',kv('p',f.predicate,opRefs)];
    const grouped=new Map();
    for(const a of f.arguments||[]){const k=ROLE_TO_KEY[a.role]||`arg.${a.role}`;(grouped.get(k)||grouped.set(k,[]).get(k)).push(a.ref);}
    for(const [k,v] of grouped)p.push(kv(k,v,opRefs));
    if(f.status&&f.status!=='asserted')p.push(kv('st',f.status,opRefs));
    if(f.tense&&f.tense!=='unknown')p.push(kv('t',f.tense,opRefs));
    if(f.aspect&&f.aspect!=='simple')p.push(kv('as',f.aspect,opRefs));
    if(f.source!=null&&f.source!=='speaker')p.push(kv('by',f.source,opRefs));
    if(f.operator_root)p.push(kv('root',globalOpId(f,f.operator_root),opRefs));
    for(const t of f.time||[])p.push(kv('tm',`${t.relation||'at'}:${t.value??t.anchor??''}`,opRefs));
    for(const l of f.location||[])p.push(kv('pl',typeof l==='string'?l:(l.value??JSON.stringify(l)),opRefs));
    for(const m of f.manner||[])p.push(kv('man',typeof m==='string'?m:(m.value??JSON.stringify(m)),opRefs));
    if(f.comparison?.dimension)p.push(kv('dim',f.comparison.dimension,opRefs));
    if(f.comparison?.relation)p.push(kv('cmp',f.comparison.relation,opRefs));
    lines.push(p.join(' '));
  }
  for(const f of ir.frames||[]){
    for(const o of f.operators||[]){
      const gid=`${f.id}_${o.id}`; const p=[gid,'OP',kv('t',o.type,opRefs),kv('sc',globalOpId(f,o.scope),opRefs)];
      if(o.value!==undefined)p.push(kv('v',o.value,opRefs));
      if(o.target!==undefined)p.push(kv('trg',o.target,opRefs));
      if(o.domain!==undefined)p.push(kv('dom',o.domain,opRefs));
      if(o.entails_occurrence!==undefined)p.push(kv('eo',o.entails_occurrence,opRefs));
      if(o.entails_success!==undefined)p.push(kv('es',o.entails_success,opRefs));
      lines.push(p.join(' '));
    }
  }

  let n=0;
  for(const r of ir.relations||[]){const p=[`l${++n}`,'L',kv('t',r.type,opRefs),kv('f',r.from,opRefs),kv('to',r.to,opRefs)];for(const k of ['mood','semantics','achievement','scope','anchor'])if(r[k]!==undefined)p.push(kv({semantics:'sem',achievement:'ach',scope:'sc',anchor:'anc'}[k]||k,r[k],opRefs));lines.push(p.join(' '));}
  n=0;
  for(const r of ir.entity_relations||[]){const p=[`er${++n}`,'ER',kv('t',r.type,opRefs),kv('f',r.from||r.modifier,opRefs),kv('to',r.to||r.head,opRefs)];if(r.semantics!==undefined)p.push(kv('sem',r.semantics,opRefs));if(r.scope!==undefined)p.push(kv('sc',r.scope,opRefs));if(r.excluding!==undefined)p.push(kv('exc',r.excluding,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const g of ir.logical_groups||[]){const p=[g.id||`g${++n}`,'G',kv('t',g.type,opRefs),kv('m',g.members||[],opRefs)];if(g.status&&g.status!=='asserted')p.push(kv('st',g.status,opRefs));if(g.semantics!==undefined)p.push(kv('sem',g.semantics,opRefs));if(g.inclusive!==undefined)p.push(kv('inc',g.inclusive,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const q of ir.quantifier_scopes||[]){const p=[`qs${++n}`,'QS',kv('k',q.kind,opRefs),kv('ent',q.entity,opRefs),kv('sc',q.scope,opRefs)];if(q.order!==undefined)p.push(kv('o',q.order,opRefs));if(q.distributivity!==undefined)p.push(kv('dist',q.distributivity,opRefs));if(q.semantics!==undefined)p.push(kv('sem',q.semantics,opRefs));if(q.dependent_on!==undefined)p.push(kv('dep',q.dependent_on,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const ls of ir.logical_scope||[]){const p=[`ls${++n}`,'LS'];const flat=flatten(ls);for(const [k,v] of flat)p.push(kv(k==='type'?'t':k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.presuppositions||[]){const p=[`ps${++n}`,'PS'];for(const [k,v] of flatten(x))p.push(kv(k==='type'?'t':k==='target'?'trg':k==='entity'?'ent':k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.conventional_implicatures||[]){const p=[`ci${++n}`,'CI'];for(const [k,v] of flatten(x))p.push(kv(k==='type'?'t':k==='target'?'trg':k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.context_dependencies||[]){const p=[`cx${++n}`,'CX'];for(const [k,v] of flatten(x))p.push(kv(k==='type'?'t':k==='status'?'st':k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.mentions||[]){const p=[`mn${++n}`,'MN'];for(const [k,v] of Object.entries(x))p.push(kv(k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.ambiguities||[]){const p=[`am${++n}`,'AM',kv('span',x.span,opRefs),kv('t',x.type,opRefs),kv('opt',x.options||[],opRefs),kv('pref',x.preferred??null,opRefs)];lines.push(p.join(' '));}
  n=0;
  for(const x of ir.missing||[]){const p=[`ms${++n}`,'MS'];if(typeof x==='string')p.push(kv('v',x,opRefs));else for(const [k,v] of flatten(x))p.push(kv(k==='type'?'t':k==='reason'?'why':k,v,opRefs));lines.push(p.join(' '));}
  n=0;
  for(const x of ir.unmapped||[]){const p=[`um${++n}`,'UM',kv('v',x,opRefs)];lines.push(p.join(' '));}
  if(ir.question){const p=['q0','Q'];for(const [k,v] of Object.entries(ir.question))p.push(kv({type:'t',expected_type:'exp'}[k]||k,v,opRefs));lines.push(p.join(' '));}
  return lines.join('\n');
}

function fieldsFromTokens(tokens,arrayKeys=new Set()){
  const f={};
  for(const tok of tokens){const i=tok.indexOf('=');if(i<0)continue;const k=tok.slice(0,i),raw=tok.slice(i+1);const v=decValue(raw,arrayKeys.has(k));if(k in f)f[k]=Array.isArray(f[k])?[...f[k],...(Array.isArray(v)?v:[v])]:[f[k],...(Array.isArray(v)?v:[v])];else f[k]=v;}
  return f;
}
function parseTime(v){const i=String(v).indexOf(':');return i<0?{relation:'at',value:v}:{relation:String(v).slice(0,i),value:String(v).slice(i+1)};}
function genericUnflatten(fields,map={}){const o={};for(const [k,v] of Object.entries(fields)){const kk=map[k]||k;setPath(o,kk,v);}return o;}

export function fromCompact(text,{sourceText=''}={}){
  const lines=String(text).split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
  if(!lines.length)throw new Error('empty compact IR');
  let ir=null; const frames=new Map(),ops=new Map();
  const pending={relations:[],entity_relations:[],groups:[],qs:[],ls:[],ps:[],ci:[],cx:[],mn:[],am:[],ms:[],um:[],question:null};
  for(const line of lines){
    const toks=tokenizeLine(line); if(toks.length<2)continue; const [id,type,...rest]=toks;
    const arrayKeys=new Set(type==='S'?['d.politeness','d.components']:type==='E'?['pr']:type==='G'?['m']:type==='QS'?['dep']:type==='AM'?['opt']:[]);
    const f=fieldsFromTokens(rest,arrayKeys);
    if(type==='S'){
      ir={sentence_id:id,text:f.txt??sourceText,form:SHORT_TO_FORM[f.f]||f.f||'declarative',speech_act:f.a||'assert',entities:[],frames:[],relations:[],question:null,missing:[],ambiguities:[],unmapped:[]};
      const d={};for(const [k,v] of Object.entries(f))if(k.startsWith('d.'))setPath(d,k.slice(2),v);if(Object.keys(d).length)ir.speech_act_details=d;
      continue;
    }
    if(!ir)throw new Error('first statement must be S');
    if(type==='E'){
      let ty=f.ty??'object';
      const e={id,surface:f.sf??f.n??f.h??id,head:f.h??f.n??id,type:ty,name:f.n??null,definiteness:f.d??'definite',quantifier:f.q?{kind:f.q,...(f.qv!==undefined?{value:f.qv}:{})}:null,properties:(f.pr===undefined?[]:(Array.isArray(f.pr)?f.pr:[f.pr])).map(decodeProperty),coreference:f.co??null};
      ir.entities.push(e); continue;
    }
    if(TYPE_TO_KIND[type]){
      const args=[];for(const [k,v] of Object.entries(f)){const role=KEY_TO_ROLE[k]||(k.startsWith('arg.')?k.slice(4):null);if(!role)continue;for(const ref of Array.isArray(v)?v:[v])args.push({role,ref});}
      const fr={id,kind:TYPE_TO_KIND[type],predicate:f.p,arguments:args,operators:[],operator_root:f.root??null,tense:f.t??'unknown',aspect:f.as??'simple',time:[],location:[],manner:[],status:f.st??'asserted',source:f.by??'speaker'};
      if(f.tm!==undefined)for(const v of Array.isArray(f.tm)?f.tm:[f.tm])fr.time.push(parseTime(v));
      if(f.pl!==undefined)for(const v of Array.isArray(f.pl)?f.pl:[f.pl])fr.location.push({value:v});
      if(f.man!==undefined)for(const v of Array.isArray(f.man)?f.man:[f.man])fr.manner.push({value:v});
      if(f.dim!==undefined||f.cmp!==undefined)fr.comparison={...(f.dim!==undefined?{dimension:f.dim}:{}),...(f.cmp!==undefined?{relation:f.cmp}:{})};
      frames.set(id,fr);ir.frames.push(fr);continue;
    }
    if(type==='OP'){ops.set(id,{id,type:f.t,scope:f.sc,...(f.v!==undefined?{value:f.v}:{}),...(f.trg!==undefined?{target:f.trg}:{}),...(f.dom!==undefined?{domain:f.dom}:{}),...(f.eo!==undefined?{entails_occurrence:f.eo}:{}),...(f.es!==undefined?{entails_success:f.es}:{})});continue;}
    if(type==='L')pending.relations.push({type:f.t,from:f.f,to:f.to,...(f.mood!==undefined?{mood:f.mood}:{}),...(f.sem!==undefined?{semantics:f.sem}:{}),...(f.ach!==undefined?{achievement:f.ach}:{}),...(f.sc!==undefined?{scope:f.sc}:{}),...(f.anc!==undefined?{anchor:f.anc}:{})});
    else if(type==='ER')pending.entity_relations.push({type:f.t,from:f.f,to:f.to,...(f.sem!==undefined?{semantics:f.sem}:{}),...(f.sc!==undefined?{scope:f.sc}:{}),...(f.exc!==undefined?{excluding:Array.isArray(f.exc)?f.exc:[f.exc]}:{})});
    else if(type==='G')pending.groups.push({id,type:f.t,members:Array.isArray(f.m)?f.m:[f.m],status:f.st??'asserted',...(f.sem!==undefined?{semantics:f.sem}:{}),...(f.inc!==undefined?{inclusive:f.inc}:{})});
    else if(type==='QS')pending.qs.push({kind:f.k,entity:f.ent,scope:f.sc,...(f.o!==undefined?{order:f.o}:{}),...(f.dist!==undefined?{distributivity:f.dist}:{}),...(f.sem!==undefined?{semantics:f.sem}:{}),...(f.dep!==undefined?{dependent_on:Array.isArray(f.dep)?f.dep:[f.dep]}:{})});
    else if(type==='LS'){delete f.id;pending.ls.push(genericUnflatten(f,{t:'type'}));}
    else if(type==='PS')pending.ps.push(genericUnflatten(f,{t:'type',trg:'target',ent:'entity'}));
    else if(type==='CI')pending.ci.push(genericUnflatten(f,{t:'type',trg:'target'}));
    else if(type==='CX')pending.cx.push(genericUnflatten(f,{t:'type',st:'status'}));
    else if(type==='MN')pending.mn.push(genericUnflatten(f));
    else if(type==='AM')pending.am.push({span:f.span,type:f.t,options:Array.isArray(f.opt)?f.opt:[f.opt],preferred:f.pref??null});
    else if(type==='MS')pending.ms.push(f.v!==undefined?f.v:genericUnflatten(f,{t:'type',why:'reason'}));
    else if(type==='UM')pending.um.push(f.v);
    else if(type==='Q')pending.question=genericUnflatten(f,{t:'type',exp:'expected_type'});
  }
  // Attach global operators to the frame reached by following scope links.
  const terminalFrame=(opId)=>{let cur=opId,seen=new Set();while(ops.has(cur)&&!seen.has(cur)){seen.add(cur);cur=ops.get(cur).scope;}return frames.has(cur)?cur:null;};
  for(const [oid,o] of ops){const fid=terminalFrame(oid);if(!fid)continue;frames.get(fid).operators.push(o);}
  // Ensure deterministic inner-to-outer order where possible.
  for(const fr of frames.values())fr.operators.sort((a,b)=>{
    const depth=x=>{let d=0,c=x,seen=new Set();while(ops.has(c)&&!seen.has(c)){seen.add(c);c=ops.get(c).scope;d++;}return d;};return depth(a.id)-depth(b.id);
  });
  ir.relations=pending.relations;
  if(pending.entity_relations.length)ir.entity_relations=pending.entity_relations;
  if(pending.groups.length)ir.logical_groups=pending.groups;
  if(pending.qs.length)ir.quantifier_scopes=pending.qs;
  if(pending.ls.length)ir.logical_scope=pending.ls;
  if(pending.ps.length)ir.presuppositions=pending.ps;
  if(pending.ci.length)ir.conventional_implicatures=pending.ci;
  if(pending.cx.length)ir.context_dependencies=pending.cx;
  if(pending.mn.length)ir.mentions=pending.mn;
  ir.ambiguities=pending.am;ir.missing=pending.ms;ir.unmapped=pending.um;ir.question=pending.question;
  return ir;
}

export function syntaxPieces(s){
  // Model-agnostic structural proxy: words/numbers/quoted strings/punctuation.
  const m=String(s).match(/"(?:\\.|[^"\\])*"|\$?[A-Za-z_][A-Za-z0-9_.:\/-]*|[-+]?\d+(?:\.\d+)?|[^\s]/g);
  return m?m.length:0;
}
