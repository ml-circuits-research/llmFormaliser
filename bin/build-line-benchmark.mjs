import fs from 'node:fs';
import path from 'node:path';
import {root,hash} from '../lib/experiment.mjs';
const output=process.argv[2]??'experiments/all-benchmark-lines.json';
const sources=fs.readdirSync(path.join(root,'benchmark'),{recursive:true}).filter(f=>f.endsWith('.txt')).sort();
const cases=[],files=[],occurrences=new Map();
for(const relative of sources){
 const source='benchmark/'+relative,text=fs.readFileSync(path.join(root,source),'utf8');let count=0;
 for(const [index,line]of text.split(/\r?\n/).entries()){
  if(!line.trim())continue;count++;
  const digest=hash(line),occurrence=(occurrences.get(digest)??0)+1;occurrences.set(digest,occurrence);
  cases.push({id:'line-'+digest.slice(0,20)+'-'+occurrence,source,line:index+1,text:line,sha256:digest});
 }
 files.push({source,sha256:hash(text),cases:count});
}
const data={unit:'nonempty-line',description:'Every nonempty physical line of every benchmark text file is one independent case. Duplicate occurrences remain separate cases; matching model requests may share one batched result.',files,cases};
fs.writeFileSync(path.resolve(root,output),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({files:files.length,cases:cases.length,uniqueTexts:occurrences.size,tasks:cases.length*6,characters:cases.reduce((n,c)=>n+c.text.length,0)},null,2));
