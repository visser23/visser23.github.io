/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT main — actions, dialogs, import/export, print, audit, public API, boot
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, E = PC.editor, Ins = PC.inspector, P = PC.present, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const log = (...a) => console.info('[pitchcraft]', ...a);

/* ── deck IO ── */
const stripFences = t => String(t).trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
const deckJson = () => JSON.stringify(S.deck, null, 2);
let exportedSnap = '';   // the deck as it was when the user last downloaded a file: anything after that counts as unsaved
PC.exportDeck = () => { UI.download(PC.slug(S.deck.meta.name) + '.pitchcraft', deckJson(), 'application/json'); exportedSnap = JSON.stringify(S.deck); };
/** True when there is nothing worth saving: the deck is one of the shipped decks exactly as shipped, or it matches the last downloaded file. */
let shippedSet = null;
PC.isPristine = function () {
  const now = JSON.stringify(S.deck);
  if (now === exportedSnap) return true;
  if (!shippedSet) shippedSet = new Set(PC.TEMPLATES.map(t => JSON.stringify(PC.parseDeck(PC.clone(t.deck)).deck)));
  return shippedSet.has(now);
};
/** The one-slide starter deck. Undoable, so no confirmation is needed from code; the UI asks first (PC.newDeckFlow). */
PC.newDeck = function () {
  const t = PC.TEMPLATES.find(x => x.id === 'blank'); S.load(PC.parseDeck(PC.clone(t.deck)).deck); log('new deck started'); return { slides: S.count() };
};
/** The "New deck" button: if there are unsaved changes, offer to download the file first. */
PC.newDeckFlow = function () {
  if (PC.isPristine()) { PC.newDeck(); UI.toast('New deck started'); return null; }
  const body = document.createElement('div');
  body.innerHTML = `<p>This deck has changes that are not saved to a file. Download it first?</p><p class="hint">Your work is autosaved in this browser, but starting a new deck replaces it. Ctrl+Z brings it back until you close the page.</p>`;
  const foot = document.createElement('div'); foot.style.display = 'contents';
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn" id="nd-skip">Start new without saving</button><button class="btn primary" id="nd-save">${icon('download', 16)} Download file, then start new</button>`;
  const m = UI.modal({ title: 'Start a new deck?', body, footer: foot });
  $('#nd-save', m.el).addEventListener('click', () => { PC.exportDeck(); m.close(); PC.newDeck(); UI.toast('File downloaded. New deck started.'); });
  $('#nd-skip', m.el).addEventListener('click', () => { m.close(); PC.newDeck(); UI.toast('New deck started. Ctrl+Z brings the old one back.'); });
  return m;
};
PC.importText = function (text, mode) {
  const { deck, warnings } = PC.parseDeck(stripFences(text));
  if (mode === 'append') {
    const merged = S.deck; deck.slides.forEach(s => { s.id = S.uniqueId(s.id); merged.slides.push(s); });
    if (merged.slides.length > 200) { merged.slides.length = 200; warnings.push('Only the first 200 slides were kept.'); }
    S.sel = S.count() - deck.slides.length; S.commit(''); S.emit('deck'); S.emit('select', { i: S.sel, src: 'add' });
  } else S.load(deck);
  log(`imported ${deck.slides.length} slide(s) (${mode || 'replace'})`, warnings.length ? warnings : '');
  return { deck, warnings };
};
/** Import a PowerPoint file (.pptx) as custom HTML slides. bytes: Uint8Array/ArrayBuffer; mode 'replace' | 'append'. Returns { deck, warnings, report }. */
PC.importPptxBytes = async function (bytes, mode, name) {
  const r = await PC.importPptx(bytes, { name, progress: m => log('pptx import:', m) });
  const { warnings } = PC.importText(JSON.stringify(r.deck), mode); r.warnings = r.warnings.concat(warnings.filter(w => !r.warnings.includes(w)));
  log(`pptx imported: ${r.report.slides} slides, ${r.report.pictures} pictures, ${r.warnings.length} notes`);
  return r;
};
PC.importPptxFile = async function (file, mode) {
  if (file.size > 120 * 1024 * 1024) throw new Error('That PowerPoint file is over 120 MB.');
  const note = UI.toast('Reading the PowerPoint file…', 'ok');
  try { const r = await PC.importPptxBytes(new Uint8Array(await file.arrayBuffer()), mode, file.name); PC.importReport(r, file.name); return r; }
  finally { if (note && note.remove) note.remove(); }
};
PC.importReport = function (r, name) {
  const w = r.warnings;
  UI.modal({ title: 'PowerPoint imported', body: `<p><b>${esc(name || 'The file')}</b> became ${r.report.slides} HTML slide${r.report.slides === 1 ? '' : 's'}${r.report.pictures ? ` with ${r.report.pictures} picture${r.report.pictures === 1 ? '' : 's'}` : ''}. Double-click text on a slide to edit it in place; the Code tab has the HTML and CSS.</p>
    ${r.report.fonts.length ? `<p><b>Fonts used:</b> ${r.report.fonts.slice(0, 12).map(esc).join(', ')}. Fonts this computer lacks are replaced by a similar one.</p>` : ''}
    ${w.length ? `<div class="lp-group">Needs a look</div><ul class="plain">${w.slice(0, 14).map(x => `<li>${esc(x)}</li>`).join('')}</ul>${w.length > 14 ? `<p class="hint">…and ${w.length - 14} more.</p>` : ''}` : '<p>Nothing needed attention.</p>'}`,
    footer: '<button class="btn primary" type="button" data-close>Done</button>' });
};
PC.loadTemplate = function (id) {
  const t = PC.TEMPLATES.find(x => x.id === id); if (!t) throw new Error('Unknown template ' + id);
  S.load(PC.parseDeck(PC.clone(t.deck)).deck); UI.toast(`Loaded "${t.name}". Ctrl+Z brings your old deck back.`); log('template loaded:', id);
};

/* ── dialogs ── */
PC.templatesDialog = function () {
  const cards = PC.TEMPLATES.map(t => {
    const d = PC.parseDeck(PC.clone(t.deck)).deck;
    return `<button class="tp-card" data-tpl="${t.id}"><div class="pv" aria-hidden="true"><div class="stage">${PC.renderSlide(d.slides[0], { editable: false, index: 0, total: d.slides.length, deck: d })}</div></div><b>${esc(t.name)}<span class="tag">${esc(t.tag)}</span></b><span class="d">${esc(t.blurb)}</span><span class="meta">${d.slides.length} slide${d.slides.length === 1 ? '' : 's'} · ${esc(PC.THEMES[d.meta.theme].name)} theme</span></button>`;
  }).join('');
  const m = UI.modal({ title: 'Start from a template', body: `<p>Every template is real deck JSON. Load one, then change anything. You can undo the switch.</p><div class="tp-grid">${cards}</div>` });
  m.el.addEventListener('click', e => { const c = e.target.closest('[data-tpl]'); if (c) { m.close(); PC.loadTemplate(c.dataset.tpl); } });
};

PC.importDialog = function (prefill, pptxFile) {
  const body = document.createElement('div');
  body.innerHTML = `<p>Drop a <code>.pitchcraft</code> file or a <b>PowerPoint (.pptx)</b> file, or paste deck JSON (from an AI chat, or a file you exported). Older Pitchcraft decks are upgraded automatically. <button class="linkish" id="imp-ai" type="button">Need an AI to write one?</button></p>
    <div class="drop" id="imp-drop">Drop a <b>.pitchcraft</b>, <b>.json</b> or <b>.pptx</b> file here, or <button class="btn sm" id="imp-pick">choose a file</button><input type="file" id="imp-file" accept=".json,.pitchcraft,.pptx,.potx,application/json,text/plain,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden></div>
    <label class="lbl" for="imp-text">Deck JSON</label><textarea class="txt mono" id="imp-text" rows="10" spellcheck="false" placeholder='{ "meta": { "name": "My deck" }, "slides": [ … ] }' data-autofocus></textarea><div class="err" id="imp-err" role="alert"></div>`;
  const foot = document.createElement('div'); foot.style.display = 'contents';
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn" id="imp-add">Add to this deck</button><button class="btn primary" id="imp-replace">Replace deck</button>`;
  const m = UI.modal({ title: 'Import a deck', body, footer: foot, size: 'mid' });
  const ta = $('#imp-text', m.el), err = $('#imp-err', m.el), drop = $('#imp-drop', m.el); if (prefill) ta.value = prefill;
  $('#imp-ai', m.el).addEventListener('click', () => { m.close(); PC.ai.dialog('chat'); });
  let pending = null;
  const setPending = f => { pending = f; ta.value = ''; ta.disabled = true; err.textContent = ''; ta.placeholder = `${f.name} (${Math.round(f.size / 1024)} KB) is ready. Choose Add to this deck or Replace deck: each slide becomes an HTML slide you can edit.`; };
  const run = async mode => { if (pending) { try { m.close(); await PC.importPptxFile(pending, mode); } catch (ex) { UI.toast('The PowerPoint import failed: ' + (ex && ex.message || ex), 'err'); log('pptx import failed', ex); } return; } try { const { warnings } = PC.importText(ta.value, mode); m.close(); UI.toast(warnings.length ? `Imported with ${warnings.length} note(s): ${warnings[0]}` : 'Deck imported'); } catch (ex) { err.textContent = ex.message; ta.focus(); } };
  const read = f => { if (!f) return; if (/\.(pptx|potx|ppsx)$/i.test(f.name)) { setPending(f); return; } if (f.size > 8 * 1024 * 1024) { err.textContent = 'That file is over 8 MB.'; return; } const r = new FileReader(); r.onload = () => { ta.value = String(r.result); err.textContent = ''; }; r.readAsText(f); };
  $('#imp-replace', m.el).addEventListener('click', () => run('replace')); $('#imp-add', m.el).addEventListener('click', () => run('append'));
  $('#imp-pick', m.el).addEventListener('click', () => $('#imp-file', m.el).click()); $('#imp-file', m.el).addEventListener('change', e => read(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); if (ev === 'drop') read(e.dataTransfer.files[0]); }));
  if (pptxFile) setPending(pptxFile);
  return m;
};

PC.exportMenu = function (anchor) {
  UI.menu(anchor, [
    { icon: 'download', label: 'Download deck file', hint: '.pitchcraft · re-import any time', run: PC.exportDeck },
    { icon: 'copy', label: 'Copy deck JSON', hint: 'Paste into an AI or a repo', run: () => UI.copy(deckJson(), 'Deck JSON copied') },
    { icon: 'printer', label: 'Save as PDF', hint: 'Opens the print dialog · one slide per page', run: () => PC.print() },
    { icon: 'sparkles', label: 'Build with AI…', hint: 'Prompts for chat windows and browser AIs', run: () => PC.ai.dialog() },
    '-',
    { icon: 'presentation', label: 'PowerPoint (.pptx)', hint: 'Editable shapes, text boxes and notes', run: () => PC.exportPptx() }
  ]);
};

/** Build the PowerPoint file, offer it for download, and say plainly what to check. */
PC.exportPptx = async function (opt) {
  opt = opt || {};
  const note = UI.toast('Building the PowerPoint file…', 'ok');
  try {
    const t0 = performance.now(), r = await PC.pptx(S.deck, { progress: m => log('pptx:', m), fonts: opt.fonts });
    log('pptx built in', Math.round(performance.now() - t0), 'ms,', r.bytes.length, 'bytes,', r.report.warnings.length, 'warnings');
    if (opt.returnBytes) return r;
    const url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })), a = document.createElement('a');
    a.href = url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    const m = UI.modal({ title: 'PowerPoint file ready', size: '',
      body: `<p><b>${esc(r.name)}</b> has been downloaded: ${r.report.slides} slide${r.report.slides === 1 ? '' : 's'}${r.report.pictures ? `, ${r.report.pictures} picture${r.report.pictures === 1 ? '' : 's'}` : ''}.</p>
        <p>Text, shapes, lines, speaker notes and links are real PowerPoint objects you can edit. Charts and icons arrive as pictures. Animations and some effects (blur, glows) are not carried over.</p>
        ${r.report.fontMap.length ? (r.report.fontMode === 'keep'
          ? `<p><b>Original fonts kept:</b> ${r.report.fontMap.map(f => `<a href="https://fonts.google.com/specimen/${encodeURIComponent(f.from).replace(/%20/g, '+')}" target="_blank" rel="noopener">${esc(f.from)}</a>`).join(', ')}. Install any you do not have before opening the file, otherwise PowerPoint swaps in its own font and the text reflows. <button class="btn" type="button" data-fonts="similar">Use fonts PowerPoint already has</button></p>`
          : `<p><b>Fonts:</b> ${r.report.fontMap.map(f => f.from === f.to ? esc(f.from) : `${esc(f.from)} → ${esc(f.to)}`).join(', ')}. Web fonts are swapped for the closest font that ships with PowerPoint, so the file looks the same on any computer. <button class="btn" type="button" data-fonts="keep">Keep the original fonts instead</button></p>`) : ''}
        ${r.report.warnings.length ? `<div class="lp-group">Needs a look</div><ul class="plain">${r.report.warnings.slice(0, 12).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`,
      footer: '<button class="btn primary" type="button" data-close>Done</button>' });
    m.body.addEventListener('click', e => { const b = e.target.closest('[data-fonts]'); if (!b) return; m.close && m.close(); PC.exportPptx({ fonts: b.dataset.fonts }); });
    return r;
  } catch (e) {
    log('pptx failed', e); UI.toast('The PowerPoint export failed: ' + (e && e.message || e), 'err');
    if (opt.returnBytes) throw e;
  } finally { if (note && note.remove) note.remove(); }
};

/** Settings: appearance now; fonts and privacy are added by their own modules through PC.settingsExtras. */
PC.settingsExtras = PC.settingsExtras || [];
PC.settingsDialog = function () {
  const cur = () => window.PCUI ? window.PCUI.pref() : 'light';
  const row = (title, hint, control) => `<div class="settings-row"><div><b>${title}</b><small>${hint}</small></div>${control}</div>`;
  const m = UI.modal({ title: 'Settings', size: '',
    body: `<div class="settings-h">Appearance</div>
      ${row('Colour scheme', 'Auto switches to dark from 19:00 to 07:00. Slides keep their own theme either way.', `<div class="seg" role="group" aria-label="Colour scheme">${[['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['auto', 'Auto', 'clock']].map(([k, l, ic]) => `<button type="button" data-ui-pref="${k}" aria-pressed="${cur() === k}">${icon(ic, 15)} ${l}</button>`).join('')}</div>`)}
      <div data-extras></div>
      <p class="hint" style="margin:14px 0 0">Pitchcraft v${esc(PC.VERSION)}</p>`,
    footer: '<button class="btn primary" type="button" data-close>Done</button>' });
  m.body.addEventListener('click', e => {
    const b = e.target.closest('[data-ui-pref]'); if (!b) return;
    window.PCUI.set(b.dataset.uiPref); m.body.querySelectorAll('[data-ui-pref]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    log('appearance set to', b.dataset.uiPref, '->', document.documentElement.dataset.ui);
  });
  const host = $('[data-extras]', m.body); PC.settingsExtras.forEach(fn => { try { fn(host, m); } catch (e) { log('settings extra failed', e); } });
};

/** Insert > Shape: a small grid of previews. */
PC.shapeMenu = function (anchor) {
  const m = document.createElement('div'); m.className = 'menu shape-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Insert a shape or line');
  const lines = Object.entries(PC.LINE_PRESETS).map(([k, [name, kind, a0, a1]]) => `<button type="button" role="menuitem" class="shape-opt" data-line="${k}" title="${esc(name)}" aria-label="${esc(name)}">${PC.lineSvg({ kind, arrowStart: a0, arrowEnd: a1, strokeW: 3, stroke: 'currentColor', flipV: kind === 'straight' }, 52, 26).replace('class="ob-svg ob-linesvg"', 'class="ob-svg" style="margin:6px 0"')}<span>${esc(name)}</span></button>`).join('');
  const shapes = PC.SHAPE_MENU.map(k => [k, PC.SHAPES[k]]).map(([k, name]) => `<button type="button" role="menuitem" class="shape-opt" data-shape="${k}" title="${esc(name)}" aria-label="${esc(name)}">${PC.shapeSvg({ shape: k, fill: 'currentColor', stroke: 'currentColor', strokeW: 0 }, 56, 40)}<span>${esc(name)}</span></button>`).join('');
  m.innerHTML = `<h5>Lines and connectors</h5>${lines}<h5>Shapes</h5>${shapes}`;
  m.addEventListener('click', e => {
    const l = e.target.closest('[data-line]'); if (l) { UI.closeMenu(); PC.stage.setTool(l.dataset.line); return; }
    const b = e.target.closest('[data-shape]'); if (!b) return; UI.closeMenu(); PC.stage.insert('shape', { shape: b.dataset.shape });
  });
  UI.popover(anchor, m); const f = $('button', m); if (f) f.focus();
};
PC.iconDialog = function () {
  const body = document.createElement('div');
  body.innerHTML = `<p>Pick an icon. You can recolour and resize it afterwards.</p><div class="icon-pick big" role="group" aria-label="Icons">${PC.ICON_NAMES.map(n => `<button type="button" data-ic="${n}" title="${n}" aria-label="${n}">${icon(n, 26)}</button>`).join('')}</div>`;
  const m = UI.modal({ title: 'Insert an icon', body, size: 'mid' });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-ic]'); if (!b) return; m.close(); PC.stage.insert('icon', { icon: b.dataset.ic }); });
};
PC.imageUrlDialog = function () {
  const body = document.createElement('div');
  body.innerHTML = `<p>Paste the address of a picture (https). Pictures from other sites only show if that site allows it, and they need to be online when you present. To keep a picture inside the deck, upload it instead.</p><label class="lbl" for="imgurl">Picture address</label><input class="inp" id="imgurl" placeholder="https://…" autocomplete="off" data-autofocus><div class="err" id="imgurl-err" role="alert"></div>`;
  const foot = document.createElement('div'); foot.style.display = 'contents'; foot.innerHTML = '<button class="btn" data-close>Cancel</button><button class="btn primary" id="imgurl-ok">Insert</button>';
  const m = UI.modal({ title: 'Insert a picture from the web', body, footer: foot });
  const go = () => { const v = $('#imgurl', m.el).value.trim(); if (!v || !PC.okUrl(v) || !/^https?:/i.test(v)) { $('#imgurl-err', m.el).textContent = 'Use an address that starts with https://'; return; } m.close(); PC.stage.insertImageUrl(v); };
  $('#imgurl-ok', m.el).addEventListener('click', go); $('#imgurl', m.el).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
};

/* ── print / PDF ── */
PC.preparePrint = function () {
  const root = $('#print-root'), n = S.count();
  root.innerHTML = S.deck.slides.map((s, i) => `<div class="print-page">${PC.renderSlide(s, { editable: false, index: i, total: n, deck: S.deck })}</div>`).join('');
  return root;
};
PC.print = function () {
  const root = PC.preparePrint(), done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); log('print requested,', S.count(), 'pages');
  /* custom slides are sandboxed iframes: give them a moment to load (and fetch the kit fonts) before the print dialog freezes the page */
  const frames = Array.from(root.querySelectorAll('iframe.cs-frame'));
  if (!frames.length) { setTimeout(() => window.print(), 80); return; }
  const loaded = Promise.all(frames.map(f => new Promise(res => f.addEventListener('load', res, { once: true }))));
  Promise.race([loaded, new Promise(res => setTimeout(res, 4000))]).then(() => setTimeout(() => window.print(), 350));
};

/* ── layout audit (used by tests and by anyone curious): finds text that clips or leaves the safe area ── */
PC.audit = function (deck) {
  deck = deck || S.deck; const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;pointer-events:none'; document.body.appendChild(host);
  const out = [];
  try {
    deck.slides.forEach((s, i) => {
      if (s.layout === 'custom') {   // the slide is a sandboxed iframe: nothing in here can see inside it, so say so rather than report a clean bill of health
        out.push({ index: i, id: s.id, layout: s.layout, theme: deck.meta.theme, bg: s.bg || '', problems: null, checked: false, status: 'unknown', note: 'UNKNOWN, not clean. Custom slide: not inspected here. Run await Pitchcraft.auditAll() to measure it in a sandbox.' });
        return;
      }
      host.innerHTML = PC.renderSlide(s, { editable: false, index: i, total: deck.slides.length, deck });
      const slide = host.firstElementChild, sr = slide.getBoundingClientRect(), problems = [];
      const flag = (type, el, detail) => problems.push({ type, el: (el.dataset && el.dataset.path) || String(el.className || el.tagName).split(' ').slice(0, 2).join('.'), detail });
      slide.querySelectorAll('[data-path],.card,.callout,.chip,.fl-node,.b-tile,svg.pc-svg,.cd-win,.im-fig,.an-mock,.th-card,.tl-item,.pr-step,.bl-row,.hs').forEach(el => {
        if (el.closest('.ob')) return;   // free-form objects are placed on purpose: they get their own checks below
        const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
        const b = r.bottom - sr.top, rt = r.right - sr.left, l = r.left - sr.left, t = r.top - sr.top;
        if (b > 668) flag('below-safe-area', el, `bottom ${Math.round(b)}px (max 668)`);
        if (rt > 1205) flag('right-overflow', el, `right ${Math.round(rt)}px (max 1205)`);
        if (l < 74) flag('left-overflow', el, `left ${Math.round(l)}px`);
        if (t < 40 && !el.closest('.deco')) flag('above-safe-area', el, `top ${Math.round(t)}px`);
      });
      slide.querySelectorAll('.card,.b-tile,.fl-node,.cd-pre,.th-card,.tl-card,.callout,.c-card,.m-card,.t-card,.sp-card,.cmp-card').forEach(el => {
        if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) flag('clipped', el, `content ${el.scrollWidth}x${el.scrollHeight} in box ${el.clientWidth}x${el.clientHeight}`);
      });
      slide.querySelectorAll('[data-path]').forEach(el => { if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).display !== 'inline') flag('text-wider-than-box', el, `${el.scrollWidth} > ${el.clientWidth}`); });
      slide.querySelectorAll('.ob').forEach(el => {
        const r = el.getBoundingClientRect(), b = r.bottom - sr.top, rt = r.right - sr.left, l = r.left - sr.left, t = r.top - sr.top, id = 'object ' + (el.dataset.obj || '?'), type = el.dataset.type;
        const off = rt < 8 || l > 1272 || b < 8 || t > 712;
        if (off) flag('object-off-stage', el, `${id} is outside the 1280x720 slide`);
        else if ((type === 'text' || type === 'icon') && (l < -2 || t < -2 || rt > 1282 || b > 722)) flag('object-off-stage', el, `${id} runs off the slide edge`);
        const tx = el.querySelector('.ob-t'); if (tx && el.style.height && (el.scrollHeight > el.clientHeight + 2 || tx.scrollHeight > el.clientHeight + 2)) flag('object-text-clipped', el, `${id}: text is taller than its box (${tx.scrollHeight} > ${el.clientHeight})`);
        if (type === 'text' && el.querySelector('.ob-t') && el.querySelector('.ob-t').scrollWidth > el.clientWidth + 2) flag('text-wider-than-box', el, `${id}: a word is wider than the box`);
      });
      out.push({ index: i, id: s.id, layout: s.layout, theme: deck.meta.theme, bg: s.bg || '', problems, checked: true, status: problems.length ? 'issues' : 'clean' });
    });
  } finally { host.remove(); }
  out.unchecked = out.filter(e => !e.checked).map(e => e.id); out.allChecked = out.unchecked.length === 0;
  return out;
};

/** The audit answer comes from a sandboxed slide the deck author controls: keep only the fields we know, as plain strings and numbers. */
const cleanAudit = r => {
  if (!r || typeof r !== 'object') return { error: 'the slide returned no result' };
  if (r.error) return { error: String(r.error).slice(0, 300) };
  const t = (v, n) => String(v == null ? '' : v).slice(0, n);
  return { problems: (Array.isArray(r.problems) ? r.problems : []).slice(0, 60).map(p => ({ type: t(p && p.type, 40), el: t(p && p.el, 80), text: t(p && p.text, 80), detail: t(p && p.detail, 300) })),
    texts: Math.max(0, Math.min(100000, Math.round(+r.texts) || 0)), fontsReady: r.fontsReady !== false };
};
/** One attempt at measuring a custom slide in a hidden, sandboxed copy of itself. Resolves { result } or { error }. */
function auditAttempt(s, deck, ms) {
  return new Promise(resolve => {
    const f = document.createElement('iframe'), id = 'a' + Math.random().toString(36).slice(2), errors = [];
    f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0;pointer-events:none';
    let done = false, poke = 0;
    const finish = r => { if (done) return; done = true; window.removeEventListener('message', onMsg); clearTimeout(to); clearInterval(poke); f.remove(); resolve(r); };
    const onMsg = e => {
      if (e.source !== f.contentWindow || !e.data) return;
      if (e.data.pc === 'error') errors.push(e.data.msg);
      if (e.data.pc === 'audit-result' && e.data.id === id) {
        const r = cleanAudit(e.data.result);                       // a custom slide answers for itself, so treat the answer as untrusted text and numbers
        if (r.error) return finish({ error: r.error });
        if (r.problems) errors.slice(0, 5).forEach(m => r.problems.push({ type: 'script-error', el: 'script', text: '', detail: String(m).slice(0, 200) }));
        finish({ result: r });
      }
    };
    const to = setTimeout(() => finish({ error: 'no answer within ' + Math.round(ms / 1000) + 's', timeout: true }), ms);
    window.addEventListener('message', onMsg);
    // ask repeatedly once the frame has loaded: a request sent before the slide's scripts were ready is simply asked again
    f.addEventListener('load', () => setTimeout(() => { const ask = () => { try { f.contentWindow.postMessage({ pc: 'audit', id }, '*'); } catch (x) { finish({ error: String(x) }); } }; ask(); poke = setInterval(ask, 1500); }, 450));
    f.srcdoc = PC.customDoc(s, deck.meta, 'live');
    document.body.appendChild(f);
  });
}
/** Measure a custom slide. The first slide of a cold page can be slow (fonts and stylesheets load for the first time), so a miss is retried once with more time. */
async function auditCustom(s, deck) {
  let r = await auditAttempt(s, deck, PC._auditFirstMs || 12000);
  if (r.timeout) r = await auditAttempt(s, deck, PC._auditRetryMs || 20000);
  if (r.error) return { error: r.error + (r.timeout ? ' after two attempts. The usual cause is a slow first load of fonts or pictures; an endless loop in the slide\'s JavaScript is the other possibility' : ''), unknown: true };
  return r.result;
}
/** audit() plus the custom slides, measured in hidden sandboxes. Async.
 *  Each entry has status: 'clean' | 'issues' | 'unknown'. Unknown means the slide could NOT be measured; its problems list is null, never an empty clean-looking array. */
PC.auditAll = async function (deck) {
  deck = deck || S.deck; const base = PC.audit(deck);
  for (const e of base) {
    if (e.layout !== 'custom') continue;
    const r = await auditCustom(deck.slides[e.index], deck);
    if (r.error) { e.checked = false; e.status = 'unknown'; e.problems = null; e.note = 'UNKNOWN, not clean. Could not measure this custom slide: ' + r.error + '. Run auditAll() again.'; continue; }
    e.checked = true; e.problems = r.problems; e.texts = r.texts; e.status = r.problems.length ? 'issues' : 'clean'; delete e.note;
    if (r.fontsReady === false) e.note = 'Fonts were still loading when this was measured, so widths may differ slightly. Run auditAll() again to confirm.';
    if (!r.texts) e.note = 'No visible text found. Nothing to measure.';
  }
  base.unchecked = base.filter(e => !e.checked).map(e => e.id);
  base.allChecked = base.unchecked.length === 0;
  return base;
};

/** How big will this text be? Measured in a hidden slide with the deck's theme, so fonts and case match what the audience sees. */
PC.measureText = function (text, o) {
  o = o || {}; const theme = (S.deck.meta && S.deck.meta.theme) || 'studio', th = PC.THEMES[theme] || PC.THEMES.studio;
  const font = o.font || 'body', size = Math.max(6, Math.min(600, +o.size || 28)), key = String(font);
  const isHeading = key === 'display';
  const fam = Object.prototype.hasOwnProperty.call(PC.FONTS, key) ? PC.fontCss(key) : PC.cleanFont(key) ? PC.fontCss(PC.cleanFont(key)) : PC.fontCss('body');
  const weight = o.weight != null ? +o.weight : isHeading ? 'var(--d-weight)' : 400;
  const caps = o.caps != null ? !!o.caps : null, ls = o.ls != null ? +o.ls + 'em' : isHeading ? 'var(--d-ls)' : 'normal';
  const host = document.createElement('div'); host.className = 'slide'; host.dataset.theme = theme;
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;padding:0;pointer-events:none;overflow:visible';
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;left:0;top:0;margin:0;padding:0;white-space:pre-wrap;word-break:normal;overflow-wrap:normal;font-family:${fam};font-size:${size}px;font-weight:${weight};letter-spacing:${ls};line-height:${o.lh != null ? +o.lh : 1.25};`
    + (caps === null ? (isHeading ? 'text-transform:var(--d-case);' : '') : `text-transform:${caps ? 'uppercase' : 'none'};`) + (o.w ? `width:${Math.max(10, +o.w)}px;` : 'width:max-content;');
  box.textContent = String(text == null ? '' : text); host.appendChild(box); document.body.appendChild(host);
  try {
    const r = box.getBoundingClientRect(), lh = parseFloat(getComputedStyle(box).lineHeight) || size * 1.25, rg = document.createRange(); rg.selectNodeContents(box);
    const rects = Array.from(rg.getClientRects()), width = rects.length ? Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left)) : 0;
    return { width: Math.round(width), height: Math.round(r.height), lines: Math.max(1, Math.round(r.height / lh)), em: th.em[isHeading ? 'display' : 'body'], theme, font: key, size };
  } finally { host.remove(); }
};

/* ── actions ── */
const toggleClass = (key, def) => { const a = $('#app'); a.dataset[key] = a.dataset[key] === 'closed' ? 'open' : 'closed'; setTimeout(() => E.fit(), 30); setTimeout(() => E.fit(), 300); E.syncRibbon(); };
PC.act = function (act, btn) {
  switch (act) {
    case 'new': return E.layoutPicker('add');
    case 'layout': return E.layoutPicker('change');
    case 'dup': return S.duplicate(S.sel);
    case 'del': return S.remove(S.sel);
    case 'bold': return E.format('**'); case 'italic': return E.format('*'); case 'hl': return E.format('=='); case 'code': return E.format('`'); case 'clearfmt': return E.clearFormat();
    case 'templates': return PC.templatesDialog();
    case 'newdeck': return PC.newDeckFlow();
    case 'import': return PC.importDialog();
    case 'export': return PC.exportMenu(btn || $('.rb[data-act="export"]'));
    case 'print': return PC.print();
    case 'inspect': E.inspect = !E.inspect; $('#canvas-inner').classList.toggle('inspect', E.inspect); E.syncRibbon(); if (Ins.tab === 'code') Ins.render(); return;
    case 'numbers': return S.setMeta({ numbers: !S.deck.meta.numbers });
    case 'toggle-side': return toggleClass('side');
    case 'toggle-insp': return toggleClass('insp');
    case 'undo': if (S.undo()) { if (S.crossed) UI.toast('That undid a whole deck change. The deck you left is saved in Deck, Recover.', 'ok', { label: 'Redo', run: () => PC.act('redo') }); else UI.toast('Undone'); } return;
    case 'redo': if (S.redo()) UI.toast('Redone'); return;
    case 'help': return PC.helpDialog();
    case 'present': return P.open(S.sel);
    case 'ai': return PC.ai.dialog(btn && btn.dataset && btn.dataset.tab);
    case 'ins-text': return PC.stage.insert('text');
    case 'ins-image': return UI.menu(btn || $('.rb[data-act="ins-image"]'), [
      { icon: 'upload', label: 'Upload a picture…', hint: 'PNG, JPEG, GIF, WebP or SVG', run: () => PC.stage.pickImage() },
      { icon: 'link', label: 'From a web address…', hint: 'https:// link to a picture', run: () => PC.imageUrlDialog() },
      { icon: 'image', label: 'Empty picture frame', hint: 'Fill it in later', run: () => PC.stage.insert('image') }]);
    case 'ins-shape': return PC.shapeMenu(btn || $('.rb[data-act="ins-shape"]'));
    case 'ins-icon': return PC.iconDialog();
    default: log('unknown action', act);
  }
};

/* ── keyboard, paste, drop ── */
function bindGlobal() {
  document.addEventListener('keydown', e => {
    if (P.isOpen() || UI.hasModal()) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), text = UI.isTextTarget(e.target);
    if (mod && k === 's') { e.preventDefault(); PC.exportDeck(); return; }
    if (text) return;
    if (mod && k === 'z') { e.preventDefault(); PC.act(e.shiftKey ? 'redo' : 'undo'); }
    else if (mod && k === 'y') { e.preventDefault(); PC.act('redo'); }
    else if (mod && k === 'd') { e.preventDefault(); PC.act('dup'); }
    else if (!mod && !e.altKey && k === 'p') { e.preventDefault(); PC.act('present'); }
    else if (!mod && (e.key === '?' || (e.key === '/' && e.shiftKey))) { e.preventDefault(); PC.act('help'); }
    else if (!mod && !e.altKey && !e.target.closest('.thumb') && !e.target.closest('button, a, summary') && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) {
      e.preventDefault(); const d = e.key.endsWith('Down') ? 1 : -1, i = Math.max(0, Math.min(S.count() - 1, S.sel + d)); S.select(i, 'thumb'); E.scrollToFrame(i);
    }
  });
  document.addEventListener('paste', e => {
    if (UI.isTextTarget(e.target) || UI.hasModal() || P.isOpen()) return;
    const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    if (/^\s*[\[{]/.test(t) && /"(slides|layout)"/.test(t)) { e.preventDefault(); PC.importDialog(t); }
  });
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return; e.preventDefault();
    if (ev === 'drop' && !e.target.closest('#imp-drop')) { const f = e.dataTransfer.files[0]; if (!f || /^image\//.test(f.type)) return; if (/\.(pptx|potx|ppsx)$/i.test(f.name)) { UI.closeModals(); PC.importDialog('', f); return; } const r = new FileReader(); r.onload = () => { UI.closeModals(); PC.importDialog(String(r.result)); }; r.readAsText(f); }
  }));
  $('#btn-present').addEventListener('click', () => PC.act('present'));
  $('#btn-help').addEventListener('click', () => PC.act('help'));
  $('#btn-settings').addEventListener('click', () => PC.settingsDialog());
  $('#btn-ai').addEventListener('click', () => PC.act('ai'));
  $('#btn-fab').addEventListener('click', () => { Ins.ensureOpen(); });
  $('#btn-add-slide').addEventListener('click', () => PC.act('new'));
  $('#ins-close').addEventListener('click', () => { $('#app').dataset.insp = 'closed'; E.syncRibbon(); setTimeout(() => E.fit(), 30); });
  $('#zoom-out').addEventListener('click', () => E.setZoom(-1)); $('#zoom-in').addEventListener('click', () => E.setZoom(1)); $('#zoom-fit').addEventListener('click', () => E.setZoom('fit'));
  $('#canvas').addEventListener('mousedown', e => { if (window.innerWidth <= 1100 && $('#app').dataset.insp === 'open' && !e.target.closest('[data-list],[data-readonly],[data-path],.ob,.sel-layer')) { $('#app').dataset.insp = 'closed'; E.syncRibbon(); } });
  window.addEventListener('beforeunload', () => S.saveNow());
}

/* ── public API (also what the generated AI prompts refer to) ── */
function slideRef(ref) { const i = S.indexOf(ref); if (i < 0 || !S.deck.slides[i]) throw new Error('No such slide: ' + ref); return i; }
const objIndex = (i, id) => { const k = (S.slide(i).objects || []).findIndex(o => o.id === id); if (k < 0) throw new Error(`No object "${id}" on slide "${S.slide(i).id}". Existing ids: ${(S.slide(i).objects || []).map(o => o.id).join(', ') || '(none)'}`); return k; };
window.Pitchcraft = {
  version: PC.VERSION,
  guide: section => PC.ai.guide(section), manifest: () => PC.ai.manifest(), schema: () => PC.buildSchema((PC.GUIDE && PC.GUIDE.url ? PC.GUIDE.url.replace(/ai-guide\.md$/, '') : 'https://visser23.github.io/pitchcraft/')),
  layouts: PC.LAYOUTS, themes: PC.THEMES, transitions: PC.TRANSITIONS, chartTypes: PC.CHART_TYPES, icons: PC.ICON_NAMES,
  getDeck: () => PC.clone(S.deck),
  backups: () => S.backups().map((b, index) => ({ index, title: b.title, slides: b.slides, reason: b.reason, t: b.t })), restoreBackup: i => S.restoreBackup(+i),
  setDeck(d, opts) { const r = PC.parseDeck(typeof d === 'string' ? stripFences(d) : PC.clone(d)); S.load(r.deck, opts); return { slides: r.deck.slides.length, warnings: r.warnings }; },
  getSlide: ref => PC.clone(S.slide(slideRef(ref))),
  updateSlide(ref, patch) {
    const i = slideRef(ref);
    if (patch && patch.layout && !PC.LAYOUTS[patch.layout]) throw new Error(`Unknown layout "${patch.layout}". Valid: ${Object.keys(PC.LAYOUTS).join(', ')}`);
    S.mutate(i, s => { const id = s.id, clean = PC.ensureShape(PC.migrateSlide(Object.assign(PC.clone(s), PC.clone(patch || {})), i)); clean.id = id; Object.keys(s).forEach(k => delete s[k]); Object.assign(s, clean); }, '', 'api');
    return PC.clone(S.slide(i));
  },
  addCustomSlide(custom, at, name) {
    if (!custom || typeof custom !== 'object') throw new Error('addCustomSlide needs {html, css?, js?, interactive?}');
    const i = window.Pitchcraft.addSlide('custom', at), patch = { custom: Object.assign({ html: '', css: '', js: '', interactive: false }, PC.clone(custom)) };
    if (typeof name === 'string' && name) patch.headline = name.slice(0, 120);
    window.Pitchcraft.updateSlide(i, patch); return i;
  },
  setCustom(ref, patch) {
    const i = slideRef(ref); if (!patch || typeof patch !== 'object') throw new Error('setCustom needs a patch such as {html, css, js, interactive}');
    if (S.slide(i).layout !== 'custom') S.setLayout(i, 'custom');
    return window.Pitchcraft.updateSlide(i, { custom: Object.assign({}, S.slide(i).custom, PC.clone(patch)) });
  },
  setPath(ref, path, value) { const i = slideRef(ref); S.mutate(i, s => PC.setPath(s, path, value), '', 'api'); return PC.getPath(S.slide(i), path); },
  addSlide: (layout, at) => { if (!PC.LAYOUTS[layout]) throw new Error('Unknown layout ' + layout); return S.addSlide(layout, at); },
  removeSlide: ref => S.remove(slideRef(ref)), duplicateSlide: ref => S.duplicate(slideRef(ref)), moveSlide: (from, to) => S.move(slideRef(from), to),
  setMeta: patch => { S.setMeta(patch); return PC.clone(S.deck.meta); }, setTheme: t => { if (!PC.THEMES[t]) throw new Error('Unknown theme ' + t); S.setMeta({ theme: t }); },
  goTo(ref) { const i = slideRef(ref); S.select(i, 'thumb'); E.scrollToFrame(i); return i; },
  current: () => S.sel, count: () => S.count(),
  html: ref => PC.renderSlide(S.slide(slideRef(ref)), { editable: false, index: slideRef(ref), total: S.count(), deck: S.deck }),
  prettyHtml: ref => Ins.prettyHtml(window.Pitchcraft.html(ref)),
  exportJSON: deckJson,
  async exportPptx() { const r = await PC.exportPptx({ returnBytes: true }); let bin = ''; for (let i = 0; i < r.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, r.bytes.subarray(i, i + 0x8000)); return { filename: r.name, base64: btoa(bin), report: r.report }; }, newDeck: PC.newDeck, audit: PC.audit, auditAll: PC.auditAll, measureText: PC.measureText, preparePrint: PC.preparePrint,
  present: from => P.open(from), closePresent: () => P.close(), isPresenting: () => P.isOpen(),
  undo: () => S.undo(), redo: () => S.redo(), loadTemplate: PC.loadTemplate, importText: PC.importText, async importPptx(data, mode, name) { const bin = typeof data === 'string' ? Uint8Array.from(atob(data.replace(/^data:[^,]*,/, '')), c => c.charCodeAt(0)) : data; return PC.importPptxBytes(bin, mode || 'replace', name || 'Imported presentation'); },
  getObjects: ref => PC.clone(S.slide(slideRef(ref)).objects || []),
  addObject(ref, obj) {
    const i = slideRef(ref); if (!obj || !PC.has(PC.OBJECT_TYPES, obj.type)) throw new Error(`Object needs a type: ${Object.keys(PC.OBJECT_TYPES).join(', ')}`);
    if ((S.slide(i).objects || []).length >= PC.LIMITS.objects) throw new Error(`A slide holds at most ${PC.LIMITS.objects} objects.`);
    let made; S.mutate(i, s => { s.objects = s.objects || []; made = PC.cleanObject(Object.assign({ x: 100, y: 100 }, PC.clone(obj)), new Set(s.objects.map(o => o.id))); s.objects.push(made); }, '', 'api');
    return PC.clone(made);
  },
  updateObject(ref, id, patch) {
    const i = slideRef(ref), k = objIndex(i, id); let out;
    S.mutate(i, s => { const m = Object.assign({}, s.objects[k]); Object.keys(patch || {}).forEach(p => { if (p === 'id' || p === 'type') return; if (patch[p] === null) delete m[p]; else m[p] = PC.clone(patch[p]); }); out = PC.cleanObject(m, new Set(s.objects.filter((_, j) => j !== k).map(o => o.id))); if (out) s.objects[k] = out; }, '', 'api');
    return PC.clone(out);
  },
  removeObject(ref, id) { const i = slideRef(ref), k = objIndex(i, id); S.mutate(i, s => s.objects.splice(k, 1), '', 'api'); return true; },
  setTweak(ref, key, patch) {
    const i = slideRef(ref); if (!/^[\w.\-]{1,60}$/.test(String(key))) throw new Error('key must be a data-path such as "headline" or "items.1"');
    S.mutate(i, s => { const t = Object.assign({}, s.tweaks); if (patch == null) delete t[key]; else t[key] = Object.assign({}, t[key], PC.clone(patch)); const c = PC.cleanTweaks(t); if (Object.keys(c).length) s.tweaks = c; else delete s.tweaks; }, '', 'api');
    return PC.clone((S.slide(i).tweaks || {})[key] || null);
  },
  setLayout(ref, layout) { const i = slideRef(ref); if (!PC.LAYOUTS[layout]) throw new Error(`Unknown layout "${layout}". Valid: ${Object.keys(PC.LAYOUTS).join(', ')}`); S.setLayout(i, layout); return PC.clone(S.slide(i)); },
  prompts: { chat: PC.ai.promptChat, link: PC.ai.promptLink, agent: PC.ai.promptAgent, custom: PC.ai.promptCustom, slide: id => PC.ai.promptSlide(id == null ? S.slide() : S.slide(slideRef(id))) }
};

/* ── boot ── */
function boot() {
  const q = new URLSearchParams(location.search);
  if (q.has('reset')) { try { localStorage.removeItem('pitchcraft.deck.v3'); } catch (e) { /* noop */ } }
  S.init();
  if (q.get('template') && PC.TEMPLATES.some(t => t.id === q.get('template'))) { S.deck = PC.parseDeck(PC.clone(PC.TEMPLATES.find(t => t.id === q.get('template')).deck)).deck; S.snap = JSON.stringify(S.deck); }
  $('#app').dataset.insp = window.innerWidth > 1100 ? 'open' : 'closed'; $('#app').dataset.side = 'open';
  E.init(); PC.stage.init(); Ins.init(); bindGlobal(); E.fit();
  document.fonts && document.fonts.ready.then(() => { E.fit(); document.documentElement.dataset.fonts = 'ready'; });
  document.documentElement.dataset.ready = '1';
  if (q.has('present')) setTimeout(() => P.open(0), 50);
  document.documentElement.dataset.version = PC.VERSION; const av = $('#app-ver'); if (av) { av.textContent = 'v' + PC.VERSION; av.title = 'Pitchcraft version ' + PC.VERSION; }
  log(`v${PC.VERSION} ready · ${S.count()} slides · theme ${S.deck.meta.theme} · plaintext-only ${PC.plainSupported} · fullscreen ${!!document.documentElement.requestFullscreen}`);
}
boot();
})();
