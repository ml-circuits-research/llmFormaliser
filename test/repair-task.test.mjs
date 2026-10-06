import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Pworker} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {repairTask} from '../lib/repair-task.mjs';
import {readTask,snapshotModules,root} from '../lib/experiment.mjs';
const good={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Preserved.'};
async function execute(fake,sources){
 const task=repairTask(readTask(path.join(root,'taskTypes/formalise_clause-judge.md'))),dir=path.join(root,'runs','repair-test-'+Math.random().toString(16).slice(2));
 fs.mkdirSync(dir,{recursive:true});snapshotModules([task],dir);
 try{const w=new Pworker({client:fake,config:{taskExecution:{batchScheduling:'wave'},batching:{small:{enabled:true},best:{enabled:true},repair:{enabled:true}}}});sources.forEach((input,i)=>w.enqueue(task,{input,variant:'formalise_clause-symboliccheck-repair-judge',caseId:'c'+i},{currentWorkingDirectory:dir}));return await w.flush();}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const reply=(o,fn)=>({ok:true,json:{results:Object.fromEntries(JSON.parse(o.prompt.split('\n').at(-1)).map(r=>[r.id,fn(r.input)]))}});
test('local numeric problems are repaired in one batch before any judge call, with isolated feedback',async()=>{
 const calls=[];const rs=await execute({json:async o=>{calls.push(o);return reply(o,input=>{
  if(o.tier==='best')return good;
  if(!o.prompt.includes('REPAIR PASS'))return '@e EV subj=crate p=weigh obj=99';
  assert.match(input,/Candidate numeric literal 99/);const n=/SOURCE \(data\):\nThe crate weighs (\d+)/.exec(input)[1];return '@e EV subj=crate p=weigh obj='+n;
 });}},['The crate weighs 12.','The crate weighs 14.']);
 assert.ok(rs.every(r=>r.ok&&r.value.assessment.success),JSON.stringify(rs.map(r=>r.error)));
 assert.deepEqual(calls.map(c=>c.tier),['small','repair','best']);
 for(const r of rs){assert.equal(r.value.repairCount,1);assert.equal(r.value.attempts.length,2);assert.equal(r.value.attempts[0].assessment.verdict,'local-review');}
});
test('an unchanged repair reuses its negative judgment and stops after one repair',async()=>{
 const calls=[];const bad={...good,source_entails_cnl:'no',cnl_entails_source:'no',verdict:'different',mismatches:['Wrong tense'],explanation:'Future instead of past.'};
 const rs=await execute({json:async o=>{calls.push(o);return reply(o,()=>o.tier==='best'?bad:'@e EV subj=Lina p=leave t=future');}},['Lina left.','Lina left.']);
 assert.ok(rs.every(r=>r.ok&&!r.value.assessment.success));
 assert.deepEqual(calls.map(c=>c.tier),['small','best','repair']);
 for(const r of rs){assert.equal(r.value.repairCount,1);assert.equal(r.value.judgeReuse.sameTaskAttempt,0);}
});
test('a successful initial result skips repair',async()=>{
 const calls=[];const rs=await execute({json:async o=>{calls.push(o);return reply(o,()=>o.tier==='best'?good:'@e EV subj=Lina p=leave t=past');}},['Lina left.','Lina left.']);
 assert.ok(rs.every(r=>r.ok&&r.value.repairCount===0));assert.deepEqual(calls.map(c=>c.tier),['small','best']);
});

test('one repair receives all independent structural diagnostics for its own candidate',async()=>{
 const calls=[];
 const rs=await execute({json:async o=>{calls.push(o);return reply(o,input=>{
  if(o.tier==='best')return good;
  if(o.tier==='small')return '@e EV subj=Lina p=leave t=tomorrow neg=no';
  assert.match(input,/field t: Unknown tense/);assert.match(input,/field neg: neg must be boolean/);
  assert.match(input,/line 1, @e/);
  return '@e EV subj=Lina p=leave t=past';
 });}},['Lina left.','Lina left.']);
 assert.ok(rs.every(r=>r.ok&&r.value.assessment.success));
 assert.deepEqual(calls.map(c=>c.tier),['small','repair','best']);
 assert.ok(rs.every(r=>r.value.attempts[0].localChecks.blocking.length===2));
});

test('mixed real tasks repair only structural or semantic failures, never accepted or inconclusive cases',async()=>{
 const repaired=[],judged=[];
 const bad={...good,verdict:'different',source_entails_cnl:'no',mismatches:['Wrong tense']};
 const uncertain={...good,verdict:'uncertain',source_entails_cnl:'unknown',cnl_entails_source:'unknown',mismatches:[],explanation:'Cannot decide.'};
 const sources=['Ada left.','Ben left.','Cora left.','Dan left.','Eve left.','Finn left.','Gina left.','Hugo left.'];
 const results=await execute({json:async o=>reply(o,input=>{
  if(o.tier==='best'){
   const name=input.source.split(' ')[0];judged.push(name);
   return ['Gina','Hugo'].includes(name)?uncertain:input.cnl.includes('tense=future')?bad:good;
  }
  const name=(o.tier==='repair'?/SOURCE \(data\):\n(\w+)/.exec(input)[1]:input.split(' ')[0]);
  if(o.tier==='repair'){repaired.push(name);return '@e EV subj='+name+' p=leave t=past';}
  return '@e EV subj='+name+' p=leave t='+(['Cora','Dan'].includes(name)?'tomorrow':['Eve','Finn'].includes(name)?'future':'past');
 })},sources);
 assert.ok(results.every(r=>r.ok),JSON.stringify(results.map(r=>r.error)));
 assert.deepEqual(repaired.sort(),['Cora','Dan','Eve','Finn']);
 for(const r of results){
  const name=r.value.source.split(' ')[0];assert.equal(r.value.repairCount,['Cora','Dan','Eve','Finn'].includes(name)?1:0);
  assert.equal(judged.filter(n=>n===name).length,['Eve','Finn'].includes(name)?2:1);
 }
});
