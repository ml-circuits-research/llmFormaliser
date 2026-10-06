// Lossless presentation normalization. Never repair predicates, references or quotes.
export function formalizationInput(raw){
 const normalizations=[];let text=raw;
 if(text&&typeof text==='object'&&!Array.isArray(text)){
  const entries=Object.entries(text);
  if(entries.length===1&&/^(?:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|[a-f\d]{64}-\d+)$/i.test(entries[0][0])&&typeof entries[0][1]==='string'){
   text=entries[0][1];normalizations.push({action:'extract-single-batch-id-wrapper',id:entries[0][0]});
  }
 }
 if(typeof text!=='string')throw new Error('Formalization must be SOP text');
 const fence=text.trim().match(/^(`{3,}|~{3,})(?:text|sop)?\s*\n([\s\S]*)\n\1$/);
 if(fence){text=fence[2];normalizations.push({action:'remove-presentation-fence'});}
 return {text,normalizations};
}

// A narrowly recoverable spelling error observed in modifier objects: a bare
// label followed by a stray quote. Never rewrite inside an already quoted value.
// Only lexical labels are eligible; no predicates, references or words change.
export function normalizeModifierLabels(text){
 let output='',quoted=false,escaped=false;const normalizations=[];
 for(let i=0;i<text.length;){
  if(!quoted){
   const match=/^"label":([A-Za-z_][A-Za-z0-9_.-]*)"(?=\s*[,}])/.exec(text.slice(i));
   if(match&&!['true','false','null'].includes(match[1])){
    const replacement='"label":'+match[1];
    normalizations.push({action:'remove-stray-quote-after-bare-modifier-label',line:text.slice(0,i).split('\n').length,before:match[0],after:replacement});
    output+=replacement;i+=match[0].length;continue;
   }
  }
  const c=text[i++];output+=c;
  if(escaped){escaped=false;continue;}
  if(c==='\\'&&quoted){escaped=true;continue;}
  if(c==='"')quoted=!quoted;
 }
 return {text:output,normalizations};
}
