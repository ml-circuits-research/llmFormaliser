// Keep a local progress snapshot and build reports when an already started run finishes.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {root,pworker} from '../lib/experiment.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name);
for(;;){
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 if(['completed','completed-with-errors'].includes(m.status)){
  for(const script of ['audit-judgments.mjs','build-report.mjs','build-coverage-report.mjs'])execFileSync(process.execPath,[path.join(root,'bin',script),name],{cwd:root,stdio:'inherit'});
  fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify({at:new Date().toISOString(),status:m.status,reportsReady:true,report:'coverage.html'},null,2)+'\n');
  break;
 }
 if(m.status==='cancelled')throw Error('Run cancelled; no complete score assigned');
 try{
  const s=pworker(['stats','--proxy']);
  const providers=[...new Set(Object.values(m.models).map(x=>x.provider))];
  const progress={at:new Date().toISOString(),status:m.status,elapsedSeconds:(Date.now()-Date.parse(m.startedAt))/1000,
   streams:(s.active_streams??[]).filter(x=>x.purpose===m.telemetryPurpose),
   capacity:Object.fromEntries(providers.map(p=>[p,{active:s.upstreams?.[p]?.active,queued:s.upstreams?.[p]?.depth,pausedUntil:s.upstreams?.[p]?.pausedUntil}]))};
  fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(progress,null,2)+'\n');
 }catch(error){console.error('Progress read failed: '+error.message);}
 await delay(15000);
}
