import test from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../eval/cases_v3.mjs';
import {paragraphs} from '../eval/paragraph_cases_v3.mjs';
import {cases as direct} from '../eval/direct_compact_v4.mjs';
import {fromCompact} from '../src/compact_v4.mjs';
import {toSOPv5,fromSOPv5,validateSOPv5} from '../src/sop_v5.mjs';
import {toCNLv4} from '../src/cnl_v4.mjs';
import {signatureF1} from '../src/signature.mjs';
import {validateIR} from '../src/validate_v3.mjs';

const all=[...cases.map(c=>({text:c.text,ir:c.ir})),...paragraphs.flatMap(p=>p.sentences.map(ir=>({text:ir.text,ir}))),...direct.map(c=>({text:c.text,ir:fromCompact(c.compact,{sourceText:c.text})}))];

test('all v5 statements use @ outputs, resolved $ refs, and no hidden snake_case values',()=>{
  for(const {ir} of all){const s=toSOPv5(ir);assert.deepEqual(validateSOPv5(s),[]);assert.equal(s.includes('_'),false,s);for(const line of s.split('\n'))assert.match(line,/^@[A-Za-z0-9-]+\s/);}
});

test('v5 round-trip preserves semantic signature exactly on all 93 formalizations',()=>{
  for(const {text,ir} of all){const back=fromSOPv5(toSOPv5(ir),{sourceText:text});assert.equal(signatureF1(ir,back).f1,1);}
});

test('v5 round-trip preserves CNL exactly on all 93 formalizations',()=>{
  for(const {text,ir} of all){const back=fromSOPv5(toSOPv5(ir),{sourceText:text});assert.equal(toCNLv4(back),toCNLv4(ir));}
});

test('v5 round-trip remains valid legacy IR',()=>{
  for(const {text,ir} of all)assert.deepEqual(validateIR(fromSOPv5(toSOPv5(ir),{sourceText:text})),[]);
});

test('scope-sensitive pair remains different in SOP',()=>{
  const a=cases.find(c=>c.name==='must-not').ir,b=cases.find(c=>c.name==='not-required').ir;assert.notEqual(toSOPv5(a),toSOPv5(b));
});
