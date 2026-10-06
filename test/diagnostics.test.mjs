import test from 'node:test';
import assert from 'node:assert/strict';
import {convertEventSop} from '../lib/event-sop.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {localChecks,repairInput} from '../lib/local-quality.mjs';
import {eventGraphCnl} from '../lib/event-cnl.mjs';

test('Event-SOP collects independent missing fields, target types and cycles with line locations',()=>{
 const raw='@s S\n@x E ty=person\n@e EV th=$x\n@q QS k=some ent=$e\n@o OP sc=$o';
 const c=convertEventSop(raw);assert.equal(c.ok,false);
 assert.deepEqual(c.errors.map(e=>[e.record,e.field,e.line]),[['e','p',3],['q','sc',4],['q','ent',4],['o','t',5],['o','sc',5]]);
 const input=repairInput('A person exists.',raw,localChecks('A person exists.',c),{error:c.error});
 for(const issue of c.errors)assert.ok(input.includes(issue.message));
 assert.equal((input.match(/missing predicate/g)??[]).length,1,'no duplicate summary in feedback');
 assert.match(input,/line 4, @q, field ent/);
});
test('Clause-SOP collects multiple fields on each record and independent modifier failures',()=>{
 const c=convertClauseSop('@e EV p=go subj=Ana t=tomorrow neg=no\n@x E q=3 plural=yes\n@m MOD target=$e label=3');
 assert.equal(c.ok,false);
 assert.deepEqual(new Set(c.errors.map(e=>e.record+'.'+e.field)),new Set(['e.t','e.neg','x.plural','m.label','m.value']));
 assert.ok(c.errors.every(e=>Number.isInteger(e.line)));
});
test('syntax diagnostics continue at independent fields and lines, without partial-reference cascades',()=>{
 const c=convertEventSop('@s S\n@x E h=a h=b q=1 q=2\n@e EV p="unterminated\n@z E h=Z');
 assert.equal(c.stage,'syntax');assert.equal(c.errors.length,3);
 assert.deepEqual(c.errors.map(e=>e.line),[2,2,3]);
 assert.ok(c.errors.every(e=>!e.message.includes('reference')));
 const refs=convertClauseSop('@e EV subj=$a p=see obj=$b');
 assert.equal(refs.errors.length,2);assert.deepEqual(refs.errors.map(e=>e.field),['subj','obj']);
});
test('ill-formed or dangling quantifier references do not also produce a spurious type error',()=>{
 assert.throws(()=>eventGraphCnl([{id:'s',type:'S',fields:{}},{id:'q',type:'QS',fields:{k:'some',ent:{$ref:'absent'},sc:'bad'}}]),error=>{
  assert.equal(error.issues.length,2);
  assert.ok(error.issues.every(i=>!i.message.includes('not an E')));
  return true;
 });
});
