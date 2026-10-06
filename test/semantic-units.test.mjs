import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticUnits,assessUnits,summarizeCoverage} from '../lib/semantic-units.mjs';
import {assessJudge} from '../lib/judge.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';

test('sentence anchors preserve every non-whitespace source character, stable IDs and document context',()=>{
 const source='Cost is 3.5 euros. Who paid?\n\nA second paragraph.\nAnother line. Cost is 3.5 euros.';
 const units=semanticUnits(source);
 assert.ok(units.length>=4);
 assert.deepEqual(units,semanticUnits(source));
 assert.equal(new Set(units.map(u=>u.id)).size,units.length);
 assert.equal(units.map(u=>u.text).join('').replace(/\s/g,''),source.replace(/\s/g,''));
 for(const u of units)assert.equal(source.slice(u.start,u.end),u.text);
});
test('partial score counts exact source anchors, missing units and contradictory overall verdicts fail',()=>{
 const units=semanticUnits('Mira left. Ren stayed. Who called?');
 const j={source_entails_cnl:'yes',cnl_entails_source:'no',speech_act_preserved:true,ambiguity_preserved:true,verdict:'different',mismatches:['Missing question'],explanation:'One question omitted.',additions:[],units:units.map((u,i)=>({id:u.id,verdict:i===2?'different':'preserved',reason:'Checked.'}))};
 assert.equal(assessJudge(j,units).ok,true);
 assert.equal(assessUnits(j,units).preservedPercent,200/3);
 assert.throws(()=>assessUnits({...j,units:j.units.slice(1)},units),/Missing/);
 assert.throws(()=>assessUnits({...j,units:[...j.units,j.units[0]]},units),/duplicate/);
 assert.throws(()=>assessUnits({...j,verdict:'equivalent'},units),/conflicts/);
 const g=summarizeCoverage([{variant:'v',source:'Mira left.',assessment:{coverage:assessUnits(j,units)}},{variant:'v',source:'Unknown.',assessment:{}}]).v;
 assert.equal(g.total,4);assert.equal(g.evaluated,3);assert.equal(g.unassessable,1);assert.equal(g.lowerBoundPercent,50);assert.equal(g.upperBoundPercent,75);
});
test('meaningful fields distinguish comparison from tense and normalize harmless repetitions',()=>{
 const raw='@s S\n@a E head=box\n@b E head=box\n@c CP comparison=less dimension=weight theme=$a standard=$b tense=past tense=past';
 const c=convertEventSop(raw);assert.equal(c.ok,true,c.error);
 assert.match(c.cnl,/comparison relation \(comparison\) = "less"/);assert.match(c.cnl,/tense \(tense\) = "past"/);
 assert.equal(c.normalizations[0].action,'deduplicate-identical-field');
 const repeated=convertEventSop('@s S\n@a E head=box\n@b E head=bag\n@e EV verb=move theme=$a theme=$b');
 assert.equal(repeated.ok,true,repeated.error);assert.deepEqual(repeated.ir.records.at(-1).fields.th,[{$ref:'a'},{$ref:'b'}]);
 assert.equal(convertEventSop(raw+' tense=future').ok,false);
});
test('conditional scope, wh questions and suggestion force survive deterministic CNL',()=>{
 const raw='@s S\n@a EV verb=flash theme=lamp\n@b EV verb=close agent=you theme=hatch\n@l L kind=if from=$a to=$b';
 const c=convertEventSop(raw);assert.equal(c.ok,true,c.error);
 assert.equal((c.cnl.match(/not independently asserted: part of a conditional relation/g)??[]).length,2);
 const explicit=convertEventSop(raw.replace('theme=lamp','theme=lamp status=asserted'));
 assert.match(explicit.cnl,/semantic status \(status\) = "asserted"/);
 const q=convertClauseSop('@e EV subject=Mira verb=open object=?which status=queried question=wh answer=parcel tense=past');
 assert.equal(q.ok,true,q.error);assert.match(q.cnl,/question WH \(answer parcel\)/);assert.doesNotMatch(q.cnl,/whether/);
 const s=convertClauseSop('@e EV subject=we verb=inspect object=diagram status=directive act=suggest');assert.equal(s.ok,true,s.error);assert.match(s.cnl,/Speech act suggest/);
});
test('literal punctuation and dates survive while dangling references and inline objects remain errors',()=>{
 const c=convertClauseSop('@e EV subject=cost verb=be object=>500_euro\n@m MOD target=$e label=time value=2026-04-07');
 assert.equal(c.ok,true,c.error);assert.match(c.cnl,/2026-04-07/);
 assert.equal(convertEventSop('@s S\n@e EV verb=leave agent=$missing').ok,false);
 assert.equal(convertEventSop('@s S\n@e EV verb=leave agent={"name":"Mira"}').ok,false);
});

test('grouped numeric literals do not turn into lists; source-grounded entity labels retain numbers',async()=>{
 const {localChecks}=await import('../lib/local-quality.mjs');
 const c=convertEventSop('@s S\n@x E head=payment value=12,500_euro\n@c CP comparison=more theme=$x standard=10,000_euro');
 assert.equal(c.ok,true,c.error);assert.equal(c.ir.records[1].fields.val,'12500_euro');assert.equal(c.ir.records[2].fields.std,'10000_euro');
 assert.equal(localChecks('The payment is 12,500 euros, above 10,000 euros.',c).blocking.length,0);
 const r=convertClauseSop('@room-12 E\n@e EV subject=$room-12 verb=exist');
 assert.equal(localChecks('Room 12 exists.',r).blocking.length,0);
 assert.equal(localChecks('Room 12’s sensor exists.',r).blocking.length,0);
 assert.ok(localChecks('Room 123 exists.',r).blocking.length);
 const unrelated=convertClauseSop('@room-1 E\n@e EV subject=$room-1 verb=exist');
 assert.ok(localChecks('Room 12 exists.',unrelated).blocking.some(x=>x.code==='missing-number'));
});

test('identical repeated declarations are idempotent, conflicting identities remain invalid',()=>{
 const prefix='@x E head=box article=def\n@x E article=def head=box\n@s S\n@e EV verb=open theme=$x';
 const c=convertEventSop(prefix);assert.equal(c.ok,true,c.error);assert.equal(c.ir.records.filter(r=>r.id==='x').length,1);
 assert.ok(c.normalizations.some(n=>n.action==='deduplicate-identical-record'));
 assert.equal(convertEventSop(prefix+'\n@x E head=door').ok,false);
});

test('the recheck task override is snapshotted and never needs a formalizer tier',async()=>{
 const fs=await import('node:fs');const path=await import('node:path');
 const {prepare,root,readTask,verifyTasks}=await import('../lib/experiment.mjs');
 const name='override-test-'+process.pid,dir=path.join(root,'runs',name),variant='formalise_clause-judge';
 const task={begin:{tier:null,code:'this.next("judge");',next:'judge'},judge:{tier:'best',template:'${input}',code:'this.end(result);'}};
 try{
  const m=prepare(name,{provider:'fake',model:'unused',judgeProvider:'fake',judgeModel:'judge',variants:[variant],taskOverrides:{[variant]:task}});
  assert.deepEqual(m.models,{best:{provider:'fake',model:'judge'}});assert.deepEqual(readTask(m.tasks[variant].file),task);verifyTasks(m);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('one malformed judge ID does not discard other correctly identified unit evidence',async()=>{
 const {assessCandidate}=await import('../lib/local-quality.mjs');
 const units=semanticUnits('Mira left. Ren stayed. Who called?');
 const raw={source_entails_cnl:'no',cnl_entails_source:'no',speech_act_preserved:true,ambiguity_preserved:true,verdict:'different',mismatches:['Missing content'],explanation:'Some content differs.',additions:[],units:units.map((u,i)=>({id:i===2?'typo':u.id,verdict:i===1?'different':'preserved',reason:'Checked.'}))};
 const r=assessCandidate({ok:true},{blocking:[]},raw,units);
 assert.equal(r.success,false);assert.equal(r.verdict,'judge-incomplete');assert.equal(r.coverage.evaluated,2);assert.equal(r.coverage.unassessable,1);assert.equal(r.coverage.preservedPercent,50);
 assert.ok(r.coverage.issues.some(s=>s.includes('typo')));
});

test('omitted redundant additions list does not discard a complete unit assessment',()=>{
 const units=semanticUnits('Mira left.');
 const j={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Preserved.',units:units.map(u=>({id:u.id,verdict:'preserved',reason:'Same event.'}))};
 const r=assessJudge(j,units);assert.equal(r.success,true);assert.equal(r.coverage.additions,0);assert.equal(r.coverage.additionEvidence,'global-entailment-yes');
 const negative={...j,source_entails_cnl:'no',verdict:'different',mismatches:['Extra claim']};
 assert.equal(assessJudge(negative,units).coverage.additions,null);
});
