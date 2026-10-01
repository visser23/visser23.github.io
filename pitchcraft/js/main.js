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
PC.exportDeck = () => UI.download(PC.slug(S.deck.meta.name) + '.pitchcraft', deckJson(), 'application/json');
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

PC.importDialog = function (prefill) {
  const body = document.createElement('div');
  body.innerHTML = `<p>Drop a <code>.pitchcraft</code> file, or paste deck JSON (from an AI chat, or a file you exported). Older Pitchcraft decks are upgraded automatically. <button class="linkish" id="imp-ai" type="button">Need an AI to write one?</button></p>
    <div class="drop" id="imp-drop">Drop a <b>.json</b> or <b>.pitchcraft</b> file here, or <button class="btn sm" id="imp-pick">choose a file</button><input type="file" id="imp-file" accept=".json,.pitchcraft,application/json,text/plain" hidden></div>
    <label class="lbl" for="imp-text">Deck JSON</label><textarea class="txt mono" id="imp-text" rows="10" spellcheck="false" placeholder='{ "meta": { "name": "My deck" }, "slides": [ … ] }' data-autofocus></textarea><div class="err" id="imp-err" role="alert"></div>`;
  const foot = document.createElement('div'); foot.style.display = 'contents';
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn" id="imp-add">Add to this deck</button><button class="btn primary" id="imp-replace">Replace deck</button>`;
  const m = UI.modal({ title: 'Import a deck', body, footer: foot, size: 'mid' });
  const ta = $('#imp-text', m.el), err = $('#imp-err', m.el), drop = $('#imp-drop', m.el); if (prefill) ta.value = prefill;
  $('#imp-ai', m.el).addEventListener('click', () => { m.close(); PC.ai.dialog('chat'); });
  const run = mode => { try { const { warnings } = PC.importText(ta.value, mode); m.close(); UI.toast(warnings.length ? `Imported with ${warnings.length} note(s): ${warnings[0]}` : 'Deck imported'); } catch (ex) { err.textContent = ex.message; ta.focus(); } };
  const read = f => { if (!f) return; if (f.size > 8 * 1024 * 1024) { err.textContent = 'That file is over 8 MB.'; return; } const r = new FileReader(); r.onload = () => { ta.value = String(r.result); err.textContent = ''; }; r.readAsText(f); };
  $('#imp-replace', m.el).addEventListener('click', () => run('replace')); $('#imp-add', m.el).addEventListener('click', () => run('append'));
  $('#imp-pick', m.el).addEventListener('click', () => $('#imp-file', m.el).click()); $('#imp-file', m.el).addEventListener('change', e => read(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); if (ev === 'drop') read(e.dataTransfer.files[0]); }));
  return m;
};

PC.exportMenu = function (anchor) {
  UI.menu(anchor, [
    { icon: 'download', label: 'Download deck file', hint: '.pitchcraft · re-import any time', run: PC.exportDeck },
    { icon: 'copy', label: 'Copy deck JSON', hint: 'Paste into an AI or a repo', run: () => UI.copy(deckJson(), 'Deck JSON copied') },
    { icon: 'printer', label: 'Save as PDF', hint: 'Opens the print dialog · one slide per page', run: () => PC.print() },
    { icon: 'sparkles', label: 'Build with AI…', hint: 'Prompts for chat windows and browser AIs', run: () => PC.ai.dialog() },
    '-',
    { icon: 'presentation', label: 'PowerPoint (.pptx)', hint: 'Planned: your JSON maps cleanly to slides', disabled: true, soon: true }
  ]);
};

PC.helpDialog = function () {
  const k = (keys, what) => `<span>${keys.map(x => `<kbd>${x}</kbd>`).join(' ')}</span><span>${what}</span>`;
  const faq = (q, a) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`;
  const m = UI.modal({
    title: 'How Pitchcraft works', size: '',
    body: `<p>Pitchcraft turns a small piece of JSON into presentation-ready slides. Build them by hand, let an AI write them, or both. Everything runs in your browser and autosaves locally.</p>
      <div class="help-grid">
        <div class="help-card">${icon('sidebar', 24)}<b>Slides, on the left</b><p>Live thumbnails of every slide. Click to jump, drag to reorder, hover to duplicate or delete.</p></div>
        <div class="help-card">${icon('layout', 24)}<b>Ribbon, on top</b><p>Add slides, <b>Insert</b> text boxes, pictures, shapes and icons, format text, and change theme, background, accent and transition.</p></div>
        <div class="help-card">${icon('edit', 24)}<b>Canvas, in the middle</b><p>Click any text to type. Drag things to move them, use the handles to resize and rotate, arrow keys to nudge, Shift to select several.</p></div>
        <div class="help-card">${icon('sliders', 24)}<b>Inspector, on the right</b><p><b>Format</b> for whatever is selected (font, size, colour, position), <b>Slide</b> for layout, background and the slide's data, <b>Code</b> for the JSON and HTML, <b>Deck</b> for theme and export.</p></div>
      </div>
      <div class="lp-group">Building a slide</div>
      <div class="help-grid">
        <div class="help-card"><b>Start from a layout</b><p>Templates such as Title, Metrics or Chart arrange your content for you. You can still drag any text or card to a new spot, and change its font and size in the Format tab. <i>Reset</i> puts it back.</p></div>
        <div class="help-card"><b>Or start from blank</b><p>Pick the <b>Blank</b> layout (Add slide, then Free-form) for an empty canvas. Use <b>Insert</b> to add text boxes, pictures, shapes and icons anywhere. Drop a picture file straight onto the slide.</p></div>
      </div>
      <div class="lp-group">Working with an AI</div>
      <div class="help-grid">
        <div class="help-card"><b>In a chat window</b> (ChatGPT, Claude, Gemini…)<p>Click <b>AI</b> in the top bar, then <i>Build with AI</i>. Copy the prompt into your chat. The AI replies with a <code>.pitchcraft</code> file (or a JSON block). Drop it on this page, or use <i>Import</i>.</p></div>
        <div class="help-card"><b>An AI in your browser</b> (Comet, Atlas, Claude for Chrome…)<p>Click <b>AI</b>, choose <i>AI in your browser</i> and copy the agent prompt. The AI edits this open deck live through the <code>Pitchcraft</code> API, including moving and styling objects. Ctrl+Z undoes anything.</p></div>
      </div>
      <p>Both flows follow one published guide that is generated from the app itself, so it always matches this version: <a href="${esc(PC.GUIDE ? PC.GUIDE.pageUrl : '#')}" target="_blank" rel="noopener noreferrer">the Pitchcraft guide for AI assistants</a>.</p>
      <div class="lp-group">Questions</div>
      ${faq('What is a .pitchcraft file?', 'Your whole deck as plain JSON text. Download it from Export, open it in any text editor, keep it in git, and drag it onto this page to load it again.')}
      ${faq('Where is my work saved?', 'Automatically, in this browser only (local storage). Nothing is uploaded. Download a <code>.pitchcraft</code> file to back it up or share it. Clearing your browser data removes the autosave.')}
      ${faq('Where did the Content tab go?', 'Text is edited straight on the slide now. Click a card or text to see its fields and formatting in the <b>Format</b> tab. Charts, tables, lists, code and custom HTML are in the <b>Slide</b> tab.')}
      ${faq('Can I move things on a templated slide?', 'Yes. Click a text or card, then drag it (the coral grip beside it, or the dashed box). The move is stored on the slide as a small <i>tweak</i>, so the layout keeps working. Use <i>Reset position</i> to undo it.')}
      ${faq('What is the difference between Blank, free-form objects and Custom HTML?', 'Blank slides and objects are drag-and-drop: text boxes, shapes, pictures and icons that follow the theme. <b>Custom</b> is for code: a slide written in HTML, CSS and JavaScript inside a sandbox, for animation or anything unusual.')}
      ${faq('Why does an AI need the guide?', 'Pitchcraft only accepts decks in its own format. The guide lists every layout, field and limit, so the AI writes a deck that imports cleanly. Anything invalid is dropped or corrected on import, and you get a warning.')}
      ${faq('Can I export to PowerPoint?', 'Not yet. You can export a PDF (one slide per page) and the <code>.pitchcraft</code> file. PowerPoint export is planned.')}
      <div class="lp-group">Keyboard</div>
      <div class="keys">${k(['P'], 'Present from the current slide')}${k(['Ctrl', 'Z'], 'Undo (add <kbd>Shift</kbd> to redo)')}${k(['Ctrl', 'D'], 'Duplicate the selected object, or the slide')}${k(['↑', '↓'], 'Previous or next slide (nudge when an object is selected)')}${k(['←', '→'], 'Nudge the selected object (<kbd>Shift</kbd> for 10 px)')}${k(['Delete'], 'Delete the selected object')}${k(['Ctrl', 'C'], 'Copy, then <kbd>Ctrl</kbd> <kbd>V</kbd> to paste objects')}${k(['Ctrl', ']'], 'Bring forward (<kbd>[</kbd> sends back)')}${k(['Enter'], 'Finish editing a text field (new line inside a text box)')}${k(['Esc'], 'Finish editing, or clear the selection')}${k(['Ctrl', 'S'], 'Download the .pitchcraft file')}${k(['?'], 'This help')}
      ${k(['→', 'Space'], 'While presenting: next')}${k(['←'], 'While presenting: previous')}${k(['N'], 'While presenting: speaker notes')}${k(['F'], 'While presenting: fullscreen')}${k(['Esc'], 'While presenting: exit')}</div>`,
    footer: `<button class="btn" data-close>Close</button><button class="btn" id="help-ai">${icon('sparkles', 16)} Build with AI</button><button class="btn primary" id="help-tour">${icon('presentation', 16)} Open the product tour</button>`
  });
  $('#help-tour', m.el).addEventListener('click', () => { m.close(); PC.loadTemplate('tour'); });
  $('#help-ai', m.el).addEventListener('click', () => { m.close(); PC.ai.dialog(); });
};

/** Insert > Shape: a small grid of previews. */
PC.shapeMenu = function (anchor) {
  const m = document.createElement('div'); m.className = 'menu shape-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Insert a shape');
  m.innerHTML = Object.entries(PC.SHAPES).map(([k, name]) => `<button type="button" role="menuitem" class="shape-opt" data-shape="${k}" title="${esc(name)}" aria-label="${esc(name)}">${PC.shapeSvg({ shape: k, fill: 'currentColor', stroke: 'currentColor', strokeW: k === 'line' || k === 'connector' ? 6 : 0 }, 56, 40)}<span>${esc(name)}</span></button>`).join('');
  m.addEventListener('click', e => { const b = e.target.closest('[data-shape]'); if (!b) return; UI.closeMenu(); PC.stage.insert('shape', { shape: b.dataset.shape }); });
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
      out.push({ index: i, id: s.id, layout: s.layout, theme: deck.meta.theme, bg: s.bg || '', problems });
    });
  } finally { host.remove(); }
  return out;
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
    case 'import': return PC.importDialog();
    case 'export': return PC.exportMenu(btn || $('.rb[data-act="export"]'));
    case 'print': return PC.print();
    case 'inspect': E.inspect = !E.inspect; $('#canvas-inner').classList.toggle('inspect', E.inspect); E.syncRibbon(); if (Ins.tab === 'code') Ins.render(); return;
    case 'numbers': return S.setMeta({ numbers: !S.deck.meta.numbers });
    case 'toggle-side': return toggleClass('side');
    case 'toggle-insp': return toggleClass('insp');
    case 'undo': if (S.undo()) UI.toast('Undone'); return;
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
    if (ev === 'drop' && !e.target.closest('#imp-drop')) { const f = e.dataTransfer.files[0]; if (!f || /^image\//.test(f.type)) return; const r = new FileReader(); r.onload = () => { UI.closeModals(); PC.importDialog(String(r.result)); }; r.readAsText(f); }
  }));
  $('#btn-present').addEventListener('click', () => PC.act('present'));
  $('#btn-help').addEventListener('click', () => PC.act('help'));
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
  guide: () => PC.ai.guide(), manifest: () => PC.ai.manifest(), schema: () => PC.buildSchema((PC.GUIDE && PC.GUIDE.url ? PC.GUIDE.url.replace(/ai-guide\.md$/, '') : 'https://visser23.github.io/pitchcraft/')),
  layouts: PC.LAYOUTS, themes: PC.THEMES, transitions: PC.TRANSITIONS, chartTypes: PC.CHART_TYPES, icons: PC.ICON_NAMES,
  getDeck: () => PC.clone(S.deck),
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
  exportJSON: deckJson, audit: PC.audit, preparePrint: PC.preparePrint,
  present: from => P.open(from), closePresent: () => P.close(), isPresenting: () => P.isOpen(),
  undo: () => S.undo(), redo: () => S.redo(), loadTemplate: PC.loadTemplate, importText: PC.importText,
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
  log(`v${PC.VERSION} ready · ${S.count()} slides · theme ${S.deck.meta.theme} · plaintext-only ${PC.plainSupported} · fullscreen ${!!document.documentElement.requestFullscreen}`);
}
boot();
})();
