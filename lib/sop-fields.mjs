// Public SOP vocabulary. Short implementation keys stay private to the converters.
import {parseSopLng,serializeSopLng} from './sop-lng.mjs';
export const frames=new Set(['EV','ST','RE','EX','ID','DF','CP']);
const clause={q:'quantifier',adj:'traits',st:'status',embed:'embedded',subj:'subject',p:'verb',obj:'object',neg:'not',t:'tense',args:'items'};
const event={h:'head',ty:'type',n:'name',d:'article',q:'quantifier',qv:'count',pr:'traits',co:'referent',sf:'text',p:'verb',st:'status',as:'aspect',tm:'time',pl:'place',man:'manner',ag:'agent',pa:'patient',th:'theme',xp:'experiencer',sm:'stimulus',rc:'recipient',bn:'beneficiary',ins:'tool',src:'source',dst:'goal',loc:'place',psr:'owner',psd:'item',val:'value',std:'standard',top:'topic',ct:'content',trg:'target',sc:'scope',v:'value',o:'order',ent:'entity',dep:'depends',dist:'distribution',dim:'dimension',cmp:'comparison',dom:'domain',alts:'options',embed:'embedded',exp:'answer',a:'left',b:'right',f:'from',m:'members',k:'kind',cur:'currency',t:'kind'};
export function fieldNames(dialect,type){
 if(dialect==='clause')return type==='G'?{t:'join',m:'members'}:type==='DISC'?{t:'kind'}:clause;
 const map={...event};
 if(!['QS','CP'].includes(type))delete map.k;
 if(!['OP','PS'].includes(type))delete map.trg;
 if(type==='OP'){delete map.val;}
 else delete map.v;
 if(frames.has(type))map.t='tense';
 if(type==='S'){map.f='form';map.a='act';}
 if(type==='ER'){delete map.psr;delete map.psd;} // Native owner/item fields already have these meanings.
 // Both spellings are equivalent physical-place fields in the public graph.
 return map;
}
export function publicRecords(records,dialect){
 return records.map(r=>{
  const fields={};
  for(const [key,value] of Object.entries(r.fields)){
   const name=fieldNames(dialect,r.type)[key]??key;
   if(Object.hasOwn(fields,name)){
    if(JSON.stringify(fields[name])!==JSON.stringify(value))fields[name]=[fields[name],value].flat();
   }else fields[name]=value;
  }
  return {...r,fields};
 });
}
export const publicSop=(records,dialect)=>serializeSopLng(publicRecords(records,dialect));
const roleKeys=['ag','pa','th','xp','sm','rc','bn','ins','src','dst','loc','psr','psd','ct','tm','pl','man'];
export function parseDialect(text,dialect,normalizations=[]){
 const repeatableFields=dialect==='clause'?['E.adj','EV.flags','EV.args','G.m']:['E.pr','AM.alts','OP.alts','LS.m','PS.exists','PS.unique','PS.prior','PS.true','G.m',...Array.from(frames).flatMap(type=>roleKeys.map(key=>type+'.'+key))];
 return parseSopLng(text,{normalizations,deduplicateFields:true,deduplicateRecords:true,groupedNumbers:true,repeatableFields,
  fieldName:(type,key)=>{
   const entries=Object.entries(fieldNames(dialect,type));
   // Resolve canonical names; internal adapters can still feed their compact keys.
   if(dialect==='event'&&key==='place')return 'pl';
   return entries.find(([,name])=>name===key)?.[0]??key;
  }});
}
