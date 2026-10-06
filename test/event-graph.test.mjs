import test from 'node:test';
import assert from 'node:assert/strict';
import {convertEventSop} from '../lib/event-sop.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
const prefix='@s S\n@x E h=Ana n=Ana ty=person\n';

test('content can target an operator and an embedded question without losing either node',()=>{
 const r=convertEventSop(prefix+'@e EV p=think ag=$x ct=$o\n@f EV p=leave ag=$x\n@o OP t=epistemic v=probable sc=$f\n@q Q t=yn embed=true target=$o\n@a EV p=ask ag=$x ct=$q');
 assert.equal(r.ok,true,r.error);
 assert.match(r.cnl,/propositional content \(content\) = scoped operator o/);
 assert.match(r.cnl,/propositional content \(content\) = question q/);
 assert.match(r.cnl,/operator value \(value\) = "probable"/);
 assert.match(r.cnl,/embedded \(embedded\) = true/);
 assert.match(r.cnl,/Event proposition f: not independently asserted: question target/);
});

test('numeric role values, ER spellings and quantifier scopes over links remain explicit',()=>{
 const r=convertEventSop(prefix+'@y E h=payment n=P7\n@e ST p=amount th=$y val=12500 cur=euros\n@f EV p=approve ag=$x th=$y\n@o OP t=deontic v=required sc=$f\n@l L t=condition f=$e to=$o\n@q QS k=all ent=$y sc=$l\n@r ER a=$y p=owner b=$x');
 assert.equal(r.ok,true,r.error);
 assert.match(r.cnl,/value \(value\) = 12500; currency \(currency\) = "euros"/);
 assert.match(r.cnl,/scope \(scope\) = propositional link l/);
 assert.match(r.cnl,/to \(to\) = scoped operator o/);
 assert.match(r.cnl,/endpoint A \(left\) = entity y.*predicate \(verb\) = "owner".*endpoint B \(right\) = entity x/);
 assert.doesNotMatch(r.cnl,/undefined|UNKNOWN/);
});

test('explicit assertions are not silently repaired when the same frame is questioned',()=>{
 const r=convertEventSop(prefix+'@e EV p=leave ag=$x st=asserted\n@q Q t=yn target=$e');
 assert.equal(r.ok,true,r.error);
 assert.match(r.cnl,/used inside a question.*semantic status \(status\) = "asserted"/);
 assert.doesNotMatch(r.cnl,/not independently asserted/);
});

test('missing comparison detail is exposed to the judge instead of invented',()=>{
 const r=convertEventSop(prefix+'@c CP t=superlative dim=time ent=$x');
 assert.equal(r.ok,true,r.error);assert.equal(r.warnings[0].code,'comparison-without-predicate');
 assert.equal(r.ir.records.find(r=>r.id==='c').fields.p,undefined);
 assert.match(r.cnl,/comparison dimension \(dimension\) = "time"/);
});

test('presentation wrappers are normalized, but malformed payload syntax is not repaired',()=>{
 const id='92ebaf5b-abef-47ba-b1e1-97d6473ddaf4';
 const r=convertClauseSop({[id]:'@E1 EV subj=John p=leave t=past'});
 assert.equal(r.ok,true,r.error);assert.equal(r.normalizations[0].action,'extract-single-batch-id-wrapper');
 const bad=convertClauseSop({[id]:'@key E mods=[{"label":of,"value":"Maria Smith}]'});
 assert.equal(bad.ok,false);assert.equal(bad.stage,'syntax');
});

test('unknown references and cyclic operator scopes still fail, style deviations remain visible warnings',()=>{
 for(const raw of [prefix+'@e EV p=leave ag=$missing',prefix+'@a OP t=negation sc=$b\n@b OP t=negation sc=$a'])assert.equal(convertEventSop(raw).ok,false);
 const r=convertEventSop(prefix+'@e EV p=leave ag=$x note=first_person');
 assert.equal(r.ok,true,r.error);assert.ok(r.warnings.some(w=>w.code==='non-atomic-spelling'));
 assert.match(r.cnl,/note \(note\) = "first_person"/);
});

test('Clause-SOP renders its declared default present tense, preserving explicit past/future',()=>{
 for(const [field,tense] of [['','present'],[' t=past','past'],[' t=future','future']]){
  const r=convertClauseSop('@e EV subj=John p=leave'+field);
  assert.equal(r.ok,true,r.error);assert.match(r.cnl,new RegExp('tense='+tense));
 }
});

test('unambiguous modifier-label typo is recorded; numeric quantities and lexical units retain their value',()=>{
 const r=convertClauseSop('@models E mods=[{"label":quantity","value":3}]\n@e EV subj=John p=compare obj=$models',{legacy:true});
 assert.equal(r.ok,true,r.error);assert.match(r.cnl,/quantity=3/);
 assert.equal(r.normalizations[0].action,'remove-stray-quote-after-bare-modifier-label');
 const number=convertClauseSop('@e EV subj=payment p=exceed obj=10000_euro');
 assert.equal(number.ok,true,number.error);assert.match(number.cnl,/10000_euro/);
 const literal=convertClauseSop('@e EV subj=John p=say obj="the literal \\"label\\":time\\", remains"');
 assert.equal(literal.ok,true,literal.error);assert.equal(literal.normalizations.length,0);
 const bad=convertClauseSop('@e EV subj=John p=say obj="unclosed');
 assert.equal(bad.ok,false);
});

test('Event-SOP shares the discourse record without treating it as a factual event',()=>{
 const r=convertEventSop(prefix+'@e EV p=leave ag=$x\n@d DISC target=$e t=approximation span=basically');
 assert.equal(r.ok,true,r.error);assert.match(r.cnl,/Discourse marker d:.*kind \(kind\) = "approximation".*source span \(span\) = "basically"/);
});
