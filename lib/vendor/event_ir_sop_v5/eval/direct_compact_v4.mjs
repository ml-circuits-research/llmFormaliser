import {fromCompact,toCompact} from '../src/compact_v4.mjs';
import {pathToFileURL} from 'node:url';
import {toCNLv4 as toCNL} from '../src/cnl_v4.mjs';
import {validateIR} from '../src/validate_v3.mjs';

export const cases=[
{
 name:'request-until', text:"Please don't restart the server until the backup has finished.", score:100,
 compact:`d1 S f=imp a=request d.primary=request d.politeness=please\nx1 E h=addressee ty=person n=addressee\nx2 E h=server\nx3 E h=backup\ne1 EV p=restart ag=$x1 th=$x2 st=requested root=$e1_o1\ne2 EV p=finish ag=$x3 st=hypothetical as=perfect\ne1_o1 OP t=negation sc=$e1\nl1 L t=until f=$e1 to=$e2 sem=do_not_restart_before_completion`
},
{
 name:'promise-negated-content', text:'Mary promised not to disclose the password.', score:100,
 compact:`d2 S\nx1 E h=person ty=person n=Mary\nx2 E h=password ty=information\ne1 EV p=promise ag=$x1 ct=$e2 t=past\ne2 EV p=disclose ag=$x1 th=$x2 st=promised root=$e2_o1\ne2_o1 OP t=negation sc=$e2\nl1 L t=content f=$e2 to=$e1`
},
{
 name:'counterfactual-modal-negation', text:'If Alice had left earlier, Bob might not have missed the train.', score:100,
 compact:`d3 S\nx1 E h=person ty=person n=Alice\nx2 E h=person ty=person n=Bob\nx3 E h=train\ne1 EV p=leave ag=$x1 st=hypothetical t=past as=perfect man=earlier\ne2 EV p=miss ag=$x2 th=$x3 st=conditional t=past as=perfect root=$e2_o2\ne2_o1 OP t=negation sc=$e2\ne2_o2 OP t=epistemic sc=$e2_o1 v=possible\nl1 L t=condition f=$e1 to=$e2 mood=counterfactual\nls1 LS t=conditional antecedent=$e1 consequent=$e2 mood=counterfactual`
},
{
 name:'at-most-ability', text:'No more than five users can access the file simultaneously.', score:100,
 compact:`d4 S\nx1 E h=user ty=person d=generic q=at_most qv=5\nx2 E h=file ty=information\ne1 EV p=access ag=$x1 th=$x2 root=$e1_o1 man=simultaneously\ne1_o1 OP t=dynamic sc=$e1 v=capable trg=$x1\nqs1 QS k=at_most ent=$x1 sc=$e1 o=1 sem=cardinality_upper_bound`
},
{
 name:'embedded-wh-report', text:'Who did John say bought the car?', score:99,
 compact:`d5 S f=int a=ask\nx1 E h=person ty=person n=John\nx2 E h=person ty=person d=unknown n=?who\nx3 E h=car\ne1 EV p=say ag=$x1 ct=$e2 st=queried t=past\ne2 EV p=buy ag=$x2 th=$x3 st=attributed t=past by=content_of_questioned_report\nl1 L t=content f=$e2 to=$e1\nq0 Q t=wh target=$x2 exp=person`
},
{
 name:'restrictive-universal-duty', text:'Every student who submitted late must explain why.', score:99,
 compact:`d6 S\nx1 E h=student ty=person d=generic q=all\nx2 E h=reason ty=information d=unknown n=?why\ne1 EV p=submit ag=$x1 t=past man=late\ne2 EV p=explain ag=$x1 ct=$x2 root=$e2_o1\ne2_o1 OP t=deontic sc=$e2 v=required\ner1 ER t=restrictor f=$e1 to=$x1 sem=restrictive_relative_clause\nqs1 QS k=all ent=$x1 sc=$e2 o=1 dist=distributive\nq0 Q t=embedded_wh target=$x2 exp=reason`
},
{
 name:'even-if-unless-command', text:'Even if the test passes, do not deploy unless Alice approves.', score:100,
 compact:`d7 S f=imp a=command\nx1 E h=test\nx2 E h=addressee ty=person n=addressee\nx3 E h=person ty=person n=Alice\ne1 EV p=pass ag=$x1 st=hypothetical\ne2 EV p=deploy ag=$x2 st=commanded root=$e2_o1\ne3 EV p=approve ag=$x3 st=hypothetical\ne2_o1 OP t=negation sc=$e2\nl1 L t=concession f=$e1 to=$e2 sem=even_if_does_not_cancel_main_rule\nl2 L t=unless f=$e2 to=$e3 sem=exception_condition`
},
{
 name:'only-cardinality-negative', text:'Only two of the five reviewers did not approve the paper.', score:99,
 compact:`d8 S\nx1 E h=reviewer ty=person d=definite q=exact qv=5\nx2 E h=reviewer ty=person d=definite q=exact qv=2\nx3 E h=paper ty=information\ne1 EV p=approve ag=$x2 th=$x3 t=past root=$e1_o2\ne1_o1 OP t=negation sc=$e1\ne1_o2 OP t=focus sc=$e1_o1 v=exclusive trg=$x2 dom=$x1\ner1 ER t=subset_of f=$x2 to=$x1\nqs1 QS k=exact ent=$x1 sc=$e1 o=1 sem=domain_cardinality\nqs2 QS k=exact ent=$x2 sc=$e1 o=2 sem=non_approver_cardinality`
},
{
 name:'reported-probable-negation', text:"Alice told Bob that Carol probably wasn't at home.", score:100,
 compact:`d9 S\nx1 E h=person ty=person n=Alice\nx2 E h=person ty=person n=Bob\nx3 E h=person ty=person n=Carol\ne1 EV p=tell ag=$x1 rc=$x2 ct=$e2 t=past\ne2 ST p=at_home th=$x3 st=reported t=past by=Alice root=$e2_o2\ne2_o1 OP t=negation sc=$e2\ne2_o2 OP t=epistemic sc=$e2_o1 v=probable\nl1 L t=content f=$e2 to=$e1`
},
{
 name:'unless-command', text:'Unless the payment arrives by Friday, cancel the order.', score:100,
 compact:`d10 S f=imp a=command\nx1 E h=payment\nx2 E h=addressee ty=person n=addressee\nx3 E h=order\ne1 EV p=arrive ag=$x1 st=hypothetical tm=by:Friday\ne2 EV p=cancel ag=$x2 th=$x3 st=commanded\nl1 L t=unless f=$e2 to=$e1 sem=exception_condition\nls1 LS t=unless main=$e2 exception=$e1 semantics=exception_condition`
},
{
 name:'definite-negation', text:'The king of France is not bald.', score:100,
 compact:`d11 S\nx1 E h=king ty=person pr=of:France\ne1 ST p=bald th=$x1 root=$e1_o1\ne1_o1 OP t=negation sc=$e1\nps1 PS t=definite_description_existence_uniqueness ent=$x1`
},
{
 name:'deliberate-negation', text:'John deliberately did not open the door.', score:100,
 compact:`d12 S\nx1 E h=person ty=person n=John\nx2 E h=door\ne1 EV p=open ag=$x1 th=$x2 t=past root=$e1_o2\ne1_o1 OP t=negation sc=$e1\ne1_o2 OP t=volitional sc=$e1_o1 v=deliberate`
},
{
 name:'iteration-count-time', text:'At least three sensors failed twice before noon.', score:99,
 compact:`d13 S\nx1 E h=sensor d=indefinite q=at_least qv=3\ne1 EV p=fail ag=$x1 t=past root=$e1_o1 tm=before:noon\ne1_o1 OP t=iteration sc=$e1 v=twice\nqs1 QS k=at_least ent=$x1 sc=$e1 o=1 sem=lower_bound_cardinality`
}
];

export function runDirect(){
let sum=0,valid=0;
for(const c of cases){
 const ir=fromCompact(c.compact,{sourceText:c.text}); const errs=validateIR(ir); if(!errs.length)valid++; sum+=c.score;
 console.log(`--- ${c.name} score=${c.score} valid=${errs.length===0}`); console.log(toCNL(ir)); if(errs.length)console.log(errs); console.log();
}
console.log(`N=${cases.length} avg=${(sum/cases.length).toFixed(3)} valid=${valid}/${cases.length}`);
return {n:cases.length,avg:sum/cases.length,valid};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) runDirect();
