import {withUnits} from './fake-judgment.mjs';
// Isolated fake provider for CLI integration; never contacts a remote service.
import http from 'node:http';
import fs from 'node:fs';
const [record,count]=process.argv.slice(2);
let calls=0;
const judge={source_entails_cnl:'yes',cnl_entails_source:'yes',speech_act_preserved:true,ambiguity_preserved:true,verdict:'equivalent',mismatches:[],explanation:'The same assertion and tense are preserved.'};
const server=http.createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');
 if(req.url==='/v1/models')return res.end(JSON.stringify({data:[{id:'formalizer'},{id:'judge'},{id:'broken'},{id:'repairer'}]}));
 if(req.url!=='/v1/chat/completions'){res.statusCode=404;return res.end('{}');}
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw),prompt=body.messages.at(-1).content;
 calls++;fs.writeFileSync(count,String(calls));
 let answer=body.model==='judge'?judge:body.model==='broken'?'invalid SOP':'@E1 EV st=asserted subj=John p=leave t=past';
 try{
  const inputs=JSON.parse(prompt.slice(prompt.lastIndexOf('\n')+1));
  if(Array.isArray(inputs))answer={results:Object.fromEntries(inputs.map(i=>[i.id,body.model==='judge'?withUnits(answer,i.input):answer]))};
 }catch{}
 res.end(JSON.stringify({model:body.model,choices:[{message:{role:'assistant',content:typeof answer==='string'?answer:JSON.stringify(answer)},finish_reason:'stop'}],usage:{prompt_tokens:50,completion_tokens:30}}));
});
server.listen(0,'127.0.0.1',()=>fs.writeFileSync(record,String(server.address().port)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
