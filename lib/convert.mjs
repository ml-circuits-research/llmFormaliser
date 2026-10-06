import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {toSopLng,fromSopLng} from './sop-lng.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fromSOPv5,validateSOPv5,toSOPv5} from './vendor/event_ir_sop_v5/src/sop_v5.mjs';
import {toCNLv4} from './vendor/event_ir_sop_v5/src/cnl_v4.mjs';
import {validateIR} from './vendor/event_ir_sop_v5/src/validate_v3.mjs';
const localPython=fileURLToPath(new URL('../.venv/bin/python',import.meta.url));
export const python=process.env.LLM_FORMALISER_PYTHON || (fs.existsSync(localPython)?localPython:'python3');
export function checkDependencies(){
  const r=spawnSync(python,['-c','import lark'],{encoding:'utf8'});
  if(r.status!==0)throw new Error('Python dependency missing: install requirements.txt into .venv or set LLM_FORMALISER_PYTHON');
}
export function convert(variant, raw){
  try {
    if(raw==null || (typeof raw==='string' && !raw.trim()))throw new Error('Empty formalization');
    if(variant==='sop-v5'){
      if(typeof raw!=='string')throw new Error('SOP must be text');
      const errors=validateSOPv5(raw);
      // The prototype defaults missing S records and ignores unknown statement types.
      // Reject these before reconstruction instead of inventing a sentence frame.
      if(!/^@\S+ S(?:\s|$)/m.test(raw))errors.push('Missing sentence record');
      const types=new Set(['S','E','EV','ST','RE','EX','ID','DF','CP','OP','L','ER','G','QS','LS','PS','CI','CX','AM','MS','Q','MN','UM']);
      for(const line of raw.split(/\r?\n/).filter(x=>x.trim())){
        const type=line.match(/^@\S+\s+(\S+)/)?.[1];
        if(!types.has(type))errors.push(`Unknown statement type: ${type}`);
      }
      if(errors.length)throw new Error(errors.join('; '));
      const sopLng=toSopLng('sop-v5',raw);
      const restored=fromSopLng(sopLng);
      const ir=fromSOPv5(restored.document); // Never pass the source: reconstruction must stand alone.
      const invalid=validateIR(ir);
      if(invalid.length)throw new Error(invalid.join('; '));
      const cnl=toCNLv4(ir);
      if(!cnl.trim())throw new Error('Empty reconstructed CNL');
      return {ok:true,cnl,ir,sopLng,internalFormat:'SOP-LNG/1',notation:'Event IR CNL: records label speech acts, entities, event assertion status, scope, relations and ambiguity.',canonicalSop:toSOPv5(ir)};
    }
    if(!['cnl-e','cnl-json','cnl-kv'].includes(variant))throw new Error(`Unknown variant: ${variant}`);
    const r=spawnSync(python,[fileURLToPath(new URL('./cnl_bridge.py',import.meta.url))],{input:JSON.stringify({variant,raw}),encoding:'utf8',maxBuffer:8*1024*1024});
    if(!r.stdout)throw new Error(r.error?.message || r.stderr || 'CNL converter failed');
    const converted=JSON.parse(r.stdout);
    if(!converted.ok)throw new Error(converted.error);
    const sopLng=toSopLng('cnl-e',converted.ir);
    const restored=fromSopLng(sopLng);
    if(!isDeepStrictEqual(restored.document,converted.ir))throw new Error('SOP-LNG round-trip changed the CNL-E document');
    return {...converted,ir:restored.document,sopLng,internalFormat:'SOP-LNG/1',notation:'CNL-E KV: entity lines define noun properties. E1 fact asserts; claim is unasserted embedded content; question/subquestion preserve direct/embedded questions; order is a directive; interj is expressive. WHO VERB WHAT roles; not negates; semicolon label=value attaches to the event. PAST/FUTURE/PERF/PROG retain tense/aspect. References share identity; alternatives preserve ambiguity.'};
  } catch(error){return {ok:false,error:error.message};}
}
