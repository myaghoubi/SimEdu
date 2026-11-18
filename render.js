/* ==========================================================================
   نمایش گرافیکی (SVG متحرک) برای توصیف‌های ساخته‌شده در scene.js
   ========================================================================== */
(function (root) {
'use strict';
const S = root.DSScene;
const NS = 'http://www.w3.org/2000/svg';
const R = 21;                                  // شعاع گره‌های دایره‌ای

const svgEl = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const h = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};
const approach = (cur, tgt, k) => (Math.abs(tgt - cur) < 0.12 ? tgt : cur + (tgt - cur) * k);
const fontFor = len => (len <= 2 ? 16 : len === 3 ? 14.5 : len === 4 ? 13 : len === 5 ? 11.5 : 10.5);

let cardCounter = 0;

class Card {
  constructor(viz, key, desc) {
    this.viz = viz; this.key = key; this.id = ++cardCounter;
    this.kind = desc.kind;
    this.el = h('section', 'card kind-' + desc.kind + (desc.wide ? ' wide' : ''));
    const head = h('header', 'card-head', this.el);
    this.titleEl = h('span', 'card-title', head);
    this.typeEl = h('span', 'card-type', head);
    this.metaEl = h('span', 'card-meta', head);
    this.nullEl = h('span', 'card-null', head);
    this.body = h('div', 'card-body', this.el);
    this.nodes = new Map(); this.edges = new Map(); this.tags = new Map();
    this.vb = null; this.vbT = null;
    this.rowVals = new Map();
    this.first = true;
    if (desc.kind !== 'object') {
      this.svg = svgEl('svg', { class: 'card-svg', preserveAspectRatio: 'xMidYMid meet' }, this.body);
      const defs = svgEl('defs', null, this.svg);
      const mk = (id, cls, shape) => {
        const m = svgEl('marker', { id: `m${this.id}-${id}`, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto' }, defs);
        svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: cls }, m);
      };
      mk('arrow', 'mk mk-edge'); mk('back', 'mk mk-back'); mk('parent', 'mk mk-parent'); mk('tag', 'mk mk-tag');
      this.gEdges = svgEl('g', { class: 'layer-edges' }, this.svg);
      this.gNodes = svgEl('g', { class: 'layer-nodes' }, this.svg);
      this.gTags = svgEl('g', { class: 'layer-tags' }, this.svg);
    }
  }

  /* ---------- ساخت نمای گره ---------- */
  makeNode(n) {
    const g = svgEl('g', { class: 'node ' + n.shape }, this.gNodes);
    const body = svgEl('g', { class: 'body' }, g);
    const v = { k: n.k, g, body, shape: n.shape, x: 0, y: 0, tx: 0, ty: 0, alpha: 0, ta: 1, w: n.w, h: n.h, bh: 0, tbh: 0, text: null, sub: null, cls: '', dying: false };
    const w = n.w, hh = n.h;
    switch (n.shape) {
      case 'cell':
        v.rect = svgEl('rect', { class: 'shape', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 7 }, body);
        v.flash = svgEl('rect', { class: 'flash', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 7 }, body);
        v.t = svgEl('text', { class: 'val', y: 0 }, body);
        v.s = svgEl('text', { class: 'sub', y: hh / 2 + 14 }, body);
        break;
      case 'bar':
        v.rect = svgEl('rect', { class: 'shape', x: -w / 2 + 3, y: -20, width: w - 6, height: 20, rx: 4 }, body);
        v.flash = svgEl('rect', { class: 'flash', x: -w / 2 + 3, y: -20, width: w - 6, height: 20, rx: 4 }, body);
        v.t = svgEl('text', { class: 'val', y: -26 }, body);
        v.s = svgEl('text', { class: 'sub', y: 14 }, body);
        break;
      case 'circle':
        v.rect = svgEl('circle', { class: 'shape', r: R }, body);
        v.flash = svgEl('circle', { class: 'flash', r: R }, body);
        v.t = svgEl('text', { class: 'val', y: 0 }, body);
        v.s = svgEl('text', { class: 'sub', y: R + 14 }, body);
        break;
      case 'lnode': case 'dlnode': {
        const dbl = n.shape === 'dlnode', pw = 26;
        v.rect = svgEl('rect', { class: 'shape', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 7 }, body);
        v.flash = svgEl('rect', { class: 'flash', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 7 }, body);
        svgEl('line', { class: 'divider', x1: w / 2 - pw, y1: -hh / 2, x2: w / 2 - pw, y2: hh / 2 }, body);
        if (dbl) svgEl('line', { class: 'divider', x1: -w / 2 + pw, y1: -hh / 2, x2: -w / 2 + pw, y2: hh / 2 }, body);
        v.t = svgEl('text', { class: 'val', x: dbl ? 0 : -pw / 2, y: 0 }, body);
        v.s = svgEl('text', { class: 'sub', y: hh / 2 + 14 }, body);
        v.pn = this.ptrCell(body, w / 2 - pw / 2, hh);
        if (dbl) v.pp = this.ptrCell(body, -w / 2 + pw / 2, hh);
        break;
      }
      default:
        v.t = svgEl('text', { class: 'val', y: 0 }, body);
        v.s = svgEl('text', { class: 'sub', y: 14 }, body);
    }
    return v;
  }
  ptrCell(body, cx, hh) {
    const g = svgEl('g', { class: 'ptrcell', transform: `translate(${cx},0)` }, body);
    const dot = svgEl('circle', { class: 'pdot', r: 3.6 }, g);
    const nul = svgEl('line', { class: 'pnull', x1: -8, y1: 8, x2: 8, y2: -8 }, g);
    return { g, dot, nul };
  }
  updateNode(v, n, existing) {
    const changed = existing && (v.text !== n.text || v.sub !== n.sub);
    v.w = n.w; v.h = n.h;
    if (v.t) {
      v.t.textContent = n.text;
      v.t.style.fontSize = (v.shape === 'label' ? 13 : fontFor(String(n.text).length)) + 'px';
    }
    if (v.s) v.s.textContent = n.sub || '';
    const cls = 'node ' + n.shape + (n.cls ? ' ' + n.cls : '') + (n.muted ? ' muted' : '');
    if (v.clsFull !== cls) { v.g.setAttribute('class', cls + (v.hot ? ' hot' : '')); v.clsFull = cls; }
    if (n.shape === 'lnode' || n.shape === 'dlnode') {
      const setP = (p, isNull) => { if (!p) return; p.dot.style.display = isNull ? 'none' : ''; p.nul.style.display = isNull ? '' : 'none'; };
      setP(v.pn, n.nullNext); setP(v.pp, n.nullPrev);
    }
    if (n.shape === 'bar') v.tbh = n.bh;
    if (changed && v.flash && this.viz.opts.anim) {
      try { v.flash.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 1000, easing: 'ease-out' }); } catch (e) { /* ignore */ }
      if (v.shape === 'bar' || v.shape === 'label') return;
    }
    v.text = n.text; v.sub = n.sub;
  }

  /* ---------- اعمال توصیف جدید ---------- */
  apply(desc) {
    this.desc = desc;
    this.titleEl.textContent = desc.title;
    this.typeEl.textContent = desc.typeFa;
    this.metaEl.textContent = desc.meta || '';
    this.nullEl.textContent = desc.nullTags && desc.nullTags.length ? desc.nullTags.map(t => t + ' = None').join('  ') : '';
    this.el.className = 'card kind-' + desc.kind + (desc.wide ? ' wide' : '');
    if (desc.kind === 'object') { this.applyObject(desc); this.first = false; return; }

    const anim = this.viz.opts.anim && !this.first;
    const seen = new Set();
    for (const n of desc.nodes) {
      seen.add(n.k);
      let v = this.nodes.get(n.k);
      const p = desc.pos[n.k];
      const existing = !!v && !v.dying;
      if (!v) {
        v = this.makeNode(n); this.nodes.set(n.k, v);
        v.x = v.tx = p.x; v.y = v.ty = p.y;
        v.alpha = this.viz.opts.anim ? 0 : 1;
        if (anim) { try { v.body.animate([{ transform: 'scale(.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' }); } catch (e) { /* ignore */ } }
        if (n.shape === 'bar') v.bh = n.bh;
      }
      v.dying = false; v.ta = 1; v.tx = p.x; v.ty = p.y;
      this.updateNode(v, n, existing);
    }
    for (const [k, v] of this.nodes) if (!seen.has(k)) { v.dying = true; v.ta = 0; }

    const seenE = new Set();
    for (const e of desc.edges) {
      seenE.add(e.k);
      let ev = this.edges.get(e.k);
      const A = this.nodes.get(e.a), B = this.nodes.get(e.b);
      if (!A || !B) continue;
      if (!ev) {
        const cls = 'edge ' + e.style;
        const path = svgEl('path', { class: cls }, this.gEdges);
        const label = e.label ? svgEl('text', { class: 'elabel' }, this.gEdges) : null;
        ev = { k: e.k, path, label, alpha: 0, ta: 1, flash: anim ? 1 : 0, style: e.style, dying: false };
        this.edges.set(e.k, ev);
        const mk = { tree: null, g: 'arrow', gu: null, next: 'arrow', nextback: 'back', prev: 'arrow', back: 'back', parent: 'parent' }[e.style];
        if (mk) path.setAttribute('marker-end', `url(#m${this.id}-${mk})`);
      }
      ev.A = A; ev.B = B; ev.dying = false; ev.ta = 1; ev.dbl = e.dbl;
      if (ev.label) ev.label.textContent = e.label || '';
    }
    for (const [k, ev] of this.edges) if (!seenE.has(k)) { ev.dying = true; ev.ta = 0; }

    // برچسب‌های اشاره‌گر
    const slots = new Map(); const seenT = new Set();
    for (const t of desc.tags) {
      const id = t.label + '\u0001' + t.target;
      const slot = slots.get(t.target) || 0; slots.set(t.target, slot + 1);
      let tv = this.tags.get(t.label);
      const tgt = this.nodes.get(t.target);
      if (!tgt) continue;
      seenT.add(t.label);
      if (!tv) {
        const g = svgEl('g', { class: 'tag' }, this.gTags);
        const line = svgEl('line', { class: 'tagline', 'marker-end': `url(#m${this.id}-tag)` }, g);
        const rect = svgEl('rect', { class: 'tagbox', height: 18, rx: 9, y: -9 }, g);
        const text = svgEl('text', { class: 'tagtext' }, g);
        text.textContent = t.label;
        const tw = Math.max(22, t.label.length * 7.2 + 14);
        rect.setAttribute('width', tw); rect.setAttribute('x', -tw / 2);
        tv = { g, line, rect, text, tw, x: 0, y: 0, alpha: 0, ta: 1, fresh: true, label: t.label };
        this.tags.set(t.label, tv);
      }
      tv.target = tgt; tv.slot = slot; tv.below = !!t.below || desc.tagSide === 'below'; tv.ta = 1; tv.dying = false;
      tv.cls = 'tag c' + (S.hashStr(t.label) % 8) + (t.level === 'caller' ? ' faint' : '');
      if (tv.g.getAttribute('class') !== tv.cls) tv.g.setAttribute('class', tv.cls);
      tv.level = t.level;
    }
    for (const [k, tv] of this.tags) if (!seenT.has(k)) { tv.ta = 0; tv.dying = true; }

    // گره‌هایی که اشاره‌گر فعال دارند
    const hot = new Set(desc.tags.filter(t => t.level !== 'caller').map(t => t.target));
    for (const v of this.nodes.values()) {
      const on = hot.has(v.k);
      if (on !== !!v.hot) { v.hot = on; v.g.classList.toggle('hot', on); }
    }
    this.fit();
    if (!this.viz.opts.anim || this.first) this.snap();
    this.first = false;
  }

  tagPos(tv, useTarget) {
    const v = tv.target;
    const vx = useTarget ? v.tx : v.x, vy = useTarget ? v.ty : v.y;
    const off = tv.slot * 21;
    if (tv.below) {
      const bottom = vy + (v.shape === 'bar' ? 0 : v.h / 2);
      return { x: vx, y: bottom + 36 + off, ax: vx, ay: bottom + (v.shape === 'bar' ? 22 : 20) + 2, py: -9 };
    }
    const top = vy - (v.shape === 'circle' ? R : v.h / 2);
    const px = v.shape === 'circle' ? vx - tv.tw / 2 + 10 : vx;
    return { x: px, y: top - 20 - off, ax: vx, ay: top - 1, py: 9 };
  }

  fit() {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, any = false;
    const ext = (x0, y0, x1, y1) => { any = true; if (x0 < minX) minX = x0; if (x1 > maxX) maxX = x1; if (y0 < minY) minY = y0; if (y1 > maxY) maxY = y1; };
    for (const v of this.nodes.values()) {
      if (v.dying) continue;
      const hw = v.w / 2;
      const top = v.shape === 'bar' ? v.ty - v.tbh - 30 : v.ty - v.h / 2;
      const bot = v.shape === 'bar' ? v.ty + 22 : v.ty + v.h / 2 + (v.sub ? 20 : (v.shape === 'cell' ? 20 : 0));
      ext(v.tx - hw, top, v.tx + hw, bot);
    }
    for (const tv of this.tags.values()) {
      if (tv.dying || !tv.target) continue;
      const p = this.tagPos(tv, true);
      ext(p.x - tv.tw / 2, p.y - 12, p.x + tv.tw / 2, p.y + 12);
    }
    if (!any) { minX = -60; maxX = 60; minY = -30; maxY = 30; }
    const pad = 22;
    const cw0 = maxX - minX + pad * 2, ch0 = maxY - minY + pad * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const cw = this.svg.clientWidth || this.body.clientWidth || 420;
    const maxH = this.kind === 'matrix' || this.kind === 'btree' || this.kind === 'tree' || this.kind === 'graph' ? 460 : 340;
    const scale = Math.min(1.2, cw / cw0, maxH / ch0);
    const elemH = Math.max(this.kind === 'array' ? 96 : 110, Math.min(maxH, ch0 * scale));
    const vw = cw / scale, vh = elemH / scale;
    this.svg.style.height = elemH + 'px';
    this.vbT = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
    if (!this.vb) this.vb = Object.assign({}, this.vbT);
  }
  snap() {
    for (const v of this.nodes.values()) { v.x = v.tx; v.y = v.ty; v.alpha = v.ta; v.bh = v.tbh; }
    for (const ev of this.edges.values()) { ev.alpha = ev.ta; ev.flash = 0; }
    for (const tv of this.tags.values()) { if (tv.target) { const p = this.tagPos(tv, true); tv.x = p.x; tv.y = p.y; } tv.alpha = tv.ta; tv.fresh = false; }
    if (this.vbT) this.vb = Object.assign({}, this.vbT);
    this.frame(0, 1, true);
  }

  /* ---------- هندسهٔ یال‌ها ---------- */
  edgeGeom(ev) {
    const A = ev.A, B = ev.B, st = ev.style;
    const f = n => Math.round(n * 10) / 10;
    let d = '', lx = 0, ly = 0;
    const shorten = (ax, ay, bx, by, ra, rb) => {
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      return [ax + dx / L * ra, ay + dy / L * ra, bx - dx / L * rb, by - dy / L * rb];
    };
    if (st === 'next' || st === 'nextback' || st === 'prev') {
      const lane = ev.dbl ? (st === 'prev' ? 9 : -9) : 0;
      if (st === 'prev') {
        const sx = A.x - A.w / 2 + 13, sy = A.y + lane, ex = B.x + B.w / 2, ey = B.y + lane, dx = ex - sx;
        d = `M${f(sx)},${f(sy)} C${f(sx + dx * .5)},${f(sy)} ${f(ex - dx * .5)},${f(ey)} ${f(ex)},${f(ey)}`;
        lx = (sx + ex) / 2; ly = sy - 8;
      } else if (st === 'next' && B.x > A.x) {
        const sx = A.x + A.w / 2 - 13, sy = A.y + lane, ex = B.x - B.w / 2, ey = B.y + lane, dx = ex - sx;
        d = `M${f(sx)},${f(sy)} C${f(sx + dx * .5)},${f(sy)} ${f(ex - dx * .5)},${f(ey)} ${f(ex)},${f(ey)}`;
        lx = (sx + ex) / 2; ly = sy - 8;
      } else {
        const sx = A.x + A.w / 2 - 13, sy = A.y - 4, ex = B.x, ey = B.y - B.h / 2 - 1;
        const up = Math.min(sy, ey) - 52;
        d = `M${f(sx)},${f(sy)} C${f(sx + 10)},${f(up)} ${f(ex)},${f(up - 10)} ${f(ex)},${f(ey)}`;
        lx = (sx + ex) / 2; ly = up;
      }
    } else if (A === B) {
      d = `M${f(A.x - 10)},${f(A.y - R + 2)} C${f(A.x - 40)},${f(A.y - 70)} ${f(A.x + 40)},${f(A.y - 70)} ${f(A.x + 10)},${f(A.y - R + 2)}`;
      lx = A.x; ly = A.y - 64;
    } else if (st === 'back' || st === 'parent') {
      const [x1, y1, x2, y2] = shorten(A.x, A.y, B.x, B.y, R, R + 4);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const off = st === 'parent' ? 26 : 34;
      const cx = mx - dy / L * off, cy = my + dx / L * off;
      d = `M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}`;
      lx = (mx + cx) / 2; ly = (my + cy) / 2;
    } else {
      const rb = st === 'g' ? R + 4 : R;
      const [x1, y1, x2, y2] = shorten(A.x, A.y, B.x, B.y, R, rb);
      d = `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}`;
      lx = (x1 + x2) / 2; ly = (y1 + y2) / 2;
    }
    return { d, lx, ly };
  }

  /* ---------- هر فریم ---------- */
  frame(dt, k, force) {
    let active = false;
    const snap = force || !this.viz.opts.anim;
    const kk = snap ? 1 : k;
    for (const [key, v] of this.nodes) {
      const ox = v.x, oy = v.y, oa = v.alpha, ob = v.bh;
      v.x = approach(v.x, v.tx, kk); v.y = approach(v.y, v.ty, kk);
      v.alpha = approach(v.alpha, v.ta, kk); v.bh = approach(v.bh, v.tbh, kk);
      if (v.x !== ox || v.y !== oy || v.alpha !== oa || v.bh !== ob || v.x !== v.tx || v.y !== v.ty || v.alpha !== v.ta) active = true;
      if (v.dying && v.alpha <= 0.02) { v.g.remove(); this.nodes.delete(key); continue; }
      v.g.setAttribute('transform', `translate(${v.x.toFixed(1)},${v.y.toFixed(1)})`);
      v.g.style.opacity = v.alpha.toFixed(2);
      if (v.shape === 'bar') {
        const bh = Math.max(2, v.bh);
        v.rect.setAttribute('y', -bh); v.rect.setAttribute('height', bh);
        v.flash.setAttribute('y', -bh); v.flash.setAttribute('height', bh);
        v.t.setAttribute('y', -bh - 9);
      }
    }
    for (const [key, ev] of this.edges) {
      if (!ev.A || !ev.B) continue;
      ev.alpha = approach(ev.alpha, ev.ta, kk);
      if (ev.alpha !== ev.ta) active = true;
      if (ev.dying && ev.alpha <= 0.02) { ev.path.remove(); if (ev.label) ev.label.remove(); this.edges.delete(key); continue; }
      const g = this.edgeGeom(ev);
      ev.path.setAttribute('d', g.d);
      ev.path.style.opacity = ev.alpha.toFixed(2);
      if (ev.flash > 0) {
        ev.flash = Math.max(0, ev.flash - dt / 1.1); active = true;
        ev.path.classList.add('fresh');
        if (ev.flash === 0) ev.path.classList.remove('fresh');
      }
      if (ev.label) { ev.label.setAttribute('x', g.lx.toFixed(1)); ev.label.setAttribute('y', g.ly.toFixed(1)); ev.label.style.opacity = ev.alpha.toFixed(2); }
    }
    for (const [key, tv] of this.tags) {
      if (!tv.target) continue;
      const p = this.tagPos(tv, false);
      if (tv.fresh) { tv.x = p.x; tv.y = p.y; tv.fresh = false; }
      const ox = tv.x, oy = tv.y;
      tv.x = approach(tv.x, p.x, kk); tv.y = approach(tv.y, p.y, kk);
      tv.alpha = approach(tv.alpha, tv.ta, kk);
      if (tv.x !== ox || tv.y !== oy || tv.x !== p.x || tv.y !== p.y || tv.alpha !== tv.ta) active = true;
      if (tv.dying && tv.alpha <= 0.02) { tv.g.remove(); this.tags.delete(key); continue; }
      tv.g.setAttribute('transform', `translate(${tv.x.toFixed(1)},${tv.y.toFixed(1)})`);
      tv.g.style.opacity = (tv.alpha * (tv.level === 'caller' ? 0.5 : 1)).toFixed(2);
      tv.text.setAttribute('x', 0); tv.text.setAttribute('y', 0);
      // خط اتصال (در دستگاه مختصات برچسب)
      tv.line.setAttribute('x1', (p.ax - tv.x) * 0.0 + 0); tv.line.setAttribute('y1', tv.below ? -9 : 9);
      tv.line.setAttribute('x2', (p.ax - tv.x).toFixed(1)); tv.line.setAttribute('y2', (p.ay - tv.y).toFixed(1));
    }
    if (this.vb && this.vbT) {
      const o = this.vb, t = this.vbT;
      const a = Object.assign({}, o);
      for (const q of ['x', 'y', 'w', 'h']) o[q] = approach(o[q], t[q], kk);
      if (['x', 'y', 'w', 'h'].some(q => o[q] !== t[q])) active = true;
      this.svg.setAttribute('viewBox', `${o.x.toFixed(1)} ${o.y.toFixed(1)} ${o.w.toFixed(1)} ${o.h.toFixed(1)}`);
    }
    return active;
  }

  /* ---------- کارت شیء (جدول ویژگی‌ها) ---------- */
  applyObject(desc) {
    this.body.textContent = '';
    const tbl = h('table', 'obj-table', this.body);
    const nextVals = new Map();
    for (const r of desc.rows) {
      const tr = h('tr', null, tbl);
      h('td', 'obj-name', tr, r.name);
      const td = h('td', 'obj-val ' + (r.ref ? 'ref-' + r.ref : '') + (r.none ? ' none' : ''), tr, r.text);
      td.setAttribute('dir', 'ltr');
      nextVals.set(r.name, r.text);
      if (this.rowVals.has(r.name) && this.rowVals.get(r.name) !== r.text && this.viz.opts.anim) {
        try { td.animate([{ background: 'var(--flash)' }, { background: 'transparent' }], { duration: 1100, easing: 'ease-out' }); } catch (e) { /* ignore */ }
      }
    }
    if (!desc.rows.length) h('div', 'obj-empty', this.body, 'بدون ویژگی');
    this.rowVals = nextVals;
  }
  leave() {
    this.el.classList.add('leaving');
    setTimeout(() => this.el.remove(), 260);
  }
}

/* ===================================================================== */
class Viz {
  constructor(container, opts) {
    this.container = container;
    this.opts = Object.assign({ bars: false, anim: true, speed: 1 }, opts || {});
    this.cards = new Map();
    this.mem = S.newMemory();
    this.raf = 0; this.last = 0;
    this.emptyEl = h('div', 'viz-empty', container);
    this.emptyEl.innerHTML = '<div class="viz-empty-ico" aria-hidden="true">◎</div><div>هنوز ساختاری ساخته نشده است.<br>کد را گام‌به‌گام اجرا کنید تا آرایه‌ها، لیست‌ها، درخت‌ها و گراف‌ها اینجا ظاهر شوند.</div>';
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => { for (const c of this.cards.values()) if (c.svg) { c.fit(); this.kick(); } });
      this.ro.observe(container);
    }
  }
  reset() {
    for (const c of this.cards.values()) c.el.remove();
    this.cards.clear(); this.mem = S.newMemory();
    this.emptyEl.style.display = '';
  }
  update(interp, o) {
    o = o || {};
    const descs = S.buildScene(interp, this.mem, { bars: this.opts.bars });
    const live = new Set(descs.map(d => d.key));
    for (const [k, c] of this.cards) if (!live.has(k)) { c.leave(); this.cards.delete(k); }
    for (const d of descs) {
      let c = this.cards.get(d.key);
      if (c && (!!c.svg) !== (d.kind !== 'object')) { c.el.remove(); this.cards.delete(d.key); c = null; }
      if (!c) { c = new Card(this, d.key, d); this.cards.set(d.key, c); }
      c.kind = d.kind;
      c.apply(d);
      if (o.snap) c.snap();
    }
    let ref = this.emptyEl;
    for (const d of descs) {
      const el = this.cards.get(d.key).el;
      if (ref.nextElementSibling !== el) ref.after(el);
      ref = el;
    }
    this.emptyEl.style.display = descs.length ? 'none' : '';
    this.kick();
  }
  kick() { if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(t => this.tick(t)); } }
  tick(t) {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016;
    this.last = t;
    const k = 1 - Math.exp(-dt * 13 * this.opts.speed);
    let active = false;
    for (const c of this.cards.values()) if (c.svg && c.frame(dt, k)) active = true;
    if (active) this.raf = requestAnimationFrame(t2 => this.tick(t2)); else this.raf = 0;
  }
}

root.DSViz = { Viz };
})(typeof window !== 'undefined' ? window : globalThis);
