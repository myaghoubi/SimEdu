/* کتابخانه‌ی مشترک شبیه‌سازهای ماشین (ماشین پشته‌ای و ماشین تورینگ)
   - ویرایشگر نمودار حالت (SVG): افزودن/جابه‌جایی/حذف حالت، رسم گذار با کشیدن انگشت یا ماوس
   - جست‌وجوی BFS روی پیکربندی‌ها (پشتیبانی از غیرقطعی بودن) و اجرای گام‌به‌گام مسیر پیدا‌شده
   هر شبیه‌ساز یک تنظیم K می‌دهد: { kind, fields, fmt, norm, validate, presets, engine, ... } */
(function () {
'use strict';

const R = 26, VW = 640, VH = 360, MAXS = 12;
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ===================== موتور عمومی ===================== */
function buildP(M) {
  const P = { start: null, accept: {}, out: {}, ids: {} };
  M.states.forEach((s) => { P.ids[s.id] = 1; P.out[s.id] = []; if (s.start) P.start = s.id; if (s.accept) P.accept[s.id] = true; });
  M.trans.forEach((t) => { if (P.out[t.from]) P.out[t.from].push(t); });
  return P;
}

function search(P, input, E, opt) {
  const init = E.init(P, input, opt);
  const nodes = [{ cfg: init, parent: -1, tr: null, depth: 0 }];
  const seen = new Set([E.key(init)]);
  let head = 0, best = 0, acc = -1, limit = false;
  while (head < nodes.length) {
    const n = nodes[head];
    if (E.accepting(P, n.cfg, input, opt)) { acc = head; break; }
    if (E.rank(n.cfg, n.depth) > E.rank(nodes[best].cfg, nodes[best].depth)) best = head;
    if (n.depth >= E.maxDepth) limit = true;
    else {
      for (const x of E.next(P, n.cfg, input, opt)) {
        const k = E.key(x.cfg);
        if (seen.has(k)) continue;
        if (nodes.length >= E.maxNodes) { limit = true; break; }
        seen.add(k);
        nodes.push({ cfg: x.cfg, parent: head, tr: x.tr, depth: n.depth + 1 });
      }
    }
    head++;
  }
  const end = acc >= 0 ? acc : best;
  const path = [];
  for (let i = end; i >= 0; i = nodes[i].parent) path.push({ cfg: nodes[i].cfg, tr: nodes[i].tr });
  path.reverse();
  return { accepted: acc >= 0, limit: acc < 0 && limit, path, explored: nodes.length };
}

/* سلول‌های نوار (ورودی یا نوار تورینگ) */
function cells(arr, hi, done) {
  return arr.map((c, i) => '<span class="acell' + (i === hi ? ' hd' : '') + (done != null && i < done ? ' dn' : '') + '">' + (c === '_' ? '□' : esc(c)) + '</span>').join('');
}

  /* اسکرول نرم: فقط وقتی سطر جاری از ناحیه‌ی قابل‌مشاهده خارج شده باشد، نرم جابه‌جا می‌شود تا دیده شود */
function revealRow(box, c) { window.Follow.revealRow(box, c); }

/* ===================== استایل و قالب ===================== */
const CSS = `
.am{display:flex;flex-direction:column;gap:6px;margin:6px 10px 0;flex:1 1 auto;min-height:0}
.am-gfx{padding:4px;position:relative}
.am-svg{width:100%;aspect-ratio:640/360;max-height:62vh}
.am-svg svg{width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none}
.am-side{display:flex;flex-direction:column;gap:6px;min-height:0;flex:1 1 auto}
.am-panel{padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.am-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px}
.am-line .lbl{min-width:70px}
.atape,.astack{display:flex;direction:ltr;gap:3px;overflow:auto;padding:2px;align-items:center}
.acell{font-family:var(--mono);font-weight:700;min-width:28px;height:30px;line-height:28px;text-align:center;border:1.5px solid var(--edge);border-radius:6px;background:var(--node);padding:0 4px}
.acell.hd{border-color:var(--acc);background:var(--live);box-shadow:0 0 0 2px var(--acc)}
.acell.dn{opacity:.4}
.acell.top{border-color:var(--acc2);background:rgba(124,58,237,.14)}
.acell.empty{border-style:dashed;color:var(--mut);font-weight:400}
.am-status{font-weight:700}
.am-status.ok{color:var(--ok)}.am-status.bad{color:var(--err)}.am-status.unk{color:var(--warn)}
.am-trace{padding:0;overflow:hidden;display:flex;flex-direction:column;min-height:90px;flex:1 1 auto}
.am-trace .trlist{max-height:200px}
.am-trace .tr{grid-template-columns:26px 1fr}
.am-trace .tr code{white-space:normal;word-break:break-all}
.am-trace .tr small{direction:ltr;unicode-bidi:isolate;text-align:left;display:block;color:var(--mut);font-family:var(--mono)}
.am-trace .tr.cur small{color:var(--tx)}
@media (orientation:landscape) and (min-width:640px){
  .am{flex-direction:row;direction:ltr}
  .am-gfx{flex:1 1 0;min-width:0;display:flex;direction:rtl}
  .am-svg{aspect-ratio:auto;flex:1;max-height:none;min-height:0}
  .am-side{flex:0 0 calc(var(--sw,36%) - 6px);min-width:0;direction:rtl;overflow:auto}
  .am-trace .trlist{max-height:none;flex:1;min-height:0}
}
.ast circle.c{fill:var(--node);stroke:var(--edge);stroke-width:2.4}
.ast text{font-family:var(--mono);font-size:15px;font-weight:700;fill:var(--tx);text-anchor:middle;pointer-events:none}
.ast circle.in{fill:none;stroke:var(--edge);stroke-width:2}
.ast{cursor:grab}
.ast.sel circle.c{stroke:var(--acc2);stroke-width:5;stroke-dasharray:6 4}
.ast.cur circle.c{fill:var(--live);stroke:var(--acc);stroke-width:4}
.ast.cur.okk circle.c{fill:#bbf7d0;stroke:var(--ok)}
.ast.cur.bad circle.c{fill:#fecaca;stroke:var(--err)}
.ast.tgt circle.c{stroke:var(--ok);stroke-width:6}
.aed{fill:none;stroke:var(--edge);stroke-width:2.2}
.aed.use{stroke:var(--warn);stroke-width:4}
.ahit{fill:none;stroke:transparent;stroke-width:22;cursor:pointer}
.alb{direction:ltr;unicode-bidi:isolate;font-family:var(--mono);font-size:15px;font-weight:700;fill:var(--tx);text-anchor:middle;paint-order:stroke;stroke:var(--card);stroke-width:5px;stroke-linejoin:round;cursor:pointer}
.alb .use{fill:var(--warn);font-weight:700}
.astart{stroke:var(--edge);stroke-width:2.2;fill:none}
.arub{stroke:var(--acc);stroke-width:4;stroke-dasharray:3 6;stroke-linecap:round;pointer-events:none}
.am-dlg{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:30;display:flex;align-items:center;justify-content:center;padding:12px}
.am-box{width:min(420px,100%);max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:8px}
.am-box h3{margin:0;font-size:14px}
.am-rows{display:flex;flex-direction:column;gap:6px}
.am-r{display:flex;align-items:center;gap:6px;direction:ltr;flex-wrap:wrap}
.am-r input[type=text]{width:58px}
.am-r span.sep{color:var(--mut)}
.am-r select{padding:1px 4px}
.am-err{color:var(--err);font-size:12px;min-height:18px}
.am-acts{display:flex;gap:6px;flex-wrap:wrap}
.am-chips{display:flex;gap:4px;flex-wrap:wrap}
.am-chips button{font-family:var(--mono);font-size:12px;padding:0 8px}
.am-hint{font-size:11.5px;color:var(--mut)}
`;

function html(K) {
  return `
  <section class="tools">
    <div class="card mini">
      <div class="row"><span class="lbl">ابزار</span>
        <div class="seg" id="amModes">
          <button data-m="move" class="on">✥ جابه‌جایی</button>
          <button data-m="state">＋ حالت</button>
          <button data-m="edge">➜ گذار</button>
          <button data-m="del">🗑 حذف</button>
        </div>
      </div>
      <div class="row">
        <button class="btn" id="amStart" disabled>حالت شروع</button>
        <button class="btn" id="amAcc" disabled>حالت پایانی</button>
        <span class="am-hint" id="amHint"></span>
      </div>
    </div>
    <div class="card mini">
      <div class="row"><span class="lbl">${K.inputLabel || 'رشته‌ی ورودی'}</span>
        <input type="text" id="amInput" style="width:150px" autocomplete="off" autocapitalize="off" spellcheck="false">
        ${K.optionsHTML || ''}
      </div>
      <div class="row"><span class="lbl">نمونه</span><span class="am-chips" id="amChips"></span></div>
      <div class="row"><span class="lbl">ماشین</span>
        <select id="amPreset" aria-label="ماشین نمونه"></select>
        <button class="btn" id="amClear">پاک‌کردن</button>
      </div>
    </div>
  </section>
  <main class="am">
    <section class="card am-gfx"><div class="am-svg"><svg id="amSvg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="نمودار حالت"></svg></div></section>
    <div class="handle" id="amHandle" role="separator" aria-orientation="vertical" tabindex="0"
         aria-label="تغییر عرض ناحیه‌ی نمودار و ناحیه‌ی کناری (دوبار کلیک: بازگشت به ۳۶٪)" aria-valuemin="20" aria-valuemax="60" aria-valuenow="36"></div>
    <div class="am-side">
      <section class="card am-panel" id="amPanel"></section>
      <section class="card am-trace"><div class="trlist" id="amTrace"></div></section>
    </div>
  </main>
  <footer class="bar" id="bar">
    <div class="note" id="note"></div>
    <div class="ctl">
      <div class="btns">
        <button class="btn" id="bFirst" title="ابتدای اجرا">⏮ ابتدا</button>
        <button class="btn" id="bPrev" title="گام قبل">◀ قبلی</button>
        <button class="btn pri" id="bPlay" title="پخش خودکار">▶ پخش</button>
        <button class="btn" id="bNext" title="گام بعد">بعدی ▶</button>
        <button class="btn" id="bLast" title="پایان اجرا">پایان ⏭</button>
      </div>
      <span id="counter"></span>
      <label class="spd">سرعت <input type="range" id="speed" min="200" max="1800" step="50" value="800"></label>
    </div>
  </footer>
  <div class="am-dlg" id="amDlg" hidden></div>`;
}

/* ===================== رابط کاربری ===================== */
function mount(view, K) {
  const $ = (s) => view.querySelector(s);
  const toast = (m) => window.appToast && window.appToast(m);
  const KEY = 'ds_am_' + K.kind;
  const E = K.engine;
  const svg = $('#amSvg');
  const S = { M: { states: [], trans: [] }, mode: 'move', sel: null, pend: null, preset: 0, input: '', run: null, i: -1, timer: null, speed: 800, opt: K.defaultOpt ? K.defaultOpt() : {} };

  /* ----- ذخیره / بازیابی ----- */
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ M: S.M, input: S.input, opt: S.opt })); } catch (e) { /* ignore */ } };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.M && Array.isArray(d.M.states) && Array.isArray(d.M.trans)) { S.M = d.M; S.input = d.input || ''; Object.assign(S.opt, d.opt || {}); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  const stateOf = (id) => S.M.states.find((s) => s.id === id);
  const fmt = (t) => K.fmt(t);

  /* ----- رسم نمودار ----- */
  const mk = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const unit = (dx, dy) => { const L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; };

  function groups() {
    const g = {};
    S.M.trans.forEach((t) => { const k = t.from + '>' + t.to; (g[k] = g[k] || { from: t.from, to: t.to, list: [] }).list.push(t); });
    return g;
  }

  function render() {
    svg.innerHTML = '';
    const defs = mk('defs', {}, svg);
    [['amE', 'var(--edge)'], ['amU', 'var(--warn)']].forEach(([id, c]) => {
      const m = mk('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
      mk('path', { d: 'M0 0L10 5L0 10z', style: 'fill:' + c }, m);
    });
    const gE = mk('g', {}, svg), gS = mk('g', {}, svg);
    const G = groups();
    const used = S.run && S.i > 0 ? S.run.path[S.i].tr : null;
    Object.keys(G).forEach((k) => {
      const g = G[k], A = stateOf(g.from), B = stateOf(g.to);
      if (!A || !B) return;
      let d, lx, ly;
      const isUse = !!used && g.list.includes(used);
      if (A === B) {
        let sy = 0;                                            /* حلقه را به سمتی می‌بریم که یال‌های دیگر نیستند */
        S.M.trans.forEach((t) => { const o = t.from === A.id ? t.to : (t.to === A.id ? t.from : null); const O = o && o !== A.id ? stateOf(o) : null; if (O) sy += O.y - A.y; });
        let dir = sy < 0 ? 1 : -1;
        if (A.y < 70) dir = 1; else if (A.y > VH - 70) dir = -1;
        const y0 = A.y + dir * R * 0.9, ytop = A.y + dir * (R + 52);
        d = 'M' + (A.x - 13) + ',' + y0 + ' C' + (A.x - 46) + ',' + ytop + ' ' + (A.x + 46) + ',' + ytop + ' ' + (A.x + 13) + ',' + y0;
        lx = A.x; ly = A.y + dir * (R + 44) + (dir > 0 ? 8 : 0);
        g.lines = g.list.length; g.dir = dir;
      } else {
        const rev = !!G[g.to + '>' + g.from];
        const u = unit(B.x - A.x, B.y - A.y), nx = -u.y, ny = u.x;
        if (rev) {
          const cx = (A.x + B.x) / 2 + nx * 34, cy = (A.y + B.y) / 2 + ny * 34;
          const d1 = unit(cx - A.x, cy - A.y), d2 = unit(cx - B.x, cy - B.y);
          d = 'M' + (A.x + d1.x * R) + ',' + (A.y + d1.y * R) + ' Q' + cx + ',' + cy + ' ' + (B.x + d2.x * (R + 5)) + ',' + (B.y + d2.y * (R + 5));
          lx = (A.x + B.x) / 2 + nx * 24; ly = (A.y + B.y) / 2 + ny * 24;
        } else {
          d = 'M' + (A.x + u.x * R) + ',' + (A.y + u.y * R) + ' L' + (B.x - u.x * (R + 5)) + ',' + (B.y - u.y * (R + 5));
          lx = (A.x + B.x) / 2 + nx * 12; ly = (A.y + B.y) / 2 + ny * 12;
        }
      }
      mk('path', { d, class: 'ahit', 'data-ed': k }, gE);
      mk('path', { d, class: 'aed' + (isUse ? ' use' : ''), 'marker-end': 'url(#' + (isUse ? 'amU' : 'amE') + ')', style: 'pointer-events:none' }, gE);
      const t = mk('text', { class: 'alb', x: lx, y: ly - (g.list.length - 1) * 9 + 5, 'data-ed': k }, gE);
      g.list.forEach((tr, i) => {
        const ts = mk('tspan', { x: lx, dy: i ? 18 : 0, class: tr === used ? 'use' : '' }, t);
        ts.textContent = fmt(tr);
      });
    });
    S.M.states.forEach((s) => {
      const cur = S.run && S.i >= 0 ? E.state(S.run.path[S.i].cfg) === s.id : false;
      const fin = cur && S.run && S.i === S.run.path.length - 1;
      const g = mk('g', { class: 'ast' + (S.sel === s.id || S.pend === s.id ? ' sel' : '') + (cur ? ' cur' : '') + (fin ? (S.run.accepted ? ' okk' : (S.run.limit ? '' : ' bad')) : ''), 'data-st': s.id, transform: 'translate(' + s.x + ',' + s.y + ')' }, gS);
      mk('circle', { class: 'c', r: R }, g);
      if (s.accept) mk('circle', { class: 'in', r: R - 5 }, g);
      mk('text', { y: 5 }, g).textContent = s.id;
      if (s.start) mk('path', { class: 'astart', d: 'M' + (-R - 38) + ',0 L' + (-R - 4) + ',0', 'marker-end': 'url(#amE)' }, g);
    });
  }

  /* ----- تغییر مدل ----- */
  function changed(keepRun) {
    if (!keepRun) { stop(); S.run = null; S.i = -1; }
    save(); render(); renderRun(); markCustom();
  }
  function markCustom() {
    const sel = $('#amPreset');
    if (S.custom) sel.value = 'x';
  }
  function newId() {
    for (let n = 0; n < 40; n++) if (!stateOf('q' + n)) return 'q' + n;
    return 'q99';
  }
  function addState(x, y) {
    if (S.M.states.length >= MAXS) { toast('حداکثر ' + MAXS + ' حالت پشتیبانی می‌شود.'); return; }
    const id = newId();
    S.M.states.push({ id, x: Math.round(x), y: Math.round(y), start: !S.M.states.length, accept: false });
    S.custom = true; changed();
  }
  function delState(id) {
    S.M.states = S.M.states.filter((s) => s.id !== id);
    S.M.trans = S.M.trans.filter((t) => t.from !== id && t.to !== id);
    if (S.sel === id) S.sel = null;
    S.custom = true; changed();
  }
  function setStart() {
    const s = stateOf(S.sel); if (!s) return;
    const was = s.start;
    S.M.states.forEach((x) => { x.start = false; });
    s.start = !was;
    S.custom = true; changed();
  }
  function setAccept() {
    const s = stateOf(S.sel); if (!s) return;
    s.accept = !s.accept; S.custom = true; changed();
  }

  /* ----- پنجره‌ی ویرایش گذارها ----- */
  function openDialog(from, to) {
    const dlg = $('#amDlg');
    const existing = S.M.trans.filter((t) => t.from === from && t.to === to);
    let rows = existing.map((t) => clone(t));
    if (!rows.length) rows.push(K.blankRow());
    const draw = (err) => {
      dlg.innerHTML = '<div class="card am-box"><h3>گذارهای ' + esc(from) + ' ← ' + esc(to) + '</h3><div class="am-hint">' + K.dialogHint + '</div><div class="am-rows">' +
        rows.map((r, i) => '<div class="am-r" data-i="' + i + '">' + K.fields.map((f, j) => (j ? '<span class="sep">' + f.sep + '</span>' : '') + (f.type === 'move'
          ? '<select data-k="' + f.k + '">' + ['L', 'R', 'S'].map((m) => '<option value="' + m + '"' + (r[f.k] === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select>'
          : '<input type="text" data-k="' + f.k + '" placeholder="' + f.ph + '" value="' + esc(r[f.k] === '' ? '' : (r[f.k] === '_' && f.blank ? '_' : r[f.k])) + '" autocomplete="off" autocapitalize="off" spellcheck="false">')).join('') +
          '<button class="btn" data-del="' + i + '" title="حذف این گذار">✕</button></div>').join('') +
        '</div><div class="am-err">' + (err ? esc(err) : '') + '</div><div class="am-acts"><button class="btn" id="dAdd">＋ گذار دیگر</button><button class="btn pri" id="dOk">ذخیره</button><button class="btn" id="dNo">انصراف</button></div></div>';
      dlg.hidden = false;
      const first = dlg.querySelector('input'); if (first && !err) first.focus();
    };
    const collect = () => {
      dlg.querySelectorAll('.am-r').forEach((el) => {
        const r = rows[+el.dataset.i];
        el.querySelectorAll('[data-k]').forEach((inp) => { r[inp.dataset.k] = inp.value; });
      });
    };
    dlg._open = Date.now();
    draw();
    /* در لمس، رویداد click ساختگیِ پس از رهاکردن انگشت روی پنجره‌ی تازه‌بازشده می‌افتد؛
       برای جلوگیری از بسته‌شدن/فشرده‌شدن ناخواسته، کلیک‌های ۶۰۰ میلی‌ثانیه‌ی اول نادیده گرفته می‌شود. */
    dlg.onpointerdown = (e) => { dlg._downOnBackdrop = e.target === dlg; };
    dlg.onclick = (e) => {
      if (Date.now() - dlg._open < 600) return;
      const b = e.target.closest('button'); if (e.target === dlg) { if (dlg._downOnBackdrop) dlg.hidden = true; return; }
      if (!b) return;
      if (b.id === 'dNo') { dlg.hidden = true; return; }
      if (b.id === 'dAdd') { collect(); rows.push(K.blankRow()); draw(); return; }
      if (b.dataset.del != null) { collect(); rows.splice(+b.dataset.del, 1); draw(); return; }
      if (b.id === 'dOk') {
        collect();
        const out = [];
        for (const r of rows) {
          const t = K.norm(Object.assign({}, r));
          const err = K.validate(t);
          if (err) { draw(err); return; }
          t.from = from; t.to = to; out.push(t);
        }
        const keep = S.M.trans.filter((t) => !(t.from === from && t.to === to));
        const seen = new Set();
        const uniq = out.filter((t) => { const k = K.fields.map((f) => t[f.k]).join('\u0001'); if (seen.has(k)) return false; seen.add(k); return true; });
        S.M.trans = keep.concat(uniq);
        dlg.hidden = true; S.custom = true; changed();
      }
    };
    dlg.onkeydown = (e) => {
      if (e.key === 'Escape') dlg.hidden = true;
      if (e.key === 'Enter') { const ok = dlg.querySelector('#dOk'); if (ok) ok.click(); }
    };
  }

  /* ----- تعامل با بوم: ماوس و لمس ----- */
  let drag = null, rub = null;
  const toSvg = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const stateAt = (p, skip) => {
    let best = null, bd = R + 18;
    S.M.states.forEach((s) => { const d = Math.hypot(s.x - p.x, s.y - p.y); if (s.id !== skip && d < bd) { bd = d; best = s; } });
    return best;
  };
  const clearRub = () => { if (rub) rub.remove(); rub = null; svg.querySelectorAll('.ast.tgt').forEach((g) => g.classList.remove('tgt')); };

  function onTapState(id) {
    if (S.mode === 'del') { delState(id); return; }
    if (S.mode === 'edge') {
      if (S.pend == null) { S.pend = id; render(); return; }
      const a = S.pend; S.pend = null; render(); openDialog(a, id); return;
    }
    if (S.mode === 'move') { S.sel = S.sel === id ? null : id; render(); syncTools(); }
  }
  function onTapEdge(k) {
    const [a, b] = k.split('>');
    if (S.mode === 'del') {
      S.M.trans = S.M.trans.filter((t) => !(t.from === a && t.to === b)); S.custom = true; changed(); return;
    }
    openDialog(a, b);
  }

  svg.addEventListener('pointerdown', (e) => {
    if (drag) return;
    const el = e.target.closest ? e.target.closest('[data-st],[data-ed]') : null;
    const p = toSvg(e);
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
    if (el && el.dataset.st) {
      const s = stateOf(el.dataset.st);
      drag = { kind: 'st', id: s.id, pid: e.pointerId, dx: s.x - p.x, dy: s.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
    } else if (el && el.dataset.ed) {
      drag = { kind: 'ed', k: el.dataset.ed, pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    } else {
      drag = { kind: 'bg', pid: e.pointerId, x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, moved: false };
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    /* انگشت هنگام ضربه کمی می‌لرزد؛ آستانه‌ی حرکت برای لمس بزرگ‌تر است */
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (e.pointerType === 'touch' ? 12 : 4)) drag.moved = true;
    if (!drag.moved || drag.kind !== 'st') return;
    const p = toSvg(e), s = stateOf(drag.id);
    if (S.mode === 'edge') {
      if (!rub) rub = mk('line', { class: 'arub' }, svg);
      rub.setAttribute('x1', s.x); rub.setAttribute('y1', s.y); rub.setAttribute('x2', p.x); rub.setAttribute('y2', p.y);
      const t = stateAt(p, null);
      svg.querySelectorAll('.ast').forEach((g) => g.classList.toggle('tgt', !!t && g.dataset.st === t.id && t.id !== s.id));
      return;
    }
    if (S.mode === 'del') return;
    s.x = Math.max(R + 4, Math.min(VW - R - 4, p.x + drag.dx));
    s.y = Math.max(R + 4, Math.min(VH - R - 4, p.y + drag.dy));
    drag.movedState = true;
    render();
  });
  const end = (e) => {
    if (!drag || drag.pid !== e.pointerId) return;
    const d = drag; drag = null;
    if (!d.moved) {
      if (d.kind === 'st') onTapState(d.id);
      else if (d.kind === 'ed') onTapEdge(d.k);
      else if (S.mode === 'state') addState(Math.max(R + 4, Math.min(VW - R - 4, d.x)), Math.max(R + 4, Math.min(VH - R - 4, d.y)));
      else if (S.mode === 'move') { S.sel = null; S.pend = null; render(); syncTools(); }
      else if (S.mode === 'edge') { S.pend = null; render(); }
      return;
    }
    if (d.kind === 'st' && S.mode === 'edge') {
      const t = stateAt(toSvg(e), null);
      clearRub();
      if (t) openDialog(d.id, t.id);
      else render();
    } else if (d.kind === 'st' && d.movedState) { S.custom = true; changed(); }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', (e) => { if (drag && drag.pid === e.pointerId) drag = null; clearRub(); render(); });

  /* ----- ابزارها ----- */
  const HINTS = {
    move: 'کشیدن حالت = جابه‌جایی · ضربه روی حالت = انتخاب (برای شروع/پایانی) · ضربه روی یال = ویرایش گذارها',
    state: 'روی فضای خالی بوم ضربه بزنید تا حالت جدید اضافه شود.',
    edge: 'از یک حالت تا حالت دیگر بکشید (یا روی دو حالت پشت‌سرهم بزنید). برای حلقه، دوبار روی همان حالت بزنید.',
    del: 'روی حالت یا یال ضربه بزنید تا حذف شود.'
  };
  function syncTools() {
    view.querySelectorAll('#amModes button').forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
    $('#amHint').textContent = HINTS[S.mode];
    const s = stateOf(S.sel);
    $('#amStart').disabled = !s; $('#amAcc').disabled = !s;
    $('#amStart').classList.toggle('pri', !!s && s.start);
    $('#amAcc').classList.toggle('pri', !!s && s.accept);
  }
  $('#amModes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.m; S.pend = null; if (S.mode !== 'move') S.sel = null;
    syncTools(); render();
  });
  $('#amStart').addEventListener('click', setStart);
  $('#amAcc').addEventListener('click', setAccept);

  const presetSel = $('#amPreset');
  presetSel.innerHTML = K.presets.map((p, i) => '<option value="' + i + '">' + esc(p.name) + '</option>').join('') + '<option value="x">ماشین شما (ویرایش‌شده)</option>';
  function loadPreset(i) {
    const p = K.presets[i];
    S.M = { states: clone(p.states), trans: clone(p.trans) };
    S.M.states.forEach((s) => { s.start = !!s.start; s.accept = !!s.accept; });
    S.custom = false; S.sel = null; S.pend = null;
    S.input = p.tests && p.tests.length ? p.tests[0] : '';
    $('#amInput').value = S.input;
    presetSel.value = String(i); S.preset = i;
    drawChips(); changed();
  }
  presetSel.addEventListener('change', () => { if (presetSel.value !== 'x') loadPreset(+presetSel.value); });
  $('#amClear').addEventListener('click', () => {
    S.M = { states: [], trans: [] }; S.sel = null; S.pend = null; S.custom = true; drawChips(); changed();
  });
  function drawChips() {
    const p = K.presets[S.preset] || { tests: [] };
    $('#amChips').innerHTML = (S.custom ? K.presets[S.preset] : p).tests.map((t) => '<button class="btn" data-s="' + esc(t) + '">' + (t === '' ? 'تهی' : esc(t)) + '</button>').join('');
  }
  $('#amChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('#amInput').value = b.dataset.s; S.input = b.dataset.s; save(); invalidate();
  });
  $('#amInput').addEventListener('input', (e) => { S.input = e.target.value; save(); invalidate(); });
  K.bindOptions && K.bindOptions(view, S, () => { save(); invalidate(); });

  function invalidate() { stop(); S.run = null; S.i = -1; render(); renderRun(); }

  /* ----- اجرا ----- */
  function prepare() {
    const P = buildP(S.M);
    if (!S.M.states.length) { toast('ابتدا چند حالت و گذار رسم کنید یا یک ماشین نمونه انتخاب کنید.'); return false; }
    if (!P.start) { toast('حالت شروع تعریف نشده: یک حالت را انتخاب و «حالت شروع» را بزنید.'); return false; }
    let r;
    try { r = search(P, S.input, E, S.opt); } catch (err) { toast(String(err.message || err)); return false; }
    S.run = r; S.i = -1;
    $('#amTrace').innerHTML = r.path.map((st, i) => '<div class="tr" data-i="' + i + '"><span>' + i + '</span><code>' + esc(E.line(st.cfg, S.input)) + '<small>' + (st.tr ? esc(fmt(st.tr)) : 'پیکربندی اولیه') + '</small></code></div>').join('');
    return true;
  }
  function go(i) {
    if (!S.run && !prepare()) return;
    S.i = Math.max(0, Math.min(S.run.path.length - 1, i));
    render(); renderRun();
  }
  const next = () => { if (!S.run || S.i < 0) go(0); else if (S.i < S.run.path.length - 1) go(S.i + 1); else stop(); };
  function stop() { if (S.timer) { clearInterval(S.timer); S.timer = null; } const b = $('#bPlay'); if (b) b.textContent = '▶ پخش'; }
  function play() {
    if (S.timer) { stop(); return; }
    if (!S.run && !prepare()) return;
    if (S.i >= S.run.path.length - 1) S.i = -1;
    $('#bPlay').textContent = '⏸ توقف';
    next();
    S.timer = setInterval(() => { if (S.i >= S.run.path.length - 1) stop(); else next(); }, S.speed);
  }
  $('#bNext').addEventListener('click', () => { stop(); next(); });
  $('#bPrev').addEventListener('click', () => { stop(); if (S.run && S.i > 0) go(S.i - 1); });
  $('#bFirst').addEventListener('click', () => { stop(); if (!S.run && !prepare()) return; go(0); });
  $('#bLast').addEventListener('click', () => { stop(); if (!S.run && !prepare()) return; go(S.run.path.length - 1); });
  $('#bPlay').addEventListener('click', play);
  $('#speed').addEventListener('input', (e) => {
    S.speed = 2000 - +e.target.value;
    if (S.timer) { clearInterval(S.timer); S.timer = setInterval(() => { if (S.i >= S.run.path.length - 1) stop(); else next(); }, S.speed); }
  });
  S.speed = 2000 - 800;

  function verdict() {
    const r = S.run;
    if (r.accepted) return ['ok', '✓ رشته پذیرفته شد.'];
    if (r.limit) return ['unk', '؟ پس از بررسی ' + r.explored + ' پیکربندی متوقف شد (حد ' + K.limitText + ')؛ پذیرش ثابت نشد (ممکن است ماشین در حلقه باشد).'];
    return ['bad', '✗ رشته رد شد' + (K.rejectWhy ? ' — ' + K.rejectWhy(r) : '.')];
  }
  function renderRun() {
    const note = $('#note'), r = S.run, i = S.i;
    const has = r && i >= 0;
    ['bFirst', 'bPrev'].forEach((id) => { $('#' + id).disabled = !has || i === 0; });
    ['bNext', 'bLast'].forEach((id) => { $('#' + id).disabled = has && i >= r.path.length - 1; });
    $('#counter').textContent = has ? 'گام ' + (i + 1) + ' از ' + r.path.length : 'اجرایی آماده نیست';
    if (!has) {
      $('#amPanel').innerHTML = E.panel(null, S.input);
      $('#amTrace').innerHTML = '<div class="tr"><span></span><code>ورودی را بنویسید و «بعدی» یا «پخش» را بزنید.</code></div>';
      note.textContent = K.idleNote;
      return;
    }
    const st = r.path[i];
    let extra = '';
    if (i === r.path.length - 1) { const v = verdict(); extra = '<div class="am-status ' + v[0] + '">' + esc(v[1]) + '</div>'; note.textContent = v[1]; }
    else note.textContent = i === 0 ? 'پیکربندی اولیه: ' + E.line(st.cfg, S.input) : 'گذار ' + fmt(st.tr) + ' اجرا شد.';
    $('#amPanel').innerHTML = E.panel(st.cfg, S.input) + extra;
    const rows = view.querySelectorAll('#amTrace .tr');
    rows.forEach((el, k) => el.classList.toggle('cur', k === i));
    const cur = rows[i]; if (cur) { revealRow($('#amTrace'), cur); }
    const hd = view.querySelector('#amPanel .acell.hd'); if (hd && hd.scrollIntoView) { try { hd.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e2) { /* ignore */ } }
  }

  /* ----- دستگیره‌ی تغییر عرض نمودار / ناحیه‌ی کناری (حالت افقی) ----- */
  const mainEl = $('.am'), handle = $('#amHandle');
  const SWK = 'ds_am_sw';
  function setSW(p, save) {
    p = Math.min(60, Math.max(20, p));
    mainEl.style.setProperty('--sw', p + '%');
    handle.setAttribute('aria-valuenow', String(Math.round(p)));
    S.sw = p;
    if (save) { try { localStorage.setItem(SWK, String(p)); } catch (e) { /* ignore */ } }
  }
  { let sv = NaN; try { sv = parseFloat(localStorage.getItem(SWK)); } catch (e) { /* ignore */ } setSW(sv >= 20 && sv <= 60 ? sv : 36, false); }
  let hdrag = false;
  handle.addEventListener('pointerdown', (e) => {
    hdrag = true; document.body.classList.add('dragging');
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!hdrag) return;
    const r = mainEl.getBoundingClientRect();
    setSW((r.right - e.clientX) / r.width * 100, false);
  });
  const hend = () => { if (!hdrag) return; hdrag = false; document.body.classList.remove('dragging'); setSW(S.sw, true); };
  handle.addEventListener('pointerup', hend);
  handle.addEventListener('pointercancel', hend);
  handle.addEventListener('dblclick', () => setSW(36, true));
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setSW(S.sw + (e.key === 'ArrowLeft' ? 2 : -2), true); }
  });

  /* ----- شروع ----- */
  const restored = load();
  if (restored) { S.custom = true; $('#amInput').value = S.input; presetSel.value = 'x'; }
  else loadPreset(0);
  if (K.syncOptions) K.syncOptions(view, S);
  drawChips(); syncTools(); render(); renderRun();
  return { destroy() { stop(); } };
}

window.Automata = { CSS, html, mount, buildP, search, cells, esc };
})();
