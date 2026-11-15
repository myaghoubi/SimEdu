/* کتابخانه‌ی مشترک شبیه‌سازهای گام‌به‌گام
   چیدمان استاندارد (کد پایتون + Trace/Watch در ستون چپ، ناحیه‌ی گرافیکی در راست، دستگیره‌ی تغییر عرض،
   نوار کنترل پایین) و منطق اجرای گام‌به‌گام (قبلی/بعدی/پخش، هایلایت خط، مقدار متغیرها روی نوار کد).
   شبیه‌ساز فقط گام‌ها و نقاشی ناحیه‌ی گرافیکی را فراهم می‌کند.

   Stepper.layout(stageHTML, { codeNote })           ← HTML بخش اصلی + نوار کنترل
   Stepper.create(view, options) → controller
     options.getCode()    → { tabs:[{id,label}], tab, lines:[...], decl:'متن' }
     options.idle()       → گامِ «پیش از اجرا» (حداقل { line:-1, note:'' } + داده‌ی مخصوص شبیه‌ساز)
     options.render(step, prevStep)   ← نقاشی ناحیه‌ی گرافیکی
     options.watch(step)  → [[name, value], ...]  (مقدار متغیرها پس از اجرای آن گام)
     options.onTab(id)    ← کاربر روی یکی از زبانه‌های کد زد (اختیاری)
     options.hint         ← متن راهنما وقتی هنوز اجرایی شروع نشده
   controller.setSteps(steps, tabId, lines) / .refresh() / .stop() / .destroy()
   هر گام: { line, note, ... }  — line = شماره‌ی خط اجراشده (از ۰) یا -1 برای «پایان تابع» */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* رنگ‌آمیزی ساده‌ی پایتون */
  function hl(line) {
    let s = esc(line), cm = '';
    const ci = s.indexOf('#');
    if (ci >= 0) { cm = '<span class="c">' + s.slice(ci) + '</span>'; s = s.slice(0, ci); }
    s = s.replace(/('[^']*')/g, '<span class="s">$1</span>')
      .replace(/\b(def|if|else|elif|for|in|not|while|return|raise|del|class|is|None|and|or)\b/g, '<span class="k">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="n">$1</span>')
      .replace(/\b(Node|bfs|dfs|push|pop|append|add|reversed|set|enqueue|dequeue|__init__)\b/g, '<span class="f">$1</span>');
    return s + cm;
  }

  function layout(stageHTML, o) {
    o = o || {};
    const note = o.codeNote || 'خط هایلایت‌شده «همین الان اجرا شد» و تصویر، نتیجه‌ی آن است.';
    return `
  <main class="main" id="main">
    <div class="left" id="paneLeft">
    <section class="card pane-code" id="paneCode">
      <div class="tabs" id="codeTabs"></div>
      <details id="declBox"><summary>تعریف داده‌ها (پیش از اجرا)</summary><pre class="code" id="decl"></pre></details>
      <pre class="code" id="code"></pre>
      <div class="legend">${note}</div>
    </section>
    <section class="card tracebox">
      <div class="trhead" id="trHead" role="button" tabindex="0" title="باز و بسته کردن"><b><span id="trTog">▾</span> Trace و Watch</b><span class="legend">هر خط: دستور اجراشده + مقدار متغیرها بعد از آن · متغیر تغییرکرده زرد است</span></div>
      <div class="trlist" id="trace"></div>
    </section>
    </div>

    <div class="handle" id="handle" role="separator" aria-orientation="vertical" tabindex="0"
         aria-label="تغییر عرض ناحیه‌ی کد و ناحیه‌ی گرافیکی (دوبار کلیک: بازگشت به ۳۰٪)" aria-valuemin="15" aria-valuemax="60" aria-valuenow="30"></div>

    <div class="pane-gfx">
      <section class="card stage" id="stage">${stageHTML}</section>
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
      <label class="spd">سرعت <input type="range" id="speed" min="250" max="2000" step="50" value="900"></label>
    </div>
  </footer>`;
  }


  /* اسکرول نرم: فقط وقتی سطر جاری از ناحیه‌ی قابل‌مشاهده خارج شده باشد، نرم جابه‌جا می‌شود تا دیده شود */
  function revealRow(box, c) { window.Follow.revealRow(box, c); }

  function create(view, o) {
    const $ = (s) => view.querySelector(s);
    const S = { steps: [], i: -1, tab: null, lines: [], timer: null, speed: 900, cw: 30 };
    const idle = () => o.idle();
    const cur = () => (S.i < 0 ? idle() : S.steps[S.i]);
    const prev = () => (S.i > 0 ? S.steps[S.i - 1] : idle());

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

    /* ---------- کد ---------- */
    function renderCode(st) {
      const code = o.getCode();
      const tabs = $('#codeTabs');
      tabs.style.display = code.tabs && code.tabs.length ? '' : 'none';
      tabs.innerHTML = (code.tabs || []).map((t) => '<button data-tab="' + esc(t.id) + '" class="' + (t.id === code.tab ? 'on' : '') + '">' + esc(t.label) + '</button>').join('');
      const active = (S.i >= 0 && code.tab === S.tab) ? st.line : -999;
      /* وقتی پنجره‌ی Watch جمع است، مقدار متغیرهای خط جاری روی نوار هایلایت نوشته می‌شود */
      let iv = '';
      if (active >= 0 && $('.tracebox').classList.contains('collapsed')) {
        const vals = Object.create(null), seen = new Set(), parts = [];
        o.watch(st).forEach(([n, v]) => { vals[n] = v; });
        (code.lines[active].replace(/#.*$/, '').match(/[A-Za-z_]\w*/g) || []).forEach((tk) => {
          if (tk in vals && !seen.has(tk)) { seen.add(tk); parts.push(tk + '=' + vals[tk]); }
        });
        parts.sort((a, b) => (a.indexOf('=[') > 0 ? 1 : 0) - (b.indexOf('=[') > 0 ? 1 : 0));
        if (parts.length) iv = '<span class="iv">▸ ' + esc(parts.join('   ')) + '</span>';
      }
      $('#code').innerHTML = code.lines.map((l, i) => '<span class="ln' + (i === active ? ' cur' : '') + '"><i>' + (i + 1) + '</i>' + hl(l) + (i === active ? iv : '') + '</span>').join('');
      $('#decl').innerHTML = String(code.decl || '').split('\n').map(hl).join('\n');
      if (active >= 0) window.Follow.revealLine($('#code').querySelector('.ln.cur'));
    }

    /* ---------- Trace + Watch در یک خط ---------- */
    function wvHTML(step, prevStep, mark) {
      const a = o.watch(step), pm = {};
      o.watch(prevStep).forEach(([n, v]) => { pm[n] = v; });
      return a.map(([n, v]) => '<span class="wv' + (mark && pm[n] !== v ? ' ch' : '') + '"><b>' + esc(n) + '</b>=' + esc(v) + '</span>').join('');
    }
    function renderTrace() {
      const box = $('#trace'), base = idle();
      let h = '<div class="tr th"><span>#</span><span>Trace ← Watch</span></div>';
      h += '<div class="tr' + (S.i < 0 ? ' cur' : '') + '"><span>0</span><code>initial state</code><span class="wvs">' + wvHTML(base, base, false) + '</span></div>';
      for (let j = 0; j <= S.i; j++) {
        const s = S.steps[j], pv = j > 0 ? S.steps[j - 1] : base;
        const code = s.line < 0 ? '— end of function' : (s.line + 1) + ':  ' + (S.lines[s.line] || '').replace(/\s*#.*$/, '').trim();
        h += '<div class="tr' + (j === S.i ? ' cur' : '') + '"><span>' + (j + 1) + '</span><code>' + esc(code) + '</code><span class="wvs">' + wvHTML(s, pv, true) + '</span></div>';
      }
      box.innerHTML = h;
      const c = box.querySelector('.cur');
      if (c) revealRow(box, c);
    }

    /* ---------- نوار کنترل ---------- */
    function renderCtrl() {
      const n = S.steps.length, has = n > 0;
      $('#bFirst').disabled = !has || S.i <= -1;
      $('#bPrev').disabled = !has || S.i <= -1;
      $('#bNext').disabled = !has || S.i >= n - 1;
      $('#bLast').disabled = !has || S.i >= n - 1;
      $('#bPlay').disabled = !has;
      $('#bPlay').textContent = S.timer ? '⏸ توقف' : '▶ پخش';
      $('#counter').textContent = has ? 'گام ' + (S.i + 1) + ' از ' + n : 'اجرایی آماده نیست';
      const st = S.i < 0 ? null : S.steps[S.i];
      $('#note').textContent = st ? st.note : (has ? 'وضعیت پیش از شروع. «بعدی» را بزنید.' : (o.hint || ''));
    }

    function render() {
      const st = cur(), pv = prev();
      o.render(st, pv); renderCode(st); renderTrace(); renderCtrl();
    }

    /* ---------- رویدادها ---------- */
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
      if (o.onTab) o.onTab(b.dataset.tab);
      renderCode(cur());
    });
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight') { stop(); next(); }
      else if (e.key === 'ArrowLeft') { stop(); back(); }
      else if (e.key === ' ') { e.preventDefault(); play(); }
    };
    document.addEventListener('keydown', onKey);

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

    if (o.traceOpen === false) { $('.tracebox').classList.add('collapsed'); $('#trTog').textContent = '▸'; }

    /* ---------- جمع/باز کردن ناحیه‌ی Trace ---------- */
    function toggleTrace() {
      const t = $('.tracebox');
      t.classList.toggle('collapsed');
      $('#trTog').textContent = t.classList.contains('collapsed') ? '▸' : '▾';
      renderCode(cur());
    }
    $('#trHead').addEventListener('click', toggleTrace);
    $('#trHead').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleTrace(); } });

    return {
      setSteps(steps, tab, lines) { stop(); S.steps = steps; S.i = -1; S.tab = tab; S.lines = lines; render(); },
      refresh: render,
      stop,
      get index() { return S.i; },
      get count() { return S.steps.length; },
      destroy() {
        if (S.timer) { clearInterval(S.timer); S.timer = null; }
        document.removeEventListener('keydown', onKey);
        document.body.classList.remove('dragging');
      }
    };
  }

  window.Stepper = { esc, hl, layout, create };
})();
