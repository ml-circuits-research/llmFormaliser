import {semanticUnits} from '../lib/semantic-units.mjs';
import {withUnits} from './fake-judgment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {symbolicDiscourse,sourceSegments} from '../lib/symbolic-discourse.mjs';
import {symbolicDraft,draftRetention} from '../lib/symbolic-export.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';
import {Pworker} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {root,readTask,snapshotModules} from '../lib/experiment.mjs';

test('new symbolic parser preserves attitude embedding, negation, aspect and questions',()=>{
 const d=symbolicDiscourse('Nora said that the engine failed. Did Otto open the gate? The robot is not working now.');
 assert.equal(d.clauses.length,3);assert.equal(d.clauses[0].content.status,'unasserted');
 assert.equal(d.clauses[0].tense,'past');assert.equal(d.clauses[1].status,'queried');
 assert.equal(d.clauses[2].neg,true);assert.deepEqual(d.clauses[2].flags,['PROG']);
 for(const dialect of ['clause-sop','event-sop']){
  const raw=symbolicDraft(d.source,dialect).raw;
  assert.equal((dialect==='clause-sop'?convertClauseSop:convertEventSop)(raw).ok,true,raw);
 }
});
test('unrecognized material and partial complements retain exact source spans, without opaque participants',()=>{
 const source='Unless the beacon changes, wait. Give Nora a parcel from the depot.';
 const d=symbolicDiscourse(source);assert.equal(d.clauses.length,1);assert.equal(d.clauses[0].status,'directive');
 assert.equal(d.clauses[0].object,null);assert.equal(d.unresolved.length,2);
 for(const u of d.unresolved)assert.equal(source.slice(...u.span),u.text);
 assert.match(symbolicDraft(source,'event-sop').raw,/ UM /);
 assert.equal(sourceSegments('A gauge shows 3.5. Dr. Stone left.').length,2);
});
test('Event export distinguishes recipient from agent and CNL keeps grammatical subject',()=>{
 const source='Nora received a parcel.';
 const event=symbolicDraft(source,'event-sop').raw,cnl=symbolicDraft(source,'clause-sop').raw;
 assert.match(event,/verb=receive recipient=\$/);assert.doesNotMatch(event,/ agent=/);
 assert.match(cnl,/subject=Nora verb=receive/);
});
test('declaration retention does not ignore polarity or tense changes',()=>{
 const a='@e EV subj=Nora p=leave t=past';
 assert.equal(draftRetention(a,a).draftRetention,1);
 assert.equal(draftRetention(a,a.replace('past','future')).draftRetention,0);
 assert.equal(draftRetention(a,a+' neg=true').draftRetention,0);
});
test('complete accepted symbolic drafts skip repair and batch only judgment with isolated local artifacts',async()=>{
 const variants=['symbolicformalise_clause-symboliccheck-repair-judge','symbolicformalise_event-symboliccheck-repair-judge'],dir=path.join(root,'runs','symbolic-test-'+process.pid);
 fs.mkdirSync(dir,{recursive:true});const tasks=variants.map(v=>readTask(path.join(root,'taskTypes',v+'.md')));snapshotModules(tasks,dir);
 const calls=[];const good={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'The assertion is preserved.'};
 const client={json:async o=>{calls.push(o);assert.notEqual(o.tier,'small');const inputs=JSON.parse(o.prompt.split('\n').at(-1));return {ok:true,json:{results:Object.fromEntries(inputs.map(item=>{
  if(o.tier==='best')return [item.id,withUnits(good,item.input)];
  assert.match(item.input,/SYMBOLIC DRAFT NOTICE/);assert.match(item.input,/CURRENT SOP/);
  const name=/SOURCE \(data\):\n(\w+) left/.exec(item.input)[1];
  return [item.id,o.prompt.includes('Clause-SOP: grammatical')?'@e EV subj='+name+' p=leave t=past':'@s S\n@x E n='+name+' h=person\n@e EV p=leave ag=$x t=past'];
 }))}};}};
 try{
  const worker=new Pworker({client,config:{taskExecution:{batchScheduling:'wave'},batching:{repair:{enabled:true},best:{enabled:true}}}});
  for(const [i,task] of tasks.entries())for(const [j,name] of ['Nora','Otto'].entries())worker.enqueue(task,{input:name+' left.',variant:variants[i],caseId:'c'+j},{currentWorkingDirectory:dir});
  assert.equal(calls.length,0);const rows=await worker.flush();
  assert.ok(rows.every(r=>r.ok&&r.value.assessment.success),JSON.stringify(rows.map(r=>r.error)));
  assert.equal(calls.filter(c=>c.tier==='repair').length,0);
  assert.equal(calls.filter(c=>c.tier==='best').reduce((n,c)=>n+c.batchSize,0),4);
  for(const r of rows){assert.equal(r.steps,6);assert.equal(r.value.approach,'symbolic-first');assert.equal(r.value.attempts[0].assessment.verdict,'equivalent');assert.equal(r.value.repairCount,0);assert.equal(r.value.symbolicDraft.graph.source,r.value.source);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('symbolic mixed batch repairs incomplete drafts only and never already accepted complete drafts',async()=>{
 const task=readTask(path.join(root,'taskTypes/symbolicformalise_clause-symboliccheck-repair-judge.md'));
 const dir=path.join(root,'runs','symbolic-mixed-'+process.pid);fs.mkdirSync(dir,{recursive:true});snapshotModules([task],dir);
 const good={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Preserved.'};
 const repaired=[],judged=[];
 const client={json:async o=>({ok:true,json:{results:Object.fromEntries(JSON.parse(o.prompt.split('\n').at(-1)).map(item=>{
  if(o.tier==='best'){judged.push(item.input.source);return [item.id,withUnits(good,item.input)];}
  assert.equal(o.tier,'repair');assert.match(item.input,/Construction is outside/);
  const source=/SOURCE \(data\):\n([^\n]+)/.exec(item.input)[1];repaired.push(source);
  return [item.id,'@e EV subj=wording p=remain'];
 }))}})};
 const sources=['Nora left.','Otto left.','Some unsupported wording.','Another strange fragment.'];
 try{
  const worker=new Pworker({client,config:{taskExecution:{batchScheduling:'wave'},batching:{repair:{enabled:true},best:{enabled:true}}}});
  sources.forEach((input,i)=>worker.enqueue(task,{input,caseId:'c'+i,variant:'symbolic-mixed'},{currentWorkingDirectory:dir}));
  const rows=await worker.flush();assert.ok(rows.every(r=>r.ok&&r.value.assessment.success),JSON.stringify(rows.map(r=>r.error)));
  assert.deepEqual(repaired.sort(),sources.slice(2).sort());assert.deepEqual(judged.sort(),[...sources].sort());
  rows.forEach((r,i)=>assert.equal(r.value.repairCount,i<2?0:1));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('an exact accepted cached symbolic pair bypasses repair even with draft uncertainty notes',async()=>{
 const task=readTask(path.join(root,'taskTypes/symbolicformalise_clause-symboliccheck-repair-judge.md'));
 const dir=path.join(root,'runs','symbolic-reuse-'+process.pid);fs.mkdirSync(dir,{recursive:true});snapshotModules([task],dir);
 const source='He left.',draft=symbolicDraft(source,'clause-sop'),conversion=convertClauseSop(draft.raw);
 assert.ok(draft.graph.diagnostics.length);assert.equal(conversion.ok,true);
 const judgment={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Unresolved pronoun is preserved.'};
 fs.writeFileSync(path.join(dir,'judgment-cache.json'),JSON.stringify([{context:'test',pair:{source,units:semanticUnits(source),cnl:conversion.cnl,notation:conversion.notation},judgment:withUnits(judgment,{source}),provenance:{run:'verified-fixture'}}]));
 try{
  const forbidden=()=>{throw Error('Already accepted pair must not call any model');};
  const worker=new Pworker({client:{json:forbidden,chat:forbidden}});
  worker.enqueue(task,{input:source,caseId:'accepted',variant:'symbolic-reuse',judgmentContext:'test'},{currentWorkingDirectory:dir});
  const [row]=await worker.flush();assert.equal(row.ok,true,row.error);assert.equal(row.value.assessment.success,true);assert.equal(row.value.repairCount,0);assert.equal(row.responses.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a recognized verb without a reliable role map becomes an explicit unresolved span instead of aborting a whole file',()=>{
 const source='Expense E3 has a receipt.';
 const draft=symbolicDraft(source,'event-sop');
 assert.ok(draft.graph.diagnostics.some(d=>d.code==='unmapped-role'));
 assert.match(draft.raw,/@u\d+ UM/);assert.ok(draft.raw.includes(source));
 assert.equal(convertEventSop(draft.raw).ok,true);
});
