import {semanticUnits} from './semantic-units.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseTaskSource,expandTaskIncludes} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {assessJudge} from './judge.mjs';
import {stable} from './local-quality.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const judgmentContext=(model,template,validatorHash)=>hash(stable({model,template,validatorHash}));
export function judgmentCacheIndex(root,contexts){
 const wanted=new Set(Object.values(contexts)),index=new Map();
 const runs=path.join(root,'runs');if(!fs.existsSync(runs))return [];
 for(const name of fs.readdirSync(runs).filter(n=>/^experiment-\d+$/.test(n)).sort()){
  const dir=path.join(runs,name),mf=path.join(dir,'manifest.json'),rf=path.join(dir,'report.json');
  if(!fs.existsSync(mf)||!fs.existsSync(rf))continue;
  const m=JSON.parse(fs.readFileSync(mf));if(!m.status.startsWith('completed'))continue;
  const r=JSON.parse(fs.readFileSync(rf));
  for(const variant of m.variants){
   let task;try{const f=m.tasks[variant].file;task=expandTaskIncludes(parseTaskSource(fs.readFileSync(f,'utf8'),path.extname(f)),{currentWorkingDirectory:dir});}catch{continue;}
   const context=judgmentContext(m.models.best,task.judge.template,m.moduleFiles?.['lib/judge.mjs']);if(!wanted.has(context))continue;
   for(const row of r.rows.filter(x=>x.variant===variant&&x.conversion?.ok)){
    const judgment=row.judgeRaw??row.worker?.state?.judgeRaw;if(!assessJudge(judgment,semanticUnits(row.source)).ok)continue;
    const pair={source:row.source,units:semanticUnits(row.source),cnl:row.conversion.cnl,notation:row.conversion.notation};
    const j=typeof judgment==='string'?JSON.parse(judgment):judgment;
    const signature=stable([j.verdict,j.source_entails_cnl,j.cnl_entails_source,j.speech_act_preserved,j.ambiguity_preserved,j.units,j.additions]);
    const key=stable([context,pair]),prior=index.get(key);
    index.set(key,{context,pair,judgment,signature,conflict:prior?.conflict||!!prior&&prior.signature!==signature,provenance:{run:name,variant,caseId:row.caseId}});
   }
  }
 }
 return [...index.values()].filter(x=>!x.conflict);
}
