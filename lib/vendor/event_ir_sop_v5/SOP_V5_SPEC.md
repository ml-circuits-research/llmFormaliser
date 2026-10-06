# Event IR SOP v5

A compact, line-oriented semantic IR for LLM generation.

## Core syntax

```text
@id TYPE key=value key=value ...
```

- Every semantic statement declares one output identifier with `@id`.
- References to previously or subsequently declared statements use `$id`.
- Multiple values use commas: `m=$e1,$e2`.
- Quoted strings are allowed only for source literals/spans that contain whitespace or commas.
- Semantic enum values must be atomic. **Do not hide a phrase in `snake_case`.**
- If a concept needs several semantic components, use several keys.

Example:

```text
@s1 S
@x1 E h=person ty=person n=John
@e1 EV p=leave ag=$x1 root=$o2
@o1 OP t=negation sc=$e1
@o2 OP t=deontic v=required sc=$o1
```

This encodes `REQUIRED(NOT(leave(John)))`.

The opposite scope is:

```text
@e1 EV p=leave ag=$x1 root=$o2
@o1 OP t=deontic v=required sc=$e1
@o2 OP t=negation sc=$o1
```

## Statement types

```text
S   sentence / speech act
E   entity
EV  event
ST  state
RE  relation frame
EX  existence
ID  identity
DF  definition
CP  comparison
OP  scoped operator
L   frame link
ER  entity relation
G   logical group
QS  quantifier scope
LS  logical scope
PS  presupposition
CI  conventional implicature
CX  context dependency
MN  mention / coreference
AM  ambiguity
MS  missing information
UM  unmapped material
Q   question
```

## Main keys

### Sentence

```text
f=decl|int|imp|excl|frag
a=assert|ask|request|command|suggest|...
primary=...
polite=please
surface=modal
indirect=true
```

Defaults: `f=decl`, `a=assert`.

### Entity

```text
h=head
ty=person|object|organization|place|time|information|abstract|quantity|...
n=proper-name
d=definite|indefinite|generic|pronoun|unknown
q=all|some|none|exact|min|max
qv=number
pr=old,red
of=France
co=$x1
```

`q=min qv=3` means *at least 3*. `q=max qv=3` means *at most 3*.

### Frame

```text
p=predicate
ag=$x1 pa=$x2 th=$x3 xp=$x4 rc=$x5 ...
st=asserted|queried|hypothetical|conditional|reported|commanded|requested|...
t=past|present|future|atemporal|unknown
as=simple|perfect|progressive|habitual|...
root=$o1
tm=before:noon
pl=Paris
man=carefully
```

Role abbreviations:

```text
ag agent       pa patient      th theme
xp experiencer sm stimulus     rc recipient
bn beneficiary ins instrument  src source
dst destination loc location   psr possessor
psd possessed  val value       std standard
top topic      ct content
```

### Scoped operators

```text
@o1 OP t=negation sc=$e1
@o2 OP t=epistemic v=probable sc=$o1
@o3 OP t=deontic v=required sc=$e1
@o4 OP t=focus v=scalar cue=even trg=$x1 dom=context scale=rank sc=$e1
```

Operator scope may point to a frame or another operator.

### Links

```text
@l1 L t=condition f=$e1 to=$e2
@l2 L t=unless f=$e2 to=$e3
@l3 L t=content f=$e4 to=$e1
@l4 L t=purpose f=$e1 to=$e2 entails=false
```

Do not add redundant labels such as `sem=exception_condition` when `t=unless` already states the semantics.

### Quantifiers

```text
@q1 QS k=all ent=$x1 sc=$e1 o=1 dist=distributive
@q2 QS k=min ent=$x2 sc=$e1 o=2 dep=$x1
```

### Presuppositions

Use compositional primitives rather than long type names.

```text
@ps1 PS exists=$x1 unique=$x1 cause=def
@ps2 PS trg=$e1 prior=event
@ps3 PS trg=$e1 prior=event,state
@ps4 PS trg=$e2 true=true cause=factive
```

For example, do **not** write:

```text
PS t=definite_description_existence_uniqueness
```

### Focus

```text
@o1 OP t=focus v=exclusive trg=$x1 dom=context alts=relevant sc=$e1
@o2 OP t=focus v=scalar cue=even trg=$x1 dom=context scale=rank sc=$e1
@o3 OP t=focus v=exclusive cue=cleft trg=$x1 sc=$e1
```

### Ambiguity

Do not guess. Encode alternatives structurally.

```text
@am1 AM t=attachment span="with the telescope" \
  a1.kind=instrument a1.to=$e1 \
  a2.kind=modifier a2.to=$x2 pref=null
```

## Semantic defaults

Omit fields when these defaults hold:

```text
sentence f=decl
sentence a=assert
entity ty=object
entity d=definite
frame st=asserted
frame t=unknown
frame as=simple
frame source=speaker
```

## Required invariants

1. Every statement begins with `@id`.
2. Every `$id` resolves to exactly one declared statement.
3. IDs are unique within one sentence IR.
4. No semantic value contains a hidden snake_case phrase.
5. One atomic predication normally becomes one frame.
6. Operators preserve exact scope.
7. Conditions, questions, commands, beliefs and reports are not silently asserted as facts.
8. Genuine ambiguity stays explicit.
9. Do not invent information.
10. Meaning-bearing source material must be represented or explicitly marked missing/unmapped.
