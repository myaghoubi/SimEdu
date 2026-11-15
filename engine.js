/* موتور شبیه‌سازی پشته و صف — بدون وابستگی به DOM
   هر عملیات به آرایه‌ای از «گام» تبدیل می‌شود؛ هر گام شامل:
   line: شماره خط شبه‌کد (-1 = پایان تابع)، note: توضیح فارسی،
   snap: عکس کامل ساختار داده بعد از اجرای آن خط، loc: متغیرهای محلی، out/err */
(function (root) {
  'use strict';

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
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
