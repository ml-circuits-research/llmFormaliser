import {assertFlatCnlRecords} from './cnl-records.mjs';
import {parseDialect,publicSop} from './sop-fields.mjs';
import {diagnosticIssues,locateIssues} from './validation.mjs';
import {parseSopLng,serializeSopLng} from './sop-lng.mjs';
import {formalizationInput} from './formalization-input.mjs';
import {eventGraphCnl,eventNotation} from './event-cnl.mjs';
export function convertEventSop(raw){
 let stage='presentation',normalizations=[],sourceText='';
 try{
  const input=formalizationInput(raw);normalizations=input.normalizations;sourceText=input.text;stage='syntax';
  const records=parseDialect(input.text,'event',normalizations);stage='structure';
  assertFlatCnlRecords(records);
  const {cnl,ir,warnings}=eventGraphCnl(records);
  return {ok:true,ir,cnl,normalizations,warnings,sopLng:publicSop(records,'event'),notation:eventNotation};
 }catch(error){return {ok:false,stage,error:error.message,errors:locateIssues(diagnosticIssues(error,stage),sourceText),normalizations};}
}
