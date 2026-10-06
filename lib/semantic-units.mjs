// Evaluation anchors only. The full file remains one worker task and one input.
// Stable 64-bit FNV-1a identifier, independent of process/run and sandbox-safe.
function textHash(text){let h=14695981039346656037n;for(let i=0;i<text.length;i++){h^=BigInt(text.charCodeAt(i));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16).padStart(16,'0');}
export function semanticUnits(source){
 const units=[],seen=new Map();
 const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
 for(const paragraph of source.matchAll(/[^\r\n]+(?:\r?\n(?!\s*\r?\n)[^\r\n]+)*/g)){
  for(const part of segmenter.segment(paragraph[0])){
   const text=part.segment.trim();if(!text)continue;
   const start=paragraph.index+part.index+part.segment.indexOf(text),hash=textHash(text);
   const occurrence=(seen.get(hash)??0)+1;seen.set(hash,occurrence);
   units.push({id:'u-'+hash+'-'+occurrence,start,end:start+text.length,text});
  }
 }
 return units;
}
export function assessUnits(judgment,units){
 if(!Array.isArray(judgment.units))throw new Error('Judge must return units');
 const additions=judgment.additions??(judgment.source_entails_cnl==='yes'?[]:null);
 if(additions!==null&&(!Array.isArray(additions)||!additions.every(x=>typeof x==='string')))throw new Error('Invalid additions list');
 const expected=new Set(units.map(u=>u.id)),seen=new Set();
 const counts={preserved:0,different:0,uncertain:0};
 for(const u of judgment.units){
  if(!u||!expected.has(u.id)||seen.has(u.id))throw new Error('Unknown or duplicate judgment unit');seen.add(u.id);
  if(!Object.hasOwn(counts,u.verdict)||typeof u.reason!=='string'||!u.reason.trim())throw new Error('Invalid unit verdict/reason');
  counts[u.verdict]++;
 }
 if(seen.size!==expected.size)throw new Error('Missing judgment units');
 if(judgment.verdict==='equivalent'&&(counts.different||counts.uncertain||additions?.length))throw new Error('Equivalent verdict conflicts with unit evidence');
 if(judgment.verdict==='different'&&!counts.different&&!additions?.length&&judgment.source_entails_cnl!=='no')throw new Error('Different verdict needs a changed source unit or unsupported addition');
 return {...counts,total:units.length,evaluated:units.length,unassessable:0,preservedPercent:100*counts.preserved/units.length,uncertainPercent:100*counts.uncertain/units.length,additions:additions?.length??null,additionEvidence:judgment.additions!=null?'explicit-list':judgment.source_entails_cnl==='yes'?'global-entailment-yes':'not-enumerated',unitResults:judgment.units};
}
export function unevaluatedUnits(units){return {total:units.length,evaluated:0,unassessable:units.length,preserved:0,different:0,uncertain:0,preservedPercent:null,uncertainPercent:null,additions:null};}
export function summarizeCoverage(rows){
 const groups={};
 for(const r of rows){
  const g=groups[r.variant]??={files:0,fullyEquivalent:0,total:0,evaluated:0,unassessable:0,preserved:0,different:0,uncertain:0,additions:0,additionsUnenumerated:0};
  const c=r.assessment?.coverage??unevaluatedUnits(semanticUnits(r.source));g.files++;if(c.evaluated&&c.additions==null)g.additionsUnenumerated++;if(r.assessment?.success)g.fullyEquivalent++;
  for(const key of ['total','evaluated','unassessable','preserved','different','uncertain','additions'])g[key]+=c[key]??0;
 }
 for(const g of Object.values(groups)){g.preservedPercent=g.evaluated?100*g.preserved/g.evaluated:null;g.assessedPercent=g.total?100*g.evaluated/g.total:null;g.lowerBoundPercent=g.total?100*g.preserved/g.total:null;g.upperBoundPercent=g.total?100*(g.preserved+g.uncertain+g.unassessable)/g.total:null;}
 return groups;
}

// Keep independently addressable unit evidence when a judge mistypes or omits an
// ID. Never guess alignment by output order, wording similarity or index.
export function partialUnitCoverage(judgment,units){
 if(!judgment||!Array.isArray(judgment.units))return null;
 const expected=new Set(units.map(u=>u.id)),groups=new Map(),issues=[];
 for(const item of judgment.units){
  if(!item||!expected.has(item.id)){issues.push('Unknown unit ID: '+String(item?.id));continue;}
  const group=groups.get(item.id)??[];group.push(item);groups.set(item.id,group);
 }
 const counts={preserved:0,different:0,uncertain:0},unitResults=[];
 for(const u of units){
  const entries=groups.get(u.id)??[];
  if(entries.length!==1||!Object.hasOwn(counts,entries[0]?.verdict)||typeof entries[0]?.reason!=='string'||!entries[0].reason.trim()){
   issues.push('Missing, duplicated or malformed unit: '+u.id);continue;
  }
  counts[entries[0].verdict]++;unitResults.push(entries[0]);
 }
 const evaluated=unitResults.length;
 return {...counts,total:units.length,evaluated,unassessable:units.length-evaluated,preservedPercent:evaluated?100*counts.preserved/evaluated:null,uncertainPercent:evaluated?100*counts.uncertain/evaluated:null,additions:Array.isArray(judgment.additions)?judgment.additions.length:null,unitResults,issues};
}
