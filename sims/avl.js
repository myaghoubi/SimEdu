/* شبیه‌ساز درج و حذف در درخت AVL — درخت با گره‌های پیوندی (فرزند چپ و راست)
   اجرای گام‌به‌گام شبه‌کد پایتون با Trace و Watch؛ به lib/stepper.js وابسته است. */
(function () {
'use strict';

const MAX_NODES = 31;
const esc = Stepper.esc;

/* ===================== شبه‌کد پایتون (هر خط یک برچسب برای ارجاع از موتور دارد) ===================== */
const COMMON = [
  ['in_cls', 'class Node:'], ['in_def', '    def __init__(self, key):'], ['in_key', '        self.key = key'], ['in_l', '        self.left = None'],
  ['in_r', '        self.right = None'], ['in_h', '        self.height = 1'], [0, ''],
  ['h_def', 'def height(n):'], ['h_ret', '    return n.height if n else 0'], [0, ''],
  ['u_def', 'def update(n):'], ['u_set', '    n.height = 1 + max(height(n.left), height(n.right))'], [0, ''],
  ['b_def', 'def balance(n):'], ['b_ret', '    return height(n.left) - height(n.right)'], [0, ''],
  ['rr_def', 'def rotate_right(y):'], ['rr_x', '    x = y.left'], ['rr_yl', '    y.left = x.right'], ['rr_xr', '    x.right = y'],
  ['rr_uy', '    update(y)'], ['rr_ux', '    update(x)'], ['rr_ret', '    return x'], [0, ''],
  ['rl_def', 'def rotate_left(x):'], ['rl_y', '    y = x.right'], ['rl_xr', '    x.right = y.left'], ['rl_yl', '    y.left = x'],
  ['rl_ux', '    update(x)'], ['rl_uy', '    update(y)'], ['rl_ret', '    return y'], [0, ''],
  ['rb_def', 'def rebalance(n):'], ['rb_upd', '    update(n)'], ['rb_bal', '    b = balance(n)'], ['rb_c1', '    if b > 1:'],
  ['rb_c2', '        if balance(n.left) < 0:'], ['rb_lr', '            n.left = rotate_left(n.left)'], ['rb_r', '        return rotate_right(n)'],
  ['rb_c3', '    if b < -1:'], ['rb_c4', '        if balance(n.right) > 0:'], ['rb_rl', '            n.right = rotate_right(n.right)'],
  ['rb_l', '        return rotate_left(n)'], ['rb_ret', '    return n'], [0, '']
];
const INSERT = [
  ['i_def', 'def insert(n, key):'], ['i_c0', '    if n is None:'], ['i_new', '        return Node(key)'],
  ['i_lt', '    if key < n.key:'], ['i_l', '        n.left = insert(n.left, key)'],
  ['i_gt', '    elif key > n.key:'], ['i_r', '        n.right = insert(n.right, key)'],
  ['i_eq', '    else:'], ['i_dup', '        return n          # کلید تکراری'], ['i_rb', '    return rebalance(n)']
];
const DELETE = [
  ['mn_def', 'def min_node(n):'], ['mn_w', '    while n.left:'], ['mn_n', '        n = n.left'], ['mn_ret', '    return n'], [0, ''],
  ['d_def', 'def delete(n, key):'], ['d_c0', '    if n is None:'], ['d_none', '        return None'],
  ['d_lt', '    if key < n.key:'], ['d_l', '        n.left = delete(n.left, key)'],
  ['d_gt', '    elif key > n.key:'], ['d_r', '        n.right = delete(n.right, key)'],
  ['d_eq', '    else:'], ['d_ln', '        if n.left is None:'], ['d_rr', '            return n.right'],
  ['d_rn', '        if n.right is None:'], ['d_rl', '            return n.left'],
  ['d_s', '        s = min_node(n.right)'], ['d_cp', '        n.key = s.key'], ['d_rd', '        n.right = delete(n.right, s.key)'],
  ['d_rb', '    return rebalance(n)']
];
function build(parts) {
  const lines = [], L = {};
  parts.forEach(([tag, text]) => { if (tag) L[tag] = lines.length; lines.push(text); });
  return { lines, L };
}
const CODE = { insert: build(COMMON.concat(INSERT)), delete: build(COMMON.concat(DELETE)) };

/* ===================== موتور ===================== */
const H = (n) => (n ? n.h : 0);
const nm = (n) => (n ? 'Node(' + n.key + ')' : 'None');
const ser = (n) => (n ? { id: n.id, key: n.key, h: n.h, l: ser(n.l), r: ser(n.r) } : null);
const deser = (s) => (s ? { id: s.id, key: s.key, h: s.h, l: deser(s.l), r: deser(s.r) } : null);
const count = (s) => (s ? 1 + count(s.l) + count(s.r) : 0);
const hgt = (s) => (s ? s.h : 0);
const inorder = (s, a = []) => { if (s) { inorder(s.l, a); a.push(s.key); inorder(s.r, a); } return a; };
const preorder = (s, a = []) => { if (s) { a.push(s.key); preorder(s.l, a); preorder(s.r, a); } return a; };

/* اجرای یک عملیات روی درخت (ساختار serialize شده) ← { steps, tree, nextId, changed }
   deep=true: اجرای گام‌به‌گام داخل همه‌ی توابع (height، update، balance، سازنده‌ی Node، min_node) با توقف روی عنوان هر تابع */
function run(op, tree, key, nextId, silent, deep) {
  const T = { root: deser(tree) };
  let nid = nextId, changed = false;
  const KEY = key;
  const L = CODE[op].L;
  const steps = [], frames = [];
  const top = () => frames[frames.length - 1];
  const push = (fn, n, withKey, pname, kk) => {
    const vars = {};
    const k = kk === undefined ? KEY : kk;
    if (withKey) vars.key = k;
    vars[pname || 'n'] = n;
    frames.push({ fn, label: fn + '(' + nm(n) + (withKey ? ', ' + k : '') + ')', vars });
  };
  const sv = (v) => (v === null ? { k: 'none' } : (typeof v === 'number' ? { k: 'num', v } : { k: 'node', id: v.id, key: v.key }));
  function rec(line, note, ex) {
    if (silent) return;
    ex = ex || {};
    const vars = {};
    const src = ex.vars || (frames.length ? top().vars : {});
    Object.keys(src).forEach((k) => { if (src[k] !== undefined) vars[k] = sv(src[k]); });
    steps.push({ line, note, snap: { tree: ser(T.root), vars, calls: frames.map((f) => f.label), bf: ex.bf || null, newId: ex.newId || null, mark: ex.mark || [], fin: !!ex.fin } });
  }

  /* ----- توابع کمکی ----- */
  function heightFn(n) {
    if (!deep) return H(n);
    push('height', n);
    rec(L.h_def, 'فراخوانی height(' + nm(n) + ').');
    rec(L.h_ret, 'return n.height if n else 0 ← ' + (n ? 'n هست، پس ارتفاع ذخیره‌شده‌ی آن = ' + n.h : 'n برابر None است، پس 0') + '.');
    frames.pop();
    return H(n);
  }
  function updateFn(n, callLine) {
    if (!deep) { n.h = 1 + Math.max(H(n.l), H(n.r)); rec(callLine, 'update(' + nm(n) + '): ارتفاع = 1 + max(' + H(n.l) + ', ' + H(n.r) + ') = ' + n.h); return; }
    rec(callLine, 'فراخوانی update(' + nm(n) + ').');
    push('update', n);
    rec(L.u_def, 'ورود به تابع update با n = ' + nm(n) + '.');
    rec(L.u_set, 'محاسبه‌ی n.height = 1 + max(height(n.left), height(n.right)) — ابتدا دو فراخوانی height.');
    const hl = heightFn(n.l), hr = heightFn(n.r);
    n.h = 1 + Math.max(hl, hr);
    rec(L.u_set, 'n.height = 1 + max(' + hl + ', ' + hr + ') = ' + n.h + ' — ارتفاع ' + nm(n) + ' بروز شد.');
    frames.pop();
  }
  function balanceFn(n, callLine, why) {
    if (!deep) return H(n.l) - H(n.r);
    rec(callLine, 'فراخوانی balance(' + nm(n) + ')' + (why ? ' ' + why : '') + '.');
    push('balance', n);
    rec(L.b_def, 'ورود به تابع balance با n = ' + nm(n) + '.');
    rec(L.b_ret, 'محاسبه‌ی height(n.left) - height(n.right) — دو فراخوانی height.');
    const hl = heightFn(n.l), hr = heightFn(n.r), b = hl - hr;
    rec(L.b_ret, 'return ' + hl + ' − ' + hr + ' = ' + b + '.');
    frames.pop();
    return b;
  }

  function rotateRight(y, ctx) {
    push('rotate_right', y, false, 'y');
    const fr = top();
    rec(L.rr_def, 'ورود به rotate_right با y = ' + nm(y) + ' (چرخش به راست).');
    const x = y.l; fr.vars.x = x;
    rec(L.rr_x, 'x = y.left = ' + nm(x) + ' — x فرزند چپ y است و قرار است جای y را بگیرد.');
    const B = x.r;
    rec(L.rr_yl, 'y.left = x.right: زیردرخت راست x (' + (B ? nm(B) : 'تهی') + ') به‌عنوان فرزند چپ y وصل می‌شود. (تصویر در خط بعد کامل می‌شود.)', { mark: B ? [B.id] : [] });
    y.l = B; x.r = y; ctx.set(x); changed = true;
    rec(L.rr_xr, 'x.right = y: y فرزند راست x شد؛ اکنون x ریشه‌ی این زیردرخت است. (اتصال x به والد پس از بازگشت از تابع ثبت می‌شود.)', { mark: [x.id, y.id] });
    updateFn(y, L.rr_uy);
    updateFn(x, L.rr_ux);
    rec(L.rr_ret, 'return x: ریشه‌ی جدید زیردرخت ' + nm(x) + ' است.');
    frames.pop();
    return x;
  }
  function rotateLeft(x, ctx) {
    push('rotate_left', x, false, 'x');
    const fr = top();
    rec(L.rl_def, 'ورود به rotate_left با x = ' + nm(x) + ' (چرخش به چپ).');
    const y = x.r; fr.vars.y = y;
    rec(L.rl_y, 'y = x.right = ' + nm(y) + ' — y فرزند راست x است و قرار است جای x را بگیرد.');
    const B = y.l;
    rec(L.rl_xr, 'x.right = y.left: زیردرخت چپ y (' + (B ? nm(B) : 'تهی') + ') به‌عنوان فرزند راست x وصل می‌شود. (تصویر در خط بعد کامل می‌شود.)', { mark: B ? [B.id] : [] });
    x.r = B; y.l = x; ctx.set(y); changed = true;
    rec(L.rl_yl, 'y.left = x: x فرزند چپ y شد؛ اکنون y ریشه‌ی این زیردرخت است. (اتصال y به والد پس از بازگشت از تابع ثبت می‌شود.)', { mark: [x.id, y.id] });
    updateFn(x, L.rl_ux);
    updateFn(y, L.rl_uy);
    rec(L.rl_ret, 'return y: ریشه‌ی جدید زیردرخت ' + nm(y) + ' است.');
    frames.pop();
    return y;
  }
  function rebalance(n, ctx) {
    push('rebalance', n);
    const fr = top();
    rec(L.rb_def, 'ورود به تابع rebalance با n = ' + nm(n) + '.');
    updateFn(n, L.rb_upd);
    let b;
    if (deep) {
      b = balanceFn(n, L.rb_bal);
      fr.vars.b = b;
      rec(L.rb_bal, 'b = ' + b + (Math.abs(b) > 1 ? '  ← نامتوازن!' : '  ← متوازن'), { bf: { id: n.id, v: b } });
    } else {
      b = H(n.l) - H(n.r); fr.vars.b = b;
      rec(L.rb_bal, 'b = balance(n) = ارتفاع چپ − ارتفاع راست = ' + H(n.l) + ' − ' + H(n.r) + ' = ' + b + (Math.abs(b) > 1 ? '  ← نامتوازن!' : '  ← متوازن'), { bf: { id: n.id, v: b } });
    }
    const bfx = { bf: { id: n.id, v: b } };
    rec(L.rb_c1, 'b > 1 ؟ ' + (b > 1 ? 'درست — درخت چپ‌سنگین است.' : 'نادرست.'), bfx);
    if (b > 1) {
      const lb = balanceFn(n.l, L.rb_c2, '(برای فرزند چپ)');
      rec(L.rb_c2, 'balance(n.left) < 0 ؟ balance(' + nm(n.l) + ') = ' + lb + ' → ' + (lb < 0 ? 'درست: حالت LR (دو چرخش).' : 'نادرست: حالت LL (یک چرخش به راست).'), bfx);
      if (lb < 0) {
        rec(L.rb_lr, 'n.left = rotate_left(n.left): ابتدا فرزند چپ به چپ چرخانده می‌شود تا حالت LL شود.');
        n.l = rotateLeft(n.l, { set: (s) => { n.l = s; } });
        rec(L.rb_lr, 'بازگشت: n.left = ' + nm(n.l) + ' — اکنون حالت LL است.');
      }
      rec(L.rb_r, 'return rotate_right(n): چرخش به راست حول ' + nm(n) + '.');
      const res = rotateRight(n, ctx);
      frames.pop();
      return res;
    }
    rec(L.rb_c3, 'b < -1 ؟ ' + (b < -1 ? 'درست — درخت راست‌سنگین است.' : 'نادرست.'), bfx);
    if (b < -1) {
      const rb = balanceFn(n.r, L.rb_c4, '(برای فرزند راست)');
      rec(L.rb_c4, 'balance(n.right) > 0 ؟ balance(' + nm(n.r) + ') = ' + rb + ' → ' + (rb > 0 ? 'درست: حالت RL (دو چرخش).' : 'نادرست: حالت RR (یک چرخش به چپ).'), bfx);
      if (rb > 0) {
        rec(L.rb_rl, 'n.right = rotate_right(n.right): ابتدا فرزند راست به راست چرخانده می‌شود تا حالت RR شود.');
        n.r = rotateRight(n.r, { set: (s) => { n.r = s; } });
        rec(L.rb_rl, 'بازگشت: n.right = ' + nm(n.r) + ' — اکنون حالت RR است.');
      }
      rec(L.rb_l, 'return rotate_left(n): چرخش به چپ حول ' + nm(n) + '.');
      const res = rotateLeft(n, ctx);
      frames.pop();
      return res;
    }
    rec(L.rb_ret, 'return n: نیازی به چرخش نیست.');
    frames.pop();
    return n;
  }

  /* سازنده‌ی Node(key): در حالت deep داخل __init__ می‌رود */
  function makeNode(k, callLine) {
    const nn = { id: nid++, key: k, l: null, r: null, h: 1 };
    if (deep) {
      rec(callLine, 'فراخوانی Node(' + k + ') — ساخت گره‌ی جدید.');
      frames.push({ fn: 'Node.__init__', label: 'Node.__init__(self, ' + k + ')', vars: { key: k } });
      rec(L.in_def, 'ورود به سازنده‌ی __init__ با key = ' + k + '.');
      rec(L.in_key, 'self.key = key ← ' + k);
      rec(L.in_l, 'self.left = None');
      rec(L.in_r, 'self.right = None');
      rec(L.in_h, 'self.height = 1 — گره‌ی تازه یک برگ است.');
      frames.pop();
    }
    return nn;
  }

  function insert(n, ctx) {
    push('insert', n, true);
    rec(L.i_def, 'فراخوانی insert با n = ' + nm(n) + ' و key = ' + key + '.');
    rec(L.i_c0, 'n is None ؟ ' + (n === null ? 'درست — جای درج پیدا شد.' : 'نادرست.'));
    if (n === null) {
      const nn = makeNode(key, L.i_new);
      ctx.set(nn); changed = true;
      rec(L.i_new, 'گره جدید Node(' + key + ') ساخته و برگردانده شد؛ والد آن را به فرزند خود وصل می‌کند.', { newId: nn.id });
      frames.pop();
      return nn;
    }
    rec(L.i_lt, 'key < n.key ؟ ' + key + ' < ' + n.key + ' → ' + (key < n.key ? 'درست، به چپ می‌رویم.' : 'نادرست.'));
    if (key < n.key) {
      rec(L.i_l, 'فراخوانی بازگشتی روی فرزند چپ ' + nm(n) + ' (' + nm(n.l) + ').');
      n.l = insert(n.l, { set: (s) => { n.l = s; } });
      rec(L.i_l, 'بازگشت: n.left = ' + nm(n.l) + ' ثبت شد.');
    } else {
      rec(L.i_gt, 'key > n.key ؟ ' + key + ' > ' + n.key + ' → ' + (key > n.key ? 'درست، به راست می‌رویم.' : 'نادرست.'));
      if (key > n.key) {
        rec(L.i_r, 'فراخوانی بازگشتی روی فرزند راست ' + nm(n) + ' (' + nm(n.r) + ').');
        n.r = insert(n.r, { set: (s) => { n.r = s; } });
        rec(L.i_r, 'بازگشت: n.right = ' + nm(n.r) + ' ثبت شد.');
      } else {
        rec(L.i_eq, 'else: کلید ' + key + ' از قبل در درخت هست.');
        rec(L.i_dup, 'return n: کلید تکراری درج نمی‌شود و درخت تغییری نمی‌کند.');
        frames.pop();
        return n;
      }
    }
    rec(L.i_rb, 'return rebalance(n): در مسیر بازگشت، ارتفاع و توازن ' + nm(n) + ' بررسی می‌شود.');
    const res = rebalance(n, ctx);
    frames.pop();
    return res;
  }

  /* min_node(n): در حالت deep حلقه‌ی while خط‌به‌خط اجرا می‌شود */
  function minNode(n0, callLine) {
    if (!deep) { let s = n0; while (s.l) s = s.l; return s; }
    rec(callLine, 'فراخوانی min_node(' + nm(n0) + ') برای یافتن جانشین.');
    push('min_node', n0);
    const fr = top();
    rec(L.mn_def, 'ورود به تابع min_node با n = ' + nm(n0) + '.');
    let s = n0;
    for (;;) {
      rec(L.mn_w, 'while n.left ؟ ' + (s.l ? 'n.left = ' + nm(s.l) + ' → ادامه.' : 'n.left برابر None است → حلقه تمام می‌شود.'), { mark: [s.id] });
      if (!s.l) break;
      s = s.l; fr.vars.n = s;
      rec(L.mn_n, 'n = n.left → ' + nm(s) + '.', { mark: [s.id] });
    }
    rec(L.mn_ret, 'return n: کوچک‌ترین کلید زیردرخت = ' + s.key + '.', { mark: [s.id] });
    frames.pop();
    return s;
  }

  function del(n, ctx, key) {
    push('delete', n, true, undefined, key);
    rec(L.d_def, 'فراخوانی delete با n = ' + nm(n) + ' و key = ' + key + '.');
    rec(L.d_c0, 'n is None ؟ ' + (n === null ? 'درست — کلید در درخت نیست.' : 'نادرست.'));
    if (n === null) {
      rec(L.d_none, 'return None: کلید ' + key + ' پیدا نشد و درخت تغییری نمی‌کند.');
      frames.pop();
      return null;
    }
    rec(L.d_lt, 'key < n.key ؟ ' + key + ' < ' + n.key + ' → ' + (key < n.key ? 'درست، به چپ می‌رویم.' : 'نادرست.'));
    if (key < n.key) {
      rec(L.d_l, 'فراخوانی بازگشتی روی فرزند چپ ' + nm(n) + ' (' + nm(n.l) + ').');
      n.l = del(n.l, { set: (s) => { n.l = s; } }, key);
      rec(L.d_l, 'بازگشت: n.left = ' + nm(n.l) + ' ثبت شد.');
    } else {
      rec(L.d_gt, 'key > n.key ؟ ' + key + ' > ' + n.key + ' → ' + (key > n.key ? 'درست، به راست می‌رویم.' : 'نادرست.'));
      if (key > n.key) {
        rec(L.d_r, 'فراخوانی بازگشتی روی فرزند راست ' + nm(n) + ' (' + nm(n.r) + ').');
        n.r = del(n.r, { set: (s) => { n.r = s; } }, key);
        rec(L.d_r, 'بازگشت: n.right = ' + nm(n.r) + ' ثبت شد.');
      } else {
        rec(L.d_eq, 'else: key == n.key — گره‌ی حذفی (' + nm(n) + ') پیدا شد.');
        rec(L.d_ln, 'n.left is None ؟ ' + (n.l === null ? 'درست.' : 'نادرست.'));
        if (n.l === null) {
          ctx.set(n.r); changed = true;
          rec(L.d_rr, 'return n.right: گره حذف شد و فرزند راست (' + nm(n.r) + ') جای آن را می‌گیرد.');
          frames.pop();
          return n.r;
        }
        rec(L.d_rn, 'n.right is None ؟ ' + (n.r === null ? 'درست.' : 'نادرست.'));
        if (n.r === null) {
          ctx.set(n.l); changed = true;
          rec(L.d_rl, 'return n.left: گره حذف شد و فرزند چپ (' + nm(n.l) + ') جای آن را می‌گیرد.');
          frames.pop();
          return n.l;
        }
        const s = minNode(n.r, L.d_s);
        top().vars.s = s;
        rec(L.d_s, 's = min_node(n.right) = ' + nm(s) + ' — کوچک‌ترین کلید زیردرخت راست (جانشین میان‌ترتیب).', { mark: [s.id] });
        n.key = s.key; changed = true;
        rec(L.d_cp, 'n.key = s.key: کلید گره‌ی حذفی با ' + s.key + ' جایگزین شد (فعلاً کلید ' + s.key + ' دوبار در درخت است).');
        rec(L.d_rd, 'حذف جانشین از زیردرخت راست: delete(n.right, ' + s.key + ').');
        n.r = del(n.r, { set: (t) => { n.r = t; } }, s.key);
        rec(L.d_rd, 'بازگشت: n.right = ' + nm(n.r) + ' ثبت شد.');
      }
    }
    rec(L.d_rb, 'return rebalance(n): در مسیر بازگشت، ارتفاع و توازن ' + nm(n) + ' بررسی می‌شود.');
    const res = rebalance(n, ctx);
    frames.pop();
    return res;
  }

  const res = op === 'insert' ? insert(T.root, { set: (s) => { T.root = s; } }) : del(T.root, { set: (s) => { T.root = s; } }, key);
  T.root = res;
  const msg = op === 'insert'
    ? (changed ? 'پایان: کلید ' + key + ' درج شد و درخت AVL متوازن ماند. root = ' + nm(res) : 'پایان: کلید ' + key + ' تکراری بود؛ درخت تغییری نکرد.')
    : (changed ? 'پایان: کلید ' + key + ' حذف شد و درخت AVL متوازن ماند. root = ' + nm(res) : 'پایان: کلید ' + key + ' در درخت نبود؛ درخت تغییری نکرد.');
  rec(-1, msg, { vars: { root: res }, fin: true });
  return { steps, tree: ser(T.root), nextId: nid, changed };
}

/* ===================== استایل ===================== */
const CSS = `
.avst{display:flex;flex-direction:column;gap:6px;height:100%}
.avsvg{flex:0 0 min(78vw,400px);min-height:0}
.avsvg svg{width:100%;height:100%;display:block}
@media (orientation:landscape) and (min-width:640px){.avsvg{flex:1 1 0;min-height:150px}}
.avl-edge{stroke:var(--edge);stroke-width:2.2}
.avn circle.c{fill:var(--node);stroke:var(--edge);stroke-width:2.4}
.avn text.k{font-family:var(--mono);font-size:15px;font-weight:700;fill:var(--tx);text-anchor:middle;pointer-events:none}
.avn text.h{font-family:var(--mono);font-size:10.5px;fill:var(--mut);text-anchor:middle}
.avn text.v{font-family:var(--mono);font-size:11px;font-weight:700;fill:var(--acc2);text-anchor:middle}
.avn.ref circle.c{stroke:var(--acc2);stroke-width:3.5}
.avn.cur circle.c{fill:var(--acc);stroke:var(--acc)}
.avn.cur text.k{fill:#fff}
.avn.mk circle.c{stroke:var(--warn);stroke-width:5;stroke-dasharray:5 3}
.avn.nw circle.c{fill:#bbf7d0;stroke:var(--ok);stroke-width:3.5}
.avn text.bf{font-family:var(--mono);font-size:12px;font-weight:700;text-anchor:start}
.avn text.bf.ok{fill:var(--ok)}.avn text.bf.bad{fill:var(--err)}
.avstate{display:flex;flex-direction:column;gap:3px;padding:2px 4px}
.avrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.avlab{flex:0 0 120px;font-size:12px;color:var(--mut)}
.avchips{display:flex;flex-wrap:wrap;gap:4px;direction:ltr;min-height:24px;align-items:center}
.avchip{font-family:var(--mono);font-size:12px;font-weight:700;padding:0 8px;border:1.5px solid var(--edge);border-radius:8px;background:var(--node)}
.avchip.last{border-color:var(--acc);background:var(--live)}
.avlegend{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}
.avlegend i{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--edge);vertical-align:-2px;margin-left:4px;background:var(--node)}
.avlegend i.c{background:var(--acc);border-color:var(--acc)}
.avlegend i.r{border-color:var(--acc2)}
.avlegend i.n{background:#bbf7d0;border-color:var(--ok)}
.avlegend i.m{border:2px dashed var(--warn)}
.avend{font-weight:700;color:var(--ok);font-size:13px}
`;

const STAGE = `
<div class="avst">
  <div class="avsvg"><svg id="avsvg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="درخت AVL"></svg></div>
  <div class="avstate" id="avstate"></div>
  <div class="legend avlegend">
    <span><i class="c"></i>n — گره‌ی جاری تابع</span><span><i class="r"></i>x / y / s — متغیرهای دیگر</span>
    <span><i class="m"></i>زیردرخت جابه‌جاشونده</span><span><i class="n"></i>گره‌ی جدید</span>
    <span>عدد زیر هر گره = ارتفاع ذخیره‌شده (height)؛ bf = توازن (چپ − راست)</span>
  </div>
</div>`;

const HTML = `
  <section class="tools">
    <div class="card mini">
      <div class="row"><span class="lbl">عملیات</span>
        <div class="seg" id="segOp"><button data-v="insert" class="on">درج (insert)</button><button data-v="delete">حذف (delete)</button></div>
      </div>
      <div class="row"><span class="lbl">کلید</span>
        <input type="text" id="keyIn" inputmode="numeric" autocomplete="off" style="width:80px" aria-label="کلید">
        <button class="btn pri" id="btnRun">▶ اجرای عملیات</button>
        <span class="lbl" id="avInfo"></span>
      </div>
      <div class="row"><label class="lbl" style="cursor:pointer"><input type="checkbox" id="deepChk" checked> ورود به همه‌ی توابع (height، update، balance، …)</label></div>
    </div>
    <div class="card mini">
      <div class="row"><span class="lbl">نمونه</span>
        <select id="preset" aria-label="سناریوی نمونه"></select>
      </div>
      <div class="row"><span class="lbl">ساخت سریع</span>
        <input type="text" id="bulk" style="width:150px" placeholder="30,20,40,10" autocomplete="off" aria-label="کلیدها">
        <button class="btn" id="btnBuild">بساز</button>
        <button class="btn" id="btnRand">تصادفی</button>
        <button class="btn" id="btnEmpty">خالی</button>
      </div>
    </div>
  </section>
` + Stepper.layout(STAGE, { codeNote: 'توابع height / update / balance ساده‌اند و در همان خطِ فراخوانی اجرا می‌شوند. هر گام، نتیجه‌ی خط هایلایت‌شده را نشان می‌دهد.' });

/* ===================== رابط کاربری ===================== */
const PRESETS = [
  { name: 'درخت خالی', keys: [], op: 'insert', key: 50 },
  { name: 'چرخش LL (به راست): درج ۵', keys: [30, 20, 40, 10], op: 'insert', key: 5 },
  { name: 'چرخش RR (به چپ): درج ۵۰', keys: [20, 10, 30, 40], op: 'insert', key: 50 },
  { name: 'چرخش دوگانه LR: درج ۱۵', keys: [40, 20, 50, 10], op: 'insert', key: 15 },
  { name: 'چرخش دوگانه RL: درج ۵۵', keys: [20, 10, 50, 60], op: 'insert', key: 55 },
  { name: 'حذف همراه با چرخش: حذف ۴۰', keys: [30, 20, 40, 10], op: 'delete', key: 40 },
  { name: 'حذف گره دوفرزندی: حذف ۵۰', keys: [50, 30, 70, 20, 40, 60, 80], op: 'delete', key: 50 },
  { name: 'درخت ۱۰ کلیدی', keys: [50, 25, 75, 12, 37, 62, 87, 6, 18, 31], op: 'insert', key: 22 }
];

function mount(view) {
  const $ = (s) => view.querySelector(s);
  const toast = (m) => window.appToast && window.appToast(m);
  const S = { op: 'insert', tree: null, pre: null, nextId: 1, ctl: null };

  /* ----- تصویر درخت ----- */
  function layoutTree(t) {
    const out = []; let i = 0, maxD = 0;
    (function go(n, d, p) {
      if (!n) return;
      go(n.l, d + 1, n.id);
      out.push({ id: n.id, key: n.key, h: n.h, d, idx: i++, p }); maxD = Math.max(maxD, d);
      go(n.r, d + 1, n.id);
    })(t, 0, null);
    return { nodes: out, maxD };
  }
  function drawTree(snap) {
    const svg = $('#avsvg');
    const { nodes, maxD } = layoutTree(snap.tree);
    const W = Math.max(560, (nodes.length + 1) * 46), Hh = Math.max(230, (maxD + 1) * 76 + 40);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    if (!nodes.length) { svg.innerHTML = '<text x="' + W / 2 + '" y="' + Hh / 2 + '" text-anchor="middle" style="fill:var(--mut);font-size:15px">درخت خالی است (root = None)</text>'; return; }
    const dx = W / (nodes.length + 1);
    const pos = {};
    nodes.forEach((n) => { pos[n.id] = { x: (n.idx + 1) * dx, y: 38 + n.d * 76 }; });
    const roles = {};
    Object.keys(snap.vars || {}).forEach((k) => { const v = snap.vars[k]; if (v.k === 'node') (roles[v.id] = roles[v.id] || []).push(k); });
    let s = '';
    nodes.forEach((n) => { if (n.p != null) s += '<line class="avl-edge" x1="' + pos[n.p].x + '" y1="' + pos[n.p].y + '" x2="' + pos[n.id].x + '" y2="' + pos[n.id].y + '"/>'; });
    nodes.forEach((n) => {
      const p = pos[n.id], r = roles[n.id] || [];
      const cls = 'avn' + (r.includes('n') ? ' cur' : (r.length ? ' ref' : '')) + (snap.mark.includes(n.id) ? ' mk' : '') + (snap.newId === n.id ? ' nw' : '');
      s += '<g class="' + cls + '" transform="translate(' + p.x + ',' + p.y + ')"><circle class="c" r="19"/><text class="k" y="5">' + esc(n.key) + '</text><text class="h" y="34">h=' + n.h + '</text>' +
        (r.length ? '<text class="v" y="-25">' + esc(r.join(',')) + '</text>' : '') +
        (snap.bf && snap.bf.id === n.id ? '<text class="bf ' + (Math.abs(snap.bf.v) > 1 ? 'bad' : 'ok') + '" x="22" y="-8">bf=' + (snap.bf.v > 0 ? '+' : '') + snap.bf.v + '</text>' : '') + '</g>';
    });
    svg.innerHTML = s;
  }
  function drawState(snap) {
    const calls = snap.calls || [];
    $('#avstate').innerHTML =
      '<div class="avrow"><span class="avlab">پشته‌ی فراخوانی: bottom → top</span><span class="avchips">' +
      (calls.length ? calls.map((c, i) => '<span class="avchip' + (i === calls.length - 1 ? ' last' : '') + '">' + esc(c) + '</span>').join('') : '<span class="gundef" style="font-size:12px;color:var(--mut)">' + (snap.fin ? 'خالی — اجرا تمام شد' : '∅ خالی') + '</span>') + '</span></div>' +
      '<div class="avrow"><span class="avlab">پیمایش میان‌ترتیب</span><span class="avchips">' + (inorder(snap.tree).map((k) => '<span class="avchip">' + esc(k) + '</span>').join('') || '<span style="font-size:12px;color:var(--mut)">—</span>') + '</span></div>' +
      '<div class="avrow"><span class="avlab">گره‌ها / ارتفاع</span><b style="font-family:var(--mono);direction:ltr;unicode-bidi:isolate">' + count(snap.tree) + ' / ' + hgt(snap.tree) + '</b></div>';
  }
  const repr = (v) => (v.k === 'none' ? 'None' : (v.k === 'num' ? String(v.v) : 'Node(' + v.key + ')'));

  /* ----- Stepper ----- */
  const ctl = Stepper.create(view, {
    getCode: () => ({
      tabs: [{ id: 'insert', label: 'insert(n, key)' }, { id: 'delete', label: 'delete(n, key)' }],
      tab: S.op, lines: CODE[S.op].lines,
      decl: '# درخت فعلی (پیش‌ترتیب): ' + (preorder(S.pre || S.tree).join(' ') || 'تهی') + '\nroot = ' + S.op + '(root, ' + ($('#keyIn').value.trim() || 'key') + ')'
    }),
    idle: () => ({ line: -1, note: '', snap: { tree: S.pre || S.tree, vars: {}, calls: [], bf: null, newId: null, mark: [], fin: false }, idle: true }),
    watch: (step) => {
      const v = (step.snap && step.snap.vars) || {};
      const order = ['key', 'n', 'x', 'y', 's', 'b', 'root'];
      const out = order.filter((k) => v[k]).map((k) => [k, repr(v[k])]);
      const c = (step.snap && step.snap.calls) || [];
      if (c.length > 1) out.push(['depth', String(c.length)]);
      return out;
    },
    render: (step) => { drawTree(step.snap); drawState(step.snap); },
    onTab: (id) => { S.op = id; syncOp(); },
    traceOpen: false,
    hint: 'عملیات و کلید را انتخاب و «اجرای عملیات» را بزنید؛ سپس با «بعدی» یا «پخش» مراحل را دنبال کنید.'
  });

  function syncOp() {
    view.querySelectorAll('#segOp button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.op));
    ctl.refresh();
  }
  function info() { $('#avInfo').textContent = count(S.tree) + ' گره · ارتفاع ' + hgt(S.tree); }
  function resetSteps() { S.pre = null; ctl.setSteps([], S.op, CODE[S.op].lines); }

  function setTree(keys) {
    S.tree = null; S.nextId = 1;
    for (const k of keys) { const r = run('insert', S.tree, k, S.nextId, true); S.tree = r.tree; S.nextId = r.nextId; }
    info(); resetSteps();
  }
  function parseKeys(str) {
    return str.split(/[\s,،;]+/).filter(Boolean).map(Number);
  }
  const okKey = (k) => Number.isInteger(k) && k >= -999 && k <= 999;

  function doOp() {
    const k = Number($('#keyIn').value.trim());
    if ($('#keyIn').value.trim() === '' || !okKey(k)) { toast('یک عدد صحیح (بین ‎−۹۹۹ تا ۹۹۹) به‌عنوان کلید وارد کنید.'); return; }
    if (S.op === 'insert' && count(S.tree) >= MAX_NODES && !inorder(S.tree).includes(k)) { toast('حداکثر ' + MAX_NODES + ' گره پشتیبانی می‌شود.'); return; }
    const pre = S.tree;
    const r = run(S.op, S.tree, k, S.nextId, false, $('#deepChk').checked);
    S.tree = r.tree; S.nextId = r.nextId;
    S.pre = pre;
    info();
    ctl.setSteps(r.steps, S.op, CODE[S.op].lines);
  }

  /* ----- رویدادها ----- */
  $('#segOp').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.op = b.dataset.v; syncOp(); });
  $('#btnRun').addEventListener('click', doOp);
  $('#keyIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') doOp(); });
  $('#keyIn').addEventListener('input', () => ctl.refresh());
  $('#btnEmpty').addEventListener('click', () => { setTree([]); $('#preset').value = '0'; });
  $('#btnBuild').addEventListener('click', () => {
    const ks = parseKeys($('#bulk').value);
    if (!ks.length || !ks.every(okKey)) { toast('کلیدها را با ویرگول جدا کنید؛ مثلاً 30,20,40,10'); return; }
    if (new Set(ks).size > MAX_NODES) { toast('حداکثر ' + MAX_NODES + ' کلید پشتیبانی می‌شود.'); return; }
    setTree(ks);
  });
  $('#btnRand').addEventListener('click', () => {
    const set = new Set(); while (set.size < 7) set.add(1 + Math.floor(Math.random() * 99));
    const ks = [...set]; $('#bulk').value = ks.join(','); setTree(ks);
  });
  $('#preset').innerHTML = PRESETS.map((p, i) => '<option value="' + i + '">' + esc(p.name) + '</option>').join('');
  $('#preset').addEventListener('change', (e) => {
    const p = PRESETS[+e.target.value];
    S.op = p.op; $('#keyIn').value = String(p.key); $('#bulk').value = p.keys.join(',');
    setTree(p.keys); syncOp();
  });

  /* ----- شروع ----- */
  $('#preset').value = '1';
  { const p = PRESETS[1]; S.op = p.op; $('#keyIn').value = String(p.key); $('#bulk').value = p.keys.join(','); setTree(p.keys); syncOp(); }
  return { destroy() { ctl.destroy(); } };
}

window.Shell.register({
  id: 'avl',
  title: 'شبیه‌ساز درج و حذف در درخت AVL',
  subtitle: 'گره‌های پیوندی با فرزند چپ و راست — اجرای گام‌به‌گام شبه‌کد پایتون',
  css: CSS,
  html: HTML,
  mount: mount,
  engine: { run, CODE, inorder, count, hgt }
});
})();
