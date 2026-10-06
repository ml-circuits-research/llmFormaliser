// Recover already persisted final artifacts only; never infer missing phases.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {root} from '../lib/experiment.mjs';
import {summarize} from '../lib/judge.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name),report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
const {assessCandidate}=await import(pathToFileURL(path.join(dir,'lib/local-quality.mjs')));
let recovered=0;
const rows=report.rows.map(row=>{
 if(row.worker?.ok||!row.worker?.error?.includes('result is larger than'))return row;
 const file=path.join(dir,'artifacts',row.variant,row.caseId+'-result.json');if(!fs.existsSync(file))return row;
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(saved.caseId,row.caseId);assert.equal(saved.variant,row.variant);assert.equal(saved.source,row.source);
 assert.deepEqual(saved.raw,row.worker.state.raw);assert.deepEqual(saved.judgeRaw,row.worker.state.judgeRaw);
 assert.deepEqual(saved.assessment,assessCandidate(saved.conversion,saved.localChecks,saved.judgeRaw));
 recovered++;return {...saved,worker:row.worker,recovery:{originalError:row.worker.error,mode:'verified-persisted-final-artifact'}};
});
const result={source:name,providerCalls:0,recovered,note:'Recovered final results that were fully written before the sandbox return payload exceeded its limit. Identity, source, raw candidate and judgment were checked; assessment was revalidated using the frozen original code. Original worker execution remains unchanged.',summary:summarize(rows),rows};
fs.writeFileSync(path.join(dir,'finish-recovery.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({recovered,summary:result.summary},null,2));
