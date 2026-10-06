import {repairTask} from './repair-task.mjs';
export function symbolicTask(base,dialect){
 const task=repairTask(base);
 const converter=dialect==='clause-sop'?'convertClauseSop':'convertEventSop';
 task.begin={tier:null,code:`const { symbolicDraft } = await import("./lib/symbolic-export.mjs");
this.symbolicDraft = symbolicDraft(this.input, ${JSON.stringify(dialect)});
this.raw = this.symbolicDraft.raw;`,next:'draftCheck'};
 task.draftCheck={tier:null,code:`const { ${converter} } = await import("./lib/${dialect}.mjs");
const { localChecks } = await import("./lib/local-quality.mjs");
const conversion = ${converter}(this.raw);
const checks = localChecks(this.input, conversion);
checks.warnings.push(...this.symbolicDraft.graph.diagnostics.map(d => ({
  ...d, message: d.message + ' Source offsets: ' + d.span.join('..')
})));
this.draftCheck = { conversion, checks };
await this.writeFile('artifacts/' + this.variant + '/' + this.caseId + '-draft.json',
  JSON.stringify({ source: this.input, ...this.symbolicDraft, checks, conversion }, null, 2));`,next:'toCnl'};
 // The normal converter first checks exact cached judgments. A known accepted
 // pair is not repaired merely because its symbolic construction was uncertain.
 task.toCnl.code+=`
if (!(this.repairCount > 0) && this.conversion.ok && this.judgeRaw == null
    && this.symbolicDraft.graph.diagnostics.length) {
  this.localChecks.blocking.push(...this.symbolicDraft.graph.diagnostics.map(d => ({
    ...d, message: d.message + ' Source offsets: ' + d.span.join('..')
  })));
  this.next('review');
}`;
 task.review.code=task.review.code.replace("this.next('repair');",`this.repairInput += '\\n\\nSYMBOLIC DRAFT NOTICE: This is a fallible heuristic draft. Review the reported problems against the authoritative source. Preserve correct content; do not reproduce unresolved guesses.';
  this.next('repair');`);
 task.finish.code=task.finish.code.replace('const row = {',`const { draftRetention } = await import("./lib/symbolic-export.mjs");
const row = {
  approach: 'symbolic-first', symbolicDraft: this.symbolicDraft, draftCheck: this.draftCheck,
  retention: draftRetention(this.symbolicDraft.raw, this.raw),`);
 return Object.fromEntries(['begin','draftCheck','toCnl','judge','review','repair','finish'].map(k=>[k,task[k]]));
}
