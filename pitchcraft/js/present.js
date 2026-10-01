/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT presenter — fullscreen overlay with transitions, notes, touch.
   Lifecycle rule (fixes the old "exit leaves you in fullscreen" bug):
     • closing the overlay ALWAYS exits fullscreen
     • leaving fullscreen by ANY route (Esc, browser UI, F11) ALWAYS closes the overlay
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, { $ } = UI, icon = PC.icon;
const P = PC.present = { el: null, i: 0, notes: false, fsEntered: false, manualFs: false, timers: {}, lastNav: 0 };
const DUR = { none: 0, fade: 600, slide: 700, zoom: 650, rise: 700, blur: 750 };

const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canFs = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const reqFs = el => { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (!f) return Promise.reject(new Error('unsupported')); try { return Promise.resolve(f.call(el, { navigationUI: 'hide' })); } catch (e) { return Promise.reject(e); } };
const exitFs = () => { const f = document.exitFullscreen || document.webkitExitFullscreen; if (!f || !fsEl()) return Promise.resolve(); try { return Promise.resolve(f.call(document)); } catch (e) { return Promise.resolve(); } };

function scale() {
  if (!P.el) return; const w = window.innerWidth, h = window.innerHeight;
  P.el.style.setProperty('--pk', Math.min(w / 1280, h / 720).toFixed(4));
}
function layerFor(i) {
  const s = S.slide(i), n = S.count(), l = document.createElement('div');
  l.className = 'pres-layer'; l.innerHTML = `<div class="stage anim">${PC.renderSlide(s, { editable: false, index: i, total: n, deck: S.deck, mode: 'present' })}</div>`;
  l.querySelectorAll('.rv').forEach((e, k) => e.style.setProperty('--i', k));
  return l;
}
P.go = function (i, dir) {
  const n = S.count(); if (!P.el) return; i = Math.max(0, Math.min(n - 1, i));
  const stage = $('.pres-stage', P.el), old = Array.from(stage.children);
  if (dir === undefined) dir = i >= P.i ? 1 : -1;
  const tr = PC.transitionOf(S.deck, S.slide(i)), first = !old.length;
  old.slice(0, -1).forEach(l => l.remove()); // never stack more than two layers
  const cur = old[old.length - 1], next = layerFor(i);
  stage.style.setProperty('--dir', dir);
  if (cur && tr !== 'none' && !first) {
    cur.classList.add('out'); cur.dataset.tr = tr; next.classList.add('in'); next.dataset.tr = tr;
    stage.appendChild(next); setTimeout(() => cur.remove(), DUR[tr] + 60);
  } else { if (cur) cur.remove(); stage.appendChild(next); }
  P.i = i;
  $('.pres-count', P.el).textContent = `${i + 1} / ${n}`;
  $('.pres-prog', P.el).style.width = ((i + 1) / n * 100) + '%';
  $('[data-p="prev"]', P.el).disabled = visibleFrom(i, -1) < 0; $('[data-p="next"]', P.el).disabled = visibleFrom(i, 1) < 0;
  P.el.dataset.slide = i; P.renderNotes();
};
/** The next slide in a direction that is not hidden (hidden slides are skipped when presenting). */
const visibleFrom = (i, dir) => { for (let j = i + dir; j >= 0 && j < S.count(); j += dir) if (!S.slide(j).hidden) return j; return -1; };
P.next = function () { const j = visibleFrom(P.i, 1); if (j >= 0) P.go(j, 1); else P.bump(); };
P.prev = function () { const j = visibleFrom(P.i, -1); if (j >= 0) P.go(j, -1); };
P.bump = function () { const st = $('.pres-stage', P.el); if (!st) return; st.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-14px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-out' }); };
P.renderNotes = function () {
  let box = $('.pres-notes', P.el); if (!P.notes) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'pres-notes'; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Speaker notes'); P.el.appendChild(box); }
  const t = S.slide(P.i).notes; box.innerHTML = '<div class="h">Speaker notes</div>'; const d = document.createElement('div'); if (t) d.textContent = t; else { d.className = 'none'; d.textContent = 'No notes for this slide.'; } box.appendChild(d);
  const b = $('[data-p="notes"]', P.el); if (b) b.classList.toggle('on', P.notes);
};
P.wake = function () {
  if (!P.el) return; P.el.classList.remove('idle'); clearTimeout(P.timers.idle);
  P.timers.idle = setTimeout(() => { if (P.el) P.el.classList.add('idle'); }, 2600);
};
P.toggleFs = function () {
  if (fsEl()) { P.manualFs = true; exitFs().finally(() => setTimeout(() => { P.manualFs = false; }, 400)); }
  else if (P.el) reqFs(P.el).catch(() => UI.toast('This browser blocked fullscreen. Try F11.'));
};

/* browser fullscreen changed underneath us */
function onFsChange() {
  if (!P.el) return;
  if (fsEl()) { P.fsEntered = true; scale(); return; }
  if (P.fsEntered && !P.manualFs) {                // Esc / F11 / browser chrome: leaving fullscreen ends the show
    const inFrame = document.activeElement && document.activeElement.tagName === 'IFRAME';
    if (inFrame) setTimeout(() => { if (P.el) P.close(); }, 60);   // a key that started in a sandboxed slide must be acknowledged before its frame is destroyed
    else P.close();
  }
  else { P.fsEntered = false; scale(); }
}
function onKey(e) {
  if (!P.el) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') P.next();
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') P.prev();
  else if (k === 'Home') P.go(0, -1); else if (k === 'End') P.go(S.count() - 1, 1);
  else if (k === 'Escape') { P.close(); }
  else if (k === 'f' || k === 'F') P.toggleFs();
  else if (k === 'n' || k === 'N') { P.notes = !P.notes; P.renderNotes(); }
  else return;
  e.preventDefault(); e.stopPropagation(); P.wake();
}
/* keys and pc.next()/pc.prev() coming from a custom slide's sandbox (only trusted if the sender is a presenter iframe) */
function onMsg(e) {
  const d = e.data; if (!P.el || !d || typeof d !== 'object') return;
  if (!Array.from(document.querySelectorAll('.pres iframe.cs-frame')).some(f => f.contentWindow === e.source)) return;
  if (d.pc === 'nav' || d.pc === 'key') { try { P.el.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }   // take keyboard focus back from the slide before its frame can be swapped out
  if (d.pc === 'nav') { if (d.d > 0) P.next(); else P.prev(); P.wake(); }
  else if (d.pc === 'key' && d.key === 'Escape') { try { P.el.focus(); } catch (_) { /* ignore */ } setTimeout(() => { if (P.el) P.close(); }, 40); }   // let the iframe's own key event finish before it is destroyed
  else if (d.pc === 'key' && typeof d.key === 'string') onKey({ key: d.key, ctrlKey: false, metaKey: false, altKey: false, preventDefault() {}, stopPropagation() {} });
}
function onWheel(e) { if (Date.now() - P.lastNav < 650 || Math.abs(e.deltaY) < 30) return; P.lastNav = Date.now(); if (e.deltaY > 0) P.next(); else P.prev(); }

P.open = function (from) {
  if (P.el) return;
  P.prevFocus = document.activeElement; P.i = Math.max(0, Math.min(S.count() - 1, from == null ? S.sel : from)); P.fsEntered = false; P.manualFs = false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const el = P.el = document.createElement('div'); el.className = 'pres'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Presentation'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="pres-prog"></div><div class="pres-stage" aria-live="polite"></div>
    <button class="pres-x" data-p="exit" aria-label="Exit presentation">${icon('x', 18)}<span class="lbl">Exit</span></button>
    <div class="pres-ui" role="toolbar" aria-label="Presentation controls"><button data-p="prev" aria-label="Previous slide">${icon('left', 22)}</button><span class="pres-count" aria-live="off">1 / 1</span><button data-p="next" aria-label="Next slide">${icon('right', 22)}</button><button data-p="notes" aria-label="Toggle speaker notes" title="Notes (N)">${icon('notes', 20)}</button><button data-p="fs" aria-label="Toggle fullscreen" title="Fullscreen (F)" class="${canFs() ? '' : 'no-fs'}"${canFs() ? '' : ' hidden'}>${icon('fullscreen', 20)}</button></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  scale(); P.go(P.i, 1); el.focus({ preventScroll: true }); P.wake();
  P.h = { key: onKey, resize: scale, fs: onFsChange, move: () => P.wake(), wheel: onWheel, msg: onMsg };
  window.addEventListener('message', onMsg);
  document.addEventListener('keydown', P.h.key, true); window.addEventListener('resize', P.h.resize); window.addEventListener('orientationchange', P.h.resize);
  document.addEventListener('fullscreenchange', P.h.fs); document.addEventListener('webkitfullscreenchange', P.h.fs);
  el.addEventListener('mousemove', P.h.move); el.addEventListener('wheel', P.h.wheel, { passive: true });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); P.wake();
    if (b) { const a = b.dataset.p; if (a === 'exit') P.close(); else if (a === 'prev') P.prev(); else if (a === 'next') P.next(); else if (a === 'fs') P.toggleFs(); else if (a === 'notes') { P.notes = !P.notes; P.renderNotes(); } return; }
    if (e.target.closest('.pres-notes')) return;
    const lk = e.target.closest('[data-link]');
    if (lk) {   // a link on an object: https and mailto open a new tab, #slide-id jumps
      const u = lk.dataset.link; if (PC.okLink(u)) { if (u[0] === '#') { const j = S.indexOf(u.slice(1)); if (j >= 0) P.go(j); } else window.open(u, '_blank', 'noopener,noreferrer'); return; }
    }
    const r = el.getBoundingClientRect(); if (e.clientX < r.left + r.width * .25) P.prev(); else P.next();
  });
  let tx = 0, ty = 0, tt = 0;
  el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); P.wake(); }, { passive: true });
  el.addEventListener('touchend', e => { const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - tt < 700) { e.preventDefault(); if (dx < 0) P.next(); else P.prev(); } }, { passive: false });
  if (canFs() && !matchMedia('(pointer: coarse)').matches) reqFs(el).catch(() => { /* the overlay still fills the window */ });
  else if (matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth) UI.toast('Rotate your phone for a bigger slide.');
  PC.present.opened = (PC.present.opened || 0) + 1;
};
P.close = function () {
  if (!P.el) return;
  const el = P.el; P.el = null;
  window.removeEventListener('message', onMsg);
  document.removeEventListener('keydown', P.h.key, true); window.removeEventListener('resize', P.h.resize); window.removeEventListener('orientationchange', P.h.resize);
  document.removeEventListener('fullscreenchange', P.h.fs); document.removeEventListener('webkitfullscreenchange', P.h.fs);
  clearTimeout(P.timers.idle); el.remove(); document.body.style.overflow = '';
  P.manualFs = false; P.fsEntered = false; exitFs();        // never leave the browser stuck in fullscreen
  S.select(P.i, 'thumb');                                   // land the editor on the slide you finished on
  requestAnimationFrame(() => { PC.editor.scrollToFrame(P.i, true); const f = P.prevFocus; if (f && f.isConnected && f.focus) try { f.focus({ preventScroll: true }); } catch (e) { /* noop */ } });
};
P.isOpen = () => !!P.el;
})();
