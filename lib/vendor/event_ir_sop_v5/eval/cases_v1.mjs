const E=(id,surface,head,type='object',extra={})=>({id,surface,head,type,name:null,definiteness:'definite',quantifier:null,properties:[],coreference:null,...extra});
const F=(id,kind,predicate,args,status='asserted',extra={})=>({id,kind,predicate,arguments:args.map(([role,ref])=>({role,ref})),operators:[],operator_root:null,tense:'unknown',aspect:'simple',time:[],location:[],manner:[],status,source:'speaker',...extra});
const base=(id,text,form='declarative',speech_act='assert')=>({sentence_id:id,text,form,speech_act,entities:[],frames:[],relations:[],question:null,missing:[],ambiguities:[],unmapped:[]});

export const cases=[];
function add(name,text,build,judge){const ir=base(`s${cases.length+1}`,text); build(ir); cases.push({name,text,ir,judge});}

add('simple-active','John opened the door.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the door','door')];
 ir.frames=[F('e1','event','open',[['agent','x1'],['theme','x2']], 'asserted',{tense:'past'})];
},{score:100,note:'Exact core event and roles.'});

add('passive','The door was opened by John.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the door','door')];
 ir.frames=[F('e1','event','open',[['agent','x1'],['theme','x2']], 'asserted',{tense:'past'})];
},{score:100,note:'Normalizes passive to same semantic roles.'});

add('state','Mary is tired.',ir=>{
 ir.entities=[E('x1','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','state','tired',[['experiencer','x1']], 'asserted',{tense:'present'})];
},{score:100,note:'Simple state preserved.'});

add('ditransitive','John sent Mary the document by email.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'}),E('x3','the document','document','information'),E('x4','email','email','information')];
 ir.frames=[F('e1','event','send',[['agent','x1'],['theme','x3'],['recipient','x2'],['instrument','x4']], 'asserted',{tense:'past'})];
},{score:99,note:'Roles preserved; email as instrument is acceptable.'});

add('negation','John did not leave.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']], 'asserted',{tense:'past',operators:[{id:'o1',type:'negation',scope:'e1'}],operator_root:'o1'})];
},{score:100,note:'Negation scope preserved.'});

add('must-not','John must not leave.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']], 'asserted',{operators:[{id:'o1',type:'negation',scope:'e1'},{id:'o2',type:'deontic',value:'required',scope:'o1'}],operator_root:'o2'})];
},{score:100,note:'MUST(NOT(leave)).'});

add('not-required','John does not have to leave.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']], 'asserted',{operators:[{id:'o1',type:'deontic',value:'required',scope:'e1'},{id:'o2',type:'negation',scope:'o1'}],operator_root:'o2'})];
},{score:100,note:'NOT(MUST(leave)); distinguishes previous case.'});

add('probable-negation','John probably did not leave.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']], 'asserted',{tense:'past',operators:[{id:'o1',type:'negation',scope:'e1'},{id:'o2',type:'epistemic',value:'probable',scope:'o1'}],operator_root:'o2'})];
},{score:100,note:'Probability scopes over negation.'});

add('conditional','If John arrives, Mary will leave.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','event','arrive',[['agent','x1']],'hypothetical',{tense:'future'}),F('e2','event','leave',[['agent','x2']],'conditional',{tense:'future'})];
 ir.relations=[{type:'condition',from:'e1',to:'e2'}];
},{score:98,note:'Meaning preserved; future in protasis is surface-normalized.'});

add('unless','Mary will leave unless John calls.',ir=>{
 ir.entities=[E('x1','Mary','person','person',{name:'Mary'}),E('x2','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']],'conditional',{tense:'future'}),F('e2','event','call',[['agent','x2']],'hypothetical',{tense:'future'})];
 ir.relations=[{type:'unless',from:'e1',to:'e2'}];
},{score:94,note:'Preserves unless lexically; full truth-conditional normalization remains underspecified.'});

add('cause','John left because Mary arrived.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']],'asserted',{tense:'past'}),F('e2','event','arrive',[['agent','x2']],'asserted',{tense:'past'})];
 ir.relations=[{type:'cause',from:'e2',to:'e1'}];
},{score:100,note:'Causal direction preserved.'});

add('temporal','Mary called before John left.',ir=>{
 ir.entities=[E('x1','Mary','person','person',{name:'Mary'}),E('x2','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','call',[['agent','x1']],'asserted',{tense:'past'}),F('e2','event','leave',[['agent','x2']],'asserted',{tense:'past'})];
 ir.relations=[{type:'before',from:'e1',to:'e2'}];
},{score:100,note:'Temporal ordering preserved.'});

add('belief','John believes Mary left.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','event','believe',[['experiencer','x1'],['content','e2']]),F('e2','event','leave',[['agent','x2']],'believed',{tense:'past',source:'John'})];
 ir.relations=[{type:'content',from:'e2',to:'e1'}];
},{score:99,note:'Embedded proposition not promoted to speaker fact.'});

add('wh-question','Who gave Mary the book?',ir=>{
 ir.form='interrogative'; ir.speech_act='ask';
 ir.entities=[E('xq','who','person','person',{definiteness:'unknown'}),E('x1','Mary','person','person',{name:'Mary'}),E('x2','the book','book')];
 ir.frames=[F('e1','event','give',[['agent','xq'],['theme','x2'],['recipient','x1']],'queried',{tense:'past'})];
 ir.question={type:'wh',target:'xq',expected_type:'person'};
},{score:100,note:'Question represented as incomplete semantic pattern.'});

add('yes-no-question','Did John leave?',ir=>{
 ir.form='interrogative'; ir.speech_act='ask';
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']],'queried',{tense:'past'})];
 ir.question={type:'yes_no',target:'e1',expected_type:'truth-value'};
},{score:100,note:'Not asserted.'});

add('imperative','Close the door.',ir=>{
 ir.form='imperative'; ir.speech_act='command';
 ir.entities=[E('x1','you','person','person',{name:'addressee'}),E('x2','the door','door')];
 ir.frames=[F('e1','event','close',[['agent','x1'],['theme','x2']],'commanded')];
},{score:98,note:'Implicit addressee is licensed by imperative grammar.'});

add('polite-request','Could you please close the door?',ir=>{
 ir.form='interrogative'; ir.speech_act='request';
 ir.entities=[E('x1','you','person','person',{name:'addressee'}),E('x2','the door','door')];
 ir.frames=[F('e1','event','close',[['agent','x1'],['theme','x2']],'requested')];
},{score:96,note:'Illocution preserved; literal ability-question reading intentionally secondary.'});

add('suggestion','You should restart the server.',ir=>{
 ir.speech_act='suggest';
 ir.entities=[E('x1','you','person','person',{name:'addressee'}),E('x2','the server','server')];
 ir.frames=[F('e1','event','restart',[['agent','x1'],['theme','x2']],'suggested')];
},{score:96,note:'Captures recommendation but collapses deontic/epistemic nuances of should.'});

add('universal-quantifier','Every student submitted an assignment.',ir=>{
 ir.entities=[E('x1','Every student','student','person',{definiteness:'generic',quantifier:{kind:'all'}}),E('x2','an assignment','assignment','information',{definiteness:'indefinite',quantifier:{kind:'some'}})];
 ir.frames=[F('e1','event','submit',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'})];
},{score:88,note:'Surface quantifiers preserved but variable binding/scope is not fully formal.'});

add('negative-quantifier','No student passed the exam.',ir=>{
 ir.entities=[E('x1','No student','student','person',{definiteness:'generic',quantifier:{kind:'none'}}),E('x2','the exam','exam')];
 ir.frames=[F('e1','event','pass',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'})];
},{score:82,note:'CNL preserves wording, but quantifier semantics is not compositionally executable yet.'});

add('exact-cardinality','Exactly three old red cars stopped.',ir=>{
 ir.entities=[E('x1','Exactly three old red cars','car','object',{definiteness:'indefinite',quantifier:{kind:'exact',value:3},properties:[{predicate:'old'},{predicate:'red'}]})];
 ir.frames=[F('e1','event','stop',[['agent','x1']],'asserted',{tense:'past'})];
},{score:97,note:'Cardinality and modifiers preserved.'});

add('comparison','Alice is taller than Bob.',ir=>{
 ir.entities=[E('x1','Alice','person','person',{name:'Alice'}),E('x2','Bob','person','person',{name:'Bob'})];
 ir.frames=[F('e1','comparison','taller',[['theme','x1'],['standard','x2']])];
},{score:98,note:'Comparison preserved; adjective normalization could be better.'});

add('relative-clause','The scientist who discovered the comet won the prize.',ir=>{
 ir.entities=[E('x1','the scientist','scientist','person'),E('x2','the comet','comet'),E('x3','the prize','prize')];
 ir.frames=[F('e1','event','discover',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'}),F('e2','event','win',[['agent','x1'],['theme','x3']],'asserted',{tense:'past'})];
 ir.relations=[{type:'elaboration',from:'e1',to:'e2'}];
},{score:92,note:'Coreference is right; elaboration relation is only approximate for restrictive relative clause.'});

add('coreference-clear','John entered the room. He sat down.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the room','room')];
 ir.frames=[F('e1','event','enter',[['agent','x1'],['destination','x2']],'asserted',{tense:'past'}),F('e2','event','sit',[['agent','x1']],'asserted',{tense:'past',manner:[{value:'down'}]})];
},{score:99,note:'Clear pronoun resolved.'});

add('coreference-ambiguous','John told Peter that he was late.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Peter','person','person',{name:'Peter'}),E('x3','he','person','person',{definiteness:'pronoun'})];
 ir.frames=[F('e1','event','tell',[['agent','x1'],['recipient','x2'],['content','e2']],'asserted',{tense:'past'}),F('e2','state','late',[['experiencer','x3']],'reported',{source:'John'})];
 ir.relations=[{type:'content',from:'e2',to:'e1'}];
 ir.ambiguities=[{span:'he',type:'coreference',options:['x1','x2'],preferred:null}];
},{score:100,note:'Ambiguity preserved instead of guessed.'});

add('pp-attachment','John saw the man with the telescope.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the man','man','person'),E('x3','the telescope','telescope')];
 ir.frames=[F('e1','event','see',[['experiencer','x1'],['theme','x2']],'asserted',{tense:'past'})];
 ir.ambiguities=[{span:'with the telescope',type:'attachment',options:['instrument_of:e1','modifier_of:x2'],preferred:null}];
},{score:100,note:'Correctly refuses to guess attachment.'});

add('fragment','Probably tomorrow.',ir=>{
 ir.form='fragment'; ir.speech_act='other';
 ir.unmapped=['Probably tomorrow'];
},{score:55,note:'Correctly flags insufficient propositional structure; representation needs discourse-context attachment.'});

add('coordination','John opened the door and entered the room.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the door','door'),E('x3','the room','room')];
 ir.frames=[F('e1','event','open',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'}),F('e2','event','enter',[['agent','x1'],['destination','x3']],'asserted',{tense:'past'})];
 ir.relations=[{type:'conjunction',from:'e1',to:'e2'}];
},{score:100,note:'Two atomic events.'});

add('nested-condition-modal','If the server fails, the admin must not delete the logs unless a backup exists.',ir=>{
 ir.entities=[E('x1','the server','server'),E('x2','the admin','admin','person'),E('x3','the logs','log','information'),E('x4','a backup','backup','information',{definiteness:'indefinite'})];
 ir.frames=[
  F('e1','event','fail',[['agent','x1']],'hypothetical'),
  F('e2','event','delete',[['agent','x2'],['theme','x3']],'conditional',{operators:[{id:'o1',type:'negation',scope:'e2'},{id:'o2',type:'deontic',value:'required',scope:'o1'}],operator_root:'o2'}),
  F('e3','existence','exist',[['theme','x4']],'hypothetical')
 ];
 ir.relations=[{type:'condition',from:'e1',to:'e2'},{type:'unless',from:'e2',to:'e3'}];
},{score:91,note:'Main structure is preserved; interaction between outer condition and unless needs formal scope semantics.'});

add('focus-only','Only Alice approved the proposal.',ir=>{
 ir.entities=[E('x1','Alice','person','person',{name:'Alice'}),E('x2','the proposal','proposal','information')];
 ir.frames=[F('e1','event','approve',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'})];
 ir.unmapped=['Only'];
},{score:62,note:'Core event survives, but exclusivity/focus is lost. Schema needs focus/exhaustivity.'});

add('almost','John almost fell.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','fall',[['agent','x1']],'asserted',{tense:'past'})];
 ir.unmapped=['almost'];
},{score:60,note:'Critical non-occurrence/near-event meaning is lost. Needs event-phase/approximation operator.'});

add('stop-presupposition','John stopped smoking.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','stop',[['agent','x1'],['content','e2']],'asserted',{tense:'past'}),F('e2','event','smoke',[['agent','x1']],'asserted')];
 ir.unmapped=['presupposition: John smoked before the stopping point'];
},{score:68,note:'Naive frame risks asserting current smoking; schema needs phase change and presupposition.'});

add('again','Mary missed the train again.',ir=>{
 ir.entities=[E('x1','Mary','person','person',{name:'Mary'}),E('x2','the train','train')];
 ir.frames=[F('e1','event','miss',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'})];
 ir.unmapped=['again'];
},{score:72,note:'Repeated-event presupposition missing.'});

add('even-focus','Even John passed.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'})];
 ir.frames=[F('e1','event','pass',[['agent','x1']],'asserted',{tense:'past'})];
 ir.unmapped=['Even'];
},{score:65,note:'Scalar focus/conventional implicature missing.'});

add('cleft-focus','It was John who broke the vase.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the vase','vase')];
 ir.frames=[F('e1','event','break',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'})];
 ir.unmapped=['cleft focus/exhaustivity'];
},{score:78,note:'Truth-conditional core is good, focus information lost.'});

add('disjunction','Alice will call or Bob will email.',ir=>{
 ir.entities=[E('x1','Alice','person','person',{name:'Alice'}),E('x2','Bob','person','person',{name:'Bob'})];
 ir.frames=[F('e1','event','call',[['agent','x1']],'asserted',{tense:'future'}),F('e2','event','email',[['agent','x2']],'asserted',{tense:'future'})];
 ir.relations=[{type:'disjunction',from:'e1',to:'e2'}];
},{score:90,note:'Disjunction relation preserved, but individual frames should not be marked asserted independently.'});

add('purpose','John opened the window to cool the room.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','the window','window'),E('x3','the room','room')];
 ir.frames=[F('e1','event','open',[['agent','x1'],['theme','x2']],'asserted',{tense:'past'}),F('e2','event','cool',[['agent','x1'],['theme','x3']],'desired')];
 ir.relations=[{type:'purpose',from:'e2',to:'e1'}];
},{score:96,note:'Purpose vs achieved result distinguished.'});

add('promise','John promised Mary that he would call.',ir=>{
 ir.speech_act='assert';
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','event','promise',[['agent','x1'],['recipient','x2'],['content','e2']],'asserted',{tense:'past'}),F('e2','event','call',[['agent','x1']],'promised',{source:'John',tense:'future'})];
 ir.relations=[{type:'content',from:'e2',to:'e1'}];
},{score:99,note:'Promise content is not promoted to fact.'});

add('counterfactual','If John had left, Mary would have called.',ir=>{
 ir.entities=[E('x1','John','person','person',{name:'John'}),E('x2','Mary','person','person',{name:'Mary'})];
 ir.frames=[F('e1','event','leave',[['agent','x1']],'hypothetical',{tense:'past',aspect:'perfect'}),F('e2','event','call',[['agent','x2']],'conditional',{tense:'past',aspect:'perfect'})];
 ir.relations=[{type:'condition',from:'e1',to:'e2'}];
 ir.unmapped=['counterfactual mood'];
},{score:76,note:'Condition preserved, but counterfactuality vs open condition is lost. Need mood/irrealis.'});
