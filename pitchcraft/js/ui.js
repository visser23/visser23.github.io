/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT ui — tiny DOM helpers, toasts, modals, popover menus
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, esc = PC.esc, icon = PC.icon;
const UI = PC.ui = {};

UI.$ = (s, r = document) => r.querySelector(s);
UI.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
UI.isTextTarget = t => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'));

/* ── toasts ── */
UI.toast = function (msg, kind, action) {
  const root = UI.$('#toasts'); if (!root) return;
  const t = document.createElement('div'); t.className = 'toast' + (kind === 'bad' ? ' bad' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  if (action) { t.classList.add('has-act'); const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label; b.addEventListener('click', () => { t.remove(); action.run(); }); t.appendChild(b); }
  root.appendChild(t); setTimeout(() => t.remove(), action ? 12000 : kind === 'bad' ? 5200 : 2800);
  while (root.children.length > 3) root.firstChild.remove();
};
/* ── clipboard / download ── */
UI.copy = async function (text, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { UI.toast('Copy failed. Select the text and copy it manually.', 'bad'); ta.remove(); return false; }
    ta.remove();
  }
  UI.toast(okMsg || 'Copied to clipboard'); return true;
};
UI.download = function (name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};

/* ── modal ── */
let modalStack = [];
/** A dialog that stays up while something slow runs: a message, a bar that fills (or slides when the amount is unknown) and the seconds so far.
 *  const p = UI.progress('Building…'); p.set('Reading slide 2 of 9', 0.2); … p.close(). It cannot be dismissed by accident. */
UI.progress = function (title) {
  const body = document.createElement('div');
  body.innerHTML = '<p class="pg-msg" role="status" aria-live="polite">Starting…</p><div class="pg-bar ind" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="hint pg-sub"></p>';
  const m = UI.modal({ title, body, cls: 'busy', locked: true }), msg = body.querySelector('.pg-msg'), bar = body.querySelector('.pg-bar'), fill = bar.firstChild, sub = body.querySelector('.pg-sub');
  const t0 = performance.now(); let extra = '';
  const tick = () => { sub.textContent = (extra ? extra + ' · ' : '') + Math.round((performance.now() - t0) / 1000) + ' s'; }, iv = setInterval(tick, 500); tick();
  return {
    set(text, frac, more) {
      if (text) msg.textContent = text; extra = more || '';
      if (typeof frac === 'number') { const p = Math.max(0, Math.min(1, frac)); bar.classList.remove('ind'); fill.style.width = Math.round(p * 100) + '%'; bar.setAttribute('aria-valuenow', String(Math.round(p * 100))); } else { bar.classList.add('ind'); bar.removeAttribute('aria-valuenow'); fill.style.width = ''; }
      tick();
    },
    close() { clearInterval(iv); m.close(); }
  };
};

UI.modal = function ({ title, body, footer, size, onClose, cls, locked }) {
  const back = document.createElement('div'); back.className = 'modal-back'; back.dataset.modal = '1';
  const id = PC.uid('mt');
  back.innerHTML = `<div class="modal ${size || ''} ${cls || ''}" role="dialog" aria-modal="true" aria-labelledby="${id}"><div class="modal-h"><h2 id="${id}">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close dialog">${icon('x', 20)}</button></div><div class="modal-b"></div>${footer ? '<div class="modal-f"></div>' : ''}</div>`;
  const b = back.querySelector('.modal-b');
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
  const f = back.querySelector('.modal-f'); if (f && footer) { if (typeof footer === 'string') f.innerHTML = footer; else f.appendChild(footer); }
  const prev = document.activeElement;
  const api = { el: back, body: b, footer: f, close() { if (!back.isConnected) return; back.remove(); modalStack = modalStack.filter(m => m !== api); if (onClose) onClose(); if (prev && prev.focus && prev.isConnected) try { prev.focus(); } catch (e) { /* noop */ } } };
  back.addEventListener('mousedown', e => { if (!locked && e.target === back) api.close(); });
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
  back.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!locked) api.close(); }
    if (e.key === 'Tab') { // focus trap
      const f2 = UI.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', back).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f2.length) return; const first = f2[0], last = f2[f2.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.body.appendChild(back); modalStack.push(api);
  const autof = back.querySelector('[data-autofocus]') || back.querySelector('.icon-btn'); if (autof) autof.focus();
  return api;
};
UI.closeModals = () => modalStack.slice().forEach(m => m.close());
UI.hasModal = () => modalStack.length > 0;

/* ── popover menu (anchored to a button) ── */
let openMenu = null;
UI.closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escMenu, true); } };
function outside(e) { if (openMenu && !openMenu.contains(e.target)) UI.closeMenu(); }
function escMenu(e) { if (e.key === 'Escape') { e.stopPropagation(); UI.closeMenu(); } }
/** Show any element as a popover under `anchor` (closes on outside click / Escape). */
UI.popover = function (anchor, m) {
  UI.closeMenu(); document.body.appendChild(m); openMenu = m;
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)), top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escMenu, true); }, 0);
  return m;
};
UI.menu = function (anchor, items) {
  UI.closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button role="menuitem" data-i="${i}"${it.disabled ? ' disabled' : ''}>${it.icon ? icon(it.icon, 18) : ''}<span>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span>${it.soon ? '<span class="soon">SOON</span>' : ''}</button>`).join('');
  document.body.appendChild(m); openMenu = m;
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)), top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const it = items[+b.dataset.i]; UI.closeMenu(); if (it && it.run) it.run(); });
  setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escMenu, true); }, 0);
  const first = m.querySelector('button:not([disabled])'); if (first) first.focus();
  return m;
};
})();
