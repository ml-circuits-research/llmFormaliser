import test from 'node:test';
import assert from 'node:assert/strict';
import {expandTaskIncludes} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {readTask,root,dialects} from '../lib/experiment.mjs';
import {convertClauseSop} from '../lib/clause-sop.mjs';
import {convertEventSop} from '../lib/event-sop.mjs';

test('generation and both repair paths include the identical canonical dialect file',()=>{
 for(const dialect of dialects){
  const names=[`formalise_${dialect.replace(/-sop$/,'')}-judge`,`formalise_${dialect.replace(/-sop$/,'')}-symboliccheck-repair-judge`,`symbolicformalise_${dialect.replace(/-sop$/,'')}-symboliccheck-repair-judge`];
  let canonical;
  for(const name of names){
   const task=readTask(`taskTypes/${name}.md`);
   for(const phase of ['begin','repair'])if(task[phase]?.template){
    assert.ok(task[phase].template.startsWith('${{lib/prompts/'+dialect+'.txt}}'));
    const files=[];
    const expanded=expandTaskIncludes(task,{currentWorkingDirectory:root,onFile:f=>files.push(f)});
    const file=files.find(f=>f.path===`lib/prompts/${dialect}.txt`);
    assert.ok(file);
    canonical??=file.content;assert.equal(file.content,canonical);
    assert.ok(expanded[phase].template.startsWith(canonical));
    assert.equal((expanded[phase].template.match(/\$\{[A-Za-z_][\w.]*\}/g)??[]).length,1);
   }
  }
 }
});
test('numeric quantities and harmless list spelling do not reject valid Clause-SOP',()=>{
 const a=convertClauseSop('@person E q=3\n@e EV subj=$person p=leave t=present flags=PROG');
 const b=convertClauseSop('@person E q="3"\n@e EV subj=$person p=leave t=present flags=[PROG,PROG]');
 assert.equal(a.ok,true,a.error);assert.equal(b.ok,true,b.error);assert.equal(a.cnl,b.cnl);
});
test('Event-SOP permits typed anonymous entities and existence without redundant predicate',()=>{
 const r=convertEventSop('@s S\n@x E ty=person\n@e EX th=$x');
 assert.equal(r.ok,true,r.error);assert.match(r.cnl,/Existence/);assert.match(r.cnl,/person/);
});
