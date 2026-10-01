/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT stage — direct manipulation on the canvas (the "PowerPoint toolkit").
   Selection, move, resize, rotate, snapping guides, marquee, keyboard, clipboard, z-order, align, insert.

   What can be selected (St.sel is a list of these):
     { k:'o', id }     a free-form object (text / shape / image / icon)         → move, resize, rotate, full formatting
     { k:'t', key }    a text field the layout generated  (key = its data-path) → move, font, size, colour... (tweaks)
     { k:'l', key }    a card / row the layout generated  (key = "items.2")     → move (tweaks)
   Everything is committed through the store (one undo step per gesture). While dragging, the DOM is moved directly.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, E = PC.editor, { $, $$ } = UI, esc = PC.esc;
const St = PC.stage = { sel: [], frame: -1, drag: null, editing: null, live: {} };   // live: in-flight geometry while a gesture is running
const r1 = n => Math.round(n * 10) / 10, clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const MIN = 8, SW = 1280, SH = 720;

/* ── lookups ── */
const slideNow = () => (St.frame >= 0 ? S.slide(St.frame) : null);
const frameEl = () => (St.frame >= 0 ? E.frameEl(St.frame) : null);
const stageEl = () => { const f = frameEl(); return f ? $('.stage', f) : null; };
const objs = () => { const s = slideNow(); return (s && s.objects) || []; };
const objById = id => objs().find(o => o.id === id);
const keyOf = it => (it.k === 'o' ? it.id : it.key);
const same = (a, b) => a.k === b.k && keyOf(a) === keyOf(b);
function elOf(it) {
  const st = stageEl(); if (!st) return null;
  if (it.k === 'o') return st.querySelector(`.ob[data-obj="${CSS.escape(it.id)}"]`);
  if (it.k === 't') return Array.from(st.querySelectorAll('[data-path]')).find(e => e.dataset.path === it.key && !e.closest('.ob')) || null;
  const m = it.key.match(/^(.+)\.(\d+)$/); return m ? st.querySelector(`[data-list="${CSS.escape(m[1])}"][data-idx="${m[2]}"]`) : null;
}
/** Bounding box in stage pixels. Objects use their data (plus measured height for auto-height text); generated elements are measured. */
function rectOf(it) {
  if (it.k === 'o') { const o = objById(it.id), el = elOf(it), L = St.live[it.id] || {}; if (!o) return null; return { x: L.x != null ? L.x : o.x, y: L.y != null ? L.y : o.y, w: L.w != null ? L.w : o.w, h: L.h != null ? L.h : o.h != null ? o.h : (el ? el.offsetHeight : 60), rot: L.rot != null ? L.rot : o.rot || 0 }; }
  const el = elOf(it), st = stageEl(); if (!el || !st) return null;
  const a = el.getBoundingClientRect(), b = st.getBoundingClientRect(), k = E.k || 1;
  return { x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k, rot: 0 };
}
const exists = it => (it.k === 'o' ? !!objById(it.id) : !!elOf(it));

/* ── selection ── */
St.has = () => St.sel.length > 0;
St.targets = () => St.sel.map(it => ({ k: it.k, key: keyOf(it), obj: it.k === 'o' ? objById(it.id) : null, tweak: it.k !== 'o' ? ((slideNow() || {}).tweaks || {})[it.key] || null : null }));
St.setSel = function (items, frame) {
  const f = frame == null ? S.sel : frame;
  if (f !== St.frame) St.sel = [];
  St.frame = f; St.sel = items;
  St.layout(); S.emit('stage');
};
St.clear = function () { if (!St.sel.length && St.frame === -1) return; St.sel = []; St.editing = null; St.layout(); S.emit('stage'); };
St.selectObject = function (id, add) {
  const it = { k: 'o', id }; let items = St.sel.filter(x => x.k === 'o' || add);
  if (add) items = items.some(x => same(x, it)) ? items.filter(x => !same(x, it)) : items.concat(it); else items = [it];
  St.setSel(items);
};
St.selectAllObjects = () => { const ids = objs().map(o => ({ k: 'o', id: o.id })); if (ids.length) St.setSel(ids); return ids.length; };
const validate = () => {
  if (St.frame !== S.sel || St.frame < 0) { St.sel = []; return; }
  const keep = St.sel.filter(exists); if (keep.length !== St.sel.length) { St.sel = keep; S.emit('stage'); }
};

/* ── overlay (selection boxes, handles, guides) — lives in .frame-box, in screen pixels, never inside the scaled stage ── */
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const hpos = { n: ['50%', '0'], s: ['50%', '100%'], e: ['100%', '50%'], w: ['0', '50%'], nw: ['0', '0'], ne: ['100%', '0'], sw: ['0', '100%'], se: ['100%', '100%'] };
let layoutRaf = 0;
St.layout = function () {
  cancelAnimationFrame(layoutRaf);
  $$('.sel-layer').forEach(n => n.remove());
  validate();
  const fr = frameEl(); if (!fr || !St.sel.length) return;
  const host = $('.frame-box', fr), k = E.k || 1, layer = document.createElement('div'), single = St.sel.length === 1;
  layer.className = 'sel-layer'; layer.setAttribute('aria-hidden', 'true');
  St.sel.forEach(it => {
    const r = rectOf(it); if (!r) return;
    const b = document.createElement('div'); b.className = 'sel-box ' + (it.k === 'o' ? 'is-obj' : 'is-fx') + (St.editing && it.k === 'o' && St.editing === it.id ? ' is-editing' : '');
    b.style.cssText = `left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px;${r.rot ? `rotate:${r.rot}deg;` : ''}`;
    if (it.k === 'o' && !St.editing && document.documentElement.classList.contains('touch-ui')) {   // a finger can drag a selected object by its body (touch-action: none lives on this layer only)
      const bo = objById(it.id); if (bo && !bo.locked && bo.type !== 'line') { const n = document.createElement('i'); n.className = 'sel-body'; n.dataset.h = 'move'; n.dataset.oid = it.id; b.appendChild(n); }
    }
    if (single && !St.editing) {
      const lo = it.k === 'o' ? objById(it.id) : null;
      if (lo && lo.type === 'line' && !lo.locked) {   // a line has two end handles (and a bend handle for elbows and curves), not a resize box
        b.classList.add('is-line');
        const g = PC.lineGeom(lo, lo.w, lo.h || 0), mk = (cls, h, x, y, tip) => { const n = document.createElement('i'); n.className = 'sel-h ' + cls; n.dataset.h = h; n.style.cssText = `left:${x * k}px;top:${y * k}px;`; n.title = tip; b.appendChild(n); };
        mk('sel-end', 'start', g.start[0], g.start[1], 'Drag to move the start'); mk('sel-end', 'end', g.end[0], g.end[1], 'Drag to move the end');
        if (lo.kind && lo.kind !== 'straight') mk('sel-bend', 'bend', g.mid[0], g.mid[1], 'Drag to move the corner');
        if (lo.from || lo.to) b.classList.add('is-glued');
      } else if (lo && lo.locked) { b.classList.add('is-locked'); }
      else if (it.k === 'o') {
        const o = lo, hs = o.type === 'text' ? HANDLES.filter(h => o.h != null || !/^[ns]$/.test(h)) : HANDLES;
        hs.forEach(h => { const n = document.createElement('i'); n.className = 'sel-h'; n.dataset.h = h; n.style.cssText = `left:${hpos[h][0]};top:${hpos[h][1]};cursor:${h.length === 2 ? (h === 'nw' || h === 'se' ? 'nwse' : 'nesw') : h === 'n' || h === 's' ? 'ns' : 'ew'}-resize`; b.appendChild(n); });
        const rot = document.createElement('i'); rot.className = 'sel-h sel-rot'; rot.dataset.h = 'rotate'; b.appendChild(rot);
      }
      if (!(lo && (lo.type === 'line' || lo.locked))) ['t', 'r', 'b', 'l'].forEach(s => { const n = document.createElement('i'); n.className = 'sel-edge ' + s; n.dataset.h = 'move'; b.appendChild(n); });
      if (it.k !== 'o') { const g = document.createElement('i'); g.className = 'sel-grip'; g.dataset.h = 'move'; g.title = 'Drag to move'; g.innerHTML = PC.icon('move', 14); b.appendChild(g); }
    }
    layer.appendChild(b);
  });
  host.appendChild(layer);
};
const relayout = () => { cancelAnimationFrame(layoutRaf); layoutRaf = requestAnimationFrame(() => St.layout()); };
function drawGuides(guides) {
  const layer = $('.sel-layer', frameEl() || document); if (!layer) return; $$('.sel-guide', layer).forEach(n => n.remove()); const k = E.k || 1;
  guides.forEach(g => { const n = document.createElement('i'); n.className = 'sel-guide ' + g.axis; n.style[g.axis === 'x' ? 'left' : 'top'] = g.pos * k + 'px'; layer.appendChild(n); });
}

/* ── writing to the deck ── */
const nearly = (a, b) => Math.abs(a - b) < .05;
function mutateObjects(fn, key, src) { S.mutate(St.frame, s => { s.objects = s.objects || []; fn(s.objects, s); }, key || '', src || 'stage'); }
/** Apply a property patch to every selected item. Values of null delete the property. Everything is re-validated by the sanitisers. */
St.patch = function (patch, key, src) {
  if (!St.sel.length) return false;
  const tweaks = ['dx', 'dy', 'font', 'size', 'weight', 'italic', 'underline', 'caps', 'align', 'color', 'lh', 'ls'];
  S.mutate(St.frame, s => {
    St.sel.forEach(it => {
      if (it.k === 'o') {
        const i = (s.objects || []).findIndex(o => o.id === it.id); if (i < 0) return;
        const m = Object.assign({}, s.objects[i]); Object.keys(patch).forEach(p => { if (patch[p] === null) delete m[p]; else m[p] = patch[p]; });
        s.objects[i] = PC.cleanObject(m, new Set(s.objects.filter((_, j) => j !== i).map(o => o.id))) || s.objects[i];
      } else {
        s.tweaks = s.tweaks || {}; const m = Object.assign({}, s.tweaks[it.key]);
        tweaks.forEach(p => { if (!(p in patch)) return; if (patch[p] === null) delete m[p]; else m[p] = patch[p]; });
        const c = PC.cleanTweaks({ [it.key]: m }); if (c[it.key]) s.tweaks[it.key] = c[it.key]; else delete s.tweaks[it.key];
        if (!Object.keys(s.tweaks).length) delete s.tweaks;
      }
    });
  }, key == null ? 'fmt' : key, src || 'inspector');
  relayout(); return true;
};
St.resetTweaks = function () {
  const ks = St.sel.filter(it => it.k !== 'o').map(it => it.key); if (!ks.length) return;
  S.mutate(St.frame, s => { ks.forEach(k => { if (s.tweaks) delete s.tweaks[k]; }); if (s.tweaks && !Object.keys(s.tweaks).length) delete s.tweaks; }, '', 'stage'); relayout();
};
St.remove = function () {
  const ids = St.sel.filter(it => it.k === 'o' && !(objById(it.id) || {}).locked).map(it => it.id); if (!ids.length) { if (!St.sel.some(it => it.k === 'o')) St.resetTweaks(); return false; }
  mutateObjects(a => { for (let i = a.length - 1; i >= 0; i--) if (ids.includes(a[i].id)) a.splice(i, 1); });
  St.sel = St.sel.filter(it => it.k !== 'o'); St.editing = null; St.layout(); S.emit('stage'); return true;
};
St.duplicate = function () {
  const src = St.sel.filter(it => it.k === 'o').map(it => objById(it.id)).filter(Boolean); if (!src.length) return false; const made = [];
  const gmap = {}; mutateObjects(a => { src.forEach(o => { const c = PC.clone(o); c.id = ''; c.x = r1(o.x + 24); c.y = r1(o.y + 24); delete c.from; delete c.to; if (c.group) c.group = gmap[c.group] = gmap[c.group] || newGroupId(); const n = PC.cleanObject(c, new Set(a.map(x => x.id))); a.push(n); made.push({ k: 'o', id: n.id }); }); });
  St.setSel(made); return true;
};
St.nudge = function (dx, dy) {
  if (!St.sel.length) return;
  S.mutate(St.frame, s => St.sel.forEach(it => {
    if (it.k === 'o') { const o = (s.objects || []).find(x => x.id === it.id); if (o && !o.locked) { o.x = r1(o.x + dx); o.y = r1(o.y + dy); if (o.type !== 'line') return; delete o.from; delete o.to; } }
    else { s.tweaks = s.tweaks || {}; const t = s.tweaks[it.key] = s.tweaks[it.key] || {}; t.dx = r1((t.dx || 0) + dx); t.dy = r1((t.dy || 0) + dy); }
  }), 'nudge', 'stage'); relayout();
};
/** Reorder within the slide's object list (later = on top). */
St.order = function (how) {
  const ids = St.sel.filter(it => it.k === 'o').map(it => it.id); if (!ids.length) return;
  mutateObjects(a => {
    const sel = a.filter(o => ids.includes(o.id)), rest = a.filter(o => !ids.includes(o.id));
    if (how === 'front') a.splice(0, a.length, ...rest, ...sel);
    else if (how === 'back') a.splice(0, a.length, ...sel, ...rest);
    else { const step = how === 'forward' ? 1 : -1, order = step > 0 ? [...a.keys()].reverse() : [...a.keys()]; order.forEach(i => { const o = a[i]; if (!ids.includes(o.id)) return; const j = i + step; if (j < 0 || j >= a.length || ids.includes(a[j].id)) return; [a[i], a[j]] = [a[j], a[i]]; }); }
  });
  relayout();
};
St.align = function (how) {
  const items = St.sel.filter(it => it.k === 'o'); if (!items.length) return;
  const rects = items.map(it => Object.assign({ id: it.id }, rectOf(it)));
  const box = rects.length > 1 ? { x: Math.min(...rects.map(r => r.x)), y: Math.min(...rects.map(r => r.y)), r: Math.max(...rects.map(r => r.x + r.w)), b: Math.max(...rects.map(r => r.y + r.h)) } : { x: 0, y: 0, r: SW, b: SH };
  mutateObjects(a => rects.forEach(r => {
    const o = a.find(x => x.id === r.id); if (!o) return;
    if (how === 'left') o.x = r1(box.x); else if (how === 'right') o.x = r1(box.r - r.w); else if (how === 'center') o.x = r1((box.x + box.r) / 2 - r.w / 2);
    else if (how === 'top') o.y = r1(box.y); else if (how === 'bottom') o.y = r1(box.b - r.h); else if (how === 'middle') o.y = r1((box.y + box.b) / 2 - r.h / 2);
  }));
  relayout();
};
St.distribute = function (axis) {
  const items = St.sel.filter(it => it.k === 'o'); if (items.length < 3) return;
  const rects = items.map(it => Object.assign({ id: it.id }, rectOf(it))), X = axis === 'h';
  rects.sort((a, b) => (X ? a.x - b.x : a.y - b.y));
  const first = rects[0], last = rects[rects.length - 1], span = X ? last.x + last.w - first.x : last.y + last.h - first.y, total = rects.reduce((n, r) => n + (X ? r.w : r.h), 0), gap = (span - total) / (rects.length - 1);
  let pos = X ? first.x : first.y;
  mutateObjects(a => rects.forEach(r => { const o = a.find(x => x.id === r.id); if (o) { if (X) o.x = r1(pos); else o.y = r1(pos); } pos += (X ? r.w : r.h) + gap; }));
  relayout();
};

/* ── insert ── */
St.insert = function (type, over = {}) {
  let id = '';
  const s0 = S.slide(); if (!s0) return '';
  if ((s0.objects || []).length >= PC.LIMITS.objects) { UI.toast(`A slide can hold ${PC.LIMITS.objects} objects.`, 'bad'); return ''; }
  St.frame = S.sel;
  mutateObjects(a => {
    const o = PC.newObject(type, Object.assign({}, over), a);
    if (over.x == null) { while (a.some(e => Math.abs(e.x - o.x) < 6 && Math.abs(e.y - o.y) < 6)) { o.x += 24; o.y += 24; } }
    a.push(o); id = o.id;
  });
  St.setSel([{ k: 'o', id }]);
  const el = elOf({ k: 'o', id }); if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (type === 'text' && !St.edit(id, true)) setTimeout(() => St.edit(id, true), 30);   // straight into typing; the timer is only a fallback
  return id;
};
/** Shrink big pictures before they hit localStorage, and give every image a sensible starting size. */
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('That file could not be read as an image.')); im.src = src; }); }
St.insertImageFile = async function (file, at) {
  if (!file) return '';
  if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type)) { UI.toast('Please choose a PNG, JPEG, GIF, WebP or SVG image.', 'bad'); return ''; }
  if (file.size > 12 * 1024 * 1024) { UI.toast('That image is over 12 MB. Use a smaller one.', 'bad'); return ''; }
  try {
    let src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(file); });
    const im = await loadImage(src); let nw = im.naturalWidth || 640, nh = im.naturalHeight || 360;
    if (file.type !== 'image/svg+xml' && file.type !== 'image/gif' && (Math.max(nw, nh) > 1920 || file.size > 900 * 1024)) {
      const k = Math.min(1, 1920 / Math.max(nw, nh)), cv = document.createElement('canvas'); cv.width = Math.round(nw * k); cv.height = Math.round(nh * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); src = cv.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .86); nw = cv.width; nh = cv.height;
    }
    if (src.length > 3.2 * 1024 * 1024) { UI.toast('That image is still very large after shrinking. Use a smaller one or link to a URL.', 'bad'); return ''; }
    return St.placeImage(src, nw, nh, file.name.replace(/\.[^.]+$/, ''), at);
  } catch (e) { UI.toast(e.message || 'Could not add that image.', 'bad'); return ''; }
};
St.placeImage = function (src, nw, nh, alt, at) {
  const k = Math.min(1, 720 / nw, 440 / nh), w = Math.max(40, Math.round(nw * k)), h = Math.max(40, Math.round(nh * k));
  const over = { src, alt: alt || '', w, h }; if (at) { over.x = Math.round(at.x - w / 2); over.y = Math.round(at.y - h / 2); }
  return St.insert('image', over);
};
St.insertImageUrl = async function (url) {
  url = String(url || '').trim(); if (!PC.okUrl(url) || !url) { UI.toast('Use an https:// image address.', 'bad'); return ''; }
  try { const im = await loadImage(url); return St.placeImage(url, im.naturalWidth || 640, im.naturalHeight || 360, '', null); } catch (e) { return St.placeImage(url, 640, 360, '', null); }
};
St.pickImage = function () {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'; inp.hidden = true; document.body.appendChild(inp);
  inp.addEventListener('change', () => { St.insertImageFile(inp.files[0]); inp.remove(); }); inp.addEventListener('cancel', () => inp.remove()); inp.click();
};

/* ── text editing inside an object ── */
St.edit = function (id, selectAll) {
  const o = objById(id); if (!o || o.locked || (o.type !== 'text' && o.type !== 'shape')) return false;
  const el = elOf({ k: 'o', id }); const t = el && el.querySelector('.ob-t'); if (!t) return false;
  St.editing = id; t.setAttribute('contenteditable', PC.plainSupported ? 'plaintext-only' : 'true'); t.setAttribute('spellcheck', 'false'); t.dataset.ph = o.type === 'text' ? 'Text' : 'Type here';
  t.focus({ preventScroll: true });
  const r = document.createRange(); r.selectNodeContents(t); if (!selectAll) r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  St.layout(); return true;
};
function endEdit(t) {
  const ob = t.closest('.ob'); if (!ob) return; const id = ob.dataset.obj; t.removeAttribute('contenteditable'); t.dataset.ph = ob.dataset.type === 'text' ? 'Text' : '';
  if (St.editing === id) St.editing = null;
  const o = objById(id);
  if (o && o.type === 'text' && !String(o.text || '').trim()) { mutateObjects(a => { const i = a.findIndex(x => x.id === id); if (i >= 0) a.splice(i, 1); }); St.sel = St.sel.filter(it => !(it.k === 'o' && it.id === id)); S.emit('stage'); }
  St.layout();
}

/* ── snapping ── */
function snap(bbox, dx, dy, movingIds) {
  const thr = 7 / (E.k || 1), xs = [0, SW / 2, SW], ys = [0, SH / 2, SH], guides = [];
  objs().forEach(o => { if (movingIds.includes(o.id)) return; const h = o.h != null ? o.h : (elOf({ k: 'o', id: o.id }) || {}).offsetHeight || 60; xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + h / 2, o.y + h); });
  const best = (pos, targets) => { let b = null; pos.forEach(p => targets.forEach(t => { const d = t - p; if (Math.abs(d) < thr && (b === null || Math.abs(d) < Math.abs(b.d))) b = { d, t }; })); return b; };
  const bx = best([bbox.x + dx, bbox.x + dx + bbox.w / 2, bbox.x + dx + bbox.w], xs), by = best([bbox.y + dy, bbox.y + dy + bbox.h / 2, bbox.y + dy + bbox.h], ys);
  if (bx) { dx += bx.d; guides.push({ axis: 'x', pos: bx.t }); }
  if (by) { dy += by.d; guides.push({ axis: 'y', pos: by.t }); }
  return { dx, dy, guides };
}

/* ── gestures ── */
const applyObjEl = (o, cssOnly) => {
  const el = elOf({ k: 'o', id: o.id }); if (!el) return;
  if (!cssOnly && (o.type === 'shape' || o.type === 'line')) { const tpl = document.createElement('template'); tpl.innerHTML = PC.renderObject(o, +el.dataset.oi, { editable: true }); el.replaceWith(tpl.content.firstElementChild); return; }
  el.style.left = o.x + 'px'; el.style.top = o.y + 'px'; el.style.width = o.w + 'px'; if (o.h != null) el.style.height = o.h + 'px'; else el.style.height = '';
  if (o.rot) el.style.rotate = o.rot + 'deg'; else el.style.removeProperty('rotate');
  const t = el.querySelector('.ob-t'); if (t && o.type === 'text' && o.size) t.style.fontSize = o.size + 'px';
};
function beginMove(e) {
  const items = St.sel.filter(it => !(it.k === 'o' && (objById(it.id) || {}).locked)), snaps = items.map(it => ({ it, r: rectOf(it), o: it.k === 'o' ? PC.clone(objById(it.id)) : null, tw: it.k !== 'o' ? Object.assign({}, (slideNow().tweaks || {})[it.key]) : null }));
  if (!items.length) return;
  St.drag = { mode: 'move', sx: e.clientX, sy: e.clientY, moved: false, snaps, frame: St.frame, ids: items.filter(i => i.k === 'o').map(i => i.id) };
  listen();
}
const stagePoint = e => { const st = stageEl(), b = st.getBoundingClientRect(), k = E.k || 1; return { x: (e.clientX - b.left) / k, y: (e.clientY - b.top) / k }; };
/** Start dragging one end (or the bend) of a line. `fresh` = the line was just drawn, so a click without a drag gives it a default length. */
function beginLine(e, id, which, fresh) {
  const o = objById(id); if (!o || o.locked) return;
  St.drag = { mode: 'line', which, sx: e.clientX, sy: e.clientY, moved: false, o0: PC.clone(o), ends: PC.lineEnds(o), frame: St.frame, ids: [id], fresh: !!fresh, glue: null };
  listen();
}
function beginHandle(e, h) {
  const it = St.sel[0]; if (!it || it.k !== 'o') return; const o = objById(it.id), r = rectOf(it), box = h.closest('.sel-box').getBoundingClientRect();
  if (o.locked) return;
  if (o.type === 'line') { beginLine(e, o.id, h.dataset.h); return; }
  St.drag = { mode: h.dataset.h === 'rotate' ? 'rotate' : 'resize', h: h.dataset.h, sx: e.clientX, sy: e.clientY, moved: false, start: Object.assign({}, r), o0: PC.clone(o), cx: box.left + box.width / 2, cy: box.top + box.height / 2, frame: St.frame, ids: [o.id] };
  listen();
}
function listen() { window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); document.addEventListener('keydown', onDragKey, true); document.body.classList.add('st-dragging'); }
function unlisten() { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); document.removeEventListener('keydown', onDragKey, true); document.body.classList.remove('st-dragging'); }
function onDragKey(e) { if (e.key === 'Escape' && St.drag) { e.preventDefault(); e.stopPropagation(); St.drag.cancel = true; onUp(e); } }

/** While something is being dragged, lines glued to it follow (the data is re-linked for real when the gesture is committed). */
function liveLines() {
  const s = slideNow(); if (!s || !(s.objects || []).some(o => o.type === 'line' && (o.from || o.to))) return;
  const copy = s.objects.map(o => Object.assign({}, o, St.live[o.id] || {}));
  const hOf = t => (t.h != null ? t.h : (elOf({ k: 'o', id: t.id }) || {}).offsetHeight || PC.guessHeight(t));
  PC.relinkLines({ objects: copy }, t => ({ x: t.x, y: t.y, w: t.w, h: hOf(t) })).forEach(id => {
    if (St.drag && St.drag.ids.includes(id)) return; const o = copy.find(x => x.id === id); St.live[id] = { x: o.x, y: o.y, w: o.w, h: o.h }; applyObjEl(o, false);
  });
}
/** Small dots on every side of every shape while a line end is being dragged, with the one it will glue to highlighted. */
function drawSiteDots(rects, glue) {
  const layer = $('.sel-layer', frameEl() || document); if (!layer) return; $$('.sel-site', layer).forEach(n => n.remove()); const k = E.k || 1;
  rects.forEach(({ id, r }) => PC.SITES.forEach(site => { const p = PC.sitePoint(r, site), n = document.createElement('i'); n.className = 'sel-site' + (glue === id + ':' + site ? ' on' : ''); n.style.cssText = `left:${p.x * k}px;top:${p.y * k}px`; layer.appendChild(n); }));
}
function onMove(e) {
  const d = St.drag; if (!d) return; const k = E.k || 1;
  let dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
  if (!d.moved) { if (Math.hypot(dx * k, dy * k) < 4) return; d.moved = true; St.editing = null; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  if (d.mode === 'line') {
    const o0 = d.o0, P = stagePoint(e), others = objs().filter(o => o.type !== 'line' && o.id !== o0.id);
    if (d.which === 'bend') {
      const rad = -(o0.rot || 0) * Math.PI / 180, cx = o0.x + o0.w / 2, cy = o0.y + (o0.h || 0) / 2, lx = (P.x - cx) * Math.cos(rad) - (P.y - cy) * Math.sin(rad) + o0.w / 2, ly = (P.x - cx) * Math.sin(rad) + (P.y - cy) * Math.cos(rad) + (o0.h || 0) / 2;
      const raw = o0.vert ? (o0.flipV ? ((o0.h || 0) - ly) / (o0.h || 1) : ly / (o0.h || 1)) : (o0.flipH ? (o0.w - lx) / (o0.w || 1) : lx / (o0.w || 1));
      const b = clamp(Math.abs(raw - .5) < .03 ? .5 : raw, .05, .95); d.tmp = Object.assign({}, o0, { bend: r1(b * 1000) / 1000 }); if (d.tmp.bend === .5) delete d.tmp.bend;
      St.live[o0.id] = { x: o0.x, y: o0.y, w: o0.w, h: o0.h || 0 }; applyObjEl(d.tmp, false); St.layout(); return;
    }
    const fixed = d.which === 'start' ? d.ends.e : d.ends.s; let q = { x: P.x, y: P.y };
    if (e.shiftKey) { const vx = q.x - fixed.x, vy = q.y - fixed.y, L = Math.hypot(vx, vy), a = Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) * Math.PI / 4; q = { x: fixed.x + Math.cos(a) * L, y: fixed.y + Math.sin(a) * L }; }
    d.glue = null; const rects = others.map(o => ({ id: o.id, r: { x: o.x, y: o.y, w: o.w, h: o.h != null ? o.h : (elOf({ k: 'o', id: o.id }) || {}).offsetHeight || PC.guessHeight(o) } }));
    if (!e.altKey) { const ns = PC.nearestSite(rects, q, 16 / (E.k || 1) + 4); if (ns) { q = { x: ns.x, y: ns.y }; d.glue = ns.id + ':' + ns.site; } }
    const sP = d.which === 'start' ? q : d.ends.s, eP = d.which === 'start' ? d.ends.e : q, t = Object.assign({}, o0, PC.lineFromEnds(sP, eP)); delete t.rot;
    if (!t.flipH) delete t.flipH; if (!t.flipV) delete t.flipV;
    const key = d.which === 'start' ? 'from' : 'to'; if (d.glue) t[key] = d.glue; else delete t[key];
    d.tmp = t; St.live[o0.id] = { x: t.x, y: t.y, w: t.w, h: t.h }; applyObjEl(t, false); St.layout();
    drawSiteDots(rects, d.glue); return;
  }
  if (d.mode === 'move') {
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    let guides = [];
    if (!e.altKey) {
      const xs = d.snaps.map(s => s.r), bbox = { x: Math.min(...xs.map(r => r.x)), y: Math.min(...xs.map(r => r.y)), w: 0, h: 0 }; bbox.w = Math.max(...xs.map(r => r.x + r.w)) - bbox.x; bbox.h = Math.max(...xs.map(r => r.y + r.h)) - bbox.y;
      const sn = snap(bbox, dx, dy, d.ids); dx = sn.dx; dy = sn.dy; guides = sn.guides;
    }
    d.dx = dx; d.dy = dy;
    d.snaps.forEach(s => {
      if (s.o) { const o = Object.assign({}, s.o, { x: r1(s.o.x + dx), y: r1(s.o.y + dy) }); St.live[o.id] = { x: o.x, y: o.y }; applyObjEl(o, true); }
      else { const el = elOf(s.it); if (el) el.style.translate = `${r1((s.tw.dx || 0) + dx)}px ${r1((s.tw.dy || 0) + dy)}px`; }
    });
    liveLines(); St.layout(); drawGuides(guides);
  } else if (d.mode === 'rotate') {
    let a = Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180 / Math.PI + 90; a = ((a + 180) % 360 + 360) % 360 - 180;
    if (e.shiftKey) a = Math.round(a / 15) * 15; else { const n = Math.round(a / 45) * 45; if (Math.abs(a - n) < 3) a = n; }
    d.tmp = Object.assign({}, d.o0, { rot: r1(a) }); if (!d.tmp.rot) delete d.tmp.rot; St.live[d.o0.id] = { rot: d.tmp.rot || 0 }; applyObjEl(d.tmp, true); St.layout();
  } else {
    const o0 = d.o0, s = d.start, rad = (s.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos, hx = /e/.test(d.h) ? 1 : /w/.test(d.h) ? -1 : 0, hy = /s/.test(d.h) ? 1 : /n/.test(d.h) ? -1 : 0;
    let w = s.w + hx * lx, h = s.h + hy * ly; const corner = hx && hy, keep = o0.type === 'image' || o0.type === 'icon' ? !e.shiftKey : e.shiftKey;
    if (o0.type === 'text' && corner) { const f = Math.max(w / s.w, .1); w = s.w * f; h = s.h * f; }
    else if (keep && corner) { const f = Math.max(w / s.w, h / s.h); w = s.w * f; h = s.h * f; }
    w = Math.max(MIN, w); h = Math.max(MIN, h);
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2, ax = -hx * s.w / 2, ay = -hy * s.h / 2, A = { x: cx + ax * cos - ay * sin, y: cy + ax * sin + ay * cos };
    const nx = -hx * w / 2, ny = -hy * h / 2, C = { x: A.x - (nx * cos - ny * sin), y: A.y - (nx * sin + ny * cos) };
    const t = Object.assign({}, o0, { x: r1(C.x - w / 2), y: r1(C.y - h / 2), w: r1(w) });
    if (o0.type !== 'text' || hy || o0.h != null) t.h = r1(h);
    if (o0.type === 'text' && corner) t.size = r1(clamp((o0.size || PC.OBJ_DEFAULTS.text.size) * (w / s.w), 4, 600));
    d.tmp = t; St.live[o0.id] = { x: t.x, y: t.y, w: t.w }; if (t.h != null) St.live[o0.id].h = t.h; applyObjEl(t, o0.type !== 'shape'); liveLines(); St.layout();
  }
}
function onUp() {
  const d = St.drag; if (!d) return; St.drag = null; St.live = {}; unlisten(); $$('.sel-guide').forEach(n => n.remove());
  $$('.sel-site').forEach(n => n.remove());
  if (d.mode === 'line' && d.fresh && !d.moved && !d.cancel) {   // a click with the line tool: drop a default-sized line
    const o = d.o0, big = o.kind && o.kind !== 'straight';
    S.mutate(d.frame, sl => { const i = (sl.objects || []).findIndex(x => x.id === o.id); if (i >= 0) sl.objects[i] = PC.cleanObject(Object.assign({}, sl.objects[i], { w: 320, h: big ? 120 : 0 }), new Set(sl.objects.filter((_, j) => j !== i).map(x => x.id))) || sl.objects[i]; }, '', 'stage');
    St.layout(); S.emit('stage'); return;
  }
  if (!d.cancel && !d.moved && d.tapEdit && St.sel.length === 1 && St.sel[0].id === d.tapEdit) { St.layout(); St.edit(d.tapEdit); return; }   // a second tap on a selected text box starts typing
  if (d.cancel || !d.moved) { if (d.cancel) { const i = d.frame; if (E.frameEl(i)) E.renderFrame(i); } if (!d.moved && d.collapseTo) St.selectObject(d.collapseTo, false); St.layout(); return; }
  if (d.mode === 'move') {
    S.mutate(d.frame, s => d.snaps.forEach(sn => {
      if (sn.o) { const o = (s.objects || []).find(x => x.id === sn.o.id); if (o) { o.x = r1(sn.o.x + d.dx); o.y = r1(sn.o.y + d.dy); if (o.type === 'line' && !d.snaps.every(z => z.o && z.o.type === 'line')) { /* moved with its shapes: keep the glue */ } else if (o.type === 'line') { delete o.from; delete o.to; } } }
      else { s.tweaks = s.tweaks || {}; const t = s.tweaks[sn.it.key] = Object.assign({}, sn.tw); t.dx = r1((sn.tw.dx || 0) + d.dx); t.dy = r1((sn.tw.dy || 0) + d.dy); if (!t.dx) delete t.dx; if (!t.dy) delete t.dy; if (!Object.keys(t).length) delete s.tweaks[sn.it.key]; }
    }), '', 'stage');
  } else if (d.tmp) {
    const id = d.o0.id, tmp = d.tmp;
    S.mutate(d.frame, s => { const i = (s.objects || []).findIndex(o => o.id === id); if (i >= 0) s.objects[i] = PC.cleanObject(tmp, new Set(s.objects.filter((_, j) => j !== i).map(o => o.id))) || s.objects[i]; }, '', 'stage');
  }
  St.layout(); S.emit('stage');
}

/* ── groups, lock, flip ── */
/** An object plus everything that shares its group, as selection items. */
function withGroup(it) {
  const o = objById(it.id); if (!o || !o.group) return [it];
  return objs().filter(x => x.group === o.group).map(x => ({ k: 'o', id: x.id }));
}
const newGroupId = () => 'g' + Math.random().toString(36).slice(2, 7);
St.group = function () {
  const ids = St.sel.filter(it => it.k === 'o').map(it => it.id); if (ids.length < 2) { UI.toast('Select two or more objects to group them.'); return false; }
  const g = newGroupId(); mutateObjects(a => a.forEach(o => { if (ids.includes(o.id)) o.group = g; })); relayout(); return true;
};
St.ungroup = function () {
  const gs = new Set(St.sel.filter(it => it.k === 'o').map(it => (objById(it.id) || {}).group).filter(Boolean)); if (!gs.size) return false;
  mutateObjects(a => a.forEach(o => { if (gs.has(o.group)) delete o.group; })); relayout(); return true;
};
St.flip = function (axis) {
  const ids = St.sel.filter(it => it.k === 'o').map(it => it.id); if (!ids.length) return false; const k = axis === 'v' ? 'flipV' : 'flipH';
  mutateObjects(a => a.forEach(o => { if (!ids.includes(o.id) || o.type === 'text') return; if (o[k]) delete o[k]; else o[k] = true; })); return true;
};
St.lock = function (on) {
  const ids = St.sel.filter(it => it.k === 'o').map(it => it.id); if (!ids.length) return false;
  mutateObjects(a => a.forEach(o => { if (!ids.includes(o.id)) return; if (on) o.locked = true; else delete o.locked; })); relayout(); return true;
};

/* ── drawing a line: pick one from Insert, then drag on the slide ── */
St.setTool = function (preset) {
  St.tool = preset || null; document.body.classList.toggle('st-drawing', !!St.tool);
  if (St.tool) UI.toast('Drag on the slide to draw the line. Shift snaps the angle. Esc cancels.');
};
function drawStart(e, frEl) {
  const preset = PC.LINE_PRESETS[St.tool]; St.setTool(null); if (!preset) return;
  const i = +frEl.dataset.i; if (i !== S.sel) S.select(i, 'click'); St.frame = i;
  const P = stagePoint(e), others = objs().filter(o => o.type !== 'line').map(o => ({ id: o.id, r: { x: o.x, y: o.y, w: o.w, h: o.h != null ? o.h : (elOf({ k: 'o', id: o.id }) || {}).offsetHeight || PC.guessHeight(o) } }));
  const ns = PC.nearestSite(others, P, 18); const start = ns ? { x: ns.x, y: ns.y } : { x: Math.round(P.x), y: Math.round(P.y) };
  let id = '';
  mutateObjects(a => { const o = PC.newObject('line', { kind: preset[1], arrowStart: preset[2], arrowEnd: preset[3], x: start.x, y: start.y, w: 0, h: 0 }, a); if (ns) o.from = ns.id + ':' + ns.site; a.push(o); id = o.id; });
  St.setSel([{ k: 'o', id }]);
  beginLine(e, id, 'end', true);
}

/* ── pointer + keyboard wiring ── */
function blurActive() { const a = document.activeElement; if (a && a !== document.body && a.blur && (UI.isTextTarget(a) || a.closest('.frame'))) a.blur(); }
function onDown(e) {
  if (e.button !== 0 || St.drag) return;
  const t = e.target; if (!t.closest) return;
  if (e.pointerType === 'touch' && PC.touch && PC.touch.down(e)) return;   // fingers: tap selects, a drag scrolls, two fingers pinch (js/touch.js)
  if (St.tool && t.closest('.stage.editing') && !t.closest('.frame-bar, .frame-add, .sel-h')) { e.preventDefault(); e.stopPropagation(); drawStart(e, t.closest('.frame')); return; }
  const h = t.closest('.sel-h, .sel-edge, .sel-grip, .sel-body');
  if (h) { e.preventDefault(); e.stopPropagation(); if (h.dataset.h === 'move') { beginMove(e); if (St.drag && h.classList.contains('sel-body')) St.drag.tapEdit = h.dataset.oid; } else beginHandle(e, h); return; }
  const frEl = t.closest('.frame'), stage = t.closest('.stage.editing'); if (!frEl || !stage) return;
  const i = +frEl.dataset.i; if (i !== S.sel) S.select(i, 'click');
  if (i !== St.frame) { St.sel = []; St.frame = i; }
  const ob = t.closest('.ob');
  if (ob) {
    if (t.closest('.ob-t[contenteditable]')) return;                          // typing inside a text box: the browser owns the pointer
    e.preventDefault(); blurActive();
    const it = { k: 'o', id: ob.dataset.obj }, add = e.shiftKey || e.metaKey || e.ctrlKey, was = St.sel.some(x => same(x, it));
    if (add) { St.selectObject(it.id, true); if (!St.sel.some(x => same(x, it))) return; }
    else if (!was) St.setSel(withGroup(it), i);
    try { ob.focus({ preventScroll: true }); } catch (_) { /* noop */ }       // after the selection is settled: the focusin handler must not override it
    beginMove(e); if (St.drag && was && !add && St.sel.length > 1 && !(objById(it.id) || {}).group) St.drag.collapseTo = it.id;
    return;
  }
  const li = t.closest('[data-list]'), tx = t.closest('[data-path]');
  if (tx && !tx.closest('.ob')) return;                                            // native click-to-edit; focusin selects the field
  if (li) { e.preventDefault(); blurActive(); St.setSel([{ k: 'l', key: li.dataset.list + '.' + li.dataset.idx }], i); beginMove(e); return; }
  if (t.closest('[data-readonly], .frame-bar, .frame-add')) return;
  startMarquee(e, i);
}
/** A finger tap that did not drag: select what is under it (or clear). Adds to the selection while St.multi is on. */
St.tap = function (t) {
  const frEl = t.closest && t.closest('.frame'), stage = t.closest && t.closest('.stage.editing'); if (!frEl || !stage) { St.multi = false; if (St.sel.length) St.setSel([]); return; }
  const i = +frEl.dataset.i; if (i !== S.sel) S.select(i, 'click'); if (i !== St.frame) { St.sel = []; St.frame = i; }
  const ob = t.closest('.ob');
  if (ob) { const id = ob.dataset.obj; blurActive(); if (St.multi) St.selectObject(id, true); else St.setSel(withGroup({ k: 'o', id }), i); try { ob.focus({ preventScroll: true }); } catch (_) { /* noop */ } return; }
  const li = t.closest('[data-list]'); if (li) { blurActive(); St.setSel([{ k: 'l', key: li.dataset.list + '.' + li.dataset.idx }], i); return; }
  St.multi = false; if (St.sel.length) St.setSel([], i);
};
St.objectById = objById;
St.cancelDrag = () => { if (St.drag) { St.drag.cancel = true; onUp(); } };
function startMarquee(e, i) {
  e.preventDefault();
  const host = $('.frame-box', E.frameEl(i)), hb = host.getBoundingClientRect(), k = E.k || 1, add = e.shiftKey;
  blurActive(); const base = add ? St.sel.slice() : [];
  if (!add && St.sel.length) St.setSel([], i);
  const m = document.createElement('i'); m.className = 'sel-marquee'; host.appendChild(m); let moved = false;
  const mv = ev => {
    const x0 = Math.min(e.clientX, ev.clientX) - hb.left, y0 = Math.min(e.clientY, ev.clientY) - hb.top, x1 = Math.max(e.clientX, ev.clientX) - hb.left, y1 = Math.max(e.clientY, ev.clientY) - hb.top;
    if (!moved && Math.hypot(x1 - x0, y1 - y0) < 5) return; moved = true; Object.assign(m.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px', display: 'block' });
    const hit = objs().filter(o => { const el = elOf({ k: 'o', id: o.id }), h = o.h != null ? o.h : el ? el.offsetHeight : 60; return o.x * k < x1 && (o.x + o.w) * k > x0 && o.y * k < y1 && (o.y + h) * k > y0; }).map(o => ({ k: 'o', id: o.id }));
    St.frame = i; St.sel = base.concat(hit.filter(n => !base.some(b => same(b, n)))); St.layout();
  };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); m.remove(); S.emit('stage'); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

function onKey(e) {
  if (PC.present.isOpen() || UI.hasModal() || UI.isTextTarget(e.target) || e.target.closest('.menu')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key;
  if (St.tool && k === 'Escape') { St.setTool(null); e.preventDefault(); return; }
  if (e.target.closest('.thumbs, #ribbon, #tabs, #panel') && !(k === 'Escape' && St.sel.length)) return;   // panels keep their own keys; Esc always deselects
  if (!St.sel.length) { if (mod && k.toLowerCase() === 'a' && e.target.closest('.frame, #canvas') && (slideNow() || {}).objects && St.selectAllObjects()) e.preventDefault(); return; }
  if (St.drag) return;
  const step = e.shiftKey ? 10 : 1; let used = true;
  if (!mod && !e.altKey && k === 'ArrowLeft') St.nudge(-step, 0);
  else if (!mod && !e.altKey && k === 'ArrowRight') St.nudge(step, 0);
  else if (!mod && !e.altKey && k === 'ArrowUp') St.nudge(0, -step);
  else if (!mod && !e.altKey && k === 'ArrowDown') St.nudge(0, step);
  else if (!mod && (k === 'Delete' || k === 'Backspace')) St.remove();
  else if (!mod && k === 'Escape') St.clear();
  else if (!mod && k === 'Enter') { const it = St.sel[0]; if (St.sel.length === 1 && it.k === 'o') { if (!St.edit(it.id)) used = false; } else used = false; }
  else if (mod && k.toLowerCase() === 'd') { if (!St.duplicate()) used = false; }
  else if (mod && k.toLowerCase() === 'g') { if (!(e.shiftKey ? St.ungroup() : St.group())) used = false; }
  else if (mod && k.toLowerCase() === 'a') { if (!St.selectAllObjects()) used = false; }
  else if (mod && (k === ']' || k === '}')) St.order(e.shiftKey ? 'front' : 'forward');
  else if (mod && (k === '[' || k === '{')) St.order(e.shiftKey ? 'back' : 'backward');
  else used = false;
  if (used) { e.preventDefault(); e.stopPropagation(); }
}

/* clipboard: copied objects travel as JSON text, so they paste across slides, decks and tabs */
const CLIP = 'pitchcraft/objects';
function onCopy(e, cut) {
  if (UI.isTextTarget(e.target) || UI.hasModal() || !St.sel.some(it => it.k === 'o')) return;
  const list = St.sel.filter(it => it.k === 'o').map(it => objById(it.id)).filter(Boolean); if (!list.length) return;
  e.clipboardData.setData('text/plain', JSON.stringify({ [CLIP]: 1, objects: list })); e.preventDefault(); if (cut) St.remove();
}
St.pasteObjects = function (list) {
  const clean = PC.cleanObjects(list); if (!clean.length) return false; St.frame = S.sel; const made = [];
  const gmap = {}; mutateObjects(a => clean.forEach(o => { o.id = ''; o.x = r1(o.x + 24); o.y = r1(o.y + 24); delete o.from; delete o.to; if (o.group) o.group = gmap[o.group] = gmap[o.group] || newGroupId(); const n = PC.cleanObject(o, new Set(a.map(x => x.id))); a.push(n); made.push({ k: 'o', id: n.id }); }));
  St.setSel(made); return true;
};
function onPaste(e) {
  if (UI.isTextTarget(e.target) || UI.hasModal() || PC.present.isOpen()) return;
  const cd = e.clipboardData; if (!cd) return;
  const img = Array.from(cd.files || []).find(f => /^image\//.test(f.type)); if (img) { e.preventDefault(); St.insertImageFile(img); return; }
  const t = cd.getData('text/plain') || ''; if (t.indexOf(CLIP) < 0) return;
  try { const j = JSON.parse(t); if (j && j[CLIP] && Array.isArray(j.objects)) { e.preventDefault(); St.pasteObjects(j.objects); } } catch (_) { /* not ours */ }
}

St.init = function () {
  const cv = $('#canvas-inner');
  PC.objRect = (slide, o) => { const fr = E.frameEl(S.deck.slides.indexOf(slide)), el = fr && fr.querySelector(`.ob[data-obj="${CSS.escape(o.id)}"]`); return { x: o.x, y: o.y, w: o.w, h: o.h != null ? o.h : el ? el.offsetHeight : PC.guessHeight(o) }; };
  cv.addEventListener('pointerdown', onDown, true);
  cv.addEventListener('focusin', e => {
    const el = e.target.closest && e.target.closest('[data-path]'); if (!el || el.dataset.readonly || !el.isContentEditable) return;
    const ob = el.closest('.ob'), i = +el.closest('.frame').dataset.i;
    if (ob) { if (!(St.sel.length === 1 && St.sel[0].k === 'o' && St.sel[0].id === ob.dataset.obj)) St.setSel([{ k: 'o', id: ob.dataset.obj }], i); }
    else { const it = { k: 't', key: el.dataset.path }; if (!(St.sel.length === 1 && same(St.sel[0], it))) St.setSel([it], i); }
  });
  cv.addEventListener('focusout', e => { const t = e.target.closest && e.target.closest('.ob-t[contenteditable]'); if (t) setTimeout(() => endEdit(t), 0); });
  cv.addEventListener('dblclick', e => {
    const ob = e.target.closest('.ob'); if (!ob || e.target.closest('.ob-t[contenteditable]')) return;
    const it = { k: 'o', id: ob.dataset.obj }; if (objById(it.id) && (objById(it.id).type === 'text' || objById(it.id).type === 'shape')) { St.setSel([it]); St.edit(it.id); }
  });
  cv.addEventListener('focusin', e => { const ob = e.target.closest && e.target.closest('.ob'); if (ob && e.target === ob && !St.sel.some(x => x.k === 'o' && x.id === ob.dataset.obj)) St.setSel([{ k: 'o', id: ob.dataset.obj }], +ob.closest('.frame').dataset.i); });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('copy', e => onCopy(e, false)); document.addEventListener('cut', e => onCopy(e, true)); document.addEventListener('paste', onPaste);
  S.on('select', () => { if (St.frame !== S.sel) { St.sel = []; St.editing = null; St.frame = S.sel; St.layout(); S.emit('stage'); } });
  S.on('slide', ({ i }) => { if (i === St.frame) { relayout(); } });
  S.on('deck', () => { St.editing = null; if (St.frame >= S.count()) { St.sel = []; St.frame = -1; } relayout(); });
  S.on('meta', () => relayout());
  /* dropping an image file on a slide inserts it where it lands */
  cv.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
  cv.addEventListener('drop', e => {
    const f = e.dataTransfer && Array.from(e.dataTransfer.files || []).find(x => /^image\//.test(x.type)); if (!f) return;
    e.preventDefault(); e.stopPropagation(); const frEl = e.target.closest('.frame'); let at = null;
    if (frEl) { const i = +frEl.dataset.i; if (i !== S.sel) S.select(i, 'click'); St.frame = i; const st = $('.stage', frEl).getBoundingClientRect(), k = E.k || 1; at = { x: (e.clientX - st.left) / k, y: (e.clientY - st.top) / k }; }
    St.insertImageFile(f, at);
  }, true);
  St.frame = S.sel;
};
})();
