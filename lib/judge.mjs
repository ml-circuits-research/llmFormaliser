import {assessUnits} from './semantic-units.mjs';
export function assessJudge(raw,units){
  try{
    const j=typeof raw==='string'?JSON.parse(raw):raw;
    if(!j || typeof j!=='object' || Array.isArray(j))throw new Error('Expected a JSON object');
    for(const key of ['source_entails_cnl','cnl_entails_source'])if(!['yes','no','uncertain'].includes(j[key]))throw new Error(`Invalid ${key}`);
    for(const key of ['speech_act_preserved','ambiguity_preserved'])if(![true,false,null].includes(j[key]))throw new Error(`Invalid ${key}`);
    if(!['equivalent','different','uncertain'].includes(j.verdict))throw new Error('Invalid verdict');
    if(!Array.isArray(j.mismatches)||!j.mismatches.every(x=>typeof x==='string'))throw new Error('Invalid mismatches');
    if(typeof j.explanation!=='string'||!j.explanation.trim())throw new Error('Missing explanation');
    const positive=j.source_entails_cnl==='yes'&&j.cnl_entails_source==='yes'&&j.speech_act_preserved===true&&j.ambiguity_preserved===true&&j.mismatches.length===0;
    const negative=j.source_entails_cnl==='no'||j.cnl_entails_source==='no'||j.speech_act_preserved===false||j.ambiguity_preserved===false||j.mismatches.length>0;
    if((j.verdict==='equivalent'&&!positive)||(j.verdict==='different'&&!negative)||(j.verdict==='uncertain'&&(positive||negative)))throw new Error('Contradictory judge fields');
    const coverage=units?assessUnits(j,units):undefined;
    return {ok:true,success:positive&&j.verdict==='equivalent',verdict:j.verdict,judgment:j,...(coverage?{coverage}:{})};
  }catch(error){return {ok:false,success:false,verdict:'judge-invalid',error:error.message};}
}

export function summarize(rows){
  const groups={};
  for(const row of rows){
    const g=groups[row.variant]??={total:0,success:0,different:0,uncertain:0,invalid:0,failed:0};
    g.total++;
    if(row.assessment?.success)g.success++;
    else if(row.assessment?.verdict==='different')g.different++;
    else if(row.assessment?.verdict==='uncertain')g.uncertain++;
    else if(row.conversion?.ok===false)g.invalid++;
    else g.failed++;
  }
  for(const g of Object.values(groups))g.successRate=g.success/g.total;
  return groups;
}
