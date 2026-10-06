import fs from 'node:fs';
import path from 'node:path';
import {root} from '../lib/experiment.mjs';
import {formalizationInput} from '../lib/formalization-input.mjs';
import {parseSopLng} from '../lib/sop-lng.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';
const names=process.argv.slice(2);
if(!names.length||names.some(n=>!/^experiment-\d+$/.test(n)))throw new Error('Supply experiment-NNN names');
const rows=[];
for(const run of names){
 const report=JSON.parse(fs.readFileSync(path.join(root,'runs',run,'report.json'),'utf8'));
 for(const row of report.rows.filter(r=>r.conversion?.ok===false)){
  const current=/(?:cnl|clause)-sop|formalise_clause-/.test(row.variant)?convertClauseSop(row.raw,{legacy:true}):convertEventSop(row.raw);
  const evidence=[];let normalized;
  try{normalized=formalizationInput(row.raw);}catch(error){evidence.push({error:error.message});}
  if(normalized)for(const [index,line] of normalized.text.split(/\r?\n/).entries()){
   if(!line.trim())continue;
   try{parseSopLng(line,{repeatableFields:['PS.exists']});}catch(error){
    // Single-line probes cannot validate references to other declarations.
    if(!/^Unresolved reference:/.test(error.message))evidence.push({line:index+1,text:line,error:error.message});
   }
  }
  rows.push({run,variant:row.variant,caseId:row.caseId,source:row.source,originalError:row.conversion.error,
   currentAccepted:current.ok,stage:current.stage??null,currentError:current.error??null,
   classification:current.ok?'recovered-by-local-code':evidence.some(x=>x.line)?'malformed-sop-value-or-field':'structural-or-schema-error',
   normalizations:normalized?.normalizations??[],evidence,raw:row.raw});
 }
}
const note='Original model outputs and reports are preserved. Historical invalid cases are rechecked with the current converter. Structural recovery is not semantic success; only the separate replay judgment evaluates equivalence.';
const result={note,rows};
fs.writeFileSync(path.join(root,'runs/invalid-analysis.json'),JSON.stringify(result,null,2)+'\n');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let body='<h1>Invalid formalizations: root-cause audit</h1><p>'+esc(note)+'</p><p>The old Event-SOP adapter narrowed the native graph to legacy v4 IR, rejected declared operator/question/quantifier targets, and dropped unsupported fields. The new converter preserves all native fields and typed references. Presentation wrappers and repeated existence fields are normalized losslessly. A stray quote after a bare modifier label is normalized with an exact edit log. Missing meanings, unresolved quoted strings and comparator directions are not invented.</p><table><tr><th>Run</th><th>Approach</th><th>Reported invalid</th><th>Recovered locally</th><th>Still invalid</th></tr>';
for(const run of names)for(const variant of [...new Set(rows.filter(x=>x.run===run).map(x=>x.variant))]){
 const group=rows.filter(x=>x.run===run&&x.variant===variant);
 body+=`<tr><td>${esc(run)}</td><td>${variant}</td><td>${group.length}</td><td>${group.filter(x=>x.currentAccepted).length}</td><td>${group.filter(x=>!x.currentAccepted).length}</td></tr>`;
}
body+='</table><p>For Qwen Clause-SOP, a single-ID object wrapper can be extracted, and the repeated stray quote after bare modifier labels is normalized; ambiguous or unclosed quoted strings remain errors. Ordinary JSON newline escapes are not literal backslash-n characters. Numeric lexical units such as 10000_euro are retained as strings, and numeric modifier values remain numbers. Multiword values such as h=sales team must be quoted.</p>';
for(const row of rows)body+=`<details><summary>${esc(row.run+' / '+row.variant+' / '+row.caseId)} — ${esc(row.currentAccepted?'recovered locally':row.currentError)}</summary><p>${esc(row.source)}</p><pre>${esc(JSON.stringify({originalError:row.originalError,normalizations:row.normalizations,evidence:row.evidence},null,2))}</pre><pre>${esc(typeof row.raw==='string'?row.raw:JSON.stringify(row.raw,null,2))}</pre></details>`;
body+='<p><a href="invalid-analysis.json">Machine-readable audit</a> · <a href="comparison.html">Experiment comparison</a></p>';
fs.writeFileSync(path.join(root,'runs/invalid-analysis.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invalid formalizations</title><style>body{font:16px/1.6 system-ui;max-width:1150px;margin:36px auto;padding:0 20px;color:#142536}table{border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ccd;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f4f8;padding:16px}details{padding:12px 0;border-bottom:1px solid #ccd}summary{cursor:pointer;font-weight:600}</style>'+body+'</html>');
console.log(JSON.stringify({invalidRows:rows.length,stillInvalid:rows.filter(x=>!x.currentAccepted).length},null,2));
