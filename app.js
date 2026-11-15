/* رابط کاربری شبیه‌ساز پشته و صف */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAX_LL = 8;
  const FA = { push: 'درج — push', pop: 'حذف — pop', enqueue: 'درج — enqueue', dequeue: 'حذف — dequeue' };
  const S = { kind: 'stack', impl: 'll', N: 6, base: null, steps: [], i: -1, runOp: null, viewOp: null, timer: null, speed: 900 };
  const key = () => S.impl + '-' + S.kind;
  const ops = () => E.OPS[key()];

  /* ---------- وضعیت ---------- */
  function idleStep() {
    return { line: -1, note: '', snap: S.base, loc: {}, out: null, err: null, idle: true };
  }
  const cur = () => (S.i < 0 ? idleStep() : S.steps[S.i]);
  const prev = () => (S.i > 0 ? S.steps[S.i - 1] : idleStep());

  function reset() {
    stop();
    S.base = E.initState(S.impl, S.kind, S.N);
    S.steps = []; S.i = -1; S.runOp = null;
    S.viewOp = ops()[0].id;
    newRandom();
    render();
  }

  function randVal() { return String(10 + Math.floor(Math.random() * 90)); }
  function newRandom() { $('#val').value = randVal(); }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function startOp(opId) {
    stop();
    if (S.steps.length) S.base = S.steps[S.steps.length - 1].snap;
    S.steps = []; S.i = -1;
    const op = ops().find((o) => o.id === opId);
    let x = null;
    if (op.takesArg) {
      x = $('#val').value.trim().slice(0, 4);
      if (!x) x = randVal();
      if (S.impl === 'll' && E.chain(S.base).length >= MAX_LL) {
        toast('برای خوانایی، حداکثر ' + MAX_LL + ' گره نمایش داده می‌شود. ابتدا چند عنصر حذف کنید.');
        render(); return;
      }
    }
    S.viewOp = opId; S.runOp = opId;
    S.steps = E.runOp(S.base, opId, x);
    S.i = 0;
    if (op.takesArg) newRandom();
    render();
  }

  /* ---------- حرکت بین گام‌ها ---------- */
  function next() { if (S.i < S.steps.length - 1) { S.i++; render(); } else stop(); }
  function back() { if (S.i > -1) { S.i--; render(); } }
  function first() { stop(); if (S.steps.length) { S.i = -1; render(); } }
  function last() { stop(); if (S.steps.length) { S.i = S.steps.length - 1; render(); } }
  function play() {
    if (!S.steps.length) return;
    if (S.timer) { stop(); return; }
    if (S.i >= S.steps.length - 1) S.i = -1;
    S.timer = setInterval(next, S.speed);
    next(); renderCtrl();
  }
  function stop() { if (S.timer) { clearInterval(S.timer); S.timer = null; } renderCtrl(); }

  /* ---------- رسم SVG: ابزارها ---------- */
  const DEFS = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ahp" d="M0 0L10 5L0 10z"/></marker>' +
    '<marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2563eb"/></marker></defs>';

  function chipsHTML(cx, anchorY, list, dir) {
    let out = '';
    list.forEach((c, k) => {
      const w = Math.max(30, c.t.length * 7.4 + 14);
      if (dir < 0) {
        const yb = anchorY - 8, ry = yb - 18 - 20 * k;
        out += '<g class="chip ' + c.c + '"><rect x="' + (cx - w / 2) + '" y="' + ry + '" width="' + w + '" height="18" rx="6"/><text x="' + cx + '" y="' + (ry + 13) + '">' + esc(c.t) + '</text>' +
          (k === 0 ? '<line x1="' + cx + '" y1="' + yb + '" x2="' + cx + '" y2="' + (anchorY - 1) + '"/>' : '') + '</g>';
      } else {
        const ya = anchorY + 8, ry = ya + 20 * k;
        out += '<g class="chip ' + c.c + '"><rect x="' + (cx - w / 2) + '" y="' + ry + '" width="' + w + '" height="18" rx="6"/><text x="' + cx + '" y="' + (ry + 13) + '">' + esc(c.t) + '</text>' +
          (k === 0 ? '<line x1="' + cx + '" y1="' + ya + '" x2="' + cx + '" y2="' + (anchorY + 1) + '"/>' : '') + '</g>';
      }
    });
    return out;
  }

  /* ---------- رسم لیست پیوندی ---------- */
  function llSVG(st, pv) {
    const m = st.snap, loc = st.loc || {};
    const W = 72, H = 40, G = 112, X0 = 28, Y1 = 104, Y2 = 216;
    const chain = E.chain(m);
    const pos = {};
    chain.forEach((id, i) => { pos[id] = { x: X0 + i * G, y: Y1 }; });
    const fused = new Set();
    Object.keys(m.nodes).map(Number).filter((id) => !pos[id]).forEach((id) => {
      const nx = m.nodes[id].next;
      let x = (nx != null && pos[nx]) ? pos[nx].x : X0 + chain.length * G;
      while (fused.has(x)) x += G;
      fused.add(x); pos[id] = { x, y: Y2, f: true };
    });
    const nullX = X0 + chain.length * G;
    const svgW = Math.max(560, nullX + 150);
    const svgH = 330;

    let edges = '';
    const line = (x1, y1, x2, y2) => '<line class="edge" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    Object.keys(m.nodes).forEach((idS) => {
      const id = +idS, n = m.nodes[id], p = pos[id];
      const sx = p.x + 65, sy = p.y + H / 2;
      if (n.next == null) {
        if (!p.f) edges += line(sx, sy, nullX, Y1 + H / 2);
        else edges += line(sx, sy, p.x + W + 34, sy) + '<text class="nulltxt" x="' + (p.x + W + 58) + '" y="' + (sy + 4) + '">None</text>';
      } else {
        const d = pos[n.next]; if (!d) return;
        let tx, ty;
        if (d.y === p.y && d.x > p.x) { tx = d.x; ty = d.y + H / 2; }
        else if (d.y < p.y) { tx = d.x + W / 2; ty = d.y + H; }
        else { tx = d.x + W / 2; ty = d.y; }
        edges += line(sx, sy, tx, ty);
      }
    });

    let nodes = '';
    Object.keys(m.nodes).forEach((idS) => {
      const id = +idS, n = m.nodes[id], p = pos[id];
      const isNew = !(pv.snap.nodes && pv.snap.nodes[id]) && !st.idle;
      nodes += '<g class="node' + (isNew ? ' flash' : '') + '"><rect x="' + p.x + '" y="' + p.y + '" width="' + W + '" height="' + H + '" rx="8"/>' +
        '<line x1="' + (p.x + 58) + '" y1="' + p.y + '" x2="' + (p.x + 58) + '" y2="' + (p.y + H) + '"/>' +
        '<text x="' + (p.x + 29) + '" y="' + (p.y + 26) + '">' + esc(n.val) + '</text><circle cx="' + (p.x + 65) + '" cy="' + (p.y + H / 2) + '" r="3.5"/></g>';
    });
    nodes += '<g class="nullbox"><rect x="' + nullX + '" y="' + Y1 + '" width="58" height="' + H + '" rx="8"/><text x="' + (nullX + 29) + '" y="' + (Y1 + 25) + '">None</text></g>';

    /* برچسب اشاره‌گرها */
    const stack = m.kind === 'stack';
    const ptrs = [['head', m.head, stack ? 'head (top)' : 'head (front)', 'head']];
    if (!stack) ptrs.push(['tail', m.tail, 'tail (rear)', 'tail']);
    if ('new' in loc) ptrs.push(['new', loc.new, 'new', 'new']);
    if ('tmp' in loc) ptrs.push(['tmp', loc.tmp, 'tmp', 'tmp']);
    const at = {};
    ptrs.forEach(([n, v, t, c]) => {
      let target = null;
      if (v == null) { if (chain.length === 0 && (n === 'head' || n === 'tail')) target = 'NULL'; }
      else if (pos[v]) target = v;
      if (target == null) return;
      (at[target] = at[target] || []).push({ t, c });
    });
    let chips = '';
    Object.keys(at).forEach((t) => {
      if (t === 'NULL') chips += chipsHTML(nullX + 29, Y1, at[t], -1);
      else { const p = pos[t]; chips += chipsHTML(p.x + W / 2, p.f ? p.y + H : p.y, at[t], p.f ? 1 : -1); }
    });

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" height="' + svgH + '" role="img" aria-label="لیست پیوندی">' +
      DEFS + edges + nodes + chips + '</svg>';
  }

  /* ---------- رسم آرایه ---------- */
  function arrSVG(st, pv) {
    const m = st.snap, N = m.N, pm = pv.snap;
    const w = 58, h = 46, g = 66, x0 = 84, y = 92;
    const svgW = x0 + (N + 1) * g + 14, svgH = 190;
    const live = new Set(), dead = new Set();
    if (m.impl === 'arr') {
      if (m.kind === 'stack') for (let i = 0; i <= m.top; i++) live.add(i);
      else { for (let i = m.front; i <= m.rear; i++) live.add(i); for (let i = 0; i < Math.min(m.front, N); i++) dead.add(i); }
    } else for (let k = 0; k < m.size; k++) live.add((m.front + k) % N);

    const ptrs = m.kind === 'stack' ? [['top', m.top]] : [['front', m.front], ['rear', m.rear]];
    const at = {};
    ptrs.forEach(([n, v]) => { (at[v] = at[v] || []).push({ t: (v < 0 || v >= N) ? n + '=' + v : n, c: n }); });

    let cells = '', chips = '';
    for (let i = 0; i < N; i++) {
      const x = x0 + i * g;
      const changed = !st.idle && pm.arr && pm.arr[i] !== m.arr[i];
      cells += '<g class="cell' + (live.has(i) ? ' live' : '') + (dead.has(i) ? ' dead' : '') + (changed ? ' flash' : '') + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"/>' +
        '<text class="v" x="' + (x + w / 2) + '" y="' + (y + 29) + '">' + (m.arr[i] == null ? '' : esc(m.arr[i])) + '</text>' +
        '<text class="i" x="' + (x + w / 2) + '" y="' + (y + h + 17) + '">' + i + '</text></g>';
    }
    Object.keys(at).forEach((k) => {
      const idx = +k, x = x0 + idx * g;
      if (idx < 0 || idx >= N) {
        cells += '<g class="cell ghost"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"/><text class="i" x="' + (x + w / 2) + '" y="' + (y + h + 17) + '">' + idx + '</text></g>';
      }
      chips += chipsHTML(x + w / 2, y, at[k], -1);
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" height="' + svgH + '" role="img" aria-label="آرایه">' +
      DEFS + cells + chips + '</svg>';
  }

  /* ---------- نمای حلقه‌ای ---------- */
  function ringSVG(st, pv) {
    const m = st.snap, N = m.N, pm = pv.snap;
    const cx = 170, cy = 150, R = 86, r = 23;
    const live = new Set();
    for (let k = 0; k < m.size; k++) live.add((m.front + k) % N);
    const pos = (i, rad) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    let out = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--bd)" stroke-width="2" stroke-dasharray="4 5"/>';
    const lab = {};
    (lab[m.front] = lab[m.front] || []).push('front');
    (lab[m.rear] = lab[m.rear] || []).push('rear');
    for (let i = 0; i < N; i++) {
      const [x, y] = pos(i, R), [ix, iy] = pos(i, R + r + 11), [lx, ly] = pos(i, R + r + 27);
      const changed = !st.idle && pm.arr && pm.arr[i] !== m.arr[i];
      out += '<circle class="ring-c' + (live.has(i) ? ' live' : '') + (changed ? ' flash' : '') + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>' +
        '<text class="rtxt" x="' + x + '" y="' + (y + 6) + '">' + (m.arr[i] == null ? '' : esc(m.arr[i])) + '</text>' +
        '<text class="ridx" x="' + ix + '" y="' + (iy + 4) + '">' + i + '</text>';
      if (lab[i]) out += '<text class="rlab" x="' + lx + '" y="' + (ly + 4) + '">' + lab[i].join(' · ') + '</text>';
    }
    out += '<text class="rtxt" x="' + cx + '" y="' + (cy - 4) + '" style="font-size:14px">size = ' + m.size + '</text>' +
      '<text class="ridx" x="' + cx + '" y="' + (cy + 16) + '">↻ جهت افزایش اندیس</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 310" width="300" height="273" role="img" aria-label="آرایه حلقوی">' + out + '</svg>';
  }

  /* ---------- رندر بخش‌ها ---------- */
  function renderStage(st, pv) {
    const draw = $('#draw'), ring = $('#ringWrap'), legend = $('#legend');
    if (S.impl === 'll') {
      draw.innerHTML = llSVG(st, pv); ring.innerHTML = '';
      legend.textContent = S.kind === 'stack'
        ? 'پشته با لیست پیوندی: درج و حذف همیشه از ابتدای لیست (head) انجام می‌شود. گره‌های جداافتاده (new / tmp) در ردیف پایین نمایش داده می‌شوند. اگر گره‌ها از صفحه بیرون زدند، بکشید (scroll).'
        : 'صف با لیست پیوندی: درج از انتها (tail) و حذف از ابتدا (head). نگه‌داشتن tail باعث می‌شود درج هم O(1) باشد. گره‌های جداافتاده در ردیف پایین‌اند.';
    } else {
      draw.innerHTML = arrSVG(st, pv);
      if (S.impl === 'circ') {
        ring.innerHTML = ringSVG(st, pv);
        legend.textContent = 'آرایه حلقوی: خانه‌های آبی عناصر فعلی‌اند. با عملگر % پس از آخرین خانه به خانه‌ی 0 برمی‌گردیم، پس هیچ فضایی هدر نمی‌رود. نمای حلقه‌ای همان آرایه است.';
      } else {
        ring.innerHTML = '';
        legend.textContent = S.kind === 'stack'
          ? 'پشته با آرایه: خانه‌های آبی عناصر پشته‌اند و top به آخرین عنصر اشاره می‌کند (top = -1 یعنی خالی).'
          : 'صف با آرایه ساده: خانه‌های آبی عناصر صف‌اند؛ خانه‌های خاکستری قبل از front فضای هدررفته‌اند. چند بار enqueue و dequeue کنید تا ببینید صف با وجود خانه‌ی خالی «پر» می‌شود — این انگیزه‌ی آرایه حلقوی است.';
      }
    }
    const b = $('#banner');
    if (st.err) { b.className = 'banner err'; b.textContent = 'خطا: ' + st.err; }
    else if (st.out != null) { b.className = 'banner ok'; b.textContent = 'مقدار بازگشتی: ' + st.out; }
    else { b.className = 'banner'; b.textContent = ''; }
  }

  function hl(line) {
    let s = esc(line), cm = '';
    const ci = s.indexOf('#');
    if (ci >= 0) { cm = '<span class="c">' + s.slice(ci) + '</span>'; s = s.slice(0, ci); }
    s = s.replace(/\b(def|if|else|raise|return|del|class|is|None)\b/g, '<span class="k">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="n">$1</span>')
      .replace(/\b(Node|push|pop|enqueue|dequeue|__init__)\b/g, '<span class="f">$1</span>');
    return s + cm;
  }

  function renderCode(st) {
    const list = ops();
    $('#codeTabs').innerHTML = list.map((o) => '<button data-op="' + o.id + '" class="' + (o.id === S.viewOp ? 'on' : '') + '">' + o.label + '</button>').join('');
    const op = list.find((o) => o.id === S.viewOp) || list[0];
    const active = (S.viewOp === S.runOp) && S.i >= 0 ? st.line : -999;
    /* وقتی پنجره‌ی Watch جمع است، مقدار متغیرهای خط جاری روی نوار هایلایت نوشته می‌شود */
    let iv = '';
    if (active >= 0 && document.querySelector('.tracebox').classList.contains('collapsed')) {
      const w = E.watch(st, key()), vals = Object.create(null), seen = new Set(), parts = [];
      w.g.concat(w.l).forEach(([n, v]) => { vals[n] = v; });
      (op.lines[active].replace(/#.*$/, '').match(/[A-Za-z_]\w*/g) || []).forEach((tk) => {
        if (tk in vals && !seen.has(tk)) { seen.add(tk); parts.push(tk + '=' + vals[tk]); }
      });
      parts.sort((a, b) => (a.indexOf('=[') > 0 ? 1 : 0) - (b.indexOf('=[') > 0 ? 1 : 0)); /* آرایه‌ی بلند آخر بیاید */
      if (parts.length) iv = '<span class="iv">▸ ' + esc(parts.join('   ')) + '</span>';
    }
    $('#code').innerHTML = op.lines.map((l, i) => '<span class="ln' + (i === active ? ' cur' : '') + '"><i>' + (i + 1) + '</i>' + hl(l) + (i === active ? iv : '') + '</span>').join('');
    $('#decl').innerHTML = E.decl(key(), S.N).split('\n').map(hl).join('\n');
  }

  /* مقدار متغیرها (Watch) به‌صورت فشرده؛ متغیر تغییرکرده نسبت به گام قبل زرد می‌شود */
  function wvHTML(step, prevStep, mark) {
    const k = key();
    const a = E.watch(step, k), p = E.watch(prevStep, k), pm = {};
    p.g.concat(p.l).forEach(([n, v]) => { pm[n] = v; });
    return a.g.concat(a.l).filter(([n]) => n !== 'N')
      .map(([n, v]) => '<span class="wv' + (mark && pm[n] !== v ? ' ch' : '') + '"><b>' + n + '</b>=' + esc(v) + '</span>').join('');
  }

  function renderTrace() {
    const box = $('#trace');
    const base = idleStep();
    let h = '<div class="tr th"><span>#</span><span>Trace ← Watch</span></div>';
    h += '<div class="tr' + (S.i < 0 ? ' cur' : '') + '"><span>0</span><code>initial state</code><span class="wvs">' + wvHTML(base, base, false) + '</span></div>';
    if (S.steps.length) {
      const op = ops().find((o) => o.id === S.runOp);
      for (let j = 0; j <= S.i; j++) {
        const s = S.steps[j], pv = j > 0 ? S.steps[j - 1] : base;
        const code = s.line < 0 ? '— end of function' : (s.line + 1) + ':  ' + op.lines[s.line].replace(/\s*#.*$/, '').trim();
        h += '<div class="tr' + (j === S.i ? ' cur' : '') + '"><span>' + (j + 1) + '</span><code>' + esc(code) + '</code><span class="wvs">' + wvHTML(s, pv, true) + '</span></div>';
      }
    }
    box.innerHTML = h;
    const c = box.querySelector('.cur');
    if (c) box.scrollTop = Math.max(0, c.offsetTop - box.clientHeight + c.offsetHeight + 6);
  }

  function renderCtrl() {
    const n = S.steps.length, has = n > 0;
    $('#bFirst').disabled = !has || S.i <= -1;
    $('#bPrev').disabled = !has || S.i <= -1;
    $('#bNext').disabled = !has || S.i >= n - 1;
    $('#bLast').disabled = !has || S.i >= n - 1;
    $('#bPlay').disabled = !has;
    $('#bPlay').textContent = S.timer ? '⏸ توقف' : '▶ پخش';
    $('#counter').textContent = has ? 'گام ' + (S.i + 1) + ' از ' + n : 'هنوز عملیاتی اجرا نشده';
    const st = S.i < 0 ? null : S.steps[S.i];
    $('#note').textContent = st ? st.note : (has ? 'وضعیت پیش از شروع تابع. «بعدی» را بزنید.' : 'یک عملیات را انتخاب کنید (مثلاً درج). سپس با «بعدی» یا «پخش» اجرای شبه‌کد را خط‌به‌خط دنبال کنید.');
  }

  function renderModes() {
    document.querySelectorAll('#segKind button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.kind));
    document.querySelectorAll('#segImpl button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === S.impl);
      if (b.dataset.v === 'circ') b.disabled = S.kind === 'stack';
    });
    $('#capRow').style.display = S.impl === 'll' ? 'none' : '';
    const [a, b] = ops();
    $('#btnA').textContent = FA[a.id]; $('#btnB').textContent = FA[b.id];
  }

  function render() {
    const st = cur(), pv = prev();
    renderModes(); renderStage(st, pv); renderCode(st); renderTrace(); renderCtrl();
  }

  /* ---------- رویدادها ---------- */
  $('#segKind').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.kind = b.dataset.v;
    if (S.kind === 'stack' && S.impl === 'circ') { S.impl = 'arr'; toast('پشته به آرایه حلقوی نیاز ندارد؛ به «آرایه ساده» تغییر کرد.'); }
    reset();
  });
  $('#segImpl').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    S.impl = b.dataset.v; reset();
  });
  $('#cap').addEventListener('change', (e) => { S.N = +e.target.value; reset(); });
  $('#btnA').addEventListener('click', () => startOp(ops()[0].id));
  $('#btnB').addEventListener('click', () => startOp(ops()[1].id));
  $('#btnReset').addEventListener('click', reset);
  $('#bFirst').addEventListener('click', first);
  $('#bPrev').addEventListener('click', () => { stop(); back(); });
  $('#bNext').addEventListener('click', () => { stop(); next(); });
  $('#bLast').addEventListener('click', last);
  $('#bPlay').addEventListener('click', play);
  $('#speed').addEventListener('input', (e) => {
    S.speed = +e.target.value;
    if (S.timer) { clearInterval(S.timer); S.timer = setInterval(next, S.speed); }
  });
  $('#codeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.viewOp = b.dataset.op; renderCode(cur());
  });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) return;
    if (e.key === 'ArrowRight') { stop(); next(); }
    else if (e.key === 'ArrowLeft') { stop(); back(); }
    else if (e.key === ' ') { e.preventDefault(); play(); }
  });

  /* ---------- PWA ---------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e; $('#installBtn').hidden = false;
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true;
  });

  /* ---------- دستگیره‌ی تغییر عرض کد / گرافیک (حالت افقی) ---------- */
  const mainEl = $('#main'), handle = $('#handle');
  function setCW(p, save) {
    p = Math.min(60, Math.max(15, p));
    mainEl.style.setProperty('--cw', p + '%');
    handle.setAttribute('aria-valuenow', String(Math.round(p)));
    S.cw = p;
    if (save) { try { localStorage.setItem('ds_cw', String(p)); } catch (e) { /* ignore */ } }
  }
  let saved = NaN;
  try { saved = parseFloat(localStorage.getItem('ds_cw')); } catch (e) { /* ignore */ }
  setCW(saved >= 15 && saved <= 60 ? saved : 30, false);
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true; document.body.classList.add('dragging');
    if (handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = mainEl.getBoundingClientRect();
    setCW((e.clientX - r.left) / r.width * 100, false);
  });
  const endDrag = () => { if (!dragging) return; dragging = false; document.body.classList.remove('dragging'); setCW(S.cw, true); };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('dblclick', () => setCW(30, true));
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation();
      setCW(S.cw + (e.key === 'ArrowRight' ? 2 : -2), true);
    }
  });

  /* ---------- جمع/باز کردن ناحیه‌ی Trace ---------- */
  function toggleTrace() {
    const t = document.querySelector('.tracebox');
    t.classList.toggle('collapsed');
    $('#trTog').textContent = t.classList.contains('collapsed') ? '▸' : '▾';
    renderCode(cur());
  }
  $('#trHead').addEventListener('click', toggleTrace);
  $('#trHead').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleTrace(); } });

  /* اسکرول‌بار فقط هنگام اسکرول دیده می‌شود */
  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? document.documentElement : e.target;
    if (!el || !el.classList) return;
    el.classList.add('sb-on');
    clearTimeout(el._sbT);
    el._sbT = setTimeout(() => el.classList.remove('sb-on'), 900);
  }, true);

  window.appToast = toast;
  reset();
})();
