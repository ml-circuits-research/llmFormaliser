import {semanticUnits} from '../lib/semantic-units.mjs';
export function withUnits(j,pair){
 if(!j||typeof j!=='object'||!j.verdict)return j;
 const units=pair.units??semanticUnits(pair.source);
 return {...j,additions:[],units:units.map((u,i)=>({id:u.id,verdict:j.verdict==='different'&&i===0?'different':j.verdict==='uncertain'?'uncertain':'preserved',reason:j.explanation}))};
}
