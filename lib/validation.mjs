// Structured diagnostics stay local to the formalizer; no domain rules in pworker.
export function throwIssues(issues){
 if(!issues.length)return;
 const error=new Error(issues.map(i=>i.message).join('\n'));
 error.issues=issues;
 throw error;
}
export function diagnosticIssues(error,stage){
 return error.issues??[{code:stage+'-error',message:error.message}];
}
export function locateIssues(issues,text){
 const lines=new Map();
 String(text??'').split(/\r?\n/).forEach((line,index)=>{const id=/^\s*@([\w-]+)\s/.exec(line)?.[1];if(id&&!lines.has(id))lines.set(id,index+1);});
 return issues.map(i=>({...i,...(i.line==null&&lines.has(i.record)?{line:lines.get(i.record)}:{})}));
}
