// Reuse only independently verified prompt/input IDs. The caller verifies model
// identity and reads original batches via strict cache before populating this map.
export async function replayJudgmentBatch(options,{reusable,live,model}){
 const split=options.prompt.lastIndexOf('\n')+1;
 const requests=JSON.parse(options.prompt.slice(split));
 const kept=requests.filter(r=>reusable.has(r.id)),fresh=requests.filter(r=>!reusable.has(r.id));
 const retained=Object.fromEntries(kept.map(r=>[r.id,reusable.get(r.id)]));
 let response;
 if(!fresh.length)response={ok:true,status:200,cached:true,ms:0,usage:{},served:model.provider+'/'+model.model,json:{results:retained}};
 else{
  const prompt=options.prompt.slice(0,split)+JSON.stringify(fresh);
  response=await live.json({...options,prompt,batchSize:fresh.length,upstream:model.provider,model:model.model});
  if(response.ok&&response.json?.results){
   if(Object.keys(response.json.results).some(id=>!fresh.some(r=>r.id===id)))response={...response,json:null,reason:'Unexpected result ID in fresh judge response'};
   else response={...response,served:response.served??model.provider+'/'+model.model,json:{...response.json,results:{...retained,...response.json.results}}};
  }
 }
 return {response,reused:kept.length,fresh:fresh.length};
}
