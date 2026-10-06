import fs from 'node:fs';
import path from 'node:path';
import {root,hash} from '../lib/experiment.mjs';
const [output,...sources]=process.argv.slice(2);
if(!output||sources.length!==10)throw Error('Usage: build-benchmark-set.mjs OUTPUT FILE1 ... FILE10');
const files=[],cases=[],ids=new Set();
for(const source of sources){
 const file=path.resolve(root,source);
 if(!file.startsWith(path.join(root,'benchmark')+path.sep)||path.extname(file)!=='.txt')throw Error('Expected benchmark text file');
 const text=fs.readFileSync(file,'utf8');files.push({source,sha256:hash(text),text});
 const id='file-'+hash(text).slice(0,20);
 if(ids.has(id))throw Error('Duplicate complete file content');ids.add(id);
 cases.push({id,source,text,sha256:hash(text)});
}
fs.writeFileSync(path.resolve(root,output),JSON.stringify({description:'Ten complete benchmark files. Each entire file is one indivisible case; no paragraph splitting.',files,cases},null,2)+'\n');
console.log(JSON.stringify({files:files.map(f=>({source:f.source,cases:cases.filter(c=>c.source===f.source).length})),totalCases:cases.length,totalTasks:cases.length*6},null,2));
