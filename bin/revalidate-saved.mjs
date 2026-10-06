// Re-run deterministic validation and CNL conversion on saved model outputs.
// This command has no model client and never invokes generation, repair or judging.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';
import {localChecks,assessCandidate,stable} from '../lib/local-quality.mjs';
import {summarize} from '../lib/judge.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node bin/revalidate-saved.mjs SOURCE_REPORT NEW_OUTPUT_DIRECTORY');
const dest=path.resolve(output),source=fs.readFileSync(input,'utf8'),old=JSON.parse(source);
if(fs.existsSync(dest))throw new Error('Output directory already exists; preserve prior evidence');
const started=performance.now(),startedAt=new Date().toISOString();
const rows=old.rows.map(previous=>{
 const convert=previous.variant.includes('_clause-')?convertClauseSop:previous.variant.includes('_event-')?convertEventSop:null;
 if(!convert)throw new Error('Unknown dialect: '+previous.variant);
 const conversion=convert(previous.raw),checks=localChecks(previous.source,conversion);
 const unchanged=previous.conversion?.ok&&conversion.ok&&stable({cnl:conversion.cnl,notation:conversion.notation})===stable({cnl:previous.conversion.cnl,notation:previous.conversion.notation});
 const judgeRaw=unchanged?previous.judgeRaw:null;
 const eligible=conversion.ok&&!checks.blocking.length;
 const assessment=eligible&&!judgeRaw?{ok:false,success:false,verdict:'judgment-pending',error:'Local checks pass; no judgment is available for this exact source/CNL/notation pair.'}:assessCandidate(conversion,checks,judgeRaw);
 return {caseId:previous.caseId,variant:previous.variant,source:previous.source,raw:previous.raw,conversion,localChecks:checks,judgeRaw,assessment,
  previous:{assessment:previous.assessment,conversionOk:previous.conversion?.ok,errors:previous.conversion?.errors,blocking:previous.localChecks?.blocking},
  judgmentReused:!!judgeRaw,cnlUnchanged:!!unchanged,repairCount:previous.repairCount,
  attempts:(previous.attempts??[]).map(a=>{const c=convert(a.raw);return {number:a.number,raw:a.raw,conversion:c,localChecks:localChecks(previous.source,c)};})};
});
const groups={};
for(const row of rows){
 const g=groups[row.variant]??={total:0,accepted:0,different:0,invalid:0,localReview:0,pending:0,other:0,judgmentsReused:0};
 g.total++;if(row.judgmentReused)g.judgmentsReused++;
 if(row.assessment.success)g.accepted++;
 else if(!row.conversion.ok)g.invalid++;
 else if(row.assessment.verdict==='different')g.different++;
 else if(row.assessment.verdict==='local-review')g.localReview++;
 else if(row.assessment.verdict==='judgment-pending')g.pending++;
 else g.other++;
}
const result={sourceReport:path.resolve(input),sourceSha256:createHash('sha256').update(source).digest('hex'),startedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-started,providerCalls:0,inputTokens:0,outputTokens:0,savedOutputsReused:rows.length,unit:old.unit,cases:old.cases,groups,summary:summarize(rows),rows,notes:['Offline replay of saved raw outputs, not a new generation/repair experiment or a provider response-cache audit.','Judgments reused only for unchanged source/CNL/notation pairs from the source report.','Local validity alone is not semantic equivalence.','Original evidence is unchanged. Current converter libraries and this runner are snapshotted alongside this report.']};
fs.mkdirSync(dest,{recursive:true});
fs.cpSync(path.join(root,'lib'),path.join(dest,'lib'),{recursive:true});
fs.mkdirSync(path.join(dest,'bin'));
fs.copyFileSync(fileURLToPath(import.meta.url),path.join(dest,'bin/revalidate-saved.mjs'));
fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(result,null,2)+'\n');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table='<table><tr>'+['Workflow','Total','Accepted','Different','Invalid','Numeric review','Pending judgment'].map(c=>'<th>'+c+'</th>').join('')+'</tr>'+Object.entries(groups).map(([v,g])=>'<tr>'+[v,g.total,g.accepted,g.different,g.invalid,g.localReview,g.pending].map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</table>';
const details=rows.map(r=>'<details><summary>'+esc(r.variant+' / '+r.caseId+' — '+r.assessment.verdict)+'</summary><p>Previous: '+esc(r.previous.assessment.verdict)+'</p><pre>'+esc(r.assessment.error??r.assessment.judgment?.explanation)+'</pre><h3>Current diagnostics</h3><pre>'+esc(JSON.stringify(r.localChecks,null,2))+'</pre><h3>Saved model output</h3><pre>'+esc(r.raw)+'</pre></details>').join('');
fs.writeFileSync(path.join(dest,'report.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Offline revalidation</title><style>body{font:16px/1.5 system-ui;max-width:1400px;margin:30px}table{border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ccc;text-align:left}pre{white-space:pre-wrap}details{margin:12px 0}</style><h1>Offline revalidation of 60 full-file outputs</h1><p>Zero provider calls or tokens. No new repair or semantic judgments.</p>'+table+'<ul>'+result.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul><p><a href="report.json">Full evidence</a></p>'+details+'</html>');
console.log(JSON.stringify({groups,elapsedMs:result.elapsedMs,providerCalls:0,report:path.join(dest,'report.html')},null,2));
