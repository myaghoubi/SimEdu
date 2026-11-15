/* نمایش نسخه، دکمه‌ی بروزرسانی و بررسی خودکار هر ۱۰ ثانیه */
(function () {
  'use strict';
  const APP_VERSION = String(self.APP_VERSION);
  const POLL_MS = 10000;
  const $ = (s) => document.querySelector(s);
  const toast = (m) => { if (window.appToast) window.appToast(m); };
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const hasSW = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  let controlled = hasSW && !!navigator.serviceWorker.controller;
  let reg = null, checking = false, applying = false;

  $('#ver').textContent = 'نسخه ' + APP_VERSION;
  const updBtn = $('#updBtn');

  if (store.get('upd_done')) {
    store.set('upd_done', '');
    toast('✓ برنامه به نسخه‌ی ' + APP_VERSION + ' بروزرسانی شد.');
  }

  function reload() { setTimeout(() => location.reload(), 600); }

  function activate(worker) {
    if (!worker) return;
    store.set('upd_done', '1');
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  /* نسخه‌ی روی سرور (بدون کش) */
  async function serverVersion() {
    const r = await fetch('version.js?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const m = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(await r.text());
    if (!m) throw new Error('bad version file');
    return m[1];
  }

  /* وقتی service worker جدید آماده شد، خودکار فعالش می‌کنیم */
  function watchInstalling(w) {
    if (!w) return;
    const go = () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) {
        toast('نسخه‌ی جدید دانلود شد؛ در حال فعال‌سازی…');
        activate(w);
      }
    };
    w.addEventListener('statechange', go);
    go();
  }

  async function hardRefresh(newVer, manual) {
    /* راه‌حل آخر: حذف service worker و کش‌ها، سپس بازخوانی از شبکه (فقط یک‌بار برای هر نسخه) */
    if (!manual && store.get('upd_try') === newVer) return;
    store.set('upd_try', newVer);
    store.set('upd_done', '1');
    try { if (reg) await reg.unregister(); } catch (e) { /* ignore */ }
    try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (e) { /* ignore */ }
    reload();
  }

  async function applyUpdate(newVer, manual) {
    if (applying) return;
    applying = true;
    setTimeout(() => { applying = false; }, 30000);
    toast('نسخه‌ی ' + newVer + ' یافت شد؛ در حال بروزرسانی…');
    if (hasSW && reg) {
      try { await reg.update(); } catch (e) { /* ignore */ }
      if (reg.waiting) { activate(reg.waiting); return; }
      if (reg.installing) { watchInstalling(reg.installing); return; }
    }
    await hardRefresh(newVer, manual);
  }

  async function check(manual) {
    if (checking) return;
    checking = true;
    if (manual) { updBtn.disabled = true; updBtn.textContent = '… در حال بررسی'; }
    try {
      let sv = null;
      try { sv = await serverVersion(); } catch (e) { if (manual) toast('اتصال برای بررسی نسخه برقرار نشد.'); }
      if (hasSW && reg) { try { await reg.update(); } catch (e) { /* ignore */ } }
      if (reg && reg.waiting && navigator.serviceWorker.controller) { activate(reg.waiting); return; }
      if (sv && sv !== APP_VERSION) {
        updBtn.classList.add('hot');
        updBtn.textContent = '⟳ بروزرسانی ← ' + sv;
        await applyUpdate(sv, manual);
      } else if (sv && manual) {
        toast('شما از آخرین نسخه (' + APP_VERSION + ') استفاده می‌کنید.');
      }
    } finally {
      checking = false;
      if (manual) {
        updBtn.disabled = false;
        if (!updBtn.classList.contains('hot')) updBtn.textContent = '⟳ بروزرسانی';
      }
    }
  }

  updBtn.addEventListener('click', () => check(true));

  /* پیشرفت دانلود: رنگ زمینه‌ی دکمه به نسبت فایل‌های باقی‌مانده کم می‌شود */
  function setProgress(done, total) {
    const rem = Math.max(0, Math.round(100 * (1 - done / total)));
    updBtn.classList.add('hot');
    updBtn.style.setProperty('--rem', rem);
    updBtn.title = 'در حال دانلود نسخه‌ی جدید — ' + (100 - rem) + '٪';
  }

  if (hasSW) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data;
      if (d && d.type === 'PROGRESS' && String(d.version) !== APP_VERSION) setProgress(d.done, d.total);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controlled) { controlled = true; return; } /* نصب اولیه (claim)، نه بروزرسانی */
      reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => {
      reg = r;
      r.addEventListener('updatefound', () => watchInstalling(r.installing));
      if (r.waiting && navigator.serviceWorker.controller) activate(r.waiting);
    }).catch(() => { /* بدون service worker هم برنامه کار می‌کند */ });
  }

  setInterval(() => check(false), POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  setTimeout(() => check(false), 2500);
})();
