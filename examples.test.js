const { Interp } = require('./interp.js');
const { EXAMPLES } = require('./examples.js');
const S = require('./scene.js');
let fails = 0;
for (const ex of EXAMPLES) {
  const it = new Interp(ex.code); const mem = S.newMemory();
  let n = 0; const kinds = new Set(); let err = null; const titles = new Set();
  try {
    while (n < 20000) {
      const ok = it.stepInto(); n++;
      const cards = S.buildScene(it, mem, { bars: false });
      cards.forEach(c => { kinds.add(c.kind); titles.add(c.title); });
      if (!ok) break;
    }
  } catch (e) { err = e; }
  const bad = err || it.error || !it.finished;
  if (bad) fails++;
  console.log((bad ? 'FAIL ' : 'ok   ') + ex.id.padEnd(16) + String(n).padStart(5) + ' steps  kinds=' + [...kinds].join(',') +
    (it.error ? '  ERR ' + JSON.stringify(it.error) : '') + (err ? '  THROW ' + err.stack : ''));
}
// AVL semantic checks
{
  const ex = EXAMPLES.find(e => e.id === 'avl-insert');
  const it = new Interp(ex.code); while (it.stepInto()) {}
  const root = it.globals.vars.get('root');
  const inorder = o => o ? [...inorder(o.attrs.get('left')), o.attrs.get('key'), ...inorder(o.attrs.get('right'))] : [];
  const pre = o => o ? [o.attrs.get('key'), ...pre(o.attrs.get('left')), ...pre(o.attrs.get('right'))] : [];
  console.log('AVL inorder', inorder(root).join(','), ' preorder', pre(root).join(','), ' out:', it.out.map(o => o.text).join('|'));
  const ex2 = EXAMPLES.find(e => e.id === 'avl-delete');
  const it2 = new Interp(ex2.code); while (it2.stepInto()) {}
  const r2 = it2.globals.vars.get('root');
  console.log('AVL-del inorder', inorder(r2).join(','), ' preorder', pre(r2).join(','));
}
process.exit(fails ? 1 : 0);
