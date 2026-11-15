/* شبیه‌ساز پشته و صف — درس ساختمان داده‌ها و الگوریتم‌ها
   فایل مستقل: موتور شبیه‌سازی + استایل + قالب + رابط. با Shell.register به برنامه معرفی می‌شود
   و هنگام انتخاب از منوی اصلی در صفحه بارگذاری می‌شود. */
(function () {
'use strict';

/* ===================== موتور شبیه‌سازی (بدون وابستگی به DOM) ===================== */
/* موتور شبیه‌سازی پشته و صف — بدون وابستگی به DOM
   هر عملیات به آرایه‌ای از «گام» تبدیل می‌شود؛ هر گام شامل:
   line: شماره خط شبه‌کد (-1 = پایان تابع)، note: توضیح فارسی،
   snap: عکس کامل ساختار داده بعد از اجرای آن خط، loc: متغیرهای محلی، out/err */
const Engine = (function (root) {

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const repr = (v) => (v == null ? 'None' : (/^-?\d+(\.\d+)?$/.test(String(v)) ? String(v) : "'" + v + "'"));

  /* ---------- وضعیت اولیه ---------- */
  function initState(impl, kind, N) {
    if (impl === 'll') return { impl, kind, N, nodes: {}, nextId: 1, head: null, tail: null };
    const arr = Array(N).fill(null);
    if (impl === 'arr') {
      return kind === 'stack' ? { impl, kind, N, arr, top: -1 } : { impl, kind, N, arr, front: 0, rear: -1 };
    }
    return { impl, kind, N, arr, front: 0, rear: N - 1, size: 0 };
  }

  function newNode(m, val) {
    const id = m.nextId++;
    m.nodes[id] = { val, next: null };
    return id;
  }

  /* گره‌های قابل دسترس از head به ترتیب */
  function chain(m) {
    const out = [];
    let id = m.head, guard = 0;
    while (id != null && m.nodes[id] && guard++ < 200) { out.push(id); id = m.nodes[id].next; }
    return out;
  }

  /* ---------- شبه‌کد ---------- */
  const NODE_DECL = 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n';

  function decl(key, N) {
    switch (key) {
      case 'll-stack': return NODE_DECL + '\nhead = None            # بالای پشته (top)';
      case 'll-queue': return NODE_DECL + '\nhead = None            # ابتدای صف (front)\ntail = None            # انتهای صف (rear)';
      case 'arr-stack': return 'N = ' + N + '\narr = [None] * N\ntop = -1               # اندیس بالای پشته';
      case 'arr-queue': return 'N = ' + N + '\narr = [None] * N\nfront = 0              # اندیس اولین عنصر\nrear = -1              # اندیس آخرین عنصر';
      case 'circ-queue': return 'N = ' + N + '\narr = [None] * N\nfront = 0              # اندیس اولین عنصر\nrear = N - 1           # اندیس آخرین عنصر\nsize = 0               # تعداد عناصر فعلی';
    }
    return '';
  }

  const OPS = {
    'll-stack': [
      { id: 'push', label: 'push(x)', takesArg: true, lines: [
        'def push(x):',
        '    new = Node(x)',
        '    new.next = head',
        '    head = new'] },
      { id: 'pop', label: 'pop()', takesArg: false, lines: [
        'def pop():',
        '    if head is None:',
        '        raise Underflow       # پشته خالی',
        '    tmp = head',
        '    x = tmp.val',
        '    head = head.next',
        '    del tmp',
        '    return x'] }
    ],
    'll-queue': [
      { id: 'enqueue', label: 'enqueue(x)', takesArg: true, lines: [
        'def enqueue(x):',
        '    new = Node(x)',
        '    if tail is None:          # صف خالی',
        '        head = tail = new',
        '    else:',
        '        tail.next = new',
        '        tail = new'] },
      { id: 'dequeue', label: 'dequeue()', takesArg: false, lines: [
        'def dequeue():',
        '    if head is None:',
        '        raise Underflow       # صف خالی',
        '    tmp = head',
        '    x = tmp.val',
        '    head = head.next',
        '    if head is None:          # آخرین عنصر حذف شد',
        '        tail = None',
        '    del tmp',
        '    return x'] }
    ],
    'arr-stack': [
      { id: 'push', label: 'push(x)', takesArg: true, lines: [
        'def push(x):',
        '    if top == N - 1:',
        '        raise Overflow        # پشته پر',
        '    top = top + 1',
        '    arr[top] = x'] },
      { id: 'pop', label: 'pop()', takesArg: false, lines: [
        'def pop():',
        '    if top == -1:',
        '        raise Underflow       # پشته خالی',
        '    x = arr[top]',
        '    arr[top] = None',
        '    top = top - 1',
        '    return x'] }
    ],
    'arr-queue': [
      { id: 'enqueue', label: 'enqueue(x)', takesArg: true, lines: [
        'def enqueue(x):',
        '    if rear == N - 1:',
        '        raise Overflow        # صف پر',
        '    rear = rear + 1',
        '    arr[rear] = x'] },
      { id: 'dequeue', label: 'dequeue()', takesArg: false, lines: [
        'def dequeue():',
        '    if front > rear:',
        '        raise Underflow       # صف خالی',
        '    x = arr[front]',
        '    arr[front] = None',
        '    front = front + 1',
        '    return x'] }
    ],
    'circ-queue': [
      { id: 'enqueue', label: 'enqueue(x)', takesArg: true, lines: [
        'def enqueue(x):',
        '    if size == N:',
        '        raise Overflow        # صف پر',
        '    rear = (rear + 1) % N',
        '    arr[rear] = x',
        '    size = size + 1'] },
      { id: 'dequeue', label: 'dequeue()', takesArg: false, lines: [
        'def dequeue():',
        '    if size == 0:',
        '        raise Underflow       # صف خالی',
        '    x = arr[front]',
        '    arr[front] = None',
        '    front = (front + 1) % N',
        '    size = size - 1',
        '    return x'] }
    ]
  };

  /* ---------- پیاده‌سازی گام‌ها ---------- */
  const IMPL = {};

  IMPL['ll-stack'] = {
    push({ m, loc, rec, x }) {
      loc.x = x; rec(0, 'فراخوانی push(' + repr(x) + ')؛ پارامتر x = ' + repr(x));
      loc.new = newNode(m, x);
      rec(1, 'گره جدید با مقدار ' + repr(x) + ' ساخته شد؛ هنوز به لیست وصل نیست (پایین‌تر نمایش داده می‌شود).');
      m.nodes[loc.new].next = m.head;
      rec(2, m.head == null ? 'next گره جدید = None (پشته خالی بود).' : 'next گره جدید به گره‌ی فعلیِ head وصل شد.');
      m.head = loc.new;
      rec(3, 'head به گره جدید اشاره می‌کند؛ گره جدید اکنون بالای پشته (top) است. O(1)');
    },
    pop({ m, loc, rec, res }) {
      rec(0, 'فراخوانی pop()');
      if (m.head == null) {
        rec(1, 'head is None ؟ درست → پشته خالی است.');
        res.err = 'Underflow';
        rec(2, 'خطای Underflow: پشته خالی است و pop ممکن نیست.');
        return;
      }
      rec(1, 'head is None ؟ نادرست → پشته خالی نیست؛ ادامه می‌دهیم.');
      loc.tmp = m.head; rec(3, 'tmp به همان گره‌ی بالای پشته اشاره می‌کند.');
      loc.x = m.nodes[loc.tmp].val; rec(4, 'مقدار گره ذخیره شد: x = ' + repr(loc.x));
      m.head = m.nodes[loc.tmp].next; rec(5, 'head به گره بعدی منتقل شد؛ گره tmp از لیست جدا شد.');
      delete m.nodes[loc.tmp]; delete loc.tmp;
      rec(6, 'نام tmp حذف شد و گره‌ی جداشده آزاد می‌شود (garbage collection).');
      res.out = loc.x; rec(7, 'مقدار ' + repr(loc.x) + ' برگردانده می‌شود.');
    }
  };

  IMPL['ll-queue'] = {
    enqueue({ m, loc, rec, x }) {
      loc.x = x; rec(0, 'فراخوانی enqueue(' + repr(x) + ')؛ پارامتر x = ' + repr(x));
      loc.new = newNode(m, x);
      rec(1, 'گره جدید با مقدار ' + repr(x) + ' ساخته شد؛ هنوز به لیست وصل نیست.');
      if (m.tail == null) {
        rec(2, 'tail is None ؟ درست → صف خالی است.');
        m.head = m.tail = loc.new;
        rec(3, 'head و tail هر دو به گره جدید اشاره می‌کنند.');
      } else {
        rec(2, 'tail is None ؟ نادرست → صف خالی نیست.');
        m.nodes[m.tail].next = loc.new;
        rec(5, 'next گره‌ی آخر (tail) به گره جدید وصل شد.');
        m.tail = loc.new;
        rec(6, 'tail به گره جدید منتقل شد؛ گره جدید ته صف است. O(1)');
      }
    },
    dequeue({ m, loc, rec, res }) {
      rec(0, 'فراخوانی dequeue()');
      if (m.head == null) {
        rec(1, 'head is None ؟ درست → صف خالی است.');
        res.err = 'Underflow';
        rec(2, 'خطای Underflow: صف خالی است و dequeue ممکن نیست.');
        return;
      }
      rec(1, 'head is None ؟ نادرست → صف خالی نیست.');
      loc.tmp = m.head; rec(3, 'tmp به گره‌ی ابتدای صف اشاره می‌کند.');
      loc.x = m.nodes[loc.tmp].val; rec(4, 'مقدار گره ذخیره شد: x = ' + repr(loc.x));
      m.head = m.nodes[loc.tmp].next; rec(5, 'head به گره بعدی منتقل شد؛ گره tmp از ابتدای صف جدا شد.');
      if (m.head == null) {
        rec(6, 'head is None ؟ درست → آخرین عنصر حذف شد؛ tail هم باید تهی شود.');
        m.tail = null; rec(7, 'tail = None تا صف کاملاً خالی باشد.');
      } else {
        rec(6, 'head is None ؟ نادرست → هنوز عنصر دیگری در صف هست.');
      }
      delete m.nodes[loc.tmp]; delete loc.tmp;
      rec(8, 'نام tmp حذف شد و گره‌ی جداشده آزاد می‌شود.');
      res.out = loc.x; rec(9, 'مقدار ' + repr(loc.x) + ' برگردانده می‌شود.');
    }
  };

  IMPL['arr-stack'] = {
    push({ m, loc, rec, res, x }) {
      loc.x = x; rec(0, 'فراخوانی push(' + repr(x) + ')؛ پارامتر x = ' + repr(x));
      const full = m.top === m.N - 1;
      rec(1, 'top == N-1 ؟ ' + m.top + ' == ' + (m.N - 1) + ' → ' + (full ? 'درست؛ آرایه پر است.' : 'نادرست؛ جا داریم.'));
      if (full) { res.err = 'Overflow'; rec(2, 'خطای Overflow: پشته پر است و push ممکن نیست.'); return; }
      m.top = m.top + 1; rec(3, 'top یکی زیاد شد: top = ' + m.top);
      m.arr[m.top] = x; rec(4, 'مقدار ' + repr(x) + ' در خانه‌ی arr[' + m.top + '] نوشته شد. O(1)');
    },
    pop({ m, loc, rec, res }) {
      rec(0, 'فراخوانی pop()');
      const empty = m.top === -1;
      rec(1, 'top == -1 ؟ ' + m.top + ' == -1 → ' + (empty ? 'درست؛ پشته خالی است.' : 'نادرست؛ عنصر داریم.'));
      if (empty) { res.err = 'Underflow'; rec(2, 'خطای Underflow: پشته خالی است و pop ممکن نیست.'); return; }
      loc.x = m.arr[m.top]; rec(3, 'مقدار بالای پشته خوانده شد: x = ' + repr(loc.x));
      m.arr[m.top] = null; rec(4, 'خانه‌ی arr[' + m.top + '] پاک شد.');
      m.top = m.top - 1; rec(5, 'top یکی کم شد: top = ' + m.top);
      res.out = loc.x; rec(6, 'مقدار ' + repr(loc.x) + ' برگردانده می‌شود.');
    }
  };

  IMPL['arr-queue'] = {
    enqueue({ m, loc, rec, res, x }) {
      loc.x = x; rec(0, 'فراخوانی enqueue(' + repr(x) + ')؛ پارامتر x = ' + repr(x));
      const full = m.rear === m.N - 1;
      rec(1, 'rear == N-1 ؟ ' + m.rear + ' == ' + (m.N - 1) + ' → ' + (full ? 'درست؛ ته آرایه رسیده‌ایم.' : 'نادرست؛ جا داریم.'));
      if (full) {
        res.err = 'Overflow';
        rec(2, 'خطای Overflow: صف پر اعلام شد' + (m.front > 0 ? ' — با اینکه ' + m.front + ' خانه‌ی ابتدای آرایه خالی و بلااستفاده است! (هدررفت فضا؛ راه‌حل: آرایه حلقوی)' : '.'));
        return;
      }
      m.rear = m.rear + 1; rec(3, 'rear یکی زیاد شد: rear = ' + m.rear);
      m.arr[m.rear] = x; rec(4, 'مقدار ' + repr(x) + ' در خانه‌ی arr[' + m.rear + '] نوشته شد. O(1)');
    },
    dequeue({ m, loc, rec, res }) {
      rec(0, 'فراخوانی dequeue()');
      const empty = m.front > m.rear;
      rec(1, 'front > rear ؟ ' + m.front + ' > ' + m.rear + ' → ' + (empty ? 'درست؛ صف خالی است.' : 'نادرست؛ عنصر داریم.'));
      if (empty) { res.err = 'Underflow'; rec(2, 'خطای Underflow: صف خالی است و dequeue ممکن نیست.'); return; }
      loc.x = m.arr[m.front]; rec(3, 'مقدار ابتدای صف خوانده شد: x = ' + repr(loc.x));
      m.arr[m.front] = null; rec(4, 'خانه‌ی arr[' + m.front + '] پاک شد.');
      m.front = m.front + 1; rec(5, 'front یکی زیاد شد: front = ' + m.front + ' (خانه‌های قبل از front دیگر هرگز استفاده نمی‌شوند).');
      res.out = loc.x; rec(6, 'مقدار ' + repr(loc.x) + ' برگردانده می‌شود.');
    }
  };

  IMPL['circ-queue'] = {
    enqueue({ m, loc, rec, res, x }) {
      loc.x = x; rec(0, 'فراخوانی enqueue(' + repr(x) + ')؛ پارامتر x = ' + repr(x));
      const full = m.size === m.N;
      rec(1, 'size == N ؟ ' + m.size + ' == ' + m.N + ' → ' + (full ? 'درست؛ صف واقعاً پر است.' : 'نادرست؛ جا داریم.'));
      if (full) { res.err = 'Overflow'; rec(2, 'خطای Overflow: همه‌ی ' + m.N + ' خانه پر است.'); return; }
      const old = m.rear;
      m.rear = (m.rear + 1) % m.N;
      rec(3, 'rear = (' + old + ' + 1) % ' + m.N + ' = ' + m.rear + (m.rear === 0 && old === m.N - 1 ? ' ← دور زدن به ابتدای آرایه!' : ''));
      m.arr[m.rear] = x; rec(4, 'مقدار ' + repr(x) + ' در خانه‌ی arr[' + m.rear + '] نوشته شد.');
      m.size = m.size + 1; rec(5, 'تعداد عناصر زیاد شد: size = ' + m.size);
    },
    dequeue({ m, loc, rec, res }) {
      rec(0, 'فراخوانی dequeue()');
      const empty = m.size === 0;
      rec(1, 'size == 0 ؟ ' + m.size + ' == 0 → ' + (empty ? 'درست؛ صف خالی است.' : 'نادرست؛ عنصر داریم.'));
      if (empty) { res.err = 'Underflow'; rec(2, 'خطای Underflow: صف خالی است و dequeue ممکن نیست.'); return; }
      loc.x = m.arr[m.front]; rec(3, 'مقدار ابتدای صف خوانده شد: x = ' + repr(loc.x));
      m.arr[m.front] = null; rec(4, 'خانه‌ی arr[' + m.front + '] پاک شد.');
      const old = m.front;
      m.front = (m.front + 1) % m.N;
      rec(5, 'front = (' + old + ' + 1) % ' + m.N + ' = ' + m.front + (m.front === 0 && old === m.N - 1 ? ' ← دور زدن به ابتدای آرایه!' : ''));
      m.size = m.size - 1; rec(6, 'تعداد عناصر کم شد: size = ' + m.size);
      res.out = loc.x; rec(7, 'مقدار ' + repr(loc.x) + ' برگردانده می‌شود.');
    }
  };

  /* ---------- اجرای یک عملیات ---------- */
  function runOp(state, opId, x) {
    const m = clone(state), loc = {}, res = { out: null, err: null }, steps = [];
    const key = state.impl + '-' + state.kind;
    const rec = (line, note) => steps.push({ line, note, snap: clone(m), loc: clone(loc), out: res.out, err: res.err });
    IMPL[key][opId]({ m, loc, rec, res, x });
    for (const k in loc) delete loc[k];
    rec(-1, res.err
      ? 'تابع با خطا پایان یافت؛ ساختار داده تغییری نکرد.'
      : 'تابع پایان یافت؛ متغیرهای محلی از بین رفتند و ساختار داده در وضعیت جدید باقی ماند.');
    return steps;
  }

  /* ---------- متغیرهای Watch ---------- */
  const GLOBALS = {
    'll-stack': ['head'], 'll-queue': ['head', 'tail'],
    'arr-stack': ['N', 'top', 'arr'], 'arr-queue': ['N', 'front', 'rear', 'arr'],
    'circ-queue': ['N', 'front', 'rear', 'size', 'arr']
  };

  function watch(step, key) {
    const m = step.snap, loc = step.loc || {};
    const node = (id) => (id == null ? 'None' : (m.nodes[id] ? 'Node(' + repr(m.nodes[id].val) + ')' : '<آزاد شد>'));
    const g = GLOBALS[key].map((n) => {
      if (n === 'arr') return [n, '[' + m.arr.map((v) => repr(v)).join(', ') + ']'];
      if (n === 'head' || n === 'tail') return [n, node(m[n])];
      return [n, String(m[n])];
    });
    const l = [];
    ['x', 'new', 'tmp'].forEach((n) => {
      if (n in loc) l.push([n, n === 'x' ? repr(loc.x) : node(loc[n])]);
    });
    return { g, l };
  }

  const api = { initState, runOp, OPS, decl, watch, chain, repr, clone };
  return api;
})(window);


/* ===================== استایل مخصوص این شبیه‌ساز ===================== */
const CSS = `
/* ---- SVG ---- */
svg text{font-family:var(--fa)}
.edge{stroke:var(--edge);stroke-width:2;fill:none;marker-end:url(#ah)}
.ahp{fill:var(--edge)}
.node rect,.cell rect,.nullbox rect{fill:var(--node);stroke:var(--edge);stroke-width:2}
.node line{stroke:var(--edge);stroke-width:1.5}
.node circle{fill:var(--edge)}
.node text,.cell text.v{font-size:17px;font-weight:700;fill:var(--tx);text-anchor:middle}
.cell.live rect{fill:var(--live);stroke:var(--acc)}
.cell.dead rect{fill:var(--dead);stroke-dasharray:4 3}
.cell.ghost rect{fill:none;stroke-dasharray:4 4;stroke:var(--mut);stroke-width:1.5}
.cell text.i{font-size:12px;fill:var(--mut);text-anchor:middle}
.nullbox rect{fill:none;stroke-dasharray:5 4;stroke:var(--mut)}
.nullbox text,.nulltxt{font-size:13px;fill:var(--mut);text-anchor:middle;font-family:var(--mono)}
.chip rect{fill:var(--acc)}
.chip.tail rect,.chip.rear rect{fill:var(--acc2)}
.chip.new rect,.chip.tmp rect{fill:var(--warn)}
.chip text{fill:#fff;font-size:12px;font-weight:600;text-anchor:middle;font-family:var(--mono)}
.chip line{stroke:var(--acc);stroke-width:2;marker-end:url(#ah2)}
.flash rect{animation:fl 1s ease-out}
@keyframes fl{0%{fill:var(--flash)}100%{}}
.ring-c{fill:var(--node);stroke:var(--edge);stroke-width:2}
.ring-c.live{fill:var(--live);stroke:var(--acc)}
.ring-c.flash{animation:flc 1s ease-out}
@keyframes flc{0%{fill:var(--flash)}}
.rtxt{font-size:16px;font-weight:700;fill:var(--tx);text-anchor:middle}
.rlab{font-size:12px;font-weight:700;fill:var(--acc2);text-anchor:middle;font-family:var(--mono)}
.ridx{font-size:11px;fill:var(--mut);text-anchor:middle}
`;

/* ===================== قالب HTML ===================== */
const HTML = `
  <section class="tools">
    <div class="card mini">
      <div class="row"><span class="lbl">ساختار</span>
        <div class="seg" id="segKind">
          <button data-v="stack" class="on">پشته (Stack)</button>
          <button data-v="queue">صف (Queue)</button>
        </div>
        <span id="capRow"><span class="lbl">ظرفیت N</span>
          <select id="cap" aria-label="ظرفیت آرایه"><option>4</option><option>5</option><option selected>6</option><option>7</option><option>8</option></select></span>
      </div>
      <div class="row"><span class="lbl">پیاده‌سازی</span>
        <div class="seg" id="segImpl">
          <button data-v="ll" class="on">لیست پیوندی یک‌طرفه</button>
          <button data-v="arr">آرایه ساده</button>
          <button data-v="circ" title="آرایه حلقوی فقط برای صف معنا دارد">آرایه حلقوی</button>
        </div>
      </div>
    </div>
    <div class="card mini">
      <div class="row">
        <span class="lbl">مقدار x</span>
        <input type="text" id="val" maxlength="4" inputmode="numeric" aria-label="مقدار">
        <button class="btn pri" id="btnA"></button>
        <button class="btn sec" id="btnB"></button>
        <button class="btn" id="btnReset">پاک‌سازی</button>
      </div>
    </div>
  </section>

  <main class="main" id="main">
    <div class="left" id="paneLeft">
    <section class="card pane-code" id="paneCode">
      <div class="tabs" id="codeTabs"></div>
      <details id="declBox"><summary>تعریف ساختار داده</summary><pre class="code" id="decl"></pre></details>
      <pre class="code" id="code"></pre>
      <div class="legend">متغیرهای سراسری برای سادگی بدون <code>global</code> نوشته شده‌اند. خط هایلایت‌شده «همین الان اجرا شد» و تصویر، نتیجه‌ی آن است.</div>
    </section>
    <section class="card tracebox collapsed">
      <div class="trhead" id="trHead" role="button" tabindex="0" title="باز و بسته کردن"><b><span id="trTog">▸</span> Trace و Watch</b><span class="legend">هر خط: دستور اجراشده + مقدار متغیرها بعد از آن · متغیر تغییرکرده زرد است</span></div>
      <div class="trlist" id="trace"></div>
    </section>
    </div>

    <div class="handle" id="handle" role="separator" aria-orientation="vertical" tabindex="0"
         aria-label="تغییر عرض ناحیه‌ی کد و ناحیه‌ی گرافیکی (دوبار کلیک: بازگشت به ۳۰٪)" aria-valuemin="15" aria-valuemax="60" aria-valuenow="30"></div>

    <div class="pane-gfx">
      <section class="card stage">
        <div class="banner" id="banner"></div>
        <div class="scroll"><div id="draw"></div></div>
        <div id="ringWrap"></div>
        <div class="legend" id="legend"></div>
      </section>
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
  </footer>
`;

/* ===================== رابط کاربری ===================== */
function mount(view) {
  const E = Engine;
  const $ = (s) => view.querySelector(s);
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

  const toast = (msg) => window.appToast(msg);

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
    if (active >= 0 && $('.tracebox').classList.contains('collapsed')) {
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
    if (active >= 0) window.Follow.revealLine($('#code').querySelector('.ln.cur'));
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
    if (c) revealRow(box, c);
  }

  /* اسکرول نرم: فقط وقتی سطر جاری از ناحیه‌ی قابل‌مشاهده خارج شده باشد */
  function revealRow(box, c) { window.Follow.revealRow(box, c); }

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
    view.querySelectorAll('#segKind button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.kind));
    view.querySelectorAll('#segImpl button').forEach((b) => {
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

  /* ---------- جمع/باز کردن ناحیه‌ی Trace ---------- */
  function toggleTrace() {
    const t = $('.tracebox');
    t.classList.toggle('collapsed');
    $('#trTog').textContent = t.classList.contains('collapsed') ? '▸' : '▾';
    renderCode(cur());
  }
  $('#trHead').addEventListener('click', toggleTrace);
  $('#trHead').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggleTrace(); } });

  reset();
  return {
    destroy() {
      if (S.timer) { clearInterval(S.timer); S.timer = null; }
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('dragging');
    }
  };
}

window.Shell.register({
  id: 'stack-queue',
  title: 'شبیه‌ساز گرافیکی پشته و صف',
  subtitle: 'ابزار آموزشی ساختمان داده — اجرای گام‌به‌گام شبه‌کد پایتون',
  css: CSS,
  html: HTML,
  mount: mount,
  engine: Engine
});
})();
