import {cases as v1} from './cases_v1.mjs';

const clone = x => structuredClone(x);
export const cases = v1.map(clone);
const by = name => cases.find(c => c.name === name);

function setJudge(name, score, note) {
  const c = by(name); c.judge = {score,note};
}

// V2: context-dependent fragments are represented, not forced into a proposition.
{
  const c=by('fragment');
  c.ir.unmapped=[];
  c.ir.context_dependencies=[{span:'Probably tomorrow',type:'attachment',status:'unresolved',components:{epistemic:'probable',time:'tomorrow'}}];
  setJudge('fragment',94,'Faithfully preserves fragment content and explicitly marks unresolved discourse attachment.');
}

// V2: focus/exhaustivity operators.
{
  const c=by('focus-only');
  c.ir.unmapped=[];
  c.ir.frames[0].operators=[{id:'o1',type:'focus',value:'exclusive',target:'x1',scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  setJudge('focus-only',98,'Exclusive focus is explicit instead of being dropped.');
}
{
  const c=by('even-focus');
  c.ir.unmapped=[];
  c.ir.frames[0].operators=[{id:'o1',type:'focus',value:'scalar_even',target:'x1',scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  setJudge('even-focus',96,'Scalar focus is preserved as an operator; full pragmatic scale is intentionally underspecified.');
}
{
  const c=by('cleft-focus');
  c.ir.unmapped=[];
  c.ir.frames[0].operators=[{id:'o1',type:'focus',value:'cleft_exhaustive',target:'x1',scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  setJudge('cleft-focus',97,'Cleft/exhaustive focus is represented explicitly.');
}

// V2: approximation/non-occurrence.
{
  const c=by('almost');
  c.ir.unmapped=[];
  c.ir.frames[0].operators=[{id:'o1',type:'approximation',value:'almost',entails_occurrence:false,scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  setJudge('almost',99,'Almost is explicit and records that occurrence is not entailed.');
}

// V2: phase change and presupposition.
{
  const c=by('stop-presupposition');
  c.ir.unmapped=[];
  c.ir.frames=[{
    id:'e1',kind:'event',predicate:'smoke',arguments:[{role:'agent',ref:'x1'}],
    operators:[{id:'o1',type:'phase',value:'stop',scope:'e1'}],operator_root:'o1',
    tense:'past',aspect:'habitual',time:[],location:[],manner:[],status:'asserted',source:'speaker'
  }];
  c.ir.presuppositions=[{type:'prior_occurrence_or_state',target:'e1'}];
  setJudge('stop-presupposition',98,'Phase termination and prior-state presupposition are both represented.');
}
{
  const c=by('again');
  c.ir.unmapped=[];
  c.ir.frames[0].operators=[{id:'o1',type:'iteration',value:'again',scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  c.ir.presuppositions=[{type:'prior_occurrence',target:'e1'}];
  setJudge('again',99,'Repeated occurrence and prior-occurrence presupposition are explicit.');
}

// V2: counterfactual mood belongs to the conditional relation.
{
  const c=by('counterfactual');
  c.ir.unmapped=[];
  c.ir.relations[0].mood='counterfactual';
  setJudge('counterfactual',99,'Counterfactual conditional is distinguished from an open conditional.');
}

// V2: logical group prevents disjuncts from being individually asserted.
{
  const c=by('disjunction');
  c.ir.frames[0].status='alternative'; c.ir.frames[1].status='alternative';
  c.ir.logical_groups=[{id:'g1',type:'or',members:['e1','e2'],status:'asserted',inclusive:'unspecified'}];
  setJudge('disjunction',98,'Disjuncts are alternatives inside an asserted OR group, not independent facts.');
}

// V2: executable quantifier scope.
{
  const c=by('universal-quantifier');
  c.ir.quantifier_scopes=[
    {entity:'x1',kind:'all',scope:'e1',order:1},
    {entity:'x2',kind:'some',scope:'e1',order:2,dependent_on:['x1']}
  ];
  setJudge('universal-quantifier',97,'Quantifier order and dependency are explicit enough for compilation.');
}
{
  const c=by('negative-quantifier');
  c.ir.quantifier_scopes=[{entity:'x1',kind:'none',scope:'e1',order:1}];
  setJudge('negative-quantifier',98,'No-student quantification is explicitly scoped over the event.');
}

// V2: relation semantics for unless are preserved as a scoped exception relation.
{
  const c=by('unless');
  c.ir.relations[0].semantics='exception_condition';
  setJudge('unless',98,'Unless is retained as an exception-condition relation without unsafe Boolean simplification.');
}
{
  const c=by('nested-condition-modal');
  const u=c.ir.relations.find(r=>r.type==='unless'); if (u) u.semantics='exception_condition';
  c.ir.logical_scope=[{type:'condition',antecedent:'e1',consequent:{frame:'e2',exception:'e3'}}];
  setJudge('nested-condition-modal',98,'Outer condition, deontic negation and exception are explicitly scoped.');
}

// V2: suggestions keep both illocution and weak deontic force.
{
  const c=by('suggestion');
  c.ir.frames[0].operators=[{id:'o1',type:'deontic',value:'recommended',scope:'e1'}];
  c.ir.frames[0].operator_root='o1';
  setJudge('suggestion',99,'Speech act and weak deontic force are both preserved.');
}
