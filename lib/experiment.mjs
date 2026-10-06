import {summarizeCoverage} from './semantic-units.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateTask,parseTaskSource,expandTaskIncludes,formatMarkdownTask} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {loadLayers} from '../../Ploinky-Worker/lib/config.mjs';
import {judgmentContext,judgmentCacheIndex} from './judgment-cache-index.mjs';
import {summarize} from './judge.mjs';
import {experimentMetrics} from './experiment-metrics.mjs';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const dialects=['clause-sop','event-sop'];
export const variants=dialects.map(d=>'formalise_'+d.replace(/-sop$/,'')+'-judge');
export const repairVariants=dialects.map(d=>'formalise_'+d.replace(/-sop$/,'')+'-symboliccheck-repair-judge');
export const symbolicVariants=dialects.map(d=>'symbolicformalise_'+d.replace(/-sop$/,'')+'-symboliccheck-repair-judge');
export const supportedVariants=[...variants,...repairVariants,...symbolicVariants];
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export const readTask=file=>parseTaskSource(fs.readFileSync(file,'utf8'),path.extname(file));
function save(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}
export function pworker(args,{allowFailure=false}={}){
  const r=spawnSync(process.execPath,[path.resolve(root,'../Ploinky-Worker/bin/pworker.mjs'),...args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  let data;try{data=JSON.parse(r.stdout);}catch{}
  if(r.error || (r.status!==0&&!allowFailure))throw new Error(r.error?.message || r.stderr?.trim() || `pworker exited ${r.status}`);
  if(data===undefined && r.status===0 && args[0]==='queue' && args[1]!=='list')return {message:r.stdout.trim()};
  if(data===undefined)throw new Error(r.stderr?.trim() || 'pworker did not return JSON');
  return data;
}
function location(name){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name??''))throw new Error('Run name must contain only letters, digits, hyphens or underscores');
  return path.join(root,'runs',name);
}
// The project uses literal relative imports, so the frozen dependency graph is
// reviewable without executing libraries or loading them in the host process.
export function snapshotModules(tasks,dir){
  const files={};
  for(const task of tasks)expandTaskIncludes(task,{currentWorkingDirectory:root,onFile:({path:relative,content})=>{
    const target=path.join(dir,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);files[relative]=hash(content);
  }});
  function visit(source,parent){
    const imports=source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g);
    for(const [,specifier] of imports){
      const absolute=fs.realpathSync(path.resolve(parent,specifier));
      const relative=path.relative(root,absolute);
      if(relative.startsWith('..')||path.isAbsolute(relative)||!/^lib\/.*\.m?js$/.test(relative))throw new Error('Library import is outside project lib: '+specifier);
      if(Object.hasOwn(files,relative))continue;
      const content=fs.readFileSync(absolute,'utf8');files[relative]=hash(content);
      const target=path.join(dir,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
      visit(content,path.dirname(absolute));
    }
  }
  for(const task of tasks)for(const phase of Object.values(task))visit(phase.code??'',root);
  return files;
}
export function prepare(name,options){
  const selected=options.variants??variants;
  if(!selected.length||new Set(selected).size!==selected.length||selected.some(x=>!supportedVariants.includes(x)))throw new Error('Invalid variants');
  const symbolicOnly=selected.every(v=>symbolicVariants.includes(v));
  const required=symbolicOnly?['repairProvider','repairModel','judgeProvider','judgeModel']:['provider','model','judgeProvider','judgeModel'];
  for(const key of required)if(!options[key])throw new Error(`Choose ${key} explicitly for every experiment`);
  if([options.provider,options.judgeProvider,options.repairProvider].includes('grok'))throw new Error('Grok is excluded from this project');
  const dataset=read(options.cases??path.join(root,'experiments/ten-whole-files.json'));
  if(!Array.isArray(dataset.cases)||!dataset.cases.length)throw new Error('No cases');
  const ids=new Set();
  for(const c of dataset.cases){
    if(!/^[A-Za-z0-9_-]+$/.test(c.id??'')||ids.has(c.id)||typeof c.text!=='string'||!c.text.trim())throw new Error('Invalid or duplicate case');
    if(c.sha256!==hash(c.text))throw new Error(`Source hash mismatch: ${c.id}`);
    ids.add(c.id);
  }
  if(Boolean(options.repairProvider)!==Boolean(options.repairModel))throw new Error('Choose both repairProvider and repairModel');
  const dir=location(name);
  if(fs.existsSync(dir))throw new Error('Run already exists; use a new name');
  fs.mkdirSync(path.join(dir,'tasks'),{recursive:true});
  const tasks={};
  for(const variant of selected){
    const source=options.taskOverrides?.[variant]?formatMarkdownTask(options.taskOverrides[variant]):fs.readFileSync(path.join(root,'taskTypes',variant+'.md'),'utf8');
    const task=parseTaskSource(source,'.md');
    validateTask(task);
    const file=path.join(dir,'tasks',variant+'.md');fs.writeFileSync(file,source);
    tasks[variant]={file,sha256:hash(task),sourceSha256:hash(source)};
  }
  const moduleFiles=snapshotModules(Object.values(tasks).map(spec=>readTask(spec.file)),dir);
  const executionConfig=fs.readFileSync(path.join(root,'pworker.config.json'),'utf8');
  fs.writeFileSync(path.join(dir,'execution-config.json'),executionConfig);
  const executionConfigHash=hash(executionConfig);
  const model={provider:options.provider,model:options.model};
  const judgeModel={provider:options.judgeProvider,model:options.judgeModel};
  const manifest={schemaVersion:4,name,status:'prepared',createdAt:new Date().toISOString(),models:{small:model,best:judgeModel},variants:selected,cases:dataset.cases,tasks,moduleFiles,executionConfigHash};
  if(selected.some(v=>[...repairVariants,...symbolicVariants].includes(v)))manifest.models.repair=options.repairProvider?{provider:options.repairProvider,model:options.repairModel}:{...model};
  const usedTiers=new Set(Object.values(tasks).flatMap(spec=>Object.values(readTask(spec.file)).map(p=>p.tier).filter(Boolean)));
  for(const tier of Object.keys(manifest.models))if(!usedTiers.has(tier))delete manifest.models[tier];
  const capabilityConfig=loadLayers({from:root}).config;
  manifest.modelCapabilities=Object.fromEntries(Object.entries(manifest.models).map(([tier,chosen])=>[tier,capabilityConfig.providers?.[chosen.provider]?.modelLimits?.[chosen.model]??null]));
  manifest.judgmentContexts=Object.fromEntries(Object.entries(tasks).map(([variant,spec])=>[variant,judgmentContext(judgeModel,expandTaskIncludes(readTask(spec.file),{currentWorkingDirectory:dir}).judge.template,moduleFiles['lib/judge.mjs'])]));
  const index=JSON.stringify(judgmentCacheIndex(root,manifest.judgmentContexts),null,2)+'\n';
  fs.writeFileSync(path.join(dir,'judgment-cache.json'),index);manifest.judgmentCacheHash=hash(index);
  save(path.join(dir,'manifest.json'),manifest);
  return manifest;
}
export function verifyTasks(m){
 const dir=location(m.name);
 for(const [file,expected] of Object.entries(m.savedOutputsFiles??{}))if(hash(fs.readFileSync(path.join(dir,file),'utf8'))!==expected)throw new Error('Frozen saved output changed: '+file);
 if(m.savedOutputsHash&&hash(fs.readFileSync(path.join(dir,'saved-outputs.json'),'utf8'))!==m.savedOutputsHash)throw new Error('Frozen saved outputs changed');
 if(m.judgmentCacheHash&&hash(fs.readFileSync(path.join(dir,'judgment-cache.json'),'utf8'))!==m.judgmentCacheHash)throw new Error('Frozen judgment cache changed');
 for(const spec of Object.values(m.tasks)){
   if(hash(readTask(spec.file))!==spec.sha256 || (spec.sourceSha256 && hash(fs.readFileSync(spec.file,'utf8'))!==spec.sourceSha256))throw new Error('Frozen task changed; prepare a new run');
 }
 for(const [file,expected] of Object.entries(m.moduleFiles))if(hash(fs.readFileSync(path.join(dir,file),'utf8'))!==expected)throw new Error('Frozen module changed; prepare a new run');
 if(hash(fs.readFileSync(path.join(root,'pworker.config.json'),'utf8'))!==m.executionConfigHash)throw new Error('Execution configuration changed; prepare a new run');
}
function checkModels(m){
  const config=loadLayers({from:root}).config;
  for(const [tier,choice] of Object.entries(m.models)){
    const entries=config.tiers?.[tier];
    if(!Array.isArray(entries)||entries.length!==1||entries[0].upstream!==choice.provider||entries[0].model!==choice.model)throw new Error(`${tier} changed since model selection; queue again before start`);
    if(!config.batching?.[tier]?.enabled)throw new Error(`Batching is disabled for ${tier}`);
  }
}
const taskEntries=(m,dir)=>m.variants.flatMap(variant=>m.cases.map(c=>({request:m.tasks[variant].file,input:{input:c.text,run:m.name,variant,caseId:c.id,...(m.judgmentContexts?{judgmentContext:m.judgmentContexts[variant]}:{})},currentWorkingDirectory:dir})));

// Use the native persistent pworker queue. Refuse to flush somebody else's tasks.
function storeQueue(entries,call){
  const current=call(['queue','list']);
  const expected=new Set(entries.map(hash));
  if(current.some(e=>!expected.has(hash(e)))||new Set(current.map(hash)).size!==current.length)throw new Error('Pworker queue contains other or duplicate tasks; inspect it before continuing');
  const present=new Set(current.map(hash));
  for(const e of entries)if(!present.has(hash(e)))call(['queue',e.request,'--input',JSON.stringify(e.input),'--cwd',e.currentWorkingDirectory]);
  const queued=call(['queue','list']);
  if(queued.length!==entries.length||queued.some(e=>!expected.has(hash(e))))throw new Error('Queue changed while storing tasks');
}
function verifyQueue(entries,call){
  const actual=call(['queue','list']);
  if(hash(actual.map(hash).sort())!==hash(entries.map(hash).sort()))throw new Error('Pworker queue does not match this run; nothing was flushed');
}
export function queue(name,{call=pworker,configure=true}={}){
  const dir=location(name),file=path.join(dir,'manifest.json'),m=read(file);
  if(!['prepared','queueing','queued'].includes(m.status))throw new Error(`Cannot queue run in state ${m.status}`);
  verifyTasks(m);
  if(configure){
    for(const [tier,c] of Object.entries(m.models))call(['tier',tier,'--provider',c.provider,'--model',c.model,'--batch']);
    checkModels(m);
  }
  m.queueEntries=taskEntries(m,dir);m.status='queueing';save(file,m);
  storeQueue(m.queueEntries,call);
  m.status='queued';save(file,m);return {name,status:m.status,tasks:m.queueEntries.length,models:m.models};
}
function rowsFromFlush(m,output){
 if(output.results.length!==m.queueEntries.length)throw new Error('Incomplete flush response; inspect raw-results.json');
 const expected=new Set(m.queueEntries.map(e=>`${e.input.variant}/${e.input.caseId}`)),seen=new Set();
 return output.results.map(r=>{
  const {caseId,variant}=r.state??{},key=`${variant}/${caseId}`;
  if(!expected.has(key)||seen.has(key))throw new Error('Missing or duplicate result identity');seen.add(key);
  const source=m.cases.find(c=>c.id===caseId).text;
  return r.ok?{...r.value,worker:r}:{caseId,variant,source,raw:r.state?.raw??null,conversion:r.state?.conversion??null,judgeRaw:r.state?.judgeRaw??null,assessment:{ok:false,success:false,verdict:'execution-failed',error:r.error},worker:r};
 });
}
function responseSummary(outputs){
  const unique=new Map();
  for(const output of outputs)for(const result of output?.results??[])for(const r of result.responses??[])unique.set(r.id,r);
  const responses=[...unique.values()];
  return {responses,modelResponses:responses.length,batchResponses:responses.filter(r=>r.batchSize>1).length,notes:'Shared batch usage counted once by response ID. Transport retries may add upstream attempts; use pworker stats for provider request totals.'};
}
export function start(name,{call=pworker,verifyModels=true}={}){
 const dir=location(name),file=path.join(dir,'manifest.json'),m=read(file);
 if(m.status!=='queued')throw new Error(`Cannot start run in state ${m.status}; inspect saved artifacts before any retry`);
 verifyTasks(m);if(verifyModels)checkModels(m);verifyQueue(m.queueEntries,call);
 m.status='running';m.startedAt=new Date().toISOString();m.telemetryPurpose='pworker:experiment:'+name;save(file,m);
 // One flush executes every phase, including both model tiers and local code.
 const output=call(['flush','--purpose',m.telemetryPurpose],{allowFailure:true});save(path.join(dir,'raw-results.json'),output);
 const rows=rowsFromFlush(m,output);
 const report={models:m.models,summary:summarize(rows),coverage:summarizeCoverage(rows),rows,requests:responseSummary([output]),localRouting:{reusedJudgments:rows.filter(r=>r.judgeReuse).length,blockedBeforeJudge:rows.filter(r=>r.assessment.verdict==='local-review'||r.conversion?.ok===false).length},note:'One flush executes the complete task pipeline. Semantic success is an LLM estimate, not a proof. Invalid and uncertain cases never count as success.'};
 save(path.join(dir,'report.json'),report);
 m.status=output.results.some(r=>!r.ok)?'completed-with-errors':'completed';m.finishedAt=new Date().toISOString();report.metrics=experimentMetrics(m,report);save(path.join(dir,'report.json'),report);save(file,m);
 return {name,status:m.status,report:path.join(dir,'report.json'),summary:report.summary};
}
export function status(name){return read(path.join(location(name),'manifest.json'));}
