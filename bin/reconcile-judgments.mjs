// Mark disagreements between valid judgments of identical pairs as uncertainty.
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../lib/experiment.mjs';
import {summarizeCoverage} from '../lib/semantic-units.mjs';
import {summarize} from '../lib/judge.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f)));
const report=read('local-assessments.json'),audit=read('judge-consistency.json');
const file=path.join(dir,'reconciled-assessments.json');if(fs.existsSync(file))throw Error('Reconciliation already exists');
const rows=report.rows.map(row=>{
 const conflict=audit.conflicts.find(c=>c.variant===row.variant&&c.caseId===row.caseId);if(!conflict)return row;
 const before=new Map(conflict.beforeCoverage.unitResults.map(u=>[u.id,u]));
 const unitResults=row.assessment.coverage.unitResults.map(u=>{
  const earlier=before.get(u.id);return earlier?.verdict===u.verdict?u:{...u,verdict:'uncertain',reason:'Judges disagree on the identical pair. Earlier: '+earlier?.reason+' Later: '+u.reason};
 });
 const c={...row.assessment.coverage,unitResults,preserved:0,different:0,uncertain:0,additions:null,additionEvidence:'conflicting-judgments'};
 for(const u of unitResults)c[u.verdict]++;
 c.preservedPercent=100*c.preserved/c.evaluated;c.uncertainPercent=100*c.uncertain/c.evaluated;
 return {...row,preReconciliationAssessment:row.assessment,assessment:{...row.assessment,ok:false,success:false,verdict:'judge-conflict',error:'Two valid judgments disagree on an identical source/CNL/notation pair. Disputed units remain uncertain.',coverage:c}};
});
const result={providerCalls:0,conflictingPairs:audit.conflicts.length,summary:summarize(rows),coverage:summarizeCoverage(rows),rows};
fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({conflictingPairs:result.conflictingPairs,coverage:result.coverage},null,2));
