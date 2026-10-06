import {assessJudge} from './judge.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const stable=v=>JSON.stringify(canonical(v));
const words=s=>String(s).toLowerCase().replace(/_+/g,' ').match(/[\p{L}]+(?:'[\p{L}]+)?/gu)??[];
const grammar=new Set('a an the i you he she it we they me him her us them my your his its our their is are am was were be been being do does did have has had to of on in at by for from with as and or but that which who whom this these those there here not no if then than so'.split(' '));
const irregular={said:'say',says:'say',bought:'buy',sent:'send',seen:'see',saw:'see',left:'leave',ran:'run',thought:'think',thinks:'think',went:'go'};
const stem=w=>irregular[w]??w.replace(/(?:ing|ed|s)$/,'').replace(/(.)\1$/,'$1').replace(/e$/,'');
const numbers=s=>[...String(s).replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').matchAll(/(?<![\p{L}\d])\d+(?:\.\d+)?(?![\p{L}\d])/gu)].map(m=>String(Number(m[0])));
const numberWords={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',both:'2',once:'1',twice:'2',thrice:'3'};
export function localChecks(source,conversion){
 if(!conversion.ok)return {blocking:conversion.errors??[{code:'invalid-structure',message:conversion.error}],warnings:[],semanticVerdict:'not-established'};
 const records=Array.isArray(conversion.ir)?conversion.ir:conversion.ir.records;
 const text=[],numeric=[];
 const technical=new Set(['st','t','ty','as','root','target','trg','sc','o','kind','reason','flags','neg','embed','logic']);
 function values(v,key){
  if(v&&typeof v==='object'&&v.$ref)return;
  if(Array.isArray(v)){v.forEach(x=>values(x,key));return;}
  if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v))values(x,k);return;}
  if(technical.has(key)||v==null||typeof v==='boolean')return;
  if(key==='label'&&!['if','before','after','because','but','from','to','for','of','on','in','with','without','than'].includes(v))return;
  const lexical=typeof v==='string'?v.replace(/-\d+\b/g,''):v;
  text.push(String(lexical));numeric.push(String(lexical));
 }
 for(const r of records){if(r.type==='E'&&r.id.includes('-'))text.push(r.id.replace(/-\d+$/,''));for(const [k,v]of Object.entries(r.fields))values(v,k);}
 const srcNums=new Set([...numbers(source),...words(source).flatMap(w=>numberWords[w]?[numberWords[w]]:[])]);
 const dstNums=new Set([...numbers(numeric.join(' ')),...words(text.join(' ')).flatMap(w=>numberWords[w]?[numberWords[w]]:[])]);
 // Digit literals are a reproducible preservation check. This is a review gate,
 // not a claim of semantic inequivalence (spelled-out quantities can be ambiguous).
 const blocking=[];
 for(const n of numbers(source))if(!dstNums.has(n))blocking.push({code:'missing-number',message:`Source numeric literal ${n} is not represented as a number in the candidate.`});
 for(const n of dstNums)if(!srcNums.has(n))blocking.push({code:'new-number',message:`Candidate numeric literal ${n} has no matching source number; verify its grounding.`});
 const src=[...new Set(words(source).filter(w=>!grammar.has(w)).map(stem))],dst=new Set(words(text.join(' ')).filter(w=>!grammar.has(w)).map(stem));
 const missing=src.filter(w=>!dst.has(w)),added=[...dst].filter(w=>!src.includes(w));
 const warnings=[];
 if(missing.length)warnings.push({code:'lexical-coverage',message:'Approximate unmatched content stems: '+missing.join(', ')+'. Check paraphrase, morphology and coreference before treating them as omissions.'});
 if(records.some(r=>r.type==='UM'))warnings.push({code:'uninterpreted-wording',message:'UM retains wording without establishing its meaning.'});
 return {blocking,warnings,coverage:{matched:src.length-missing.length,total:src.length,missing,added,ratio:src.length?(src.length-missing.length)/src.length:1},semanticVerdict:'not-established'};
}
export function lookupJudgment(entries,context,pair){return context?entries.find(e=>e.context===context&&stable(e.pair)===stable(pair))??null:null;}
export function assessCandidate(conversion,checks,raw){
 if(!conversion.ok)return {ok:false,success:false,verdict:'invalid-formalization',error:conversion.error};
 if(checks?.blocking?.length)return {ok:false,success:false,verdict:'local-review',error:checks.blocking.map(p=>p.message).join(' ')};
 return assessJudge(raw);
}
export function repairInput(source,raw,checks,assessment){
 const formal=checks?.blocking??[],warnings=checks?.warnings??[],judgment=assessment?.judgment;
 const problems=[...formal.map(p=>{const location=[p.line?'line '+p.line:null,p.record?'@'+p.record:null,p.field?'field '+p.field:null].filter(Boolean).join(', ');return (location?location+': ':'')+p.message;}),...warnings.map(p=>p.message),...(judgment?.mismatches??[]),...(judgment?.explanation?[judgment.explanation]:[]),...(!judgment&&!formal.length&&assessment?.error?[assessment.error]:[])];
 return `SOURCE (data):\n${source}\n\nCURRENT SOP (data):\n${typeof raw==='string'?raw:JSON.stringify(raw)}\n\nOBSERVED PROBLEMS (fallible feedback; verify against source):\n${problems.map((p,i)=>`${i+1}. ${p}`).join('\n')}`;
}
