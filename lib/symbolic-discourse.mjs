// New, conservative clause parser. No code or rules imported from other projects.
// Recognized structure is a fallible draft, never a semantic acceptance decision.
const verbForms={
 be:['is','are','am','was','were'],have:['has','have','had'],
 leave:['leave','leaves','left'],run:['run','runs','ran'],arrive:['arrive','arrives','arrived'],
 fail:['fail','fails','failed'],crash:['crash','crashes','crashed'],work:['work','works','worked'],
 send:['send','sends','sent'],receive:['receive','receives','received'],give:['give','gives','gave'],
 approve:['approve','approves','approved'],release:['release','releases','released'],
 read:['read','reads'],write:['write','writes','wrote'],own:['own','owns','owned'],
 buy:['buy','buys','bought'],see:['see','sees','saw','seen'],find:['find','finds','found'],
 open:['open','opens','opened'],close:['close','closes','closed'],help:['help','helps','helped'],
 compare:['compare','compares','compared'],place:['place','places','placed'],
 complete:['complete','completes','completed'],handle:['handle','handles','handled'],
 book:['book','books','booked'],call:['call','calls','called'],cancel:['cancel','cancels','cancelled'],
 say:['say','says','said'],think:['think','thinks','thought'],believe:['believe','believes','believed'],
 know:['know','knows','knew'],report:['report','reports','reported'],ask:['ask','asks','asked']
};
const forms=new Map(Object.entries(verbForms).flatMap(([lemma,vs])=>vs.map(v=>[v,lemma])));
const past=new Set('was were had left ran arrived failed crashed worked sent received gave approved released wrote owned bought saw found opened closed helped compared placed completed handled booked called cancelled said thought believed knew reported asked'.split(' '));
const progressive=new Map(['run','work','read','write','send','receive','give','approve','release','buy','see','open','close','help','compare','place','complete','handle','book','call'].map(v=>[v==='run'?'running':v.endsWith('e')?v.slice(0,-1)+'ing':v+'ing',v]));
const intransitive=new Set(['leave','run','arrive','fail','crash','work']);
const attitudes=new Set(['say','think','believe','know','report','ask']);
const roleLexicon={send:['ag','th'],give:['ag','th'],receive:['rc','th'],see:['xp','th'],know:['xp','ct'],think:['xp','ct'],believe:['xp','ct'],say:['ag','ct'],report:['ag','ct'],ask:['ag','ct'],crash:['th'],fail:['th'],arrive:['th'],run:['ag'],work:['ag'],leave:['ag'],approve:['ag','th'],release:['ag','th'],read:['ag','th'],write:['ag','th'],own:['psr','psd'],buy:['ag','th'],find:['ag','th'],open:['ag','th'],close:['ag','th'],help:['ag','th'],compare:['ag','th'],place:['ag','th'],complete:['ag','th'],handle:['ag','th'],book:['ag','th'],call:['ag','th'],cancel:['ag','th']};
export {roleLexicon};
export function sourceSegments(text){
 const result=[];let start=0;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(!/[.!?\n;]/.test(c))continue;
  if(c==='.'){
   if(/\d/.test(text[i-1]??'')&&/\d/.test(text[i+1]??''))continue;
   if(/(?:\b(?:Mr|Mrs|Ms|Dr|Prof)|\b[ap]|\b[ap]\.m)$/i.test(text.slice(start,i)))continue;
   if(i+1<text.length&&!/\s/.test(text[i+1]))continue;
  }
  if(text.slice(start,i+1).trim())result.push({start,end:i+1,text:text.slice(start,i+1)});start=i+1;
 }
 if(text.slice(start).trim())result.push({start,end:text.length,text:text.slice(start)});
 return result;
}
function noun(text){
 const raw=text.trim();if(!raw)return null;
 if(!/^[\p{L}\p{N}_'’-]+(?:[ -][\p{L}\p{N}_'’-]+){0,5}$/u.test(raw))return null;
 const words=raw.split(/\s+/),determiner=/^(a|an|the|some|every|each|all|any|no|my|your|his|her|their|our)\s+(.+)$/i.exec(raw);
 const label=determiner?determiner[2]:raw;
 if(/\b(and|but|or|that|whether|if|because|before|after|from|to|with|of|by|not|must|may|might|can|could|should|would|will|has|have|had|is|are|was|were)\b/i.test(label))return null;
 if(label.split(/\s+/).some(w=>forms.has(w.toLowerCase())&&w.toLowerCase()!==label.toLowerCase()))return null;
 return {raw,label,determiner:determiner?.[1].toLowerCase()??null,proper:/^[A-Z]/.test(raw)&&!determiner,pronoun:/^(I|you|he|she|it|we|they|him|her|them)$/i.test(raw)};
}
export function symbolicDiscourse(text){
 const graph={version:'symbolic-discourse/1',source:text,clauses:[],links:[],markers:[],unresolved:[],diagnostics:[],coverage:{total:text.length,recognized:0,unresolved:0}};
 let serial=0;
 const diag=(code,message,span)=>graph.diagnostics.push({code,message,span});
 const unresolved=(fragment,span,reason)=>{
  const offset=text.indexOf(fragment,span[0]);
  const actual=offset>=span[0]&&offset+fragment.length<=span[1]?[offset,offset+fragment.length]:span;
  const wording=text.slice(...actual);
  graph.unresolved.push({span:actual,text:wording,reason});
  diag('unresolved-fragment',reason+' Source fragment: '+wording.trim(),actual);
 };

 function parse(raw,span,depth=0){
  if(depth>4)return null;
  let s=raw.trim().replace(/[.!?;]+$/,'').trim();
  if(!s)return null;
  // Do not guess connective scope or question embedding from a bag of words.
  if(/^(if|unless|every|each|all|no)\b/i.test(s)||/\b(whether|because|before|after|and|but|or|who|which)\b/i.test(s))return null;
  const marked=[];let marker;
  while((marker=/^(Well|Basically|Please),?\s+/i.exec(s))){marked.push(marker[1]);s=s.slice(marker[0].length);}
  let subject,form,rest='',tense='present',neg=false,flags=[],modal=null,status='asserted',child=null;
  let time=null;const tm=/\s+(now|today|yesterday|tomorrow)$/i.exec(s);
  if(tm){time=tm[1];s=s.slice(0,tm.index);}
  // Attitude content is a proposition, never an opaque entity name.
  const attitude=/^(.+?)\s+(says?|said|thinks?|thought|believes?|believed|knows?|knew|reports?|reported)\s+(?:that\s+)?(.+)$/i.exec(s);
  if(attitude){subject=noun(attitude[1]);form=attitude[2].toLowerCase();child=parse(attitude[3],span,depth+1);if(!subject)return null;if(child)child.status='unasserted';else unresolved(attitude[3],span,'Unparsed attitude content; do not assert it as an independent fact.');if(past.has(form))tense='past';}
  else{
   let m;
   if(/\?$/.test(raw.trim())){
    m=/^(Did|Does|Do|Has|Have|Had)\s+(.+?)\s+([a-z]+)(?:\s+(.*))?$/i.exec(s);
    if(!m)return null;
    // Find the known lexical verb after the inverted subject instead of assuming
    // that the first token after the auxiliary is a complete noun phrase.
    const ws=s.split(/\s+/),i=ws.findIndex((w,i)=>i>1&&forms.has(w.toLowerCase()));
    if(i<0)return null;subject=noun(ws.slice(1,i).join(' '));form=ws[i].toLowerCase();rest=ws.slice(i+1).join(' ');tense=ws[0].toLowerCase()==='did'?'past':'present';status='queried';if(/^(has|have|had)$/i.test(ws[0]))flags.push('PERF');
   }else{
    const negativeRequest=/^(?:don't|do not)\s+/i.exec(s);if(negativeRequest){s=s.slice(negativeRequest[0].length);neg=true;}
    const ws=s.split(/\s+/);const i=ws.findIndex((w,i)=>i>0&&(forms.has(w.toLowerCase())||/^(must|may|might|can|could|should|would|will|did|does|do)$/.test(w.toLowerCase())));
    if(i<0){
     form=ws[0].toLowerCase();if(!forms.has(form)||!['send','give','open','close','read','write','book','call','cancel','help'].includes(forms.get(form)))return null;
     subject=noun('you');rest=ws.slice(1).join(' ');status='directive';
    }else{
     subject=noun(ws.slice(0,i).join(' '));form=ws[i].toLowerCase();let tail=ws.slice(i+1);
     if(/^(must|may|might|can|could|should|would|will)$/.test(form)){modal=form;form=tail.shift()?.toLowerCase();if(form==='not'){neg=true;form=tail.shift()?.toLowerCase();}if(modal==='may'&&neg)return null;}
     else if(/^(did|does|do)$/.test(form)){tense=form==='did'?'past':'present';form=tail.shift()?.toLowerCase();if(form==='not'){neg=true;form=tail.shift()?.toLowerCase();}}
     else{
      if(past.has(form))tense='past';
      if(tail[0]?.toLowerCase()==='not'){neg=true;tail.shift();}
      if(['is','are','am','was','were'].includes(form)&&progressive.has(tail[0]?.toLowerCase())){form=progressive.get(tail.shift().toLowerCase());flags.push('PROG');}
      else if(['has','have','had'].includes(form)&&forms.has(tail[0]?.toLowerCase())){form=tail.shift().toLowerCase();flags.push('PERF');}
     }
     rest=tail.join(' ');
    }
   }
  }
  const predicate=forms.get(form);if(!subject||!predicate)return null;
  if(attitudes.has(predicate)&&!child&&!attitude)return null;
  const object=rest?noun(rest):null;
  if(rest&&!object)unresolved(rest,span,'Complement or modifier attachment is not resolved by the draft.');
  if(!rest&&!object&&!child&&!intransitive.has(predicate)&&!attitude)return null;
  const frame={id:'c'+(++serial),span,subject,predicate,object,content:child,tense,neg,flags,modal,status,time};
  for(const spanText of marked)graph.markers.push({target:frame.id,span:spanText,function:'discourse-marker'});
  if(subject.pronoun&&!/^(I|you)$/i.test(subject.raw)||object?.pronoun)diag('unresolved-coreference','Pronoun antecedents have not been resolved; verify against the source.',span);
  if(subject.determiner&&object?.determiner)diag('quantifier-scope','Quantifier order is not established by the symbolic draft.',span);
  if(!roleLexicon[predicate]&&predicate!=='be')diag('unknown-semantic-role','No lexical role frame for '+predicate+'.',span);
  if(predicate==='be')diag('copular-reading','Copular type, property and identity readings need review.',span);
  return frame;
 }
 for(const seg of sourceSegments(text)){
  // Independent finite clauses may share conjunction/contrast. Do not split
  // inside attitude/conditional constructions where attachment is ambiguous.
  const pieces=/\b(if|unless|think|thinks|thought|say|says|said|believe|believes|know|knows|whether)\b/i.test(seg.text)?[seg.text]:seg.text.split(/,?\s+(and|but)\s+/i);
  let previous=null,connector=null,cursor=seg.start;
  for(const part of pieces){
   if(/^(and|but)$/i.test(part)){connector=part.toLowerCase();continue;}
   const start=text.indexOf(part,cursor);const span=start>=0?[start,start+part.length]:[seg.start,seg.end];cursor=span[1];
   const markerCount=graph.markers.length,diagnosticCount=graph.diagnostics.length,gapCount=graph.unresolved.length;
   const frame=parse(part,span);
   if(frame){
    graph.clauses.push(frame);
    if(graph.unresolved.length===gapCount)graph.coverage.recognized+=span[1]-span[0];
    if(previous&&connector)graph.links.push({from:previous.id,to:frame.id,type:connector==='but'?'contrast':'conjunction'});
    previous=frame;
   }else{
    graph.markers.length=markerCount;graph.diagnostics.length=diagnosticCount;graph.unresolved.length=gapCount;
    unresolved(part,span,'Construction is outside the conservative symbolic grammar; no asserted interpretation was guessed.');
    previous=null;
   }
  }
 }
 graph.coverage.unresolved=graph.unresolved.reduce((n,u)=>n+u.span[1]-u.span[0],0);
 // Surface recognition is coverage, not a correctness score.
 graph.coverage.ratio=graph.coverage.total?graph.coverage.recognized/graph.coverage.total:0;
 return graph;
}
