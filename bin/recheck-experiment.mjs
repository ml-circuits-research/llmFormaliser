// Re-evaluate saved final outputs with current local code. Only changed/newly
// eligible source/CNL pairs call the judge, through native pworker queue/flush.
import fs from 'node:fs';
import path from 'node:path';
import {root,prepare,queue,start,readTask,hash} from '../lib/experiment.mjs';
const [sourceName,name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(sourceName??'')||!/^experiment-\d+$/.test(name??''))throw new Error('Usage: recheck-experiment.mjs SOURCE NEW_RUN');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sourceDir=path.join(root,'runs',sourceName),previous=read(path.join(sourceDir,'manifest.json')),report=read(path.join(sourceDir,'report.json'));
if(!previous.status.startsWith('completed'))throw new Error('Original run must finish first');
const tasks={};
for(const variant of previous.variants){
 const dialect=variant.includes('_clause-')?'clause':'event';
 const base=readTask(path.join(root,'taskTypes',`formalise_${dialect}-judge.md`));
 const task={begin:{tier:null,code:`const old = JSON.parse(await this.readFile('saved/' + this.variant + '/' + this.caseId + '.json'));
if (old.caseId !== this.caseId || old.variant !== this.variant) throw new Error('Saved output identity mismatch');
if (!old) throw new Error('Missing saved output');
this.raw = old.raw;
this.previous = old;
this.repairCount = old.repairCount ?? 0;
this.attempts = old.attempts ?? [];`,next:'toCnl'},toCnl:structuredClone(base.toCnl),judge:base.judge,finish:structuredClone(base.finish)};
 task.toCnl.code+=`
if (this.conversion.ok && !this.localChecks.blocking.length && this.previous.conversion?.ok) {
  const { stable, assessCandidate } = await import('./lib/local-quality.mjs');
  const { assessJudge } = await import('./lib/judge.mjs');
  const previousPair = {source:this.previous.source, units:this.units,
    cnl:this.previous.conversion.cnl, notation:this.previous.conversion.notation};
  if (this.previous.judgmentContext === this.judgmentContext
      && stable(previousPair) === stable(this.pair)
      && (assessJudge(this.previous.judgeRaw, this.units).ok || assessCandidate(this.conversion, this.localChecks, this.previous.judgeRaw, this.units).coverage?.evaluated > 0)) {
    this.judgeRaw = this.previous.judgeRaw;
    this.judgeReuse = {run:${JSON.stringify(sourceName)},caseId:this.caseId,variant:this.variant};
    this.next('finish');
  }
}`;
 task.finish.code=task.finish.code.replace('const row = {',`const row = { revalidationOf: ${JSON.stringify(sourceName)}, previousAssessment: this.previous.assessment,`);
 tasks[variant]=task;
}
const cases=path.join(sourceDir,'recheck-dataset.json');
// This additional artifact records exactly the original inputs, never edits them.
const dataset=JSON.stringify({cases:previous.cases},null,2)+'\n';
if(fs.existsSync(cases)&&fs.readFileSync(cases,'utf8')!==dataset)throw new Error('Different saved recheck dataset');
if(!fs.existsSync(cases))fs.writeFileSync(cases,dataset);
const m=prepare(name,{provider:previous.models.best.provider,model:previous.models.best.model,judgeProvider:previous.models.best.provider,judgeModel:previous.models.best.model,repairProvider:previous.models.best.provider,repairModel:previous.models.best.model,variants:previous.variants,cases,taskOverrides:tasks});
const dir=path.join(root,'runs',name);
m.savedOutputsFiles={};
for(const {worker,...row} of report.rows){
 const file='saved/'+row.variant+'/'+row.caseId+'.json';
 const saved=JSON.stringify({...row,judgmentContext:previous.judgmentContexts[row.variant]},null,2)+'\n';
 fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),saved);
 m.savedOutputsFiles[file]=hash(saved);
}
m.revalidationOf=sourceName;m.executionNote='Local revalidation of saved final SOPs. No new generation or repair. Only changed/newly eligible pairs reach the judge.';
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n');
console.log(JSON.stringify(queue(name)));
console.log(JSON.stringify(start(name)));
