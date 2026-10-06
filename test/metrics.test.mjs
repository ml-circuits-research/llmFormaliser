import test from 'node:test';
import assert from 'node:assert/strict';
import {experimentMetrics} from '../lib/experiment-metrics.mjs';
test('effective TPS includes full wall time and retries, deduplicates shared batches and excludes cached tokens',()=>{
 const r={id:'a',cached:false,ms:20000,usage:{in:200,out:100,reasoning:80}};
 const cached={id:'b',cached:true,ms:10,usage:{in:500,out:900,reasoning:600}};
 const m=experimentMetrics({startedAt:'2026-01-01T00:00:00Z',finishedAt:'2026-01-01T00:01:00Z'},{requests:{responses:[r,r,cached]},rows:[{assessment:{success:true}}]},[{status:429},{status:200,in_tokens:200,out_tokens:100}]);
 assert.equal(m.wallMs,60000);assert.equal(m.responseCount,2);assert.equal(m.tokens.received,100);assert.equal(m.tokens.replayedOutput,900);assert.equal(m.tokens.reasoning,80);
 assert.equal(m.effectiveOutputTps,100/60);assert.equal(m.outputTpsExcludingReportedReasoning,20/60);assert.equal(m.deliveredOutputTpsIncludingCache,1000/60);assert.equal(m.perResponse[0].effectiveOutputTps,5);assert.equal(m.perResponse[1].effectiveOutputTps,null);
 assert.equal(m.successfulCasesPerMinute,1);assert.equal(m.providerAttempts.errors,1);assert.equal(m.providerAttempts.attemptsWithoutTokenUsage,1);
});

test('indexed judgments have no allocated token usage, including earlier repair attempts',()=>{
 const m=experimentMetrics({startedAt:'2026-01-01T00:00:00Z',finishedAt:'2026-01-01T00:01:00Z'},{rows:[{attempts:[{judgeReuse:{run:'experiment-023'}},{judgeReuse:null}]}]});
 assert.equal(m.indexedJudgmentsReused,1);assert.equal(m.replayedUsageComplete,false);assert.equal(m.deliveredOutputTpsIncludingCache,null);
});

test('local continuation counts current reused judgments rather than historical attempts',()=>{
 const m={startedAt:'2026-01-01T00:00:00Z',finishedAt:'2026-01-01T00:00:01Z'};
 const r={requests:{responses:[]},rows:[{revalidationOf:'experiment-old',judgeReuse:{run:'experiment-old'},attempts:[{judgeReuse:null}],assessment:{success:true}}]};
 const out=experimentMetrics(m,r);assert.equal(out.indexedJudgmentsReused,1);assert.equal(out.tokens.received,0);
});
