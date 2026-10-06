const E=(id,surface,head,type='object',extra={})=>({id,surface,head,type,name:null,definiteness:'definite',quantifier:null,properties:[],coreference:null,...extra});
const F=(id,kind,predicate,args,status='asserted',extra={})=>({id,kind,predicate,arguments:args.map(([role,ref])=>({role,ref})),operators:[],operator_root:null,tense:'unknown',aspect:'simple',time:[],location:[],manner:[],status,source:'speaker',...extra});
const S=(id,text,form='declarative',speech_act='assert')=>({sentence_id:id,text,form,speech_act,entities:[],frames:[],relations:[],question:null,missing:[],ambiguities:[],unmapped:[]});
export const paragraphs=[];

{
 const s1=S('p1s1','Hi, I think the server is unstable.');
 s1.entities=[E('p1x1','I','speaker','person',{name:'speaker'}),E('p1x2','the server','server')];
 s1.frames=[F('p1e1','event','think',[['experiencer','p1x1'],['content','p1e2']]),F('p1e2','state','unstable',[['theme','p1x2']],'believed',{source:'speaker'})];
 s1.relations=[{type:'content',from:'p1e2',to:'p1e1'}];
 const s2=S('p1s2','Could you restart it tomorrow morning if traffic is low?','interrogative','request');
 s2.entities=[E('p1x3','you','addressee','person',{name:'addressee'}),E('p1x2','it','server','object',{coreference:'p1x2'}),E('p1x4','traffic','traffic','abstract')];
 s2.frames=[F('p1e3','event','restart',[['agent','p1x3'],['theme','p1x2']],'requested',{time:[{relation:'at',value:'tomorrow morning'}]}),F('p1e4','state','low',[['theme','p1x4']],'hypothetical')];
 s2.relations=[{type:'condition',from:'p1e4',to:'p1e3'}];
 const s3=S('p1s3',"Don't delete the logs.",'imperative','command');
 s3.entities=[E('p1x3','you','addressee','person',{name:'addressee'}),E('p1x5','the logs','log','information')];
 s3.frames=[F('p1e5','event','delete',[['agent','p1x3'],['theme','p1x5']],'commanded',{operators:[{id:'o1',type:'negation',scope:'p1e5'}],operator_root:'o1'})];
 paragraphs.push({name:'ops-chat',text:'Hi, I think the server is unstable. Could you restart it tomorrow morning if traffic is low? Don\'t delete the logs.',sentences:[s1,s2,s3],judge:{score:97,note:'Belief, request, condition, time, coreference and prohibition survive. Greeting is treated as discourse fluff.'}});
}

{
 const s1=S('p2s1','We tested 30 samples.');
 s1.entities=[E('p2x1','We','group','person',{name:'speaker-group'}),E('p2x2','30 samples','sample','object',{quantifier:{kind:'exact',value:30},definiteness:'indefinite'})];
 s1.frames=[F('p2e1','event','test',[['agent','p2x1'],['theme','p2x2']],'asserted',{tense:'past'})];
 const s2=S('p2s2','Two failed QC, so we excluded them.');
 s2.entities=[E('p2x3','Two','sample','object',{quantifier:{kind:'exact',value:2},definiteness:'indefinite'}),E('p2x1','we','group','person',{name:'speaker-group'})];
 s2.frames=[F('p2e2','event','fail',[['agent','p2x3']],'asserted',{tense:'past'}),F('p2e3','event','exclude',[['agent','p2x1'],['theme','p2x3']],'asserted',{tense:'past'})];
 s2.relations=[{type:'cause',from:'p2e2',to:'p2e3'}];
 const s3=S('p2s3','If the remaining results replicate, we may publish next month.');
 s3.entities=[E('p2x4','the remaining results','result','information'),E('p2x1','we','group','person',{name:'speaker-group'})];
 s3.frames=[F('p2e4','event','replicate',[['theme','p2x4']],'hypothetical'),F('p2e5','event','publish',[['agent','p2x1']],'conditional',{time:[{relation:'at',value:'next month'}],operators:[{id:'o1',type:'epistemic',value:'possible',scope:'p2e5'}],operator_root:'o1'})];
 s3.relations=[{type:'condition',from:'p2e4',to:'p2e5'}];
 paragraphs.push({name:'science-note',text:'We tested 30 samples. Two failed QC, so we excluded them. If the remaining results replicate, we may publish next month.',sentences:[s1,s2,s3],judge:{score:96,note:'Good event structure; subset relation between the two failed samples and the original 30 should be an explicit discourse/entity relation in a fuller IR.'}});
}

{
 const s1=S('p3s1','John told Peter that he should leave after the meeting.');
 s1.entities=[E('p3x1','John','person','person',{name:'John'}),E('p3x2','Peter','person','person',{name:'Peter'}),E('p3x3','he','person','person',{definiteness:'pronoun'}),E('p3x4','the meeting','meeting','event')];
 s1.frames=[F('p3e1','event','tell',[['agent','p3x1'],['recipient','p3x2'],['content','p3e2']],'asserted',{tense:'past'}),F('p3e2','event','leave',[['agent','p3x3']],'reported',{source:'John',time:[{relation:'after',value:'the meeting'}],operators:[{id:'o1',type:'deontic',value:'recommended',scope:'p3e2'}],operator_root:'o1'})];
 s1.relations=[{type:'content',from:'p3e2',to:'p3e1'}];
 s1.ambiguities=[{span:'he',type:'coreference',options:['p3x1','p3x2'],preferred:null}];
 const s2=S('p3s2','He sounded upset.');
 s2.entities=[E('p3x5','He','person','person',{definiteness:'pronoun'})];
 s2.frames=[F('p3e3','state','upset',[['experiencer','p3x5']],'asserted',{tense:'past'})];
 s2.ambiguities=[{span:'He',type:'coreference',options:['p3x1','p3x2'],preferred:null}];
 paragraphs.push({name:'ambiguous-discourse',text:'John told Peter that he should leave after the meeting. He sounded upset.',sentences:[s1,s2],judge:{score:99,note:'Crucially, it preserves both cross-sentence ambiguities instead of forcing a referent.'}});
}

{
 const s1=S('p4s1','First, open the file.','imperative','command');
 s1.entities=[E('p4x1','you','addressee','person',{name:'addressee'}),E('p4x2','the file','file','information')];
 s1.frames=[F('p4e1','event','open',[['agent','p4x1'],['theme','p4x2']],'commanded')];
 const s2=S('p4s2','Then check whether the signature is valid.','imperative','command');
 s2.entities=[E('p4x1','you','addressee','person',{name:'addressee'}),E('p4x3','the signature','signature','information')];
 s2.frames=[F('p4e2','event','check',[['agent','p4x1'],['content','p4e3']],'commanded'),F('p4e3','state','valid',[['theme','p4x3']],'queried')];
 s2.relations=[{type:'content',from:'p4e3',to:'p4e2'}];
 const s3=S('p4s3','If it is not, stop and report an error.','imperative','command');
 s3.entities=[E('p4x3','it','signature','information',{coreference:'p4x3'}),E('p4x1','you','addressee','person',{name:'addressee'}),E('p4x4','an error','error','information',{definiteness:'indefinite'})];
 s3.frames=[F('p4e4','state','valid',[['theme','p4x3']],'hypothetical',{operators:[{id:'o1',type:'negation',scope:'p4e4'}],operator_root:'o1'}),F('p4e5','event','stop',[['agent','p4x1']],'commanded'),F('p4e6','event','report',[['agent','p4x1'],['theme','p4x4']],'commanded')];
 s3.relations=[{type:'condition',from:'p4e4',to:'p4e5'},{type:'condition',from:'p4e4',to:'p4e6'},{type:'conjunction',from:'p4e5',to:'p4e6'}];
 paragraphs.push({name:'procedural-instruction',text:'First, open the file. Then check whether the signature is valid. If it is not, stop and report an error.',sentences:[s1,s2,s3],discourse_relations:[{type:'before',from:'p4e1',to:'p4e2'},{type:'before',from:'p4e2',to:'p4e5'}],judge:{score:96,note:'Commands, embedded check proposition and conditional branch are preserved. Explicit sequencing requires document-level discourse relations.'}});
}

{
 const s1=S('p5s1','Users may export their data, but administrators must not disclose it to third parties unless required by law.');
 s1.entities=[E('p5x1','Users','user','person',{quantifier:{kind:'all'},definiteness:'generic'}),E('p5x2','their data','data','information'),E('p5x3','administrators','administrator','person',{quantifier:{kind:'all'},definiteness:'generic'}),E('p5x4','third parties','third party','organization',{quantifier:{kind:'some'},definiteness:'generic'}),E('p5x5','law','law','abstract')];
 s1.frames=[
  F('p5e1','event','export',[['agent','p5x1'],['theme','p5x2']],'asserted',{operators:[{id:'o1',type:'deontic',value:'permitted',scope:'p5e1'}],operator_root:'o1'}),
  F('p5e2','event','disclose',[['agent','p5x3'],['theme','p5x2'],['recipient','p5x4']],'asserted',{operators:[{id:'o1',type:'negation',scope:'p5e2'},{id:'o2',type:'deontic',value:'required',scope:'o1'}],operator_root:'o2'}),
  F('p5e3','event','require',[['agent','p5x5'],['theme','p5e2']],'hypothetical')
 ];
 s1.relations=[{type:'contrast',from:'p5e1',to:'p5e2'},{type:'unless',from:'p5e2',to:'p5e3',semantics:'exception_condition'}];
 s1.quantifier_scopes=[{entity:'p5x1',kind:'all',scope:'p5e1',order:1},{entity:'p5x3',kind:'all',scope:'p5e2',order:1}];
 paragraphs.push({name:'policy-text',text:'Users may export their data, but administrators must not disclose it to third parties unless required by law.',sentences:[s1],judge:{score:95,note:'Permission, prohibition, shared data referent and exception are preserved; `required by law` could use a cleaner impersonal-source representation.'}});
}
