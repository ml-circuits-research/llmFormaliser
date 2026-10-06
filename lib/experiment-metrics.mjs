// Effective throughput includes the entire experiment's wall time: provider wait,
// retries, concurrent requests and individual local phases. Cached tokens are
// accounted as replayed data, never as newly generated or billed tokens.
const sum=(rows,fn)=>rows.reduce((n,row)=>n+(Number(fn(row))||0),0);
const rate=(tokens,ms)=>ms>0?tokens*1000/ms:null;
export function experimentMetrics(manifest,report,attempts=[]){
 const responses=[...new Map((report.requests?.responses??[]).map(r=>[r.id,r])).values()];
 const fresh=responses.filter(r=>!r.cached),cached=responses.filter(r=>r.cached);
 const indexedJudgmentsReused=(report.rows??[]).reduce((n,row)=>n+(row.revalidationOf?[row]:row.attempts?.length?row.attempts:[row]).filter(a=>a.judgeReuse?.run).length,0);
 const replayedUsageComplete=indexedJudgmentsReused===0&&cached.every(r=>typeof r.usage?.in==='number'&&typeof r.usage?.out==='number');
 const wallMs=Date.parse(manifest.finishedAt)-Date.parse(manifest.startedAt);
 const tokens={sent:sum(fresh,r=>r.usage?.in),received:sum(fresh,r=>r.usage?.out),reasoning:sum(fresh,r=>r.usage?.reasoning),providerCachedInput:sum(fresh,r=>r.usage?.cached),replayedInput:sum(cached,r=>r.usage?.in),replayedOutput:sum(cached,r=>r.usage?.out)};
 const success=report.rows?.filter(r=>r.assessment?.success).length??0;
 return {
  startedAt:manifest.startedAt,finishedAt:manifest.finishedAt,wallMs,
  responseCount:responses.length,cacheHits:cached.length,indexedJudgmentsReused,replayedUsageComplete,tokens,
  effectiveOutputTps:rate(tokens.received,wallMs),
  outputTpsExcludingReportedReasoning:rate(Math.max(0,tokens.received-tokens.reasoning),wallMs),
  deliveredOutputTpsIncludingCache:replayedUsageComplete?rate(tokens.received+tokens.replayedOutput,wallMs):null,
  successfulCasesPerMinute:wallMs>0?success*60000/wallMs:null,
  perResponse:responses.map(r=>({id:r.id,model:r.served,cached:r.cached,batchSize:r.batchSize,elapsedMs:r.ms,inputTokens:r.usage?.in??null,outputTokens:r.usage?.out??null,reasoningTokens:r.usage?.reasoning??null,effectiveOutputTps:r.cached?null:rate(r.usage?.out??0,r.ms),cacheDeliveryTps:r.cached?rate(r.usage?.out??0,r.ms):null})),
  providerAttempts:attempts.length?{count:attempts.length,successful:attempts.filter(r=>r.status===200).length,errors:attempts.filter(r=>r.status!==200).length,inputTokensReported:sum(attempts,r=>r.in_tokens),outputTokensReported:sum(attempts,r=>r.out_tokens),attemptsWithoutTokenUsage:attempts.filter(r=>r.in_tokens==null||r.out_tokens==null).length}:null,
  note:'TPS uses full elapsed time, not generation-only time. Experiment TPS uses wall time, not summed concurrent request durations. Cached usage is reported separately. Per-item reused judgments do not have allocated token usage; replayedUsageComplete=false marks incomplete replay token totals. Token totals are provider-reported counts; missing usage on failed attempts is unknown, not assumed free. Reasoning tokens are included in received tokens when the provider includes them.'
 };
}
