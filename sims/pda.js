/* شبیه‌ساز ماشین پشته‌ای (PDA) — درس نظریه‌ی زبان‌ها و ماشین‌ها
   رسم نمودار حالت + اجرای گام‌به‌گام روی رشته‌ی ورودی (غیرقطعی با جست‌وجوی BFS). */
(function () {
'use strict';
const A = window.Automata, esc = A.esc;
const EPS = ['ε', 'eps', 'epsilon', 'λ'];

const E = {
  maxNodes: 30000, maxDepth: 400,
  init: (P) => ({ q: P.start, i: 0, s: '$' }),
  key: (c) => c.q + '|' + c.i + '|' + c.s,
  next(P, c, input) {
    const out = [];
    for (const tr of P.out[c.q] || []) {
      if (tr.a !== '' && input[c.i] !== tr.a) continue;
      if (tr.b !== '' && c.s[0] !== tr.b) continue;
      const s = tr.c + c.s.slice(tr.b.length);
      if (s.length > 80) continue;                         /* جلوگیری از رشد بی‌پایان پشته با گذارهای ε */
      out.push({ cfg: { q: tr.to, i: c.i + tr.a.length, s }, tr });
    }
    return out;
  },
  accepting: (P, c, input, opt) => c.i === input.length && (opt.mode === 'empty' ? c.s === '' : !!P.accept[c.q]),
  rank: (c, d) => c.i * 1000 - d,
  state: (c) => c.q,
  line: (c, input) => c.q + '   ⟨' + (input.slice(c.i) || 'ε') + '⟩   [' + (c.s || 'ε') + ']',
  panel(c, input) {
    const i = c ? c.i : -1, s = c ? c.s : '$';
    const tape = input.length ? A.cells([...input], i < input.length ? i : -1, Math.max(i, 0)) : '<span class="acell empty">ε</span>';
    const stack = s.length ? [...s].map((x, k) => '<span class="acell' + (k === 0 ? ' top' : '') + '">' + esc(x) + '</span>').join('') : '<span class="acell empty">خالی</span>';
    return '<div class="am-line"><span class="lbl">حالت</span><b style="font-family:var(--mono)">' + (c ? esc(c.q) : '—') + '</b></div>' +
      '<div class="am-line"><span class="lbl">ورودی</span><div class="atape">' + tape + '</div></div>' +
      '<div class="am-line"><span class="lbl">پشته<br><small>(بالا ← پایین)</small></span><div class="astack">' + stack + '</div></div>';
  }
};

const K = {
  kind: 'pda', engine: E,
  inputLabel: 'رشته‌ی ورودی',
  limitText: 'جست‌وجو ۳۰٬۰۰۰ پیکربندی / عمق ۴۰۰',
  idleNote: 'ماشین را رسم کنید (یا نمونه انتخاب کنید)، رشته را بنویسید و «بعدی» یا «پخش» را بزنید. پشته در آغاز فقط $ دارد.',
  rejectWhy: () => 'هیچ مسیر محاسبه‌ای به پذیرش نرسید (دورترین پیشروی در ورودی نمایش داده شده است).',
  dialogHint: 'هر گذار: «نماد خوانده‌شده ، نماد pop ← رشته‌ی push». خالی = ε. در push چپ‌ترین نماد بالای پشته می‌رود.',
  fields: [
    { k: 'a', ph: 'ε' },
    { k: 'b', ph: 'ε', sep: ',' },
    { k: 'c', ph: 'ε', sep: '→' }
  ],
  blankRow: () => ({ a: '', b: '', c: '' }),
  norm(t) { ['a', 'b', 'c'].forEach((k) => { t[k] = String(t[k] || '').trim(); if (EPS.includes(t[k].toLowerCase())) t[k] = ''; }); return t; },
  validate(t) {
    if ([...t.a].length > 1) return 'نماد خوانده‌شده از ورودی باید حداکثر یک نماد باشد.';
    if ([...t.b].length > 1) return 'نماد pop باید حداکثر یک نماد باشد.';
    if (/\s/.test(t.c)) return 'رشته‌ی push نباید فاصله داشته باشد.';
    return null;
  },
  fmt: (t) => (t.a || 'ε') + ', ' + (t.b || 'ε') + ' → ' + (t.c || 'ε'),
  defaultOpt: () => ({ mode: 'final' }),
  optionsHTML: '<span class="lbl">پذیرش</span><select id="amMode"><option value="final">با حالت پایانی</option><option value="empty">با پشته‌ی خالی</option></select>',
  bindOptions(view, S, changed) { view.querySelector('#amMode').addEventListener('change', (e) => { S.opt.mode = e.target.value; changed(); }); },
  syncOptions(view, S) { view.querySelector('#amMode').value = S.opt.mode || 'final'; },
  presets: [
    { name: 'نمونه ۱ — aⁿbⁿ  (n ≥ 0)',
      states: [{ id: 'q0', x: 100, y: 150, start: 1 }, { id: 'q1', x: 320, y: 150 }, { id: 'q2', x: 520, y: 260, accept: 1 }],
      trans: [{ from: 'q0', to: 'q0', a: 'a', b: '', c: 'A' }, { from: 'q0', to: 'q1', a: 'b', b: 'A', c: '' },
        { from: 'q1', to: 'q1', a: 'b', b: 'A', c: '' }, { from: 'q1', to: 'q2', a: '', b: '$', c: '' }, { from: 'q0', to: 'q2', a: '', b: '$', c: '' }],
      tests: ['aabb', 'aaabbb', '', 'aab', 'abab', 'ba'] },
    { name: 'نمونه ۲ — پالیندروم زوج wwᴿ (غیرقطعی)',
      states: [{ id: 'q0', x: 100, y: 170, start: 1 }, { id: 'q1', x: 320, y: 170 }, { id: 'q2', x: 530, y: 170, accept: 1 }],
      trans: [{ from: 'q0', to: 'q0', a: 'a', b: '', c: 'a' }, { from: 'q0', to: 'q0', a: 'b', b: '', c: 'b' },
        { from: 'q0', to: 'q1', a: '', b: '', c: '' },
        { from: 'q1', to: 'q1', a: 'a', b: 'a', c: '' }, { from: 'q1', to: 'q1', a: 'b', b: 'b', c: '' },
        { from: 'q1', to: 'q2', a: '', b: '$', c: '' }],
      tests: ['abba', 'aabbaa', 'abab', '', 'aba'] },
    { name: 'نمونه ۳ — پرانتزهای متوازن',
      states: [{ id: 'q0', x: 160, y: 180, start: 1 }, { id: 'q1', x: 460, y: 180, accept: 1 }],
      trans: [{ from: 'q0', to: 'q0', a: '(', b: '', c: 'P' }, { from: 'q0', to: 'q0', a: ')', b: 'P', c: '' },
        { from: 'q0', to: 'q1', a: '', b: '$', c: '' }],
      tests: ['(())()', '(()', '())(', ''] }
  ]
};

window.Shell.register({
  id: 'pda',
  title: 'شبیه‌ساز ماشین پشته‌ای (PDA)',
  subtitle: 'رسم نمودار حالت و اجرای گام‌به‌گام روی رشته',
  css: A.CSS,
  html: A.html(K),
  mount: (view) => A.mount(view, K),
  engine: { E, K }
});
})();
