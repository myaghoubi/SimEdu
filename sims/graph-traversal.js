/* شبیه‌ساز پیمایش عمقی (DFS) و سطحی (BFS) گراف — درس ساختمان داده‌ها و الگوریتم‌ها
   فایل مستقل: موتور گام‌ها + استایل + قالب + رابط. به کتابخانه‌ی lib/stepper.js وابسته است
   (چیدمان کد/Trace/Watch و نوار کنترل). راس‌ها با ماوس یا لمس قابل جابه‌جایی‌اند. */
(function () {
'use strict';

const R = 22, VW = 640, VH = 400, MAX_NODES = 10, LETTERS = 'ABCDEFGHIJ';
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = Stepper.esc;
const py = (v) => "'" + v + "'";
const pyList = (a) => '[' + a.map(py).join(', ') + ']';
const pySet = (a) => (a.length ? '{' + a.map(py).join(', ') + '}' : 'set()');

/* ===================== گراف‌های نمونه (مختصات در بوم 640×400) ===================== */
const PRESETS = [
  { name: 'نمونه ۱ — گراف دارای حلقه (۷ راس)',
    nodes: { A: [320, 55], B: [160, 150], C: [480, 150], D: [90, 300], E: [250, 290], F: [410, 290], G: [560, 300] },
    edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'], ['F', 'G']] },
  { name: 'نمونه ۲ — درخت دودویی (تفاوت سطحی و عمقی)',
    nodes: { A: [320, 50], B: [170, 165], C: [470, 165], D: [95, 310], E: [245, 310], F: [395, 310], G: [545, 310] },
    edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'F'], ['C', 'G']] },
  { name: 'نمونه ۳ — گراف ناهمبند',
    nodes: { A: [110, 90], B: [260, 160], C: [120, 280], D: [400, 90], E: [540, 170], F: [430, 300], G: [580, 330] },
    edges: [['A', 'B'], ['B', 'C'], ['A', 'C'], ['D', 'E'], ['E', 'F'], ['D', 'F']] },
  { name: 'نمونه ۴ — شبکه‌ی ۸ راسی',
    nodes: { A: [110, 70], B: [320, 70], C: [530, 70], D: [110, 200], E: [320, 200], F: [530, 200], G: [215, 340], H: [425, 340] },
    edges: [['A', 'B'], ['B', 'C'], ['A', 'D'], ['B', 'E'], ['C', 'F'], ['D', 'E'], ['E', 'F'], ['D', 'G'], ['E', 'H'], ['G', 'H'], ['F', 'H']] }
];

/* ===================== موتور: لیست مجاورت و گام‌های الگوریتم‌ها ===================== */
function adjacency(G, directed) {
  const adj = {};
  G.nodes.forEach((n) => { adj[n.id] = new Set(); });
  G.edges.forEach(([a, b]) => {
    if (!adj[a] || !adj[b]) return;
    adj[a].add(b);
    if (!directed) adj[b].add(a);
  });
  const out = {};
  Object.keys(adj).sort().forEach((id) => { out[id] = [...adj[id]].sort(); });
  return out;
}

const CODE = {
  bfs: { tab: 'bfs(graph, start)', lines: [
    'def bfs(graph, start):',
    '    visited = {start}',
    '    queue = [start]',
    '    order = []',
    '    while queue:',
    '        v = queue.pop(0)           # dequeue',
    '        order.append(v)',
    '        for w in graph[v]:',
    '            if w not in visited:',
    '                visited.add(w)',
    '                queue.append(w)    # enqueue',
    '    return order'] },
  dfss: { tab: 'dfs(graph, start)', lines: [
    'def dfs(graph, start):',
    '    visited = set()',
    '    stack = [start]',
    '    order = []',
    '    while stack:',
    '        v = stack.pop()            # pop',
    '        if v not in visited:',
    '            visited.add(v)',
    '            order.append(v)',
    '            for w in reversed(graph[v]):',
    '                stack.append(w)    # push',
    '    return order'] },
  dfsr: { tab: 'dfs(v)', lines: [
    'def dfs(v):',
    '    visited.add(v)',
    '    order.append(v)',
    '    for w in graph[v]:',
    '        if w not in visited:',
    '            dfs(w)                 # فراخوانی بازگشتی'] }
};

/* وضعیت اولیه‌ی هر الگوریتم (قبل از اجرا) */
function idleSnap(algo) {
  const s = { done: [], tree: [], cur: null, exam: null };
  if (algo === 'dfsr') { s.visited = []; s.order = []; s.frames = []; }
  return s;
}

function run(algo, adj, start) {
  const st = idleSnap(algo), loc = {}, steps = [], res = { out: null };
  const rec = (line, note) => steps.push({ line, note, snap: clone(st), loc: clone(loc), out: res.out });
  const finish = () => { if (st.cur != null && !st.done.includes(st.cur)) st.done.push(st.cur); st.cur = null; st.exam = null; };
  const unreached = (order) => {
    const u = Object.keys(adj).filter((x) => !order.includes(x));
    return u.length ? ' — راس‌های ' + u.join('، ') + ' از راس شروع قابل دسترسی نیستند.' : '';
  };

  if (algo === 'bfs') {
    loc.start = start; rec(0, 'فراخوانی bfs(graph, ' + py(start) + ')');
    st.visited = [start]; rec(1, 'راس شروع ' + start + ' «دیده‌شده» علامت خورد (در BFS هر راس هنگام ورود به صف علامت می‌خورد).');
    st.queue = [start]; rec(2, 'صف با راس شروع مقداردهی شد.');
    st.order = []; rec(3, 'لیست خروجی (ترتیب پیمایش) خالی است.');
    for (;;) {
      finish();
      if (!st.queue.length) { rec(4, 'queue خالی است ← حلقه تمام می‌شود.'); break; }
      rec(4, 'queue خالی نیست ← یک دور دیگر.');
      const v = st.queue.shift(); loc.v = v; st.cur = v;
      rec(5, 'v = ' + py(v) + ' از ابتدای صف برداشته شد (dequeue).');
      st.order.push(v); rec(6, py(v) + ' به ترتیب پیمایش اضافه شد.');
      const nb = adj[v];
      if (!nb.length) rec(7, 'graph[' + py(v) + '] خالی است؛ همسایه‌ای برای بررسی نیست.');
      for (const w of nb) {
        loc.w = w; st.exam = [v, w]; rec(7, 'w = ' + py(w) + ' (همسایه‌ی بعدیِ ' + v + ')');
        const seen = st.visited.includes(w);
        rec(8, py(w) + ' not in visited ؟ ' + (seen ? 'نادرست — قبلاً دیده شده؛ نادیده گرفته می‌شود.' : 'درست — هنوز دیده نشده.'));
        if (!seen) {
          st.visited.push(w); st.tree.push([v, w]); rec(9, py(w) + ' علامت «دیده‌شده» خورد (یال ' + v + '–' + w + ' جزو درخت پیمایش شد).');
          st.queue.push(w); rec(10, py(w) + ' به انتهای صف رفت (enqueue).');
        }
      }
    }
    res.out = [...st.order];
    rec(11, 'ترتیب پیمایش سطحی: ' + st.order.join(' ← ') + unreached(st.order));
  } else if (algo === 'dfss') {
    loc.start = start; rec(0, 'فراخوانی dfs(graph, ' + py(start) + ')');
    st.visited = []; rec(1, 'visited مجموعه‌ی خالی است (در این روش علامت‌گذاری هنگام pop انجام می‌شود).');
    st.stack = [start]; st.stackFrom = [null]; rec(2, 'پشته با راس شروع مقداردهی شد.');
    st.order = []; rec(3, 'لیست خروجی (ترتیب پیمایش) خالی است.');
    for (;;) {
      finish();
      if (!st.stack.length) { rec(4, 'stack خالی است ← حلقه تمام می‌شود.'); break; }
      rec(4, 'stack خالی نیست ← یک دور دیگر.');
      const v = st.stack.pop(), from = st.stackFrom.pop(); loc.v = v; st.cur = v;
      rec(5, 'v = ' + py(v) + ' از بالای پشته برداشته شد (pop).');
      const seen = st.visited.includes(v);
      rec(6, py(v) + ' not in visited ؟ ' + (seen ? 'نادرست — این راس قبلاً دیده شده؛ نسخه‌ی تکراری نادیده گرفته می‌شود.' : 'درست — اولین بار است.'));
      if (seen) continue;
      st.visited.push(v); if (from != null) st.tree.push([from, v]);
      rec(7, py(v) + ' علامت «دیده‌شده» خورد' + (from != null ? ' (یال ' + from + '–' + v + ' جزو درخت پیمایش شد).' : '.'));
      st.order.push(v); rec(8, py(v) + ' به ترتیب پیمایش اضافه شد.');
      const nb = [...adj[v]].reverse();
      if (!nb.length) rec(9, 'graph[' + py(v) + '] خالی است؛ چیزی push نمی‌شود.');
      for (const w of nb) {
        loc.w = w; st.exam = [v, w];
        rec(9, 'w = ' + py(w) + ' (همسایه‌ها از آخر به اول می‌آیند تا کوچک‌ترین همسایه بالای پشته بماند).');
        st.stack.push(w); st.stackFrom.push(v); rec(10, py(w) + ' روی پشته push شد.');
      }
    }
    res.out = [...st.order];
    rec(11, 'ترتیب پیمایش عمقی: ' + st.order.join(' ← ') + unreached(st.order));
  } else {
    const top = () => st.frames[st.frames.length - 1];
    const sync = () => {
      const t = top();
      if (t) { loc.v = t.v; if (t.w != null) loc.w = t.w; else delete loc.w; } else { delete loc.v; delete loc.w; }
    };
    const call = (v, from) => {
      st.frames.push({ v, w: null }); st.cur = v; st.exam = null;
      if (from != null) st.tree.push([from, v]);
      sync();
      rec(0, 'فراخوانی dfs(' + py(v) + ') — فریم جدید روی پشته‌ی فراخوانی؛ عمق = ' + st.frames.length);
      st.visited.push(v); rec(1, py(v) + ' علامت «دیده‌شده» خورد.');
      st.order.push(v); rec(2, py(v) + ' به ترتیب پیمایش اضافه شد.');
      const nb = adj[v];
      if (!nb.length) rec(3, 'graph[' + py(v) + '] خالی است؛ حلقه اجرا نمی‌شود.');
      for (const w of nb) {
        top().w = w; st.exam = [v, w]; sync();
        rec(3, 'w = ' + py(w) + ' (همسایه‌ی بعدیِ ' + v + ')');
        const seen = st.visited.includes(w);
        rec(4, py(w) + ' not in visited ؟ ' + (seen ? 'نادرست — قبلاً دیده شده؛ رد می‌شویم.' : 'درست — هنوز دیده نشده.'));
        if (!seen) {
          rec(5, 'فراخوانی بازگشتی dfs(' + py(w) + '): تا پایان آن، همین حلقه متوقف می‌ماند.');
          call(w, v);
          st.cur = v; st.exam = null; sync();
        }
      }
      st.exam = null;
      const outermost = st.frames.length === 1;
      st.frames.pop(); st.done.push(v);
      st.cur = st.frames.length ? top().v : null; sync();
      if (outermost) res.out = [...st.order];
      rec(-1, 'dfs(' + py(v) + ') تمام شد' + (st.frames.length ? '؛ بازگشت به dfs(' + py(top().v) + ') و ادامه‌ی حلقه‌ی آن.' : '؛ پیمایش پایان یافت. ترتیب: ' + st.order.join(' ← ') + unreached(st.order)));
    };
    call(start, null);
  }
  return steps;
}

/* مقدار متغیرها (Watch) پس از اجرای یک گام */
function watchOf(step, algo) {
  const s = step.snap || {}, l = step.loc || {}, out = [];
  const add = (n, v) => { if (v !== undefined) out.push([n, v]); };
  add('visited', s.visited && pySet(s.visited));
  if (algo === 'bfs') add('queue', s.queue && pyList(s.queue));
  if (algo === 'dfss') add('stack', s.stack && pyList(s.stack));
  add('order', s.order && pyList(s.order));
  if (algo === 'dfsr' && s.frames && s.frames.length) add('calls', s.frames.map((f) => 'dfs(' + py(f.v) + ')').join(' → '));
  if (algo !== 'dfsr') add('start', l.start && py(l.start));
  add('v', l.v && py(l.v));
  add('w', l.w && py(l.w));
  return out;
}

/* ===================== استایل ===================== */
const CSS = `
:root{--g-disc:#fde68a;--g-discb:#d97706;--g-done:#bbf7d0}
@media (prefers-color-scheme:dark){:root{--g-disc:#7c5a10;--g-done:#14532d}}
.gstage{display:flex;flex-direction:column;gap:6px;height:100%}
.gsvg{flex:0 0 min(62vw,340px);min-height:0}
.gsvg svg{width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none}
@media (orientation:landscape) and (min-width:640px){.gsvg{flex:1 1 0;min-height:150px}}
.gedge{fill:none;stroke:var(--edge);stroke-width:2.2}
.gedge.tree{stroke:var(--ok);stroke-width:3.8}
.gedge.exam{stroke:var(--warn);stroke-width:3.8;stroke-dasharray:8 5}
.gnode{cursor:grab;touch-action:none}
.gnode:active{cursor:grabbing}
.gnode circle.c{fill:var(--node);stroke:var(--edge);stroke-width:2.4}
.gnode text.lbl{font-size:18px;font-weight:700;fill:var(--tx);text-anchor:middle;pointer-events:none;font-family:var(--mono)}
.gnode.disc circle.c{fill:var(--g-disc);stroke:var(--g-discb)}
.gnode.done circle.c{fill:var(--g-done);stroke:var(--ok)}
.gnode.cur circle.c{fill:var(--acc);stroke:var(--acc);stroke-width:3}
.gnode.cur text.lbl{fill:#fff}
.gnode.sel circle.c{stroke:var(--acc2);stroke-width:5;stroke-dasharray:6 4}
.grub{stroke:var(--acc);stroke-width:4;stroke-dasharray:3 6;stroke-linecap:round;pointer-events:none}
.gnode.tgt circle.c{stroke:var(--ok);stroke-width:6}
.gnode.chg circle.c{animation:gpulse .9s ease-out}
@keyframes gpulse{0%{stroke-width:9}100%{}}
.gnode .badge circle{fill:var(--acc2)}
.gnode .badge text{fill:#fff;font-size:11px;font-weight:700;text-anchor:middle;pointer-events:none}
.gstate{display:flex;flex-direction:column;gap:2px;padding:2px 4px}
.grow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.glab{flex:0 0 170px;font-size:12px;color:var(--mut)}
.gchips{display:flex;flex-wrap:wrap;gap:4px;direction:ltr;min-height:26px;align-items:center}
.gchip{font-family:var(--mono);font-size:13px;font-weight:700;min-width:26px;padding:0 7px;text-align:center;border:1.5px solid var(--edge);border-radius:8px;background:var(--node)}
.gchip.new{animation:gnew 1s ease-out}
@keyframes gnew{0%{background:var(--flash)}}
.gundef{font-size:12px;color:var(--mut)}
.grow.fin .gchip{border-color:var(--ok);background:var(--g-done)}
.glegend{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}
.glegend i{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--edge);vertical-align:-2px;margin-left:4px;background:var(--node)}
.glegend i.d{background:var(--g-disc);border-color:var(--g-discb)}
.glegend i.c{background:var(--acc);border-color:var(--acc)}
.glegend i.o{background:var(--g-done);border-color:var(--ok)}
.glegend b{display:inline-block;width:18px;height:0;border-top:4px solid var(--ok);vertical-align:3px;margin-left:4px}
.glegend b.x{border-top:4px dashed var(--warn)}
`;

/* ===================== قالب HTML ===================== */
const STAGE = `
<div class="gstage">
  <div class="gsvg"><svg id="gsvg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="گراف"></svg></div>
  <div class="gstate" id="gstate"></div>
  <div class="legend glegend">
    <span><i></i>دیده‌نشده</span><span><i class="d"></i>در صف / پشته (کشف‌شده)</span><span><i class="c"></i>راس جاری</span>
    <span><i class="o"></i>پردازش‌شده / تمام‌شده</span><span><b></b>یال درخت پیمایش</span><span><b class="x"></b>یالِ در حال بررسی</span>
    <span>راس‌ها را با ماوس یا انگشت بکشید تا جابه‌جا شوند.</span>
  </div>
</div>`;

const HTML = `
  <section class="tools">
    <div class="card mini">
      <div class="row"><span class="lbl">الگوریتم</span>
        <div class="seg" id="segAlgo">
          <button data-v="bfs" class="on">BFS — پیمایش سطحی</button>
          <button data-v="dfsr">DFS — بازگشتی</button>
          <button data-v="dfss">DFS — با پشته</button>
        </div>
      </div>
      <div class="row"><span class="lbl">راس شروع</span>
        <select id="startSel" aria-label="راس شروع"></select>
        <span class="lbl">نوع گراف</span>
        <div class="seg" id="segDir">
          <button data-v="u" class="on">بدون جهت</button>
          <button data-v="d">جهت‌دار</button>
        </div>
      </div>
    </div>
    <div class="card mini">
      <div class="row"><span class="lbl">گراف</span>
        <select id="preset" aria-label="گراف نمونه"></select>
        <button class="btn" id="btnLayout" title="بازگرداندن راس‌ها به جای اولیه">چیدمان اولیه</button>
      </div>
      <div class="row">
        <button class="btn" id="btnEdit" title="کشیدن از یک راس به راس دیگر (یا زدن روی دو راس) یال را اضافه/حذف می‌کند">✎ ویرایش یال‌ها</button>
        <button class="btn" id="btnAddV">＋ راس جدید</button>
        <button class="btn" id="btnDelV" disabled>حذف راس انتخابی</button>
      </div>
    </div>
  </section>
` + Stepper.layout(STAGE, { codeNote: 'متغیرهای visited، queue/stack و order داخل تابع محلی‌اند. خط هایلایت‌شده «همین الان اجرا شد» و تصویر، نتیجه‌ی آن است.' });

/* ===================== رابط کاربری ===================== */
function mount(view) {
  const $ = (s) => view.querySelector(s);
  const toast = (m) => window.appToast(m);
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const S = { algo: 'bfs', directed: false, start: 'A', graph: { nodes: [], edges: [] }, preset: 0, edit: false, sel: null, adj: {} };
  const svg = $('#gsvg');
  let nodeEls = {}, edgeEls = [], ctl = null;
  const N = (id) => S.graph.nodes.find((n) => n.id === id);

  /* ----- رسم گراف ----- */
  function buildSVG() {
    svg.innerHTML = '';
    const defs = mk('defs', {}, svg);
    [['ahE', 'var(--edge)'], ['ahT', 'var(--ok)'], ['ahX', 'var(--warn)']].forEach(([id, c]) => {
      const m = mk('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6.5', markerHeight: '6.5', orient: 'auto' }, defs);
      mk('path', { d: 'M0 0L10 5L0 10z', style: 'fill:' + c }, m);
    });
    const eLayer = mk('g', {}, svg), nLayer = mk('g', {}, svg);
    edgeEls = S.graph.edges.map(() => mk('path', { class: 'gedge' }, eLayer));
    nodeEls = {};
    S.graph.nodes.forEach((n) => {
      const g = mk('g', { class: 'gnode', 'data-id': n.id }, nLayer);
      mk('circle', { class: 'c', r: R }, g);
      const t = mk('text', { class: 'lbl', y: 6 }, g); t.textContent = n.id;
      const b = mk('g', { class: 'badge', transform: 'translate(17,-17)' }, g);
      mk('circle', { r: 9 }, b);
      const bt = mk('text', { y: 4 }, b);
      nodeEls[n.id] = { g, b, bt };
    });
  }

  const unit = (dx, dy) => { const L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; };
  function edgePath(a, b, curved) {
    const gap = S.directed ? R + 5 : R;
    if (!curved) {
      const u = unit(b.x - a.x, b.y - a.y);
      return 'M' + (a.x + u.x * R) + ',' + (a.y + u.y * R) + ' L' + (b.x - u.x * gap) + ',' + (b.y - u.y * gap);
    }
    const u = unit(b.x - a.x, b.y - a.y);
    const mx = (a.x + b.x) / 2 - u.y * 28, my = (a.y + b.y) / 2 + u.x * 28;
    const d1 = unit(mx - a.x, my - a.y), d2 = unit(mx - b.x, my - b.y);
    return 'M' + (a.x + d1.x * R) + ',' + (a.y + d1.y * R) + ' Q' + mx + ',' + my + ' ' + (b.x + d2.x * gap) + ',' + (b.y + d2.y * gap);
  }
  function layout() {
    S.graph.nodes.forEach((n) => { const e = nodeEls[n.id]; if (e) e.g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')'); });
    S.graph.edges.forEach(([a, b], i) => {
      const A = N(a), B = N(b); if (!A || !B || !edgeEls[i]) return;
      const curved = S.directed && S.graph.edges.some(([c, d]) => c === b && d === a);
      edgeEls[i].setAttribute('d', edgePath(A, B, curved));
    });
  }

  const sameEdge = (p, a, b) => p && ((p[0] === a && p[1] === b) || (!S.directed && p[0] === b && p[1] === a));
  function stateOf(snap, id) {
    const visited = snap.visited || [];
    if (snap.cur === id) return 'cur';
    if ((snap.done || []).includes(id)) return 'done';
    let disc;
    if (S.algo === 'bfs') disc = snap.queue || [];
    else if (S.algo === 'dfss') disc = (snap.stack || []).filter((x) => !visited.includes(x));
    else disc = (snap.frames || []).map((f) => f.v);
    return disc.includes(id) ? 'disc' : '';
  }
  function paint(step, prev) {
    const s = step.snap || {}, p = prev.snap || {};
    S.graph.nodes.forEach((n) => {
      const e = nodeEls[n.id]; if (!e) return;
      const a = stateOf(s, n.id), b = stateOf(p, n.id);
      e.g.setAttribute('class', 'gnode' + (a ? ' ' + a : '') + (S.sel === n.id ? ' sel' : '') + (!step.idle && a !== b ? ' chg' : ''));
      const idx = (s.order || []).indexOf(n.id);
      e.b.style.display = idx >= 0 ? '' : 'none';
      e.bt.textContent = idx >= 0 ? String(idx + 1) : '';
    });
    S.graph.edges.forEach(([a, b], i) => {
      const exam = sameEdge(s.exam, a, b), tree = (s.tree || []).some((t) => sameEdge(t, a, b));
      edgeEls[i].setAttribute('class', 'gedge' + (exam ? ' exam' : (tree ? ' tree' : '')));
      if (S.directed) edgeEls[i].setAttribute('marker-end', 'url(#' + (exam ? 'ahX' : (tree ? 'ahT' : 'ahE')) + ')');
      else edgeEls[i].removeAttribute('marker-end');
    });
  }

  /* ----- نوار وضعیت ساختارها (صف/پشته، visited، خروجی) ----- */
  function renderState(step, prev) {
    const s = step.snap || {}, p = prev.snap || {};
    const frames = (x) => (x.frames || []).map((f) => 'dfs(' + f.v + ')');
    const rows = [];
    if (S.algo === 'bfs') rows.push({ label: 'صف (queue): front ← rear', a: s.queue, b: p.queue });
    else if (S.algo === 'dfss') rows.push({ label: 'پشته (stack): bottom → top', a: s.stack, b: p.stack });
    else rows.push({ label: 'پشته‌ی فراخوانی: bottom → top', a: s.frames && s.frames.length ? frames(s) : (step.idle ? undefined : []), b: frames(p) });
    rows.push({ label: 'visited (دیده‌شده‌ها)', a: s.visited, b: p.visited });
    rows.push({ label: 'order (ترتیب پیمایش)', a: s.order, b: p.order, fin: !!step.out });
    $('#gstate').innerHTML = rows.map((r) => {
      let chips;
      if (r.a === undefined) chips = '<span class="gundef">هنوز تعریف نشده</span>';
      else if (!r.a.length) chips = '<span class="gundef">∅ خالی</span>';
      else chips = r.a.map((x, i) => '<span class="gchip' + (!step.idle && (!r.b || r.b[i] !== x) ? ' new' : '') + '">' + esc(x) + '</span>').join('');
      return '<div class="grow' + (r.fin ? ' fin' : '') + '"><span class="glab">' + r.label + '</span><span class="gchips">' + chips + '</span></div>';
    }).join('');
  }

  /* ----- دادهٔ مورد نیاز Stepper ----- */
  function declText() {
    const ids = Object.keys(S.adj);
    if (!ids.length || S.start == null) return '# گراف خالی است';
    let t = 'graph = {\n' + ids.map((id) => '    ' + py(id) + ': ' + pyList(S.adj[id]) + ',').join('\n') + '\n}\n';
    if (S.algo === 'dfsr') t += 'visited = set()\norder = []\n\ndfs(' + py(S.start) + ')';
    else t += 'start = ' + py(S.start) + '\norder = ' + (S.algo === 'bfs' ? 'bfs' : 'dfs') + '(graph, start)';
    return t;
  }

  ctl = Stepper.create(view, {
    getCode: () => ({ tabs: [{ id: S.algo, label: CODE[S.algo].tab }], tab: S.algo, lines: CODE[S.algo].lines, decl: declText() }),
    idle: () => ({ line: -1, note: '', snap: idleSnap(S.algo), loc: {}, out: null, idle: true }),
    watch: (step) => watchOf(step, S.algo),
    render: (step, prev) => { paint(step, prev); renderState(step, prev); },
    hint: 'الگوریتم و راس شروع را انتخاب کنید، سپس «بعدی» یا «پخش» را بزنید. راس‌ها را می‌توانید جابه‌جا کنید.'
  });

  /* ----- محاسبه‌ی دوباره‌ی گام‌ها ----- */
  function fillStart() {
    const sel = $('#startSel');
    sel.innerHTML = S.graph.nodes.map((n) => '<option>' + n.id + '</option>').join('');
    if (S.start != null) sel.value = S.start;
  }
  function recompute(rebuild) {
    if (!S.graph.nodes.some((n) => n.id === S.start)) S.start = S.graph.nodes.length ? S.graph.nodes[0].id : null;
    fillStart();
    if (rebuild) buildSVG();
    layout();
    S.adj = adjacency(S.graph, S.directed);
    const steps = S.start != null ? run(S.algo, S.adj, S.start) : [];
    ctl.setSteps(steps, S.algo, CODE[S.algo].lines);
    $('#btnDelV').disabled = !(S.edit && S.sel != null);
  }

  function loadPreset(i) {
    const p = PRESETS[i];
    S.preset = i; S.sel = null;
    S.graph = { nodes: Object.keys(p.nodes).map((id) => ({ id, x: p.nodes[id][0], y: p.nodes[id][1] })), edges: clone(p.edges) };
    S.start = 'A';
    recompute(true);
  }

  /* ----- ویرایش گراف ----- */
  function toggleEdge(a, b) {
    const same = (e) => (e[0] === a && e[1] === b) || (!S.directed && e[0] === b && e[1] === a);
    const before = S.graph.edges.length;
    S.graph.edges = S.graph.edges.filter((e) => !same(e));
    if (S.graph.edges.length === before) { S.graph.edges.push([a, b]); toast('یال ' + a + (S.directed ? ' → ' : ' – ') + b + ' اضافه شد.'); }
    else toast('یال ' + a + (S.directed ? ' → ' : ' – ') + b + ' حذف شد.');
  }
  function onNodeClick(id) {
    if (!S.edit) return;
    if (S.sel == null) { S.sel = id; recompute(false); return; }
    if (S.sel === id) { S.sel = null; recompute(false); return; }
    const a = S.sel; S.sel = null;
    toggleEdge(a, id);
    recompute(true);
  }
  function addVertex() {
    if (S.graph.nodes.length >= MAX_NODES) { toast('حداکثر ' + MAX_NODES + ' راس پشتیبانی می‌شود.'); return; }
    const id = [...LETTERS].find((c) => !S.graph.nodes.some((n) => n.id === c));
    let best = [VW / 2, VH / 2], bd = -1;
    for (let x = 60; x <= VW - 60; x += 40) {
      for (let y = 50; y <= VH - 50; y += 40) {
        const d = Math.min(999, ...S.graph.nodes.map((n) => Math.hypot(n.x - x, n.y - y)));
        if (d > bd) { bd = d; best = [x, y]; }
      }
    }
    S.graph.nodes.push({ id, x: best[0], y: best[1] });
    recompute(true);
    toast('راس ' + id + ' اضافه شد. با «ویرایش یال‌ها» آن را به راس‌های دیگر وصل کنید.');
  }
  function delVertex() {
    if (S.sel == null) return;
    const id = S.sel;
    S.graph.nodes = S.graph.nodes.filter((n) => n.id !== id);
    S.graph.edges = S.graph.edges.filter((e) => e[0] !== id && e[1] !== id);
    S.sel = null;
    recompute(true);
  }

  /* ----- جابه‌جایی راس‌ها با ماوس / لمس ----- */
  let drag = null;
  const toSvg = (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  /* حالت عادی: کشیدن راس = جابه‌جایی.
     حالت ویرایش: کشیدن از یک راس تا راس دیگر = اضافه/حذف یال (خط کشسان)؛ ضربه روی دو راس هم کار می‌کند. */
  let rub = null;
  const nodeAt = (p, skip) => {
    let best = null, bd = R + 16;                 /* تلورانس برای انگشت */
    S.graph.nodes.forEach((n) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (n.id !== skip && d < bd) { bd = d; best = n; } });
    return best;
  };
  const clearRub = () => {
    if (rub && rub.line) rub.line.remove();
    rub = null;
    view.querySelectorAll('.gnode.tgt').forEach((g) => g.classList.remove('tgt'));
  };
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest ? e.target.closest('.gnode') : null;
    if (!g || drag) return;
    const n = N(g.dataset.id), p = toSvg(e);
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
    drag = { id: n.id, pid: e.pointerId, dx: n.x - p.x, dy: n.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const p = toSvg(e), n = N(drag.id);
    if (S.edit) {
      if (!rub) { rub = { line: mk('line', { class: 'grub' }, svg) }; }
      rub.line.setAttribute('x1', n.x); rub.line.setAttribute('y1', n.y);
      rub.line.setAttribute('x2', p.x); rub.line.setAttribute('y2', p.y);
      const t = nodeAt(p, n.id);
      Object.keys(nodeEls).forEach((id) => nodeEls[id].g.classList.toggle('tgt', !!t && t.id === id));
      return;
    }
    n.x = Math.max(R + 2, Math.min(VW - R - 2, p.x + drag.dx));
    n.y = Math.max(R + 2, Math.min(VH - R - 2, p.y + drag.dy));
    layout();
  });
  const endDrag = (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    const d = drag; drag = null;
    if (!d.moved) { onNodeClick(d.id); return; }
    if (S.edit) {
      const t = nodeAt(toSvg(e), d.id);
      clearRub();
      if (t) { toggleEdge(d.id, t.id); S.sel = null; recompute(true); }
    }
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', (e) => { if (drag && drag.pid === e.pointerId) drag = null; clearRub(); });

  /* ----- رویدادهای ابزارها ----- */
  $('#preset').innerHTML = PRESETS.map((p, i) => '<option value="' + i + '">' + p.name + '</option>').join('');
  $('#preset').addEventListener('change', (e) => loadPreset(+e.target.value));
  $('#segAlgo').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.algo = b.dataset.v;
    view.querySelectorAll('#segAlgo button').forEach((x) => x.classList.toggle('on', x === b));
    recompute(false);
  });
  $('#segDir').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.directed = b.dataset.v === 'd';
    view.querySelectorAll('#segDir button').forEach((x) => x.classList.toggle('on', x === b));
    recompute(false);
  });
  $('#startSel').addEventListener('change', (e) => { S.start = e.target.value; recompute(false); });
  $('#btnEdit').addEventListener('click', () => {
    S.edit = !S.edit; S.sel = null;
    $('#btnEdit').classList.toggle('pri', S.edit);
    if (S.edit) toast('حالت ویرایش: انگشت را از یک راس تا راس دیگر بکشید (یا روی دو راس پشت‌سرهم بزنید) تا یال اضافه یا حذف شود. برای جابه‌جایی راس‌ها، ویرایش را خاموش کنید.');
    recompute(false);
  });
  $('#btnAddV').addEventListener('click', addVertex);
  $('#btnDelV').addEventListener('click', delVertex);
  $('#btnLayout').addEventListener('click', () => {
    const p = PRESETS[S.preset];
    S.graph.nodes.forEach((n) => { if (p.nodes[n.id]) { n.x = p.nodes[n.id][0]; n.y = p.nodes[n.id][1]; } });
    layout();
  });

  loadPreset(0);
  return { destroy() { ctl.destroy(); } };
}

window.Shell.register({
  id: 'graph-traversal',
  title: 'شبیه‌ساز پیمایش عمقی و سطحی گراف',
  subtitle: 'DFS و BFS — اجرای گام‌به‌گام شبه‌کد پایتون روی گراف',
  css: CSS,
  html: HTML,
  mount: mount,
  engine: { adjacency, run, watchOf, CODE, PRESETS }
});
})();
