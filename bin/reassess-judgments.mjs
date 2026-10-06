// Offline grading corrections only: no conversion, generation, repair or judge calls.
import fs from 'node:fs';
import path from 'node:path';
import {root,hash} from '../lib/experiment.mjs';
import {assessCandidate} from '../lib/local-quality.mjs';
import {semanticUnits,summarizeCoverage} from '../lib/semantic-units.mjs';
import {summarize} from '../lib/judge.mjs';
const [name]=process.argv.slice(2);
if(!/^experiment-\d+$/.test(name??''))throw Error('Supply experiment-NNN');
const dir=path.join(root,'runs',name),file=path.join(dir,'local-assessments.json');
if(fs.existsSync(file))throw Error('Local assessment already exists; preserve its evidence');
const source=fs.readFileSync(path.join(dir,'report.json'),'utf8'),report=JSON.parse(source),started=performance.now();
const rows=report.rows.map(({worker,...r})=>({...r,previousAssessment:r.assessment,assessment:assessCandidate(r.conversion,r.localChecks,r.judgeRaw,semanticUnits(r.source))}));
const snapshot=path.join(dir,'local-assessment-code');fs.mkdirSync(snapshot);
const codeHashes={};for(const name of ['local-quality.mjs','semantic-units.mjs','judge.mjs']){const text=fs.readFileSync(path.join(root,'lib',name),'utf8');fs.writeFileSync(path.join(snapshot,name),text);codeHashes[name]=hash(text);}
const result={sourceReportHash:hash(source),codeHashes,providerCalls:0,elapsedMs:performance.now()-started,notes:['Deterministic grading only; saved source, SOP, CNL and model answers are unchanged.','Missing additions=[] can be inferred only from an explicit source_entails_cnl=yes; otherwise its count remains unknown.','Correctly identified units survive isolated missing/invalid unit IDs.'],summary:summarize(rows),coverage:summarizeCoverage(rows),rows};
fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({summary:result.summary,coverage:result.coverage,elapsedMs:result.elapsedMs},null,2));
