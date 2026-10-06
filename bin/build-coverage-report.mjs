import {experimentMetrics} from '../lib/experiment-metrics.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../lib/experiment.mjs';
import {semanticUnits,summarizeCoverage} from '../lib/semantic-units.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw new Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name),r=JSON.parse(fs.readFileSync(path.join(dir,'report.json'))),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const localFile=path.join(dir,'local-assessments.json');
const local=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile)):null;
if(local)r.rows=local.rows;
const reconciledFile=path.join(dir,'reconciled-assessments.json');
const reconciled=fs.existsSync(reconciledFile)?JSON.parse(fs.readFileSync(reconciledFile)):null;
if(reconciled)r.rows=reconciled.rows;
const attemptsFile=path.join(dir,'provider-attempts.json');
r.metrics=experimentMetrics(m,r,fs.existsSync(attemptsFile)?JSON.parse(fs.readFileSync(attemptsFile)).attempts:[]);
const coverage=summarizeCoverage(r.rows);
let original=null;
if(m.revalidationOf){const originalDir=path.join(root,'runs',m.revalidationOf);original={manifest:JSON.parse(fs.readFileSync(path.join(originalDir,'manifest.json'))),report:JSON.parse(fs.readFileSync(path.join(originalDir,'report.json')))};}
const combined=original?{originalRun:m.revalidationOf,original:original.report.metrics,continuation:r.metrics,providerCalls:(original.report.metrics?.providerAttempts?.count??original.report.requests.modelResponses)+(r.metrics?.providerAttempts?.count??r.requests.modelResponses),inputTokens:(original.report.metrics?.tokens.sent??0)+(r.metrics?.tokens.sent??0),outputTokens:(original.report.metrics?.tokens.received??0)+(r.metrics?.tokens.received??0),reasoningTokens:(original.report.metrics?.tokens.reasoning??0)+(r.metrics?.tokens.reasoning??0),elapsedMs:Date.parse(m.finishedAt)-Date.parse(original.manifest.startedAt)}:null;
if(combined){combined.outputTps=combined.outputTokens/(combined.elapsedMs/1000);combined.outputTpsWithoutReasoning=(combined.outputTokens-combined.reasoningTokens)/(combined.elapsedMs/1000);}
const report={name,models:m.models,unit:m.datasetUnit==='nonempty-line'?'One nonempty physical line per task; source sentences are evaluation anchors only':'One entire file per task; exact source sentences are evaluation anchors only',coverage,metrics:r.metrics,combined,judgeConflicts:reconciled?.conflictingPairs??0,localAssessment:local?{providerCalls:local.providerCalls,elapsedMs:local.elapsedMs,codeHashes:local.codeHashes}:null,rows:r.rows.map(({worker,...row})=>row)};
fs.writeFileSync(path.join(dir,'coverage.json'),JSON.stringify(report,null,2)+'\n');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>n==null?'not evaluated':n.toFixed(1)+'%';
const table=(headers,rows)=>'<div class="table"><table><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</table></div>';
let html='<h1>'+esc(name)+': sentence-level semantic coverage</h1><p>'+esc(JSON.stringify(m.models))+'</p><p>'+m.cases.length+' cases per workflow, '+m.variants.length+' workflows. '+(m.datasetUnit==='nonempty-line'?'Each nonempty physical source line is a separate task.':'Each complete source file is a separate task.')+' A source sentence is one evaluation anchor, not one atomic fact.</p>';
if(original)html+='<p>This is a local revalidation of '+esc(m.revalidationOf)+'. Saved generation and repair outputs were reused; only newly eligible/changed pairs required new judgments. Original evidence remains unchanged.</p>';
html+=table(['Workflow','Preserved / evaluated','Preserved %','Assessed %','Different','Uncertain','Unassessable','Unsupported additions','Fully equivalent cases','Whole-set bounds'],Object.entries(coverage).map(([v,c])=>[v,c.preserved+'/'+c.evaluated,pct(c.preservedPercent),pct(c.assessedPercent),c.different,c.uncertain,c.unassessable,c.additions+(c.additionsUnenumerated?' (unknown for '+c.additionsUnenumerated+' graded cases)':''),c.fullyEquivalent+'/'+c.files,pct(c.lowerBoundPercent)+' – '+pct(c.upperBoundPercent)]));
if(reconciled?.conflictingPairs)html+='<p><strong>'+reconciled.conflictingPairs+' identical pairs received conflicting valid judgments.</strong> Disputed units are reported as uncertain, not definite errors or successes. <a href="judge-consistency.json">Evidence</a> · <a href="reconciled-assessments.json">Reconciled results</a></p>';
if(local)html+='<p><a href="local-assessments.json">Offline grading corrections</a> preserve correctly identified unit evidence and avoid rejecting a judgment merely for an omitted redundant empty additions list. No model calls were made for this step.</p>';
html+='<p>Preserved % is conditional on a valid judgment. Assessed % shows how much of the complete dataset has such evidence. Bounds use all source units; unknown units are not silently treated as either successes or semantic failures. Full equivalence also forbids unsupported additions. These are model estimates, not proofs.</p><p><a href="coverage.json">Machine-readable evidence</a> · <a href="report.html">Execution report</a> · <a href="../../docs/judge.html">Scoring definitions</a> · <a href="../../docs/convention-audit.html">Convention audit</a></p>';
html+='<h2>Execution and token accounting</h2><pre>'+esc(JSON.stringify(combined??r.metrics,null,2))+'</pre><h2>Per-case evidence</h2>';
for(const row of r.rows){
 const c=row.assessment?.coverage,units=semanticUnits(row.source),judged=new Map((c?.unitResults??[]).map(u=>[u.id,u]));
 const sourceCase=m.cases.find(x=>x.id===row.caseId);
 const sourceFile=(sourceCase?.source??row.caseId)+(sourceCase?.line?':'+sourceCase.line:'');
 html+='<details><summary>'+esc(row.variant+' / '+sourceFile+' — '+row.assessment.verdict+(c?' — '+pct(c.preservedPercent):''))+'</summary>';
 html+='<p>'+esc(row.assessment.error??row.assessment.judgment?.explanation)+'</p>';
 html+=table(['Source unit','Exact source text','Verdict','Evidence'],units.map(u=>[u.id,u.text,judged.get(u.id)?.verdict??'unassessable',judged.get(u.id)?.reason??row.assessment.error]));
 html+='<h3>Unsupported additions</h3><pre>'+esc(JSON.stringify(row.assessment.judgment?.additions??[],null,2))+'</pre><h3>Saved SOP</h3><pre>'+esc(row.raw)+'</pre><h3>Reconstructed CNL</h3><pre>'+esc(row.conversion?.cnl)+'</pre></details>';
}
fs.writeFileSync(path.join(dir,'coverage.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(name)+' coverage</title><style>body{font:16px/1.5 system-ui;margin:32px;color:#142536}table{border-collapse:collapse;width:100%}td,th{padding:9px;border-bottom:1px solid #ccd;text-align:left;vertical-align:top}.table{overflow:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f4f7;padding:16px}details{margin:14px 0}summary{cursor:pointer;font-weight:600}</style>'+html+'</html>');
console.log(JSON.stringify({coverage,combined:combined?{...combined,original:undefined,continuation:undefined}:null,metrics:{...r.metrics,perResponse:undefined},file:path.join(dir,'coverage.html')},null,2));
