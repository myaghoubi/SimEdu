/* Service worker — کش آفلاین + بروزرسانی نسخه‌دار
   شماره‌ی نسخه از version.js می‌آید. مرورگر محتوای فایل‌های importScripts را هم برای تشخیص
   تغییر بررسی می‌کند؛ پس عوض‌شدن شماره‌ی نسخه یک service worker جدید می‌سازد. */
importScripts('version.js');

const CACHE = 'ds-visualizer-v' + self.APP_VERSION;
const FILES = [
  './', 'index.html', 'style.css', 'version.js', 'shell.js', 'update.js',
  'lib/follow.js', 'lib/stepper.js', 'sims/stack-queue.js', 'sims/graph-traversal.js', 'sims/changelog.js', 'sims/avl.js', 'lib/automata.js', 'sims/pda.js', 'sims/turing.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'fonts/IRANSansWeb.woff2', 'fonts/IRANSansWeb_Medium.woff2', 'fonts/IRANSansWeb_Bold.woff2'
];

/* گزارش پیشرفت دانلود فایل‌ها به صفحه (برای نوار پیشرفت روی دکمه‌ی بروزرسانی) */
async function report(done, total) {
  const cs = await self.clients.matchAll({ includeUncontrolled: true });
  cs.forEach((c) => c.postMessage({ type: 'PROGRESS', done, total, version: self.APP_VERSION }));
}

self.addEventListener('install', (e) => {
  let done = 0;
  report(0, FILES.length);
  /* cache:'reload' یعنی حتماً از شبکه، نه از کش HTTP مرورگر */
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) =>
    fetch(new Request(f, { cache: 'reload' })).then((r) => {
      if (!r.ok) throw new Error('precache failed: ' + f);
      return c.put(f, r).then(() => report(++done, FILES.length));
    })
  ))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* صفحه پس از دانلود کامل نسخه‌ی جدید، فعال‌سازی را درخواست می‌کند */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* درخواست‌های بررسی نسخه (?_=...) همیشه مستقیم از شبکه می‌روند */
  if (url.origin !== location.origin || url.searchParams.has('_')) return;
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }).catch(() => c.match('index.html'))))
  );
});
