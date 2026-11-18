# ساختمان داده – آموزش تصویری (PWA)

همهٔ فایل‌ها در یک سطح (بدون پوشه) هستند. `index.html` صفحهٔ اصلی است.

## انتشار با GitHub Pages (بدون workflow)
1. همهٔ فایل‌ها را در ریشهٔ یک مخزن آپلود کنید.
2. Settings ← Pages ← Source: **Deploy from a branch** ← Branch: `main` و پوشهٔ `/ (root)` ← Save.
3. بعد از چند دقیقه: `https://<USER>.github.io/<REPO>/`

اجرای محلی: `python3 -m http.server 8080` و باز کردن `http://localhost:8080`. آزمون‌ها: `npm test` (Node 18+).
با هر تغییر فایل‌ها، `VERSION` را در `sw.js` عوض کنید تا کش قدیمی تازه شود.
