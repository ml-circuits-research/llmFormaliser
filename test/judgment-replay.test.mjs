import test from 'node:test';
import assert from 'node:assert/strict';
import {replayJudgmentBatch} from '../lib/judgment-replay.mjs';
const model={provider:'fake',model:'judge'},prompt='Instructions\n'+JSON.stringify([{id:'same',input:'unchanged'},{id:'new',input:'changed'}]);
test('verified judgments are retained and only changed inputs reach the fake model',async()=>{
 let calls=0;
 const result=await replayJudgmentBatch({prompt},{model,reusable:new Map([['same',{verdict:'different'}]]),live:{json:async o=>{
  calls++;assert.equal(o.upstream,'fake');assert.equal(o.batchSize,1);
  assert.deepEqual(JSON.parse(o.prompt.split('\n').at(-1)),[{id:'new',input:'changed'}]);
  return {ok:true,status:200,cached:false,usage:{in:5,out:8},json:{results:{new:{verdict:'equivalent'}}}};
 }}});
 assert.equal(calls,1);assert.equal(result.reused,1);assert.equal(result.fresh,1);
 assert.deepEqual(result.response.usage,{in:5,out:8});assert.equal(result.response.cached,false);
 assert.equal(result.response.json.results.same.verdict,'different');assert.equal(result.response.json.results.new.verdict,'equivalent');
});
test('fully reusable batch makes no model call and does not report historic usage as new tokens',async()=>{
 const r=await replayJudgmentBatch({prompt},{model,reusable:new Map([['same','old'],['new','also old']]),live:{json:async()=>{throw Error('No model call allowed');}}});
 assert.equal(r.response.cached,true);assert.deepEqual(r.response.usage,{});assert.equal(r.fresh,0);
});
test('fresh response cannot replace cached judgments or hide missing result IDs',async()=>{
 const options={model,reusable:new Map([['same','old']]),live:{json:async()=>({ok:true,status:200,json:{results:{same:'replacement',new:'value'}}})}};
 const r=await replayJudgmentBatch({prompt},options);assert.equal(r.response.json,null);
 options.live.json=async()=>({ok:true,status:200,json:{results:{}}});
 const missing=await replayJudgmentBatch({prompt},options);assert.deepEqual(missing.response.json.results,{same:'old'});
});
