/* شبیه‌ساز ماشین تورینگ — درس نظریه‌ی زبان‌ها و ماشین‌ها
   رسم نمودار حالت + اجرای گام‌به‌گام روی نوار (نوار دوطرفه‌ی نامحدود، نماد تهی «_»). */
(function () {
'use strict';
const A = window.Automata, esc = A.esc;

const E = {
  maxNodes: 20000, maxDepth: 2000,
  init(P, input) { return { q: P.start, t: input === '' ? '_' : input, h: 0, o: 0 }; },
  key: (c) => c.q + '|' + c.h + '|' + c.o + '|' + c.t,
  next(P, c) {
    const out = [];
    for (const tr of P.out[c.q] || []) {
      if (tr.a !== c.t[c.h]) continue;
      let t = c.t.slice(0, c.h) + tr.b + c.t.slice(c.h + 1), h = c.h, o = c.o;
      if (tr.c === 'R') { h++; if (h >= t.length) t += '_'; }
      else if (tr.c === 'L') { h--; if (h < 0) { t = '_' + t; h = 0; o--; } }
      out.push({ cfg: { q: tr.to, t, h, o }, tr });
    }
    return out;
  },
  accepting: (P, c) => !!P.accept[c.q],
  rank: (c, d) => d,
  state: (c) => c.q,
  line: (c) => c.q + '   ' + c.t.slice(0, c.h) + '[' + c.t[c.h] + ']' + c.t.slice(c.h + 1),
  panel(c, input) {
    const t = c ? c.t : (input === '' ? '_' : input), h = c ? c.h : 0;
    const arr = ['_', ...t, '_'];
    return '<div class="am-line"><span class="lbl">حالت</span><b style="font-family:var(--mono)">' + (c ? esc(c.q) : '—') + '</b></div>' +
      '<div class="am-line"><span class="lbl">نوار</span><div class="atape">' + A.cells(arr, c ? h + 1 : -1) + '</div></div>' +
      '<div class="am-hint">□ = نماد تهی (_) · نوار در دو طرف نامحدود است · ماشین با رسیدن به حالت پایانی می‌پذیرد و اگر گذاری نباشد رد می‌کند.</div>';
  }
};

const K = {
  kind: 'tm', engine: E,
  inputLabel: 'محتوای نوار',
  limitText: 'حداکثر ۲۰۰۰ گام',
  idleNote: 'ماشین را رسم کنید (یا نمونه انتخاب کنید)، محتوای نوار را بنویسید و «بعدی» یا «پخش» را بزنید. سر ماشین روی اولین نماد است.',
  rejectWhy: (r) => {
    const c = r.path[r.path.length - 1].cfg;
    return 'ماشین در حالت ' + c.q + ' روی نماد «' + (c.t[c.h] === '_' ? '□' : c.t[c.h]) + '» گذاری ندارد.';
  },
  dialogHint: 'هر گذار: «نماد خوانده‌شده ← نماد نوشته‌شده ، جهت حرکت». نماد تهی = _ ، جهت‌ها: L چپ، R راست، S ایستادن.',
  fields: [
    { k: 'a', ph: '_', blank: true },
    { k: 'b', ph: '_', sep: '→', blank: true },
    { k: 'c', type: 'move', sep: ',' }
  ],
  blankRow: () => ({ a: '', b: '', c: 'R' }),
  norm(t) {
    ['a', 'b'].forEach((k) => { t[k] = String(t[k] || '').trim(); if (t[k] === '' || t[k] === '□') t[k] = '_'; });
    t.c = String(t.c || 'R').toUpperCase();
    return t;
  },
  validate(t) {
    if ([...t.a].length !== 1 || [...t.b].length !== 1) return 'نماد خوانده‌شده و نوشته‌شده هرکدام باید دقیقاً یک نماد باشند.';
    if (!['L', 'R', 'S'].includes(t.c)) return 'جهت باید L، R یا S باشد.';
    return null;
  },
  fmt: (t) => (t.a === '_' ? '□' : t.a) + ' → ' + (t.b === '_' ? '□' : t.b) + ', ' + t.c,
  presets: [
    { name: 'نمونه ۱ — aⁿbⁿ  (n ≥ 1)',
      states: [{ id: 'q0', x: 70, y: 170, start: 1 }, { id: 'q1', x: 240, y: 90 }, { id: 'q2', x: 240, y: 240 }, { id: 'q3', x: 430, y: 100 }, { id: 'q4', x: 570, y: 230, accept: 1 }],
      trans: [{ from: 'q0', to: 'q1', a: 'a', b: 'X', c: 'R' },
        { from: 'q1', to: 'q1', a: 'a', b: 'a', c: 'R' }, { from: 'q1', to: 'q1', a: 'Y', b: 'Y', c: 'R' },
        { from: 'q1', to: 'q2', a: 'b', b: 'Y', c: 'L' },
        { from: 'q2', to: 'q2', a: 'a', b: 'a', c: 'L' }, { from: 'q2', to: 'q2', a: 'Y', b: 'Y', c: 'L' },
        { from: 'q2', to: 'q0', a: 'X', b: 'X', c: 'R' },
        { from: 'q0', to: 'q3', a: 'Y', b: 'Y', c: 'R' }, { from: 'q3', to: 'q3', a: 'Y', b: 'Y', c: 'R' },
        { from: 'q3', to: 'q4', a: '_', b: '_', c: 'R' }],
      tests: ['aabb', 'aaabbb', 'aab', 'abb', 'abab'] },
    { name: 'نمونه ۲ — افزایش یک واحد به عدد دودویی',
      states: [{ id: 'q0', x: 90, y: 180, start: 1 }, { id: 'q1', x: 310, y: 180 }, { id: 'q2', x: 520, y: 180, accept: 1 }],
      trans: [{ from: 'q0', to: 'q0', a: '0', b: '0', c: 'R' }, { from: 'q0', to: 'q0', a: '1', b: '1', c: 'R' },
        { from: 'q0', to: 'q1', a: '_', b: '_', c: 'L' },
        { from: 'q1', to: 'q1', a: '1', b: '0', c: 'L' },
        { from: 'q1', to: 'q2', a: '0', b: '1', c: 'S' }, { from: 'q1', to: 'q2', a: '_', b: '1', c: 'S' }],
      tests: ['1011', '111', '0', '1000'] }
  ]
};

window.Shell.register({
  id: 'turing',
  title: 'شبیه‌ساز ماشین تورینگ',
  subtitle: 'رسم نمودار حالت و اجرای گام‌به‌گام روی نوار',
  css: A.CSS,
  html: A.html(K),
  mount: (view) => A.mount(view, K),
  engine: { E, K }
});
})();
