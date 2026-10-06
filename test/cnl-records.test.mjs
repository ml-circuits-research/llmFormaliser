import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {flattenCnlRecords,expandCnlRecords} from '../lib/cnl-records.mjs';
import {expandTaskIncludes} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {root,readTask} from '../lib/experiment.mjs';
test('flat MOD/G declarations preserve attachment, nested alternatives, focus and negation',()=>{
 const records=[{id:'e',type:'EV',fields:{subj:{focus:'only',items:[{join:'alt',items:['John','Mary']}]},p:'leave',mods:[{label:'mode',value:'need',not:true},{label:'time',value:'next Tuesday'}]}}];
 assert.deepEqual(expandCnlRecords(flattenCnlRecords(records)),records);
 const r=convertClauseSop('@e EV subj=$g2 p=leave\n@g1 G t=alt m=[John,Mary]\n@g2 G t=only m=[$g1]\n@m MOD target=$e label=mode value=need neg=true\n@t MOD target=$e label=time value="next Tuesday"');
 assert.equal(r.ok,true,r.error);assert.match(r.cnl,/ONLY\(\(John OR-UNRESOLVED Mary\)\)/);assert.match(r.cnl,/event modifier mode=NOT need/);assert.match(r.cnl,/next Tuesday/);assert.doesNotMatch(r.sopLng,/[{}]/);
});
test('active Clause-SOP rejects inline JSON, invalid attachment, cyclic groups and dropped fields',()=>{
 for(const raw of ['@e EV subj=John p=leave mods=[{"label":time,"value":now}]','@e EV subj={"join":and,"items":[John,Mary]} p=leave','@m MOD target=$e label=time value=now\n@e EV subj=$m p=leave','@g G t=and m=[$g]\n@e EV subj=$g p=leave','@g G t=and m=[John,Mary]\n@m MOD target=$g label=time value=now\n@e EV subj=John p=leave','@e EV subj=John p=leave\n@m MOD target=$e label=time value=now extra=lost'])assert.equal(convertClauseSop(raw).ok,false,raw);
});
test('active prompt uses only SOP records and simple lists, with all 64 examples regenerated',()=>{
 const prompt=expandTaskIncludes(readTask('taskTypes/formalise_clause-judge.md'),{currentWorkingDirectory:root}).begin.template;
 assert.doesNotMatch(prompt,/\{\s*"(?:label|join|focus|key)"|mods=\[/);
 assert.match(prompt,/@\w+ MOD target=\$/);assert.match(prompt,/@\w+ G t=/);
 assert.equal((prompt.match(/^Text:/gm)??[]).length,64);
});

test('discourse wording is preserved separately from assertions and unknown wording stays uninterpreted',()=>{
 const r=convertClauseSop('@e EV subj=route p=be obj=shorter\n@d DISC target=$e t=approximation span=basically\n@u UM span="well, er" reason="function unclear"');
 assert.equal(r.ok,true,r.error);assert.match(r.cnl,/Discourse marker d, attached to e: function=approximation; source wording="basically"/);
 assert.match(r.cnl,/Uninterpreted wording u, applies to the whole utterance/);
 assert.equal((r.cnl.match(/It is asserted that/g)??[]).length,1);
 for(const raw of ['@e EV subj=route p=be obj=shorter\n@d DISC t=emotion','@e EV subj=route p=be obj=shorter\n@d DISC target=missing t=approximation span=basically'])assert.equal(convertClauseSop(raw).ok,false);
 const prompt=expandTaskIncludes(readTask('taskTypes/formalise_clause-judge.md'),{currentWorkingDirectory:root}).begin.template;
 assert.doesNotMatch(prompt,/Remove fillers/);assert.match(prompt,/DISC t=approximation span=basically/);
});
