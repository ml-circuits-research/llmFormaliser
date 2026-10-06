# LLM Formaliser

- This project compares natural-language formalization prompts through Ploinky Workers (`pworker`). Work in this repository; change `../Ploinky-Worker` only when a worker fix is necessary. Do not read or modify `../nlpFormaliser` or other sibling projects.
- Use English in code, prompts, documentation, tests, and CLI output. Conversation may be in Romanian.
- Obtain explicit provider/model choices for formalization and the `best` judge tier. Reuse choices already supplied for the requested experiments without asking again. An explicitly requested correction/rerun may reuse the choices already supplied for that experiment. Never silently choose, upgrade, or fall back to another model.
- Store experiment inputs first, then start experiments the user has requested us to run. Do not ask the user to run CLI commands or reconfirm an already authorized start. Use pworker's enqueue/flush batch mode with one shared instruction prefix per prompt variant, rather than one model call per example. Do not claim one total provider call: batch limits, errors, and retries can split requests.
- Task types are static pworker phase-map Markdown files (JSON is also supported by pworker) in `taskTypes`. Keep prompt strategy separate from provider/model selection.
- Convert formalizations deterministically in `lib`, validate first, and judge semantic preservation in both directions. Preserve speech acts, scope, modality, reference, time, presuppositions, and unresolved ambiguity. Invalid syntax and inconclusive judgments are not successes.
- Preserve raw outputs, task/prompt hashes, exact example sources, chosen models, actual response metadata, errors, batch counts, and judgments. LLM judgments are estimates, not proofs.
- Keep credentials in the user's Pworker home, never in this repository or experiment artifacts. Provider subscriptions must be checked against the actual API endpoint/plan; do not assume chat subscriptions include API access.
- Run offline tests before proposing a live experiment. Do not use benchmark held-out data as prompt examples.

- Current providers for this project: Openference, Z.AI Coding Plan, and DeepSeek. Grok is excluded at the user's request; do not configure or investigate its authentication.
- Use `${input}` placeholders in new pworker templates; bare dollar references in formal notation must remain literal.

- Keep two baseline SOP task types: CNL-E semantics and Event IR semantics, both emitting `@id TYPE key=value ...`. Adapt original prompt rules and examples to this single syntax; do not create experiments for JSON/KV/bracket spelling differences.
- Maintain `docs/index.html` and one HTML convention page per formalization, plus the shared format and judge pages. Rebuild with `npm run build:docs` after prompt or convention changes.

- Each baseline task has exactly four phases: begin (batched small-tier model), toCnl (individual explicit code with library imports), judge (batched best-tier model), finish (individual explicit code with library imports). Queue complete tasks once and flush once. Keep shared request policy in pworker.config.json, keep cache enabled, and impose no arbitrary maxTokens in task definitions.

- Local phase behavior must be visible in phase.code: import a library, call it, construct the next phase input and persist results explicitly. codeFile is forbidden.

- Active formalizations contain only SOP declarations and simple lists: no inline JSON/object values. CNL modifiers use `MOD target=$id label=... value=...`; groups use `G t=... m=[...]`. Quote multiword values; simple values may be bare. JSON is permitted for internal structures, persisted artifacts and worker batch transport only. Include explicit prompt examples of these conventions.
- Current fast iteration choice authorized by the user: `deepseek/deepseek-flash` (catalog name DeepSeek-V4.1-Flash) for both formalization and judging. Avoid new Qwen/Openference iterations unless requested again.

- Preserve discourse/pragmatic wording with DISC records and uncertain residual wording with UM; do not silently delete fillers or classify every marker as emotion. Keep factual events distinct from pragmatic annotations.

- User-authorized repair variants are separate task types with review and one batched repair pass, then local conversion and selective rejudging. Keep baseline prompts identical for comparisons.

- User-authorized symbolic-first variants add a local clause draft, local diagnostics, conditional single-pass repair and the existing conversion/judge flow; complete drafts are judged first and exact accepted cached pairs skip repair. Implement from ideas only: do not copy code from nlpFormaliser. Keep all six descriptive workflow files. Generation and repair must include the identical canonical lib/prompts/<dialect>.txt file.

- Current benchmark unit: one COMPLETE FILE per case. Use experiments/ten-whole-files.json (ten cases). Never split files into paragraphs or lines unless explicitly requested again.
