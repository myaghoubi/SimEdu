/* ==========================================================================
   مفسر شبه‌پایتون (گام‌به‌گام)
   - تحلیلگر لغوی + نحوی برای زیرمجموعه‌ای از پایتون
   - اجرای مبتنی بر generator: هر دستور قبل از اجرا یک «رویداد خط» می‌دهد
   ========================================================================== */
(function (root) {
'use strict';

/* ------------------------------ خطاها ------------------------------ */
class PySyntaxError extends Error {
  constructor(msg, line, col) { super(msg); this.name = 'SyntaxError'; this.line = line; this.col = col || 0; }
}
class PyError extends Error {
  constructor(type, msg, line) { super(msg); this.pyType = type; this.line = line || 0; this.pyValue = null; this.frameSnap = null; }
}

/* ------------------------------ تحلیلگر لغوی ------------------------------ */
const KEYWORDS = new Set(['def', 'class', 'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is',
  'return', 'break', 'continue', 'pass', 'global', 'nonlocal', 'del', 'assert', 'raise', 'try', 'except',
  'finally', 'import', 'from', 'as', 'lambda', 'None', 'True', 'False']);
const OPS3 = ['**=', '//=', '>>=', '<<='];
const OPS2 = ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//', '**', '->', '<<', '>>', '&=', '|=', '^='];
const OPS1 = '+-*/%()[]{}:,.<>=&|^~@;';

function unescapeStr(s) {
  return s.replace(/\\(\n|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|.)/gs, (m, c) => {
    switch (c[0]) {
      case '\n': return '';
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '0': return '\0';
      case '\\': return '\\';
      case "'": return "'";
      case '"': return '"';
      case 'x': case 'u': return c.length > 1 ? String.fromCharCode(parseInt(c.slice(1), 16)) : m;
      default: return m;
    }
  });
}

function tokenize(src) {
  src = src.replace(/\r\n?/g, '\n');
  const toks = [], indents = [0];
  let i = 0, line = 1, paren = 0, atStart = true;
  const n = src.length;
  const push = (t, v, extra) => { const tk = { t, v, line, col: i }; if (extra) Object.assign(tk, extra); toks.push(tk); return tk; };
  const STR_RE = /([rRbBfFuU]{0,2})('''|"""|'|")/y;
  const NUM_RE = /0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  const NAME_RE = /[\p{L}_][\p{L}\p{N}_]*/uy;

  while (i < n) {
    if (atStart && paren === 0) {
      let col = 0, j = i;
      while (j < n && (src[j] === ' ' || src[j] === '\t')) { col += src[j] === '\t' ? 4 : 1; j++; }
      if (j >= n) { i = j; break; }
      if (src[j] === '\n') { i = j + 1; line++; continue; }
      if (src[j] === '#') { while (j < n && src[j] !== '\n') j++; i = j; continue; }
      i = j; atStart = false;
      if (col > indents[indents.length - 1]) { indents.push(col); push('indent'); }
      else {
        while (col < indents[indents.length - 1]) { indents.pop(); push('dedent'); }
        if (col !== indents[indents.length - 1]) throw new PySyntaxError('IndentationError: تورفتگی نامتناسب', line, col);
      }
    }
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\n') {
      if (paren > 0) { i++; line++; continue; }
      if (toks.length && toks[toks.length - 1].t !== 'nl') push('nl');
      i++; line++; atStart = true; continue;
    }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }

    STR_RE.lastIndex = i;
    const sm = STR_RE.exec(src);
    if (sm) {
      const prefix = sm[1].toLowerCase(), q = sm[2], startLine = line;
      let j = i + sm[0].length, body = '';
      if (q.length === 3) {
        const end = src.indexOf(q, j);
        if (end < 0) throw new PySyntaxError('رشتهٔ سه‌نقل‌قولی بسته نشده', line, i);
        body = src.slice(j, end); j = end + 3;
        line += (body.match(/\n/g) || []).length;
      } else {
        while (j < n && src[j] !== q) {
          if (src[j] === '\n') throw new PySyntaxError('رشته بسته نشده است', line, i);
          if (src[j] === '\\') { body += src[j] + (src[j + 1] || ''); j += 2; continue; }
          body += src[j++];
        }
        if (j >= n) throw new PySyntaxError('رشته بسته نشده است', line, i);
        j++;
      }
      const isRaw = prefix.includes('r');
      const tk = { t: prefix.includes('f') ? 'fstr' : 'str', col: i, line: startLine };
      tk.v = tk.t === 'fstr' ? body : (isRaw ? body : unescapeStr(body));
      tk.raw = isRaw;
      toks.push(tk);
      i = j; continue;
    }
    NUM_RE.lastIndex = i;
    const nm = (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) ? NUM_RE.exec(src) : null;
    if (nm) {
      const txt = nm[0].replace(/_/g, '');
      push('num', Number(txt), { isFloat: /[.eE]/.test(txt) && !/^0[xX]/.test(txt) });
      i += nm[0].length; continue;
    }
    NAME_RE.lastIndex = i;
    const am = NAME_RE.exec(src);
    if (am) { push('name', am[0]); i += am[0].length; continue; }
    const three = src.substr(i, 3), two = src.substr(i, 2);
    if (OPS3.includes(three)) { push('op', three); i += 3; continue; }
    if (OPS2.includes(two)) { push('op', two); i += 2; continue; }
    if (OPS1.includes(c)) {
      if ('([{'.includes(c)) paren++;
      else if (')]}'.includes(c)) paren = Math.max(0, paren - 1);
      push('op', c); i++; continue;
    }
    throw new PySyntaxError(`نویسهٔ نامعتبر «${c}»`, line, i);
  }
  if (toks.length && toks[toks.length - 1].t !== 'nl') push('nl');
  while (indents.length > 1) { indents.pop(); push('dedent'); }
  push('eof');
  return toks;
}

/* ------------------------------ تحلیلگر نحوی ------------------------------ */
const AUG_OPS = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '//=': '//', '%=': '%', '**=': '**', '&=': '&', '|=': '|', '^=': '^', '<<=': '<<', '>>=': '>>' };

class Parser {
  constructor(tokens) { this.t = tokens; this.p = 0; }
  get cur() { return this.t[this.p]; }
  peek(k = 1) { return this.t[Math.min(this.p + k, this.t.length - 1)]; }
  isOp(v) { const c = this.cur; return c.t === 'op' && c.v === v; }
  isKw(v) { const c = this.cur; return c.t === 'name' && c.v === v; }
  err(msg, tok) { tok = tok || this.cur; throw new PySyntaxError(msg, tok.line, tok.col); }
  next() { return this.t[this.p++]; }
  eatOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
  eatKw(v) { if (this.isKw(v)) { this.p++; return true; } return false; }
  expectOp(v) { if (!this.eatOp(v)) this.err(`انتظار «${v}» می‌رفت`); }
  expectKw(v) { if (!this.eatKw(v)) this.err(`انتظار «${v}» می‌رفت`); }
  expectName() {
    const c = this.cur;
    if (c.t !== 'name' || KEYWORDS.has(c.v)) this.err('انتظار نام می‌رفت');
    this.p++; return c.v;
  }
  skipNl() { while (this.cur.t === 'nl') this.p++; }

  parseProgram() {
    const body = [];
    this.skipNl();
    while (this.cur.t !== 'eof') {
      if (this.cur.t === 'indent') this.err('IndentationError: تورفتگی غیرمنتظره');
      body.push(...this.parseStatement());
      this.skipNl();
    }
    return { type: 'Module', body };
  }

  parseSuite() {
    this.expectOp(':');
    if (this.cur.t === 'nl') {
      this.next();
      this.skipNl();
      if (this.cur.t !== 'indent') this.err('IndentationError: بدنه با تورفتگی لازم است');
      this.next();
      const body = [];
      while (this.cur.t !== 'dedent' && this.cur.t !== 'eof') {
        body.push(...this.parseStatement());
        this.skipNl();
      }
      if (this.cur.t === 'dedent') this.next();
      return body;
    }
    return this.parseSimpleLine();
  }

  parseStatement() {
    const c = this.cur;
    if (c.t === 'name') {
      switch (c.v) {
        case 'if': return [this.parseIf()];
        case 'while': return [this.parseWhile()];
        case 'for': return [this.parseFor()];
        case 'def': return [this.parseDef()];
        case 'class': return [this.parseClass()];
        case 'try': return [this.parseTry()];
      }
    }
    return this.parseSimpleLine();
  }

  parseSimpleLine() {
    const out = [this.parseSimple()];
    while (this.eatOp(';')) { if (this.cur.t === 'nl') break; out.push(this.parseSimple()); }
    if (this.cur.t !== 'nl' && this.cur.t !== 'eof') this.err('دستور نامعتبر');
    if (this.cur.t === 'nl') this.next();
    return out;
  }

  parseIf() {
    const tok = this.next();
    const test = this.parseTest();
    const body = this.parseSuite();
    this.skipNl();
    let orelse = [];
    if (this.isKw('elif')) orelse = [this.parseIf()];
    else if (this.isKw('else')) { this.next(); orelse = this.parseSuite(); }
    return { type: 'If', line: tok.line, test, body, orelse };
  }
  parseWhile() {
    const tok = this.next();
    const test = this.parseTest();
    const body = this.parseSuite();
    return { type: 'While', line: tok.line, test, body };
  }
  parseTarget() {
    if (this.isOp('(') || this.isOp('[')) {
      const close = this.isOp('(') ? ')' : ']';
      const tok = this.next();
      const items = [];
      while (!this.isOp(close)) { items.push(this.parseTarget()); if (!this.eatOp(',')) break; }
      this.expectOp(close);
      return { type: 'Tuple', line: tok.line, items };
    }
    return this.parsePostfix();
  }
  parseTargetList() {
    const first = this.parseTarget();
    if (!this.isOp(',')) return first;
    const items = [first];
    while (this.eatOp(',')) { if (this.isKw('in')) break; items.push(this.parseTarget()); }
    return { type: 'Tuple', line: first.line, items };
  }
  parseFor() {
    const tok = this.next();
    const target = this.parseTargetList();
    this.expectKw('in');
    const iter = this.parseExprList();
    const body = this.parseSuite();
    return { type: 'For', line: tok.line, target, iter, body };
  }
  parseDef() {
    const tok = this.next();
    const name = this.expectName();
    this.expectOp('(');
    const params = [];
    while (!this.isOp(')')) {
      const pn = this.expectName();
      let def = null;
      if (this.eatOp(':')) this.parseTest();
      if (this.eatOp('=')) def = this.parseTest();
      params.push({ name: pn, def });
      if (!this.eatOp(',')) break;
    }
    this.expectOp(')');
    if (this.eatOp('->')) this.parseTest();
    const body = this.parseSuite();
    return { type: 'Def', line: tok.line, name, params, body };
  }
  parseClass() {
    const tok = this.next();
    const name = this.expectName();
    let base = null;
    if (this.eatOp('(')) {
      if (!this.isOp(')')) base = this.parseTest();
      this.expectOp(')');
    }
    const body = this.parseSuite();
    return { type: 'Class', line: tok.line, name, base, body };
  }
  parseTry() {
    const tok = this.next();
    const body = this.parseSuite();
    this.skipNl();
    const handlers = []; let fin = null;
    while (this.isKw('except')) {
      const ht = this.next();
      let type = null, name = null;
      if (!this.isOp(':')) {
        type = this.parseTest();
        if (this.eatKw('as')) name = this.expectName();
      }
      handlers.push({ line: ht.line, type, name, body: this.parseSuite() });
      this.skipNl();
    }
    if (this.isKw('finally')) { this.next(); fin = this.parseSuite(); }
    if (!handlers.length && !fin) this.err('try باید except یا finally داشته باشد');
    return { type: 'Try', line: tok.line, body, handlers, fin };
  }

  parseSimple() {
    const c = this.cur, line = c.line;
    if (c.t === 'name') {
      switch (c.v) {
        case 'return': {
          this.next();
          let expr = null;
          if (this.cur.t !== 'nl' && !this.isOp(';') && this.cur.t !== 'eof') expr = this.parseExprList();
          return { type: 'Return', line, expr };
        }
        case 'break': this.next(); return { type: 'Break', line };
        case 'continue': this.next(); return { type: 'Continue', line };
        case 'pass': this.next(); return { type: 'Pass', line };
        case 'global': case 'nonlocal': {
          this.next(); const names = [this.expectName()];
          while (this.eatOp(',')) names.push(this.expectName());
          return { type: c.v === 'global' ? 'Global' : 'Pass', line, names };
        }
        case 'del': {
          this.next(); const targets = [this.parsePostfix()];
          while (this.eatOp(',')) targets.push(this.parsePostfix());
          return { type: 'Del', line, targets };
        }
        case 'assert': {
          this.next(); const test = this.parseTest(); let msg = null;
          if (this.eatOp(',')) msg = this.parseTest();
          return { type: 'Assert', line, test, msg };
        }
        case 'raise': {
          this.next(); let expr = null;
          if (this.cur.t !== 'nl' && !this.isOp(';')) expr = this.parseTest();
          return { type: 'Raise', line, expr };
        }
        case 'import': case 'from': {
          while (this.cur.t !== 'nl' && this.cur.t !== 'eof') this.next();
          return { type: 'Pass', line };
        }
      }
    }
    const first = this.parseExprList();
    if (this.isOp(':') && first.type === 'Name') {       // x: int = 5
      this.next(); this.parseTest();
      if (this.eatOp('=')) return { type: 'Assign', line, targets: [first], value: this.parseExprList() };
      return { type: 'Pass', line };
    }
    if (this.isOp('=')) {
      const targets = [first]; let value;
      while (this.eatOp('=')) { value = this.parseExprList(); if (this.isOp('=')) targets.push(value); }
      for (const t of targets) this.checkTarget(t);
      return { type: 'Assign', line, targets, value };
    }
    if (this.cur.t === 'op' && AUG_OPS[this.cur.v]) {
      const op = AUG_OPS[this.next().v];
      this.checkTarget(first);
      return { type: 'AugAssign', line, target: first, op, value: this.parseExprList() };
    }
    return { type: 'ExprStmt', line, expr: first };
  }
  checkTarget(t) {
    if (t.type === 'Name' || t.type === 'Attr' || t.type === 'Index') return;
    if (t.type === 'Tuple' || t.type === 'List') { t.items.forEach(x => this.checkTarget(x)); return; }
    throw new PySyntaxError('نمی‌توان به این عبارت مقدار داد', t.line, 0);
  }

  /* ---- عبارت‌ها ---- */
  parseExprList() {
    const first = this.parseTest();
    if (!this.isOp(',')) return first;
    const items = [first];
    while (this.eatOp(',')) {
      if (this.cur.t === 'nl' || this.isOp('=') || this.isOp(')') || this.isOp(']') || this.isOp(':') || this.cur.t === 'eof') break;
      items.push(this.parseTest());
    }
    return { type: 'Tuple', line: first.line, items };
  }
  parseTest() {
    if (this.isKw('lambda')) {
      const tok = this.next();
      const params = [];
      while (!this.isOp(':')) {
        const pn = this.expectName(); let def = null;
        if (this.eatOp('=')) def = this.parseTest();
        params.push({ name: pn, def });
        if (!this.eatOp(',')) break;
      }
      this.expectOp(':');
      const e = this.parseTest();
      return { type: 'Lambda', line: tok.line, params, body: [{ type: 'Return', line: tok.line, expr: e, silent: true }] };
    }
    const e = this.parseOr();
    if (this.isKw('if')) {
      this.next();
      const cond = this.parseOr();
      this.expectKw('else');
      const other = this.parseTest();
      return { type: 'IfExp', line: e.line, cond, a: e, b: other };
    }
    return e;
  }
  parseOr() {
    let l = this.parseAnd();
    while (this.isKw('or')) { this.next(); l = { type: 'BoolOp', op: 'or', line: l.line, a: l, b: this.parseAnd() }; }
    return l;
  }
  parseAnd() {
    let l = this.parseNot();
    while (this.isKw('and')) { this.next(); l = { type: 'BoolOp', op: 'and', line: l.line, a: l, b: this.parseNot() }; }
    return l;
  }
  parseNot() {
    if (this.isKw('not')) { const tok = this.next(); return { type: 'Not', line: tok.line, e: this.parseNot() }; }
    return this.parseCompare();
  }
  parseCompare() {
    const left = this.parseBitOr();
    const ops = [], rights = [];
    for (;;) {
      const c = this.cur; let op = null;
      if (c.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(c.v)) { op = c.v; this.next(); }
      else if (c.t === 'name' && c.v === 'in') { op = 'in'; this.next(); }
      else if (c.t === 'name' && c.v === 'not' && this.peek().t === 'name' && this.peek().v === 'in') { op = 'not in'; this.next(); this.next(); }
      else if (c.t === 'name' && c.v === 'is') {
        this.next();
        if (this.eatKw('not')) op = 'is not'; else op = 'is';
      }
      if (!op) break;
      ops.push(op); rights.push(this.parseBitOr());
    }
    if (!ops.length) return left;
    return { type: 'Compare', line: left.line, left, ops, rights };
  }
  binLevel(next, ops) {
    let l = next.call(this);
    while (this.cur.t === 'op' && ops.includes(this.cur.v)) {
      const op = this.next().v;
      l = { type: 'BinOp', op, line: l.line, a: l, b: next.call(this) };
    }
    return l;
  }
  parseBitOr() { return this.binLevel(this.parseBitXor, ['|']); }
  parseBitXor() { return this.binLevel(this.parseBitAnd, ['^']); }
  parseBitAnd() { return this.binLevel(this.parseShift, ['&']); }
  parseShift() { return this.binLevel(this.parseArith, ['<<', '>>']); }
  parseArith() { return this.binLevel(this.parseTerm, ['+', '-']); }
  parseTerm() { return this.binLevel(this.parseFactor, ['*', '/', '//', '%']); }
  parseFactor() {
    if (this.cur.t === 'op' && (this.cur.v === '-' || this.cur.v === '+' || this.cur.v === '~')) {
      const tok = this.next();
      return { type: 'Unary', op: tok.v, line: tok.line, e: this.parseFactor() };
    }
    return this.parsePower();
  }
  parsePower() {
    const base = this.parsePostfix();
    if (this.isOp('**')) { this.next(); return { type: 'BinOp', op: '**', line: base.line, a: base, b: this.parseFactor() }; }
    return base;
  }
  parsePostfix() {
    let e = this.parseAtom();
    for (;;) {
      if (this.isOp('(')) {
        const tok = this.next();
        const args = [], kwargs = [];
        while (!this.isOp(')')) {
          if (this.cur.t === 'name' && this.peek().t === 'op' && this.peek().v === '=' && !KEYWORDS.has(this.cur.v)) {
            const k = this.next().v; this.next();
            kwargs.push([k, this.parseTest()]);
          } else {
            const a = this.parseTest();
            if (this.isKw('for')) args.push(this.parseCompRest({ type: 'ListComp', line: a.line, elt: a }));
            else args.push(a);
          }
          if (!this.eatOp(',')) break;
        }
        this.expectOp(')');
        e = { type: 'Call', line: tok.line, func: e, args, kwargs };
      } else if (this.isOp('[')) {
        const tok = this.next();
        const idx = this.parseSubscript();
        this.expectOp(']');
        e = { type: 'Index', line: tok.line, obj: e, idx };
      } else if (this.isOp('.')) {
        this.next();
        const nt = this.cur;
        if (nt.t !== 'name') this.err('انتظار نام ویژگی می‌رفت');
        this.next();
        e = { type: 'Attr', line: nt.line, obj: e, name: nt.v };
      } else break;
    }
    return e;
  }
  parseSubscript() {
    const parts = [];
    for (;;) {
      let lo = null, hi = null, step = null, isSlice = false;
      if (!this.isOp(':')) lo = this.parseTest();
      if (this.isOp(':')) {
        isSlice = true; this.next();
        if (!this.isOp(']') && !this.isOp(',') && !this.isOp(':')) hi = this.parseTest();
        if (this.eatOp(':')) { if (!this.isOp(']') && !this.isOp(',')) step = this.parseTest(); }
      }
      parts.push(isSlice ? { type: 'Slice', line: this.cur.line, lo, hi, step } : lo);
      if (!this.eatOp(',')) break;
      if (this.isOp(']')) break;
    }
    return parts.length === 1 ? parts[0] : { type: 'Tuple', line: parts[0].line, items: parts };
  }
  parseCompRest(node) {
    node.clauses = [];
    while (this.isKw('for')) {
      this.next();
      const target = this.parseTargetList();
      this.expectKw('in');
      const iter = this.parseOr();
      const conds = [];
      while (this.isKw('if')) { this.next(); conds.push(this.parseOr()); }
      node.clauses.push({ target, iter, conds });
    }
    return node;
  }
  parseAtom() {
    const c = this.cur, line = c.line;
    switch (c.t) {
      case 'num': this.next(); return { type: 'Num', line, v: c.v, isFloat: c.isFloat };
      case 'str': case 'fstr': {
        const parts = [];
        let anyF = false;
        while (this.cur.t === 'str' || this.cur.t === 'fstr') {
          const tk = this.next();
          if (tk.t === 'str') parts.push(tk.v);
          else { anyF = true; parts.push(...this.parseFString(tk)); }
        }
        if (!anyF) return { type: 'Str', line, v: parts.join('') };
        return { type: 'FStr', line, parts };
      }
      case 'name': {
        if (c.v === 'None') { this.next(); return { type: 'Const', line, v: null }; }
        if (c.v === 'True') { this.next(); return { type: 'Const', line, v: true }; }
        if (c.v === 'False') { this.next(); return { type: 'Const', line, v: false }; }
        if (KEYWORDS.has(c.v)) this.err(`کلمهٔ کلیدی «${c.v}» اینجا مجاز نیست`);
        this.next(); return { type: 'Name', line, name: c.v };
      }
      case 'op': {
        if (c.v === '(') {
          this.next();
          if (this.eatOp(')')) return { type: 'Tuple', line, items: [], paren: true };
          const first = this.parseTest();
          if (this.isKw('for')) { const r = this.parseCompRest({ type: 'ListComp', line, elt: first }); this.expectOp(')'); return r; }
          if (this.isOp(',')) {
            const items = [first];
            while (this.eatOp(',')) { if (this.isOp(')')) break; items.push(this.parseTest()); }
            this.expectOp(')');
            return { type: 'Tuple', line, items, paren: true };
          }
          this.expectOp(')');
          return first;
        }
        if (c.v === '[') {
          this.next();
          if (this.eatOp(']')) return { type: 'List', line, items: [] };
          const first = this.parseTest();
          if (this.isKw('for')) { const r = this.parseCompRest({ type: 'ListComp', line, elt: first }); this.expectOp(']'); return r; }
          const items = [first];
          while (this.eatOp(',')) { if (this.isOp(']')) break; items.push(this.parseTest()); }
          this.expectOp(']');
          return { type: 'List', line, items };
        }
        if (c.v === '{') {
          this.next();
          if (this.eatOp('}')) return { type: 'Dict', line, pairs: [] };
          const first = this.parseTest();
          if (this.eatOp(':')) {
            const val = this.parseTest();
            if (this.isKw('for')) { const r = this.parseCompRest({ type: 'DictComp', line, key: first, val }); this.expectOp('}'); return r; }
            const pairs = [[first, val]];
            while (this.eatOp(',')) { if (this.isOp('}')) break; const k = this.parseTest(); this.expectOp(':'); pairs.push([k, this.parseTest()]); }
            this.expectOp('}');
            return { type: 'Dict', line, pairs };
          }
          if (this.isKw('for')) { const r = this.parseCompRest({ type: 'SetComp', line, elt: first }); this.expectOp('}'); return r; }
          const items = [first];
          while (this.eatOp(',')) { if (this.isOp('}')) break; items.push(this.parseTest()); }
          this.expectOp('}');
          return { type: 'SetLit', line, items };
        }
      }
    }
    this.err(c.t === 'nl' || c.t === 'eof' ? 'عبارت ناقص است' : `نشانهٔ غیرمنتظره «${c.v === undefined ? c.t : c.v}»`);
  }

  parseFString(tok) {
    const raw = tok.v, parts = [];
    let lit = '', i = 0;
    const flush = () => { if (lit) { parts.push(tok.raw ? lit : unescapeStr(lit)); lit = ''; } };
    while (i < raw.length) {
      const c = raw[i];
      if (c === '{') {
        if (raw[i + 1] === '{') { lit += '{'; i += 2; continue; }
        let depth = 0, j = i + 1, q = null;
        for (; j < raw.length; j++) {
          const d = raw[j];
          if (q) { if (d === '\\') j++; else if (d === q) q = null; continue; }
          if (d === '"' || d === "'") { q = d; continue; }
          if ('([{'.includes(d)) depth++;
          else if (')]}'.includes(d)) { if (depth === 0 && d === '}') break; depth--; }
          else if (depth === 0 && (d === ':' || (d === '!' && raw[j + 1] !== '='))) break;
        }
        if (j >= raw.length) throw new PySyntaxError('f-string: «}» بسته نشده', tok.line, tok.col);
        const exprText = raw.slice(i + 1, j).trim();
        let conv = null, spec = '';
        if (raw[j] === '!') { conv = raw[j + 1]; j += 2; }
        if (raw[j] === ':') {
          const e = raw.indexOf('}', j);
          if (e < 0) throw new PySyntaxError('f-string: «}» بسته نشده', tok.line, tok.col);
          spec = raw.slice(j + 1, e); j = e;
        }
        if (raw[j] !== '}') throw new PySyntaxError('f-string نامعتبر', tok.line, tok.col);
        if (!exprText) throw new PySyntaxError('f-string: عبارت خالی', tok.line, tok.col);
        flush();
        parts.push({ expr: parseExprString(exprText, tok.line), spec, conv });
        i = j + 1; continue;
      }
      if (c === '}') { if (raw[i + 1] === '}') { lit += '}'; i += 2; continue; } throw new PySyntaxError('f-string: «}» تنها مجاز نیست', tok.line, tok.col); }
      lit += c; i++;
    }
    flush();
    return parts;
  }
}

function parseExprString(text, line) {
  const toks = tokenize('(' + text + ')');
  toks.forEach(t => { t.line = line; });
  const p = new Parser(toks);
  const e = p.parseTest();
  if (p.cur.t !== 'nl' && p.cur.t !== 'eof') p.err('f-string نامعتبر');
  return e;
}

function parse(src) { return new Parser(tokenize(src)).parseProgram(); }

/* ------------------------------ ارزش‌ها ------------------------------ */
class Scope {
  constructor(parent, name) { this.vars = new Map(); this.parent = parent; this.name = name; this.globalNames = null; }
  lookup(name) { for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s; return null; }
}
class PyClass { constructor(name, base) { this.name = name; this.base = base; this.attrs = new Map(); } }
class PyObj { constructor(cls, id) { this.cls = cls; this.attrs = new Map(); this.id = id; } }
class PyFunc { constructor(name, params, body, closure, line) { this.name = name; this.params = params; this.body = body; this.closure = closure; this.line = line; this.defaults = []; this.homeClass = null; } }
class BoundMethod { constructor(func, self) { this.func = func; this.self = self; } }
class Builtin { constructor(name, fn) { this.name = name; this.fn = fn; } }
class PyRange { constructor(start, stop, step) { this.start = start; this.stop = stop; this.step = step; } get length() { const n = Math.ceil((this.stop - this.start) / this.step); return Math.max(0, n); } at(i) { return this.start + i * this.step; } }
class SuperProxy { constructor(self, cls) { this.self = self; this.cls = cls; } }
class Ret { constructor(v) { this.v = v; } }
const BREAK = { sig: 'break' }, CONTINUE = { sig: 'continue' };

function hk(v) {                       // کلید درهم‌سازی
  if (Array.isArray(v)) return 'T' + v.map(x => { const k = hk(x); return typeof k === 'object' ? '#o' : typeof k + ':' + String(k); }).join('\u0001');
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  return v;
}
class PyDict {
  constructor(id) { this.m = new Map(); this.id = id; }
  get size() { return this.m.size; }
  has(k) { return this.m.has(hk(k)); }
  get(k) { const e = this.m.get(hk(k)); return e ? e[1] : undefined; }
  set(k, v) { const h = hk(k), e = this.m.get(h); if (e) e[1] = v; else this.m.set(h, [k, v]); }
  delete(k) { return this.m.delete(hk(k)); }
  keys() { return [...this.m.values()].map(e => e[0]); }
  values() { return [...this.m.values()].map(e => e[1]); }
  entries() { return [...this.m.values()].map(e => [e[0], e[1]]); }
}
class PySet {
  constructor(id) { this.m = new Map(); this.id = id; }
  get size() { return this.m.size; }
  has(k) { return this.m.has(hk(k)); }
  add(k) { const h = hk(k); if (!this.m.has(h)) this.m.set(h, k); }
  delete(k) { return this.m.delete(hk(k)); }
  values() { return [...this.m.values()]; }
}
const mkTuple = a => { a.isTuple = true; return a; };

function typeName(v) {
  if (v === null || v === undefined) return 'NoneType';
  switch (typeof v) {
    case 'boolean': return 'bool';
    case 'number': return Number.isInteger(v) ? 'int' : 'float';
    case 'string': return 'str';
  }
  if (Array.isArray(v)) return v.isTuple ? 'tuple' : 'list';
  if (v instanceof PyDict) return 'dict';
  if (v instanceof PySet) return 'set';
  if (v instanceof PyObj) return v.cls.name;
  if (v instanceof PyFunc || v instanceof BoundMethod) return 'function';
  if (v instanceof Builtin) return 'builtin_function_or_method';
  if (v instanceof PyClass) return 'type';
  if (v instanceof PyRange) return 'range';
  return 'object';
}

function fmtFloat(v) {
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (Number.isNaN(v)) return 'nan';
  return String(v);
}
function subclassOf(cls, base) { for (let c = cls; c; c = c.base) if (c === base) return true; return false; }
function findInClass(cls, name) { for (let c = cls; c; c = c.base) if (c.attrs.has(name)) return { v: c.attrs.get(name), cls: c }; return null; }

function eq(a, b) {
  if (a === b) return true;
  if (typeof a === 'boolean') a = +a;
  if (typeof b === 'boolean') b = +b;
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length || !!a.isTuple !== !!b.isTuple) return false;
    for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
    return true;
  }
  if (a instanceof PyDict && b instanceof PyDict) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a.entries()) { if (!b.has(k) || !eq(v, b.get(k))) return false; }
    return true;
  }
  if (a instanceof PySet && b instanceof PySet) {
    if (a.size !== b.size) return false;
    return a.values().every(x => b.has(x));
  }
  return false;
}
function cmpErr(op, a, b) {
  return new PyError('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
}
function lt(a, b, op) {
  if (typeof a === 'boolean') a = +a;
  if (typeof b === 'boolean') b = +b;
  if ((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')) return a < b;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { if (!eq(a[i], b[i])) return lt(a[i], b[i], op); }
    return a.length < b.length;
  }
  throw cmpErr(op || '<', a, b);
}
function truthy(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof PyDict || v instanceof PySet) return v.size > 0;
  if (v instanceof PyRange) return v.length > 0;
  return true;
}

/* ------------------------------ قالب‌بندی ------------------------------ */
function addCommas(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatSpec(v, spec, interp) {
  if (!spec) return interp.str(v);
  const m = /^(?:(.)?([<>^=]))?([+\- ])?(#)?(0)?(\d+)?(,)?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/s.exec(spec);
  if (!m) throw new PyError('ValueError', 'Invalid format specifier');
  let [, fill, align, sign, , zero, width, comma, prec, type] = m;
  const isNum = typeof v === 'number' || typeof v === 'boolean';
  let body;
  if (isNum && type !== 's') {
    let x = +v;
    const neg = x < 0 || Object.is(x, -0); const ax = Math.abs(x);
    switch (type) {
      case 'f': case 'F': body = ax.toFixed(prec === undefined ? 6 : +prec); break;
      case 'e': case 'E': body = ax.toExponential(prec === undefined ? 6 : +prec).replace(/e([+-])(\d)$/, 'e$10$2'); break;
      case '%': body = (ax * 100).toFixed(prec === undefined ? 6 : +prec) + '%'; break;
      case 'x': body = Math.trunc(ax).toString(16); break;
      case 'X': body = Math.trunc(ax).toString(16).toUpperCase(); break;
      case 'b': body = Math.trunc(ax).toString(2); break;
      case 'o': body = Math.trunc(ax).toString(8); break;
      case 'd': body = String(Math.trunc(ax)); break;
      default: body = prec !== undefined ? String(Number(ax.toPrecision(+prec))) : fmtFloat(ax);
    }
    if (comma) { const [ip, fp] = body.split('.'); body = addCommas(ip) + (fp ? '.' + fp : ''); }
    const sg = neg ? '-' : (sign === '+' ? '+' : sign === ' ' ? ' ' : '');
    if (zero && !align) { fill = '0'; align = '='; }
    const w = width ? +width : 0;
    const total = sg.length + body.length;
    if (total < w) {
      const pad = (fill || ' ').repeat(w - total);
      align = align || '>';
      if (align === '=') return sg + pad + body;
      if (align === '<') return sg + body + pad;
      if (align === '^') { const l = Math.floor(pad.length / 2); return pad.slice(0, l) + sg + body + pad.slice(l); }
      return pad + sg + body;
    }
    return sg + body;
  }
  body = interp.str(v);
  if (prec !== undefined) body = body.slice(0, +prec);
  const w = width ? +width : 0;
  if (body.length < w) {
    const padLen = w - body.length, f = fill || ' ';
    align = align || '<';
    if (align === '>') return f.repeat(padLen) + body;
    if (align === '^') { const l = Math.floor(padLen / 2); return f.repeat(l) + body + f.repeat(padLen - l); }
    return body + f.repeat(padLen);
  }
  return body;
}

/* ------------------------------ مفسر ------------------------------ */
const MAX_DEPTH = 200;

class Interp {
  constructor(src) {
    this.ast = parse(src);
    this.nextId = 1;
    this.ids = new WeakMap();
    this.out = [];             // خروجی print: {text, line}
    this.note = null;          // آخرین پیام note()
    this.lastReturn = null;
    this.builtinScope = new Scope(null, '<builtins>');
    this.globals = new Scope(this.builtinScope, '<module>');
    this.frames = [{ name: '<module>', scope: this.globals, line: 0 }];
    this.finished = false;
    this.error = null;
    this.steps = 0;
    this.curLine = 0;
    this.lineLog = [];
    this.installBuiltins();
    this.gen = this.run();
  }
  newId() { return this.nextId++; }
  idOf(o) {
    if (o && (o.id !== undefined)) return o.id;
    let id = this.ids.get(o);
    if (!id) { id = this.newId(); this.ids.set(o, id); }
    return id;
  }
  *run() { yield* this.execBlock(this.ast.body, this.globals); }

  /* یک گام «ورود به»: تا رویداد خط بعدی */
  stepInto() {
    if (this.finished) return false;
    try {
      const r = this.gen.next();
      if (r.done) { this.finished = true; this.frames.length = 1; return false; }
      this.curLine = r.value; this.steps++; this.lineLog.push(r.value);
      return true;
    } catch (e) {
      return this.fail(e);
    }
  }
  fail(e) {
    if (e instanceof PyError) {
      if (e.frameSnap) this.frames = e.frameSnap;
      if (!e.line) e.line = this.frames[this.frames.length - 1].line;
      this.error = { type: e.pyType, msg: e.message, line: e.line };
    } else if (e instanceof RangeError) {
      this.error = { type: 'RecursionError', msg: 'maximum recursion depth exceeded', line: this.frames[this.frames.length - 1].line };
    } else {
      this.error = { type: 'InternalError', msg: String(e && e.message || e), line: this.frames[this.frames.length - 1].line };
    }
    this.finished = true;
    return false;
  }
  /* mode: 'into' | 'over' | 'out' */
  step(mode) {
    const d = this.frames.length;
    if (!this.stepInto()) return false;
    if (mode === 'over') { while (this.frames.length > d) if (!this.stepInto()) return false; }
    else if (mode === 'out') { while (this.frames.length >= d && d > 1) if (!this.stepInto()) return false; }
    return true;
  }

  /* ---------- اجرای دستورها ---------- */
  *execBlock(stmts, scope) {
    for (let i = 0; i < stmts.length; i++) {
      const r = yield* this.execStmt(stmts[i], scope);
      if (r !== undefined) return r;
    }
  }
  mark(line) { this.frames[this.frames.length - 1].line = line; }

  setVar(scope, name, v) {
    if (scope.globalNames && scope.globalNames.has(name)) this.globals.vars.set(name, v);
    else scope.vars.set(name, v);
  }

  *execStmt(s, scope) {
    switch (s.type) {
      case 'ExprStmt':
        this.mark(s.line); yield s.line;
        yield* this.eval(s.expr, scope);
        return;
      case 'Assign': {
        this.mark(s.line); yield s.line;
        const v = yield* this.eval(s.value, scope);
        for (const t of s.targets) yield* this.assign(t, v, scope);
        return;
      }
      case 'AugAssign': {
        this.mark(s.line); yield s.line;
        yield* this.augAssign(s, scope);
        return;
      }
      case 'If': {
        this.mark(s.line); yield s.line;
        const c = yield* this.eval(s.test, scope);
        return yield* this.execBlock(truthy(c) ? s.body : s.orelse, scope);
      }
      case 'While': {
        for (;;) {
          this.mark(s.line); yield s.line;
          if (!truthy(yield* this.eval(s.test, scope))) break;
          const r = yield* this.execBlock(s.body, scope);
          if (r === BREAK) break;
          if (r === CONTINUE || r === undefined) continue;
          return r;
        }
        return;
      }
      case 'For': {
        this.mark(s.line); yield s.line;
        const iterable = yield* this.eval(s.iter, scope);
        const it = this.makeIter(iterable);
        let first = true, r0;
        while (!(r0 = it()).done) {
          if (!first) { this.mark(s.line); yield s.line; }
          first = false;
          yield* this.assign(s.target, r0.value, scope);
          const r = yield* this.execBlock(s.body, scope);
          if (r === BREAK) break;
          if (r === CONTINUE || r === undefined) continue;
          return r;
        }
        return;
      }
      case 'Def': {
        this.mark(s.line); yield s.line;
        const f = new PyFunc(s.name, s.params, s.body, scope, s.line);
        for (const p of s.params) f.defaults.push(p.def ? yield* this.eval(p.def, scope) : undefined);
        if (scope.isClassScope) f.homeClass = scope.cls;
        this.setVar(scope, s.name, f);
        return;
      }
      case 'Class': {
        this.mark(s.line); yield s.line;
        let base = null;
        if (s.base) {
          base = yield* this.eval(s.base, scope);
          if (base && base.isObjectBase) base = null;
          else if (!(base instanceof PyClass)) throw new PyError('TypeError', 'base must be a class');
        }
        const cls = new PyClass(s.name, base);
        const cs = new Scope(scope, s.name); cs.isClassScope = true; cs.cls = cls;
        yield* this.execBlock(s.body, cs);
        for (const [k, v] of cs.vars) cls.attrs.set(k, v);
        this.setVar(scope, s.name, cls);
        return;
      }
      case 'Return': {
        if (!s.silent) { this.mark(s.line); yield s.line; }
        const v = s.expr ? yield* this.eval(s.expr, scope) : null;
        return new Ret(v);
      }
      case 'Break': this.mark(s.line); yield s.line; return BREAK;
      case 'Continue': this.mark(s.line); yield s.line; return CONTINUE;
      case 'Pass': this.mark(s.line); yield s.line; return;
      case 'Global':
        this.mark(s.line); yield s.line;
        if (!scope.globalNames) scope.globalNames = new Set();
        s.names.forEach(n => scope.globalNames.add(n));
        return;
      case 'Del': {
        this.mark(s.line); yield s.line;
        for (const t of s.targets) {
          if (t.type === 'Name') {
            const sc = scope.lookup(t.name);
            if (!sc || sc === this.builtinScope) throw new PyError('NameError', `name '${t.name}' is not defined`);
            sc.vars.delete(t.name);
          } else if (t.type === 'Index') {
            const o = yield* this.eval(t.obj, scope), i = yield* this.eval(t.idx, scope);
            this.delItem(o, i);
          } else if (t.type === 'Attr') {
            const o = yield* this.eval(t.obj, scope);
            if (o instanceof PyObj) o.attrs.delete(t.name);
          }
        }
        return;
      }
      case 'Assert': {
        this.mark(s.line); yield s.line;
        if (!truthy(yield* this.eval(s.test, scope))) {
          const msg = s.msg ? this.str(yield* this.eval(s.msg, scope)) : '';
          throw new PyError('AssertionError', msg);
        }
        return;
      }
      case 'Raise': {
        this.mark(s.line); yield s.line;
        if (!s.expr) throw new PyError('RuntimeError', 'No active exception to reraise');
        let v = yield* this.eval(s.expr, scope);
        if (v instanceof PyClass) v = yield* this.callFn(v, [], null);
        if (!(v instanceof PyObj) || !this.isExc(v.cls)) throw new PyError('TypeError', 'exceptions must derive from BaseException');
        const a = v.attrs.get('args');
        const e = new PyError(v.cls.name, a && a.length ? this.str(a[0]) : '');
        e.pyValue = v; throw e;
      }
      case 'Try': {
        this.mark(s.line); yield s.line;
        try {
          try {
            return yield* this.execBlock(s.body, scope);
          } catch (e) {
            if (!(e instanceof PyError)) {
              if (e instanceof RangeError) e = new PyError('RecursionError', 'maximum recursion depth exceeded');
              else throw e;
            }
            const excCls = this.excClassOf(e);
            for (const h of s.handlers) {
              let ok = !h.type;
              if (h.type) {
                const hc = yield* this.eval(h.type, scope);
                const list = Array.isArray(hc) ? hc : [hc];
                ok = list.some(c => c instanceof PyClass && subclassOf(excCls, c));
              }
              if (ok) {
                if (h.name) this.setVar(scope, h.name, e.pyValue || this.makeExc(e));
                this.mark(h.line); yield h.line;
                return yield* this.execBlock(h.body, scope);
              }
            }
            throw e;
          }
        } finally {
          if (s.fin) {
            const saved = this.frames.length;
            const r = yield* this.execBlock(s.fin, scope);
            if (r !== undefined) return r;
          }
        }
      }
    }
    throw new PyError('InternalError', 'دستور ناشناخته: ' + s.type);
  }

  isExc(cls) { return subclassOf(cls, this.builtinScope.vars.get('BaseException')); }
  excClassOf(e) {
    if (e.pyValue) return e.pyValue.cls;
    return this.builtinScope.vars.get(e.pyType) || this.builtinScope.vars.get('Exception');
  }
  makeExc(e) {
    const cls = this.excClassOf(e);
    const o = new PyObj(cls, this.newId());
    o.attrs.set('args', mkTuple(e.message ? [e.message] : []));
    e.pyValue = o;
    return o;
  }

  *assign(t, v, scope) {
    switch (t.type) {
      case 'Name': this.setVar(scope, t.name, v); return;
      case 'Attr': {
        const o = yield* this.eval(t.obj, scope);
        if (o instanceof PyObj) { o.attrs.set(t.name, v); return; }
        if (o instanceof PyClass) { o.attrs.set(t.name, v); return; }
        throw new PyError('AttributeError', `'${typeName(o)}' object has no attribute '${t.name}'`);
      }
      case 'Index': {
        const o = yield* this.eval(t.obj, scope);
        const i = yield* this.eval(t.idx, scope);
        this.setItem(o, i, v); return;
      }
      case 'Tuple': case 'List': {
        const items = this.toArray(v);
        if (items.length !== t.items.length) {
          throw new PyError('ValueError', items.length < t.items.length
            ? `not enough values to unpack (expected ${t.items.length}, got ${items.length})`
            : `too many values to unpack (expected ${t.items.length})`);
        }
        for (let k = 0; k < t.items.length; k++) yield* this.assign(t.items[k], items[k], scope);
        return;
      }
    }
    throw new PyError('SyntaxError', 'هدف انتساب نامعتبر');
  }
  *augAssign(s, scope) {
    const t = s.target;
    let obj, idx, cur;
    if (t.type === 'Name') cur = yield* this.eval(t, scope);
    else if (t.type === 'Attr') { obj = yield* this.eval(t.obj, scope); cur = this.getAttr(obj, t.name); }
    else { obj = yield* this.eval(t.obj, scope); idx = yield* this.eval(t.idx, scope); cur = this.getItem(obj, idx); }
    const rhs = yield* this.eval(s.value, scope);
    let nv;
    if (s.op === '+' && Array.isArray(cur) && !cur.isTuple) { cur.push(...this.toArray(rhs)); nv = cur; }
    else nv = this.binop(s.op, cur, rhs);
    if (t.type === 'Name') this.setVar(scope, t.name, nv);
    else if (t.type === 'Attr') { if (obj instanceof PyObj || obj instanceof PyClass) obj.attrs.set(t.name, nv); else throw new PyError('AttributeError', 'cannot set attribute'); }
    else this.setItem(obj, idx, nv);
  }

  /* ---------- ارزیابی عبارت‌ها ---------- */
  *eval(n, scope) {
    switch (n.type) {
      case 'Num': return n.v;
      case 'Str': return n.v;
      case 'Const': return n.v;
      case 'Name': {
        const sc = scope.lookup(n.name);
        if (!sc) throw new PyError('NameError', `name '${n.name}' is not defined`);
        return sc.vars.get(n.name);
      }
      case 'FStr': {
        let out = '';
        for (const p of n.parts) {
          if (typeof p === 'string') out += p;
          else {
            let v = yield* this.eval(p.expr, scope);
            if (p.conv === 'r') v = this.repr(v);
            else if (p.conv === 's') v = this.str(v);
            out += formatSpec(v, p.spec, this);
          }
        }
        return out;
      }
      case 'List': { const a = []; for (const e of n.items) a.push(yield* this.eval(e, scope)); return a; }
      case 'Tuple': { const a = []; for (const e of n.items) a.push(yield* this.eval(e, scope)); return mkTuple(a); }
      case 'Dict': {
        const d = new PyDict(this.newId());
        for (const [k, v] of n.pairs) { const kk = yield* this.eval(k, scope); d.set(kk, yield* this.eval(v, scope)); }
        return d;
      }
      case 'SetLit': { const s = new PySet(this.newId()); for (const e of n.items) s.add(yield* this.eval(e, scope)); return s; }
      case 'ListComp': case 'SetComp': case 'DictComp': {
        const sc = new Scope(scope, '<comp>');
        const out = n.type === 'DictComp' ? new PyDict(this.newId()) : [];
        yield* this.compRec(n, 0, sc, out);
        if (n.type === 'SetComp') { const s = new PySet(this.newId()); out.forEach(x => s.add(x)); return s; }
        return out;
      }
      case 'BinOp': {
        const a = yield* this.eval(n.a, scope);
        const b = yield* this.eval(n.b, scope);
        return this.binop(n.op, a, b);
      }
      case 'Unary': {
        const v = yield* this.eval(n.e, scope);
        if (n.op === '-') { if (typeof v === 'boolean') return -v; if (typeof v !== 'number') throw new PyError('TypeError', `bad operand type for unary -: '${typeName(v)}'`); return -v; }
        if (n.op === '+') return +v;
        return ~v;
      }
      case 'Not': return !truthy(yield* this.eval(n.e, scope));
      case 'BoolOp': {
        const a = yield* this.eval(n.a, scope);
        if (n.op === 'and') return truthy(a) ? yield* this.eval(n.b, scope) : a;
        return truthy(a) ? a : yield* this.eval(n.b, scope);
      }
      case 'Compare': {
        let l = yield* this.eval(n.left, scope);
        for (let i = 0; i < n.ops.length; i++) {
          const r = yield* this.eval(n.rights[i], scope);
          if (!this.compare(n.ops[i], l, r)) return false;
          l = r;
        }
        return true;
      }
      case 'IfExp': return truthy(yield* this.eval(n.cond, scope)) ? yield* this.eval(n.a, scope) : yield* this.eval(n.b, scope);
      case 'Lambda': {
        const f = new PyFunc('<lambda>', n.params, n.body, scope, n.line);
        for (const p of n.params) f.defaults.push(p.def ? yield* this.eval(p.def, scope) : undefined);
        return f;
      }
      case 'Attr': return this.getAttr(yield* this.eval(n.obj, scope), n.name);
      case 'Index': {
        const o = yield* this.eval(n.obj, scope);
        if (n.idx.type === 'Slice') return this.slice(o, yield* this.sliceArgs(n.idx, scope));
        return this.getItem(o, yield* this.eval(n.idx, scope));
      }
      case 'Call': {
        if (n.func.type === 'Name' && n.func.name === 'super' && !n.args.length) return this.makeSuper(scope);
        const f = yield* this.eval(n.func, scope);
        const args = [];
        for (const a of n.args) args.push(yield* this.eval(a, scope));
        let kw = null;
        if (n.kwargs.length) { kw = {}; for (const [k, v] of n.kwargs) kw[k] = yield* this.eval(v, scope); }
        return yield* this.callFn(f, args, kw);
      }
    }
    throw new PyError('InternalError', 'عبارت ناشناخته: ' + n.type);
  }
  *sliceArgs(sl, scope) {
    const g = function* (self, e) { return e ? yield* self.eval(e, scope) : null; };
    return [yield* g(this, sl.lo), yield* g(this, sl.hi), yield* g(this, sl.step)];
  }
  *compRec(n, ci, sc, out) {
    if (ci === n.clauses.length) {
      if (n.type === 'DictComp') { const k = yield* this.eval(n.key, sc); out.set(k, yield* this.eval(n.val, sc)); }
      else out.push(yield* this.eval(n.elt, sc));
      return;
    }
    const cl = n.clauses[ci];
    const it = this.makeIter(yield* this.eval(cl.iter, sc));
    let r;
    while (!(r = it()).done) {
      yield* this.assign(cl.target, r.value, sc);
      let ok = true;
      for (const c of cl.conds) if (!truthy(yield* this.eval(c, sc))) { ok = false; break; }
      if (ok) yield* this.compRec(n, ci + 1, sc, out);
    }
  }
  makeSuper(scope) {
    const hs = scope.lookup('__class__');
    if (!hs) throw new PyError('RuntimeError', 'super(): no arguments outside a method');
    const selfScope = scope.lookup('self') || scope;
    const home = hs.vars.get('__class__');
    // اولین پارامتر تابع جاری
    let selfObj = null;
    for (const fr of [...this.frames].reverse()) { if (fr.func && fr.func.homeClass === home) { selfObj = fr.scope.vars.get(fr.func.params[0].name); break; } }
    return new SuperProxy(selfObj, home.base);
  }

  /* ---------- فراخوانی ---------- */
  *callFn(f, args, kw) {
    if (f instanceof Builtin) return f.fn.call(this, args, kw || {});
    if (f instanceof BoundMethod) return yield* this.callFn(f.func, [f.self, ...args], kw);
    if (f instanceof PyFunc) return yield* this.callUser(f, args, kw);
    if (f instanceof PyClass) return yield* this.instantiate(f, args, kw);
    throw new PyError('TypeError', `'${typeName(f)}' object is not callable`);
  }
  *callUser(f, args, kw) {
    if (this.frames.length >= MAX_DEPTH) throw new PyError('RecursionError', 'maximum recursion depth exceeded');
    const sc = new Scope(f.closure, f.name);
    const ps = f.params;
    if (args.length > ps.length) throw new PyError('TypeError', `${f.name}() takes ${ps.length} positional argument${ps.length === 1 ? '' : 's'} but ${args.length} were given`);
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (i < args.length) sc.vars.set(p.name, args[i]);
      else if (kw && Object.prototype.hasOwnProperty.call(kw, p.name)) sc.vars.set(p.name, kw[p.name]);
      else if (f.defaults[i] !== undefined) sc.vars.set(p.name, f.defaults[i]);
      else if (p.def) sc.vars.set(p.name, f.defaults[i] === undefined ? null : f.defaults[i]);
      else throw new PyError('TypeError', `${f.name}() missing required argument: '${p.name}'`);
    }
    if (kw) for (const k of Object.keys(kw)) if (!ps.some(p => p.name === k)) throw new PyError('TypeError', `${f.name}() got an unexpected keyword argument '${k}'`);
    if (f.homeClass) sc.vars.set('__class__', f.homeClass);
    this.frames.push({ name: f.name, scope: sc, line: f.line, func: f });
    try {
      const r = yield* this.execBlock(f.body, sc);
      const v = r instanceof Ret ? r.v : null;
      this.lastReturn = { name: f.name, value: v };
      return v;
    } catch (e) {
      if (e instanceof PyError && !e.frameSnap) e.frameSnap = this.frames.slice();
      throw e;
    } finally {
      this.frames.pop();
    }
  }
  *instantiate(cls, args, kw) {
    const obj = new PyObj(cls, this.newId());
    const init = findInClass(cls, '__init__');
    if (init) yield* this.callFn(init.v, [obj, ...args], kw);
    else if (args.length) throw new PyError('TypeError', `${cls.name}() takes no arguments`);
    return obj;
  }
  /* اجرای هم‌گام (برای کلیدها، __str__ و ...) بدون رویداد */
  callSync(f, args, kw) {
    const g = this.callFn(f, args, kw || null);
    let r;
    while (!(r = g.next()).done) { /* رویدادها نادیده */ }
    return r.value;
  }

  /* ---------- عملگرها ---------- */
  compare(op, a, b) {
    switch (op) {
      case '==': return eq(a, b);
      case '!=': return !eq(a, b);
      case '<': return lt(a, b, '<');
      case '>': return lt(b, a, '>');
      case '<=': return lt(a, b, '<=') || eq(a, b);
      case '>=': return lt(b, a, '>=') || eq(a, b);
      case 'is': return a === b || (a === undefined && b === null);
      case 'is not': return !(a === b);
      case 'in': return this.contains(b, a);
      case 'not in': return !this.contains(b, a);
    }
  }
  contains(c, x) {
    if (Array.isArray(c)) return c.some(y => eq(x, y));
    if (typeof c === 'string') { if (typeof x !== 'string') throw new PyError('TypeError', "'in <string>' requires string as left operand"); return c.includes(x); }
    if (c instanceof PyDict || c instanceof PySet) return c.has(x);
    if (c instanceof PyRange) { if (typeof x !== 'number') return false; const k = (x - c.start) / c.step; return Number.isInteger(k) && k >= 0 && k < c.length; }
    throw new PyError('TypeError', `argument of type '${typeName(c)}' is not iterable`);
  }
  binop(op, a, b) {
    if (typeof a === 'boolean') a = +a;
    if (typeof b === 'boolean' && typeof a === 'number') b = +b;
    const bad = () => new PyError('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
    if (typeof a === 'number' && typeof b === 'boolean') b = +b;
    if (typeof a === 'number' && typeof b === 'number') {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) throw new PyError('ZeroDivisionError', 'division by zero'); return a / b;
        case '//': if (b === 0) throw new PyError('ZeroDivisionError', 'integer division or modulo by zero'); return Math.floor(a / b);
        case '%': { if (b === 0) throw new PyError('ZeroDivisionError', 'integer modulo by zero'); const r = a % b; return (r !== 0 && (r < 0) !== (b < 0)) ? r + b : r; }
        case '**': return Math.pow(a, b);
        case '&': return a & b;
        case '|': return a | b;
        case '^': return a ^ b;
        case '<<': return a << b;
        case '>>': return a >> b;
      }
    }
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) { const r = a.concat(b); if (a.isTuple && b.isTuple) r.isTuple = true; return r; }
    }
    if (op === '*') {
      if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
      if (typeof a === 'number' && typeof b === 'string') return b.repeat(Math.max(0, a));
      if (Array.isArray(a) && typeof b === 'number') { let r = []; for (let i = 0; i < b; i++) r = r.concat(a); if (a.isTuple) r.isTuple = true; return r; }
      if (typeof a === 'number' && Array.isArray(b)) return this.binop('*', b, a);
    }
    if (op === '%' && typeof a === 'string') return this.percentFormat(a, b);
    if (a instanceof PySet && b instanceof PySet) {
      const r = new PySet(this.newId());
      if (op === '|') { a.values().forEach(x => r.add(x)); b.values().forEach(x => r.add(x)); return r; }
      if (op === '&') { a.values().filter(x => b.has(x)).forEach(x => r.add(x)); return r; }
      if (op === '-') { a.values().filter(x => !b.has(x)).forEach(x => r.add(x)); return r; }
    }
    throw bad();
  }
  percentFormat(fmt, arg) {
    const args = Array.isArray(arg) ? arg : [arg]; let i = 0;
    return fmt.replace(/%(\.\d+)?([sdrf%])/g, (m, prec, t) => {
      if (t === '%') return '%';
      const v = args[i++];
      if (t === 's') return this.str(v);
      if (t === 'r') return this.repr(v);
      if (t === 'd') return String(Math.trunc(v));
      return Number(v).toFixed(prec ? +prec.slice(1) : 6);
    });
  }

  /* ---------- دسترسی به مقادیر ---------- */
  normIndex(i, len, what) {
    if (typeof i === 'boolean') i = +i;
    if (typeof i !== 'number' || !Number.isInteger(i)) throw new PyError('TypeError', `${what} indices must be integers, not ${typeName(i)}`);
    const k = i < 0 ? i + len : i;
    if (k < 0 || k >= len) throw new PyError('IndexError', `${what} index out of range`);
    return k;
  }
  getItem(o, i) {
    if (Array.isArray(o)) return o[this.normIndex(i, o.length, o.isTuple ? 'tuple' : 'list')];
    if (typeof o === 'string') return o[this.normIndex(i, o.length, 'string')];
    if (o instanceof PyDict) { if (!o.has(i)) { const e = new PyError('KeyError', this.repr(i)); throw e; } return o.get(i); }
    if (o instanceof PyRange) return o.at(this.normIndex(i, o.length, 'range'));
    throw new PyError('TypeError', `'${typeName(o)}' object is not subscriptable`);
  }
  setItem(o, i, v) {
    if (Array.isArray(o) && !o.isTuple) { o[this.normIndex(i, o.length, 'list assignment')] = v; return; }
    if (o instanceof PyDict) { o.set(i, v); return; }
    throw new PyError('TypeError', `'${typeName(o)}' object does not support item assignment`);
  }
  delItem(o, i) {
    if (Array.isArray(o) && !o.isTuple) { o.splice(this.normIndex(i, o.length, 'list assignment'), 1); return; }
    if (o instanceof PyDict) { if (!o.delete(i)) throw new PyError('KeyError', this.repr(i)); return; }
    throw new PyError('TypeError', `'${typeName(o)}' object doesn't support item deletion`);
  }
  slice(o, [lo, hi, st]) {
    const len = o instanceof PyRange ? o.length : o.length;
    if (!(Array.isArray(o) || typeof o === 'string' || o instanceof PyRange)) throw new PyError('TypeError', `'${typeName(o)}' object is not subscriptable`);
    const step = st === null ? 1 : st;
    if (step === 0) throw new PyError('ValueError', 'slice step cannot be zero');
    const clamp = (v, dflt, lowLim, hiLim) => {
      if (v === null) return dflt;
      if (v < 0) v += len;
      return Math.max(lowLim, Math.min(hiLim, v));
    };
    const idx = [];
    if (step > 0) { const a = clamp(lo, 0, 0, len), b = clamp(hi, len, 0, len); for (let i = a; i < b; i += step) idx.push(i); }
    else { const a = clamp(lo, len - 1, -1, len - 1), b = clamp(hi, -1, -1, len - 1); for (let i = a; i > b; i += step) idx.push(i); }
    if (typeof o === 'string') return idx.map(i => o[i]).join('');
    const src = o instanceof PyRange ? Array.from({ length: len }, (_, i) => o.at(i)) : o;
    const r = idx.map(i => src[i]);
    if (o.isTuple) r.isTuple = true;
    return r;
  }
  getAttr(o, name) {
    if (o instanceof PyObj) {
      if (o.attrs.has(name)) return o.attrs.get(name);
      const f = findInClass(o.cls, name);
      if (f) return (f.v instanceof PyFunc || f.v instanceof Builtin) ? new BoundMethod(f.v, o) : f.v;
      throw new PyError('AttributeError', `'${o.cls.name}' object has no attribute '${name}'`);
    }
    if (o instanceof PyClass) {
      const f = findInClass(o, name);
      if (f) return f.v;
      throw new PyError('AttributeError', `type object '${o.name}' has no attribute '${name}'`);
    }
    if (o instanceof SuperProxy) {
      const f = o.cls ? findInClass(o.cls, name) : null;
      if (f) return new BoundMethod(f.v, o.self);
      const ex = this.builtinScope.vars.get('object');
      if (name === '__init__') return new Builtin('__init__', () => null);
      throw new PyError('AttributeError', `'super' object has no attribute '${name}'`);
    }
    if (o && o.isModule) { if (o.attrs.has(name)) return o.attrs.get(name); throw new PyError('AttributeError', `module has no attribute '${name}'`); }
    const m = this.methodOf(o, name);
    if (m) return m;
    throw new PyError('AttributeError', `'${typeName(o)}' object has no attribute '${name}'`);
  }
  methodOf(o, name) {
    let table = null;
    if (Array.isArray(o)) table = LIST_METHODS;
    else if (typeof o === 'string') table = STR_METHODS;
    else if (o instanceof PyDict) table = DICT_METHODS;
    else if (o instanceof PySet) table = SET_METHODS;
    if (!table || !table[name]) return null;
    const fn = table[name];
    return new Builtin(name, function (args, kw) { return fn.call(this, o, args, kw); });
  }

  /* ---------- پیمایش ---------- */
  toArray(v) {
    if (Array.isArray(v)) return v.slice();
    if (typeof v === 'string') return v.split('');
    if (v instanceof PyDict) return v.keys();
    if (v instanceof PySet) return v.values();
    if (v instanceof PyRange) return Array.from({ length: v.length }, (_, i) => v.at(i));
    throw new PyError('TypeError', `'${typeName(v)}' object is not iterable`);
  }
  makeIter(v) {
    if (Array.isArray(v)) { let i = 0; return () => i < v.length ? { done: false, value: v[i++] } : { done: true }; }
    if (v instanceof PyRange) { let i = 0; return () => i < v.length ? { done: false, value: v.at(i++) } : { done: true }; }
    const a = this.toArray(v); let i = 0;
    return () => i < a.length ? { done: false, value: a[i++] } : { done: true };
  }

  /* ---------- نمایش متنی ---------- */
  str(v) {
    if (typeof v === 'string') return v;
    if (v instanceof PyObj) {
      const f = findInClass(v.cls, '__str__') || findInClass(v.cls, '__repr__');
      if (f && f.v instanceof PyFunc) return this.str(this.callSync(new BoundMethod(f.v, v), []));
      if (this.isExc(v.cls)) { const a = v.attrs.get('args'); return a && a.length ? this.str(a[0]) : ''; }
    }
    return this.repr(v);
  }
  repr(v, depth) {
    depth = depth || 0;
    if (v === null || v === undefined) return 'None';
    switch (typeof v) {
      case 'boolean': return v ? 'True' : 'False';
      case 'number': return fmtFloat(v);
      case 'string': return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
    }
    if (depth > 6) return '...';
    if (Array.isArray(v)) {
      const inner = v.map(x => this.repr(x, depth + 1)).join(', ');
      return v.isTuple ? '(' + inner + (v.length === 1 ? ',' : '') + ')' : '[' + inner + ']';
    }
    if (v instanceof PyDict) return '{' + v.entries().map(([k, x]) => this.repr(k, depth + 1) + ': ' + this.repr(x, depth + 1)).join(', ') + '}';
    if (v instanceof PySet) return v.size ? '{' + v.values().map(x => this.repr(x, depth + 1)).join(', ') + '}' : 'set()';
    if (v instanceof PyRange) return `range(${v.start}, ${v.stop}${v.step !== 1 ? ', ' + v.step : ''})`;
    if (v instanceof PyObj) {
      const f = findInClass(v.cls, '__repr__');
      if (f && f.v instanceof PyFunc) return this.str(this.callSync(new BoundMethod(f.v, v), []));
      if (this.isExc(v.cls)) return v.cls.name + '(' + (v.attrs.get('args') || []).map(x => this.repr(x)).join(', ') + ')';
      return `<${v.cls.name} #${v.id}>`;
    }
    if (v instanceof PyClass) return `<class '${v.name}'>`;
    if (v instanceof PyFunc) return `<function ${v.name}>`;
    if (v instanceof BoundMethod) return `<bound method ${v.func.name}>`;
    if (v instanceof Builtin) return `<built-in ${v.name}>`;
    return String(v);
  }

  /* ---------- توابع و کلاس‌های داخلی ---------- */
  installBuiltins() {
    const B = this.builtinScope.vars;
    const self = this;
    const def = (name, fn) => B.set(name, new Builtin(name, fn));
    const num = (v, what) => { if (typeof v === 'boolean') return +v; if (typeof v !== 'number') throw new PyError('TypeError', `${what || 'operand'} must be a number, not '${typeName(v)}'`); return v; };

    def('print', function (args, kw) {
      const sep = kw.sep !== undefined ? kw.sep : ' ';
      const text = args.map(a => this.str(a)).join(sep);
      this.out.push({ text, line: this.frames[this.frames.length - 1].line, end: kw.end !== undefined ? kw.end : '\n' });
      return null;
    });
    def('note', function (args) { this.note = { text: args.map(a => this.str(a)).join(' '), step: this.steps }; return null; });
    def('len', function (args) {
      const v = args[0];
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (v instanceof PyDict || v instanceof PySet) return v.size;
      if (v instanceof PyRange) return v.length;
      throw new PyError('TypeError', `object of type '${typeName(v)}' has no len()`);
    });
    def('range', function (args) {
      args = args.map(a => num(a, 'range() argument'));
      let [a, b, c] = args;
      if (args.length === 1) { b = a; a = 0; c = 1; }
      else if (args.length === 2) c = 1;
      else if (args.length !== 3) throw new PyError('TypeError', 'range expected 1 to 3 arguments');
      if (c === 0) throw new PyError('ValueError', 'range() arg 3 must not be zero');
      return new PyRange(a, b, c);
    });
    const typeFn = (name, fn) => { const b = new Builtin(name, fn); b.pyType = name; B.set(name, b); };
    typeFn('int', function (args) {
      const v = args[0];
      if (v === undefined) return 0;
      if (typeof v === 'string') { const t = v.trim(); if (!/^[+-]?\d+$/.test(t)) throw new PyError('ValueError', `invalid literal for int() with base 10: ${this.repr(v)}`); return parseInt(t, 10); }
      return Math.trunc(num(v));
    });
    typeFn('float', function (args) {
      const v = args[0];
      if (v === undefined) return 0;
      if (typeof v === 'string') {
        const t = v.trim().toLowerCase();
        if (t === 'inf' || t === '+inf' || t === 'infinity') return Infinity;
        if (t === '-inf' || t === '-infinity') return -Infinity;
        if (t === 'nan') return NaN;
        if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) throw new PyError('ValueError', `could not convert string to float: ${this.repr(v)}`);
        return parseFloat(t);
      }
      return num(v);
    });
    typeFn('str', function (args) { return args.length ? this.str(args[0]) : ''; });
    typeFn('bool', function (args) { return args.length ? truthy(args[0]) : false; });
    typeFn('list', function (args) { return args.length ? this.toArray(args[0]) : []; });
    typeFn('tuple', function (args) { return mkTuple(args.length ? this.toArray(args[0]) : []); });
    typeFn('set', function (args) { const s = new PySet(this.newId()); if (args.length) this.toArray(args[0]).forEach(x => s.add(x)); return s; });
    typeFn('dict', function (args, kw) {
      const d = new PyDict(this.newId());
      if (args.length) { if (args[0] instanceof PyDict) args[0].entries().forEach(([k, v]) => d.set(k, v)); else this.toArray(args[0]).forEach(p => d.set(p[0], p[1])); }
      for (const k of Object.keys(kw)) d.set(k, kw[k]);
      return d;
    });
    def('deque', function (args) { return args.length ? this.toArray(args[0]) : []; });
    def('abs', function (args) { return Math.abs(num(args[0])); });
    def('round', function (args) { const v = num(args[0]); if (args[1] === undefined) { const f = Math.floor(v), d = v - f; return d === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); } const p = Math.pow(10, args[1]); return Math.round(v * p) / p; });
    def('pow', function (args) { return Math.pow(num(args[0]), num(args[1])); });
    def('divmod', function (args) { return mkTuple([this.binop('//', args[0], args[1]), this.binop('%', args[0], args[1])]); });
    def('chr', function (args) { return String.fromCodePoint(args[0]); });
    def('ord', function (args) { return args[0].codePointAt(0); });
    def('id', function (args) { return this.idOf(args[0]); });
    const keyed = (self, args, kw) => {
      const items = args.length === 1 ? self.toArray(args[0]) : args;
      return { items, key: kw.key };
    };
    const extreme = (name, sign) => def(name, function (args, kw) {
      const { items, key } = keyed(this, args, kw);
      if (!items.length) { if ('default' in kw) return kw.default; throw new PyError('ValueError', `${name}() arg is an empty sequence`); }
      let best = items[0], bk = key ? this.callSync(key, [best]) : best;
      for (let i = 1; i < items.length; i++) {
        const k = key ? this.callSync(key, [items[i]]) : items[i];
        if (sign < 0 ? lt(k, bk) : lt(bk, k)) { best = items[i]; bk = k; }
      }
      return best;
    });
    extreme('min', -1); extreme('max', 1);
    def('sum', function (args) { let s = args[1] !== undefined ? args[1] : 0; for (const x of this.toArray(args[0])) s = this.binop('+', s, x); return s; });
    const sortArr = (self, arr, kw) => {
      const key = kw.key;
      const dec = arr.map(x => ({ x, k: key ? self.callSync(key, [x]) : x }));
      dec.sort((a, b) => lt(a.k, b.k) ? -1 : lt(b.k, a.k) ? 1 : 0);
      if (truthy(kw.reverse)) dec.reverse();
      return dec.map(d => d.x);
    };
    def('sorted', function (args, kw) { return sortArr(this, this.toArray(args[0]), kw); });
    def('reversed', function (args) { return this.toArray(args[0]).reverse(); });
    def('enumerate', function (args) { const s = args[1] || 0; return this.toArray(args[0]).map((x, i) => mkTuple([i + s, x])); });
    def('zip', function (args) { const ls = args.map(a => this.toArray(a)); const n = Math.min(...ls.map(l => l.length)); return Array.from({ length: ls.length ? n : 0 }, (_, i) => mkTuple(ls.map(l => l[i]))); });
    def('any', function (args) { return this.toArray(args[0]).some(truthy); });
    def('all', function (args) { return this.toArray(args[0]).every(truthy); });
    def('map', function (args) { return this.toArray(args[1]).map(x => this.callSync(args[0], [x])); });
    def('filter', function (args) { return this.toArray(args[1]).filter(x => truthy(args[0] === null ? x : this.callSync(args[0], [x]))); });
    def('isinstance', function (args) {
      const [v, t] = args;
      const check = c => {
        if (c instanceof PyClass) return v instanceof PyObj && subclassOf(v.cls, c);
        if (c instanceof Builtin && c.pyType) {
          switch (c.pyType) {
            case 'int': return typeof v === 'number' && Number.isInteger(v);
            case 'float': return typeof v === 'number';
            case 'str': return typeof v === 'string';
            case 'bool': return typeof v === 'boolean';
            case 'list': return Array.isArray(v) && !v.isTuple;
            case 'tuple': return Array.isArray(v) && !!v.isTuple;
            case 'dict': return v instanceof PyDict;
            case 'set': return v instanceof PySet;
          }
        }
        return false;
      };
      return Array.isArray(t) ? t.some(check) : check(t);
    });
    def('type', function (args) { return new Builtin(typeName(args[0]), () => null); });
    B.set('inf', Infinity);
    B.set('nan', NaN);
    const math = { isModule: true, attrs: new Map() };
    const mdef = (n, fn) => math.attrs.set(n, new Builtin(n, function (a) { return fn(...a); }));
    ['floor', 'ceil', 'sqrt', 'log2', 'log10', 'sin', 'cos', 'tan', 'exp'].forEach(n => mdef(n, x => Math[n](x)));
    mdef('log', (x, b) => b ? Math.log(x) / Math.log(b) : Math.log(x));
    mdef('gcd', (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; });
    math.attrs.set('inf', Infinity); math.attrs.set('pi', Math.PI); math.attrs.set('e', Math.E);
    B.set('math', math);

    // کلاس‌های استثنا
    const obj = new PyClass('object', null); obj.isObjectBase = true; B.set('object', obj);
    const base = new PyClass('BaseException', null);
    base.attrs.set('__init__', new Builtin('__init__', function (args) { args[0].attrs.set('args', mkTuple(args.slice(1))); return null; }));
    B.set('BaseException', base);
    const exc = new PyClass('Exception', base); B.set('Exception', exc);
    const mk = (n, b) => B.set(n, new PyClass(n, b));
    ['ValueError', 'TypeError', 'RuntimeError', 'AttributeError', 'NameError', 'AssertionError', 'StopIteration', 'LookupError', 'ArithmeticError', 'NotImplementedError']
      .forEach(n => mk(n, exc));
    mk('IndexError', B.get('LookupError')); mk('KeyError', B.get('LookupError'));
    mk('ZeroDivisionError', B.get('ArithmeticError')); mk('RecursionError', B.get('RuntimeError'));
  }
}

/* ---------- متدهای داخلی ---------- */
const LIST_METHODS = {
  append(l, a) { l.push(a[0]); return null; },
  extend(l, a) { l.push(...this.toArray(a[0])); return null; },
  insert(l, a) { let i = a[0]; if (i < 0) i = Math.max(0, i + l.length); l.splice(Math.min(i, l.length), 0, a[1]); return null; },
  pop(l, a) {
    if (!l.length) throw new PyError('IndexError', 'pop from empty list');
    const i = a.length ? this.normIndex(a[0], l.length, 'pop') : l.length - 1;
    return l.splice(i, 1)[0];
  },
  popleft(l) { if (!l.length) throw new PyError('IndexError', 'pop from an empty deque'); return l.shift(); },
  appendleft(l, a) { l.unshift(a[0]); return null; },
  remove(l, a) { const i = l.findIndex(x => eq(x, a[0])); if (i < 0) throw new PyError('ValueError', 'list.remove(x): x not in list'); l.splice(i, 1); return null; },
  index(l, a) { const i = l.findIndex(x => eq(x, a[0])); if (i < 0) throw new PyError('ValueError', `${this.repr(a[0])} is not in list`); return i; },
  count(l, a) { return l.filter(x => eq(x, a[0])).length; },
  sort(l, a, kw) {
    const key = kw.key;
    const dec = l.map(x => ({ x, k: key ? this.callSync(key, [x]) : x }));
    dec.sort((p, q) => lt(p.k, q.k) ? -1 : lt(q.k, p.k) ? 1 : 0);
    if (truthy(kw.reverse)) dec.reverse();
    dec.forEach((d, i) => { l[i] = d.x; });
    return null;
  },
  reverse(l) { l.reverse(); return null; },
  copy(l) { return l.slice(); },
  clear(l) { l.length = 0; return null; },
};
const STR_METHODS = {
  upper: s => s.toUpperCase(), lower: s => s.toLowerCase(),
  strip: (s, a) => a.length ? s.replace(new RegExp('^[' + a[0].replace(/[\]\\^-]/g, '\\$&') + ']+|[' + a[0].replace(/[\]\\^-]/g, '\\$&') + ']+$', 'g'), '') : s.trim(),
  lstrip: s => s.trimStart(), rstrip: s => s.trimEnd(),
  split(s, a) { const r = a.length && a[0] !== null ? s.split(a[0]) : s.trim().split(/\s+/).filter(x => x !== ''); return r; },
  join(s, a) { return this.toArray(a[0]).map(x => { if (typeof x !== 'string') throw new PyError('TypeError', `sequence item: expected str instance, ${typeName(x)} found`); return x; }).join(s); },
  startswith: (s, a) => s.startsWith(a[0]), endswith: (s, a) => s.endsWith(a[0]),
  replace: (s, a) => s.split(a[0]).join(a[1]),
  find: (s, a) => s.indexOf(a[0]),
  index(s, a) { const i = s.indexOf(a[0]); if (i < 0) throw new PyError('ValueError', 'substring not found'); return i; },
  count: (s, a) => a[0] === '' ? s.length + 1 : s.split(a[0]).length - 1,
  isdigit: s => /^\d+$/.test(s), isalpha: s => /^\p{L}+$/u.test(s), isspace: s => /^\s+$/.test(s),
  isupper: s => s !== s.toLowerCase() && s === s.toUpperCase(), islower: s => s !== s.toUpperCase() && s === s.toLowerCase(),
  ljust: (s, a) => s.padEnd(a[0], a[1] || ' '), rjust: (s, a) => s.padStart(a[0], a[1] || ' '),
  center(s, a) { const w = a[0]; if (s.length >= w) return s; const t = w - s.length, l = Math.floor(t / 2); return ' '.repeat(l) + s + ' '.repeat(t - l); },
  capitalize: s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  format(s, a, kw) {
    let i = 0;
    return s.replace(/\{([^{}:]*)(?::([^{}]*))?\}/g, (m, name, spec) => {
      const v = name === '' ? a[i++] : (/^\d+$/.test(name) ? a[+name] : kw[name]);
      return formatSpec(v, spec || '', this);
    });
  },
};
const DICT_METHODS = {
  get(d, a) { return d.has(a[0]) ? d.get(a[0]) : (a.length > 1 ? a[1] : null); },
  keys: d => d.keys(), values: d => d.values(), items: d => d.entries().map(e => mkTuple(e)),
  pop(d, a) { if (d.has(a[0])) { const v = d.get(a[0]); d.delete(a[0]); return v; } if (a.length > 1) return a[1]; throw new PyError('KeyError', this.repr(a[0])); },
  setdefault(d, a) { if (!d.has(a[0])) d.set(a[0], a.length > 1 ? a[1] : null); return d.get(a[0]); },
  update(d, a, kw) { if (a[0] instanceof PyDict) a[0].entries().forEach(([k, v]) => d.set(k, v)); for (const k of Object.keys(kw)) d.set(k, kw[k]); return null; },
  clear(d) { d.m.clear(); return null; },
  copy(d) { const n = new PyDict(this.newId()); d.entries().forEach(([k, v]) => n.set(k, v)); return n; },
  popitem(d) { const e = d.entries(); if (!e.length) throw new PyError('KeyError', 'popitem(): dictionary is empty'); const [k, v] = e[e.length - 1]; d.delete(k); return mkTuple([k, v]); },
};
const SET_METHODS = {
  add(s, a) { s.add(a[0]); return null; },
  remove(s, a) { if (!s.delete(a[0])) throw new PyError('KeyError', this.repr(a[0])); return null; },
  discard(s, a) { s.delete(a[0]); return null; },
  pop(s) { const v = s.values(); if (!v.length) throw new PyError('KeyError', 'pop from an empty set'); s.delete(v[0]); return v[0]; },
  clear(s) { s.m.clear(); return null; },
  copy(s) { const n = new PySet(this.newId()); s.values().forEach(x => n.add(x)); return n; },
  update(s, a) { this.toArray(a[0]).forEach(x => s.add(x)); return null; },
  union(s, a) { const n = new PySet(this.newId()); s.values().forEach(x => n.add(x)); this.toArray(a[0]).forEach(x => n.add(x)); return n; },
  intersection(s, a) { const o = this.toArray(a[0]); const n = new PySet(this.newId()); s.values().filter(x => o.some(y => eq(x, y))).forEach(x => n.add(x)); return n; },
  difference(s, a) { const o = this.toArray(a[0]); const n = new PySet(this.newId()); s.values().filter(x => !o.some(y => eq(x, y))).forEach(x => n.add(x)); return n; },
};

const api = { Interp, parse, tokenize, PySyntaxError, PyError, PyClass, PyObj, PyFunc, PyDict, PySet, PyRange, BoundMethod, Builtin, Scope, typeName, eq, subclassOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.DSI = api;
})(typeof window !== 'undefined' ? window : globalThis);
