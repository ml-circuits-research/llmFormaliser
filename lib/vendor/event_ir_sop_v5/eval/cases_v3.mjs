import {cases as v2} from './cases_v2.mjs';

const clone=x=>structuredClone(x);
export const cases=v2.map(clone);
const by=name=>cases.find(c=>c.name===name);
const E=(id,surface,head,type='object',extra={})=>({id,surface,head,type,name:null,definiteness:'definite',quantifier:null,properties:[],coreference:null,...extra});
const F=(id,kind,predicate,args,status='asserted',extra={})=>({id,kind,predicate,arguments:args.map(([role,ref])=>({role,ref})),operators:[],operator_root:null,tense:'unknown',aspect:'simple',time:[],location:[],manner:[],status,source:'speaker',...extra});
const base=(id,text,form='declarative',speech_act='assert')=>({sentence_id:id,text,form,speech_act,entities:[],frames:[],relations:[],question:null,missing:[],ambiguities:[],unmapped:[]});
const score=(name,note,s=100)=>{const c=by(name);c.judge={score:s,note};};

// ---- V3 repairs of V1/V2 cases ------------------------------------------------
{
 const c=by('conditional');
 c.ir.relations[0].mood='open';
 c.ir.logical_scope=[{type:'conditional',antecedent:'e1',consequent:'e2',mood:'open'}];
 score('conditional','Open conditional and future-oriented consequent are explicitly distinguished from counterfactual mood.');
}
{
 const c=by('unless');
 c.ir.logical_scope=[{type:'unless',main:'e1',exception:'e2',semantics:'exception_condition'}];
 score('unless','Unless is kept as a scoped exception-condition primitive, avoiding an invalid Boolean collapse.');
}
score('ditransitive','Agent, theme, recipient and by-email instrument are preserved exactly.');
score('belief','Attitude holder and embedded content are separate; embedded content is attributed to John rather than asserted by the speaker.');
{
 const c=by('imperative');
 c.ir.speech_act_details={primary:'command',implicit_addressee:true,subject_recovery:'licensed_by_imperative_grammar'};
 score('imperative','Command force and grammatically licensed implicit addressee are explicit.');
}
{
 const c=by('polite-request');
 c.ir.speech_act_details={primary:'request',surface_form:'modal_interrogative',conventionalized_indirect:true,politeness:['please'],secondary_reading:{type:'literal_ability_question',status:'available_but_not_primary'}};
 c.ir.context_dependencies=[{span:'Could you',type:'illocutionary_reading',status:'resolved_primary_with_secondary_preserved',components:{primary:'request',secondary:'ability_question'}}];
 score('polite-request','Primary request force, politeness and residual literal ability-question reading are all retained.',99);
}
{
 const c=by('suggestion');
 c.ir.speech_act_details={primary:'suggest',surface_modal:'should',force:'recommendation'};
 score('suggestion','Suggestion/recommendation force and source modal should are both represented.');
}
{
 const c=by('universal-quantifier');
 c.ir.quantifier_scopes=[
   {entity:'x1',kind:'all',scope:'e1',order:1,distributivity:'distributive',semantics:'for_each'},
   {entity:'x2',kind:'some',scope:'e1',order:2,dependent_on:['x1'],semantics:'existential_per_binder'}
 ];
 score('universal-quantifier','Universal distribution and dependent existential assignment are explicit.');
}
{
 const c=by('negative-quantifier');
 c.ir.quantifier_scopes=[{entity:'x1',kind:'none',scope:'e1',order:1,distributivity:'distributive',semantics:'no_member_satisfies'}];
 score('negative-quantifier','Negative quantification is explicitly scoped over the passing event.');
}
{
 const c=by('exact-cardinality');
 c.ir.quantifier_scopes=[{entity:'x1',kind:'exact',scope:'e1',order:1,semantics:'cardinality_exact'}];
 score('exact-cardinality','Exact cardinality, modifiers and event participation are all explicit.');
}
{
 const c=by('comparison');
 c.ir.frames[0].predicate='tall';
 c.ir.frames[0].comparison={dimension:'height',relation:'greater_than'};
 score('comparison','Comparison dimension, ordering relation and standard are explicit rather than encoded in an opaque adjective.');
}
{
 const c=by('relative-clause');
 c.ir.relations=[];
 c.ir.entity_relations=[{type:'restrictor',modifier:'e1',head:'x1',semantics:'restrictive_relative_clause'}];
 score('relative-clause','The discovery event restricts the scientist referent; it is not misrepresented as mere discourse elaboration of winning.');
}
{
 const c=by('coreference-clear');
 c.ir.mentions=[{span:'John',ref:'x1'},{span:'He',ref:'x1'}];
 score('coreference-clear','Both mentions are retained and mapped to the same referent.');
}
{
 const c=by('fragment');
 c.ir.context_dependencies=[{span:'Probably tomorrow',type:'elliptical_attachment',status:'unresolved',components:{epistemic:{value:'probable',scope:'missing_proposition'},time:{value:'tomorrow',anchor:'speech_time_or_context'}}}];
 c.ir.missing=[{type:'proposition',reason:'ellipsis_requires_prior_context'}];
 score('fragment','All overt semantic material is preserved while the missing proposition remains explicitly unresolved rather than hallucinated.',99);
}
{
 const c=by('nested-condition-modal');
 c.ir.logical_scope=[{type:'conditional',antecedent:'e1',consequent:{frame:'e2',exception:{frame:'e3',relation:'unless'}},mood:'open'}];
 score('nested-condition-modal','Outer condition, REQUIRED(NOT(delete)) and unless-exception scope are explicit as one nested logical structure.');
}
{
 const c=by('focus-only');
 const o=c.ir.frames[0].operators[0]; o.domain='contextual_relevant_alternatives';
 c.ir.context_dependencies=[{span:'Only',type:'focus_alternative_domain',status:'contextual',components:{target:'x1',domain:'relevant alternatives to Alice'}}];
 score('focus-only','Exclusive focus is represented with an explicit contextual alternative domain.');
}
score('almost','Almost has explicit non-entailment of occurrence and event scope.');
score('stop-presupposition','Cessation and the prior-smoking presupposition are both represented separately.');
score('again','Iteration and its prior-occurrence presupposition are explicit.');
{
 const c=by('even-focus');
 c.ir.frames[0].operators[0].domain='contextual_scale';
 c.ir.conventional_implicatures=[{type:'scalar_unexpectedness',target:'x1',content:{predicate:'pass',scale:'contextual',relative_position:'unexpected/extreme'}}];
 score('even-focus','Truth-conditional event plus the scalar conventional implication of even are represented without inventing the missing comparison class.',99);
}
{
 const c=by('cleft-focus');
 c.ir.presuppositions=[{type:'existential_background',target:'e1',content:{open_role:'agent',predicate:'break',theme:'x2'}}];
 c.ir.context_dependencies=[{span:'It was John who',type:'focus_alternative_domain',status:'contextual',components:{target:'x1',role:'agent'}}];
 score('cleft-focus','Cleft focus/exhaustivity and its existential background are explicit; exact exhaustivity status is theory/context sensitive.',99);
}
{
 const c=by('disjunction');
 c.ir.logical_groups[0].semantics='inclusive_or_unless_context_resolves_otherwise';
 score('disjunction','Alternatives are grouped under one asserted disjunction, with inclusivity left explicitly contextual.');
}
{
 const c=by('purpose');
 c.ir.frames[1].status='intended';
 c.ir.relations=[{type:'purpose',from:'e1',to:'e2',achievement:'not_entailed'}];
 score('purpose','Opening is asserted; cooling is an intended purpose whose achievement is explicitly not entailed.');
}
score('promise','Promise event and promised future content remain distinct; the promised content is not promoted to fact.');
score('counterfactual','Past-perfect antecedent/consequent and counterfactual mood are all explicit.');

// ---- Additional adversarial cases -------------------------------------------
function add(name,text,build,note,scoreValue=100){
 const ir=base(`v3s${cases.length+1}`,text); build(ir); cases.push({name,text,ir,judge:{score:scoreValue,note}});
}

add('not-every','Not every student passed.',ir=>{
 ir.entities=[E('a1','every student','student','person',{definiteness:'generic',quantifier:{kind:'all'}})];
 ir.frames=[F('f1','event','pass',[['agent','a1']],'asserted',{tense:'past',operators:[{id:'o1',type:'negation',scope:'q1'}],operator_root:'o1'})];
 // q1 is a logical quantifier node represented through explicit logical_scope, so operator stays descriptive here.
 ir.frames[0].operators=[];ir.frames[0].operator_root=null;
 ir.quantifier_scopes=[{entity:'a1',kind:'all',scope:'f1',order:1,distributivity:'distributive'}];
 ir.logical_scope=[{type:'negation',scope:{type:'quantifier',kind:'all',entity:'a1',body:'f1'},semantics:'not_all'}];
},'Negation takes scope over the universal quantifier, preserving NOT(ALL(pass)).');

add('no-vs-not-all','No student passed.',ir=>{
 ir.entities=[E('a1','No student','student','person',{definiteness:'generic',quantifier:{kind:'none'}})];
 ir.frames=[F('f1','event','pass',[['agent','a1']],'asserted',{tense:'past'})];
 ir.quantifier_scopes=[{entity:'a1',kind:'none',scope:'f1',order:1,semantics:'no_member_satisfies'}];
},'No is represented as zero satisfying members, distinct from not every.');

add('outer-negation-report','John did not say Mary stole the money.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'}),E('a3','the money','money')];
 ir.frames=[F('f1','event','say',[['agent','a1'],['content','f2']],'asserted',{tense:'past',operators:[{id:'o1',type:'negation',scope:'f1'}],operator_root:'o1'}),F('f2','event','steal',[['agent','a2'],['theme','a3']],'attributed',{source:'content_of_denied_report',tense:'past'})];
 ir.relations=[{type:'content',from:'f2',to:'f1',semantics:'content_under_negated_attitude'}];
},'Negation scopes over saying; the embedded theft is not asserted by the speaker.');

add('inner-negation-report','John said Mary did not steal the money.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'}),E('a3','the money','money')];
 ir.frames=[F('f1','event','say',[['agent','a1'],['content','f2']],'asserted',{tense:'past'}),F('f2','event','steal',[['agent','a2'],['theme','a3']],'reported',{source:'John',tense:'past',operators:[{id:'o1',type:'negation',scope:'f2'}],operator_root:'o1'})];
 ir.relations=[{type:'content',from:'f2',to:'f1'}];
},'Negation is inside the reported content rather than over the saying event.');

add('factive-know','Mary knows that John left.',ir=>{
 ir.entities=[E('a1','Mary','person','person',{name:'Mary'}),E('a2','John','person','person',{name:'John'})];
 ir.frames=[F('f1','state','know',[['experiencer','a1'],['content','f2']]),F('f2','event','leave',[['agent','a2']],'presupposed',{tense:'past'})];
 ir.relations=[{type:'content',from:'f2',to:'f1'}];
 ir.presuppositions=[{type:'factive_content',target:'f2'}];
},'The knowing state is asserted while the embedded departure is marked factive/presupposed.');

add('nonfactive-pretend','Mary pretended that John left.',ir=>{
 ir.entities=[E('a1','Mary','person','person',{name:'Mary'}),E('a2','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','pretend',[['agent','a1'],['content','f2']],'asserted',{tense:'past'}),F('f2','event','leave',[['agent','a2']],'attributed',{source:'pretence',tense:'past'})];
 ir.relations=[{type:'content',from:'f2',to:'f1',semantics:'nonfactive'}];
},'Pretended content is represented without any factual commitment to John leaving.');

add('manage-implicative','John managed to open the door.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','the door','door')];
 ir.frames=[F('f1','event','open',[['agent','a1'],['theme','a2']],'asserted',{tense:'past',operators:[{id:'o1',type:'success',value:'manage',scope:'f1'}],operator_root:'o1'})];
 ir.conventional_implicatures=[{type:'nontrivial_effort_or_difficulty',target:'f1'}];
},'Manage preserves successful occurrence plus its conventional difficulty/effort nuance.',99);

add('fail-implicative','John failed to open the door.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','the door','door')];
 ir.frames=[F('f1','event','open',[['agent','a1'],['theme','a2']],'asserted',{tense:'past',operators:[{id:'o1',type:'success',value:'fail',scope:'f1',entails_success:false}],operator_root:'o1'})];
 ir.logical_scope=[{type:'failure',target:'f1',entails_event_success:false}];
},'Failure explicitly denies successful completion while leaving attempt-vs-opportunity pragmatics conservative.',99);

add('definite-presupposition','The king of France is bald.',ir=>{
 ir.entities=[E('a1','The king of France','king','person',{definiteness:'definite',properties:[{predicate:'of',value:'France'}]})];
 ir.frames=[F('f1','state','bald',[['theme','a1']])];
 ir.presuppositions=[{type:'definite_description_existence_uniqueness',entity:'a1'}];
},'Definite-description existence/uniqueness is separated as presupposition; exact presupposition theory is deliberately not overcommitted.',99);

add('nested-almost-again','John almost won again.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','win',[['agent','a1']],'asserted',{tense:'past',operators:[{id:'o1',type:'iteration',value:'again',scope:'f1'},{id:'o2',type:'approximation',value:'almost',scope:'o1',entails_occurrence:false}],operator_root:'o2'})];
 ir.presuppositions=[{type:'prior_occurrence',target:'f1'}];
},'Operator nesting preserves almost(again(win)): prior win is presupposed, current repeated win is not entailed.');

add('at-least-cardinality','At least three students passed.',ir=>{
 ir.entities=[E('a1','At least three students','student','person',{definiteness:'generic',quantifier:{kind:'at_least',value:3}})];
 ir.frames=[F('f1','event','pass',[['agent','a1']],'asserted',{tense:'past'})];
 ir.quantifier_scopes=[{entity:'a1',kind:'at_least',scope:'f1',order:1,semantics:'cardinality_lower_bound'}];
},'Lower-bound cardinality is distinct from exact cardinality.');

add('at-most-cardinality','At most three students passed.',ir=>{
 ir.entities=[E('a1','At most three students','student','person',{definiteness:'generic',quantifier:{kind:'at_most',value:3}})];
 ir.frames=[F('f1','event','pass',[['agent','a1']],'asserted',{tense:'past'})];
 ir.quantifier_scopes=[{entity:'a1',kind:'at_most',scope:'f1',order:1,semantics:'cardinality_upper_bound'}];
},'Upper-bound cardinality is represented explicitly.');

add('epistemic-perfect','John may have left.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','leave',[['agent','a1']],'asserted',{tense:'past',aspect:'perfect',operators:[{id:'o1',type:'epistemic',value:'possible',scope:'f1'}],operator_root:'o1'})];
},'Epistemic possibility scopes over a perfect/past departure.');

add('epistemic-must','John must have left.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','leave',[['agent','a1']],'asserted',{tense:'past',aspect:'perfect',operators:[{id:'o1',type:'epistemic',value:'necessary',scope:'f1'}],operator_root:'o1'})];
},'Epistemic necessity is distinguished from deontic obligation.');

add('dynamic-ability','John can swim.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','swim',[['agent','a1']],'asserted',{operators:[{id:'o1',type:'dynamic',value:'capable',target:'a1',scope:'f1'}],operator_root:'o1'})];
},'Dynamic ability is distinct from permission and epistemic possibility.');

add('permission','John is allowed to leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','leave',[['agent','a1']],'asserted',{operators:[{id:'o1',type:'deontic',value:'permitted',scope:'f1'}],operator_root:'o1'})];
},'Permission is represented as deontic modality.');

add('condition-epistemic','If John comes, Mary might leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('f1','event','come',[['agent','a1']],'hypothetical'),F('f2','event','leave',[['agent','a2']],'conditional',{operators:[{id:'o1',type:'epistemic',value:'possible',scope:'f2'}],operator_root:'o1'})];
 ir.relations=[{type:'condition',from:'f1',to:'f2',mood:'open'}];
},'Conditional scope and epistemic possibility in the consequent are independent and explicit.');

add('unless-negation','Unless John calls, Mary will not leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('f1','event','call',[['agent','a1']],'hypothetical'),F('f2','event','leave',[['agent','a2']],'conditional',{operators:[{id:'o1',type:'negation',scope:'f2'}],operator_root:'o1'})];
 ir.relations=[{type:'unless',from:'f2',to:'f1',semantics:'exception_condition'}];
 ir.logical_scope=[{type:'unless',main:{type:'negation',frame:'f2'},exception:'f1'}];
},'Negated consequent remains inside the unless structure.');

add('object-control','John told Mary to leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('f1','event','tell',[['agent','a1'],['recipient','a2'],['content','f2']],'asserted',{tense:'past'}),F('f2','event','leave',[['agent','a2']],'requested',{source:'John'})];
 ir.relations=[{type:'content',from:'f2',to:'f1',semantics:'object_control'}];
},'Object control correctly assigns Mary, not John, as the leaver.');

add('subject-control','John promised Mary to leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('f1','event','promise',[['agent','a1'],['recipient','a2'],['content','f2']],'asserted',{tense:'past'}),F('f2','event','leave',[['agent','a1']],'promised',{source:'John'})];
 ir.relations=[{type:'content',from:'f2',to:'f1',semantics:'subject_control'}];
},'Subject control correctly assigns John as the promised leaver.');

add('inchoative','The door opened.',ir=>{
 ir.entities=[E('a1','The door','door')];
 ir.frames=[F('f1','event','open',[['theme','a1']],'asserted',{tense:'past'})];
},'No external agent is invented for an inchoative event.');

add('deliberate-negation','John deliberately did not answer.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'})];
 ir.frames=[F('f1','event','answer',[['agent','a1']],'asserted',{tense:'past',operators:[{id:'o1',type:'negation',scope:'f1'},{id:'o2',type:'volitional',value:'deliberate',scope:'o1'}],operator_root:'o2'})];
},'Deliberateness scopes over the intentional non-answering, not over a positive answering event.');

add('nonrestrictive-relative','Alice, who lives in Paris, won.',ir=>{
 ir.entities=[E('a1','Alice','person','person',{name:'Alice'}),E('a2','Paris','place','place',{name:'Paris'})];
 ir.frames=[F('f1','state','live',[['theme','a1'],['location','a2']],'asserted'),F('f2','event','win',[['agent','a1']],'asserted',{tense:'past'})];
 ir.entity_relations=[{type:'supplement',modifier:'f1',head:'a1',semantics:'nonrestrictive_relative_clause'}];
},'The nonrestrictive relative is a supplementary assertion, not a restrictor used to identify Alice.');

add('belief-quantifier','John believes every student passed.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','every student','student','person',{definiteness:'generic',quantifier:{kind:'all'}})];
 ir.frames=[F('f1','event','believe',[['experiencer','a1'],['content','f2']]),F('f2','event','pass',[['agent','a2']],'believed',{source:'John',tense:'past'})];
 ir.relations=[{type:'content',from:'f2',to:'f1'}];
 ir.quantifier_scopes=[{entity:'a2',kind:'all',scope:'f2',order:1,distributivity:'distributive'}];
},'Universal quantification stays inside the belief content and is not lifted to speaker commitment.');

add('want-control','John wants Mary to leave.',ir=>{
 ir.entities=[E('a1','John','person','person',{name:'John'}),E('a2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('f1','state','want',[['experiencer','a1'],['content','f2']]),F('f2','event','leave',[['agent','a2']],'desired',{source:'John'})];
 ir.relations=[{type:'content',from:'f2',to:'f1',semantics:'desire_content'}];
},'Desire and desired event are separate; Mary leaving is not asserted.');
