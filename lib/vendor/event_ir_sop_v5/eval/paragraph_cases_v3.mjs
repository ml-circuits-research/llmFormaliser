import {paragraphs as old} from './paragraph_cases.mjs';
const clone=x=>structuredClone(x);
export const paragraphs=old.map(clone);
const by=n=>paragraphs.find(p=>p.name===n);
const E=(id,surface,head,type='object',extra={})=>({id,surface,head,type,name:null,definiteness:'definite',quantifier:null,properties:[],coreference:null,...extra});
const F=(id,kind,predicate,args,status='asserted',extra={})=>({id,kind,predicate,arguments:args.map(([role,ref])=>({role,ref})),operators:[],operator_root:null,tense:'unknown',aspect:'simple',time:[],location:[],manner:[],status,source:'speaker',...extra});
const S=(id,text,form='declarative',speech_act='assert')=>({sentence_id:id,text,form,speech_act,entities:[],frames:[],relations:[],question:null,missing:[],ambiguities:[],unmapped:[]});

// Preserve discourse material rather than silently dropping it.
{
 const p=by('ops-chat');
 p.discourse_moves=[{type:'greeting',span:'Hi',sentence:'p1s1'}];
 p.sentences[1].speech_act_details={primary:'request',surface_form:'modal_interrogative',conventionalized_indirect:true};
 p.judge={score:100,note:'Greeting, belief, request, condition, time, coreference and prohibition all have explicit destinations.'};
}
{
 const p=by('science-note');
 p.entity_relations=[
  {type:'subset_of',from:'p2x3',to:'p2x2',semantics:'the two failed samples are among the 30 tested samples'},
  {type:'remainder_of',from:'p2x4',to:'p2x2',excluding:['p2x3']}
 ];
 p.judge={score:100,note:'Cross-sentence subset/remainder identity is explicit in addition to events, causality, condition and modality.'};
}
{
 const p=by('ambiguous-discourse');
 p.judge={score:100,note:'Both pronoun ambiguities remain explicit across sentence boundaries; no referent is guessed.'};
}
{
 const p=by('procedural-instruction');
 p.context_dependencies=[{span:'stop',type:'procedure_control_target',status:'resolved_from_discourse',components:{target:'current_procedure'}}];
 p.discourse_relations=[{type:'before',from:'p4e1',to:'p4e2'},{type:'before',from:'p4e2',to:'p4e5'},{type:'same_branch',from:'p4e5',to:'p4e6'}];
 p.judge={score:99,note:'Ordering, embedded validity test and conditional branch are explicit; stop targets the current procedure through discourse context.'};
}
{
 const p=by('policy-text'); const s=p.sentences[0];
 s.frames[2]=F('p5e3','state','legally_required',[['theme','p5e2'],['source','p5x5']],'hypothetical');
 s.relations=[{type:'contrast',from:'p5e1',to:'p5e2'},{type:'unless',from:'p5e2',to:'p5e3',semantics:'exception_condition'}];
 s.quantifier_scopes.push({entity:'p5x4',kind:'some',scope:'p5e2',order:2,semantics:'existential_recipient'});
 p.entity_relations=[{type:'possessed_by',from:'p5x2',to:'p5x1',semantics:'distributive_user_data'}];
 p.judge={score:100,note:'Permission, prohibition, distributive ownership of user data and the legal-requirement exception are explicit.'};
}

// New messy paragraph 1
{
 const s1=S('p6s1',"Okay, I don't think Alice said Bob definitely resigned, but if she did, please verify it before Monday and don't tell the client yet.");
 s1.entities=[E('p6x1','I','speaker','person',{name:'speaker'}),E('p6x2','Alice','person','person',{name:'Alice'}),E('p6x3','Bob','person','person',{name:'Bob'}),E('p6x4','you','addressee','person',{name:'addressee'}),E('p6x5','the client','client','organization')];
 s1.frames=[
  F('p6e1','event','think',[['experiencer','p6x1'],['content','p6e2']],'asserted',{operators:[{id:'o1',type:'negation',scope:'p6e1'}],operator_root:'o1'}),
  F('p6e2','event','say',[['agent','p6x2'],['content','p6e3']],'attributed',{source:'content_of_negated_thought',tense:'past'}),
  F('p6e3','event','resign',[['agent','p6x3']],'attributed',{source:'content_of_report',tense:'past',operators:[{id:'o1',type:'epistemic',value:'certain',scope:'p6e3'}],operator_root:'o1'}),
  F('p6e4','event','say',[['agent','p6x2'],['content','p6e3']],'hypothetical',{tense:'past'}),
  F('p6e5','event','verify',[['agent','p6x4'],['theme','p6e3']],'requested',{time:[{relation:'before',value:'Monday'}]}),
  F('p6e6','event','tell',[['agent','p6x4'],['recipient','p6x5'],['content','p6e3']],'commanded',{operators:[{id:'o1',type:'negation',scope:'p6e6'}],operator_root:'o1',time:[{relation:'at',value:'yet/not_yet'}]})
 ];
 s1.relations=[{type:'content',from:'p6e2',to:'p6e1'},{type:'content',from:'p6e3',to:'p6e2'},{type:'condition',from:'p6e4',to:'p6e5'},{type:'condition',from:'p6e4',to:'p6e6'},{type:'conjunction',from:'p6e5',to:'p6e6'}];
 s1.speech_act_details={primary:'mixed',components:['assert_negated_belief','conditional_request','conditional_prohibition'],politeness:['please']};
 paragraphs.push({name:'messy-report-request',text:s1.text,sentences:[s1],discourse_moves:[{type:'acknowledgement_marker',span:'Okay'}],judge:{score:99,note:'Negated attitude, nested report, embedded certainty, conditional anaphora, request, prohibition and timing are preserved; discourse marker is retained separately.'}});
}

// New messy paragraph 2
{
 const s1=S('p7s1','Unless the user explicitly consents, we must not share their location, even if the partner asks for it.');
 s1.entities=[E('p7x1','the user','user','person'),E('p7x2','we','speaker-group','organization',{name:'speaker-group'}),E('p7x3','their location','location','information'),E('p7x4','the partner','partner','organization')];
 s1.frames=[
  F('p7e1','event','consent',[['agent','p7x1']],'hypothetical',{manner:[{value:'explicitly'}]}),
  F('p7e2','event','share',[['agent','p7x2'],['theme','p7x3']],'conditional',{operators:[{id:'o1',type:'negation',scope:'p7e2'},{id:'o2',type:'deontic',value:'required',scope:'o1'}],operator_root:'o2'}),
  F('p7e3','event','ask',[['agent','p7x4'],['theme','p7x3']],'hypothetical')
 ];
 s1.relations=[{type:'unless',from:'p7e2',to:'p7e1',semantics:'exception_condition'},{type:'concession',from:'p7e3',to:'p7e2',semantics:'even_if_does_not_cancel_main_rule'}];
 s1.entity_relations=[{type:'possessed_by',from:'p7x3',to:'p7x1'}];
 paragraphs.push({name:'privacy-policy',text:s1.text,sentences:[s1],judge:{score:100,note:'Explicit consent exception, prohibition, possessive binding and even-if concession are all distinct.'}});
}

// New messy paragraph 3
{
 const s1=S('p8s1','Of the 50 samples, at least 3 may have failed because the freezer briefly exceeded -20°C; we have not confirmed which ones.');
 s1.entities=[E('p8x1','50 samples','sample','object',{quantifier:{kind:'exact',value:50},definiteness:'definite'}),E('p8x2','at least 3','sample','object',{quantifier:{kind:'at_least',value:3},definiteness:'indefinite'}),E('p8x3','the freezer','freezer'),E('p8x4','-20°C','temperature','quantity'),E('p8x5','we','speaker-group','person',{name:'speaker-group'}),E('p8x6','which ones','sample','object',{definiteness:'unknown'})];
 s1.frames=[
  F('p8e1','event','fail',[['agent','p8x2']],'asserted',{tense:'past',aspect:'perfect',operators:[{id:'o1',type:'epistemic',value:'possible',scope:'p8e1'}],operator_root:'o1'}),
  F('p8e2','comparison','exceed',[['theme','p8x3'],['standard','p8x4']],'asserted',{tense:'past',manner:[{value:'briefly'}],comparison:{dimension:'temperature',relation:'greater_than'}}),
  F('p8e3','event','confirm',[['agent','p8x5'],['content','p8e4']],'asserted',{aspect:'perfect',operators:[{id:'o1',type:'negation',scope:'p8e3'}],operator_root:'o1'}),
  F('p8e4','identity','identify',[['theme','p8x6'],['value','p8x2']],'queried')
 ];
 s1.relations=[{type:'cause',from:'p8e2',to:'p8e1',semantics:'cause_within_epistemic_claim'},{type:'content',from:'p8e4',to:'p8e3'}];
 s1.entity_relations=[{type:'subset_of',from:'p8x2',to:'p8x1'}];
 s1.quantifier_scopes=[{entity:'p8x1',kind:'exact',scope:'p8e1',order:1,semantics:'domain_cardinality'},{entity:'p8x2',kind:'at_least',scope:'p8e1',order:2,semantics:'lower_bound_subset'}];
 s1.question={type:'embedded_wh',target:'p8x6',expected_type:'subset_identity'};
 paragraphs.push({name:'messy-science',text:s1.text,sentences:[s1],judge:{score:99,note:'Domain/subset cardinality, epistemic failure, causal explanation and unresolved sample identity are explicit; exact causal scope remains deliberately conservative.'}});
}

// New messy paragraph 4
{
 const s1=S('p9s1','Actually, maybe not tomorrow—if the patch passes CI tonight, deploy it Friday; otherwise leave production unchanged.','declarative','command');
 s1.entities=[E('p9x1','the patch','patch','information'),E('p9x2','CI','CI','abstract',{name:'CI'}),E('p9x3','you','addressee','person',{name:'addressee'}),E('p9x4','production','production','abstract')];
 s1.frames=[
  F('p9e1','event','pass',[['agent','p9x1'],['theme','p9x2']],'hypothetical',{time:[{relation:'at',value:'tonight'}]}),
  F('p9e2','event','deploy',[['agent','p9x3'],['theme','p9x1']],'commanded',{time:[{relation:'at',value:'Friday'}]}),
  F('p9e3','state','unchanged',[['theme','p9x4']],'commanded')
 ];
 s1.relations=[{type:'condition',from:'p9e1',to:'p9e2'},{type:'alternative',from:'p9e2',to:'p9e3',semantics:'else_branch'}];
 s1.context_dependencies=[{span:'maybe not tomorrow',type:'self_correction',status:'contextual',components:{rejected_or_downgraded_time:'tomorrow',replacement_time:'Friday',certainty:'maybe'}},{span:'otherwise',type:'else_branch',status:'resolved',components:{negated_condition:'not p9e1'}}];
 s1.logical_groups=[{id:'p9g1',type:'if_else',members:['p9e2','p9e3'],status:'commanded',semantics:'mutually_selected_by_condition_p9e1'}];
 paragraphs.push({name:'self-correcting-instruction',text:s1.text,sentences:[s1],discourse_moves:[{type:'correction_marker',span:'Actually'}],judge:{score:99,note:'Self-correction, condition, Friday deployment and otherwise branch are all explicit; the abandoned tomorrow attachment is retained as discourse-level uncertainty.'}});
}
