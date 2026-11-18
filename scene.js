/* ==========================================================================
   ساخت «صحنه»: از وضعیت مفسر (متغیرها و پشتهٔ فراخوانی) ساختمان داده‌ها را
   تشخیص می‌دهد (آرایه، لیست پیوندی، درخت، گراف، ...) و توصیف هندسی آن‌ها را می‌سازد.
   این فایل به DOM وابسته نیست.
   ========================================================================== */
(function (root) {
'use strict';
const I = root.DSI || require('./interp.js');
const { PyObj, PyDict, PySet, PyClass, PyFunc, BoundMethod, Builtin, PyRange, subclassOf } = I;

/* ---------- نقش نام ویژگی‌ها ---------- */
const ROLES = {
  left: ['left', 'lchild', 'left_child', 'leftchild', 'lc', 'lft', 'l'],
  right: ['right', 'rchild', 'right_child', 'rightchild', 'rc', 'rgt', 'r'],
  next: ['next', 'nxt', 'link', 'next_node', 'nextnode'],
  prev: ['prev', 'previous', 'prv', 'back', 'prev_node', 'prevnode'],
  parent: ['parent', 'par', 'up'],
  children: ['children', 'kids', 'child', 'subtrees', 'sons', 'childs'],
  graph: ['neighbors', 'neighbours', 'neighbor', 'nbrs'],
};
function roleOf(name) {
  const n = name.toLowerCase();
  for (const r in ROLES) if (ROLES[r].includes(n)) return r;
  return null;
}
const LABEL_PREF = ['key', 'val', 'value', 'data', 'item', 'name', 'id', 'label', 'element', 'elem', 'info', 'x', 'v', 'k', 'letter', 'char', 'title', 'number', 'num'];
const ABBR = { height: 'h', balance: 'bf', balance_factor: 'bf', count: 'cnt', size: 'sz', degree: 'deg', priority: 'p', weight: 'w', depth: 'd' };
const INDEX_RE = /^(i|j|k|l|r|p|q|lo|hi|low|high|mid|start|end|idx|index|pos|ptr|top|front|rear|head|tail|pivot|cur|curr|left|right|min_?idx|max_?idx|min_?index|max_?index|gap|swap_?idx)\d*$|^(i|j|k|idx|index|pos|ptr)_?\w*$/i;
const NODEVAR_RE = /^(u|v|w|x|y|s|t|node|cur|curr|current|start|src|source|target|goal|dest|neighbor|neighbour|nb|nxt|vertex|parent|prev|n)$/i;
const VISITED_RE = /visit|seen|discover|done|closed|explored|marked|finished/i;
const FRONTIER_RE = /queue|stack|frontier|fringe|todo|^open$|^q$|^st$|^stk$|worklist|pending/i;
const GRAPH_NAME_RE = /graph|adj|^g$|network|edges?$/i;

const isPrim = v => v === null || v === undefined || typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string';

function fmtShort(v, max) {
  max = max || 8;
  let s;
  if (v === null || v === undefined) s = 'None';
  else if (typeof v === 'boolean') s = v ? 'True' : 'False';
  else if (typeof v === 'number') s = Number.isInteger(v) ? String(v) : (Math.abs(v) === Infinity ? (v > 0 ? '∞' : '-∞') : String(+v.toFixed(3)));
  else if (typeof v === 'string') s = v;
  else if (Array.isArray(v)) {
    const inner = v.length <= 3 ? v.map(x => fmtShort(x, 3)).join(',') : v.length + '…';
    s = v.isTuple ? '(' + inner + ')' : '[' + inner + ']';
  }
  else if (v instanceof PyObj) s = v.cls.name;
  else if (v instanceof PyDict) s = '{' + v.size + '}';
  else if (v instanceof PySet) s = '{' + v.size + '}';
  else if (v instanceof PyFunc || v instanceof BoundMethod) s = 'fn';
  else s = String(v);
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const keyStr = k => (typeof k) + ':' + (typeof k === 'object' && k ? JSON.stringify(k) : String(k));

/* ---------- جایابی نیرو‌محور برای گراف ---------- */
function relaxLayout(pos, keys, edges, iters) {
  const n = keys.length;
  if (n <= 1) return;
  const L = 105;
  for (let it = 0; it < iters; it++) {
    const f = new Map(keys.map(k => [k, [0, 0]]));
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const pa = pos.get(keys[a]), pb = pos.get(keys[b]);
      let dx = pa.x - pb.x, dy = pa.y - pb.y; let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = (a - b) * 0.1; dy = 0.1; d2 = dx * dx + dy * dy; }
      const d = Math.sqrt(d2), rep = 14000 / d2;
      const fx = dx / d * rep, fy = dy / d * rep;
      f.get(keys[a])[0] += fx; f.get(keys[a])[1] += fy; f.get(keys[b])[0] -= fx; f.get(keys[b])[1] -= fy;
    }
    for (const [a, b] of edges) {
      const pa = pos.get(a), pb = pos.get(b); if (!pa || !pb || a === b) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const s = (d - L) * 0.06, fx = dx / d * s, fy = dy / d * s;
      f.get(a)[0] += fx; f.get(a)[1] += fy; f.get(b)[0] -= fx; f.get(b)[1] -= fy;
    }
    const cool = 1 - it / iters * 0.85;
    for (const k of keys) {
      const p = pos.get(k), v = f.get(k);
      v[0] -= p.x * 0.012; v[1] -= p.y * 0.012;
      const m = Math.hypot(v[0], v[1]), cap = 14 * cool;
      const sc = m > cap ? cap / m : 1;
      p.x += v[0] * sc; p.y += v[1] * sc;
    }
  }
}
function layoutGraph(mem, cardKey, keys, edges) {
  let pos = mem.graphPos.get(cardKey);
  if (!pos) { pos = new Map(); mem.graphPos.set(cardKey, pos); }
  for (const k of [...pos.keys()]) if (!keys.includes(k)) pos.delete(k);
  const fresh = keys.filter(k => !pos.has(k));
  if (fresh.length) {
    const had = pos.size;
    const R = 50 + keys.length * 14;
    if (!had) {
      keys.forEach((k, i) => { const a = -Math.PI / 2 + i / keys.length * Math.PI * 2; pos.set(k, { x: Math.cos(a) * R, y: Math.sin(a) * R }); });
    } else {
      let cx = 0, cy = 0; pos.forEach(p => { cx += p.x; cy += p.y; }); cx /= had; cy /= had;
      fresh.forEach((k, i) => {
        const nb = edges.find(e => (e[0] === k && pos.has(e[1])) || (e[1] === k && pos.has(e[0])));
        const base = nb ? pos.get(nb[0] === k ? nb[1] : nb[0]) : { x: cx, y: cy };
        const a = (hashStr(String(k)) % 360) * Math.PI / 180;
        pos.set(k, { x: base.x + Math.cos(a) * 70, y: base.y + Math.sin(a) * 70 });
      });
    }
    relaxLayout(pos, keys, edges, had ? 140 : 320);
  }
  return pos;
}

/* ================================================================
   buildScene
   ================================================================ */
function buildScene(interp, mem, opts) {
  opts = opts || {};
  const frames = interp.frames, top = frames.length - 1;
  const vars = [];
  frames.forEach((fr, i) => {
    const level = i === 0 ? 'glob' : (i === top ? 'cur' : 'caller');
    for (const [n, v] of fr.scope.vars) { if (n.startsWith('__')) continue; vars.push({ name: n, value: v, level, depth: i }); }
  });
  const strongVars = vars.filter(v => v.level !== 'caller');

  /* --- پویش پشته‌ای حافظه --- */
  const seen = new Set(), insts = [];
  const stack = strongVars.map(v => v.value).reverse();
  let guard = 0;
  while (stack.length && guard++ < 5000) {
    const v = stack.pop();
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    if (v instanceof PyObj) { seen.add(v); insts.push(v); const xs = [...v.attrs.values()]; for (let i = xs.length - 1; i >= 0; i--) stack.push(xs[i]); }
    else if (Array.isArray(v)) { seen.add(v); for (let i = v.length - 1; i >= 0; i--) stack.push(v[i]); }
    else if (v instanceof PyDict) { seen.add(v); v.entries().reverse().forEach(([k, x]) => { stack.push(x); stack.push(k); }); }
    else if (v instanceof PySet) { seen.add(v); v.values().forEach(x => stack.push(x)); }
  }

  /* --- کلاس‌های بازگشتی و گره‌مانند --- */
  const directTargets = o => {
    const out = [];
    for (const [k, v] of o.attrs) {
      if (k.startsWith('__')) continue;
      if (v instanceof PyObj) out.push(v);
      else if (Array.isArray(v)) v.forEach(x => { if (x instanceof PyObj) out.push(x); });
      else if (v instanceof PyDict) v.values().forEach(x => { if (x instanceof PyObj) out.push(x); });
    }
    return out;
  };
  const recClasses = new Set();
  for (const o of insts) for (const t of directTargets(o)) {
    if (subclassOf(t.cls, o.cls) || subclassOf(o.cls, t.cls)) recClasses.add(o.cls);
  }
  const roleCache = new WeakMap();
  const walkAst = (n, fn) => {
    if (Array.isArray(n)) { n.forEach(x => walkAst(x, fn)); return; }
    if (n && typeof n === 'object') { if (n.type) fn(n); for (const k in n) { if (k === 'line') continue; const v = n[k]; if (v && typeof v === 'object') walkAst(v, fn); } }
  };
  const classDeclaresRole = cls => {
    for (let c = cls; c; c = c.base) {
      if (!roleCache.has(c)) {
        let found = false;
        for (const f of c.attrs.values()) {
          if (!(f instanceof PyFunc)) continue;
          walkAst(f.body, n => {
            if (n.type === 'Assign') for (const t of n.targets) if (t.type === 'Attr' && t.obj.type === 'Name' && t.obj.name === 'self' && t.name.length > 1 && roleOf(t.name)) found = true;
          });
        }
        roleCache.set(c, found);
      }
      if (roleCache.get(c)) return true;
    }
    return false;
  };
  const hasRoleAttr = o => {
    if (classDeclaresRole(o.cls)) return true; for (const k of o.attrs.keys()) { if (k.length > 1 && roleOf(k)) return true; } return false; };
  const isNode = o => o instanceof PyObj && !interp.isExc(o.cls) &&
    ([...recClasses].some(c => subclassOf(o.cls, c)) || hasRoleAttr(o));

  const ptrsOf = o => {
    const res = [];
    for (const [name, v] of o.attrs) {
      if (name.startsWith('__')) continue;
      if (v instanceof PyObj) { if (isNode(v)) res.push({ attr: name, target: v }); }
      else if (Array.isArray(v)) v.forEach((x, i) => { if (x instanceof PyObj && isNode(x)) res.push({ attr: name, target: x, idx: i }); });
      else if (v instanceof PyDict) v.entries().forEach(([k, x]) => { if (x instanceof PyObj && isNode(x)) res.push({ attr: name, target: x, dkey: k }); });
    }
    return res;
  };

  const nodes = insts.filter(isNode);
  const nodeSet = new Set(nodes);

  /* --- مؤلفه‌های همبند (اتحاد-یافتن) --- */
  const parent = new Map(nodes.map(o => [o, o]));
  const find = o => { while (parent.get(o) !== o) { parent.set(o, parent.get(parent.get(o))); o = parent.get(o); } return o; };
  for (const o of nodes) for (const p of ptrsOf(o)) if (nodeSet.has(p.target)) parent.set(find(o), find(p.target));
  const compMap = new Map();
  for (const o of nodes) { const r = find(o); if (!compMap.has(r)) compMap.set(r, []); compMap.get(r).push(o); }
  const comps = [...compMap.values()];

  /* --- ریشه‌های غیرگره: آرایه، دیکشنری، مجموعه، شیء ظرف --- */
  const reg = new Map();
  const containerTags = [];
  const register = (obj, label, order, level) => {
    let r = reg.get(obj);
    if (!r) { r = { obj, labels: [], order, level }; reg.set(obj, r); }
    if (!r.labels.includes(label)) r.labels.push(label);
    return r;
  };
  const walkRoot = (val, label, order, level, depth) => {
    if (Array.isArray(val) || val instanceof PyDict || val instanceof PySet) { register(val, label, order, level); return; }
    if (val instanceof PyObj) {
      if (isNode(val) || interp.isExc(val.cls)) return;
      register(val, label, order, level);
      if (depth >= 3) return;
      for (const [a, x] of val.attrs) {
        if (a.startsWith('__')) continue;
        if (x instanceof PyObj) { if (isNode(x)) containerTags.push({ label: label + '.' + a, obj: x, level, order }); else walkRoot(x, label + '.' + a, order, level, depth + 1); }
        else if (Array.isArray(x) || x instanceof PyDict || x instanceof PySet) walkRoot(x, label + '.' + a, order, level, depth + 1);
      }
    }
  };
  vars.forEach((v, idx) => { if (v.level !== 'caller') walkRoot(v.value, v.name, idx, v.level, 0); });

  const usedKeys = new Set();
  const uniq = base => { let k = base, n = 1; while (usedKeys.has(k)) k = base + '#' + (++n); usedKeys.add(k); return k; };

  const items = [];

  /* ================= آرایه / ماتریس ================= */
  const CELL_W = 46, CELL_H = 38, GAP = 6;
  const indexTags = (n, allowRows) => {
    const tags = [];
    for (const v of vars) {
      if (v.level === 'caller') continue;
      if (typeof v.value !== 'number' || !Number.isInteger(v.value)) continue;
      if (!INDEX_RE.test(v.name)) continue;
      if (v.value < 0 || v.value >= n) continue;
      tags.push({ label: v.name, target: 'i' + v.value, level: v.level, below: true });
    }
    return tags;
  };

  function buildArray(r, key) {
    const arr = r.obj, n = arr.length, MAX = 60, cap = Math.min(n, MAX);
    const isMatrix = n > 0 && arr.every(x => Array.isArray(x) && !x.isTuple);
    if (isMatrix) return buildMatrix(r, key);
    const allNum = n > 0 && arr.every(x => typeof x === 'number');
    const bars = !!opts.bars && allNum;
    const maxAbs = allNum ? Math.max(1, ...arr.map(Math.abs)) : 1;
    const ns = [], pos = {};
    for (let i = 0; i < cap; i++) {
      const v = arr[i], k = 'i' + i;
      ns.push({ k, shape: bars ? 'bar' : 'cell', text: fmtShort(v, 8), sub: String(i), w: CELL_W, h: CELL_H, muted: v === null, bh: bars ? 14 + 104 * Math.abs(v) / maxAbs : 0 });
      pos[k] = { x: i * (CELL_W + GAP), y: 0 };
    }
    if (!n) { ns.push({ k: 'empty', shape: 'label', text: 'خالی', sub: '', w: 60, h: 30 }); pos.empty = { x: 0, y: 0 }; }
    if (n > MAX) { ns.push({ k: 'more', shape: 'label', text: `… +${n - MAX}`, sub: '', w: 60, h: 30 }); pos.more = { x: MAX * (CELL_W + GAP), y: 0 }; }
    return {
      key, kind: arr.isTuple ? 'tuple' : 'array', typeFa: arr.isTuple ? 'چندتایی' : 'آرایه / لیست', title: r.labels.join(' = '),
      meta: `طول ${n}`, nodes: ns, edges: [], pos, tags: indexTags(cap), nullTags: [], bars, tagSide: 'below', wide: n > 8,
    };
  }
  function buildMatrix(r, key) {
    const rows = r.obj, MAXR = 14, MAXC = 14;
    const nr = Math.min(rows.length, MAXR), nc = Math.min(Math.max(...rows.map(x => x.length)), MAXC);
    const ns = [], pos = {}, W = 40, H = 34;
    for (let c = 0; c < nc; c++) { const k = 'ch' + c; ns.push({ k, shape: 'label', text: String(c), sub: '', w: W, h: 22, muted: true }); pos[k] = { x: (c + 1) * (W + 4), y: 0 }; }
    for (let i = 0; i < nr; i++) {
      const rk = 'rh' + i; ns.push({ k: rk, shape: 'label', text: String(i), sub: '', w: 22, h: H, muted: true }); pos[rk] = { x: 0, y: (i + 1) * (H + 4) };
      for (let c = 0; c < Math.min(rows[i].length, nc); c++) {
        const v = rows[i][c], k = `m${i},${c}`;
        ns.push({ k, shape: 'cell', text: fmtShort(v, 5), sub: '', w: W, h: H, muted: v === 0 || v === null, cls: v === 1 || v === true ? 'hit' : '' });
        pos[k] = { x: (c + 1) * (W + 4), y: (i + 1) * (H + 4) };
      }
    }
    return { key, kind: 'matrix', typeFa: 'آرایهٔ دوبعدی', title: r.labels.join(' = '), meta: `${rows.length}×${Math.max(...rows.map(x => x.length))}`, nodes: ns, edges: [], pos, tags: [], nullTags: [], wide: nc > 6 };
  }

  function buildDictTable(r, key) {
    const d = r.obj, ents = d.entries().slice(0, 30);
    const ns = [], pos = {};
    ents.forEach(([k, v], i) => {
      const sk = keyStr(k);
      ns.push({ k: 'k' + sk, shape: 'cell', text: fmtShort(k, 9), sub: '', w: 72, h: 32, cls: 'dkey' });
      ns.push({ k: 'v' + sk, shape: 'cell', text: fmtShort(v, 10), sub: '', w: 92, h: 32, muted: v === null });
      pos['k' + sk] = { x: 0, y: i * 36 }; pos['v' + sk] = { x: 80, y: i * 36 };
    });
    if (!ents.length) { ns.push({ k: 'empty', shape: 'label', text: 'خالی', sub: '', w: 60, h: 30 }); pos.empty = { x: 0, y: 0 }; }
    return { key, kind: 'dict', typeFa: 'دیکشنری', title: r.labels.join(' = '), meta: `${d.size} مدخل`, nodes: ns, edges: [], pos, tags: [], nullTags: [], wide: false };
  }
  function buildSet(r, key) {
    const s = r.obj, vals = s.values().slice(0, 40), ns = [], pos = {};
    vals.forEach((v, i) => { const k = 's' + keyStr(v); ns.push({ k, shape: 'cell', text: fmtShort(v, 8), sub: '', w: CELL_W, h: 34, cls: 'set' }); pos[k] = { x: (i % 12) * (CELL_W + GAP), y: Math.floor(i / 12) * 44 }; });
    if (!vals.length) { ns.push({ k: 'empty', shape: 'label', text: '∅', sub: '', w: 40, h: 30 }); pos.empty = { x: 0, y: 0 }; }
    return { key, kind: 'set', typeFa: 'مجموعه', title: r.labels.join(' = '), meta: `${s.size} عضو`, nodes: ns, edges: [], pos, tags: [], nullTags: [], wide: false };
  }

  /* ================= گراف‌های مبتنی بر کلید (دیکشنری / ماتریس / لیست مجاورت) ================= */
  const keyedGraphs = [];     // برای پوشش‌ها
  function graphDescFromKeys(key, title, typeFa, gkeys, gedges, selfObj) {
    // gkeys: [{id, text}], gedges: [{a, b, w}]
    const idSet = new Set(gkeys.map(g => g.id));
    const emap = new Map(gedges.map(e => [e.a + '\u0001' + e.b, e]));
    const ns = [], edges = [], done = new Set();
    for (const e of gedges) {
      const rev = emap.has(e.b + '\u0001' + e.a) && e.a !== e.b;
      const pk = e.a < e.b ? e.a + '\u0001' + e.b : e.b + '\u0001' + e.a;
      if (rev) { if (done.has(pk)) continue; done.add(pk); }
      edges.push({ k: `${e.a}>${e.b}`, a: 'g' + e.a, b: 'g' + e.b, style: rev ? 'gu' : 'g', label: e.w === undefined || e.w === null ? '' : fmtShort(e.w, 5) });
    }
    const keys = gkeys.map(g => 'g' + g.id);
    const pos = layoutGraph(mem, key, keys, edges.map(e => [e.a, e.b]));
    const posObj = {};
    for (const g of gkeys) { ns.push({ k: 'g' + g.id, shape: 'circle', text: g.text, sub: '', w: 44, h: 44 }); posObj['g' + g.id] = { x: pos.get('g' + g.id).x, y: pos.get('g' + g.id).y }; }
    const desc = { key, kind: 'graph', typeFa, title, meta: `${gkeys.length} رأس، ${gedges.length} یال`, nodes: ns, edges, pos: posObj, tags: [], nullTags: [], wide: true, tagSide: 'above' };
    overlayGraph(desc, gkeys, selfObj);
    return desc;
  }
  function overlayGraph(desc, gkeys, selfObj) {
    const byKey = new Map(gkeys.map(g => [keyStr(g.raw), 'g' + g.id]));
    const nodeBy = new Map(desc.nodes.map(n => [n.k, n]));
    let overlays = 0;
    for (const v of vars) {
      if (v.value === selfObj) continue;
      const val = v.value;
      if (VISITED_RE.test(v.name) && (val instanceof PySet || Array.isArray(val) || val instanceof PyDict)) {
        const els = val instanceof PySet ? val.values() : val instanceof PyDict ? val.keys() : val;
        els.forEach(x => { const nk = byKey.get(keyStr(x)); if (nk) nodeBy.get(nk).cls = (nodeBy.get(nk).cls || '') + ' visited'; });
        continue;
      }
      if (FRONTIER_RE.test(v.name) && Array.isArray(val)) {
        val.forEach(x => { const nk = byKey.get(keyStr(x)); if (nk) nodeBy.get(nk).cls = (nodeBy.get(nk).cls || '') + ' frontier'; });
        continue;
      }
      if (val instanceof PyDict && val.size && overlays < 2 && v.level !== 'caller') {
        const ents = val.entries();
        if (ents.every(([k, x]) => byKey.has(keyStr(k)) && isPrim(x))) {
          overlays++;
          ents.forEach(([k, x]) => { const n = nodeBy.get(byKey.get(keyStr(k))); n.sub = (n.sub ? n.sub + ' ' : '') + v.name + ':' + fmtShort(x, 4); });
          continue;
        }
      }
      if ((typeof val === 'string' || (typeof val === 'number' && Number.isInteger(val) && NODEVAR_RE.test(v.name))) && byKey.has(keyStr(val))) {
        desc.tags.push({ label: v.name, target: byKey.get(keyStr(val)), level: v.level === 'caller' ? 'caller' : v.level });
      }
    }
  }

  function dictGraphInfo(d, label) {
    if (!d.size) return null;
    const vals = d.values();
    if (!vals.every(v => Array.isArray(v) || v instanceof PySet || v instanceof PyDict)) return null;
    const keySet = new Set(d.keys().map(keyStr));
    const edges = []; let linked = false;
    for (const [k, v] of d.entries()) {
      const items = v instanceof PyDict ? v.entries() : (v instanceof PySet ? v.values() : v).map(x => x);
      for (const it of items) {
        let to, w;
        if (v instanceof PyDict) { to = it[0]; w = it[1]; }
        else if (Array.isArray(it) && it.length === 2 && typeof it[1] === 'number' && (keySet.has(keyStr(it[0])) || !Array.isArray(it[0]))) { to = it[0]; w = it[1]; }
        else to = it;
        if (isPrimKey(to)) { edges.push({ from: k, to, w }); if (keySet.has(keyStr(to))) linked = true; }
      }
    }
    if (!linked && !GRAPH_NAME_RE.test(label)) return null;
    return { edges };
  }
  const isPrimKey = x => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean';

  function buildKeyedGraphFromDict(r, key) {
    const info = dictGraphInfo(r.obj, r.labels[0]);
    if (!info) return null;
    const keys = []; const seenK = new Set(); const add = k => { const s = keyStr(k); if (!seenK.has(s)) { seenK.add(s); keys.push(k); } };
    r.obj.keys().forEach(add); info.edges.forEach(e => add(e.to));
    const idOf = k => 'd' + keys.findIndex(x => keyStr(x) === keyStr(k));
    const gkeys = keys.map(k => ({ id: idOf(k), text: fmtShort(k, 6), raw: k }));
    const gedges = info.edges.map(e => ({ a: idOf(e.from), b: idOf(e.to), w: e.w }));
    return graphDescFromKeys(key, r.labels.join(' = '), 'گراف (لیست مجاورت)', gkeys, gedges, r.obj);
  }
  function buildKeyedGraphFromArray(r, key) {
    const rows = r.obj; const n = rows.length;
    if (!n || !rows.every(x => Array.isArray(x))) return null;
    const square = rows.every(x => x.length === n);
    const allNums = rows.every(x => x.every(y => typeof y === 'number' || typeof y === 'boolean' || y === null));
    const gkeys = rows.map((_, i) => ({ id: 'a' + i, text: String(i), raw: i }));
    const gedges = [];
    if (square && allNums) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = rows[i][j]; if (v && v !== Infinity && i !== j || (v && i === j)) gedges.push({ a: 'a' + i, b: 'a' + j, w: (v === true || v === 1) ? undefined : v }); }
      return graphDescFromKeys(key, r.labels.join(' = '), 'گراف (ماتریس مجاورت)', gkeys, gedges, r.obj);
    }
    if (rows.every(x => x.every(y => typeof y === 'number' && y >= 0 && y < n))) {
      rows.forEach((row, i) => row.forEach(j => gedges.push({ a: 'a' + i, b: 'a' + j })));
      return graphDescFromKeys(key, r.labels.join(' = '), 'گراف (لیست مجاورت)', gkeys, gedges, r.obj);
    }
    return null;
  }

  /* ---- پردازش ریشه‌های ثبت‌شده ---- */
  const regList = [...reg.values()].sort((a, b) => a.order - b.order);
  for (const r of regList) {
    const o = r.obj; let desc = null;
    const label = r.labels[0];
    const key = uniq('v:' + label);
    if (Array.isArray(o)) {
      if (GRAPH_NAME_RE.test(label) || r.labels.some(l => GRAPH_NAME_RE.test(l))) {
        const g = buildKeyedGraphFromArray(r, key + ':graph');
        if (g) { usedKeys.add(key + ':graph'); items.push({ order: r.order + 0.5, desc: g }); }
      }
      desc = buildArray(r, key);
    } else if (o instanceof PyDict) {
      const g = buildKeyedGraphFromDict(r, key);
      desc = g || buildDictTable(r, key);
    } else if (o instanceof PySet) desc = buildSet(r, key);
    else if (o instanceof PyObj) desc = buildObjectCard(r, key);
    if (desc) items.push({ order: r.order, desc });
  }

  function buildObjectCard(r, key) {
    const o = r.obj, rows = [];
    for (const [k, v] of o.attrs) {
      if (k.startsWith('__')) continue;
      let ref = null, text;
      if (v instanceof PyObj) { text = '→ ' + v.cls.name + '#' + v.id; ref = isNode(v) ? 'node' : 'obj'; }
      else if (Array.isArray(v) || v instanceof PyDict || v instanceof PySet) { text = '→ ' + I.typeName(v) + ' (' + (v.length !== undefined ? v.length : v.size) + ')'; ref = 'coll'; }
      else text = interp.repr(v);
      rows.push({ name: k, text, ref, none: v === null });
    }
    return { key, kind: 'object', typeFa: 'شیء', title: r.labels.join(' = '), meta: o.cls.name + ' #' + o.id, rows, wide: false };
  }

  /* ================= ساختارهای مبتنی بر گره ================= */
  function nodeInfo(o) {
    const simple = v => isPrim(v);
    let la = null;
    for (const p of LABEL_PREF) if (o.attrs.has(p) && simple(o.attrs.get(p))) { la = p; break; }
    if (!la) for (const [k, v] of o.attrs) { if (k.startsWith('__') || roleOf(k)) continue; if (simple(v)) { la = k; break; } }
    const text = la ? fmtShort(o.attrs.get(la), 7) : o.cls.name.slice(0, 2);
    const subs = []; let cls = '';
    for (const [k, v] of o.attrs) {
      if (k === la || k.startsWith('__') || !simple(v)) continue;
      if (k === 'color' && typeof v === 'string') { const c = v.toLowerCase(); if (c === 'red' || c === 'r') cls += ' rb-red'; else if (c === 'black' || c === 'b') cls += ' rb-black'; continue; }
      if (k === 'visited' && v === true) { cls += ' visited'; continue; }
      if (roleOf(k)) continue;
      if (subs.length < 2) subs.push((ABBR[k] !== undefined ? ABBR[k] : (k.length <= 4 ? k : k.slice(0, 3))) + ':' + fmtShort(v, 4));
    }
    return { text, sub: subs.join(' '), cls: cls.trim(), la };
  }
  const nk = o => 'n' + o.id;
  const firstPtr = (o, role) => ptrsOf(o).find(p => roleOf(p.attr) === role);

  function compKind(cn) {
    let LR = false, NEXT = false, PREV = false, KIDS = false, GR = false;
    const names = new Set();
    for (const o of cn) {
      for (const [name, v] of o.attrs) {
        const r = roleOf(name);
        if (r === 'left' || r === 'right') LR = true;
        else if (r === 'next') NEXT = true;
        else if (r === 'prev') PREV = true;
        else if (r === 'children' && (Array.isArray(v) || v instanceof PyDict || v instanceof PyObj || v === null)) KIDS = true;
        else if (r === 'graph') GR = true;
      }
      ptrsOf(o).forEach(p => { if (roleOf(p.attr) !== 'parent') names.add(p.attr); });
    }
    if (GR) return 'graph';
    if (KIDS && !LR) return 'tree';
    if (LR) return 'btree';
    if (NEXT || PREV) return PREV ? 'dlist' : 'list';
    if (names.size === 0) return 'single';
    if (names.size === 1) return 'list';
    if (names.size === 2) return 'btree2';
    return 'graph';
  }

  function chooseRoots(cn, inDeg, tagOrder) {
    let roots = cn.filter(o => !inDeg.get(o));
    if (!roots.length) {
      const pref = tagOrder.find(o => cn.includes(o));
      roots = [pref || cn.slice().sort((a, b) => a.id - b.id)[0]];
    }
    return roots.sort((a, b) => a.id - b.id);
  }

  function buildComp(cn, key, tags, tagOrder) {
    const kind = compKind(cn);
    const ns = [], edges = [], pos = {};
    const info = new Map(cn.map(o => [o, nodeInfo(o)]));
    const inComp = new Set(cn);
    const addNode = (o, shape, extra) => {
      const i = info.get(o);
      ns.push(Object.assign({ k: nk(o), shape, text: i.text, sub: i.sub, cls: i.cls, w: 44, h: 44 }, extra || {}));
    };
    const edgeKey = (a, attr, b, extra) => `${nk(a)}.${attr}${extra === undefined ? '' : '[' + extra + ']'}>${nk(b)}`;
    let typeFa = '', wide = true, tagSide = 'above';

    if (kind === 'btree' || kind === 'btree2') {
      typeFa = 'درخت دودویی';
      let lAttr = null, rAttr = null;
      if (kind === 'btree2') { const names = []; cn.forEach(o => ptrsOf(o).forEach(p => { if (!names.includes(p.attr) && roleOf(p.attr) !== 'parent') names.push(p.attr); })); lAttr = names[0]; rAttr = names[1]; }
      const kidOf = (o, side) => {
        const p = ptrsOf(o).find(q => (kind === 'btree2' ? q.attr === (side === 'L' ? lAttr : rAttr) : roleOf(q.attr) === (side === 'L' ? 'left' : 'right')));
        return p ? p : null;
      };
      const inDeg = new Map();
      cn.forEach(o => ['L', 'R'].forEach(s => { const p = kidOf(o, s); if (p && inComp.has(p.target)) inDeg.set(p.target, (inDeg.get(p.target) || 0) + 1); }));
      const roots = chooseRoots(cn, inDeg, tagOrder);
      const placed = new Map(), par = new Map(); let counter = 0;
      const go = (o, d) => {
        placed.set(o, { d, x: 0 });
        const l = kidOf(o, 'L'); if (l && !placed.has(l.target)) { par.set(l.target, o); go(l.target, d + 1); }
        placed.get(o).x = counter++;
        const rr = kidOf(o, 'R'); if (rr && !placed.has(rr.target)) { par.set(rr.target, o); go(rr.target, d + 1); }
      };
      roots.forEach(r => { if (!placed.has(r)) { go(r, 0); counter += 0.5; } });
      cn.forEach(o => { if (!placed.has(o)) { go(o, 0); counter += 0.5; } });
      cn.forEach(o => { addNode(o, 'circle'); pos[nk(o)] = { x: placed.get(o).x * 58, y: placed.get(o).d * 78 }; });
      cn.forEach(o => {
        for (const p of ptrsOf(o)) {
          const r = roleOf(p.attr);
          const side = (kind === 'btree2') ? (p.attr === lAttr ? 'L' : p.attr === rAttr ? 'R' : null) : (r === 'left' ? 'L' : r === 'right' ? 'R' : null);
          if (side) {
            const tree = par.get(p.target) === o;
            edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: tree ? 'tree' : 'back', label: '' });
          } else if (r === 'parent') edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: 'parent' });
          else edges.push({ k: edgeKey(o, p.attr, p.target, p.idx), a: nk(o), b: nk(p.target), style: 'back' });
        }
      });
    }
    else if (kind === 'tree') {
      typeFa = 'درخت عمومی';
      const kidsOf = o => ptrsOf(o).filter(p => { const r = roleOf(p.attr); return r !== 'parent' && r !== 'prev'; });
      const inDeg = new Map();
      cn.forEach(o => kidsOf(o).forEach(p => inDeg.set(p.target, (inDeg.get(p.target) || 0) + 1)));
      const roots = chooseRoots(cn, inDeg, tagOrder);
      const placed = new Map(), par = new Map(); const widthOf = new Map();
      const measure = (o, vis) => {
        if (vis.has(o)) return 0; vis.add(o);
        let w = 0; let any = false;
        for (const p of kidsOf(o)) { if (par.has(p.target) || vis.has(p.target)) continue; par.set(p.target, o); w += measure(p.target, vis); any = true; }
        w = any ? w : 1; widthOf.set(o, w); return w;
      };
      const vis = new Set();
      const all = roots.concat(cn.filter(o => !roots.includes(o)));
      const tops = [];
      all.forEach(r => { if (!vis.has(r) && !par.has(r)) { measure(r, vis); tops.push(r); } });
      const place = (o, left, d) => {
        const w = widthOf.get(o);
        placed.set(o, { x: left + w / 2 - 0.5, d });
        let cur = left;
        for (const p of kidsOf(o)) if (par.get(p.target) === o && !placed.has(p.target)) { place(p.target, cur, d + 1); cur += widthOf.get(p.target); }
      };
      let off = 0; tops.forEach(t => { place(t, off, 0); off += widthOf.get(t) + 0.4; });
      cn.forEach(o => { const pl = placed.get(o) || { x: off++, d: 0 }; addNode(o, 'circle'); pos[nk(o)] = { x: pl.x * 62, y: pl.d * 78 }; });
      cn.forEach(o => {
        for (const p of ptrsOf(o)) {
          const r = roleOf(p.attr);
          if (r === 'parent' || r === 'prev') { edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: 'parent' }); continue; }
          const tree = par.get(p.target) === o;
          edges.push({ k: edgeKey(o, p.attr, p.target, p.dkey !== undefined ? 'k' + keyStr(p.dkey) : p.idx), a: nk(o), b: nk(p.target), style: tree ? 'tree' : 'back', label: p.dkey !== undefined ? fmtShort(p.dkey, 4) : '' });
        }
      });
    }
    else if (kind === 'list' || kind === 'dlist' || kind === 'single') {
      const dbl = kind === 'dlist';
      typeFa = dbl ? 'لیست پیوندی دوطرفه' : 'لیست پیوندی یک‌طرفه';
      const nextAttrOf = o => { const p = ptrsOf(o).find(q => roleOf(q.attr) === 'next') || ptrsOf(o).find(q => !['prev', 'parent'].includes(roleOf(q.attr))); return p; };
      const inDeg = new Map();
      cn.forEach(o => { const p = nextAttrOf(o); if (p && inComp.has(p.target)) inDeg.set(p.target, (inDeg.get(p.target) || 0) + 1); });
      const heads = chooseRoots(cn, inDeg, tagOrder);
      const rowsList = []; const visited = new Set();
      const walk = h => { const row = []; let c = h; while (c && !visited.has(c)) { visited.add(c); row.push(c); const p = nextAttrOf(c); c = p ? p.target : null; } return row; };
      heads.forEach(h => { if (!visited.has(h)) rowsList.push(walk(h)); });
      cn.forEach(o => { if (!visited.has(o)) rowsList.push(walk(o)); });
      const W = dbl ? 120 : 84, STEP = W + 44;
      rowsList.forEach((row, ri) => row.forEach((o, i) => {
        const hasPrev = dbl, i2 = info.get(o);
        const nn = nextAttrOf(o), pp = ptrsOf(o).find(q => roleOf(q.attr) === 'prev');
        addNode(o, dbl ? 'dlnode' : 'lnode', { w: W, h: 40, nullNext: !nn, nullPrev: dbl && !pp });
        pos[nk(o)] = { x: i * STEP, y: ri * 96 };
      }));
      const idxOf = new Map(); rowsList.forEach((row, ri) => row.forEach((o, i) => idxOf.set(o, { ri, i })));
      cn.forEach(o => {
        const nxt = nextAttrOf(o);
        for (const p of ptrsOf(o)) {
          const r = roleOf(p.attr);
          const isNext = !!nxt && p.attr === nxt.attr && p.target === nxt.target && p.idx === nxt.idx;
          if (isNext) {
            const a = idxOf.get(o), b = idxOf.get(p.target);
            const fwd = a.ri === b.ri && b.i === a.i + 1;
            edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: fwd ? 'next' : 'nextback', dbl });
          } else if (r === 'prev') edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: 'prev', dbl });
          else if (r === 'parent') edges.push({ k: edgeKey(o, p.attr, p.target), a: nk(o), b: nk(p.target), style: 'parent' });
          else edges.push({ k: edgeKey(o, p.attr, p.target, p.idx), a: nk(o), b: nk(p.target), style: 'nextback', dbl });
        }
      });
    }
    else { // graph
      typeFa = 'گراف';
      const keys = cn.map(nk); const emap = new Set(); const es = [];
      cn.forEach(o => ptrsOf(o).forEach(p => { if (roleOf(p.attr) === 'parent') return; es.push([nk(o), nk(p.target)]); emap.add(nk(o) + '>' + nk(p.target)); }));
      const done = new Set();
      es.forEach(([a, b]) => {
        const rev = emap.has(b + '>' + a) && a !== b;
        const pk = a < b ? a + '|' + b : b + '|' + a;
        if (rev) { if (done.has(pk)) return; done.add(pk); }
        edges.push({ k: `${a}>${b}`, a, b, style: rev ? 'gu' : 'g', label: '' });
      });
      const gp = layoutGraph(mem, key, keys, es);
      cn.forEach(o => { addNode(o, 'circle'); pos[nk(o)] = { x: gp.get(nk(o)).x, y: gp.get(nk(o)).y }; });
    }

    // برچسب‌های اشاره‌گر
    const myTags = tags.filter(t => cn.includes(t.obj)).map(t => ({ label: t.label, target: nk(t.obj), level: t.level }));
    const nullTags = [];
    const everSet = mem.everTags.get(key) || new Set();
    myTags.forEach(t => { if (t.level !== 'caller') everSet.add(t.label); });
    mem.everTags.set(key, everSet);
    for (const v of vars) if (v.level !== 'caller' && v.value === null && everSet.has(v.name)) nullTags.push(v.name);
    return { key, kind: kind === 'btree2' ? 'btree' : kind, typeFa, title: '', meta: `${cn.length} گره`, nodes: ns, edges, pos, tags: myTags, nullTags, wide, tagSide };
  }

  /* --- برچسب‌ها (اشاره‌گرها) برای مؤلفه‌ها --- */
  const allTagSources = [];
  vars.forEach((v, idx) => { if (v.value instanceof PyObj && nodeSet.has(v.value)) allTagSources.push({ label: v.name, obj: v.value, level: v.level, order: idx }); });
  containerTags.forEach(t => allTagSources.push(t));
  const strongOrder = allTagSources.filter(t => t.level !== 'caller').sort((a, b) => a.order - b.order).map(t => t.obj);

  // کلید پایدار کارت: بیشترین هم‌پوشانی با کارت‌های قبلی
  const takenPrev = new Set();
  const newPrev = new Map();
  comps.forEach(cn => {
    const ids = new Set(cn.map(o => o.id));
    let best = null, bestN = 0;
    for (const [k, set] of mem.prevSets) {
      if (takenPrev.has(k)) continue;
      let c = 0; ids.forEach(id => { if (set.has(id)) c++; });
      if (c > bestN) { bestN = c; best = k; }
    }
    let key;
    if (best) { key = best; takenPrev.add(best); } else key = 'c' + (mem.counter++);
    usedKeys.add(key);
    newPrev.set(key, ids);
    const desc = buildComp(cn, key, allTagSources, strongOrder);
    const lab = [];
    allTagSources.filter(t => t.level !== 'caller' && cn.includes(t.obj)).forEach(t => { if (!lab.includes(t.label)) lab.push(t.label); });
    desc.title = lab.length ? lab.slice(0, 3).join(' ، ') : desc.typeFa;
    const order = Math.min(Infinity, ...allTagSources.filter(t => t.level !== 'caller' && cn.includes(t.obj)).map(t => t.order));
    items.push({ order: isFinite(order) ? order : 1e6 + cn[0].id, desc });
  });
  mem.prevSets = newPrev;
  items.sort((a, b) => a.order - b.order);
  return items.map(i => i.desc);
}

function newMemory() { return { prevSets: new Map(), counter: 1, everTags: new Map(), graphPos: new Map() }; }

const api = { buildScene, newMemory, fmtShort, roleOf, hashStr, keyStr };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.DSScene = api;
})(typeof window !== 'undefined' ? window : globalThis);
