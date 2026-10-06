// Recover only a local finish phase whose preceding judgment was already stored.
// This performs no inference and leaves the failed historical execution intact.
import fs from 'node:fs';
import path from 'node:path';
import {Pworker} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {root,readTask} from '../lib/experiment.mjs';
import {summarize} from '../lib/judge.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name),read=p=>JSON.parse(fs.readFileSync(path.join(dir,p)));
const m=read('manifest.json'),prior=read('raw-results.json'),report=read('report.json');
const workdir=path.join(dir,'finish-recovery');fs.mkdirSync(workdir,{recursive:true});fs.cpSync(path.join(dir,'lib'),path.join(workdir,'lib'),{recursive:true});
const worker=new Pworker({client:{chat:async()=>{throw Error('Local recovery cannot call a model');},json:async()=>{throw Error('Local recovery cannot call a model');}}});
const candidates=prior.results.filter(r=>!r.ok&&r.state.judgeRaw!==undefined&&r.state.conversion?.ok);
for(const r of candidates)worker.enqueue({begin:readTask(m.tasks[r.state.variant].file).finish},r.state,{id:r.id,currentWorkingDirectory:workdir});
const recovered=await worker.flush(),byId=new Map(recovered.map(r=>[r.id,r]));
const rows=report.rows.map(row=>{const r=byId.get(row.worker.id);return r?.ok?{...r.value,recovery:{originalError:row.worker.error,mode:'local-finish-only'},worker:row.worker}:row;});
const result={source:name,providerCalls:0,note:'Local finish recovery after fixing the worker recursive-batch failure flag. Original model outputs and execution remain unchanged. Judge-invalid still fails.',summary:summarize(rows),rows};
fs.writeFileSync(path.join(dir,'finish-recovery.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary,null,2));
