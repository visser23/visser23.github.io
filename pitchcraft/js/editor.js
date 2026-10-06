/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT editor — scrolling canvas, slide panel, ribbon, inline editing
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const E = PC.editor = { zoom: 'fit', k: 0.6, editing: null, scrollLock: 0, inspect: false };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const slideHtml = (s, i, editable) => PC.renderSlide(s, { editable, index: i, total: S.count(), deck: S.deck, mode: editable ? 'live' : 'thumb' });
const slideName = s => { const l = PC.LAYOUTS[s.layout], first = (s.objects || []).find(o => o.text), h = PC.plain(s.headline || s.body || s.kicker || (first && first.text) || ''); return l.name + (h ? ' · ' + h.slice(0, 64) : '') + (s.hidden ? ' (hidden)' : ''); };

/* ── text helpers ── */
function readText(el) {
  let t;
  if (PC.plainSupported) t = el.textContent;
  else { t = ''; const walk = (n, first) => { n.childNodes.forEach((c, k) => { if (c.nodeType === 3) t += c.textContent; else if (c.nodeName === 'BR') t += '\n'; else { if (/^(DIV|P)$/.test(c.nodeName) && t && !t.endsWith('\n')) t += '\n'; walk(c); } }); }; walk(el); }
  t = t.replace(/\u00a0/g, ' ');
  return el.closest('.ob') ? t : t.replace(/\s*\n\s*/g, ' ');   // text boxes keep their line breaks; generated fields are single-line
}
function caretToEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

/* Swap a focused rich-text field for its raw markup, keeping the user's caret/selection.
   Plain-text offsets are mapped onto the raw string by skipping the marker characters. */
function flushRaw() {
  const p = E.pending; E.pending = null;
  if (!p || !p.el.isConnected || document.activeElement !== p.el || !p.el.querySelector('strong, em, mark, code')) return;
  const { el } = p, sel = getSelection(), plain = el.textContent;
  let a = null, b = null;
  if (sel.rangeCount && el.contains(sel.anchorNode)) {
    const r = sel.getRangeAt(0), pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    a = pre.toString().length; b = a + r.toString().length;
  }
  const v = PC.getPath(S.slide(p.i), p.path), raw = v == null ? '' : String(v);
  el.textContent = raw;
  if (a === null || !el.firstChild) { caretToEnd(el); return; }
  const map = []; let j = 0;
  for (let k = 0; k < raw.length && j < plain.length; k++) if (raw[k] === plain[j]) map[j++] = k;
  const at = n => n >= plain.length || map[n] === undefined ? raw.length : map[n];
  const start = at(a), end = b > a ? at(b - 1) + 1 : start, node = el.firstChild, r2 = document.createRange();
  r2.setStart(node, Math.min(start, raw.length)); r2.setEnd(node, Math.min(end, raw.length));
  sel.removeAllRanges(); sel.addRange(r2);
}
E.flushRaw = flushRaw;

/* wrap / unwrap the selected text with a markup marker (**, *, ==, `) */
E.format = function (marker) {
  if (PC.htmlFormat && PC.htmlFormat.ribbon(marker)) return true;   // an element of an HTML slide is selected
  flushRaw();
  const ed = E.editing && E.editing.el && E.editing.el.isConnected ? E.editing.el : null;
  const sel = getSelection();
  if (!ed || document.activeElement !== ed || !sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode)) { UI.toast('Select some text on a slide first, then format it.'); return false; }
  const t = sel.getRangeAt(0).toString(), m = marker; // Range text is the raw characters (Selection.toString() applies CSS text-transform)
  const wrapped = t.length > 2 * m.length && t.startsWith(m) && t.endsWith(m);
  const pre = document.createRange(); pre.selectNodeContents(ed); pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  const start = pre.toString().length, out = wrapped ? t.slice(m.length, -m.length) : m + t + m;
  document.execCommand('insertText', false, out);
  /* keep the result selected so formats can be stacked (bold then italic) or toggled off again */
  const node = ed.firstChild;
  if (node && node.nodeType === 3 && ed.childNodes.length === 1) { const r = document.createRange(); r.setStart(node, Math.min(start, node.length)); r.setEnd(node, Math.min(start + out.length, node.length)); sel.removeAllRanges(); sel.addRange(r); }
  return true;
};
E.clearFormat = function () {
  if (PC.htmlFormat && PC.htmlFormat.clearFormat()) return;
  const ed = E.editing && E.editing.el && E.editing.el.isConnected ? E.editing.el : null;
  if (!ed) { UI.toast('Click into a piece of text first.'); return; }
  const cur = readText(ed), plain = PC.plain(cur);
  ed.textContent = plain; caretToEnd(ed); ed.dispatchEvent(new Event('input', { bubbles: true }));
};

/* ── scaling ── */
E.fit = function () {
  const c = $('#canvas'); if (!c) return;
  const cs = getComputedStyle(c), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const w = (c.clientWidth - padX) / 1280, h = (c.clientHeight - 60) / 720;
  const fk = clamp(Math.min(w, Math.max(h, .3)), .15, 2); E.fitK = fk;
  let k = E.zoom === 'fit' ? fk : E.zoom;
  k = clamp(k, .15, 2); E.k = k; c.classList.toggle('zoomed', E.zoom !== 'fit');
  c.style.setProperty('--k', k.toFixed(4));
  const z = $('#zoom-val'); if (z) z.textContent = Math.round(k * 100) + '%';
  if (PC.stage && PC.stage.layout) PC.stage.layout();   // selection handles are in screen pixels
  if (PC.htmlFormat) PC.htmlFormat.scale();             // the HTML slides draw their own handles: tell them the zoom
};
E.setZoom = function (dir) {
  const steps = [.25, .33, .5, .67, .75, .9, 1, 1.25, 1.5, 2];
  if (dir === 'fit') E.zoom = 'fit';
  else E.zoom = dir > 0 ? (steps.find(s => s > E.k + .01) || 2) : ([...steps].reverse().find(s => s < E.k - .01) || .25);
  E.fit(); E.scrollToFrame(S.sel, true);
};

/* ── canvas ── */
const frameEl = i => $(`#canvas-inner .frame[data-i="${i}"]`);
E.frameEl = frameEl;
function frameHtml(s, i) {
  const n = S.count();
  return `<article class="frame${i === S.sel ? ' sel' : ''}" data-i="${i}" data-id="${esc(s.id)}" aria-label="Slide ${i + 1} of ${n}">
    <div class="frame-bar"><span class="frame-n">${PC.pad2(i + 1)}</span><span class="frame-name">${esc(slideName(s))}</span>${s.layout === 'custom' ? '<span class="frame-hint">click to select · drag to move · double-click text to type</span>' : ''}<span class="frame-sp"></span>
      <span class="frame-act">${s.layout === 'custom' ? `<button data-fa="code" aria-label="Edit the HTML, CSS and JS" title="Edit the code">${icon('code', 16)}</button>` : ''}<button data-fa="up" aria-label="Move slide up" title="Move up"${i === 0 ? ' disabled' : ''}>${icon('up', 16)}</button><button data-fa="down" aria-label="Move slide down" title="Move down"${i === n - 1 ? ' disabled' : ''}>${icon('down', 16)}</button><button data-fa="dup" aria-label="Duplicate slide" title="Duplicate">${icon('copy', 16)}</button><button data-fa="del" class="dz" aria-label="Delete slide" title="Delete">${icon('trash', 16)}</button></span></div>
    <div class="frame-box"><div class="stage editing">${slideHtml(s, i, true)}</div></div>
  </article><div class="frame-add" data-at="${i + 1}"><button aria-label="Insert a slide after slide ${i + 1}" title="Insert slide here">${icon('plus', 16)}</button></div>`;
}
E.renderCanvas = function () {
  const inner = $('#canvas-inner');
  if (PC.inspector) PC.inspector.errors = {};   // every sandbox is about to reload and will report afresh
  inner.innerHTML = S.deck.slides.map(frameHtml).join('');
  inner.classList.toggle('inspect', E.inspect);
  E.fit();
};
E.renderFrame = function (i) {
  const fr = frameEl(i), s = S.slide(i); if (!fr || !s) return;
  fr.dataset.id = s.id; $('.frame-name', fr).textContent = slideName(s); if (PC.inspector) delete PC.inspector.errors[s.id];
  $('.stage', fr).innerHTML = slideHtml(s, i, true);
};
E.scrollToFrame = function (i, instant) {
  const c = $('#canvas'), fr = frameEl(i); if (!c || !fr) return;
  E.scrollLock = Date.now(); E.scrollTarget = instant ? null : i;
  c.scrollTo({ top: Math.max(0, fr.offsetTop - 14), behavior: instant ? 'instant' : 'smooth' });
};
E.focusField = function (path) {
  const fr = frameEl(S.sel), el = fr && $(`[data-path="${path}"]`, fr); if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const ob = el.closest('.ob'); if (ob && PC.stage) PC.stage.edit(ob.dataset.obj); else if (el.isContentEditable) { el.focus({ preventScroll: true }); }
  return true;
};

/* ── slide panel ── */
const thumbHtml = (s, i) => `<div class="thumb${i === S.sel ? ' sel' : ''}${s.hidden ? ' is-hidden' : ''}" data-i="${i}" draggable="true" role="button" tabindex="0" aria-label="Slide ${i + 1}: ${esc(slideName(s))}" title="${esc(slideName(s))}"><span class="thumb-n">${i + 1}</span><div class="thumb-frame" aria-hidden="true"><div class="stage">${slideHtml(s, i, false)}</div></div><div class="thumb-act"><button data-ta="dup" aria-label="Duplicate slide ${i + 1}" tabindex="-1">${icon('copy', 13)}</button><button data-ta="del" aria-label="Delete slide ${i + 1}" tabindex="-1">${icon('trash', 13)}</button></div></div>`;
E.renderThumbs = function () {
  $('#thumbs').innerHTML = S.deck.slides.map(thumbHtml).join('');
  const c = $('#slide-count'); if (c) c.textContent = S.count();
  E.fitThumbs();
};
/* Size the thumbnails from what is ACTUALLY free in the panel (clientWidth already excludes the scrollbar),
   so they can never run under it whatever the panel width, scrollbar style or OS. The phone filmstrip keeps its fixed size. */
E.fitThumbs = function () {
  const th = $('#thumbs'); if (!th) return;
  if (getComputedStyle(th).display === 'flex') { th.style.removeProperty('--tk'); return; }
  const cs = getComputedStyle(th), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), t = th.querySelector('.thumb');
  let chrome = 46;
  if (t) { const tc = getComputedStyle(t), n = t.querySelector('.thumb-n'); chrome = parseFloat(tc.paddingLeft) + parseFloat(tc.paddingRight) + (parseFloat(tc.columnGap) || 0) + (n ? n.offsetWidth : 24); }
  const w = th.clientWidth - pad - chrome - 6; // 6px: room for the selection ring
  th.style.setProperty('--tk', (Math.max(72, w) / 1280).toFixed(5));
};
const thumbTimers = {};
E.updateThumb = function (i, now) {
  clearTimeout(thumbTimers[i]);
  const run = () => { const t = $(`#thumbs .thumb[data-i="${i}"] .stage`), s = S.slide(i); if (t && s) { t.innerHTML = slideHtml(s, i, false); const th = t.closest('.thumb'); th.title = slideName(s); th.setAttribute('aria-label', `Slide ${i + 1}: ${slideName(s)}`); } };
  if (now) run(); else thumbTimers[i] = setTimeout(run, 220);
};
E.markSel = function () {
  $$('#thumbs .thumb').forEach(t => t.classList.toggle('sel', +t.dataset.i === S.sel));
  $$('#canvas-inner .frame').forEach(f => f.classList.toggle('sel', +f.dataset.i === S.sel));
  const t = $(`#thumbs .thumb[data-i="${S.sel}"]`); if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const st = $('#status-slide'); if (st) st.textContent = `Slide ${S.sel + 1} of ${S.count()}`;
};

/* ── ribbon ── */
const rb = (act, ic, label, cls = '') => `<button class="rb ${cls}" data-act="${act}" title="${esc(label)}">${icon(ic, 21)}<span>${esc(label)}</span></button>`;
const fb = (act, glyph, label, cls) => `<button class="rb fmt" data-act="${act}" title="${esc(label)}" aria-label="${esc(label)}"><span class="glyph ${cls || ''}">${glyph}</span><span>${esc(label)}</span></button>`;
/* On phones the ribbon shows ONE group at a time behind a tab strip (CSS), so nothing is ever cut off or scrolled sideways. */
const RTABS = [['slide', 'Slide'], ['insert', 'Insert'], ['text', 'Text'], ['design', 'Design'], ['deck', 'Deck'], ['view', 'View']];
E.rtab = 'slide';
E.setRibbonTab = function (k) { E.rtab = k; const r = $('#ribbon'); r.dataset.rtab = k; $$('.rtabs button', r).forEach(b => b.setAttribute('aria-selected', b.dataset.rtab === k ? 'true' : 'false')); };
E.buildRibbon = function () {
  const opts = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  $('#ribbon').innerHTML =
    `<div class="rtabs" role="tablist" aria-label="Toolbar sections">${RTABS.map(([k, l]) => `<button role="tab" id="rtab-${k}" data-rtab="${k}" aria-selected="${E.rtab === k}">${l}</button>`).join('')}</div>
     <div class="rg" data-g="slide" role="group" aria-label="Slide">${rb('new', 'plus', 'New slide', 'big')}${rb('layout', 'layout', 'Layout')}${rb('dup', 'copy', 'Duplicate')}${rb('del', 'trash', 'Delete')}</div>
     <div class="rg" data-g="insert" role="group" aria-label="Insert">${rb('ins-text', 'type', 'Text box')}${rb('ins-image', 'image', 'Image')}${rb('ins-shape', 'shapes', 'Shape')}${rb('ins-icon', 'star', 'Icon')}</div>
     <div class="rg" data-g="text" role="group" aria-label="Text">${fb('bold', 'B', 'Bold')}${fb('italic', 'I', 'Italic', 'i')}${fb('hl', 'A', 'Highlight', 'hl')}${rb('code', 'code', 'Code', 'fmt')}${rb('clearfmt', 'clear', 'Clear', 'fmt')}</div>
     <div class="rg" data-g="design" role="group" aria-label="Design"><label class="rsel">Theme<select id="rb-theme" aria-label="Theme">${opts(Object.fromEntries(Object.entries(PC.THEMES).map(([k, v]) => [k, v.name])), '')}</select></label>
       <label class="rsel">Background<select id="rb-bg" aria-label="Slide background">${opts(PC.BGS, '')}</select></label>
       <div class="rsel acc">Accent<div class="tone-row" id="rb-tones" role="group" aria-label="Accent colour">${Object.keys(PC.TONES).map(k => `<button class="tone-dot${k === '' ? ' none' : ''}" data-tone="${k}" title="${esc(PC.TONES[k])}" aria-label="Accent ${esc(PC.TONES[k])}" style="--c:${PC.TONE_HEX[k] || '#ddd'}"></button>`).join('')}</div></div>
       <label class="rsel">Transition<select id="rb-tr" aria-label="Slide transition"><option value="">Deck default</option>${opts(PC.TRANSITIONS, '')}</select></label></div>
     <div class="rg" data-g="deck" role="group" aria-label="Deck">${rb('newdeck', 'file', 'New deck')}${rb('templates', 'layers', 'Templates')}${rb('open', 'folder-open', 'Open')}${rb('export', 'download', 'Save')}${rb('share', 'share', 'Share')}${rb('print', 'printer', 'PDF')}</div>
     <div class="rg" data-g="view" role="group" aria-label="View">${rb('inspect', 'eye', 'Inspect')}${rb('numbers', 'type', 'Numbers')}${rb('toggle-side', 'sidebar', 'Slides', 'no-mobile')}${rb('toggle-insp', 'panel', 'Panel')}</div>`;
  $('#ribbon').dataset.rtab = E.rtab;
};
E.syncRibbon = function () {
  const s = S.slide(); if (!s) return;
  const set = (id, v) => { const el = $(id); if (el && el.value !== v) el.value = v; };
  set('#rb-theme', S.deck.meta.theme); set('#rb-bg', s.bg || ''); set('#rb-tr', s.transition || '');
  $$('#rb-tones .tone-dot').forEach(b => b.classList.toggle('on', b.dataset.tone === (s.tone || '')));
  const on = (act, v) => { const b = $(`.rb[data-act="${act}"]`); if (b) { b.classList.toggle('on', !!v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); } };
  on('inspect', E.inspect); on('numbers', S.deck.meta.numbers);
  on('toggle-side', $('#app').dataset.side !== 'closed'); on('toggle-insp', $('#app').dataset.insp === 'open');
  const u = $('#btn-undo'), r = $('#btn-redo'); if (u) u.disabled = !S.canUndo(); if (r) r.disabled = !S.canRedo();
  const n = $('#deck-name'); if (n && document.activeElement !== n && n.value !== S.deck.meta.name) n.value = S.deck.meta.name;
};

/* ── layout picker ── */
E.layoutPicker = function (mode) {
  const cur = S.slide().layout, deckWrap = { meta: S.deck.meta };
  const groups = ['Custom', ...PC.LAYOUT_GROUPS.filter(g => g !== 'Custom')].map(g => `<div class="lp-group">${g}</div><div class="lp-grid">${Object.entries(PC.LAYOUTS).filter(([, l]) => l.group === g).map(([k, l]) => {
    const seed = PC.newSlide(k, 'pv-' + k);
    return `<button class="lp-card${mode === 'change' && k === cur ? ' cur' : ''}" data-layout="${k}"><div class="pv" aria-hidden="true"><div class="stage">${PC.renderSlide(seed, { editable: false, index: 0, total: 1, deck: deckWrap })}</div></div><div><b>${esc(l.name)}</b><span class="d">${esc(l.desc)}</span></div></button>`;
  }).join('')}</div>`).join('');
  const m = UI.modal({ title: mode === 'add' ? 'Add a slide' : 'Change layout', body: `<p>${mode === 'add' ? 'Pick a layout and it arrives with sample content you can edit. For full control choose HTML, CSS and JS, or Blank.' : 'Your text is kept where the new layout has a matching field.'}</p>${groups}`, size: '' });
  m.el.addEventListener('click', e => {
    const c = e.target.closest('[data-layout]'); if (!c) return; const layout = c.dataset.layout; m.close();
    if (mode === 'add') { S.addSlide(layout); E.scrollToFrame(S.sel); } else S.setLayout(S.sel, layout);
  });
  return m;
};

/* ── wiring ── */
function bindCanvas() {
  const cv = $('#canvas-inner'), canvas = $('#canvas');

  cv.addEventListener('focusin', e => {
    const el = e.target.closest('[data-path]'); if (!el || el.dataset.readonly || !el.isContentEditable) return;
    const i = +el.closest('.frame').dataset.i; S.select(i, 'edit');
    const path = el.dataset.path;
    /* Rich text is swapped for its raw markup so people edit the real source — but never synchronously inside
       the click: that orphans the browser's pending selection and focus jumps to the first editable on the
       page. Pointer focus swaps on mouseup; keyboard focus on the next tick; typing flushes it immediately. */
    E.editing = { el, i, path };
    if (el.querySelector('strong, em, mark, code')) { E.pending = { el, i, path }; if (!E.pointerDown) setTimeout(flushRaw, 0); }
  });
  cv.addEventListener('mousedown', () => { E.pointerDown = true; }, true);
  document.addEventListener('mouseup', () => { if (!E.pointerDown) return; E.pointerDown = false; setTimeout(flushRaw, 0); }, true);
  cv.addEventListener('beforeinput', flushRaw);
  cv.addEventListener('input', e => {
    const el = e.target.closest('[data-path]'); if (!el || !el.isContentEditable) return;
    const i = +el.closest('.frame').dataset.i; S.setText(i, el.dataset.path, readText(el), 'canvas');
  });
  cv.addEventListener('focusout', e => {
    const el = e.target.closest('[data-path]'); if (!el || el.dataset.readonly || !el.isContentEditable) return;
    const i = +el.closest('.frame').dataset.i, path = el.dataset.path, val = PC.getPath(S.slide(i), path);
    if (document.activeElement !== el) { el.innerHTML = val != null && String(val) !== '' ? PC.rich(val) : ''; if (path === 'headline') { if (val) el.dataset.len = PC.lenBucket(val); else el.removeAttribute('data-len'); } }
    if (E.pending && E.pending.el === el) E.pending = null;
    if (E.editing && E.editing.el === el) E.editing = null;
    E.updateThumb(i, true);
    const fr = frameEl(i); if (fr) $('.frame-name', fr).textContent = slideName(S.slide(i));
  });
  cv.addEventListener('keydown', e => {
    const el = e.target.closest('[data-path]'); if (!el || !el.isContentEditable) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && !el.closest('.ob'))) { e.preventDefault(); el.blur(); return; }   // in a text box Enter is a line break; Esc finishes
    flushRaw();
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); E.format('**'); } else if (k === 'i') { e.preventDefault(); E.format('*'); }
    }
  });
  cv.addEventListener('paste', e => {
    if (PC.plainSupported) return; const el = e.target.closest('[data-path]'); if (!el || !el.isContentEditable) return;
    e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' '); document.execCommand('insertText', false, t);
  });
  cv.addEventListener('mousedown', e => { const fr = e.target.closest('.frame'); if (fr) S.select(+fr.dataset.i, 'click'); });
  const FRAME_MSG = new Set(['sel', 'code', 'edit', 'ready', 'pick', 'style', 'struct', 'cmd', 'editing', 'tree', 'clip', 'paste']);
  /* what a live custom slide tells the editor: it was pressed (select it), asks for its code, or a text was edited inside it */
  window.addEventListener('message', e => {
    const d = e.data; if (!d || typeof d !== 'object' || !FRAME_MSG.has(d.pc)) return;
    const f = $$('#canvas-inner iframe.cs-frame').find(x => x.contentWindow === e.source); if (!f) return;
    const fr = f.closest('.frame'), i = +fr.dataset.i, s = S.slide(i); if (!s || s.layout !== 'custom') return;
    if (d.pc === 'sel') { S.select(i, 'click'); return; }
    if (d.pc === 'code') { S.select(i, 'click'); PC.inspector.reveal({ path: 'custom.html' }); return; }
    if (d.pc !== 'edit') { if (PC.htmlFormat) PC.htmlFormat.onMessage(d, f, i, s); return; }   // the designer: pick, style, struct, cmd, ready, tree, editing
    const html = PC.editCustomHtml(s.custom && s.custom.html, d.i, d.tag, d.old, d.html, !!d.rich);
    if (html == null) { PC.ui.toast('Could not match that text to the slide code. Edit it in the Code tab.', 'bad'); E.renderFrame(i); return; }
    S.mutate(i, sl => { sl.custom.html = html; }, 'cx:' + s.id + ':' + d.i, 'frame');
  });
  cv.addEventListener('click', e => {
    const fa = e.target.closest('[data-fa]');
    if (fa) { const i = +fa.closest('.frame').dataset.i, a = fa.dataset.fa; if (a === 'up') S.move(i, i - 1); else if (a === 'down') S.move(i, i + 1); else if (a === 'dup') S.duplicate(i); else if (a === 'del') S.remove(i); else if (a === 'code') { S.select(i, 'click'); PC.inspector.reveal({ path: 'custom.html' }); } return; }
    const add = e.target.closest('.frame-add button'); if (add) { const at = +add.closest('.frame-add').dataset.at; S.select(Math.max(0, at - 1), 'click'); E.layoutPicker('add'); return; }
    if (e.target.closest('[data-path]:not([data-readonly]), .ob, .sel-layer')) return;
    const ro = e.target.closest('[data-readonly]');
    if (ro) PC.inspector.reveal({ path: ro.dataset.path });   // image / code source live in the Slide tab; cards are selected by the stage (stage.js)
  });

  /* scroll tracking: the frame under the upper-third line becomes the current slide */
  let raf = 0, trail = 0;
  canvas.addEventListener('scroll', () => {
    const wait = 700 - (Date.now() - E.scrollLock);
    if (wait > 0) { clearTimeout(trail); trail = setTimeout(() => canvas.dispatchEvent(new Event('scroll')), wait + 30); return; } // programmatic scroll in flight: re-check once it settles
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const ct = canvas.getBoundingClientRect(), line = ct.top + ct.height * .38; let best = 0, bd = 1e9;
      $$('#canvas-inner .frame').forEach(f => { const r = f.getBoundingClientRect(); const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0; if (d < bd) { bd = d; best = +f.dataset.i; } });
      const tg = E.scrollTarget != null ? frameEl(E.scrollTarget) : null;  // a programmatic jump that clamps at the end of the deck must not be second-guessed
      if (tg && best !== E.scrollTarget) { const r = tg.getBoundingClientRect(); if (Math.min(r.bottom, ct.bottom) - Math.max(r.top, ct.top) > r.height * .5) best = E.scrollTarget; }
      if (best !== S.sel) S.select(best, 'scroll');
    });
  }, { passive: true });
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(ev => canvas.addEventListener(ev, () => { E.scrollTarget = null; E.scrollLock = 0; }, { passive: true, capture: true }));
  new ResizeObserver(() => { const k0 = E.k; E.fit(); if (Math.abs((E.k || 0) - (k0 || 0)) > 0.001) E.scrollToFrame(S.sel, true); }).observe(canvas);   // the slides changed size: keep the current one in view rather than leave the scroll position pointing at empty space
}

function bindThumbs() {
  const th = $('#thumbs'); let dragFrom = -1;
  th.addEventListener('click', e => {
    const ta = e.target.closest('[data-ta]'), t = e.target.closest('.thumb'); if (!t) return; const i = +t.dataset.i;
    if (ta) { if (ta.dataset.ta === 'dup') S.duplicate(i); else S.remove(i); return; }
    S.select(i, 'thumb'); E.scrollToFrame(i);
  });
  th.addEventListener('keydown', e => {
    const t = e.target.closest('.thumb'); if (!t) return; const i = +t.dataset.i;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.select(i, 'thumb'); E.scrollToFrame(i); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); S.remove(i); const n = $(`#thumbs .thumb[data-i="${S.sel}"]`); if (n) n.focus(); }
    else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); S.move(i, i + (e.key === 'ArrowUp' ? -1 : 1)); const n = $(`#thumbs .thumb[data-i="${S.sel}"]`); if (n) n.focus(); }
  });
  th.addEventListener('dragstart', e => { const t = e.target.closest('.thumb'); if (!t) return; dragFrom = +t.dataset.i; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); });
  th.addEventListener('dragend', () => { dragFrom = -1; $$('.thumb', th).forEach(t => t.classList.remove('dragging', 'drop-before', 'drop-after')); });
  th.addEventListener('dragover', e => {
    if (dragFrom < 0) return; const t = e.target.closest('.thumb'); if (!t) return; e.preventDefault();
    const r = t.getBoundingClientRect(), horiz = getComputedStyle(th).display === 'flex', after = horiz ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    $$('.thumb', th).forEach(x => x.classList.remove('drop-before', 'drop-after')); t.classList.add(after ? 'drop-after' : 'drop-before');
  });
  th.addEventListener('drop', e => {
    if (dragFrom < 0) return; const t = e.target.closest('.thumb'); if (!t) return; e.preventDefault();
    const r = t.getBoundingClientRect(), horiz = getComputedStyle(th).display === 'flex', after = horiz ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    let to = +t.dataset.i + (after ? 1 : 0); if (dragFrom < to) to--; const from = dragFrom; dragFrom = -1; S.move(from, to);
  });
}

function bindRibbon() {
  const rib = $('#ribbon');
  rib.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); }); // keep the text selection alive
  rib.addEventListener('click', e => {
    const rt = e.target.closest('button[data-rtab]'); if (rt) { E.setRibbonTab(rt.dataset.rtab); return; }
    const t = e.target.closest('.tone-dot'); if (t) { const tone = t.dataset.tone; S.mutate(S.sel, s => { s.tone = tone; }, 'tone'); return; }
    const b = e.target.closest('[data-act]'); if (b) PC.act(b.dataset.act, b);
  });
  rib.addEventListener('keydown', e => { const rt = e.target.closest('button[data-rtab]'); if (!rt || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return; const ks = RTABS.map(x => x[0]), n = ks[(ks.indexOf(rt.dataset.rtab) + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length]; E.setRibbonTab(n); $('#rtab-' + n).focus(); });
  $('#rb-theme').addEventListener('change', e => S.setMeta({ theme: e.target.value }));
  $('#rb-bg').addEventListener('change', e => S.mutate(S.sel, s => { s.bg = e.target.value; }, 'bg'));
  $('#rb-tr').addEventListener('change', e => S.mutate(S.sel, s => { s.transition = e.target.value; }, 'tr'));
  $('#deck-name').addEventListener('input', e => S.setMeta({ name: e.target.value.slice(0, 80) }, 'name'));
  $('#deck-name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#btn-undo').addEventListener('click', () => PC.act('undo'));
  $('#btn-redo').addEventListener('click', () => PC.act('redo'));
}

E.init = function () {
  E.buildRibbon(); bindRibbon(); bindThumbs(); bindCanvas();
  E.renderThumbs(); E.renderCanvas(); E.syncRibbon(); E.markSel();
  new ResizeObserver(() => E.fitThumbs()).observe($('#thumbs'));
  S.on('deck', () => { E.renderThumbs(); E.renderCanvas(); E.syncRibbon(); E.markSel(); });
  S.on('meta', patch => {
    const keys = Object.keys(patch || {}), nameOnly = keys.length === 1 && keys[0] === 'name';
    if (nameOnly && !S.deck.meta.numbers) { E.syncRibbon(); return; } // name is only drawn on slides when numbers are on
    E.renderThumbs(); E.renderCanvas(); E.markSel(); E.syncRibbon();
  });
  S.on('slide', ({ i, src }) => { if (src !== 'frame') E.renderFrame(i); E.updateThumb(i, src !== 'frame'); E.syncRibbon(); });   // src 'frame': the edit was made inside the live frame, which already shows it
  S.on('text', ({ i }) => { E.updateThumb(i); });
  S.on('select', ({ i, src }) => { E.markSel(); E.syncRibbon(); if (src === 'thumb' || src === 'add' || src === 'dup' || src === 'move' || src === 'remove') E.scrollToFrame(i); });
  S.on('history', () => E.syncRibbon());
  S.on('saved', v => { const el = $('#save-state'); if (!el) return; el.classList.toggle('dirty', v === null); el.textContent = v === null ? 'Saving…' : v ? 'Saved' : 'Not saved'; });
  E.scrollToFrame(0, true);
};
})();
