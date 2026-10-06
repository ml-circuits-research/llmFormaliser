#!/usr/bin/env node
import {prepare,queue,start,status,pworker} from '../lib/experiment.mjs';
const [command,name,...args]=process.argv.slice(2);
const option=(key)=>{const i=args.indexOf('--'+key);return i<0?undefined:args[i+1];};
try{
 let result;
 if(command==='prepare')result=prepare(name,{provider:option('provider'),model:option('model'),judgeProvider:option('judge-provider'),judgeModel:option('judge-model'),repairProvider:option('repair-provider'),repairModel:option('repair-model'),variants:option('variants')?.split(','),cases:option('cases')});
 else if(command==='queue')result=queue(name);
 else if(command==='start')result=start(name);
 else if(command==='status')result=status(name);
 else if(command==='models')result=pworker(name?['models','--provider',name]:['models','--all']);
 else {console.log(`Usage:
  node bin/experiment.mjs models [PROVIDER]
  node bin/experiment.mjs prepare NAME --provider PROVIDER --model MODEL --judge-provider PROVIDER --judge-model MODEL [--repair-provider PROVIDER --repair-model MODEL] [--variants formalise_clause-judge,formalise_event-judge] [--cases FILE]
  node bin/experiment.mjs queue NAME
  node bin/experiment.mjs start NAME
  node bin/experiment.mjs status NAME

prepare snapshots task types and inputs locally without provider calls.
queue configures the selected model roles and stores tasks in pworker's native queue.
start calls pworker flush once; every task executes formalization, local CNL conversion, judging and finish.
Run start only after reviewing the model selection for this experiment.
Do not use pworker queue/flush concurrently with this runner.`);process.exit(command?1:0);}
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
