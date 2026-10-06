import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../lib/experiment.mjs';
import {python,convert} from '../lib/convert.mjs';
import {toSopLng,fromSopLng,parseSopLng,serializeSopLng} from '../lib/sop-lng.mjs';
import {cases} from '../lib/vendor/event_ir_sop_v5/eval/cases_v3.mjs';
import {paragraphs} from '../lib/vendor/event_ir_sop_v5/eval/paragraph_cases_v3.mjs';
import {cases as direct} from '../lib/vendor/event_ir_sop_v5/eval/direct_compact_v4.mjs';
import {fromCompact} from '../lib/vendor/event_ir_sop_v5/src/compact_v4.mjs';
import {toSOPv5,fromSOPv5} from '../lib/vendor/event_ir_sop_v5/src/sop_v5.mjs';
import {toCNLv4} from '../lib/vendor/event_ir_sop_v5/src/cnl_v4.mjs';

test('common SOP-LNG preserves all 64 native CNL-E documents exactly',()=>{
 const script='import sys,json; sys.path.insert(0,sys.argv[1]); import cnl_check,cnl_json; print(json.dumps([cnl_json.to_json(text) for note,text in cnl_check.read_blocks(cnl_check.HERE / "data/examples.txt")]))';
 const r=spawnSync(python,['-c',script,path.join(root,'lib/vendor/cnl-e')],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const docs=JSON.parse(r.stdout);assert.equal(docs.length,64);
 for(const doc of docs){
  const sop=toSopLng('cnl-e',doc);assert.deepEqual(fromSopLng(sop).document,doc);
  assert.equal(serializeSopLng(parseSopLng(sop)),sop);
 }
});

test('common SOP-LNG preserves all 93 SOP v5 reconstructions',()=>{
 const all=[...cases.map(c=>c.ir),...paragraphs.flatMap(p=>p.sentences),...direct.map(c=>fromCompact(c.compact,{sourceText:c.text}))];
 assert.equal(all.length,93);
 for(const ir of all){
  const raw=toSOPv5(ir),sop=toSopLng('sop-v5',raw),back=fromSopLng(sop);
  assert.deepEqual(parseSopLng(back.document),parseSopLng(raw));
  assert.equal(toCNLv4(fromSOPv5(back.document)),toCNLv4(ir));
 }
});

test('common syntax rejects dropped tokens, duplicate keys/IDs and dangling refs',()=>{
 for(const text of ['@a EV p=go garbage','@a EV p=go p=stop','@a EV\n@a EV','@a EV obj=$missing','@a EV p="unclosed','@a EV p=','@a EV args=[$a,,]'])assert.throws(()=>parseSopLng(text),undefined,text);
 const source=toSopLng('cnl-e',{entities:[],events:[{id:'E1',who:'John',verb:'leave',flags:['PAST']}]});
 assert.throws(()=>fromSopLng(source.replace('t=past','t=future')),/tense/);
 assert.equal(convert('sop-v5','@s S\n@e EV p=leave garbage').ok,false);
});

test('common keys preserve semantics rather than inventing agent or theme roles',()=>{
 const result=convert('cnl-e','E1: John leave [PAST]');assert.equal(result.ok,true,result.error);
 assert.match(result.sopLng,/@E1 EV subj=John p=leave/);assert.match(result.sopLng,/t=past/);
 assert.doesNotMatch(result.sopLng,/\bag=/);
 assert.equal(result.internalFormat,'SOP-LNG/1');
});

test('single and double quotes preserve identical values and boundaries',()=>{
 const single=String.raw`@x E name='window seat' note='it\'s "quiet", [yes]' values=['next Tuesday','$literal', '3', 'true'] escaped='line\nnext\u0021'`;
 const expected=[{id:'x',type:'E',fields:{name:'window seat',note:'it\'s "quiet", [yes]',values:['next Tuesday','$literal','3','true'],escaped:'line\nnext!'}}];
 assert.deepEqual(parseSopLng(single),expected);
 assert.deepEqual(parseSopLng(serializeSopLng(expected)),expected);
 assert.deepEqual(parseSopLng(`@x E name="O'Brien" q=3`)[0].fields,{name:"O'Brien",q:3});
 for(const invalid of ["@x E name='unclosed", "@x E name='closed'trailing", String.raw`@x E name='bad\q'`, "@x E values=['a',,'b']"])
   assert.throws(()=>parseSopLng(invalid),undefined,invalid);
});

test('unambiguous bare time and date literals preserve their spelling',()=>{
 const bare=parseSopLng('@x E tm=09:00 until=09:15 date=2026-10-06 amount=3 q="3"')[0];
 assert.deepEqual(bare.fields,{tm:'09:00',until:'09:15',date:'2026-10-06',amount:3,q:'3'});
 assert.deepEqual(parseSopLng(serializeSopLng([bare])),[bare]);
 assert.equal(parseSopLng('@x E value=95% limit=>500_euro')[0].fields.value,'95%');
});

test('apostrophes inside bare words are literal, not unmatched string delimiters',()=>{
 assert.deepEqual(parseSopLng("@x E value=can't name=O'Brien list=[can't,won't]")[0].fields,{value:"can't",name:"O'Brien",list:["can't","won't"]});
 assert.throws(()=>parseSopLng("@x E value='unclosed"));
 assert.equal(parseSopLng("@x E value='quoted words'")[0].fields.value,'quoted words');
});
