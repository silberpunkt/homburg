# PROWL: the sheet and the scroll. A sketch, not a finished reader.
#
# It reads Peirce sheets typed in the two forms set down in the note beside
# it, the inline form and the descended (preclosed) form, says what each one
# asserts by trying every case, and refuses the misspellings the note names.
# The descended form is read by the rule of User1's eyes, tentative as of
# 16 November 2026: one complicated thing per line. Its headwords are () for
# the cut and __ for the scroll, egg and stick.
#
#   python3 "prowl - the sheet and the scroll .sketch.py"
#       runs its own table of examples
#   python3 "prowl - the sheet and the scroll .sketch.py" "<the note> .txt"
#       also reads every sheet set as an example in the note (lines indented
#       four spaces or more) and reports any it has not got in its table
#
# One guess of the sketch's own, not a ruling of User1's: a name is letters
# and digits, and may hold an underbar, apostrophe or hyphen inside, never at
# either end.
#
# eniamb, November 2026.

import itertools
import re
import sys

NAME = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9_'\-]*[A-Za-z0-9'])?")


class Misspelt(Exception):
    pass


# ---------------------------------------------------------------- tokens

def tokens(text):
    """Marks and names. A space is wanted before every _( ; no space is
    ever imputed between two names."""
    out, i, aired = [], 0, True          # aired: start, or space just before
    while i < len(text):
        ch = text[i]
        two = text[i:i + 2]
        if ch in " \t\r\n":
            aired = True
            i += 1
            continue
        if two == "_[":
            out.append("_[")
            i += 2
        elif two == "]_":
            out.append("]_")
            i += 2
        elif two == "_(":
            if not aired:
                raise Misspelt("a space is wanted before _(")
            out.append("_(")
            i += 2
        elif two == "__":
            if text[i + 2:i + 3] == "_":
                raise Misspelt("three underbars; the stick is two")
            if not aired:
                raise Misspelt("a space is wanted before __")
            out.append("__")
            i += 2
        elif ch == "(" or ch == ")":
            out.append(ch)
            i += 1
        elif ch == "[" or ch == "]":
            raise Misspelt("a square bracket without its underbar")
        elif ch == "_":
            raise Misspelt("a loose underbar")
        else:
            m = NAME.match(text, i)
            if not m:
                raise Misspelt("not a mark and not a name: %r" % ch)
            out.append(("name", m.group(0)))
            i = m.end()
        aired = False
    return out


# ---------------------------------------------------------------- reading
# A name is ('n', name). A cut is ('c', scroll, [things]).

def things(toks, k):
    """Things side by side, up to a closing mark or the end."""
    got = []
    while k < len(toks):
        t = toks[k]
        if t == ")" or t == "]_":
            break
        if t == "_[":
            raise Misspelt("a sheet inside a sheet")
        if t == "__":
            raise Misspelt("__ belongs to the descended form; "
                           "in a line the scroll is _( )")
        if t == "(" or t == "_(":
            inner, k = things(toks, k + 1)
            if k >= len(toks) or toks[k] != ")":
                raise Misspelt("a cut left open")
            got.append(("c", t == "_(", inner))
            k += 1
        else:
            got.append(("n", t[1]))
            k += 1
    return got, k


def read_inline(text):
    toks = tokens(text)
    if not toks or toks[0] != "_[":
        raise Misspelt("a sheet opens with _[")
    got, k = things(toks, 1)
    if k >= len(toks) or toks[k] != "]_":
        raise Misspelt("a sheet closes with ]_")
    if k != len(toks) - 1:
        raise Misspelt("something stands after the closing ]_")
    return got


def read_preclosed(text):
    """The descended form, by the rule of User1's eyes: one complicated
    thing per line. _[]_ at the head. A line is either peers (names), or a
    headword leading the line and followed by what it holds. The headword
    also holds the lines indented beneath it. The headwords are () for the
    cut and __ for the scroll; _() is the scroll's long spelling. No pair
    holds anything between its own marks here: (r) is written () r."""
    rows = []
    for raw in text.split("\n"):
        if not raw.strip():
            continue                      # blank lines are air
        lead = raw[:len(raw) - len(raw.lstrip())]
        if "\t" in lead:
            raise Misspelt("the sketch wants spaces, not tabs, for the indent")
        rows.append((len(lead), raw.strip()))
    if not rows or rows[0][1] != "_[]_":
        raise Misspelt("a descended sheet opens with _[]_ on its own line")
    head = rows[0][0]
    rows = rows[1:]

    def only_names(toks, line):
        got = []
        for t in toks:
            if t == "(" or t == "_(" or t == "__":
                raise Misspelt("one complicated thing per line, and the "
                               "headword leads it: %r" % line)
            if t == ")":
                raise Misspelt("a closing mark with nothing to close: %r" % line)
            if t == "_[" or t == "]_":
                raise Misspelt("a sheet inside a sheet")
            got.append(("n", t[1]))
        return got

    def block(k, depth):
        got = []
        while k < len(rows):
            ind, line = rows[k]
            if ind < depth:
                break
            if ind > depth:
                raise Misspelt("indented lines with no owner: %r" % line)
            toks = tokens(line)
            k += 1
            if toks[0] == "__" or toks[0] == "(" or toks[0] == "_(":
                if toks[0] == "__":
                    after = toks[1:]          # the stick: two wide, like ()
                else:
                    if len(toks) < 2 or toks[1] != ")":
                        raise Misspelt("here a pair holds nothing between "
                                       "its marks; write () r and not (r): "
                                       "%r" % line)
                    after = toks[2:]
                inner = only_names(after, line)
                if k < len(rows) and rows[k][0] > depth:
                    beneath, k = block(k, rows[k][0])
                    inner = inner + beneath
                got.append(("c", toks[0] != "(", inner))
            else:
                got.extend(only_names(toks, line))
                if k < len(rows) and rows[k][0] > depth:
                    raise Misspelt("indented lines with no owner: %r" % rows[k][1])
        return got, k

    if not rows:
        return []
    if rows[0][0] <= head:
        raise Misspelt("the contents must be indented beneath _[]_")
    got, k = block(0, rows[0][0])
    if k != len(rows):
        raise Misspelt("a line outside the sheet: %r" % rows[k][1])
    return got


# ---------------------------------------------------------------- meaning

def shape(sheet):
    """The sheet with order taken out: there is no left or right on it."""
    def one(t):
        if t[0] == "n":
            return t
        return ("c", t[1], tuple(sorted((one(x) for x in t[2]), key=repr)))
    return tuple(sorted((one(x) for x in sheet), key=repr))


def names(sheet):
    found = set()

    def walk(ts):
        for t in ts:
            if t[0] == "n":
                found.add(t[1])
            else:
                walk(t[2])
    walk(sheet)
    return sorted(found)


def holds(sheet, case):
    def one(t):
        if t[0] == "n":
            return case[t[1]]
        return not all(one(x) for x in t[2])      # a cut denies its whole
    return all(one(x) for x in sheet)             # the sheet asserts each


def cases(ns):
    for bits in itertools.product([False, True], repeat=len(ns)):
        yield dict(zip(ns, bits))


def says(sheet, want):
    ns = names(sheet)
    return all(holds(sheet, c) == bool(want(c)) for c in cases(ns))


# ---------------------------------------------------------------- the table

TABLE = [
    ("_[ ]_", "true (the blank sheet)", lambda e: True),
    ("_[ () ]_", "false (the empty cut)", lambda e: False),
    ("_[ a ]_", "assert: a", lambda e: e["a"]),
    ("_[ (a) ]_", "deny: a", lambda e: not e["a"]),
    ("_[ _(a) ]_", "the sheet is true, unless a", lambda e: not e["a"]),
    ("_[ (p _(q)) ]_", "if p then q", lambda e: (not e["p"]) or e["q"]),
    ("_[ ( (p _(q)) (q _(p)) ) ]_", "p or q, not both",
     lambda e: e["p"] != e["q"]),
    ("_[ (p _(q)) (q _(p)) ]_", "p exactly when q",
     lambda e: e["p"] == e["q"]),
    ("_[ c d b (r) (z _(a)) ]_", "c, d, b; not r; if z then a",
     lambda e: e["c"] and e["d"] and e["b"] and not e["r"]
     and ((not e["z"]) or e["a"])),
    ("_[ ((p q)) ]_", "p q", lambda e: e["p"] and e["q"]),
    ("_[ (((p q))) ]_", "not both p and q",
     lambda e: not (e["p"] and e["q"])),
    ("_[ (r _(p q)) ]_", "if r then p and q",
     lambda e: (not e["r"]) or (e["p"] and e["q"])),
    ("_[ rain wet (dry) ]_", "rain, wet, not dry",
     lambda e: e["rain"] and e["wet"] and not e["dry"]),
    ("_[ rainwet (dry) ]_", "one thing called rainwet, not dry",
     lambda e: e["rainwet"] and not e["dry"]),
    ("_[ c d b (r) (z _(a e)) ]_", "c, d, b; not r; if z then a and e",
     lambda e: e["c"] and e["d"] and e["b"] and not e["r"]
     and ((not e["z"]) or (e["a"] and e["e"]))),
    ("_[ (z _( (y _(a)) )) ]_", "if z, then if y then a",
     lambda e: (not e["z"]) or (not e["y"]) or e["a"]),
    ("_[ c d b (r) (z) _(a) ]_", "c, d, b; not r; not z; unless a",
     lambda e: e["c"] and e["d"] and e["b"] and not e["r"]
     and not e["z"] and not e["a"]),
]

# Each row: forms that must be one and the same sheet.
SAME = [
    # air: tight, minimal with courtesy, airy, generous
    ["_[c d b(r)(z _(a))]_", "_[c d b (r)(z _(a))]_",
     "_[ c d b (r) (z _(a)) ]_", "_[ c d    b (r) (z _(a)) ]_"],
    # order on a level is air
    ["_[ c d b (r) (z _(a)) ]_", "_[ b d c (z _(a)) (r) ]_",
     "_[ (r) c ( _(a) z) b d ]_"],
    # the turn: _( may take the corner; the indent is for the eye
    ["_[ c d b (r) (z _(a)) ]_",
     "_[\n  c d b (r) (z _(\n    a\n  ))\n]_"],
    ["_[ c d b (r) (z _(a e)) ]_",
     "_[\n  c d b (r)\n  (z _(\n    a\n    e\n  ))\n]_"],
]

# Inline form, then its descent. Eyes' form first; a pair may also keep
# all it holds beneath it, and peers may be stacked.
DESCENT = [
    ("_[ ]_", "_[]_"),
    ("_[ () ]_", "_[]_\n  ()"),
    ("_[ a ]_", "_[]_\n  a"),
    ("_[ (a) ]_", "_[]_\n  () a"),
    ("_[ (a) ]_", "_[]_\n  ()\n    a"),
    ("_[ _(a) ]_", "_[]_\n  __ a"),
    ("_[ (p _(q)) ]_", "_[]_\n  () p\n    __ q"),
    ("_[ ( (p _(q)) (q _(p)) ) ]_",
     "_[]_\n  ()\n    () p\n      __ q\n    () q\n      __ p"),
    ("_[ (p _(q)) (q _(p)) ]_",
     "_[]_\n  () p\n    __ q\n  () q\n    __ p"),
    ("_[ c d b (r) (z _(a)) ]_",
     "_[]_\n  c d b\n  () r\n  () z\n    __ a"),
    ("_[ c d b (r) (z _(a)) ]_",
     "_[]_\n  c d b\n  ()\n    r\n  ()\n    z\n    __\n      a"),
    ("_[ c d b (r) (z _(a)) ]_",
     "_[]_\n  c\n  d\n  b\n  () r\n  () z\n    __ a"),
    ("_[ c d b (r) (z _(a e)) ]_",
     "_[]_\n  c d b\n  () r\n  () z\n    __ a e"),
    ("_[ c d b (r) (z _(a e)) ]_",
     "_[]_\n  c d b\n  () r\n  () z\n    __ a\n      e"),
    ("_[ (z _( (y _(a)) )) ]_",
     "_[]_\n  () z\n    __\n      () y\n        __ a"),
    # the long spelling of the scroll says the same
    ("_[ (p _(q)) ]_", "_[]_\n  () p\n    _() q"),
    ("_[ c d b (r) (z _(a)) ]_",
     "_[]_\n  c d b\n  () r\n  () z\n    _() a"),
    # one step of indent is another sheet
    ("_[ c d b (r) (z) _(a) ]_",
     "_[]_\n  c d b\n  () r\n  () z\n  __ a"),
]

REFUSED_INLINE = [
    ("_[ c d b_(n) ]_", "no space before _("),
    ("_[(p_(q))]_", "no space before _("),
    ("_[_(a)]_", "no space before _("),
    ("_[ a ]", "closing ]_ wanting"),
    ("[ a ]_", "opening _[ wanting"),
    ("_[ p_ (q) ]_", "a name ending in an underbar"),
    ("_[ (p _(q) ]_", "a cut left open"),
    ("_[ p) ]_", "a closing mark with nothing to close"),
    ("_[ a ]_ b", "something after the close"),
    ("_[ a _[ b ]_ ]_", "a sheet inside a sheet"),
    ("_[ (p __ q) ]_", "the stick in a line"),
]

REFUSED_PRECLOSED = [
    ("_[]_\n  r ()", "the headword does not lead its line"),
    ("_[]_\n  c d b (r)", "a pair among the peers"),
    ("_[]_\n  (r)", "a pair holding something between its marks"),
    ("_[]_\n  () z __ a", "two complicated things on one line"),
    ("_[]_\n  () z _() a", "two complicated things on one line"),
    ("_[]_\n  () z\n    _ a", "one underbar"),
    ("_[]_\n  () z\n    ___ a", "three underbars"),
    ("_[]_\n  () z _\n    () a", "the scroll mark broken across lines"),
    ("_[]_\n  a\n    b", "indented lines with no owner"),
    ("_[]\n  a", "head without its closing underbar"),
]


def run_table():
    bad = 0

    def line(ok, what):
        nonlocal bad
        if not ok:
            bad += 1
        print(("  ok   " if ok else "  FAIL ") + what)

    print("What each sheet says, every case tried:")
    for form, reading, want in TABLE:
        line(says(read_inline(form), want), "%-34s %s" % (form, reading))

    print("One and the same sheet:")
    for row in SAME:
        first = shape(read_inline(row[0]))
        for other in row[1:]:
            line(shape(read_inline(other)) == first,
                 "%r  =  %r" % (row[0], other))

    print("The descent:")
    for inline, pre in DESCENT:
        line(shape(read_inline(inline)) == shape(read_preclosed(pre)),
             "%-34s =  %r" % (inline, pre))

    print("Refused, as they should be:")
    for form, why in REFUSED_INLINE:
        try:
            read_inline(form)
            line(False, "%r was accepted (%s)" % (form, why))
        except Misspelt as e:
            line(True, "%-22r %s" % (form, e))
    for form, why in REFUSED_PRECLOSED:
        try:
            read_preclosed(form)
            line(False, "%r was accepted (%s)" % (form, why))
        except Misspelt as e:
            line(True, "%r  %s" % (form, e))
    return bad


# ---------------------------------------------------------------- the note

def read_note(path):
    """Every sheet set as an example in the note: lines indented four
    spaces or more. Each must read, and must be a sheet the table knows."""
    known = set()
    for form, _, _ in TABLE:
        known.add(shape(read_inline(form)))
    for row in SAME:
        known.add(shape(read_inline(row[0])))
    for inline, _ in DESCENT:
        known.add(shape(read_inline(inline)))

    text = open(path, encoding="utf-8").read()
    chunks, cur = [], []
    for raw in text.split("\n"):
        if raw.startswith("    ") and raw.strip():
            cur.append(raw)
        elif not raw.strip() and cur:
            cur.append("")                # a blank line inside an example
        else:
            if cur:
                chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)

    bad = seen = 0
    print("Sheets found in the note:")
    for chunk in chunks:
        while chunk and not chunk[-1].strip():
            chunk.pop()
        body = "\n".join(chunk)
        found = []
        if chunk[0].strip() == "_[]_":
            # preclosed sheets, one after another, parted by blank lines
            part = []
            for raw in chunk + [""]:
                if raw.strip() == "_[]_" and part:
                    found.append(("pre", "\n".join(part)))
                    part = [raw]
                else:
                    part.append(raw)
            if any(p.strip() for p in part):
                found.append(("pre", "\n".join(part)))
        else:
            for m in re.finditer(r"_\[.*?\]_", body, re.S):
                found.append(("inl", m.group(0)))
        for kind, form in found:
            seen += 1
            try:
                sheet = read_preclosed(form) if kind == "pre" else read_inline(form)
                ok = shape(sheet) in known
                if not ok:
                    bad += 1
                print(("  ok   " if ok else "  NOT IN TABLE ") + repr(form))
            except Misspelt as e:
                bad += 1
                print("  FAIL %r: %s" % (form, e))
    print("  %d sheets read from the note" % seen)
    return bad


if __name__ == "__main__":
    wrong = run_table()
    if len(sys.argv) > 1:
        wrong += read_note(sys.argv[1])
    print("All as expected." if not wrong else "%d NOT as expected." % wrong)
    sys.exit(1 if wrong else 0)
