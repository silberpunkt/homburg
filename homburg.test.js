/* homburg.test.js: checks of homburg.html's reader and picture, run without a browser.
     node homburg.test.js homburg.html
   It takes the parts of the page that need no page, tries every case of each sheet for its truth, sends each
   sheet out and back through both typed forms, tries the misspellings, and then measures the picture: every
   scroll touching its host at one point, a scroll on the sheet resting on the margin, everything else clear
   of every wall, nothing overlapping, nothing past the margin. eniamb, 16 xi 2026. */
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const a = html.indexOf("<script>") + 8, b = html.indexOf("/*END-OF-PARTS-WITHOUT-A-PAGE*/");
const m = { exports: {} };
new Function('module', html.slice(a, b))(m);
const H = m.exports;
let bad = 0, n = 0;
const ok = (c, what) => { n++; if (!c) { bad++; console.log('  FAIL ' + what); } };

const TABLE = [
 ["_[ ]_", e => true], ["_[ () ]_", e => false], ["_[ a ]_", e => e.a], ["_[ (a) ]_", e => !e.a], ["_[ _(a) ]_", e => !e.a],
 ["_[ (p _(q)) ]_", e => !e.p || e.q], ["_[ ( (p _(q)) (q _(p)) ) ]_", e => e.p !== e.q], ["_[ (p _(q)) (q _(p)) ]_", e => e.p === e.q],
 ["_[ c d b (r) (z _(a)) ]_", e => e.c && e.d && e.b && !e.r && (!e.z || e.a)], ["_[ ((p q)) ]_", e => e.p && e.q],
 ["_[ (((p q))) ]_", e => !(e.p && e.q)], ["_[ (r _(p q)) ]_", e => !e.r || (e.p && e.q)], ["_[ rain wet (dry) ]_", e => e.rain && e.wet && !e.dry],
 ["_[ c d b (r) (z _(a e)) ]_", e => e.c && e.d && e.b && !e.r && (!e.z || (e.a && e.e))], ["_[ (z _( (y _(a)) )) ]_", e => !e.z || !e.y || e.a],
 ["_[ c d b (r) (z) _(a) ]_", e => e.c && e.d && e.b && !e.r && !e.z && !e.a], ["_[ ((p _(q))) ]_", e => e.p && !e.q], ["_[ (p q) ]_", e => !(e.p && e.q)],
 ["_[ ( _(a) p _(b)) ]_", e => !(e.p && !e.a && !e.b)], ["_[ ( _(a) _(b) _(c)) ]_", e => e.a || e.b || e.c], ["_[ _(a) c _(b) ]_", e => !e.a && e.c && !e.b],
 ["_[ ( _(a) ) ]_", e => e.a], ["_[ (()) ]_", e => true], ["_[ antidisestablishment (x) ]_", e => e.antidisestablishment && !e.x],
];
for (const [form, want] of TABLE) {
  const s = H.readInline(form), ns = H.namesOf(s); let all = true;
  for (let k = 0; k < (1 << ns.length); k++) { const c = {}; ns.forEach((x, i) => c[x] = !!(k & (1 << i))); if (H.holds(s, c) !== !!want(c)) all = false; }
  ok(all, 'truth ' + form);
  // round trips: inline -> text -> inline, inline -> descended -> read
  ok(H.shapeKey(H.readInline(H.writeInline(s))) === H.shapeKey(s), 'inline round trip ' + form);
  let d; try { d = H.readDescended(H.writeDescended(s)); } catch (e) { d = null; console.log('   ', e.message); }
  ok(d && H.shapeKey(d) === H.shapeKey(s), 'descended round trip ' + form + '\n' + H.writeDescended(s));
}
const SAME = [["_[c d b(r)(z _(a))]_", "_[ c d    b (r) (z _(a)) ]_", "_[ b d c (z _(a)) (r) ]_", "_[ (r) c ( _(a) z) b d ]_", "_[\n  c d b (r) (z _(\n    a\n  ))\n]_"]];
for (const row of SAME) for (const o of row.slice(1)) ok(H.shapeKey(H.readInline(o)) === H.shapeKey(H.readInline(row[0])), 'same ' + o);
const DESC = [["_[ (p _(q)) ]_", "_[]_\n  () p\n    __ q"], ["_[ (p _(q)) ]_", "_[]_\n  () p\n    _() q"],
 ["_[ c d b (r) (z _(a)) ]_", "_[]_\n  c\n  d\n  b\n  ()\n    r\n  ()\n    z\n    __\n      a"], ["_[ c d b (r) (z) _(a) ]_", "_[]_\n  c d b\n  () r\n  () z\n  __ a"]];
for (const [i, d] of DESC) ok(H.shapeKey(H.readInline(i)) === H.shapeKey(H.readDescended(d)), 'descent ' + JSON.stringify(d));
const REF_I = ["_[ c d b_(n) ]_", "_[(p_(q))]_", "_[_(a)]_", "_[ a ]", "[ a ]_", "_[ p_ (q) ]_", "_[ (p _(q) ]_", "_[ p) ]_", "_[ a ]_ b", "_[ a _[ b ]_ ]_", "_[ (p __ q) ]_", "", "   ", "a"];
for (const f of REF_I) { let r = false, at; try { H.readInline(f); } catch (e) { r = e instanceof H.Misspelt; at = e.at; } ok(r && typeof at === 'number', 'refuse inline ' + JSON.stringify(f)); }
const REF_D = ["_[]_\n  r ()", "_[]_\n  c d b (r)", "_[]_\n  (r)", "_[]_\n  () z __ a", "_[]_\n  () z\n    _ a", "_[]_\n  () z\n    ___ a", "_[]_\n  a\n    b", "_[]\n  a"];
for (const f of REF_D) { let r = false; try { H.readDescended(f); } catch (e) { r = e instanceof H.Misspelt; } ok(r, 'refuse descended ' + JSON.stringify(f)); }
// solve: exactly the standing cases, each once, the most affirmed first
for (const [form] of TABLE) {
  const sh = H.readInline(form), sols = H.solutions(sh), cen = H.census(sh), ns = H.namesOf(sh);
  ok(sols.length === cen.stands && sols.every(c => H.holds(sh, c)), 'solutions are the standing cases ' + form);
  ok(new Set(sols.map(c => ns.map(x => +c[x]).join(''))).size === sols.length, 'no case twice ' + form);
  const score = c => ns.reduce((a, x, i) => a + (c[x] ? 1 << (ns.length - 1 - i) : 0), 0);
  ok(sols.every((c, i) => i === 0 || score(sols[i - 1]) > score(c)), 'most affirmed first ' + form);
}
// the sheet in words: the formula behind the words has the sheet's own truth in every case
for (const [form] of TABLE.concat([["_[ ( _(a) _(b)) ]_"], ["_[ (p _()) ]_"], ["_[ ( _() ) ]_"], ["_[ ((())) ]_"], ["_[ ( (p _(q)) (q _(p)) r ) ]_"], ["_[ (a (b c) _(d) _(e f)) g ]_"], ["_[ ((p _(q)) x) ]_"], ["_[ _(a) _(b c) ]_"], ["_[ ( (p _(q)) _(z) ) ]_"], ["_[ (p _(p)) ]_"], ["_[ (p _( (q _(p)) )) (q _(p)) ]_"]])) {
  const sh = H.readInline(form), f = H.sense(sh), ns = H.namesOf(sh); let same = true;
  for (let k = 0; k < (1 << ns.length); k++) { const c = {}; ns.forEach((x, i) => c[x] = !!(k & (1 << i))); if (H.weigh(f, c) !== H.holds(sh, c)) same = false; }
  ok(same, 'words mean what the sheet means ' + form + '  ->  ' + H.say(f));
}
const WORDS = [["_[ (p _(q)) (q _(p)) ]_", "p exactly when q"], ["_[ ( (p _(q)) (q _(p)) ) ]_", "p or q, not both"], ["_[ ]_", "true: the blank sheet"],
 ["_[ () ]_", "false: the empty cut"], ["_[ a ]_", "a"], ["_[ (a) ]_", "not a"], ["_[ _(a) ]_", "the sheet is true, unless a"], ["_[ (p _(q)) ]_", "if p then q"],
 ["_[ ((p _(q))) ]_", "p and not q"], ["_[ (p q) ]_", "not both p and q"], ["_[ ((p q)) ]_", "p and q"], ["_[ (r _(p q)) ]_", "if r then p and q"],
 ["_[ rain wet (dry) ]_", "rain, wet; not dry"], ["_[ c d b (r) (z _(a)) ]_", "c, d, b; not r; if z then a"], ["_[ c d b (r) (z) _(a) ]_", "c, d, b; not r; not z; unless a"],
 ["_[ c d b (r) (z _(a e)) ]_", "c, d, b; not r; if z then a and e"], ["_[ (z _( (y _(a)) )) ]_", "if z, then if y then a"], ["_[ ( _(a) _(b)) ]_", "a or b"],
 ["_[ (a (b c) _(d) _(e f)) g ]_", "g; if a and (not both b and c) then d or (e and f)"], ["_[ (p q r) ]_", "not all of p, q and r"]];
for (const [form, want] of WORDS) { const got = H.say(H.sense(H.readInline(form))); ok(got === want, 'words for ' + form + ': got "' + got + '", wanted "' + want + '"'); }
// sphere music: the honest light and the lap
{ const M2 = { F: 20, width: z => Math.max(11, z.length * 12) };
  for (const [form] of TABLE) {
    const sh = H.readInline(form), P = H.picture(sh, M2), ns = H.namesOf(sh), A = H.ambitOf(P);
    ok(A.a > 0 && A.b > 0 && A.cx - A.a > P.box.x && A.cx + A.a < P.box.x + P.box.w && A.cy - A.b >= P.box.y && A.cy + A.b <= P.box.y + P.box.h, 'the ambit lies inside the margin ' + form);
    const tables = [];
    for (let k = 0; k < (1 << ns.length); k++) {
      const c = {}; ns.forEach((x, i) => c[x] = !!(k & (1 << i)));
      const T = H.lapTable(P, sh, c, 512); tables.push(T);
      ok(T.length === 512 && T.every(v => v >= -1 && v <= 1 && Number.isFinite(v)), 'the lap is within bounds ' + form);
      // outside the margin there is no light; at a form's own rim, alone in its cell, the light is full and of its sign
      ok(H.lightAt(P, sh, c, P.box.x - 5, A.cy) === 0, 'grey outside the margin ' + form);
      for (const cut of P.cuts) {
        if (P.cuts.some(o => o.host === cut)) continue;               // only forms holding no other form
        const v = H.lightAt(P, sh, c, cut.cx, cut.cy - cut.r * 0.999), want = H.value(cut.n, c) ? 1 : -1;
        ok(Math.abs(v - want * 0.999) < 1e-6, 'full light of its own sign just inside the rim ' + form);
        ok(Math.abs(H.lightAt(P, sh, c, cut.cx, cut.cy)) < 1e-9, 'no light at its centre ' + form);
      }
      const sc = H.scoreOf(T);
      ok(sc.freq.length === 512 && sc.gain.length === 512 && sc.freq.every((f, i) => Math.abs(f - H.BASE * Math.pow(2, H.RANGE * T[i])) < 1e-3 && f >= H.BASE / 2 - 1e-3 && f <= H.BASE * 2 + 1e-3), 'pitch follows the grey: white high, black low ' + form);
      ok(sc.gain.every(g => g >= 0 && g <= 1 + 1e-6), 'loudness within bounds ' + form);
    }
    // the page alone answers to the verdict: all light flips when the verdict flips on a sheet of bare names
    if (form === "_[ a ]_") ok(tables[0].every((v, i) => Math.abs(v + tables[1][i]) < 1e-6), 'a bare name: the false case is the true case turned over');
    if (ns.length) ok(tables.some(T => T.some((v, i) => Math.abs(v - tables[0][i]) > 1e-6)), 'cases sound different ' + form);
  }
}
{ const flat = new Float32Array(64), sc = H.scoreOf(flat); ok(sc.gain.every(g => g === 0) && sc.freq.every(f => f === H.BASE), 'grey is silence');
  const w = new Float32Array(64).fill(1), b = new Float32Array(64).fill(-1);
  ok(Math.abs(H.scoreOf(w).freq[0] - 2 * H.BASE) < 1e-3 && Math.abs(H.scoreOf(b).freq[0] - H.BASE / 2) < 1e-3 && Math.abs(H.scoreOf(w).gain[5] - 1) < 1e-6, 'white an octave up, black an octave down, both at full voice'); }
// formalize: every sheet out into words and back; what returns has the truth of what left
{ const same = (a, b) => { const ns = [...new Set(H.namesOf(a).concat(H.namesOf(b)))]; for (let k = 0; k < (1 << ns.length); k++) { const c = {}; ns.forEach((x, i) => c[x] = !!(k & (1 << i))); if (H.holds(a, c) !== H.holds(b, c)) return false; } return true; };
  const back = sh => H.formalize(H.say(H.sense(sh)) + '.');
  for (const [form] of TABLE) { const sh = H.readInline(form); let r; try { r = back(sh); } catch (e) { r = null; } ok(r && same(sh, r), 'words and back ' + form + '  ->  ' + H.say(H.sense(sh)));
    if (r) ok(same(sh, H.readInline(H.writeInline(r))), 'and written as a line it reads ' + form); }
  // a few hundred sheets made by chance
  let seed = 20261117; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const NAMES = ['a', 'b', 'c', 'd', 'e', 'or', 'if', 'Not', 'true', 'and', 'then'];
  const make = d => { const n = Math.floor(rnd() * 4), kids = []; for (let i = 0; i < n; i++) { if (d < 3 && rnd() < 0.45) kids.push({ k: 'c', scroll: rnd() < 0.5, kids: make(d + 1) }); else kids.push({ k: 'n', v: NAMES[Math.floor(rnd() * NAMES.length)] }); } return kids; };
  let wrong = 0, first = '';
  for (let i = 0; i < 600; i++) { const sh = { kids: make(0) }; let r; try { r = back(sh); } catch (e) { r = null; } if (!(r && same(sh, r))) { wrong++; if (!first) first = H.writeInline(sh) + '  ->  ' + H.say(H.sense(sh)); } }
  ok(wrong === 0, wrong + ' of 600 chance sheets did not come back the same; the first: ' + first);
  // words written more freely than the page speaks them
  const FREE = [["c, d, b, not r and (if z then a and e).", "_[ c d b (r) (z _(a e)) ]_"], ["If P, then Q.", "_[ (P _(Q)) ]_"], ["p or q", "_[ ( _(p) _(q)) ]_"], ["not p", "_[ (p) ]_"],
    ["p and q; not r", "_[ p q (r) ]_"], ["p exactly when q", "_[ (p _(q)) (q _(p)) ]_"], ["p or q, not both", "_[ ( (p _(q)) (q _(p)) ) ]_"], ["not both p and q", "_[ (p q) ]_"],
    ["not all of p, q and r", "_[ (p q r) ]_"], ["the sheet is true, unless a, and unless b", "_[ _(a) _(b) ]_"], ["unless a", "_[ _(a) ]_"], ["true", "_[ ]_"], ["false", "_[ () ]_"],
    ["if p then (q or r)", "_[ (p _( ( _(q) _(r)) )) ]_"], ["rain, wet; not dry", "_[ rain wet (dry) ]_"], ["NOT (a AND b)", "_[ (a b) ]_"], ["if z, then if y then a", "_[ (z _( (y _(a)) )) ]_"], ["", "_[ ]_"]];
  for (const [words, form] of FREE) { let r; try { r = H.formalize(words); } catch (e) { r = null; } ok(r && same(r, H.readInline(form)), 'formalize ' + JSON.stringify(words)); }
  { const sh = H.readInline("_[ (rain _(or)) ]_"), words = H.say(H.sense(sh)); ok(words === "if rain then 'or'", 'a name that is a word of the grammar is said in quotes: ' + words); ok(same(sh, H.formalize(words + '.')), 'and read back');
    ok(same(H.formalize("'if' and 'Not', unless 'true'"), H.readInline("_[ if Not _(true) ]_")), 'quoted names of any spelling'); ok(H.say(H.sense(H.readInline("_[ (IF) ]_"))) === "not 'IF'", 'capitals too'); }
  for (const bad of ["if p", "p and", "(p", "p q", "not", "p ?", "if p then", "p )"]) { let threw = false; try { H.formalize(bad); } catch (e) { threw = e instanceof H.Misspelt && typeof e.at === 'number'; } ok(threw, 'refuses the words ' + JSON.stringify(bad)); }
}
// the other reading: turn every name over, and every form's truth turns over, in every sheet and case (De Morgan)
{ let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const make = d => { const n = Math.floor(rnd() * 4), kids = []; for (let i = 0; i < n; i++) { if (d < 3 && rnd() < 0.45) kids.push({ k: 'c', scroll: rnd() < 0.5, kids: make(d + 1) }); else kids.push({ k: 'n', v: 'abcde'[Math.floor(rnd() * 5)] }); } return kids; };
  const sheets = TABLE.map(([f]) => H.readInline(f)); for (let i = 0; i < 400; i++) sheets.push({ kids: make(0) });
  let wrong = 0;
  for (const sh of sheets) { const ns = H.namesOf(sh);
    for (let k = 0; k < (1 << ns.length); k++) { const c = {}, over = {}; ns.forEach((x, i) => { c[x] = !!(k & (1 << i)); over[x] = !c[x]; });
      if (H.holdsOther(sh, over) !== !H.holds(sh, c)) wrong++;
      (function walk(kids) { kids.forEach(n => { if (n.k === 'c') { if (H.valueOther(n, over) !== !H.value(n, c)) wrong++; walk(n.kids); } else if (H.valueOther(n, over) !== !H.value(n, c)) wrong++; }); })(sh.kids); } }
  ok(wrong === 0, 'read the other way with every name turned over, every form and every sheet turns over: ' + wrong + ' exceptions in ' + sheets.length + ' sheets');
  ok(H.holdsOther(H.readInline('_[ ]_'), {}) === false && H.holdsOther(H.readInline('_[ () ]_'), {}) === true && H.holdsOther(H.readInline('_[ a b ]_'), { a: true, b: false }) === true, 'the other reading: the blank sheet false, the empty cut true, side by side is or'); }
// places: at/end of every node cut the right text out of the line
{ const t = "_[ c d b (r) (z _(a e)) ]_", s = H.readInline(t);
  (function w(k) { k.forEach(x => { if (x.k === 'n') ok(t.slice(x.at, x.end) === x.v, 'place of ' + x.v); else { ok(/^_?\(/.test(t.slice(x.at, x.end)) && t[x.end - 1] === ')', 'place of cut ' + t.slice(x.at, x.end)); w(x.kids); } }); })(s.kids); }

// ---- the picture, measured ----
const M = { F: 20, width: s => Math.max(11, s.length * 12) };
const EPS = 0.02;
for (const room of [undefined, { w: 900, h: 500 }, { w: 420, h: 700 }, { w: 1600, h: 300 }]) for (const [form] of TABLE) {
  const s = H.readInline(form), P = H.picture(s, M, room);
  if (room) { ok(Math.abs(P.paper.w * P.scale - room.w) < 1e-6 && Math.abs(P.paper.h * P.scale - room.h) < 1e-6 && P.scale <= 2.6 + 1e-9, 'the paper is the pane, and the forms do not outgrow their limit ' + form);
    const A = H.ambitOf(P); ok(A.cx - A.a >= P.box.x && A.cx + A.a <= P.box.x + P.box.w && A.cx - A.a <= P.span.x0 + P.F * 0.31 && A.cx + A.a >= P.span.x1 - P.F * 0.31, 'the ambit follows the forms, inside the margin ' + form); }
  const byNode = new Map(); P.cuts.forEach(c => byNode.set(c.n, c));
  const inBox = (x, y) => x >= P.box.x - EPS && x <= P.box.x + P.box.w + EPS && y >= P.box.y - EPS && y <= P.box.y + P.box.h + EPS;
  ok(P.box.x > P.paper.x + 10 && P.box.x + P.box.w < P.paper.x + P.paper.w - 10, 'margin inside paper ' + form);
  const figs = kids => kids.map(k => k.k === 'c' ? byNode.get(k) : P.names.find(nm => nm.n === k));
  const span = f => f.r !== undefined ? [f.cx - f.r, f.cx + f.r] : [f.x - f.a, f.x + f.a];
  const check = (kids, host) => {
    const fs_ = figs(kids);
    fs_.forEach((f, i) => {
      ok(!!f, 'figure exists ' + form); if (!f) return;
      // siblings do not overlap
      fs_.forEach((g, j) => { if (j > i && g) { const A = span(f), B = span(g); ok(A[1] <= B[0] + EPS || B[1] <= A[0] + EPS, 'siblings clear ' + form); } });
      if (host) {
        if (f.r !== undefined) {
          const d = Math.abs(f.cx - host.cx) + f.r;
          if (f.touch) ok(Math.abs(d - host.r) < EPS && Math.abs(Math.hypot(f.touch.x - host.cx, f.touch.y - host.cy) - host.r) < EPS, 'scroll touches its cut ' + form + ' d=' + d + ' R=' + host.r);
          else ok(d < host.r - 3, 'cut clear of its host ' + form + ' d=' + d + ' R=' + host.r);
          ok(f.r < host.r - 3, 'inner smaller than host ' + form);
        } else {
          const d = Math.hypot(Math.abs(f.x - host.cx) + f.a, f.b);
          ok(d < host.r - 3, 'name clear of wall ' + form + ' ' + f.text + ' d=' + d + ' R=' + host.r);
        }
      } else {
        const sp = span(f), top = (f.r !== undefined ? f.cy - f.r : f.y - f.b), bot = (f.r !== undefined ? f.cy + f.r : f.y + f.b);
        ok(inBox(sp[0], top) && inBox(sp[1], bot), 'on the sheet within the margin ' + form);
        if (f.r !== undefined && f.touch) ok(Math.abs(sp[1] - (P.box.x + P.box.w)) < EPS || Math.abs(sp[0] - P.box.x) < EPS, 'sheet scroll rests on the margin ' + form);
        if (f.r !== undefined && !f.touch) ok(sp[0] > P.box.x + 3 && sp[1] < P.box.x + P.box.w - 3, 'plain cut clear of margin ' + form);
        if (f.r === undefined) ok(sp[0] > P.box.x + 3 && sp[1] < P.box.x + P.box.w - 3, 'name clear of margin ' + form);
      }
      if (f.r !== undefined) { ok(f.scroll ? (!!f.touch || f.free) : !f.touch, 'only scrolls touch ' + form); check(f.n.kids, f); }
    });
  };
  check(s.kids, null);
  ok(P.cuts.every(c => c.depth >= 1) && P.names.every(nm => nm.depth >= 0), 'depths ' + form);
}
console.log(bad ? bad + ' of ' + n + ' NOT as expected.' : 'All ' + n + ' checks as expected.');
process.exit(bad ? 1 : 0);
