import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Pworker,validateTask} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {root,snapshotModules,readTask} from '../lib/experiment.mjs';
const read=p=>p.endsWith('.md')?readTask(path.join(root,p)):JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const good={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Same assertion.'};
const outputs={'clause-sop':'@E1 EV st=asserted subj=John p=leave t=past','event-sop':'@s1 S\n@x1 E h=person ty=person n=John\n@e1 EV p=leave ag=$x1 t=past'};

test('two baseline SOP task types contain four phases, no duplicated request settings',()=>{
 assert.deepEqual(fs.readdirSync(path.join(root,'taskTypes')).sort(),['formalise_clause-judge.md','formalise_clause-symboliccheck-repair-judge.md','formalise_event-judge.md','formalise_event-symboliccheck-repair-judge.md','symbolicformalise_clause-symboliccheck-repair-judge.md','symbolicformalise_event-symboliccheck-repair-judge.md']);
 for(const variant of Object.keys(outputs)){
  const task=read(`taskTypes/formalise_${variant.replace(/-sop$/,'')}-judge.md`);validateTask(task);
  assert.deepEqual(Object.keys(task),['begin','toCnl','judge','finish']);
  assert.ok(Object.values(task).every(p=>!Object.hasOwn(p,'request')));
  assert.equal(task.begin.tier,'small');assert.equal(task.judge.tier,'best');
  assert.equal(task.toCnl.tier,null);assert.match(task.toCnl.code,/await import/);assert.match(task.finish.code,/await import/);assert.ok(Object.values(task).every(p=>!Object.hasOwn(p,'codeFile')));
 }
});

test('two real four-phase task types run with an injected fake model, local libraries and a single flush',async()=>{
 const dir=path.join(root,'runs','pipeline-test-'+process.pid);fs.mkdirSync(path.join(dir,'lib'),{recursive:true});snapshotModules(Object.keys(outputs).map(v=>read(`taskTypes/formalise_${v.replace(/-sop$/,'')}-judge.md`)),dir);
 const calls=[];
 const fake={json:async o=>{
  calls.push(o);assert.equal(o.cache,'use');assert.equal(o.maxTokens,read('pworker.config.json').taskExecution.request.maxTokens);
  const inputs=JSON.parse(o.prompt.slice(o.prompt.lastIndexOf('\n')+1));
  const raw=o.prompt.includes('CNL-E prototype')?outputs['clause-sop']:outputs['event-sop'];
  if(o.tier==='best')for(const item of inputs){const name=item.input.source.split(' ')[0];assert.ok(item.input.cnl.includes(name), 'Each judge input must contain its own converted participant');}
  return {ok:true,json:{results:Object.fromEntries(inputs.map(i=>[i.id,o.tier==='best'?good:raw.replaceAll('John',i.input.split(' ')[0])]))}};
 }};
 try{
  const worker=new Pworker({client:fake,config:read('pworker.config.json')});
  for(const variant of Object.keys(outputs))for(let i=0;i<10;i++)worker.enqueue(read(`taskTypes/formalise_${variant.replace(/-sop$/,'')}-judge.md`),{input:'John'+i+' left.',variant,caseId:'c'+i},{currentWorkingDirectory:dir});
  assert.equal(calls.length,0);
  const results=await worker.flush();
  assert.equal(results.length,20);assert.ok(results.every(r=>r.ok),JSON.stringify(results.map(r=>r.error)));
  assert.ok(results.every(r=>r.steps===4&&r.value.assessment.success));
  assert.equal(calls.filter(c=>c.tier==='small').length,2);
  assert.ok(calls.filter(c=>c.tier==='best').every(c=>c.batchSize>1));
  assert.equal(calls.filter(c=>c.tier==='best').reduce((s,c)=>s+c.batchSize,0),20);
  for(const r of results){
   assert.equal(r.value.source,'John'+r.state.caseId.slice(1)+' left.');
   assert.ok(r.value.conversion.cnl.includes(r.value.source.split(' ')[0]));
   const persisted=JSON.parse(fs.readFileSync(path.join(dir,'artifacts',r.state.variant,r.state.caseId+'-result.json'),'utf8'));
   assert.equal(persisted.source,r.value.source);assert.equal(persisted.raw,r.value.raw);
  }
  assert.equal(fs.readdirSync(path.join(dir,'artifacts/clause-sop')).length,20);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
