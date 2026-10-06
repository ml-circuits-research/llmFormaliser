# CNL-E rules (compact, for the teacher model)

CNL-E rewrites any text as a list of events, one per line. Nothing is explained, nothing is added.

## Line shape

```
LABEL: WHO [not] VERB [WHAT] [label: value]... [FLAG]...
```

- LABEL is E1, E2, E3... in line order, followed by a marker:
  - `E1:`   fact asserted by the speaker
  - `E1*:`  content that is not asserted (said, wanted, promised, asked for, a condition)
  - `E1?:`  direct question; `E1*?:` question embedded in another event (ask whether, know when)
  - `E1!:`  order, request, or query; WHO is the one who must act, usually `you`
  - `E1^:`  interjection, greeting, thanks, apology; no verb: `E1^: thanks [for: help-1]`
- Events are listed in the order their verbs appear in the text.
- One verb per line. A subordinate clause is its own line and is referred to by label: `John say E2`.
  A line with `*` must be referred to by some other line.
- After a factive verb (know, regret, realize) the content is itself a fact: no `*`.

## Words

- Lowercase lemmas from the text only. No synonyms, no paraphrase. Multiword units use `_`: `give_up`, `a_lot`.
- Never write articles (a, an, the), auxiliaries (did, was, will, has), or third-person pronouns.
- Every common noun carries an id: `report-1`. Same id = same entity everywhere in the text.
  A second, different report is `report-2`. Ids of a noun start at 1 and grow by 1.
  Plural group: `report-1+`. The kind in general: `dog-0`.
- Proper names keep their capital: `John`, `New_York`. Deictics stay: `I`, `you`, `we`, `this`, `that`.
- A third-person pronoun is replaced by its referent. If two referents are possible, write both,
  preferred first: `John|Peter`. Impersonal "it" (it rains) and a missing agent are `_`.
  A pronoun with no referent anywhere in the text becomes an entity named by the pronoun: `she-1`.
- Noun lemmas are singular: "sales" is `sale-1+`, "three times" is `3_time`. Number 0 is only for a
  kind in general (`dog-0`); nobody, someone, everything are ordinary nouns: `nobody-1`.
- Adjectives go before their noun: `old report-1`. A predicate adjective or predicate noun has no id:
  `report-1 be very long`, `John be good doctor`. An adverb directly before an adjective stays with
  it (`be so happy`); `[degree: ...]` is only for a verb or an interjection.
- Demonstratives before a noun (this cake, those files) are dropped like articles.
- Quantifiers go before the noun: `every`, `all`, `each`, `some`, `any`, `no`, `most`, `many`, `few`,
  `several`, `half`, `not_every`, `not_all`, `not_many`, a number (`3 report-1+`), or `>3`, `<=3`, `~3`.
- Coordination: `John and Mary`, `tea-1 or coffee-1`. Focus: `only John`, `even John`, `also John`.

## Negation and modality

- `not` goes immediately before the verb it negates, nowhere else.
- Negative words (never, nobody, nothing, no + noun, without) keep their own lemma; do not add `not` for them:
  `nobody-1 answer`, `you restart database-1 [freq: never]`.
- Modals and certainty go in `[mode: ...]`: `[mode: must]`, `[mode: probably]`, `[mode: can]`.
  The mode has scope over the (possibly negated) verb: `you not open valve-1 [mode: must]` = must not open.
  To negate the modal itself: `you open valve-1 [mode: not need]` = need not open.
- A wish (if only, may you) is a fact with `[mode: wish]`.

## Tags and noun modifiers: this is attachment

- `[label: value]` after the verb modifies the VERB. `{label: value}` glued to a noun modifies that NOUN.
  `see man-1{with: telescope-1}` = the man has it. `see man-1 [with: telescope-1]` = seeing through it.
- The label is the preposition or connective from the text: `to`, `from`, `before`, `if`, `because`,
  `although`, `but`, `than`, `of`, `on`. If the text has none, use one of:
  `time`, `place`, `manner`, `mode`, `degree`, `cause`, `purpose`, `freq`, `duration`.
- Possessive: `car-1{of: John}`. Vocative: `[to: Mary]`.
- A connective tag sits on the main clause and points to the subordinate one:
  "X, although Y" is `X ... [although: Ey]`.
- A restrictive relative clause stays on the noun: `every student-1{that: E1}`.
  A non-restrictive one becomes a separate fact line.
- Tags keep the order of the text. Flags come last.
- Passive becomes active. The by-agent becomes WHO; if there is none, WHO is `_`.

## Flags (closed set, always last, in this order when several)

`[PAST]` `[FUTURE]` `[PERF]` `[PROG]` `[HABIT]` `[POLITE]` `[EMPH]`. Present tense has no flag.
`[POLITE]` replaces please / could you. `[EMPH]` goes on the main event of every sentence that ends
with an exclamation mark, and replaces emphatic repetition. Use a tense flag only where the text
marks that tense on that verb; `[HABIT]` only for general statements about kinds or groups.

## Questions

- Yes/no question: a `?` line with no variable. Otherwise put a variable in the unknown slot:
  `?who`, `?what`, `?when`, `?where`, `?why`, `?how`; before a noun: `?which`, `?how_many`, `?how_much`.
- `[time: ?when]`, `[place: ?where]`, `[cause: ?why]`, `[manner: ?how]`.
- Variables are only allowed on `?` and `*?` lines.

## Other values

- Quantities: `5_km`, `2_hour`, `>500_euro`, `<=5%`, `~300_km`. Dates and times: `2026-10-12`, `10:30`.
- Mathematics goes between dollars in plain ASCII: `$x^2 + 2*x + 1 = 0$`, `$sqrt(2) < 1.5$`,
  `$sum(i, 1, n, i)$`. A formula with a relation can be a whole line: `E1: $y = 2*x$ [if: E2]`.
- Literal text that must not be touched goes in double quotes: `sign-1 say "No entry"`.
- Logic over events: `E3: either E1 or E2`, `E3: both E1 and E2`, `E2: not E1`.

## What is deleted

Fillers and discourse markers (well, um, uh, like, you know, I mean, basically, actually, honestly),
false starts and repetitions. Nothing else may be dropped.
