import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {root,prepare,queue,start,hash} from '../lib/experiment.mjs';

for(const mode of ['baseline','repair','symbolic']){
const repaired=mode!=='baseline',symbolic=mode==='symbolic';
test('actual CLI queues and flushes '+(symbolic?'accepted symbolic local preparation with only judgment calls':repaired?'three independent model roles with selective repair':'the baseline four-phase tasks'), {timeout:30000},async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'llmformaliser-cli-'));
 const record=path.join(tmp,'port'),count=path.join(tmp,'calls');
 const endpoint=spawn(process.execPath,[path.join(root,'test/fixtures-provider.mjs'),record,count],{stdio:'ignore'});
 const saved={...process.env};
 const name='cli-test-'+process.pid+'-'+mode,run=path.join(root,'runs',name);
 try{
  for(let i=0;i<100&&!fs.existsSync(record);i++)await delay(20);
  assert.ok(fs.existsSync(record),'fake provider started');
  const port=Number(fs.readFileSync(record,'utf8'));
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const proxyPort=socket.address().port;await new Promise(r=>socket.close(r));
  for(const key of Object.keys(process.env))if(/_API_KEY$|^PWORKER_TOKEN$|^PWORKER_URL$|^PWORKER_CONFIG$|_BASE_URL$/.test(key))delete process.env[key];
  delete process.env.NODE_TEST_CONTEXT;
  process.env.PWORKER_HOME=path.join(tmp,'home');process.env.PWORKER_PORT=String(proxyPort);
  fs.mkdirSync(process.env.PWORKER_HOME);
  fs.writeFileSync(path.join(process.env.PWORKER_HOME,'config.json'),JSON.stringify({providers:{fake:{baseUrl:`http://127.0.0.1:${port}`,noKey:true,modelsPath:'/v1/models',formats:{openai:'/v1/chat/completions'},limits:{maxPerMinute:1000}}}}));
  const cases=path.join(tmp,'cases.json');
  fs.writeFileSync(cases,JSON.stringify({cases:[1,2].map(n=>({id:'case-'+n,text:'John left.',sha256:hash('John left.')}))}));
  const variant=symbolic?'symbolicformalise_clause-symboliccheck-repair-judge':repaired?'formalise_clause-symboliccheck-repair-judge':'formalise_clause-judge';
  const prepared=prepare(name,{...(symbolic?{}:{provider:'fake',model:repaired?'broken':'formalizer'}),judgeProvider:'fake',judgeModel:'judge',...(repaired?{repairProvider:'fake',repairModel:'repairer'}:{}),variants:[variant],cases});
  if(symbolic)assert.equal(prepared.models.small,undefined);
  if(repaired)assert.deepEqual(prepared.models.repair,{provider:'fake',model:'repairer'});
  assert.ok(prepared.tasks[variant].file.endsWith('.md'));
  assert.ok(prepared.tasks[variant].sourceSha256);
  assert.ok(prepared.moduleFiles['lib/clause-sop.mjs']);
  assert.ok(prepared.moduleFiles['lib/sop-lng.mjs'],'static converter dependency is frozen');
  assert.ok(prepared.moduleFiles['lib/judge.mjs']);
  assert.ok(prepared.moduleFiles['lib/prompts/clause-sop.txt']);
  assert.ok(prepared.moduleFiles['lib/prompts/judge.txt']);
  const promptFile=path.join(run,'lib/prompts/clause-sop.txt');
  const promptSource=fs.readFileSync(promptFile,'utf8');
  fs.appendFileSync(promptFile,'\nChanged convention');
  assert.throws(()=>queue(name),/Frozen module changed/);
  fs.writeFileSync(promptFile,promptSource);
  const frozen=path.join(run,'lib/sop-lng.mjs');
  const original=fs.readFileSync(frozen,'utf8');
  fs.appendFileSync(frozen,'\n// changed dependency');
  assert.throws(()=>queue(name),/Frozen module changed/);
  fs.writeFileSync(frozen,original);
  queue(name);
  assert.equal(fs.existsSync(count),false,'catalog reads and enqueue must not generate text');
  const result=start(name);
  assert.equal(result.status,'completed');assert.equal(result.summary[variant].success,2);
  assert.equal(Number(fs.readFileSync(count,'utf8')),symbolic?1:repaired?3:2,'only required model batches');
  const output=JSON.parse(fs.readFileSync(path.join(run,'raw-results.json'),'utf8'));
  assert.ok(output.results.every(r=>r.steps===(symbolic?6:repaired?8:4)));
  assert.ok(output.results.every(r=>r.responses.length===(symbolic?1:repaired?3:2)));
  assert.ok(output.results.every(r=>r.responses[0].id===output.results[0].responses[0].id));
  const report=JSON.parse(fs.readFileSync(path.join(run,'report.json'),'utf8'));
  assert.equal(report.requests.modelResponses,symbolic?1:repaired?3:2);
  assert.deepEqual(new Set(report.requests.responses.map(r=>r.reportedModel)),new Set(symbolic?['judge']:repaired?['broken','repairer','judge']:['formalizer','judge']));
 }finally{
  spawnSync(process.execPath,[path.resolve(root,'../Ploinky-Worker/bin/pworker.mjs'),'stop'],{encoding:'utf8'});
  endpoint.kill('SIGTERM');
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);
  fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(run,{recursive:true,force:true});
 }
});

}
