/* Touch gestures for editing on phones and tablets.
   • tap            select an object (tap it again to type in a text box, tap empty space to clear)
   • drag           on a selected object: move it (by its body or handles). Anywhere else: scroll, as usual
   • long-press     start a multi-selection: tap more objects to add or remove them, tap empty space to finish
   • two fingers    pinch to zoom the canvas, drag to pan
   • double-tap     empty space: zoom between Fit and 100%
   • swipe sideways (at Fit) previous / next slide
   • action bar     Edit, Duplicate, Delete, Forward and Format for the selection, always within thumb reach
   Mouse and pen behave exactly as before. The class html.touch-ui follows the last input type, so a laptop with a
   touchscreen gets the touch aids only while a finger is in use. Everything here is pointer-event based; nothing needs a library. */
(function () {
  'use strict';
  const PC = window.PC, S = PC.store, E = PC.editor, St = PC.stage, UI = PC.ui, { $ } = UI, icon = PC.icon;
  const T = PC.touch = {}, root = document.documentElement;
  const ptrs = new Map();                       // active touch pointers: id -> {x, y}
  let tap = null, pinch = null, press = null, last = null, swipe = null;
  const TAP_MOVE = 9, TAP_MS = 500, PRESS_MS = 520, SWIPE_PX = 70, DOUBLE_MS = 320;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── which input is in use? ── */
  const coarse = window.matchMedia ? matchMedia('(pointer: coarse)') : { matches: false };
  const setUi = on => { if (root.classList.contains('touch-ui') !== on) { root.classList.toggle('touch-ui', on); if (St && St.layout) St.layout(); bar.update(); } };
  document.addEventListener('pointerdown', e => { setUi(e.pointerType === 'touch' || e.pointerType === 'pen' ? true : e.pointerType === 'mouse' ? false : root.classList.contains('touch-ui')); }, true);

  /* ── zoom around a point (screen coordinates) ── */
  T.zoomTo = function (k, cx, cy) {
    const c = $('#canvas'); if (!c) return; const r = c.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, old = E.k || 1;
    const sx = (c.scrollLeft + px) / old, sy = (c.scrollTop + py) / old;
    E.zoom = clamp(k, .25, 2); E.fit(); c.scrollLeft = sx * E.k - px; c.scrollTop = sy * E.k - py;
  };
  const settleZoom = () => { if (E.fitK && Math.abs((E.k || 1) - E.fitK) < .04) { E.zoom = 'fit'; E.fit(); } };

  /* ── pinch ── */
  function startPinch() {
    const [a, b] = [...ptrs.values()]; St.cancelDrag(); tap = null; press = clear(press); swipe = null;
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: E.k || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
  function movePinch() {
    const [a, b] = [...ptrs.values()]; if (!b || !pinch) return; const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    T.zoomTo(pinch.k0 * d / pinch.d0, mx, my);
    const c = $('#canvas'); c.scrollLeft -= mx - pinch.mx; c.scrollTop -= my - pinch.my; pinch.mx = mx; pinch.my = my;   // two-finger pan
  }
  function clear(t) { if (t) clearTimeout(t.timer); return null; }

  /* ── entry from the stage's pointerdown (true = handled, stage should do nothing) ── */
  T.down = function (e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2) { if (!pinch) startPinch(); return true; }
    const t = e.target, onCanvas = !!t.closest('.stage.editing');
    swipe = null; tap = null; press = clear(press);
    if (St.tool || t.closest('.sel-h, .sel-edge, .sel-grip, .frame-bar, .frame-add')) return false;         // drawing, handles and slide buttons keep their own behaviour
    if (t.closest('.ob-t[contenteditable]')) return false;                                                  // typing: the browser owns the finger
    const body = t.closest('.sel-body');
    if (body) { startPress(e, body.dataset.oid); return false; }                                            // drag moves it (stage), long-press adds to the selection
    if (!onCanvas) {                                                                                        // the grey space around the slides: a tap clears, a double-tap zooms
      if (!t.closest('#canvas') || t.closest('.frame')) return false;
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), target: t, ob: null }; swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
      return true;
    }
    const fieldText = t.closest('[data-path]') && !t.closest('.ob');
    if (fieldText) return false;                                                                           // template text: native tap-to-edit
    const ob = t.closest('.ob');
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), target: t, ob: ob && ob.dataset.obj };
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
    if (ob) startPress(e, ob.dataset.obj);
    return true;
  };
  function startPress(e, id) {
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, obj: id, timer: setTimeout(() => {
      if (!press || ptrs.size !== 1) return; const p = press; press = null; tap = null; swipe = null;
      St.cancelDrag(); St.multi = true;
      const fr = $(`#canvas-inner .frame[data-i="${S.sel}"]`); const ob = fr && fr.querySelector(`.ob[data-obj="${CSS.escape(p.obj)}"]`);
      if (ob) { if (!St.sel.some(x => x.k === 'o' && x.id === p.obj)) St.selectObject(p.obj, true); }
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) { /* unsupported */ } }
      UI.toast('Multi-select: tap objects to add or remove them. Tap empty space to finish.');
      bar.update();
    }, PRESS_MS) };
  }

  // taps on the grey space around the slides never reach the stage's own handler
  const cv = $('#canvas'), inner = $('#canvas-inner');
  if (cv) cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.button === 0 && !(inner && inner.contains(e.target))) T.down(e); }, true);

  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch' || !ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) { movePinch(); return; }
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_MOVE) press = clear(press);
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) tap = null;
  }, { passive: true });

  function end(e) {
    if (e.pointerType !== 'touch' || !ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); press = clear(press);
    if (pinch) { if (ptrs.size < 2) { pinch = null; settleZoom(); } tap = null; swipe = null; return; }
    if (e.type === 'pointercancel') { tap = null; swipe = null; return; }          // the browser took the finger to scroll
    const now = Date.now();
    if (swipe && swipe.id === e.pointerId) {
      const dx = p.x - swipe.x, dy = p.y - swipe.y, fit = E.zoom === 'fit';
      if (fit && now - swipe.t < 650 && Math.abs(dx) > SWIPE_PX && Math.abs(dy) < Math.abs(dx) * .5 && !St.sel.length) {
        const n = clamp(S.sel + (dx < 0 ? 1 : -1), 0, S.count() - 1); tap = null; swipe = null;
        if (n !== S.sel) { S.select(n, 'swipe'); E.scrollToFrame(n); }
        return;
      }
    }
    if (tap && tap.id === e.pointerId && now - tap.t < TAP_MS) {
      const t = tap; tap = null;
      if (!t.ob && last && now - last.t < DOUBLE_MS && Math.hypot(t.x - last.x, t.y - last.y) < 36 && !St.sel.length) {   // double-tap empty space: Fit <-> 100%
        last = null; if (E.zoom === 'fit') T.zoomTo(1, t.x, t.y); else { E.zoom = 'fit'; E.fit(); E.scrollToFrame(S.sel, true); }
        return;
      }
      last = t.ob ? null : { x: t.x, y: t.y, t: now };
      St.tap(t.target); bar.update();
    }
  }
  window.addEventListener('pointerup', end, true);
  window.addEventListener('pointercancel', end, true);
  window.addEventListener('blur', () => { ptrs.clear(); pinch = null; tap = null; press = clear(press); });

  /* ── the action bar ── */
  const bar = {
    el: null,
    build() {
      const el = this.el = document.createElement('div'); el.className = 'touch-bar'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Selection actions'); el.hidden = true;
      el.innerHTML = [['edit', 'Type', 'Edit text'], ['copy', 'Copy', 'Duplicate'], ['trash', 'Delete', 'Delete'], ['front', 'Front', 'Bring to front'], ['sliders', 'Format', 'Format']]
        .map(([ic, l, a]) => `<button type="button" data-tb="${l.toLowerCase()}" aria-label="${a}">${icon(ic, 20)}<span>${l}</span></button>`).join('')
        + `<button type="button" data-tb="done" aria-label="Done">${icon('check', 20)}<span>Done</span></button>`;
      el.addEventListener('pointerdown', e => e.stopPropagation());
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-tb]'); if (!b) return; const a = b.dataset.tb, only = St.sel.length === 1 ? St.sel[0] : null;
        if (a === 'type') { if (only && only.k === 'o') St.edit(only.id); }
        else if (a === 'copy') St.duplicate();
        else if (a === 'delete') St.remove();
        else if (a === 'front') St.order('front');
        else if (a === 'format') { const I = PC.inspector; I.setTab('format'); I.ensureOpen(); }
        else if (a === 'done') { St.multi = false; St.setSel([]); }
        this.update();
      });
      document.body.appendChild(el);
    },
    update() {
      if (!this.el) this.build();
      const objs = St.sel.filter(it => it.k === 'o'), on = root.classList.contains('touch-ui') && objs.length > 0 && !St.editing && !$('.modal-back') && $('#app').dataset.insp !== 'open-sheet';
      this.el.hidden = !on; if (!on) return;
      const o = objs.length === 1 && St.sel.length === 1 ? PC.stage.objectById && PC.stage.objectById(objs[0].id) : null;
      const canType = !!(o && (o.type === 'text' || o.type === 'shape') && !o.locked);
      this.el.querySelector('[data-tb="type"]').hidden = !canType;
      this.el.querySelector('[data-tb="done"]').hidden = !St.multi;
    }
  };
  T.bar = bar;
  S.on('stage', () => bar.update()); S.on('select', () => bar.update());
  if (coarse.matches) setUi(true);
  bar.update();
})();
