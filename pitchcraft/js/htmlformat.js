/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT html format — the editor's side of designing an HTML slide in the frame (see framedesign.js for the frame's side).
   · messages from a live slide frame: ready, pick (selection changed), style (declarations to store), struct (delete / duplicate /
     order), cmd (undo, bold...), editing (typing in the frame), tree (the slide's elements). Everything from a frame is untrusted
     data: it is accepted only from a canvas frame, shaped field by field, and written through PC.design (whitelisted properties).
   · the Format tab for an HTML slide: position and size, text, box, arrange, and the list of elements
   · ribbon (Bold, Italic...), keyboard (arrows, Delete, Ctrl+D) and the zoom scale handed to the frames
   Selection lives in E.htmlSel = { id, info, editing, deep }, so there is one selected thing at a time with the free-form stage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, E = PC.editor, F = PC.format, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const H = PC.htmlFormat = { pending: null };
E.htmlSel = null; E.htmlTree = {};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fid = () => PC.uid('hx');

/* ── frames ── */
const slideIdx = id => S.deck.slides.findIndex(s => s.id === id);
const frameOf = i => $(`#canvas-inner .frame[data-i="${i}"] iframe.cs-frame`);
const post = (i, msg) => { const f = frameOf(i); if (f && f.contentWindow) { try { f.contentWindow.postMessage(msg, '*'); } catch (e) { /* frame gone */ } } };
const cur = () => { const hs = E.htmlSel, s = S.slide(); return hs && s && hs.id === s.id ? hs : null; };
H.cur = cur;
H.scale = () => { $$('#canvas-inner iframe.cs-frame').forEach(f => { try { f.contentWindow.postMessage({ pc: 'scale', k: E.k }, '*'); } catch (e) { /* not loaded */ } }); };
H.clear = function () {
  const hs = E.htmlSel; if (!hs) return; E.htmlSel = null;
  const i = slideIdx(hs.id); if (i >= 0) post(i, { pc: 'deselect' });
  S.emit('htmlsel');
};
H.busy = () => { const a = document.activeElement; return !!(E.htmlSel && a && a !== document.body && $('#panel').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };

/* ── what a frame tells us: shape it, never trust it ── */
const num = (v, d = 0, lo = -1e5, hi = 1e5) => (typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : d);
const str = (v, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');
function cleanInfo(r) {
  if (!r || typeof r !== 'object') return null;
  const cs = r.cs && typeof r.cs === 'object' ? r.cs : {}, inl = {};
  PC.design.PROPS.forEach(p => { if (r.inl && typeof r.inl[p] === 'string') { const v = PC.design.cleanDecl(p, r.inl[p]); if (v != null) inl[p] = v; } });
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 50).filter(x => x && Number.isInteger(x.i) && typeof x.sig === 'string' && x.sig.length < 400).map(x => ({ i: x.i, sig: x.sig }));
  if (!items.length) return null;
  const rc = r.rect && typeof r.rect === 'object' ? r.rect : {};
  return {
    n: clamp(Math.round(num(r.n, 1, 1, 50)), 1, 50), tag: str(r.tag, 20).replace(/[^\w-]/g, ''), label: str(r.label, 60), text: str(r.text, 60), kind: ['img', 'text', 'box'].includes(r.kind) ? r.kind : 'box',
    canResize: !!r.canResize, container: !!r.container, hasText: !!r.hasText, moved: !!r.moved, auto: { w: !(r.auto && r.auto.w === false), h: !(r.auto && r.auto.h === false) },
    rect: { x: num(rc.x, 0, -9999, 9999), y: num(rc.y, 0, -9999, 9999), w: num(rc.w, 0, 0, 9999), h: num(rc.h, 0, 0, 9999) },
    cs: { color: str(cs.color, 60), bg: str(cs.bg, 60), bgImage: str(cs.bgImage, 4), family: str(cs.family, 60), size: num(cs.size, 16, 0, 3000), weight: num(cs.weight, 400, 1, 1000), style: str(cs.style, 12), align: str(cs.align, 12), deco: str(cs.deco, 40), caps: str(cs.caps, 14),
      lh: num(cs.lh, 0, 0, 20), ls: num(cs.ls, 0, -5, 20), opacity: num(cs.opacity, 1, 0, 1), radius: num(cs.radius, 0, 0, 5000), bw: num(cs.bw, 0, 0, 500), bc: str(cs.bc, 60), shadow: !!cs.shadow, pad: num(cs.pad, 0, 0, 2000), pos: str(cs.pos, 12) },
    inl, items
  };
}
const treeOf = raw => (Array.isArray(raw) ? raw : []).slice(0, 90).filter(x => x && Number.isInteger(x.i)).map(x => ({ i: x.i, d: clamp(Math.round(num(x.d, 0, 0, 8)), 0, 8), label: str(x.label, 40), text: str(x.text, 40) }));
const keyOf = k => str(k, 40).replace(/[^\w:.-]/g, '') || 'style';

/** Called by the editor for a message from a live slide frame (already known to come from a canvas frame, slide i). */
H.onMessage = function (d, f, i, s) {
  if (d.pc === 'ready') {
    f.dataset.dz = 'ready';
    const p = H.pending && H.pending.id === s.id && Date.now() - H.pending.t < 4000 ? H.pending : null; if (p) H.pending = null;
    post(i, { pc: 'init', k: E.k, sel: p ? p.sel : [] });
  } else if (d.pc === 'tree') {
    E.htmlTree[s.id] = treeOf(d.items); if (cur() && cur().id === s.id && PC.inspector && PC.inspector.tab === 'format' && !H.busy()) PC.inspector.render();
  } else if (d.pc === 'pick') {
    const info = cleanInfo(d.info), prev = E.htmlSel;
    if (!info) { if (prev && prev.id === s.id) { E.htmlSel = null; S.emit('htmlsel'); } return; }
    if (prev && prev.id !== s.id) { const j = slideIdx(prev.id); if (j >= 0) post(j, { pc: 'deselect' }); }
    if (PC.stage && PC.stage.sel.length) PC.stage.clear();
    E.htmlSel = { id: s.id, info, editing: !!(prev && prev.id === s.id && prev.editing), deep: !!(prev && prev.deep) };
    S.emit('htmlsel');
  } else if (d.pc === 'editing') {
    if (E.htmlSel && E.htmlSel.id === s.id) E.htmlSel.editing = !!d.on;
  } else if (d.pc === 'style') {
    const r = PC.design.applyStyles(s.custom && s.custom.html, d.changes);
    if (!r) { UI.toast('Could not match that change to the slide code. Edit it in the Code tab.', 'bad'); E.renderFrame(i); return; }
    if (r.html !== s.custom.html) S.mutate(i, sl => { sl.custom.html = r.html; }, 'cs:' + s.id + ':' + keyOf(d.key), 'frame');
  } else if (d.pc === 'clip') {
    if (cur() && cur().id === s.id) H.copy(typeof d.token === 'string' ? d.token : '', d.op === 'cut');
  } else if (d.pc === 'paste') {
    S.select(i, 'click'); H.paste(str(d.text, 450000), i);
  } else if (d.pc === 'struct') {
    if (['delete', 'dup'].includes(d.op)) { S.select(i, 'click'); H.struct(d.op); }
  } else if (d.pc === 'cmd') {
    const c = String(d.cmd);
    if (c === 'undo') PC.act('undo'); else if (c === 'redo') PC.act('redo');
    else if (['bold', 'italic', 'underline'].includes(c)) H.toggle(c);
  }
};

/** delete / dup / front / back / forward / backward on the selected elements: rewrites the HTML and reloads the frame, then reselects. */
H.struct = function (op, quiet) {
  const hs = cur(); if (!hs) return; const i = slideIdx(hs.id), s = S.slide(i);
  const r = PC.design.structure(s.custom && s.custom.html, op, hs.info.items);
  if (!r) { UI.toast('Could not match that element to the slide code. Edit it in the Code tab.', 'bad'); E.renderFrame(i); return; }
  H.pending = { id: s.id, sel: r.sel, t: Date.now() };
  S.mutate(i, sl => { sl.custom.html = r.html; }, '', 'struct');
  if (!quiet) UI.toast(op === 'delete' ? 'Deleted. Ctrl+Z brings it back.' : op === 'dup' ? 'Duplicated.' : 'Moved.');
};

/* ── copy, cut, paste ──
   The clipboard text is a marker (and a token) from the frame, or the whole HTML from the editor when the browser lets it write. The editor keeps the
   copied HTML itself, taken from the stored slide (never from what the frame says), and every paste is cleaned again by PC.design.insert. */
const TOKEN = /^[a-z0-9]{6,32}$/;
const payload = snippets => JSON.stringify({ 'pitchcraft/html': 1, html: snippets });
H.clip = null; H.ext = null;
H.copy = function (token, cut) {
  const hs = cur(); if (!hs) return false; const i = slideIdx(hs.id), s = S.slide(i);
  const r = PC.design.extract(s.custom && s.custom.html, hs.info.items);
  if (!r) { UI.toast('Could not match that element to the slide code, so it was not copied. Edit it in the Code tab.', 'bad'); E.renderFrame(i); return false; }
  H.clip = { token: TOKEN.test(token || '') ? token : '', snippets: r.snippets, id: s.id, items: hs.info.items.map(x => ({ i: x.i, sig: x.sig })), parent: cut ? r.parentCut : r.parent, cut: !!cut, cnt: {} };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload(r.snippets)).catch(() => { /* the token on the clipboard still works in this window */ }); } catch (e) { /* no clipboard API */ }
  if (cut) H.struct('delete', true);
  UI.toast(`${cut ? 'Cut' : 'Copied'} ${r.snippets.length === 1 ? 'the element' : r.snippets.length + ' elements'}. Paste with Ctrl+V.`);
  return true;
};
/** Paste what the clipboard text describes into slide i. Returns false when the text is not ours. */
H.paste = function (text, i) {
  const s = S.slide(i); if (!s || s.layout !== 'custom' || typeof text !== 'string') return false;
  let j; try { j = JSON.parse(text); } catch (e) { return false; }
  if (!j || typeof j !== 'object' || j['pitchcraft/html'] !== 1) return false;
  let clip = null;
  if (typeof j.token === 'string' && H.clip && H.clip.token && H.clip.token === j.token) clip = H.clip;
  else if (Array.isArray(j.html)) {
    const sn = j.html.filter(x => typeof x === 'string').slice(0, 50);
    if (H.clip && text === payload(H.clip.snippets)) clip = H.clip;
    else { const key = sn.length + ':' + sn.join('').length + ':' + (sn[0] || '').slice(0, 60); clip = H.ext && H.ext.key === key ? H.ext : (H.ext = { key, snippets: sn, id: null, items: null, parent: null, cut: false, cnt: {} }); }
  }
  if (!clip || !clip.snippets.length) { UI.toast('Nothing to paste: that copy was made in another window. Copy the elements again here.'); return true; }
  const here = clip.id === s.id, k = clip.cnt[s.id] == null ? (here && !clip.cut ? 1 : 0) : clip.cnt[s.id] + 1; clip.cnt[s.id] = k;
  const r = PC.design.insert(s.custom && s.custom.html, clip.snippets, { after: here ? clip.items : null, parent: here ? clip.parent : null, offset: 24 * k });
  if (!r) { UI.toast('Could not paste that: the slide would be too big, or the copy is not valid.', 'bad'); return true; }
  if (here && r.items.length) clip.items = r.items;                       // the next paste goes after this one
  if (i !== S.sel) S.select(i, 'click');
  H.pending = { id: s.id, sel: r.sel, t: Date.now() };
  S.mutate(i, sl => { sl.custom.html = r.html; }, '', 'struct');
  UI.toast('Pasted.'); return true;
};
H.pasteButton = function () {
  if (H.clip) { H.paste(payload(H.clip.snippets), S.sel); return; }
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(t => { if (!H.paste(t, S.sel)) UI.toast('Copy an element first (select it, then Ctrl+C).'); }).catch(() => UI.toast('Copy an element first (select it, then Ctrl+C).'));
  else UI.toast('Copy an element first (select it, then Ctrl+C).');
};

/* ── writing to the selected elements (the frame applies, then reports what to store) ── */
H.apply = function (set, del, key) { const hs = cur(); if (!hs) return false; post(slideIdx(hs.id), { pc: 'apply', set: set || {}, del: del || [], key: key || 'fmt', deep: !!hs.deep }); return true; };
const geom = patch => { const hs = cur(); if (hs) post(slideIdx(hs.id), Object.assign({ pc: 'geom' }, patch)); };
H.toggle = function (what) {
  const hs = cur(); if (!hs) return; const c = hs.info.cs, dec = new Set((c.deco || '').split(' ').filter(x => x && x !== 'none'));
  if (what === 'bold') H.apply({ 'font-weight': c.weight >= 600 ? '400' : '700' }, [], 'bold');
  else if (what === 'italic') H.apply({ 'font-style': c.style === 'italic' ? 'normal' : 'italic' }, [], 'italic');
  else if (what === 'caps') H.apply({ 'text-transform': c.caps === 'uppercase' ? 'none' : 'uppercase' }, [], 'caps');
  else if (what === 'shadow') H.apply({ 'box-shadow': c.shadow ? 'none' : '0px 10px 30px rgba(0, 0, 0, 0.25)' }, [], 'shadow');
  else if (what === 'underline' || what === 'strike') { const t = what === 'underline' ? 'underline' : 'line-through'; if (dec.has(t)) dec.delete(t); else dec.add(t); H.apply({ 'text-decoration-line': dec.size ? Array.from(dec).join(' ') : 'none' }, [], what); }
};
/** The ribbon's Bold / Italic / Highlight / Code: words while typing in the frame, otherwise the whole selected element. */
H.ribbon = function (marker) {
  const hs = cur(); if (!hs) return false; const cmd = { '**': 'bold', '*': 'italic', '==': 'mark', '`': 'code' }[marker]; if (!cmd) return false;
  if (hs.editing) { post(slideIdx(hs.id), { pc: 'cmd', cmd }); return true; }
  if (cmd === 'bold' || cmd === 'italic') { H.toggle(cmd); return true; }
  UI.toast('Double-click the text, select some words, then use Highlight or Code.'); return true;
};
H.clearFormat = function () {
  const hs = cur(); if (!hs) return false;
  if (hs.editing) { post(slideIdx(hs.id), { pc: 'cmd', cmd: 'clear' }); return true; }
  UI.toast('Double-click the text and select words to clear their formatting.'); return true;
};
/** Keys while the editor (not the frame) has focus and an HTML element is selected. Returns true when the key was used. */
H.key = function (e, mod) {
  const hs = cur(); if (!hs || hs.editing) return false; const k = e.key;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!mod && !e.altKey && arrows[k]) { e.preventDefault(); const st = e.shiftKey ? 10 : 1; post(slideIdx(hs.id), { pc: 'cmd', cmd: 'nudge', dx: arrows[k][0] * st, dy: arrows[k][1] * st }); return true; }
  if (!mod && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); H.struct('delete'); return true; }
  if (!mod && k === 'Escape') { H.clear(); return true; }
  if (mod && k.toLowerCase() === 'd') { e.preventDefault(); H.struct('dup'); return true; }
  return false;
};

/* ── the Format tab ── */
const toHex = c => {
  const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#5b4bff';
  const p = m[1].split(/[\s,\/]+/).map(parseFloat), h = n => ('0' + clamp(Math.round(n), 0, 255).toString(16)).slice(-2); return '#' + h(p[0]) + h(p[1]) + h(p[2]);
};
const clear = c => !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
const sec = (title, body, hint) => `<div class="ins-sec"><h4>${esc(title)}${hint ? ` <span class="hint">${esc(hint)}</span>` : ''}</h4>${body}</div>`;
const nbox = (label, key, val, o = {}) => { const id = fid(); return `<div class="field fnum"><label for="${id}">${esc(label)}</label><input class="inp" id="${id}" type="number" inputmode="decimal" data-hx-num="${key}" data-fs="hn:${key}" value="${val == null || val === '' ? '' : esc(String(Math.round(val * 100) / 100))}" step="${o.step || 1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}></div>`; };
const tog = (label, key, on, glyph, cls) => `<button type="button" class="tg${on ? ' on' : ''}" data-hx-toggle="${key}" data-fs="ht:${key}" aria-pressed="${!!on}" aria-label="${esc(label)}" title="${esc(label)}"><span class="${cls || ''}">${glyph}</span></button>`;
const seg = (prop, val, opts) => `<div class="seg" role="group" aria-label="${esc(prop)}">${Object.entries(opts).map(([k, v]) => `<button type="button" data-hx-set="${prop}" data-v="${k}" data-fs="hg:${prop}:${k}" class="${val === k ? 'on' : ''}" aria-pressed="${val === k}">${v}</button>`).join('')}</div>`;
const btn = (op, label, ic) => `<button type="button" class="btn sm" data-hx-op="${op}" data-fs="ho:${op}" aria-label="${esc(label)}" title="${esc(label)}">${ic ? icon(ic, 14) + ' ' : ''}${esc(label)}</button>`;
function colorRow(label, prop, inlineVal, computed, o = {}) {
  const fr = E.frameEl(S.sel), slide = fr && $('.slide', fr), cs = slide ? getComputedStyle(slide) : null, curv = String(inlineVal || '');
  const sw = PC.COLOR_TOKENS.map(([v, name]) => {
    const css = v.startsWith('var(') && cs ? (cs.getPropertyValue(v.slice(4, -1)).trim() || '#888') : v;
    return `<button type="button" class="swatch${curv === v ? ' on' : ''}" data-hx-color="${prop}" data-v="${esc(v)}" data-fs="hc:${prop}:${v}" style="background:${esc(css)}" title="${esc(name)}" aria-label="${esc(label)}: ${esc(name)}" aria-pressed="${curv === v}"></button>`;
  }).join('');
  const custom = curv && !PC.COLOR_TOKENS.some(([v]) => v === curv), hex = toHex(curv || computed);
  return `<div class="field"><span class="lbl">${esc(label)}</span><div class="swatches" role="group" aria-label="${esc(label)}">${o.none ? `<button type="button" class="swatch none${curv === 'transparent' || (!curv && clear(computed)) ? ' on' : ''}" data-hx-color="${prop}" data-v="transparent" data-fs="hc:${prop}:none" title="None" aria-label="${esc(label)}: none"></button>` : ''}${sw}<label class="swatch custom${custom ? ' on' : ''}" title="Custom colour"><input type="color" data-hx-colorinput="${prop}" data-fs="hci:${prop}" value="${hex}" aria-label="${esc(label)}: custom colour"></label></div></div>`;
}
function fontSelect(c) {
  const fam = (c.family || '').toLowerCase(), key = Object.keys(PC.FONTS).find(k => PC.FONTS[k].family.toLowerCase() === fam && k !== 'body' && k !== 'display') || Object.keys(PC.FONTS).find(k => PC.FONTS[k].family.toLowerCase() === fam) || '';
  const g = F.fontOptions(key || (c.family && !(PC.localFonts && PC.localFonts.list || []).includes(c.family) ? c.family : '')), id = fid();
  if (!key && c.family) { const cur = Object.values(g).some(m => Object.keys(m).includes(c.family)); if (!cur) g.Custom = Object.assign({ [c.family]: c.family }, g.Custom || {}); }
  return `<div class="field"><label for="${id}">Font</label><select class="sel" style="width:100%" id="${id}" data-hx-sel="font-family" data-fs="hs:font">${Object.entries(g).map(([grp, m]) => `<optgroup label="${esc(grp)}">${Object.entries(m).map(([k, v]) => `<option value="${esc(k)}"${(key || c.family) === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="field" style="margin-top:-4px"><label for="${id}n" class="sm-lbl">Or type an installed font name</label><input class="inp" id="${id}n" data-hx-fontname placeholder="e.g. Helvetica Neue" maxlength="60" autocomplete="off" spellcheck="false"></div>`;
}
function treeList(s, openAll) {
  const t = E.htmlTree[s.id] || []; if (!t.length) return '';
  const sel = new Set(((cur() || {}).info || { items: [] }).items.map(x => x.i));
  return `<details class="hx-tree"${openAll ? ' open' : ''}><summary>Elements on this slide <span class="hint">${t.length}</span></summary><div class="sel-list" role="list">${t.map(x => `<button type="button" class="sel-item${sel.has(x.i) ? ' on' : ''}" role="listitem" data-hx-pick="${x.i}" aria-pressed="${sel.has(x.i)}" style="padding-left:${8 + x.d * 12}px"><code>${esc(x.label)}</code>${x.text ? `<span>${esc(x.text)}</span>` : ''}</button>`).join('')}</div></details>`;
}
const hint = 'Click anything on the slide to select it. Drag to move, use the handles to resize, arrow keys to nudge (Shift for 10 px), double-click text to type, Shift-click to select several.';

H.html = function (s) {
  const hs = cur(), add = sec('Add to this slide', `<div class="row wrap"><button class="btn sm" data-act="ins-text">${icon('type', 14)} Text box</button><button class="btn sm" data-act="ins-image">${icon('image', 14)} Image</button><button class="btn sm" data-act="ins-shape">${icon('shapes', 14)} Shape</button><button class="btn sm" data-act="ins-icon">${icon('star', 14)} Icon</button></div>`);
  if (!hs) {
    return PC.inspector.panelBuild(s) + sec('Design this slide', `<p class="note">${hint}</p><p class="note">Moves and resizes are saved on the element as <code>translate</code>, <code>left</code>/<code>top</code> and <code>width</code>/<code>height</code>; colours, fonts and sizes as inline styles. The Code tab shows exactly what was written.</p><div class="row wrap"><button class="btn sm primary" data-build="custom">${icon('code', 14)} Open the code editors</button><button class="btn sm" data-act="ai">${icon('sparkles', 14)} Ask an AI</button>${H.clip ? btn('paste', 'Paste copied elements', 'copy') : ''}</div>`)
      + `<div class="ins-sec">${treeList(s, true) || '<p class="note">Elements appear here once the slide has loaded.</p>'}</div>` + add;
  }
  const i = hs.info, c = i.cs, many = i.n > 1, ink = i.inl, deco = new Set((c.deco || '').split(' ')), text = i.hasText || i.kind === 'text', isImg = i.kind === 'img';
  const nm = many ? `${i.n} elements` : i.label || i.tag;
  let h = `<div class="fobj-head">${icon(isImg ? 'image' : i.kind === 'text' ? 'type' : 'shapes', 18)}<b>${esc(nm)}</b><span>${many ? 'last one clicked is shown' : esc(i.text || (i.kind === 'box' ? 'box' : i.kind))}</span></div>
    <div class="row wrap" style="margin:-4px 0 12px">${!many && i.kind === 'text' ? btn('edit', 'Edit text', 'edit') : ''}${!many ? btn('parent', 'Select parent', 'up') + btn('child', 'Select inside', 'down') : ''}</div>`;
  if (!many) h += sec('Position and size', `<div class="row">${nbox('X', 'x', i.rect.x)}${nbox('Y', 'y', i.rect.y)}</div><div class="row">${nbox('Width', 'w', i.rect.w, { min: 8 })}${nbox('Height', 'h', i.rect.h, { min: 8 })}</div>${i.canResize ? '' : '<p class="note">This element is rotated or scaled by the slide\'s CSS, so it can be moved but not resized here.</p>'}<div class="row wrap">${!i.auto.w || !i.auto.h ? `<button class="btn sm" type="button" data-hx-op="autosize">${icon('refresh', 14)} Auto size</button>` : ''}${i.moved ? `<button class="btn sm" type="button" data-hx-op="unmove">${icon('refresh', 14)} Reset nudge</button>` : ''}</div>`, `slide is 1280 × 720 · ${c.pos === 'static' ? 'moves saved as translate' : 'moves saved as left/top'}`);
  if (text) {
    h += sec('Text', `${fontSelect(c)}
      <div class="row fsz"><div class="field fnum" style="flex:1;margin:0"><label for="hxsize">Size (px)</label><input class="inp" id="hxsize" type="number" data-hx-num="size" data-fs="hn:size" value="${Math.round(c.size) || ''}" min="4" max="600" step="1"></div><button type="button" class="btn sm" data-hx-step="-2" aria-label="Smaller text">A−</button><button type="button" class="btn sm" data-hx-step="2" aria-label="Larger text">A+</button></div>
      <div class="field" style="margin-top:10px"><span class="lbl">Style</span><div class="tg-row">${tog('Bold', 'bold', c.weight >= 600, 'B', 'b')}${tog('Italic', 'italic', c.style === 'italic', 'I', 'i')}${tog('Underline', 'underline', deco.has('underline'), 'U', 'u')}${tog('Strikethrough', 'strike', deco.has('line-through'), 'S', 's')}${tog('Uppercase', 'caps', c.caps === 'uppercase', 'AA')}</div></div>
      <div class="field"><span class="lbl">Align</span>${seg('text-align', ({ start: 'left', end: 'right' })[c.align] || c.align, { left: 'Left', center: 'Centre', right: 'Right', justify: 'Justify' })}</div>
      ${colorRow('Colour', 'color', ink.color, c.color)}
      <div class="row">${nbox('Line height', 'lh', c.lh ? Math.round(c.lh * 100) / 100 : '', { step: .05, min: .5, max: 4, ph: 'auto' })}${nbox('Letter spacing (em)', 'ls', Math.round(c.ls * 100) / 100, { step: .01, min: -.5, max: 2 })}</div>
      ${i.container ? `<label class="switch"><span>Also change the text inside <small class="hint">colour, font, style and alignment reach the words in it too</small></span><input type="checkbox" data-hx-check="deep" ${hs.deep ? 'checked' : ''}></label>` : ''}`, many ? 'applies to every selected element' : 'double-click the words to format only some of them');
  }
  h += sec(isImg ? 'Picture' : 'Box', `${isImg ? '' : colorRow('Fill', 'background-color', ink['background-color'], c.bg, { none: true })}
    ${i.tag === 'img' || i.tag === 'video' ? `<div class="field"><span class="lbl">Fit</span>${seg('object-fit', ink['object-fit'] || 'fill', { cover: 'Fill', contain: 'Show all', fill: 'Stretch' })}</div>` : ''}
    <div class="row"><div class="field fnum"><label for="hxop">Opacity</label><input id="hxop" class="rng" type="range" min="0" max="100" value="${Math.round(c.opacity * 100)}" data-hx-num="opacity" data-fs="hn:opacity" aria-label="Opacity"></div>${nbox('Corner radius', 'radius', c.radius, { min: 0, max: 2000 })}</div>
    <div class="row">${nbox('Border width', 'bw', c.bw, { min: 0, max: 80 })}${isImg ? '' : nbox('Padding', 'pad', c.pad, { min: 0, max: 400 })}</div>
    ${c.bw > 0 || ink['border-width'] ? colorRow('Border colour', 'border-color', ink['border-color'], c.bc) : ''}
    <label class="switch"><span>Shadow</span><input type="checkbox" data-hx-check="shadow" ${c.shadow ? 'checked' : ''}></label>`);
  h += sec('Arrange', `<div class="row wrap">${btn('front', 'To front', 'front')}${btn('forward', 'Forward', 'forward')}${btn('backward', 'Backward', 'backward')}${btn('back', 'To back', 'back')}</div>
    <div class="lbl" style="margin:10px 0 6px">Align ${many ? 'to each other' : 'to the slide'}</div><div class="row wrap">${['left', 'center', 'right', 'top', 'middle', 'bottom'].map(a => btn('align:' + a, a === 'center' ? 'Centre' : a[0].toUpperCase() + a.slice(1))).join('')}</div>
    <div class="row wrap" style="margin-top:12px">${btn('dup', 'Duplicate', 'copy')}${btn('del', 'Delete', 'trash')}</div>
    <div class="row wrap" style="margin-top:8px">${btn('copy', 'Copy', 'copy')}${btn('cut', 'Cut', 'trash')}${btn('paste', 'Paste', 'copy')}</div>`, 'Ctrl+C · X · V · D · Delete');
  h += sec('In the code', `<p class="note">Everything above is written as an inline <code>style</code> on this element in the slide's HTML, so an AI or a person editing the code sees it, and it carries into PDF and PowerPoint.</p><div class="row wrap"><button class="btn sm" data-build="custom">${icon('code', 14)} Open the code editors</button></div>`);
  return h + `<div class="ins-sec">${treeList(s, false)}</div>`;
};

/* ── events ── */
const FIELDS = { size: v => ({ 'font-size': v + 'px' }), lh: v => ({ 'line-height': String(v) }), ls: v => ({ 'letter-spacing': v + 'em' }), opacity: v => ({ opacity: String(clamp(v / 100, 0, 1)) }), radius: v => ({ 'border-radius': v + 'px' }), bw: v => ({ 'border-width': v + 'px' }), pad: v => ({ padding: v + 'px' }) };
H.bind = function () {
  const panel = $('#panel');
  panel.addEventListener('mousedown', e => { if (e.target.closest('.hx-tree button, [data-hx-op], [data-hx-toggle], [data-hx-set], [data-hx-color]') && cur() && cur().editing) e.preventDefault(); });   // keep the words selected while Bold etc. is pressed
  panel.addEventListener('input', e => {
    const el = e.target, hs = cur(); if (!hs) return;
    if (el.matches('[data-hx-num]')) {
      const k = el.dataset.hxNum, v = parseFloat(el.value);
      if (['x', 'y', 'w', 'h'].includes(k)) { if (!isNaN(v)) geom({ [k]: v }); return; }
      if (isNaN(v)) { if (k === 'lh') H.apply({}, ['line-height'], 'lh'); return; }
      if (k === 'size' && v < 4) return;
      H.apply(FIELDS[k](v), [], 'fmt:' + k); return;
    }
    if (el.matches('[data-hx-colorinput]')) H.apply({ [el.dataset.hxColorinput]: el.value }, [], 'fmt:c:' + el.dataset.hxColorinput);
  });
  panel.addEventListener('change', e => {
    const el = e.target, hs = cur(); if (!hs) return;
    if (el.matches('[data-hx-sel]')) { const v = el.value; if (v) H.apply({ 'font-family': PC.fontCss(v) }, [], 'font'); return; }
    if (el.matches('[data-hx-fontname]')) { const f = PC.cleanFont(el.value); if (el.value.trim() && !f) { el.setCustomValidity('Letters, numbers, spaces and - . _ & + only'); el.reportValidity(); return; } el.setCustomValidity(''); if (f) H.apply({ 'font-family': PC.fontCss(f) }, [], 'font'); return; }
    if (el.matches('[data-hx-check]')) {
      const k = el.dataset.hxCheck; if (k === 'deep') { hs.deep = el.checked; return; }
      if (k === 'shadow') H.apply({ 'box-shadow': el.checked ? '0px 10px 30px rgba(0, 0, 0, 0.25)' : 'none' }, [], 'shadow');
    }
  });
  panel.addEventListener('focusout', () => { setTimeout(() => { const hs = E.htmlSel; if (hs && hs.dirty && !H.busy()) { hs.dirty = false; PC.inspector.render(); } }, 0); });
  panel.addEventListener('click', e => {
    const t = e.target, hs = cur();
    const pk = t.closest('[data-hx-pick]'); if (pk) { const i = slideIdx(S.slide().id); post(i, { pc: 'select', i: [+pk.dataset.hxPick], add: e.shiftKey }); return; }
    if (t.closest('[data-hx-op="paste"]')) { H.pasteButton(); return; }
    if (!hs) return;
    const tg = t.closest('[data-hx-toggle]'); if (tg) { H.toggle(tg.dataset.hxToggle); return; }
    const sc = t.closest('[data-hx-color]'); if (sc) { H.apply({ [sc.dataset.hxColor]: sc.dataset.v }, [], 'fmt:c:' + sc.dataset.hxColor); return; }
    const st = t.closest('[data-hx-set]'); if (st) { H.apply({ [st.dataset.hxSet]: st.dataset.v }, [], 'fmt:' + st.dataset.hxSet); return; }
    const sp = t.closest('[data-hx-step]'); if (sp) { H.apply({ 'font-size': clamp(Math.round(hs.info.cs.size) + +sp.dataset.hxStep, 4, 600) + 'px' }, [], 'fmt:size'); return; }
    const op = t.closest('[data-hx-op]'); if (!op) return; const o = op.dataset.hxOp, i = slideIdx(hs.id);
    if (o === 'copy' || o === 'cut') H.copy('', o === 'cut'); else if (['front', 'back', 'forward', 'backward', 'dup'].includes(o)) H.struct(o); else if (o === 'del') H.struct('delete');
    else if (o.startsWith('align:')) post(i, { pc: 'cmd', cmd: o }); else if (['edit', 'parent', 'child'].includes(o)) post(i, { pc: 'cmd', cmd: o });
    else if (o === 'autosize') geom({ w: null, h: null }); else if (o === 'unmove') H.apply({}, ['translate'], 'unmove');
  });
  /* the browser's own copy / cut / paste, when the editor (not the frame) has focus */
  const mine = e => !(UI.isTextTarget(e.target) || UI.hasModal() || PC.present.isOpen()) && !!e.clipboardData;
  ['copy', 'cut'].forEach(ev => document.addEventListener(ev, e => {
    const hs = cur(); if (!hs || hs.editing || !mine(e)) return;
    const tk = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    e.clipboardData.setData('text/plain', JSON.stringify({ 'pitchcraft/html': 1, token: tk })); e.preventDefault(); H.copy(tk, ev === 'cut');
  }));
  document.addEventListener('paste', e => {
    if (e.defaultPrevented || !mine(e)) return; const s = S.slide(); if (!s || s.layout !== 'custom') return;
    const t = e.clipboardData.getData('text/plain') || ''; if (t.indexOf('pitchcraft/html') < 0) return;
    e.preventDefault(); H.paste(t, S.sel);
  });
  /* the editor's own events */
  S.on('select', () => { const hs = E.htmlSel, s = S.slide(); if (hs && s && s.id !== hs.id) H.clear(); });
  S.on('stage', () => { if (E.htmlSel && PC.stage.sel.length) H.clear(); });
  S.on('deck', () => { E.htmlSel = null; S.emit('htmlsel'); });
  /* Undo and Redo reload the frames; keep the same elements selected so a nudge can be undone and the next one made straight away */
  ['undo', 'redo'].forEach(k => { const f = S[k]; S[k] = function () { const hs = cur(); if (hs) H.pending = { id: hs.id, sel: hs.info.items.map(x => x.i), t: Date.now() }; const r = f.apply(S, arguments); if (!r) H.pending = null; return r; }; });
  S.on('slide', ({ i, src }) => { const hs = E.htmlSel, s = S.slide(i); if (src !== 'frame' && hs && s && hs.id === s.id) { E.htmlSel = null; S.emit('htmlsel'); } });
  window.addEventListener('resize', () => H.scale());
};
})();
