// Report contradictory semantic judgments without rewriting experiment evidence.
import fs from 'node:fs';
import path from 'node:path';
import {root,hash} from '../lib/experiment.mjs';
const names=process.argv.slice(2);
if(!names.length||names.some(n=>!/^experiment-\d+$/.test(n)))throw Error('Supply experiment-NNN names');
for(const name of names){
 const dir=path.join(root,'runs',name),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
 const groups=new Map();
 for(const row of report.rows){
  const attempts=row.attempts?.length?row.attempts:[row];
  for(const [index,attempt] of attempts.entries()){
   if(!attempt.conversion?.ok||!attempt.assessment?.ok||!attempt.assessment.judgment)continue;
   const pair={source:row.source,cnl:attempt.conversion.cnl,notation:attempt.conversion.notation};
   const context=manifest.judgmentContexts?.[row.variant];
   if(!context)continue; // Historic runs without explicit prompt/model context cannot be compared safely.
   const key=hash({context,pair});
   if(!groups.has(key))groups.set(key,{key,pair,observations:[]});
   groups.get(key).observations.push({variant:row.variant,caseId:row.caseId,attempt:attempt.number??index,success:attempt.assessment.success,verdict:attempt.assessment.verdict,judgment:attempt.assessment.judgment,reuse:attempt.judgeReuse??null});
  }
 }
 const conflicts=[...groups.values()].filter(g=>new Set(g.observations.map(o=>o.verdict)).size>1);
 const result={run:name,model:manifest.models.best,comparedPairs:groups.size,conflictingPairs:conflicts.length,note:'Identical expanded judge context and exact source/CNL/notation received different verdicts. Original scores remain unchanged; these differences cannot be attributed to repair.',conflicts};
 fs.writeFileSync(path.join(dir,'judgment-consistency.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({run:name,comparedPairs:groups.size,conflictingPairs:conflicts.length}));
}
