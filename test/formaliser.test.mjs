import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../lib/experiment.mjs';
import {convertClauseSop,nativeCnlToSop} from '../lib/clause-sop.mjs';
import {parseSopLng} from '../lib/sop-lng.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';
import {python} from '../lib/convert.mjs';
import {assessJudge,summarize} from '../lib/judge.mjs';
const good={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'Same actor, event, tense and assertion.'};

test('all 64 original CNL-E examples have a valid SOP spelling and local reconstruction',()=>{
 const script='import sys,json; sys.path.insert(0,sys.argv[1]); import cnl_check,cnl_json; print(json.dumps([cnl_json.to_json(text) for note,text in cnl_check.read_blocks(cnl_check.HERE / "data/examples.txt")]))';
 const r=spawnSync(python,['-c',script,path.join(root,'lib/vendor/cnl-e')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const docs=JSON.parse(r.stdout);assert.equal(docs.length,64);
 for(const doc of docs){const sop=nativeCnlToSop(doc),result=convertClauseSop(sop);assert.equal(result.ok,true,result.error);assert.ok(result.cnl.length);}
});
test('event prototype examples retain every native record and field without the narrower v4 adapter',()=>{
 const rows=JSON.parse(fs.readFileSync(path.join(root,'lib/vendor/event_ir_sop_v5/examples/direct_sop_v5.json'),'utf8'));
 for(const row of rows){const r=convertEventSop(row.sop);assert.equal(r.ok,true,r.error);assert.deepEqual(r.ir.records,parseSopLng(row.sop));assert.ok(r.cnl.length);}
});
test('invalid syntax cannot become a judged candidate',()=>{
 for(const raw of ['', '@e EV p=leave extra', '@e EV subj=John p=leave st=wishful', '@e EV subj=John p=leave flags=[PAST]', '@x E plural=perhaps'])assert.equal(convertClauseSop(raw).ok,false,raw);
 assert.equal(convertEventSop('@e EV p=leave ag=$missing').ok,false);
});
test('judge requires both entailments, preserved speech acts and consistent fields',()=>{
 assert.equal(assessJudge(good).success,true);
 for(const key of ['source_entails_cnl','cnl_entails_source']){
  assert.equal(assessJudge({...good,[key]:'no'}).success,false);
  assert.equal(assessJudge({...good,[key]:'uncertain',verdict:'uncertain'}).verdict,'uncertain');
 }
 assert.equal(assessJudge({...good,speech_act_preserved:false}).success,false);
 assert.equal(assessJudge({...good,mismatches:['lost negation']}).ok,false);
 const result=summarize([{variant:'v',assessment:assessJudge(good)},{variant:'v',conversion:{ok:false}},{variant:'v',assessment:{verdict:'uncertain'}}]);
 assert.equal(result.v.successRate,1/3);
});


test('repeated PS exists fields become a lossless list with one CNL presupposition per target',()=>{
 const prefix='@s S\n@x E h=Bucharest ty=location\n@y E h=Vienna ty=location\n';
 const repeated=convertEventSop(prefix+'@ps PS exists=$x exists=$y');
 const listed=convertEventSop(prefix+'@ps PS exists=[$x,$y]');
 assert.equal(repeated.ok,true,repeated.error);assert.equal(listed.ok,true,listed.error);
 assert.equal(repeated.cnl,listed.cnl);assert.equal(repeated.sopLng,listed.sopLng);
 assert.deepEqual(repeated.ir.records.find(r=>r.type==='PS').fields.exists,[{$ref:'x'},{$ref:'y'}]);
 assert.match(repeated.cnl,/existence of.*entity x.*entity y/);
 assert.equal(repeated.normalizations.length,1);
 assert.doesNotMatch(repeated.cnl,/uniqueness/);
 for(const bad of ['@ps PS exists=$x exists=$missing','@e EV p=go p=stop','@e EV p=go st=asserted st=queried'])assert.equal(convertEventSop(prefix+bad).ok,false,bad);
});
