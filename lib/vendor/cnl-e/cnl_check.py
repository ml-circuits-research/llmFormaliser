#!/usr/bin/env python3
"""CNL-E validator: grammar (cnl.lark) + the consistency rules a grammar cannot express.

Usage:
    python3 cnl_check.py file.cnl        # validate one CNL text
    python3 cnl_check.py --test          # run data/examples.txt and data/invalid.txt
"""
import sys
from pathlib import Path
from lark import Lark, Token, Tree
from lark.exceptions import LarkError

HERE = Path(__file__).parent
PARSER = Lark((HERE / "cnl.lark").read_text(), parser="lalr", lexer="contextual")

# Words that must never survive into the CNL.
ARTICLES = {"a", "an", "the"}
PRONOUNS_3 = {"he", "she", "it", "they", "him", "her", "them", "his", "hers", "its",
              "their", "theirs", "himself", "herself", "itself", "themselves",
              "who", "whom", "which", "whose"}
AUXILIARIES = {"is", "are", "was", "were", "am", "been", "being", "do", "does", "did",
               "has", "had", "will", "would", "shall", "n't", "don't", "didn't", "isn't"}
FILLERS = {"um", "uh", "erm", "basically", "actually", "you_know", "i_mean"}
BANNED = ARTICLES | PRONOUNS_3 | AUXILIARIES | FILLERS

QUESTION_KINDS = {"question", "embedded_question"}


def check(text):
    """Return a list of error strings; empty list means the text is valid CNL-E."""
    try:
        tree = PARSER.parse(text.strip() + "\n")
    except LarkError as e:
        return ["grammar: " + str(e).strip().splitlines()[0]]

    errors, lines, order = [], {}, []
    for line in tree.children:
        label = str(line.children[0])
        if label in lines:
            errors.append(f"{label}: label defined twice")
        body = line.children[1:]
        toks = [t for part in body if isinstance(part, Tree)
                for t in part.scan_values(lambda v: isinstance(v, Token))]
        lines[label] = (line.data, toks)
        order.append(label)

    referenced = set()
    for label in order:
        kind, toks = lines[label]
        for t in toks:
            if t.type == "EVREF":
                if t == label:
                    errors.append(f"{label}: refers to itself")
                elif t not in lines:
                    errors.append(f"{label}: refers to {t}, which is not defined")
                referenced.add(str(t))
            elif t.type in ("WH", "WHQ") and kind not in QUESTION_KINDS:
                errors.append(f"{label}: {t} is only allowed on a question line (? or *?)")
            elif t.type == "WORD" and t.lower() in BANNED:
                errors.append(f"{label}: '{t}' must not appear in CNL (article, pronoun, auxiliary or filler)")
            elif t.type == "NAME" and t.lower() in BANNED:
                errors.append(f"{label}: '{t}' is an unresolved pronoun or function word, not a name")

    for label in order:
        kind, _ = lines[label]
        if kind in ("unasserted", "embedded_question") and label not in referenced:
            errors.append(f"{label}: unasserted event is never referenced by another line")

    # Canonical numbering (canon.py repairs these): events are E1, E2, ... in line order;
    # for each noun lemma the ids are introduced as 1, 2, 3, ... (0 = the kind, always allowed).
    if len(set(order)) == len(order) and order != [f"E{i}" for i in range(1, len(order) + 1)]:
        errors.append("numbering: events must be E1, E2, ... in line order")
    flag_order = ["PAST", "FUTURE", "PERF", "PROG", "HABIT", "POLITE", "EMPH"]
    for label in order:
        flags = [flag_order.index(t) for t in lines[label][1] if t.type == "FLAG"]
        if flags != sorted(set(flags)):
            errors.append(f"{label}: flags must be unique and in the order {' '.join(flag_order)}")
    seen = {}
    for label in order:
        for t in lines[label][1]:
            if t.type == "NOUN":
                lemma, num = t.rstrip("+").rsplit("-", 1)
                ids = seen.setdefault(lemma, [])
                if int(num) != 0 and int(num) not in ids:
                    if int(num) != len(ids) + 1:
                        errors.append(f"{label}: {t} should be {lemma}-{len(ids) + 1} "
                                      f"(ids of a noun are introduced as 1, 2, 3, ...)")
                    ids.append(int(num))
    return errors


def read_blocks(path):
    """Blocks are separated by blank lines; '#' lines are the NL source / comments."""
    blocks, cur = [], []
    for raw in Path(path).read_text().splitlines():
        if raw.strip():
            cur.append(raw)
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    out = []
    for b in blocks:
        cnl = "\n".join(l for l in b if not l.lstrip().startswith("#"))
        note = " ".join(l.lstrip("# ").strip() for l in b if l.lstrip().startswith("#"))
        if cnl.strip():
            out.append((note, cnl))
    return out


def run_tests():
    ok = True
    good = read_blocks(HERE / "data" / "examples.txt")
    bad = read_blocks(HERE / "data" / "invalid.txt")
    for note, cnl in good:
        errs = check(cnl)
        if errs:
            ok = False
            print(f"FAIL (should be valid): {note}\n{cnl}\n   -> {errs}\n")
    for note, cnl in bad:
        errs = check(cnl)
        if not errs:
            ok = False
            print(f"FAIL (should be rejected): {note}\n{cnl}\n")
    n_lines = sum(len(c.splitlines()) for _, c in good)
    print(f"valid examples: {len(good)} blocks, {n_lines} CNL lines | invalid examples: {len(bad)}")
    print("ALL TESTS PASSED" if ok else "SOME TESTS FAILED")
    return ok


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--test":
        sys.exit(0 if run_tests() else 1)
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    problems = check(Path(sys.argv[1]).read_text())
    print("\n".join(problems) if problems else "valid CNL-E")
    sys.exit(1 if problems else 0)
