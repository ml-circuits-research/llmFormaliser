#!/usr/bin/env python3
"""CNL-E as JSON: the same structure with predefined keys instead of bracket syntax.

    {"entities": [ {...}, ... ], "events": [ {...}, ... ]}

ENTITY keys  (one object per common-noun referent that has something to say about it;
              a noun with no quantifier, adjective, plural or modifier needs no entry)
    id      "report-1"      noun lemma + number; "dog-0" is the kind in general
    quant   "every"         optional: every all each some any no most many few several half
                            not_every not_all not_many, a number ("3", ">3", "~3"),
                            "?which" "?how_many" "?how_much"
    adj     ["very","old"]  optional: words that stand before the noun, in order
    plural  true            optional
    mods    [TAG, ...]      optional: what modifies the NOUN (of, with, on, that ...)

EVENT keys   (one object per verb / line)
    id      "E1"            E1, E2, ... in order
    type    "unasserted" | "question" | "embedded_question" | "directive" | "expressive"
                            optional: when absent the event is a FACT asserted by the speaker
    who     VALUE           the subject
    not     true            optional: the verb is negated
    verb    "send"          one lemma
    what    VALUE           optional: direct object, or the property after "be"
    tags    [TAG, ...]      optional: what modifies the VERB
    flags   ["PAST", ...]   optional: PAST FUTURE PERF PROG HABIT POLITE EMPH
    formula "x^2 + 1 = 0"   instead of who/verb/what: the event is a mathematical statement
    logic   "either"|"both"|"not"  with  args ["E1","E2"]: instead of who/verb/what

TAG          {"label": "to", "value": VALUE}      plus optional "not": true

VALUE        a string:  "report-1"  "John"  "E2"  "_"  "?who"  "I"  "5_km"  "<=5%"  "2026-10-12"
                        "$pi * radius^2$"  "\"No entry\""  or plain words: "very long", "yesterday"
             or, for several items:  {"join": "and"|"or"|"alt", "items": ["John", "Mary"]}
                                     ("alt" = ambiguous referent, preferred one first)
             or with a focus word:   {"focus": "only"|"even"|"also", "items": ["Ana"]}

Where a modifier is stored IS its attachment: in an entity's "mods" it belongs to the noun,
in an event's "tags" it belongs to the verb.

Usage:
    python3 cnl_json.py file.cnl                    # print the JSON form of a CNL-E text
    python3 cnl_json.py --check answer.json         # validate one model answer
    python3 cnl_json.py --eval gold.jsonl pred.jsonl [N]   # score answers; show N wrong ones
    python3 cnl_json.py --test                      # convert and check every example
"""
import json
import re
import sys
from pathlib import Path

from lark import Lark, Token, Tree

HERE = Path(__file__).parent
PARSER = Lark((HERE / "cnl.lark").read_text(), parser="lalr", lexer="contextual",
              propagate_positions=True)

TYPES = ["fact", "unasserted", "question", "embedded_question", "directive", "expressive"]
FLAGS = ["PAST", "FUTURE", "PERF", "PROG", "HABIT", "POLITE", "EMPH"]
QUANTS = {"every", "all", "each", "some", "any", "no", "most", "many", "few", "several", "half",
          "not_every", "not_all", "not_many", "?which", "?how_many", "?how_much"}
PRONOUNS = {"I", "you", "we", "this", "that"}
BANNED = {"a", "an", "the", "he", "she", "it", "they", "him", "her", "them", "his", "hers", "its",
          "their", "who", "whom", "which", "whose", "is", "are", "was", "were", "am", "been",
          "did", "does", "has", "had", "will", "would", "um", "uh", "basically", "actually"}


# --------------------------------------------------------------------------- CNL-E -> JSON
def to_json(cnl):
    text = cnl.strip() + "\n"
    tree = PARSER.parse(text)
    entities = {}

    def src(node):
        if isinstance(node, Token):
            return str(node)
        return re.sub(r"\s+", " ", text[node.meta.start_pos:node.meta.end_pos]).strip()

    def atom(node):
        if isinstance(node, Tree) and node.data == "np":
            noun = next(c for c in node.children if isinstance(c, Token) and c.type == "NOUN")
            eid = str(noun).rstrip("+")
            ent = entities.setdefault(eid, {"id": eid})
            for c in node.children:
                if isinstance(c, Tree) and c.data == "quant":
                    ent.setdefault("quant", src(c).replace(" ", ""))
                elif isinstance(c, Tree) and c.data == "words":
                    ent.setdefault("adj", [str(w) for w in c.children])
                elif isinstance(c, Tree) and c.data == "npmod":
                    m = tag(c)
                    if m not in ent.setdefault("mods", []):
                        ent["mods"].append(m)
            if str(noun).endswith("+"):
                ent["plural"] = True
            return eid
        return src(node)                      # NAME, PRON, EVREF, WH, _, "string", $formula$, quantity ...

    def unit(node):                           # FOCUS? alt
        focus = next((str(c) for c in node.children if isinstance(c, Token) and c.type == "FOCUS"), None)
        alt = next(c for c in node.children if isinstance(c, Tree) and c.data == "alt")
        items = [atom(a) for a in alt.children]
        if focus:
            return {"focus": focus, "items": items} if len(items) == 1 else None
        return items[0] if len(items) == 1 else {"join": "alt", "items": items}

    def value(node):
        if isinstance(node, Token):
            return str(node)
        if node.data == "term":
            units = [unit(c) for c in node.children if isinstance(c, Tree)]
            joins = {str(c) for c in node.children if isinstance(c, Token)}
            if len(units) == 1:
                return units[0]
            if len(joins) != 1 or not all(isinstance(u, str) for u in units):
                raise ValueError("mixed and/or, or a list of lists, has no JSON form: " + src(node))
            return {"join": joins.pop(), "items": units}
        if node.data == "complement":
            return value(node.children[0])
        return src(node)                      # property, number

    def tag(node):
        kids = node.children
        out = {"label": str(kids[0])}
        if any(isinstance(k, Token) and k.type == "NOT" for k in kids):
            out["not"] = True
        out["value"] = value(kids[-1])
        return out

    events = []
    for line in tree.children:
        ev = {"id": str(line.children[0])}
        if line.data != "fact":
            ev["type"] = line.data
        body = line.children[1]
        rest = body.children
        if body.data == "verbal":
            ev["who"] = value(rest[0])
            seen_verb = False
            for k in rest[1:]:
                if isinstance(k, Token) and k.type == "NOT":
                    ev["not"] = True
                elif isinstance(k, Token) and k.type == "WORD" and not seen_verb:
                    ev["verb"], seen_verb = str(k), True
                elif isinstance(k, Tree) and k.data == "complement":
                    ev["what"] = value(k)
        elif body.data == "expressive":
            ev["what"] = src(rest[0])
        elif body.data == "mathclause":
            ev["formula"] = src(rest[0]).strip("$").strip()
        else:                                 # either / both / negation
            ev["logic"] = {"either": "either", "both": "both", "negation": "not"}[body.data]
            ev["args"] = [str(k) for k in rest if isinstance(k, Token) and k.type == "EVREF"]
        tags = [tag(k) for k in rest if isinstance(k, Tree) and k.data == "tag"]
        flags = [src(k).strip("[]") for k in rest if isinstance(k, Tree) and k.data == "flag"]
        if tags:
            ev["tags"] = tags
        if flags:
            ev["flags"] = flags
        events.append(ev)
    return {"entities": [e for e in entities.values() if len(e) > 1], "events": events}


# --------------------------------------------------------------------------- checking
_ENTITY = re.compile(r"[a-z][a-z0-9_']*-[0-9]+")
_WORDS = re.compile(r"[a-z][a-z0-9_']*( [a-z][a-z0-9_']*)*")
_SIMPLE = re.compile(
    r"E[0-9]+|_|\?[a-z_]+|[A-Z][A-Za-z0-9_.']*(-[0-9]+)?|\"[^\"\n]*\"|\$[^$\n]+\$"
    r"|(<=|>=|<|>|~)?-?[0-9]+(\.[0-9]+)?(%|_[A-Za-z%°][A-Za-z0-9_/%°]*)?"
    r"|[0-9]{4}-[0-9]{2}(-[0-9]{2})?|[0-9]{1,2}:[0-9]{2}")


def check(doc):
    """Return a list of error strings; an empty list means the JSON is a valid CNL-E document."""
    errs = []
    if not isinstance(doc, dict) or set(doc) - {"entities", "events"} or "events" not in doc:
        return ["top level must be {\"entities\": [...], \"events\": [...]}"]
    ents = doc.get("entities", [])
    evs = doc["events"]
    ent_ids = [e.get("id") for e in ents if isinstance(e, dict)]
    ev_ids = [e.get("id") for e in evs if isinstance(e, dict)]
    used_ents, used_evs, wh_in = set(), set(), {}

    def strings(v, where, owner):
        if isinstance(v, dict):
            extra = set(v) - {"join", "focus", "items"}
            if extra or "items" not in v or ("join" in v) == ("focus" in v):
                errs.append(f"{where}: a list value needs \"items\" and exactly one of \"join\" / \"focus\"")
                return
            if v.get("join", "and") not in ("and", "or", "alt") or v.get("focus", "only") not in ("only", "even", "also"):
                errs.append(f"{where}: bad join or focus")
            items = v["items"]
            if not isinstance(items, list) or not items or not all(isinstance(i, str) for i in items):
                errs.append(f"{where}: \"items\" must be a non-empty list of strings")
                return
            if "join" in v and len(items) < 2:
                errs.append(f"{where}: a join needs at least two items")
            for i in items:
                strings(i, where, owner)
            return
        if not isinstance(v, str) or not v.strip():
            errs.append(f"{where}: value must be a non-empty string or a list object")
            return
        if _ENTITY.fullmatch(v):
            used_ents.add(v)
        elif re.fullmatch(r"E[0-9]+", v):
            used_evs.add(v)
            if v not in ev_ids:
                errs.append(f"{where}: refers to {v}, which is not defined")
            if v == owner:
                errs.append(f"{where}: refers to itself")
        elif v.startswith("?"):
            wh_in.setdefault(owner, []).append(v)
        elif v in PRONOUNS or _SIMPLE.fullmatch(v):
            if v.lower() in BANNED:
                errs.append(f"{where}: '{v}' is an unresolved pronoun or function word")
        elif _WORDS.fullmatch(v.replace(" and ", " ").replace(" or ", " ")):
            for w in v.split():
                if w in BANNED:
                    errs.append(f"{where}: '{w}' must not appear (article, pronoun, auxiliary or filler)")
        else:
            errs.append(f"{where}: cannot read value {v!r} (a noun without an id? add it to \"entities\")")

    def tags(lst, where, owner):
        if not isinstance(lst, list):
            errs.append(f"{where}: must be a list")
            return
        for t in lst:
            if not isinstance(t, dict) or set(t) - {"label", "value", "not"} or not {"label", "value"} <= set(t):
                errs.append(f"{where}: each tag is {{\"label\", \"value\"}} with optional \"not\"")
                continue
            if not isinstance(t["label"], str) or not re.fullmatch(r"[a-z][a-z0-9_']*", t["label"]):
                errs.append(f"{where}: bad label {t['label']!r}")
            if t.get("not", True) is not True:
                errs.append(f"{where}: \"not\" is either true or absent")
            strings(t["value"], f"{where}[{t['label']}]", owner)

    for e in ents:
        if not isinstance(e, dict) or set(e) - {"id", "quant", "adj", "plural", "mods"}:
            errs.append(f"entity {e!r}: allowed keys are id, quant, adj, plural, mods")
            continue
        eid = e.get("id")
        if not isinstance(eid, str) or not _ENTITY.fullmatch(eid):
            errs.append(f"entity id {eid!r} must look like noun-1")
            continue
        q = e.get("quant")
        if q is not None and q not in QUANTS and not re.fullmatch(r"(<=|>=|<|>|~)?[0-9]+(\.[0-9]+)?%?", str(q)):
            errs.append(f"{eid}: unknown quantifier {q!r}")
        if "adj" in e and not (isinstance(e["adj"], list) and e["adj"]
                               and all(isinstance(a, str) and _WORDS.fullmatch(a) and a not in BANNED
                                       for a in e["adj"])):
            errs.append(f"{eid}: \"adj\" must be a non-empty list of lowercase words (no articles)")
        if e.get("plural", True) is not True:
            errs.append(f"{eid}: \"plural\" is either true or absent")
        if "mods" in e:
            tags(e["mods"], f"{eid}.mods", None)
        if len(e) == 1:
            errs.append(f"{eid}: an entity entry needs at least one of quant, adj, plural, mods")
    if len(set(ent_ids)) != len(ent_ids):
        errs.append("an entity is declared twice")

    for i, ev in enumerate(evs):
        if not isinstance(ev, dict):
            errs.append("each event must be an object")
            continue
        me = ev.get("id")
        allowed = {"id", "type", "who", "not", "verb", "what", "tags", "flags", "formula", "logic", "args"}
        if set(ev) - allowed:
            errs.append(f"{me}: unknown keys {sorted(set(ev) - allowed)}")
        if me != f"E{i + 1}":
            errs.append(f"event {i + 1} must have id E{i + 1}")
        typ = ev.get("type", "fact")
        if typ not in TYPES or ev.get("type") == "fact":
            errs.append(f"{me}: type must be one of {TYPES[1:]}, or absent for a fact")
        shape = [k for k in ("verb", "formula", "logic") if k in ev]
        if typ == "expressive":
            if shape or "who" in ev or not isinstance(ev.get("what"), str):
                errs.append(f"{me}: an expressive event has only \"what\" (plus tags and flags)")
        elif len(shape) != 1:
            errs.append(f"{me}: needs exactly one of \"verb\", \"formula\", \"logic\"")
        elif shape == ["verb"]:
            if not isinstance(ev["verb"], str) or not re.fullmatch(r"[a-z][a-z0-9_']*", ev["verb"]) \
                    or ev["verb"] in BANNED:
                errs.append(f"{me}: \"verb\" must be one lowercase lemma, not an auxiliary")
            if "who" not in ev:
                errs.append(f"{me}: \"who\" is required (use \"_\" when the text does not say)")
        elif shape == ["logic"]:
            args = ev.get("args")
            ok = isinstance(args, list) and all(isinstance(a, str) and re.fullmatch(r"E[0-9]+", a) for a in args)
            if ev["logic"] not in ("either", "both", "not") or not ok \
                    or (len(args) != 1 if ev["logic"] == "not" else len(args) < 2):
                errs.append(f"{me}: logic needs \"args\": one event for not, two or more for either/both")
            else:
                for a in args:
                    strings(a, f"{me}.args", me)
        elif not isinstance(ev["formula"], str) or "$" in ev["formula"] or not ev["formula"].strip():
            errs.append(f"{me}: \"formula\" is the bare formula text, without dollar signs")
        if shape != ["verb"] and typ != "expressive" and ({"who", "what", "not"} & set(ev)):
            errs.append(f"{me}: who / what / not only go with \"verb\"")
        if ev.get("not", True) is not True:
            errs.append(f"{me}: \"not\" is either true or absent")
        for k in ("who", "what"):
            if k in ev and not (typ == "expressive" and k == "what"):
                strings(ev[k], f"{me}.{k}", me)
        if "tags" in ev:
            tags(ev["tags"], f"{me}.tags", me)
        fl = ev.get("flags", [])
        if not isinstance(fl, list) or any(f not in FLAGS for f in fl) \
                or [FLAGS.index(f) for f in fl if f in FLAGS] != sorted({FLAGS.index(f) for f in fl if f in FLAGS}):
            errs.append(f"{me}: flags must be unique, from {FLAGS}, in that order")

    for ev in evs:
        if isinstance(ev, dict) and ev.get("type") in ("unasserted", "embedded_question") \
                and ev.get("id") not in used_evs:
            errs.append(f"{ev.get('id')}: unasserted event is never referenced")
        if isinstance(ev, dict) and wh_in.get(ev.get("id")) and ev.get("type") not in ("question", "embedded_question"):
            errs.append(f"{ev.get('id')}: {wh_in[ev['id']][0]} is only allowed in a question")
    for eid in ent_ids:
        if isinstance(eid, str) and eid not in used_ents:
            errs.append(f"{eid}: declared but never used")
    seen = {}
    for eid in used_ents:                        # ids of a noun are 1, 2, 3, ... with no gaps
        lemma, num = eid.rsplit("-", 1)
        if int(num) != 0:
            seen.setdefault(lemma, set()).add(int(num))
    for lemma, nums in sorted(seen.items()):
        if nums != set(range(1, len(nums) + 1)):
            errs.append(f"{lemma}: ids must be 1, 2, 3, ... with no gaps, found {sorted(nums)}")
    return errs


def normalize(doc):
    """Drop what a model may spell out although it is the default: false, null, empty lists,
    "type": "fact". Sort flags. Lets a harmlessly verbose answer pass the strict checker."""
    def clean(o):
        if isinstance(o, dict):
            out = {k: clean(v) for k, v in o.items()}
            return {k: v for k, v in out.items()
                    if v is not None and v is not False and v != [] and not (k == "type" and v == "fact")}
        if isinstance(o, list):
            return [clean(v) for v in o]
        return o
    doc = clean(doc) if isinstance(doc, dict) else doc
    if isinstance(doc, dict):
        doc.setdefault("entities", [])
        doc.setdefault("events", [])
        for ev in doc["events"]:
            if isinstance(ev, dict) and isinstance(ev.get("flags"), list) and all(f in FLAGS for f in ev["flags"]):
                ev["flags"] = [f for f in FLAGS if f in ev["flags"]]
        doc["entities"] = [e for e in doc["entities"] if not (isinstance(e, dict) and set(e) == {"id"})]
    return doc


def parse_answer(text):
    """Model output -> dict. Tolerates a markdown fence or prose around the JSON object."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in the answer")
    return normalize(json.loads(text[start:end + 1]))


def slots(doc):
    """Multiset of comparable facts in a document; event references are replaced by the verb
    they point to, so a different but consistent numbering is not punished."""
    from collections import Counter
    anchors, seen = {}, Counter()
    for ev in doc["events"]:
        name = ev.get("verb") or ("formula" if "formula" in ev else ev.get("logic") or "expressive")
        seen[name] += 1
        anchors[ev["id"]] = f"{name}#{seen[name]}"

    def norm(v):
        if isinstance(v, dict):
            return json.dumps({k: (sorted(norm(i) for i in x) if k == "items" and v.get("join") != "alt"
                                   else [norm(i) for i in x] if k == "items" else x)
                               for k, x in sorted(v.items())})
        return "<" + anchors[v] + ">" if v in anchors else v

    out = Counter()
    for ev in doc["events"]:
        me = anchors[ev["id"]]
        out[("type", me, ev.get("type", "fact"))] += 1
        for k in ("who", "what", "formula", "logic"):
            if k in ev:
                out[(k, me, norm(ev[k]))] += 1
        if ev.get("not"):
            out[("not", me)] += 1
        for a in ev.get("args", []):
            out[("arg", me, norm(a))] += 1
        for t in ev.get("tags", []):
            out[("tag", me, t["label"], bool(t.get("not")), norm(t["value"]))] += 1
        for f in ev.get("flags", []):
            out[("flag", me, f)] += 1
    for e in doc["entities"]:
        if "quant" in e:
            out[("quant", e["id"], e["quant"])] += 1
        for a in e.get("adj", []):
            out[("adj", e["id"], a)] += 1
        if e.get("plural"):
            out[("plural", e["id"])] += 1
        for t in e.get("mods", []):
            out[("mod", e["id"], t["label"], bool(t.get("not")), norm(t["value"]))] += 1
    return out


def evaluate(gold_rows, pred_rows, show=0):
    """Rows: {"source", "json"} for gold, {"source", "output"} (raw model text) for predictions."""
    pred = {r["source"]: r["output"] for r in pred_rows}
    n = parsed = valid = exact = tp = n_pred = n_gold = 0
    wrong = []
    for row in gold_rows:
        n += 1
        g = row["json"]
        gs = slots(g)
        n_gold += sum(gs.values())
        try:
            p = parse_answer(pred.get(row["source"], ""))
            parsed += 1
        except (ValueError, json.JSONDecodeError) as e:
            wrong.append((row["source"], "not JSON: " + str(e)[:80], None))
            continue
        errs = check(p)
        if errs:
            wrong.append((row["source"], "invalid: " + errs[0], p))
            continue
        valid += 1
        ps = slots(p)
        n_pred += sum(ps.values())
        tp += sum((gs & ps).values())
        if ps == gs:
            exact += 1
        else:
            wrong.append((row["source"], "differs: -" + str(sorted((gs - ps).elements(), key=str))
                          + " +" + str(sorted((ps - gs).elements(), key=str)), p))
    prec = tp / n_pred if n_pred else 0.0
    rec = tp / n_gold if n_gold else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    print(f"texts {n} | parsed as JSON {parsed} | valid {valid} | same as reference {exact}")
    print(f"slot  P {prec:.1%}  R {rec:.1%}  F1 {f1:.1%}")
    for src, why, p in wrong[:show]:
        print(f"\n# {src}\n  {why}")
    return {"n": n, "parsed": parsed, "valid": valid, "exact": exact, "f1": f1, "wrong": wrong}


def dumps(doc):
    """Compact but readable: one entity or event per line."""
    def row(o):
        return json.dumps(o, ensure_ascii=False, separators=(", ", ": "))
    lines = ['{"entities": [' + (",\n   ".join(row(e) for e in doc["entities"])) + "],",
             ' "events": [' + (",\n   ".join(row(e) for e in doc["events"])) + "]}"]
    return "\n".join(lines)


def run_tests():
    import cnl_check
    blocks = cnl_check.read_blocks(HERE / "data" / "examples.txt")
    bad = n_cnl = n_json = 0
    for note, cnl in blocks:
        doc = to_json(cnl)
        errs = check(doc)
        n_cnl += len(cnl)
        n_json += len(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        if errs:
            bad += 1
            print(f"FAIL: {note}\n{dumps(doc)}\n -> {errs}\n")
    print(f"{len(blocks)} examples converted to JSON, {bad} fail the JSON checker")
    print(f"size: CNL-E {n_cnl} characters, minified JSON {n_json} characters "
          f"({n_json / n_cnl:.1f}x)")
    verbose = {"entities": [{"id": "report-1"}], "events": [
        {"id": "E1", "type": "fact", "who": "John", "not": False, "verb": "send", "what": "report-1",
         "tags": [], "flags": ["EMPH", "PAST"]}]}
    answer = "Here is the JSON:\n```json\n" + json.dumps(verbose) + "\n```"
    assert not check(parse_answer(answer)), "normalize() should make a verbose answer valid"
    return bad == 0


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--test":
        sys.exit(0 if run_tests() else 1)
    if len(sys.argv) in (4, 5) and sys.argv[1] == "--eval":
        rows = lambda p: [json.loads(ln) for ln in open(p, encoding="utf-8") if ln.strip()]
        evaluate(rows(sys.argv[2]), rows(sys.argv[3]), show=int(sys.argv[4]) if len(sys.argv) == 5 else 0)
        sys.exit(0)
    if len(sys.argv) == 3 and sys.argv[1] == "--check":
        problems = check(parse_answer(Path(sys.argv[2]).read_text()))
        print("\n".join(problems) if problems else "valid")
        sys.exit(1 if problems else 0)
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(dumps(to_json(Path(sys.argv[1]).read_text())))
