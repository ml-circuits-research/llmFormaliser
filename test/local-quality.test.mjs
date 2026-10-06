import test from 'node:test';
import assert from 'node:assert/strict';
import {localChecks,lookupJudgment,assessCandidate,repairInput} from '../lib/local-quality.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
test('numeric grounding can stop a suspect candidate before judging without claiming semantic inequivalence',()=>{
 const c=convertClauseSop('@e EV subj=crate p=weigh obj=13');const checks=localChecks('The crate weighs 12.',c);
 assert.deepEqual(checks.blocking.map(p=>p.code),['missing-number','new-number']);
 assert.equal(assessCandidate(c,checks,null).verdict,'local-review');
 assert.match(repairInput('The crate weighs 12.','@e EV subj=crate p=weigh obj=13',checks,null),/numeric literal 12/);
});
test('surface coverage, including UM, never creates a semantic success',()=>{
 const c=convertClauseSop('@e EV subj=Ana p=help obj=Maria\n@u UM span="Maria helps Ana" reason="uninterpreted"');
 const checks=localChecks('Maria helps Ana',c);assert.equal(checks.coverage.ratio,1);assert.equal(checks.semanticVerdict,'not-established');
 assert.equal(assessCandidate(c,checks,null).success,false);
});
test('judge reuse requires exact pair and model/prompt/validator context',()=>{
 const entry={context:'model-and-prompt-A',pair:{source:'Ana helps Maria',cnl:'Ana helps Maria',notation:'v1'},judgment:{}};
 assert.equal(lookupJudgment([entry],entry.context,{notation:'v1',cnl:entry.pair.cnl,source:entry.pair.source}),entry);
 assert.equal(lookupJudgment([entry],'other-model',entry.pair),null);
 assert.equal(lookupJudgment([entry],entry.context,{...entry.pair,cnl:'Maria helps Ana'}),null);
});

test('explicit numeric word forms both and twice ground the literal two',()=>{
 for(const source of ['Test both models.','The customer complained twice.']){
  const conversion={ok:true,ir:[{id:'n',type:'E',fields:{q:2}}]};
  assert.equal(localChecks(source,conversion).blocking.length,0);
 }
 assert.ok(localChecks('Test the models.',{ok:true,ir:[{id:'n',type:'E',fields:{q:2}}]}).blocking.some(x=>x.code==='new-number'));
});
