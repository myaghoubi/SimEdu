/* ==========================================================================
   برنامهٔ اصلی: ویرایشگر، کنترل اجرای گام‌به‌گام، پنل‌ها و PWA
   ========================================================================== */
(function () {
'use strict';
const { Interp, PyObj, PyDict, PySet, PyClass, PyFunc, Builtin, BoundMethod } = window.DSI;
const { EXAMPLES } = window.DSExamples;
const $ = id => document.getElementById(id);
const fa = n => Number(n).toLocaleString('fa-IR');
const LH = 21;                               // ارتفاع هر خط ویرایشگر

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ------------------------------------------------------------------ */
/* ویرایشگر با رنگ‌آمیزی و شمارهٔ خط                                   */
/* ------------------------------------------------------------------ */
const KW = new Set(['def', 'class', 'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or', 'is', 'return', 'break', 'continue', 'pass', 'global', 'nonlocal', 'del', 'assert', 'raise', 'try', 'except', 'finally', 'import', 'from', 'as', 'lambda']);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlightLine(line) {
  const re = /(#.*$)|([fFrRbB]{0,2}(?:"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?))|([A-Za-z_\u0080-\uFFFF][\w\u0080-\uFFFF]*)|(\d+(?:\.\d+)?)/g;
  let out = '', last = 0, m, prevWord = '';
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    last = re.lastIndex;
    if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-str">${esc(m[2])}</span>`;
    else if (m[3]) {
      const w = m[3];
      const after = line[last];
      if (KW.has(w)) { out += `<span class="tk-kw">${w}</span>`; prevWord = w; continue; }
      if (w === 'None' || w === 'True' || w === 'False') out += `<span class="tk-lit">${w}</span>`;
      else if (w === 'self') out += `<span class="tk-self">${w}</span>`;
      else if (after === '(' || prevWord === 'def' || prevWord === 'class') out += `<span class="tk-fn">${esc(w)}</span>`;
      else out += esc(w);
      prevWord = '';
      continue;
    } else if (m[4]) out += `<span class="tk-num">${m[4]}</span>`;
    prevWord = '';
  }
  return out + esc(line.slice(last));
}

class Editor {
  constructor() {
    this.ta = $('ta'); this.hl = $('hl'); this.gutter = $('gutter'); this.scroller = $('editor');
    this.lines = 0; this.marks = { next: 0, prev: 0, err: 0 };
    this.bps = new Set();
    this.onChange = () => {}; this.onBp = () => {};
    this.ta.addEventListener('input', () => { this.refresh(); this.onChange(); });
    this.ta.addEventListener('keydown', e => this.keydown(e));
    this.gutter.addEventListener('click', e => {
      const g = e.target.closest('.gl'); if (!g) return;
      const n = +g.dataset.n;
      if (this.bps.has(n)) this.bps.delete(n); else this.bps.add(n);
      this.paintMarks(); this.onBp();
    });
  }
  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v; this.refresh(); }
  refresh() {
    const lines = this.ta.value.split('\n');
    this.hl.innerHTML = lines.map((l, i) => `<span class="ln" data-n="${i + 1}">${highlightLine(l) || '&#8203;'}</span>`).join('');
    if (lines.length !== this.lines) {
      this.lines = lines.length;
      this.gutter.innerHTML = lines.map((_, i) => `<div class="gl" data-n="${i + 1}" title="نقطهٔ توقف"><span class="bp"></span><span class="num">${i + 1}</span><span class="arrow"></span></div>`).join('');
    }
    this.paintMarks();
  }
  setMarks(m) { Object.assign(this.marks, m); this.paintMarks(); }
  paintMarks() {
    const { next, prev, err } = this.marks;
    const lnEls = this.hl.children, glEls = this.gutter.children;
    for (let i = 0; i < lnEls.length; i++) {
      const n = i + 1;
      lnEls[i].classList.toggle('next', n === next && n !== err);
      lnEls[i].classList.toggle('prev', n === prev && n !== next);
      lnEls[i].classList.toggle('err', n === err);
      if (glEls[i]) {
        glEls[i].classList.toggle('next', n === next && n !== err);
        glEls[i].classList.toggle('prev', n === prev && n !== next && n !== err);
        glEls[i].classList.toggle('err', n === err);
        glEls[i].classList.toggle('bpon', this.bps.has(n));
      }
    }
  }
  reveal(line) {
    if (!line) return;
    const top = (line - 1) * LH + 8, sc = this.scroller;
    if (top < sc.scrollTop + 10) sc.scrollTop = Math.max(0, top - 60);
    else if (top + LH > sc.scrollTop + sc.clientHeight - 14) sc.scrollTop = top - sc.clientHeight + LH * 3;
  }
  insert(text) {
    this.ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { this.ta.setRangeText(text, this.ta.selectionStart, this.ta.selectionEnd, 'end'); this.refresh(); this.onChange(); }
  }
  keydown(e) {
    const ta = this.ta;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (s !== en && v.slice(s, en).includes('\n') || e.shiftKey) {
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const block = v.slice(ls, en);
        const nb = block.split('\n').map(l => e.shiftKey ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l).join('\n');
        ta.setSelectionRange(ls, en);
        this.insert(nb);
        ta.setSelectionRange(ls, ls + nb.length);
      } else this.insert('    ');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = ta.selectionStart, v = ta.value;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const cur = v.slice(ls, s);
      const indent = /^[ \t]*/.exec(cur)[0];
      const extra = /:\s*(#.*)?$/.test(cur) ? '    ' : '';
      this.insert('\n' + indent + extra);
    } else if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
      const s = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
      const before = v.slice(ls, s);
      if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0) {
        e.preventDefault(); ta.setSelectionRange(s - 4, s); this.insert('');
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* نمایش مقدارها در پنل‌ها                                             */
/* ------------------------------------------------------------------ */
function short(interp, x) {
  if (x instanceof PyObj) return '→#' + x.id;
  const r = interp.repr(x);
  return r.length > 26 ? r.slice(0, 25) + '…' : r;
}
function summ(interp, v) {
  if (v instanceof PyObj && !interp.isExc(v.cls)) {
    const parts = [];
    for (const [k, x] of v.attrs) { if (k.startsWith('__')) continue; if (parts.length >= 5) { parts.push('…'); break; } parts.push(k + '=' + short(interp, x)); }
    return `${v.cls.name}#${v.id}(${parts.join(', ')})`;
  }
  const r = interp.repr(v);
  return r.length > 160 ? r.slice(0, 159) + '…' : r;
}
const isDataVal = v => !(v instanceof PyFunc || v instanceof PyClass || v instanceof Builtin || v instanceof BoundMethod || (v && v.isModule));

/* ------------------------------------------------------------------ */
/* برنامهٔ اصلی                                                        */
/* ------------------------------------------------------------------ */
const editor = new Editor();
const viz = new window.DSViz.Viz($('viz'), { bars: false, anim: !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) });

const App = {
  code: '', interp: null, ok: false, T: 0, capped: false, dryDone: false,
  playing: false, timer: 0, lastEvent: null, prevVars: new Map(), exId: null, dryTimer: 0, syntaxErr: null,

  /* --- بارگذاری کد --- */
  load(code, opts) {
    opts = opts || {};
    this.code = code; this.stopPlay();
    try { new Interp(code); this.syntaxErr = null; }
    catch (e) {
      if (e && e.name === 'SyntaxError') {
        this.syntaxErr = e; this.ok = false;
        editor.setMarks({ err: e.line, next: 0, prev: 0 });
        this.setStatus(`خطای نحوی در خط ${fa(e.line)}: ${e.message}`, true);
        this.updateButtons(); return;
      }
      throw e;
    }
    this.ok = true;
    this.setStatus(opts.msg || 'کد معتبر است', false);
    this.restart();
    clearTimeout(this.dryTimer);
    this.dryDone = false;
    this.dryTimer = setTimeout(() => this.dryRun(), 30);
  },
  restart() {
    this.stopPlay();
    this.interp = new Interp(this.code);
    this.lastEvent = null; this.prevVars = new Map();
    viz.reset();
    editor.setMarks({ err: 0 });
    this.render({ snap: true });
  },
  dryRun() {
    const it = new Interp(this.code); const t0 = performance.now();
    let n = 0;
    while (it.stepInto()) { if (++n >= 50000 || (n % 500 === 0 && performance.now() - t0 > 1500)) break; }
    this.T = it.steps; this.capped = !it.finished; this.dryDone = true;
    this.updateCounter();
  },
  get pos() { const it = this.interp; return it.steps + (it.finished ? 1 : 0); },

  /* --- اجرا --- */
  act(mode) {
    if (!this.ok || this.interp.finished) return false;
    const it = this.interp, d0 = it.frames.length, ret0 = it.lastReturn;
    it.step(mode);
    this.lastEvent = null;
    if (!it.finished) {
      if (it.frames.length > d0) { const f = it.frames[it.frames.length - 1]; this.lastEvent = { kind: 'call', text: `ورود به تابع ${f.name}` + this.argText(f) }; }
    }
    if (it.lastReturn !== ret0 && it.frames.length < d0 + (mode === 'into' ? 1 : 99)) {
      this.lastEvent = { kind: 'ret', text: `بازگشت از ${it.lastReturn.name} ← ${it.repr(it.lastReturn.value)}` };
    }
    this.render({});
    return !it.finished;
  },
  argText(frame) {
    const it = this.interp;
    if (!frame.func) return '';
    const parts = frame.func.params.map(p => `${p.name}=${short(it, frame.scope.vars.get(p.name))}`);
    return '(' + parts.join(', ') + ')';
  },
  /* رفتن به موقعیت p (۰ تا T+1) */
  goto(p, opts) {
    opts = opts || {};
    if (!this.ok) return;
    p = Math.max(0, p);
    let it = this.interp;
    if (p < this.pos) { it = this.interp = new Interp(this.code); }
    let guard = 0;
    while (this.pos < p && !it.finished && guard++ < 2e6) { if (it.steps < p) it.stepInto(); else it.stepInto(); }
    this.lastEvent = null;
    this.render({ snap: !!opts.snap });
  },
  runToBreak() {
    if (!this.ok || this.interp.finished) return;
    const it = this.interp; let n = 0;
    const bps = editor.bps;
    while (n++ < 500000) {
      if (!it.stepInto()) break;
      if (bps.has(it.curLine)) break;
    }
    if (n >= 500000 && !it.finished) toast('تعداد گام‌ها از حد مجاز گذشت؛ شاید حلقهٔ بی‌پایان باشد.');
    this.lastEvent = null;
    this.render({ snap: true });
  },
  togglePlay() {
    if (this.playing) { this.stopPlay(); return; }
    if (!this.ok) return;
    if (this.interp.finished) this.restart();
    this.playing = true; this.setPlayIcon(); this.tick();
  },
  delay() { return [2000, 1500, 1100, 800, 600, 450, 320, 220, 140, 80][+$('speed').value - 1]; },
  tick() {
    if (!this.playing) return;
    const more = this.act('into');
    if (!more || editor.bps.has(this.interp.curLine)) { this.stopPlay(); return; }
    this.timer = setTimeout(() => this.tick(), this.delay());
  },
  stopPlay() { this.playing = false; clearTimeout(this.timer); this.setPlayIcon(); },
  setPlayIcon() {
    const b = $('btnPlay');
    b.querySelector('use').setAttribute('href', this.playing ? '#i-pause' : '#i-play');
    b.querySelector('.lbl').textContent = this.playing ? 'توقف' : 'اجرای خودکار';
    b.classList.toggle('on', this.playing);
  },

  /* --- نمایش --- */
  render(o) {
    const it = this.interp;
    const next = it.finished ? 0 : it.curLine;
    const prevLine = it.finished ? (it.lineLog[it.steps - 1] || 0) : (it.lineLog[it.steps - 2] || 0);
    editor.setMarks({ next: it.error ? 0 : next, prev: prevLine, err: it.error ? it.error.line : 0 });
    if (it.error) this.setStatus(`خطای زمان اجرا (خط ${fa(it.error.line)}): ${it.error.type}: ${it.error.msg}`, true);
    else if (this.ok && !this.syntaxErr) this.setStatus(it.finished ? 'برنامه به پایان رسید' : 'کد معتبر است', false);
    editor.reveal(it.error ? it.error.line : next);
    viz.update(it, { snap: o.snap });
    this.renderCaption();
    this.renderVars();
    this.renderStack();
    this.renderOut();
    this.updateCounter();
    this.updateButtons();
  },
  setStatus(msg, bad) { const s = $('status'); s.textContent = msg; s.className = 'editor-status ' + (bad ? 'err' : 'ok'); },
  srcLine(n) { const l = (this.code.split('\n')[n - 1] || '').trim(); return l.length > 70 ? l.slice(0, 69) + '…' : l; },
  renderCaption() {
    const it = this.interp, c = $('caption');
    c.className = 'caption';
    let html = '';
    if (it.error) {
      c.classList.add('err');
      html = `<div class="line main">خطا در خط ${fa(it.error.line)}: <code>${esc(it.error.type)}</code> ${esc(it.error.msg)}</div>`;
    } else if (it.finished) {
      c.classList.add('done');
      html = '<div class="line main">✔ اجرای برنامه به پایان رسید.</div>';
    } else if (it.steps === 0) {
      html = '<div class="line main">آماده. «گام بعد» را بزنید تا خط اول اجرا شود.</div>';
    } else {
      html = `<div class="line main">خط ${fa(it.curLine)} آمادهٔ اجراست: <code>${esc(this.srcLine(it.curLine))}</code></div>`;
    }
    if (this.lastEvent) html += `<div class="line ev">${esc(this.lastEvent.text)}</div>`;
    if (it.note && it.note.step <= it.steps) html += `<div class="line"><span class="tag-note">${esc(it.note.text)}</span></div>`;
    c.innerHTML = html;
  },
  renderVars() {
    const it = this.interp, box = $('tab-vars');
    const frames = it.frames, top = frames.length - 1;
    const next = new Map();
    let html = '<table class="vars"><tbody>';
    const addScope = (label, scope, key) => {
      const rows = [];
      for (const [n, v] of scope.vars) { if (n.startsWith('__') || !isDataVal(v)) continue; rows.push([n, v]); }
      if (!rows.length) return;
      html += `<tr class="scope-row"><td colspan="2">${esc(label)}</td></tr>`;
      for (const [n, v] of rows) {
        const txt = summ(it, v), id = key + '/' + n;
        next.set(id, txt);
        const changed = this.prevVars.has(id) ? this.prevVars.get(id) !== txt : this.prevVars.size > 0;
        html += `<tr class="${changed ? 'changed' : ''}"><td class="n">${esc(n)}</td><td class="v">${esc(txt)}</td></tr>`;
      }
    };
    for (let i = top; i >= 1; i--) addScope(`محلی — ${frames[i].name}${i === top ? '' : ' (فراخوانی‌کننده)'}`, frames[i].scope, 'f' + i + frames[i].name);
    addScope('سراسری', frames[0].scope, 'g');
    html += '</tbody></table>';
    box.innerHTML = next.size ? html : '<div class="empty-note">هنوز متغیری ساخته نشده است.</div>';
    this.prevVars = next;
  },
  renderStack() {
    const it = this.interp, box = $('tab-stack');
    const fr = it.frames;
    let html = '<ol class="stack-list">';
    for (let i = fr.length - 1; i >= 0; i--) {
      const f = fr[i];
      const line = i === fr.length - 1 && !it.finished ? it.curLine : f.line;
      html += `<li class="${i === fr.length - 1 ? 'top' : ''}"><b>${esc(f.name === '<module>' ? 'برنامهٔ اصلی' : f.name)}</b>${f.func ? esc(this.argText(f)) : ''}<span class="ln-no">line ${line}</span></li>`;
    }
    box.innerHTML = html + '</ol>';
  },
  renderOut() {
    const it = this.interp, box = $('tab-out');
    let html = it.out.map(o => esc(o.text + (o.end === '\n' ? '\n' : o.end))).join('');
    if (it.error) html += `<span class="err">${esc(it.error.type + ': ' + it.error.msg)}  (خط ${it.error.line})</span>`;
    box.innerHTML = html ? `<pre class="out">${html}</pre>` : '<div class="empty-note">هنوز چیزی چاپ نشده است. (از <code>print(...)</code> استفاده کنید.)</div>';
    box.scrollTop = box.scrollHeight;
  },
  updateCounter() {
    const total = this.T + 1;
    $('stepCount').textContent = `گام ${fa(this.pos)}${this.dryDone ? ' / ' + fa(total) + (this.capped ? '+' : '') : ''}`;
    const sl = $('stepSlider');
    sl.max = this.dryDone ? String(Math.max(total, this.pos)) : String(Math.max(this.pos, 1));
    sl.value = String(this.pos);
  },
  updateButtons() {
    const it = this.interp, ok = this.ok, fin = !it || it.finished;
    $('btnStep').disabled = !ok || fin;
    $('btnOver').disabled = !ok || fin;
    $('btnOut').disabled = !ok || fin || (it && it.frames.length <= 1);
    $('btnRun').disabled = !ok || fin;
    $('btnBack').disabled = !ok || this.pos === 0;
    $('btnRestart').disabled = !ok;
    $('btnPlay').disabled = !ok;
    $('stepSlider').disabled = !ok;
  },
};

/* ------------------------------------------------------------------ */
/* مثال‌ها و ذخیره‌سازی                                                */
/* ------------------------------------------------------------------ */
function edits() { try { return JSON.parse(store.get('dsviz.edits', '{}')) || {}; } catch (e) { return {}; } }
function saveEdit() {
  const ex = EXAMPLES.find(e => e.id === App.exId); if (!ex) return;
  const all = edits();
  if (editor.value === ex.code) delete all[ex.id]; else all[ex.id] = editor.value;
  store.set('dsviz.edits', JSON.stringify(all));
}
function loadExample(id, msg) {
  const ex = EXAMPLES.find(e => e.id === id) || EXAMPLES[0];
  App.exId = ex.id; store.set('dsviz.example', ex.id);
  $('exampleSelect').value = ex.id;
  const saved = edits()[ex.id];
  editor.bps.clear();
  editor.value = saved !== undefined ? saved : ex.code;
  $('exDesc').innerHTML = `<b>${ex.title}</b><br>${ex.desc}`;
  $('btnRevert').disabled = saved === undefined;
  App.load(editor.value, { msg: msg || (saved !== undefined ? 'نسخهٔ ویرایش‌شدهٔ شما بارگذاری شد' : 'کد معتبر است') });
}

(function buildSelect() {
  const sel = $('exampleSelect'); const groups = new Map();
  EXAMPLES.forEach(e => { if (!groups.has(e.group)) { const g = document.createElement('optgroup'); g.label = e.group; sel.appendChild(g); groups.set(e.group, g); } const o = document.createElement('option'); o.value = e.id; o.textContent = e.title; groups.get(e.group).appendChild(o); });
  sel.addEventListener('change', () => loadExample(sel.value));
})();

let editTimer = 0;
editor.onChange = () => {
  clearTimeout(editTimer);
  App.stopPlay();
  $('status').className = 'editor-status ok'; $('status').textContent = 'در حال ویرایش…';
  editTimer = setTimeout(() => {
    saveEdit();
    const ex = EXAMPLES.find(e => e.id === App.exId);
    $('btnRevert').disabled = !!ex && editor.value === ex.code;
    App.load(editor.value, { msg: 'کد ویرایش شد؛ اجرا از ابتدا آماده است' });
  }, 350);
};
editor.onBp = () => {};

/* ------------------------------------------------------------------ */
/* اتصال دکمه‌ها                                                       */
/* ------------------------------------------------------------------ */
$('btnStep').onclick = () => { App.stopPlay(); App.act('into'); };
$('btnOver').onclick = () => { App.stopPlay(); App.act('over'); };
$('btnOut').onclick = () => { App.stopPlay(); App.act('out'); };
$('btnBack').onclick = () => { App.stopPlay(); App.goto(App.pos - 1); };
$('btnRestart').onclick = () => { App.restart(); };
$('btnPlay').onclick = () => App.togglePlay();
$('btnRun').onclick = () => { App.stopPlay(); App.runToBreak(); };
$('btnRevert').onclick = () => {
  const ex = EXAMPLES.find(e => e.id === App.exId); if (!ex) return;
  const all = edits(); delete all[ex.id]; store.set('dsviz.edits', JSON.stringify(all));
  loadExample(ex.id, 'کد اصلی مثال بازگردانده شد'); toast('کد اصلی مثال بازگردانده شد');
};
let sliderRaf = 0;
$('stepSlider').addEventListener('input', e => {
  App.stopPlay();
  const v = +e.target.value;
  cancelAnimationFrame(sliderRaf);
  sliderRaf = requestAnimationFrame(() => App.goto(v, { snap: true }));
});
$('speed').value = store.get('dsviz.speed', '5');
const applySpeed = () => { viz.opts.speed = Math.max(0.6, 0.5 + (+$('speed').value) * 0.2); store.set('dsviz.speed', $('speed').value); };
$('speed').addEventListener('input', applySpeed); applySpeed();

$('btnBars').onclick = () => {
  viz.opts.bars = !viz.opts.bars;
  $('btnBars').classList.toggle('on', viz.opts.bars); $('btnBars').setAttribute('aria-pressed', viz.opts.bars);
  viz.reset(); viz.update(App.interp, { snap: true });
};
const root = document.documentElement;
function setTheme(t) { root.dataset.theme = t; store.set('dsviz.theme', t); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#0f1220' : '#4f46e5'; }
setTheme(store.get('dsviz.theme', (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'));
$('btnTheme').onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
$('btnHelp').onclick = () => $('helpDlg').showModal();
$('helpClose').onclick = () => $('helpDlg').close();

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  ['vars', 'stack', 'out'].forEach(n => { $('tab-' + n).hidden = n !== t.dataset.tab; });
}));

document.addEventListener('keydown', e => {
  if (!e.altKey) return;
  const map = { ArrowRight: () => $('btnStep').click(), ArrowLeft: () => $('btnBack').click(), ArrowDown: () => $('btnOver').click(), ArrowUp: () => $('btnOut').click(), ' ': () => App.togglePlay() };
  const fn = map[e.key]; if (fn) { e.preventDefault(); fn(); }
});

/* ---------- نصب PWA ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('btnInstall').hidden = false; });
$('btnInstall').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('btnInstall').hidden = true; };
window.addEventListener('appinstalled', () => { $('btnInstall').hidden = true; toast('برنامه نصب شد'); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- شروع ---------- */
const startId = store.get('dsviz.example', 'avl-insert');
loadExample(EXAMPLES.some(e => e.id === startId) ? startId : 'avl-insert');
window.__app = { App, editor, viz };      // برای اشکال‌زدایی و تست
})();
