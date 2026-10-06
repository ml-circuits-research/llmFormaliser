// Replay old UUID-based batch envelopes through the real strict cache endpoint,
// then execute the current four-phase tasks with cached formalizations and a live
// judge only where the new CNL/batch content needs a new judgment.
import fs from 'node:fs';
import path from 'node:path';
import {createProxy} from '../../Ploinky-Worker/lib/core.mjs';
import {createPworkerClient} from '../../Ploinky-Worker/lib/client.mjs';
import {Pworker,batchPrompt,batchTemplate,batchRequests,renderTemplate} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {loadLayers} from '../../Ploinky-Worker/lib/config.mjs';
import {root,prepare,readTask,verifyTasks,supportedVariants} from '../lib/experiment.mjs';
import {summarize} from '../lib/judge.mjs';
import {replayJudgmentBatch} from '../lib/judgment-replay.mjs';
import {experimentMetrics} from '../lib/experiment-metrics.mjs';
const [sourceName,name,reuseName]=process.argv.slice(2);
if(reuseName&&!/^experiment-\d+$/.test(reuseName))throw new Error('Invalid judgment reuse run');
if(!/^experiment-\d+$/.test(sourceName??'')||!/^experiment-\d+$/.test(name??''))throw new Error('Usage: replay-cached.mjs SOURCE NEW_RUN');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const oldDir=path.join(root,'runs',sourceName),old=read(path.join(oldDir,'manifest.json')),prior=read(path.join(oldDir,'raw-results.json'));
if(old.variants.some(v=>!supportedVariants.includes(v)))throw new Error('This archived run predates the current task names and canonical prompts. Its frozen sources remain available; current prompts require a new experiment, not a cache replay under changed instructions.');
const existing=path.join(root,'runs',name,'manifest.json');
const m=fs.existsSync(existing)?read(existing):prepare(name,{provider:old.models.small.provider,model:old.models.small.model,judgeProvider:old.models.best.provider,judgeModel:old.models.best.model,variants:old.variants});
if(m.status!=='prepared'||JSON.stringify(m.models)!==JSON.stringify(old.models))throw new Error('Replay requires an untouched prepared run with the source models');
verifyTasks(m);
const dir=path.join(root,'runs',name),save=(file,value)=>fs.writeFileSync(path.join(dir,file),JSON.stringify(value,null,2)+'\n');
m.telemetryPurpose='pworker:replay:'+name;m.replayOf=sourceName;m.status='running';m.startedAt=new Date().toISOString();save('manifest.json',m);
const config=structuredClone(loadLayers({from:root}).config);
for(const [tier,c] of Object.entries(old.models))config.tiers[tier]=[{upstream:c.provider,model:c.model}];
let blockedNetworkCalls=0;
const proxy=createProxy({config,dataDir:path.join(dir,'cache-audit'),cacheDir:config.cacheDir,fetchImpl:async()=>{blockedNetworkCalls++;throw new Error('Replay cache audit cannot contact a provider');}});
await new Promise(r=>proxy.server.listen(0,'127.0.0.1',r));
const strict=createPworkerClient({url:`http://127.0.0.1:${proxy.server.address().port}`,purpose:'pworker:cache-replay',cache:'strict',autostart:false});
const cached=new Map(),audit=[],reusable=new Map(),reusableSingles=new Map(),judgmentReuse=[];
try{
 for(const variant of old.variants){
  const historicalFile=old.tasks[variant].file;
  // Read archived JSON as data only: obsolete local phases are never executed.
  const task=historicalFile.endsWith('.json')?read(historicalFile):readTask(historicalFile),pattern=batchTemplate(task.begin.template);
  if(readTask(m.tasks[variant].file).begin.template!==task.begin.template)throw new Error('Cached formalizer prompt differs from the frozen replay task; use a matching snapshot');
  const members=prior.results.filter(r=>r.state.variant===variant);
  const candidates=[
   members.map(item=>({item,request:{id:item.id,input:item.state[pattern.variable]}})),
   batchRequests(pattern.prefix,members,pattern.variable)
  ];
  let response,bindings;
  for(const candidate of candidates){
   response=await strict.json({tier:task.begin.tier,prompt:batchPrompt(pattern.prefix,candidate.map(x=>x.request)),cache:'strict',noFallback:true,retries:0});
   if(response.ok&&response.cached){bindings=candidate;break;}
  }
  if(!bindings)throw new Error('Original formalization is not a cache hit: '+response.reason);
  const bySource=new Map();
  for(const {item,request} of bindings){
   if(!Object.hasOwn(response.json.results,request.id))throw new Error('Cached response is missing an input');
   if(bySource.has(item.state.input))throw new Error('Ambiguous duplicate replay input');
   bySource.set(item.state.input,response.json.results[request.id]);
  }
  cached.set(variant,{response,bySource});
  audit.push({variant,cached:response.cached,cacheKey:response.cacheKey,ms:response.ms,served:response.served,items:members.length});
 }
 if(reuseName){
  const reuseDir=path.join(root,'runs',reuseName),reuseManifest=read(path.join(reuseDir,'manifest.json'));
  if(JSON.stringify(reuseManifest.models.best)!==JSON.stringify(m.models.best))throw new Error('Judge model differs from reuse run');
  const reuseResults=read(path.join(reuseDir,'raw-results.json')).results;
  const groups=new Map();
  for(const item of reuseResults){
   if(!item.ok||!item.state.pair||!item.state.judgeRaw)continue;
   for(const response of item.responses.filter(r=>r.tier==='best')){
    const members=groups.get(response.id)??[];members.push(item);groups.set(response.id,members);
   }
  }
  for(const members of groups.values()){
   const first=members[0],variant=first.state.variant;
   const previousTask=readTask(reuseManifest.tasks[variant].file),currentTask=readTask(m.tasks[variant].file);
   if(previousTask.judge.template!==currentTask.judge.template)continue;
   const pattern=batchTemplate(previousTask.judge.template);
   const bindings=batchRequests(pattern.prefix,members,pattern.variable);
   let response;
   for(const route of [{upstream:m.models.best.provider,model:m.models.best.model},{tier:'best'}]){
    response=members.length===1
     ?await strict.chat({...route,prompt:renderTemplate(previousTask.judge.template,first.state),cache:'strict',noFallback:true,retries:0})
     :await strict.json({...route,prompt:batchPrompt(pattern.prefix,bindings.map(x=>x.request)),cache:'strict',noFallback:true,retries:0});
    if(response.ok&&response.cached)break;
   }
   if(!response.ok||!response.cached)continue;
   if(members.length>1&&(!response.json?.results||Object.keys(response.json.results).some(id=>!bindings.some(x=>x.request.id===id))))continue;
   let count=0;
   for(const {item,request} of bindings){
    const value=members.length===1?response.text:response.json?.results?.[request.id];
    if(value===undefined)continue;
    reusable.set(request.id,value);
    reusableSingles.set(renderTemplate(previousTask.judge.template,item.state),value);count++;
   }
   judgmentReuse.push({run:reuseName,cacheKey:response.cacheKey,verifiedItems:count,ms:response.ms});
  }
 }
 if(blockedNetworkCalls)throw new Error('Cache audit attempted provider access');
 save('cache-verification.json',{audit,judgmentReuse,providerCalls:blockedNetworkCalls});
 console.log(JSON.stringify({cacheVerification:audit,providerCalls:blockedNetworkCalls},null,2));
}finally{proxy.server.close();proxy.server.closeAllConnections?.();}
const live=createPworkerClient({purpose:m.telemetryPurpose});
let reusedJudgments=0,freshJudgeItems=0;
const tasks=Object.fromEntries(m.variants.map(v=>[v,readTask(m.tasks[v].file)]));
const client={
 json:async o=>{
  if(o.tier==='small'){
   const variant=m.variants.find(v=>o.prompt.startsWith(batchTemplate(tasks[v].begin.template).prefix.trimEnd().split('\n\nINPUT DATA')[0]));
   if(!variant)throw new Error('Cannot associate cached batch with its task type');
   const entry=cached.get(variant),requests=JSON.parse(o.prompt.slice(o.prompt.lastIndexOf('\n')+1));
   const results=Object.fromEntries(requests.map(r=>{if(!entry.bySource.has(r.input))throw new Error('Replay input differs');return [r.id,entry.bySource.get(r.input)];}));
   return {...entry.response,json:{results},cached:true};
  }
  const {tier,...options}=o;
  const replay=await replayJudgmentBatch(options,{reusable,live,model:m.models.best});
  reusedJudgments+=replay.reused;freshJudgeItems+=replay.fresh;
  return replay.response;
 },
 chat:async o=>{const {tier,...options}=o;if(tier!=='best')throw new Error('Formalization replay requires the original full batch');if(reusableSingles.has(options.prompt)){reusedJudgments++;const value=reusableSingles.get(options.prompt);return {ok:true,status:200,cached:true,ms:0,usage:{},text:typeof value==='string'?value:JSON.stringify(value)};}freshJudgeItems++;return live.chat({...options,upstream:m.models.best.provider,model:m.models.best.model});}
};
const worker=new Pworker({client,config:read(path.join(root,'pworker.config.json'))});
for(const variant of m.variants)for(const c of m.cases)worker.enqueue(tasks[variant],{input:c.text,variant,caseId:c.id,run:name},{currentWorkingDirectory:dir});
const results=await worker.flush();save('raw-results.json',{results});
const rows=results.map(r=>r.ok?{...r.value,worker:r}:{caseId:r.state.caseId,variant:r.state.variant,source:r.state.input,raw:r.state.raw,conversion:r.state.conversion,assessment:{ok:false,success:false,verdict:'execution-failed',error:r.error},worker:r});
const responses=[...new Map(results.flatMap(r=>r.responses).map(r=>[r.id,r])).values()];
const report={judgmentReuse:{source:reuseName??null,verifiedBatches:judgmentReuse,reusedItems:reusedJudgments,freshItems:freshJudgeItems},models:m.models,summary:summarize(rows),rows,requests:{responses,modelResponses:responses.length,batchResponses:responses.filter(r=>r.batchSize>1).length},note:'Replay of actual strict-cache formalization responses with updated local converters. Judge requests use the original selected model; changed CNL or batch envelopes may need fresh inference.'};
save('report.json',report);m.status=results.some(r=>!r.ok)?'completed-with-errors':'completed';m.finishedAt=new Date().toISOString();report.metrics=experimentMetrics(m,report);save('report.json',report);save('manifest.json',m);console.log(JSON.stringify({name,status:m.status,summary:report.summary},null,2));
