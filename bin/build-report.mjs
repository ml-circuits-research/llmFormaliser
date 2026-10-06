import fs from 'node:fs';
import {readRecords} from '../../Ploinky-Worker/lib/metrics.mjs';
import {loadLayers} from '../../Ploinky-Worker/lib/config.mjs';
import {experimentMetrics} from '../lib/experiment-metrics.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const names=process.argv.slice(2);
if(!names.length||names.some(n=>!/^experiment-\d+$/.test(n)))throw new Error('Supply experiment-NNN names');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayVariant=v=>v.replace(/cnl-sop/g,'clause-sop').replace(/(formalise_(?:clause|event))-sop-/g,'$1-');
const page=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#142536}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #ccd;padding:10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f4f8;padding:16px}details{border-bottom:1px solid #ccd;padding:12px 0}summary{cursor:pointer;font-weight:600}.table{overflow:auto}a{color:#1759a1}</style></head><body><h1>${escape(title)}</h1>${body}</body></html>`;
const table=(headers,rows)=>'<div class="table"><table><tr>'+headers.map(h=>`<th>${escape(h)}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${escape(c)}</td>`).join('')+'</tr>').join('')+'</table></div>';
const loaded=names.map(name=>{const dir=path.join(root,'runs',name);const recoveryFile=path.join(dir,'finish-recovery.json');return {name,dir,m:read(path.join(dir,'manifest.json')),r:read(path.join(dir,'report.json')),recovery:fs.existsSync(recoveryFile)?read(recoveryFile):null};});
for(const {name,dir,m,r,recovery} of loaded){
 if(!fs.existsSync(path.join(dir,'provider-attempts.json'))){
  const {config}=loadLayers({from:root});
  const purpose=m.telemetryPurpose??(m.replayOf?'pworker:replay-judge':'pworker:cli');
  const attempts=readRecords(config.dataDir,Date.parse(m.startedAt)).filter(x=>x.ts<=m.finishedAt&&x.purpose===purpose&&x.upstream!=='cache'&&x.upstream!=='proxy'&&!x.not_sent).map(({ts,upstream,model,status,latency_ms,queue_wait_ms,ttft_ms,in_tokens,out_tokens,cached_tokens,attempt,purpose,error})=>({ts,upstream,model,status,latency_ms,queue_wait_ms,ttft_ms,in_tokens,out_tokens,cached_tokens,attempt,purpose,error}));
  fs.writeFileSync(path.join(dir,'provider-attempts.json'),JSON.stringify({startedAt:m.startedAt,finishedAt:m.finishedAt,purpose,attempts},null,2)+'\n');
 }
 const attempts=fs.existsSync(path.join(dir,'provider-attempts.json'))?read(path.join(dir,'provider-attempts.json')).attempts:[];
 r.metrics=experimentMetrics(m,recovery?{...r,rows:recovery.rows}:r,attempts);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(r,null,2)+'\n');
 let body=`<p>Formalizer: ${escape((m.models.small?m.models.small.provider+'/'+(m.models.small?.model??'symbolic'):'local symbolic parser'))}. Judge: ${escape(m.models.best.provider+'/'+m.models.best.model)}.${m.models.repair?' Repairer: '+escape(m.models.repair.provider+'/'+m.models.repair.model)+'.':''}</p><p>Status: ${escape(m.status)}. Model responses: ${r.requests.modelResponses}; batched responses: ${r.requests.batchResponses}. Retries are counted separately in provider-attempts.json when available.</p>`;
 if(fs.existsSync(path.join(dir,'cache-verification.json'))){const cache=read(path.join(dir,'cache-verification.json'));body+=`<p>Cache audit: ${cache.audit.length} verified hits, ${cache.providerCalls} provider calls for formalization replay. <a href="cache-verification.json">Keys and timings</a>.</p>`;}
 if(r.judgmentReuse)body+=`<p>Verified cached judgments reused: ${r.judgmentReuse.reusedItems}; items submitted for judgment: ${r.judgmentReuse.freshItems}. Reuse requires the identical prompt, input pair and selected judge model, verified against the actual strict-cache response.</p>`;
 const consistencyFile=path.join(dir,'judgment-consistency.json');
 if(fs.existsSync(consistencyFile)){const audit=read(consistencyFile);if(audit.conflictingPairs)body+=`<p><strong>Judge inconsistency: ${audit.conflictingPairs} identical source/CNL pairs received different verdicts under the same judge context.</strong> These score differences cannot be attributed to repair. <a href="judgment-consistency.json">Exact pairs and judgments</a>.</p>`;}
 const timingFile=path.join(dir,'workflow-timings.json');
 if(fs.existsSync(timingFile)){const timing=read(timingFile);body+='<h2>Workflow completion times</h2>'+table(['Workflow','Seconds to final result','Equivalent'],timing.rows.map(x=>[displayVariant(x.variant),x.elapsedSeconds.toFixed(1),x.success+'/'+x.total]))+'<p>'+escape(timing.method)+'</p>';}
 body+=table(['Elapsed seconds','Input tokens sent','Output tokens received','Reasoning tokens','Cache hits','Effective output TPS','TPS excluding reported reasoning','Successful cases/min'],[[ (r.metrics.wallMs/1000).toFixed(2),r.metrics.tokens.sent,r.metrics.tokens.received,r.metrics.tokens.reasoning,r.metrics.cacheHits,r.metrics.effectiveOutputTps?.toFixed(2)??'unknown',r.metrics.outputTpsExcludingReportedReasoning?.toFixed(2)??'unknown',r.metrics.successfulCasesPerMinute?.toFixed(2)??'unknown']]);
 body+='<details><summary>Per-response timing and throughput</summary>'+table(['Model','Tasks','Distinct inputs','Elapsed s','Input','Output','Reasoning','Cache','Effective output TPS'],r.metrics.perResponse.map(x=>[x.model,x.batchSize,x.uniqueInputs,(x.elapsedMs/1000).toFixed(3),x.inputTokens,x.outputTokens,x.reasoningTokens,x.cached?'hit':'miss',x.effectiveOutputTps?.toFixed(2)??'cache replay']))+'</details>';
 body+='<p>Effective TPS includes the entire elapsed time, including waits, retries and local phases. Cache replay tokens are not counted as newly generated tokens. Reasoning tokens are a subset of output tokens where reported.</p>';
 if(recovery)body+='<p>Summary below includes verified local recovery of final results. No new inference was used. <a href="finish-recovery.json">Recovery and original error provenance</a>.</p>';
 const caseSources=[...new Set(m.cases.map(c=>c.source).filter(Boolean))];
 if(caseSources.length)body+='<h2>Coverage by source file</h2>'+table(['File','Workflow','Equivalent','Invalid','Other failures'],caseSources.flatMap(source=>m.variants.map(v=>{const ids=new Set(m.cases.filter(c=>c.source===source).map(c=>c.id));const rows=(recovery?.rows??r.rows).filter(x=>x.variant===v&&ids.has(x.caseId));return [source,displayVariant(v),rows.filter(x=>x.assessment.success).length+'/'+rows.length,rows.filter(x=>x.conversion?.ok===false).length,rows.filter(x=>!x.assessment.success&&x.conversion?.ok!==false).length];})));
 body+=table(['Approach','Equivalent','Different','Invalid','Uncertain','Execution / judge failures'],Object.entries(recovery?.summary??r.summary).map(([v,s])=>[displayVariant(v),`${s.success}/${s.total}`,s.different,s.invalid,s.uncertain,s.failed]));
 if(r.rows.some(row=>row.attempts?.length))body+='<h2>Single repair pass</h2>'+table(['Approach','Initial equivalent','Final equivalent','Repaired cases','Improved','Regressed','Initial judgments reused'],m.variants.map(v=>{
  const rows=r.rows.filter(x=>x.variant===v),first=x=>x.attempts?.[0]?.assessment??x.assessment;
  return [displayVariant(v),rows.some(x=>x.approach==='symbolic-first')?rows.filter(x=>first(x).success).length+' equivalent / '+rows.filter(x=>first(x).ok).length+' judged; '+rows.filter(x=>!first(x).ok).length+' unjudged':rows.filter(x=>first(x).success).length+'/'+rows.length,rows.filter(x=>x.assessment.success).length+'/'+rows.length,rows.filter(x=>x.repairCount>0).length,rows.some(x=>x.approach==='symbolic-first')?'not measured':rows.filter(x=>!first(x).success&&x.assessment.success).length,rows.some(x=>x.approach==='symbolic-first')?'not measured':rows.filter(x=>first(x).success&&!x.assessment.success).length,rows.filter(x=>x.attempts?.[0]?.judgeReuse).length];
 }));
 if(r.rows.some(row=>row.approach==='symbolic-first'))body+='<h2>Symbolic preparation (unjudged)</h2>'+table(['Approach','Drafts with clauses','Unresolved fragments','Structurally valid drafts','Matched declaration signatures / draft declarations'],m.variants.map(v=>{
  const rows=r.rows.filter(x=>x.variant===v),sum=fn=>rows.reduce((n,x)=>n+fn(x),0);
  return [displayVariant(v),rows.filter(x=>x.symbolicDraft?.graph.clauses.length).length+'/'+rows.length,sum(x=>x.symbolicDraft?.graph.unresolved.length??0),rows.filter(x=>x.draftCheck?.conversion.ok).length+'/'+rows.length,sum(x=>x.retention?.matchedSignatures??0)+' / '+sum(x=>x.retention?.draftRecords??0)];
 }))+'<p>Draft structure and overlap are not semantic success rates. Whether a draft was judged or repaired is recorded in its attempts and repairCount. Historical runs may have used unconditional repair; current task types bypass repair for accepted drafts. No LLM formalization call occurs before repair.</p>';
 body+='<p>These are LLM judgments of the complete formalizer/converter/judge pipeline, not proofs of equivalence or an isolated measure of prompt quality. Invalid outputs remain in the denominator. Source and raw outputs below are retained unchanged.</p>';
 for(const row of recovery?.rows??r.rows){
  body+=`<details><summary>${escape(displayVariant(row.variant))} / ${escape(row.caseId)} — ${escape(row.assessment.verdict)}</summary>`;
  for(const [title,value] of [['Source',row.source],['Formalization',row.raw],['CNL',row.conversion?.cnl??row.conversion?.error],['Assessment',row.assessment],['Local checks',row.localChecks],['Repair attempts',row.attempts],['Symbolic draft',row.symbolicDraft],['Draft diagnostics',row.draftCheck],['Draft overlap',row.retention]])body+=`<h3>${title}</h3><pre>${escape(typeof value==='string'?value:JSON.stringify(value,null,2))}</pre>`;
  body+='</details>';
 }
 body+='<p><a href="report.json">Full JSON report</a> · <a href="manifest.json">Frozen configuration and input hashes</a></p>';
 fs.writeFileSync(path.join(dir,'report.html'),page(name,body));
}
let body=table(['Run','Formalizer → Judge','Repairer','Approach','Equivalent','Different','Invalid','Other failures'],loaded.flatMap(({name,m,r,recovery})=>Object.entries(recovery?.summary??r.summary).map(([v,s])=>[name,(m.models.small?.model??'symbolic')+' → '+m.models.best.model,m.models.repair?.model??(v.endsWith('-repair')?(m.models.small?.model??'symbolic'):'—'),displayVariant(v),`${s.success}/${s.total}`,s.different,s.invalid,s.uncertain+s.failed])));
body+=table(['Run','Elapsed s','Input tokens','Output tokens','Reasoning tokens','Effective TPS','TPS excluding reported reasoning','Successful cases/min','Cache hits'],loaded.map(({name,r})=>[name,(r.metrics.wallMs/1000).toFixed(2),r.metrics.tokens.sent,r.metrics.tokens.received,r.metrics.tokens.reasoning,r.metrics.effectiveOutputTps?.toFixed(2)??'unknown',r.metrics.outputTpsExcludingReportedReasoning?.toFixed(2)??'unknown',r.metrics.successfulCasesPerMinute?.toFixed(2)??'unknown',r.metrics.cacheHits]));
for(const {name,m} of loaded.filter(x=>x.m.replayOf))body+=`<p>${escape(name)} replays ${escape(m.replayOf)} formalizations from the actual response cache with updated local converters; the original report remains unchanged.</p>`;
const corrected=loaded.filter(x=>x.m.replayOf && fs.existsSync(path.join(root,'runs',x.m.replayOf,'report.json')));
if(corrected.length){
 body+='<h2>Correction impact on the same cached formalizations</h2>';
 body+=table(['Original → replay','Approach','Equivalent before → after','Invalid before → after'],corrected.flatMap(({name,m,r,recovery})=>{
  const before=read(path.join(root,'runs',m.replayOf,'report.json'));
  return Object.entries(recovery?.summary??r.summary).map(([v,s])=>[m.replayOf+' → '+name,displayVariant(v),before.summary[v].success+' → '+s.success,before.summary[v].invalid+' → '+s.invalid]);
 }));
 body+='<p>The formalizer outputs are identical. Conversion fixes can change the judge input; those judgments must be rerun. A changed success count measures the corrected pipeline, not an improvement in the model itself. Cache hits and fresh inference are counted separately above.</p>';
}
body+='<p><a href="invalid-analysis.html">Invalid outputs and exact offending lines</a></p>';
body+='<p>Dataset sizes can differ between experiments; consult their frozen manifests and per-file coverage before comparing scores. Changing both formalizer and judge changes the evaluator as well as the candidate; these scores do not establish a model ranking. Batch response errors, syntax validation and semantic judgments must be distinguished.</p>';
body+='<ul>'+loaded.map(({name})=>`<li><a href="${name}/report.html">${name}: case details</a></li>`).join('')+'</ul>';
const cancelled=fs.readdirSync(path.join(root,'runs')).filter(n=>/^experiment-\d+$/.test(n)).flatMap(name=>{
 const file=path.join(root,'runs',name,'manifest.json');if(!fs.existsSync(file))return [];
 const m=read(file);return m.status==='cancelled'?[{name,m}]:[];
});
if(cancelled.length)body+='<h2>Stopped runs (not assigned a complete quality score)</h2>'+table(['Run','Formalizer → judge','Reason'],cancelled.map(({name,m})=>[name,(m.models.small?.model??'symbolic')+' → '+m.models.best.model,m.cancellationReason]));
const file=path.join(root,'runs','comparison.html');fs.writeFileSync(file,page('Formalization experiments',body));console.log(file);
