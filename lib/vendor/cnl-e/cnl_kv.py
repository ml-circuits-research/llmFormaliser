#!/usr/bin/env python3
"""CNL-E line form (v0.2): the compact, keyword-based spelling.

    report-1 old; on=sale-1                                  <- ENTITY line
    sale-1 PLURAL
    E1 fact John say E2; time=yesterday; PAST                <- EVENT line
    E2 claim John send report-1; to=Mary; mode=probably; FUTURE
    E3 fact _ not finish report-1; PAST

ENTITY line   ID [QUANT] [ADJ ...]; label=value; ...; PLURAL
EVENT line    ID TYPE WHO [not] VERB [WHAT]; label=value; ...; FLAGS
              ID TYPE $formula$; ...                 a mathematical statement
              ID TYPE either E1 E2 | both E1 E2 | not E1
              ID interj WORDS; ...                   interjection, greeting, thanks

TYPE          fact         the speaker asserts it
              claim        said, believed, wanted, promised, a condition: not asserted
              question     direct question
              subquestion  question inside another event
              order        order, request, query
              interj       interjection, greeting, thanks, apology

Fields are separated by ";". A modifier on an entity line belongs to the NOUN, a modifier
on an event line belongs to the VERB: that is the whole attachment syntax.

The line form and the JSON form (cnl_json.py) are two spellings of one document; this
module converts both ways and reuses the JSON checker.

Usage:
    python3 cnl_kv.py --test                         # round-trip every example
    python3 cnl_kv.py --check answer.txt             # validate one model answer
    python3 cnl_kv.py --eval gold.jsonl pred.jsonl [N]   # score; rows {"source","kv"}; show N wrong
    python3 cnl_kv.py file.cnl                       # bracket form -> line form
"""
import json
import re
import sys
from pathlib import Path

import cnl_json

HERE = Path(__file__).parent
TYPE_OUT = {"fact": "fact", "unasserted": "claim", "question": "question",
            "embedded_question": "subquestion", "directive": "order", "expressive": "interj"}
TYPE_IN = {v: k for k, v in TYPE_OUT.items()}
FLAGS = cnl_json.FLAGS
_WORD = re.compile(r"[a-z][a-z0-9_']*")
_NUMQ = re.compile(r"(<=|>=|<|>|~)?[0-9]+(\.[0-9]+)?%?")
_RESERVED = {"you", "we", "this", "that", "and", "or", "not", "only", "even", "also"}


class KVError(ValueError):
    pass


# --------------------------------------------------------------------------- writing
def _val(v):
    if isinstance(v, dict):
        if "focus" in v:
            return v["focus"] + " " + v["items"][0]
        return {"and": " and ", "or": " or ", "alt": "|"}[v["join"]].join(v["items"])
    return v


def _tags(lst):
    return [f'{t["label"]}={"not " if t.get("not") else ""}{_val(t["value"])}' for t in lst]


def dumps(doc):
    out = []
    for e in doc.get("entities", []):
        head = " ".join(([e["quant"]] if "quant" in e else []) + e.get("adj", []))
        fields = ([head] if head else []) + _tags(e.get("mods", [])) + (["PLURAL"] if e.get("plural") else [])
        out.append(e["id"] + " " + "; ".join(fields))
    for ev in doc["events"]:
        if "verb" in ev:
            head = " ".join([_val(ev["who"])] + (["not"] if ev.get("not") else []) + [ev["verb"]]
                            + ([_val(ev["what"])] if "what" in ev else []))
        elif "formula" in ev:
            head = "$" + ev["formula"] + "$"
        elif "logic" in ev:
            head = ev["logic"] + " " + " ".join(ev["args"])
        else:
            head = ev["what"]
        fields = [head] + _tags(ev.get("tags", [])) + ([" ".join(ev["flags"])] if ev.get("flags") else [])
        out.append(f'{ev["id"]} {TYPE_OUT[ev.get("type", "fact")]} ' + "; ".join(fields))
    return "\n".join(out)


# --------------------------------------------------------------------------- reading
def _split(text, sep):
    """Split on sep (a char, or None for whitespace) outside "strings" and $formulas$."""
    parts, cur, quote = [], [], None
    for ch in text:
        if quote:
            cur.append(ch)
            if ch == quote:
                quote = None
        elif ch in '"$':
            quote = ch
            cur.append(ch)
        elif (ch.isspace() if sep is None else ch == sep):
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    if quote:
        raise KVError(f"unclosed {quote} in: {text.strip()}")
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()] if sep is None else [p.strip() for p in parts]


def _plain(tok):
    return bool(_WORD.fullmatch(tok)) and tok not in _RESERVED


def _value(tokens, where):
    """Tokens of one slot -> JSON value."""
    if not tokens:
        raise KVError(f"{where}: empty value")
    if tokens[0] in ("only", "even", "also") and len(tokens) == 2:
        return {"focus": tokens[0], "items": [tokens[1]]}
    if all(_plain(t) or t in ("and", "or") for t in tokens) and _plain(tokens[0]) and _plain(tokens[-1]):
        return " ".join(tokens)                                   # property words: "very long"
    if len(tokens) == 1:
        t = tokens[0]
        if "|" in t and not t.startswith(('"', "$")):
            return {"join": "alt", "items": t.split("|")}
        return t
    joins = set(tokens[1::2])
    if len(tokens) % 2 == 1 and len(joins) == 1 and joins <= {"and", "or"} and "|" not in "".join(tokens):
        return {"join": joins.pop(), "items": tokens[0::2]}
    raise KVError(f"{where}: cannot read value '{' '.join(tokens)}'")


def _tag(field, where):
    m = re.match(r"([a-z][a-z0-9_']*)=(.*)$", field, re.S)
    if not m:
        return None
    toks = _split(m.group(2), None)
    out = {"label": m.group(1)}
    if toks and toks[0] == "not" and len(toks) > 1:
        out["not"] = True
        toks = toks[1:]
    out["value"] = _value(toks, f"{where} {m.group(1)}=")
    return out


def parse(text):
    """Line form -> document dict. Raises KVError with a message a model can act on."""
    entities, events = [], []
    for n, raw in enumerate(text.strip().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("```"):
            continue
        fields = _split(line, ";")
        if any(not f for f in fields):
            raise KVError(f"line {n}: empty field (stray ';')")
        first = _split(fields[0], None)
        ident, rest = first[0], first[1:]
        where = f"line {n} ({ident})"
        if re.fullmatch(r"E[0-9]+", ident):
            if not rest or rest[0] not in TYPE_IN:
                raise KVError(f"{where}: after the id comes one of {sorted(TYPE_IN)}")
            ev = {"id": ident}
            if rest[0] != "fact":
                ev["type"] = TYPE_IN[rest[0]]
            head = rest[1:]
            if not head:
                raise KVError(f"{where}: nothing after the type")
            if rest[0] == "interj":
                ev["what"] = " ".join(head)
            elif len(head) == 1 and head[0].startswith("$") and head[0].endswith("$") and len(head[0]) > 2:
                ev["formula"] = head[0][1:-1].strip()
            elif head[0] in ("either", "both") or (head[0] == "not" and len(head) == 2
                                                    and re.fullmatch(r"E[0-9]+", head[1])):
                ev["logic"], ev["args"] = head[0], head[1:]
            else:
                i = 0                                             # WHO: everything up to "not" or the verb
                while i < len(head) and not (_plain(head[i]) or head[i] == "not"):
                    i += 1
                if i == 0:
                    if head[0] in cnl_json.BANNED:
                        hint = (f"'{head[0]}' is a pronoun or function word: write what it refers to, "
                                f"'_' for impersonal it, or '{head[0]}-1' if the text never says who")
                    else:
                        hint = (f"'{head[0]}' has no id: a noun (also everyone, nobody, something) is "
                                f"written '{head[0]}-1'; if it is the verb, WHO is missing (use _ or you)")
                    raise KVError(f"{where}: an event starts with WHO, then the verb. {hint}")
                ev["who"] = _value(head[:i], f"{where} who")
                if i < len(head) and head[i] == "not":
                    ev["not"] = True
                    i += 1
                if i >= len(head) or not _plain(head[i]):
                    raise KVError(f"{where}: no verb after WHO")
                ev["verb"] = head[i]
                if head[i + 1:]:
                    ev["what"] = _value(head[i + 1:], f"{where} what")
            tags, flags = [], []
            for f in fields[1:]:
                t = _tag(f, where)
                if t:
                    tags.append(t)                    # a flag before a label=value is tolerated;
                elif all(x in FLAGS for x in f.split()):          # dumps() writes flags last
                    flags += f.split()
                else:
                    raise KVError(f"{where}: field '{f}' is neither label=value nor flags {FLAGS}")
            if tags:
                ev["tags"] = tags
            if flags:
                ev["flags"] = [f for f in FLAGS if f in flags]
            events.append(ev)
        elif re.fullmatch(r"[a-z][a-z0-9_']*-[0-9]+", ident):
            if events:
                raise KVError(f"{where}: entity lines come before all event lines")
            ent = {"id": ident}
            todo = ([" ".join(rest)] if rest else []) + fields[1:]
            if not todo:
                continue                              # a bare "report-1" line says nothing: ignore it
            for k, f in enumerate(todo):
                t = _tag(f, where)
                if t:
                    ent.setdefault("mods", []).append(t)
                elif f == "PLURAL":
                    ent["plural"] = True
                elif k == 0 and rest:
                    words = f.split()
                    if words[0] in cnl_json.QUANTS or _NUMQ.fullmatch(words[0]):
                        ent["quant"], words = words[0], words[1:]
                    if words:
                        ent["adj"] = words
                else:
                    raise KVError(f"{where}: field '{f}' is neither label=value nor PLURAL")
            entities.append(ent)
        else:
            raise KVError(f"line {n}: a line starts with an event id (E1) or an entity id (report-1); "
                          f"found '{ident}'")
    if not events:
        raise KVError("no event lines")
    return {"entities": entities, "events": events}


def check(text):
    """Return a list of error strings; empty means the text is valid."""
    try:
        doc = parse(text)
    except KVError as e:
        return [str(e)]
    errs = cnl_json.check(doc)
    return [_rename(e) for e in errs]


def _rename(msg):
    for a, b in (("unasserted", "claim"), ("embedded_question", "subquestion"), ("directive", "order"),
                 ("expressive", "interj"), ('"mods"', "the entity line"), ('"tags"', "label=value fields"),
                 ('"entities"', "entity lines")):
        msg = msg.replace(a, b)
    return msg


def evaluate(gold_rows, pred_rows, show=0):
    """Rows: {"source", "kv"}. Prints validity, exact match and slot F1; returns the details."""
    pred = {r["source"]: r.get("kv") or "" for r in pred_rows}
    n = valid = exact = tp = n_pred = n_gold = 0
    wrong = []
    for row in gold_rows:
        n += 1
        g = parse(row["kv"])
        gs = cnl_json.slots(g)
        n_gold += sum(gs.values())
        text = pred.get(row["source"], "")
        errs = check(text) if text.strip() else ["no answer"]
        if errs:
            wrong.append((row["source"], "invalid: " + errs[0], text))
            continue
        valid += 1
        ps = cnl_json.slots(parse(text))
        n_pred += sum(ps.values())
        tp += sum((gs & ps).values())
        if ps == gs:
            exact += 1
        else:
            wrong.append((row["source"], "differs: -" + str(sorted((gs - ps).elements(), key=str))
                          + " +" + str(sorted((ps - gs).elements(), key=str)), text))
    prec = tp / n_pred if n_pred else 0.0
    rec = tp / n_gold if n_gold else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    print(f"texts {n} | valid {valid} | same as reference {exact} | "
          f"slot P {prec:.1%} R {rec:.1%} F1 {f1:.1%}")
    for src, why, text in wrong[:show]:
        print(f"\n# {src}\n{text}\n  -> {why}")
    return {"n": n, "valid": valid, "exact": exact, "f1": f1, "wrong": wrong}


def run_tests():
    import cnl_check
    blocks = cnl_check.read_blocks(HERE / "data" / "examples.txt")
    bad = n_cnl = n_kv = n_json = 0
    for note, cnl in blocks:
        doc = cnl_json.to_json(cnl)
        text = dumps(doc)
        n_cnl, n_kv = n_cnl + len(cnl), n_kv + len(text)
        n_json += len(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        try:
            back = parse(text)
            ok = cnl_json.slots(back) == cnl_json.slots(doc) and back == json.loads(json.dumps(doc)) \
                and not check(text) and dumps(back) == text
        except KVError as e:
            ok = False
            print("parse error:", e)
        if not ok:
            bad += 1
            print(f"FAIL: {note}\n{text}\n")
    print(f"{len(blocks)} examples: line form -> document -> line form, {bad} differ")
    print(f"size in characters: line form {n_kv}, bracket form {n_cnl}, JSON {n_json}")
    broken = {
        "unknown type": "E1 statement John leave; PAST",
        "old star syntax": "E1*: John leave [PAST]",
        "no verb": "E1 fact John",
        "starts with the verb": "E1 order close door-1",
        "unknown flag": "E1 fact John leave; YESTERDAY",
        "entity after events": "E1 fact John see man-1; PAST\nman-1 old",
        "article": "E1 fact John see the man-1",
        "pronoun": "E1 fact he leave",
        "claim nobody refers to": "E1 fact John leave\nE2 claim Mary stay",
        "missing event": "E1 fact John say E2",
        "variable outside a question": "E1 fact ?who leave",
        "unclosed formula": "E1 fact $x + 1 = 2",
        "PLURAL on an event": "E1 fact student-1 leave; PLURAL",
        "stray semicolon": "E1 fact John leave;; PAST",
    }
    missed = [name for name, text in broken.items() if not check(text)]
    print(f"{len(broken)} broken texts, {len(broken) - len(missed)} rejected" + (f"; ACCEPTED: {missed}" if missed else ""))
    sloppy = "man-1\nreport-1 old\nE1 fact man-1 send report-1; PAST; to=Rome; EMPH PERF"
    assert dumps(parse(sloppy)) == "report-1 old\nE1 fact man-1 send report-1; to=Rome; PAST PERF EMPH"
    return bad == 0 and not missed


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--test":
        sys.exit(0 if run_tests() else 1)
    if len(sys.argv) == 3 and sys.argv[1] == "--check":
        problems = check(Path(sys.argv[2]).read_text())
        print("\n".join(problems) if problems else "valid")
        sys.exit(1 if problems else 0)
    if len(sys.argv) in (4, 5) and sys.argv[1] == "--eval":
        rows = lambda p: [json.loads(ln) for ln in open(p, encoding="utf-8") if ln.strip()]
        evaluate(rows(sys.argv[2]), rows(sys.argv[3]), show=int(sys.argv[4]) if len(sys.argv) == 5 else 0)
        sys.exit(0)
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(dumps(cnl_json.to_json(Path(sys.argv[1]).read_text())))
