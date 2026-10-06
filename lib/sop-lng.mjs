import {throwIssues} from './validation.mjs';
// Lossless common record syntax for the supplied formalization dialects.
// Semantic aliases are shared only when their meanings coincide.
const idPattern=/^[A-Za-z0-9_-]+$/;
const keyPattern=/^[A-Za-z_][A-Za-z0-9_.-]*$/;
const ref=id=>({$ref:id});
const isRef=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&typeof v.$ref==='string';

function split(text,delimiter){
  const out=[];let start=0,quoted=null,escaped=false,depth=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(escaped){escaped=false;continue;}
    if(c==='\\'&&quoted){escaped=true;continue;}
    if(quoted){if(c===quoted)quoted=null;continue;}
    if(c==='"'||c==="'"&&(i===0||/[=,\[\s:]/.test(text[i-1]))){quoted=c;continue;}
    if(c==='['||c==='{')depth++;
    if(c===']'||c==='}')depth--;
    if(depth<0)throw new Error('Unbalanced value');
    if(depth===0&&(delimiter==='space'?/\s/.test(c):c===delimiter)){
      const part=text.slice(start,i).trim();if(part)out.push(part);else if(delimiter!=='space')throw new Error('Empty list item');start=i+1;
    }
  }
  if(quoted||depth!==0)throw new Error('Unclosed value');
  const tail=text.slice(start).trim();if(tail)out.push(tail);else if(delimiter!=='space'&&text.length)throw new Error('Empty list item');return out;
}
function value(text,{groupedNumbers=false}={}){
  if(!text)throw new Error('Missing value');
  if(groupedNumbers&&/^(?:[<>]=?|~)?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:_[A-Za-z][\w]*)?$/.test(text))return value(text.replaceAll(',',''),{groupedNumbers});
  const list=split(text,',');if(list.length>1)return list.map(x=>value(x,{groupedNumbers})); // SOP v5 comma lists
  if(text.startsWith('[')){
    if(!text.endsWith(']'))throw new Error('Malformed list');
    return split(text.slice(1,-1),',').map(x=>value(x,{groupedNumbers}));
  }
  if(text.startsWith('{')){
    if(!text.endsWith('}'))throw new Error('Malformed object');
    const result={};
    for(const part of split(text.slice(1,-1),',')){
      const match=/^("(?:\\.|[^"\\])*"):(.*)$/.exec(part);
      if(!match)throw new Error('Object keys must be quoted');
      const k=JSON.parse(match[1]);
      if(Object.hasOwn(result,k))throw new Error('Duplicate object key');
      Object.defineProperty(result,k,{value:value(match[2],{groupedNumbers}),enumerable:true,writable:true,configurable:true});
    }
    return result;
  }
  if(text.startsWith('"')){const s=JSON.parse(text);if(typeof s!=='string')throw new Error('Invalid string');return s;}
  if(text.startsWith("'")){
    if(!/^'(?:\\.|[^'\\])*'$/s.test(text))throw new Error('Invalid single-quoted string');
    // Decode the same escapes as double-quoted values, plus an escaped apostrophe.
    // Embedded double quotes are literal; never evaluate model output as code.
    const body=text.slice(1,-1).replace(/\\.|"/gs,token=>token==="\\'"?"'":token==='"'?'\\"':token);
    return JSON.parse('"'+body+'"');
  }
  if(text.startsWith('$')){if(!idPattern.test(text.slice(1)))throw new Error('Invalid reference');return ref(text.slice(1));}
  if(text==='true')return true;if(text==='false')return false;if(text==='null')return null;
  if(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)){const n=Number(text);if(!Number.isFinite(n))throw new Error('Nonfinite number');return n;}
  // Any nonempty atom without structural delimiters is an unambiguous literal.
  // Comparisons, percentages, units and times do not require arbitrary quoting.
  if(/[\s\[\]{}"\\,]/u.test(text))throw new Error(`Invalid bare value: ${text}`);
  return text;
}
function encode(v,{native=false}={}){
  if(isRef(v))return '$'+v.$ref;
  if(Array.isArray(v))return native?v.map(x=>encode(x,{native})).join(','):'['+v.map(x=>encode(x)).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+encode(x)).join(',')+'}';
  if(typeof v==='string')return /^[A-Za-z_?+./:][A-Za-z0-9_?+./:\-]*$/.test(v)&&!['null','true','false'].includes(v)?v:JSON.stringify(v);
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  throw new Error('Unsupported SOP-LNG value');
}
export function parseSopLng(text,{repeatableFields=[],normalizations=[],deduplicateFields=false,deduplicateRecords=false,groupedNumbers=false,fieldName=(_type,key)=>key}={}){
  const records=[],ids=new Set(),issues=[];
  const add=(error,record,line,field)=>issues.push({code:'invalid-syntax',record,line,field,message:error.message});
  for(const [index,line] of String(text).split(/\r?\n/).entries()){
    if(!line.trim())continue;
    let id;
    try{
      const tokens=split(line,'space');id=tokens[0]?.slice(1);const type=tokens[1];
      if(!tokens[0]?.startsWith('@')||!idPattern.test(id)||!type||!/^[_A-Za-z][_A-Za-z0-9]*$/.test(type))throw new Error('Expected @id TYPE key=value');
      if(ids.has(id)&&!deduplicateRecords)throw new Error(`Duplicate ID: ${id}`);ids.add(id);
      const fields={};
      for(const token of tokens.slice(2)){
        const eq=token.indexOf('='),key=fieldName(type,token.slice(0,eq));
        try{
          if(eq<1||!keyPattern.test(key))throw new Error(`Invalid field: ${token}`);
          const literal=token.slice(eq+1),parsed=value(literal,{groupedNumbers});
          if(groupedNumbers&&/^(?:[<>]=?|~)?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:_[A-Za-z][\w]*)?$/.test(literal))normalizations.push({record:id,field:key,action:'normalize-grouped-number',before:literal});
          if(Object.hasOwn(fields,key)){
            if(deduplicateFields&&JSON.stringify(fields[key])===JSON.stringify(parsed)){normalizations.push({record:id,field:key,action:'deduplicate-identical-field'});continue;}
            if(!repeatableFields.includes(type+'.'+key))throw new Error(`Duplicate scalar field: ${token}`);
            fields[key]=[fields[key],parsed].flat();
            normalizations.push({record:id,field:key,action:'collect-repeated-values'});
          }else Object.defineProperty(fields,key,{value:parsed,enumerable:true,writable:true,configurable:true});
        }catch(error){add(error,id,index+1,eq>0?key:null);}
      }
      const previous=records.find(r=>r.id===id);
      if(previous){
        const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
        if(previous.type!==type||JSON.stringify(ordered(previous.fields))!==JSON.stringify(ordered(fields)))throw new Error(`Conflicting duplicate ID: ${id}`);
        normalizations.push({record:id,line:index+1,action:'deduplicate-identical-record'});
      }else records.push({id,type,fields});
    }catch(error){add(error,id,index+1,null);}
  }
  // Syntax failures make partial records unreliable. Collect across independent
  // lines/fields, but do not manufacture reference/type errors from dropped data.
  throwIssues(issues);
  if(!records.length)throw new Error('Empty SOP-LNG document');
  const visit=(v,r,field)=>{
    if(isRef(v)){if(!ids.has(v.$ref))issues.push({code:'unresolved-reference',record:r.id,field,message:`Unresolved reference: ${v.$ref}`});}
    else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>visit(x,r,field+'.'+k));
  };
  records.forEach(r=>Object.entries(r.fields).forEach(([k,v])=>visit(v,r,k)));
  throwIssues(issues);return records;
}
export function serializeSopLng(records,{native=false}={}){
  const text=records.map(r=>`@${r.id} ${r.type}`+Object.entries(r.fields).map(([k,v])=>` ${k}=${encode(v,{native})}`).join('')).join('\n');
  parseSopLng(text);return text;
}
const eventKeys={verb:'p',who:'subj',what:'obj',not:'neg',tags:'mods',flags:'flags',formula:'formula',logic:'logic',args:'args',type:'cnl.type'};
const entityKeys={quant:'q',adj:'adj',plural:'plural',mods:'mods'};
const reverse=map=>Object.fromEntries(Object.entries(map).map(([a,b])=>[b,a]));
const status={fact:'asserted',unasserted:'unasserted',question:'queried',embedded_question:'queried',directive:'directive',expressive:'expressive'};
const transform=(v,fn)=>Array.isArray(v)?v.map(x=>transform(x,fn)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,transform(x,fn)])):fn(v);

export function toSopLng(dialect,document){
  if(dialect==='sop-v5'){
    const records=parseSopLng(document);
    let id='document';while(records.some(r=>r.id===id))id+='-';
    return serializeSopLng([{id,type:'DOC',fields:{dialect,nodes:records.map(r=>ref(r.id))}},...records]);
  }
  if(dialect!=='cnl-e')throw new Error('Unknown SOP-LNG dialect');
  const all=[...document.entities,...document.events],ids=new Set(all.map(r=>r.id));
  const link=v=>typeof v==='string'&&ids.has(v)?ref(v):v;
  let id='document';while(ids.has(id))id+='-';
  const records=[{id,type:'DOC',fields:{dialect,entities:document.entities.map(r=>ref(r.id)),events:document.events.map(r=>ref(r.id))}}];
  for(const [items,type,keys] of [[document.entities,'E',entityKeys],[document.events,'EV',eventKeys]])for(const node of items){
    const fields={};
    for(const [k,v] of Object.entries(node)){
      if(k==='id')continue;
      if(!keys[k])throw new Error(`Unmapped CNL-E key: ${k}`);
      fields[keys[k]]=['who','what','tags','mods','args'].includes(k)?transform(v,link):v;
    }
    if(type==='EV'){
      fields.st=status[node.type??'fact'];
      if(node.flags?.includes('PAST'))fields.t='past';
      if(node.flags?.includes('FUTURE'))fields.t='future';
    }
    records.push({id:node.id,type,fields});
  }
  return serializeSopLng(records);
}
export function fromSopLng(text){
  const records=parseSopLng(text),docs=records.filter(r=>r.type==='DOC');
  if(docs.length!==1)throw new Error('Exactly one DOC record is required');
  const doc=docs[0],byId=new Map(records.map(r=>[r.id,r]));
  const select=refs=>{if(!Array.isArray(refs)||refs.some(r=>!isRef(r)))throw new Error('DOC lists must contain references');return refs.map(r=>byId.get(r.$ref));};
  if(doc.fields.dialect==='sop-v5'){
    const nodes=select(doc.fields.nodes);
    if(nodes.length!==records.length-1||new Set(nodes).size!==nodes.length||nodes.includes(doc))throw new Error('DOC nodes must cover every non-DOC record once');
    return {dialect:'sop-v5',document:serializeSopLng(nodes,{native:true})};
  }
  if(doc.fields.dialect!=='cnl-e')throw new Error('Unknown dialect');
  const unlink=v=>isRef(v)?v.$ref:Array.isArray(v)?v.map(unlink):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,unlink(x)])):v;
  const decode=(r,type,keys)=>{
    if(r.type!==type)throw new Error('Record type does not match DOC list');
    const back=reverse(keys),node={id:r.id};
    for(const [k,v] of Object.entries(r.fields)){
      if(type==='EV'&&['st','t'].includes(k))continue;
      if(!back[k])throw new Error(`Unknown ${type} key: ${k}`);
      node[back[k]]=unlink(v);
    }
    if(type==='EV'){
      if(r.fields.st!==status[node.type??'fact'])throw new Error('Inconsistent assertion status');
      const tense=node.flags?.includes('FUTURE')?'future':node.flags?.includes('PAST')?'past':undefined;
      if(r.fields.t!==tense)throw new Error('Inconsistent tense');
    }
    return node;
  };
  const entities=select(doc.fields.entities),events=select(doc.fields.events),nodes=[...entities,...events];
  if(nodes.length!==records.length-1||new Set(nodes).size!==nodes.length||nodes.includes(doc))throw new Error('DOC lists must cover every non-DOC record once');
  return {dialect:'cnl-e',document:{entities:entities.map(r=>decode(r,'E',entityKeys)),events:events.map(r=>decode(r,'EV',eventKeys))}};
}
