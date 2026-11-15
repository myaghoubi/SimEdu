/* اسکرول خودکارِ دنبال‌کردن خط/سطر فعال (کد پایتون و جدول Trace)
   - فقط وقتی خط فعال از ناحیه‌ی دیده‌شده‌ی کادر خارج شده باشد، نرم اسکرول می‌کند.
   - استثنا: اگر کاربر همان کادر را با لمس اسکرول می‌کند (یا تا ۲٫۵ ثانیه پس از آخرین لمس)، جابه‌جا نمی‌کند. */
(function () {
'use strict';
if (window.Follow) return;

const HOLD = 2500;
let path = [], last = 0;
/* مسیر والدهای هدف لمس را نگه می‌داریم (خود هدف ممکن است با رندر دوباره از DOM حذف شود) */
const note = (e) => { path = e.composedPath ? e.composedPath() : []; last = Date.now(); };
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((t) => document.addEventListener(t, (e) => { if (t === 'touchstart' || t === 'touchmove') note(e); else last = Date.now(); }, { passive: true, capture: true }));

/* آیا کاربر هم‌اکنون (یا تا ۲٫۵ ثانیه‌ی پیش) با لمس همین کادر را اسکرول می‌کرده؟ */
function busy(box) {
  return path.includes(box) && Date.now() - last < HOLD;
}

function smooth(box, top) {
  if (box.scrollTo) box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); else box.scrollTop = Math.max(0, top);
}

/* سطر جاری جدول Trace (offsetTop نسبت به کادر)؛ سطر سرتیتر چسبان لحاظ می‌شود */
function revealRow(box, c, again) {
  if (!box || !c || !box.clientHeight || busy(box)) return;
  const th = box.querySelector('.tr.th'), head = th ? th.offsetHeight : 0;
  const top = c.offsetTop, bot = top + c.offsetHeight;
  let t = null;
  if (top < box.scrollTop + head) t = top - head - 6;
  else if (bot > box.scrollTop + box.clientHeight) t = bot - box.clientHeight + 6;
  if (t !== null) smooth(box, t);
  /* پس از پایان انیمیشن یک‌بار دیگر بررسی می‌کنیم (تغییر ارتفاع سطرها در حین اسکرول) */
  if (!again && !box._rv) {
    box._rv = setTimeout(() => { box._rv = null; const cc = box.querySelector('.tr.cur'); if (cc) revealRow(box, cc, true); }, 450);
  }
}

/* نزدیک‌ترین والد قابل‌اسکرول عمودی */
function scroller(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

/* خط فعال کد (.ln.cur) را در کادر اسکرول‌دار آن نمایان می‌کند */
function revealLine(cur, again) {
  if (!cur) return;
  const box = scroller(cur);
  if (!box || busy(box)) return;
  const cr = cur.getBoundingClientRect(), br = box.getBoundingClientRect();
  const pad = Math.min(36, br.height / 4);
  let d = 0;
  if (cr.top < br.top + pad) d = cr.top - br.top - pad;
  else if (cr.bottom > br.bottom - pad) d = cr.bottom - br.bottom + pad;
  if (d) smooth(box, box.scrollTop + d);
  if (!again && !box._rl) {
    box._rl = setTimeout(() => { box._rl = null; revealLine(box.querySelector('.ln.cur'), true); }, 450);
  }
}

window.Follow = { revealRow, revealLine, busy };
})();
