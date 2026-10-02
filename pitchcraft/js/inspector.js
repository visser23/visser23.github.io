/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT inspector — Format · Slide · Code · Deck
   Format follows the canvas selection (format.js). Slide holds layout, background, the slide's data (chart / table / cards / code /
   image) and its layers. Code is the AI-facing view: slide JSON, rendered HTML, field paths.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, E = PC.editor, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const Ins = PC.inspector = { tab: 'slide', open: {}, errors: {} };
const TABS = [['format', 'Format', 'palette'], ['slide', 'Slide', 'layout'], ['code', 'Code', 'code'], ['deck', 'Deck', 'layers']];
const num = v => { const n = parseFloat(String(v).trim()); return n; };

/* ── CSV (used for chart and table editing) ── */
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur.trim()); rows.push(row);
  return rows.filter(r => r.some(c => c !== ''));
}
const toCsv = rows => rows.map(r => r.map(c => (/[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(', ')).join('\n');
function chartToCsv(s) {
  const d = s.chartData || {};
  if (s.chartType === 'donut') return toCsv([['Label', 'Value'], ...(d.segments || []).map(x => [x.label, x.value])]);
  return toCsv([['Label', ...(d.series || []).map(x => x.name)], ...(d.labels || []).map((l, i) => [l, ...(d.series || []).map(x => x.values[i] ?? '')])]);
}
function chartFromCsv(s, text) {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('Add a header row and at least one data row.');
  const old = s.chartData || {}, body = rows.slice(1), val = (c, r) => { const n = num(c); if (isNaN(n)) throw new Error(`"${c}" (row ${r + 2}) is not a number.`); return n; };
  if (rows.length > 25) throw new Error('Charts are limited to 24 rows.');
  if (s.chartType === 'donut') {
    return { segments: body.map((r, i) => Object.assign({ label: r[0] || '', value: val(r[1] ?? '0', i) }, (old.segments || [])[i] && old.segments[i].color ? { color: old.segments[i].color } : {})), centerLabel: old.centerLabel || '', centerSub: old.centerSub || '' };
  }
  if (rows[0].length < 2) throw new Error('The header needs a label column and at least one series name.');
  if (rows[0].length > 7) throw new Error('Charts are limited to 6 series.');
  return { labels: body.map(r => r[0] || ''), series: rows[0].slice(1).map((name, j) => Object.assign({ name, values: body.map((r, i) => val(r[j + 1] ?? '0', i)) }, (old.series || [])[j] && old.series[j].color ? { color: old.series[j].color } : {})) };
}
function convertChart(s, to) {
  const d = s.chartData || {};
  if (to === 'donut' && s.chartType !== 'donut') s.chartData = { segments: (d.labels || []).map((l, i) => ({ label: l, value: ((d.series || [])[0] || { values: [] }).values[i] ?? 0 })), centerLabel: '', centerSub: '' };
  else if (to !== 'donut' && s.chartType === 'donut') s.chartData = { labels: (d.segments || []).map(x => x.label), series: [{ name: 'Value', values: (d.segments || []).map(x => x.value) }] };
  s.chartType = to;
}
function tableFromCsv(text) {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('Add a header row and at least one data row.');
  const cols = rows[0].length; if (cols > 8) throw new Error('Tables are limited to 8 columns.'); if (rows.length > 31) throw new Error('Tables are limited to 30 rows.');
  return { headers: rows[0], rows: rows.slice(1).map(r => Array.from({ length: cols }, (_, j) => r[j] || '')) };
}

/* ── small builders ── */
const fid = () => PC.uid('f');
const fText = (label, path, val, ph) => { const id = fid(); return `<div class="field"><label for="${id}">${esc(label)}</label><input class="inp" id="${id}" data-f="${path}" value="${esc(val ?? '')}" placeholder="${esc(ph || '')}" autocomplete="off"></div>`; };
const fArea = (label, path, val, rows, ph) => { const id = fid(); return `<div class="field"><label for="${id}">${esc(label)}</label><textarea class="txt" id="${id}" data-f="${path}" rows="${rows || 3}" placeholder="${esc(ph || '')}">${esc(val ?? '')}</textarea></div>`; };
const fSelect = (label, path, val, opts) => { const id = fid(); return `<div class="field"><label for="${id}">${esc(label)}</label><select class="sel" style="width:100%" id="${id}" data-f="${path}" data-kind="select">${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}"${String(val ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`; };
const fLines = (label, path, arr) => { const id = fid(); return `<div class="field"><label for="${id}">${esc(label)}</label><textarea class="txt" id="${id}" data-f="${path}" data-kind="lines" rows="4">${esc((arr || []).join('\n'))}</textarea></div>`; };
const fIcon = (label, path, val) => `<div class="field"><span class="lbl">${esc(label)}</span><div class="icon-pick" role="group" aria-label="${esc(label)}">${['', ...PC.ICON_NAMES].map(n => `<button type="button" data-icon="${n}" data-f="${path}" class="${(val || '') === n ? 'on' : ''}" title="${n || 'none'}" aria-label="${n || 'No icon'}">${n ? icon(n, 16) : icon('x', 14)}</button>`).join('')}</div></div>`;
function fieldFor(f, base, val, list) {
  const path = base + '.' + f.k;
  if (f.t === 'icon') return fIcon(f.label, path, val);
  if (f.t === 'area') return fArea(f.label, path, val, 3);
  if (f.t === 'select') return fSelect(f.label, path, val, f.opts);
  if (f.t === 'lines') return fLines(f.label, path, val);
  return fText(f.label, path, val);
}
const itemTitle = (it, spec, i) => { const fk = spec.list.fields.find(f => ['title', 'headline', 'label', 'value', 'date'].includes(f.k)); return PC.plain(it && fk ? it[fk.k] || '' : '') || `${spec.list.noun} ${i + 1}`; };

/* ── panels ── */
function panelSlide(s) {
  const spec = PC.LAYOUTS[s.layout];
  return `<div class="ins-sec"><h4>Layout</h4><button class="layout-cur" data-act="layout" aria-label="Change layout, currently ${esc(spec.name)}"><div class="pv" aria-hidden="true"><div class="stage" style="--tk:.1">${PC.renderSlide(s, { editable: false, index: S.sel, total: S.count(), deck: S.deck })}</div></div><div style="flex:1"><b>${esc(spec.name)}</b><span class="d">${esc(spec.desc)}</span></div>${icon('chevdown', 16)}</button></div>
    <div class="ins-sec"><h4>Background</h4><div class="seg" role="group" aria-label="Background">${Object.entries(PC.BGS).map(([k, v]) => `<button data-bg="${k}" class="${(s.bg || '') === k ? 'on' : ''}">${esc(v)}</button>`).join('')}</div></div>
    <div class="ins-sec"><h4>Accent colour</h4><div class="tone-row" style="max-width:none">${Object.keys(PC.TONES).map(k => `<button class="tone-dot${k === '' ? ' none' : ''}${(s.tone || '') === k ? ' on' : ''}" data-tone="${k}" title="${esc(PC.TONES[k])}" aria-label="Accent ${esc(PC.TONES[k])}" style="--c:${PC.TONE_HEX[k] || '#ddd'};width:26px;height:26px"></button>`).join('')}</div></div>
    ${panelFill(s)}
    <div class="ins-sec"><h4>In the show</h4><label class="switch"><span>Hide this slide when presenting <small class="hint">it stays in the deck and in the PowerPoint file</small></span><input type="checkbox" data-sflag="hidden" ${s.hidden ? 'checked' : ''}></label></div>
    <div class="ins-sec"><h4>Transition into this slide</h4>${fSelect('Transition', 'transition', s.transition || '', Object.assign({ '': `Deck default (${PC.TRANSITIONS[S.deck.meta.transition]})` }, PC.TRANSITIONS))}</div>
    <div class="ins-sec"><h4>Speaker notes</h4>${fArea('Notes (press N while presenting)', 'notes', s.notes, 5, 'What you will say…')}</div>`;
}

const FILLS = ['#ffffff', '#f4f1ea', '#0b0b12', '#111827', '#fef3c7', '#e0f2fe'];
function panelFill(s) {
  const cur = s.fill || '', hex = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff', im = s.bgImage || '';
  return `<div class="ins-sec"><h4>Slide background <span class="hint">overrides the theme</span></h4>
    <div class="field"><span class="lbl">Colour</span><div class="swatches" role="group" aria-label="Slide colour"><button type="button" class="swatch none${cur ? '' : ' on'}" data-sfill="" title="Theme default" aria-label="Slide colour: theme default" aria-pressed="${!cur}"></button>${FILLS.map(c => `<button type="button" class="swatch${cur === c ? ' on' : ''}" data-sfill="${c}" style="background:${c}" title="${c}" aria-label="Slide colour ${c}" aria-pressed="${cur === c}"></button>`).join('')}<label class="swatch custom${cur && !FILLS.includes(cur) ? ' on' : ''}" title="Custom colour"><input type="color" data-sfill-input value="${hex}" aria-label="Custom slide colour"></label></div></div>
    <div class="field"><label for="f-bgimg">Picture (https)</label><input class="inp" id="f-bgimg" data-f="bgImage" value="${esc(im.startsWith('data:') ? '' : im)}" placeholder="${im.startsWith('data:') ? 'Embedded picture' : 'https://…'}" autocomplete="off"></div>
    <div class="row wrap"><button class="btn sm" data-act="bg-upload">${icon('upload', 14)} Upload picture</button>${im ? `<button class="btn sm" data-act="bg-clear">Remove picture</button>` : ''}<input type="file" id="bg-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden></div><div class="err" data-csv-err="bgImage" role="alert"></div></div>`;
}
function panelLayers(s) {
  const list = s.objects || []; if (!list.length) return '';
  const sel = new Set(PC.stage.sel.filter(x => x.k === 'o').map(x => x.id));
  return `<div class="ins-sec"><h4>Layers <span class="hint">${list.length} · top first</span></h4><div class="sel-list" role="list">${list.map((o, i) => [o, i]).reverse().map(([o, i]) => `<button class="sel-item${sel.has(o.id) ? ' on' : ''}" role="listitem" data-layer="${esc(o.id)}" aria-pressed="${sel.has(o.id)}">${icon(o.type === 'text' ? 'type' : o.type === 'image' ? 'image' : o.type === 'icon' ? 'star' : 'shapes', 14)}<span>${esc(PC.objectLabel(o) || o.type)}</span></button>`).join('')}</div></div>`;
}

function listEditor(s, spec) {
  const L = spec.list, arr = s[L.key] || [], openSet = Ins.open[s.id] || (Ins.open[s.id] = {});
  return `<div class="ins-sec" data-list-sec="${L.key}"><h4>${esc(L.noun.replace(/^./, c => c.toUpperCase()))}s <span class="hint">${arr.length}${L.max ? ' of ' + L.max : ''}</span></h4>${arr.map((it, i) => `<details class="li" data-list="${L.key}" data-idx="${i}"${openSet[L.key + i] ? ' open' : ''}><summary><span class="n">${i + 1}</span><span class="t">${esc(itemTitle(it, spec, i))}</span><span class="ops"><button data-op="up" aria-label="Move ${L.noun} ${i + 1} up"${i === 0 ? ' disabled' : ''}>${icon('up', 14)}</button><button data-op="down" aria-label="Move ${L.noun} ${i + 1} down"${i === arr.length - 1 ? ' disabled' : ''}>${icon('down', 14)}</button><button data-op="dup" aria-label="Duplicate ${L.noun} ${i + 1}"${L.max && arr.length >= L.max ? ' disabled' : ''}>${icon('copy', 14)}</button><button data-op="del" aria-label="Delete ${L.noun} ${i + 1}"${arr.length <= (L.min || 0) ? ' disabled' : ''}>${icon('trash', 14)}</button></span></summary><div class="li-body">${L.fields.map(f => fieldFor(f, `${L.key}.${i}`, it[f.k], L)).join('')}</div></details>`).join('')}
    <button class="btn sm" data-add="${L.key}"${L.max && arr.length >= L.max ? ' disabled' : ''}>${icon('plus', 14)} Add ${esc(L.noun)}</button></div>`;
}

/* ── how a slide is built: template, blank, or HTML/CSS/JS. Lives at the top of the Slide tab and in the Format tab's empty state, so the
   full-capability route is always one click away, for people and for the AI prompts that describe it. ── */
const buildMode = s => (s.layout === 'custom' ? 'custom' : s.layout === 'blank' ? 'blank' : 'template');
function panelBuild(s) {
  const mode = buildMode(s), spec = PC.LAYOUTS[s.layout] || {};
  const card = (k, ic, title, desc) => `<button class="mode${mode === k ? ' on' : ''}" type="button" data-build="${k}" aria-pressed="${mode === k}">${icon(ic, 18)}<span><b>${title}</b><small>${desc}</small></span></button>`;
  const note = mode === 'custom' ? 'This slide is code. Edit its HTML, CSS and JavaScript in the Code tab, or ask an AI to rewrite it. The Template and Blank buttons replace the code, and Ctrl+Z brings it back.'
    : mode === 'blank' ? 'Every element on this slide is an object you place. Choose HTML, CSS and JS to turn it into code instead.'
      : 'Choose <b>HTML, CSS and JS</b> to turn this slide into code you can change freely. It keeps its current look, and Ctrl+Z reverses it.';
  return `<div class="ins-sec" data-build-sec><h4>How this slide is built</h4><div class="modes" role="group" aria-label="How this slide is built">`
    + card('template', 'layers', 'Template' + (mode === 'template' ? ` <span class="hint">${esc(spec.name || '')}</span>` : ''), 'Pick a layout, fill in the fields. Quickest for plain content.')
    + card('blank', 'edit', 'Blank', 'Place text, shapes, images and icons yourself.')
    + card('custom', 'code', 'HTML, CSS and JS', 'Write the slide as code. No limits on layout, brand or animation.')
    + `</div><p class="note">${note}</p></div>`;
}
Ins.panelBuild = panelBuild;

/** One code editor: label, Format and Expand buttons, and a resizable textarea. */
function codeEd(label, path, val, rows, kind) {
  const id = fid();
  return `<div class="field code-field"><div class="code-bar"><label for="${id}">${esc(label)}</label><span class="code-tools"><button type="button" class="btn sm ghost" data-fmt="${path}" data-kind="${kind}" title="Tidy the layout of this code">${icon('wand', 13)} Format</button><button type="button" class="btn sm ghost" data-expand="${path}" data-kind="${kind}" data-label="${esc(label)}" aria-label="Open ${esc(label)} in a large editor">${icon('fullscreen', 13)} Expand</button></span></div><textarea class="txt mono code-ed" id="${id}" data-f="${path}" data-lang="${kind}" rows="${rows}" spellcheck="false" wrap="off">${esc(val ?? '')}</textarea></div>`;
}
function customEditors(s) {
  const c = s.custom || {};
  return `<div class="ins-sec" data-custom-sec><h4>HTML, CSS and JavaScript <span class="hint">the whole 1280 x 720 slide</span></h4>${codeEd('HTML', 'custom.html', c.html, 12, 'html')}${codeEd('CSS', 'custom.css', c.css, 8, 'css')}${codeEd('JavaScript', 'custom.js', c.js, 8, 'js')}<div class="row wrap"><button class="btn sm" data-act="fmt-all">${icon('wand', 14)} Format all three</button><span class="hint">Code an AI wrote on one line is tidied automatically when it arrives.</span></div><div class="err" data-custom-err role="alert">${esc(Ins.errors[s.id] || '')}</div>
      <label class="switch"><span>Interactive when presenting <small class="hint">clicks go to the slide</small></span><input type="checkbox" data-cflag="interactive" ${c.interactive ? 'checked' : ''}></label>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="audit-slide">${icon('check', 14)} Check layout</button><button class="btn sm" data-act="ai-copy-custom">${icon('wand', 14)} Copy custom-slide prompt</button></div>
      <div class="audit-out" id="audit-out" role="status" aria-live="polite"></div>
      <p class="note" style="margin-top:10px">Your own JavaScript runs in a sandbox. Blocked: external scripts, network calls, storage, and anything outside the slide. Theme variables such as <code>var(--acc)</code> and <code>var(--fg)</code> work. Thumbnails and PDF draw the slide <b>before</b> its JavaScript runs.</p></div>`;
}
function fmtField(path, kind) {
  const ta = $(`[data-f="${path}"]`, $('#panel')); if (!ta) return false;
  const out = PC.beautify.field(kind, ta.value); if (out === ta.value) return false;
  ta.value = out; ta.dispatchEvent(new Event('input', { bubbles: true })); return true;
}
/** A large editor for one code field. It writes through to the panel field, so every existing save path is reused. */
function expandEditor(path, kind, label) {
  const src = $(`[data-f="${path}"]`, $('#panel')); if (!src) return;
  const body = document.createElement('div');
  body.innerHTML = `<textarea class="txt mono code-ed code-big" data-big spellcheck="false" wrap="off" aria-label="${esc(label)} code"></textarea><p class="note" style="margin:8px 0 0">Tab inserts two spaces. Press Esc to close. Changes apply to the slide as you type.</p>`;
  const big = body.firstChild; big.value = src.value;
  const m = UI.modal({ title: label + ' editor', body, size: 'xl', footer: `<button class="btn" data-fmt-big>${icon('wand', 14)} Format</button><button class="btn primary" data-close>Done</button>`, onClose: () => Ins.render() });
  const push = () => { const t = $(`[data-f="${path}"]`, $('#panel')); if (!t) return; t.value = big.value; t.dispatchEvent(new Event('input', { bubbles: true })); };   // look the field up each time: the panel is rebuilt on every history step
  big.addEventListener('input', push);
  big.addEventListener('keydown', e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const a = big.selectionStart, z = big.selectionEnd; big.setRangeText('  ', a, z, 'end'); push(); } });
  m.el.querySelector('[data-fmt-big]').addEventListener('click', () => { const out = PC.beautify.field(kind, big.value); if (out !== big.value) { big.value = out; push(); } big.focus(); });
  big.focus();
}
function recoverSec() {
  const list = S.backups(); if (!list.length) return `<div class="ins-sec"><h4>Recover an earlier deck</h4><p class="note">When a whole deck is replaced (a template, a file you opened, an AI building a new one) or undone away, a copy is kept here. Nothing is saved yet.</p></div>`;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  return `<div class="ins-sec" data-recover><h4>Recover an earlier deck <span class="hint">${list.length}</span></h4><p class="note" style="margin:0 0 8px">Copies of decks that were replaced or undone away. Restoring one is itself undoable.</p><div class="sel-list">${list.map((b, i) => `<button class="sel-item" data-restore="${i}"><span>${esc(b.title)} <small class="hint">${b.slides} slide${b.slides === 1 ? '' : 's'} · ${esc(b.reason)} · ${ago(b.t)}</small></span></button>`).join('')}</div></div>`;
}
/** Deck-wide brand CSS: shared by every custom slide, so it sits with the other code. */
function brandCss() {
  return `<div class="ins-sec" data-brand-sec><h4>Brand CSS <span class="hint">shared by every custom slide</span></h4>${codeEd('Shared CSS', 'meta.css', S.deck.meta.css || '', 6, 'css')}<p class="note">Colours, fonts (<code>@font-face</code> with <code>data:</code> URIs) and logo classes that all your custom slides share. This is where corporate branding lives.</p></div>`;
}
/** The Slide tab keeps the code out of the way: a short pointer to the Code tab. */
function codePointer(s) {
  const c = s.custom || {}, n = x => (x ? x.split('\n').length : 0);
  return `<div class="ins-sec" data-code-pointer><h4>Code</h4><p class="note" style="margin:0 0 10px">The HTML (${n(c.html)} lines), CSS (${n(c.css)}) and JavaScript (${n(c.js)}) of this slide live in the Code tab, with a Format button and a large editor.</p><div class="row wrap"><button class="btn sm primary" data-build="custom">${icon('code', 14)} Open the code editors</button></div></div>`;
}

function panelData(s, opts) {
  const spec = PC.LAYOUTS[s.layout]; let h = '';
  const t = spec.text || {};
  if (spec.special !== 'custom' && (t.kicker !== undefined || t.headline !== undefined || t.body !== undefined)) h += `<div class="ins-sec"><h4>Text <span class="hint">**bold** *italic* ==accent==</span></h4>${t.kicker !== undefined ? fText(t.kicker, 'kicker', s.kicker) : ''}${t.headline !== undefined ? fArea(t.headline, 'headline', s.headline, 2) : ''}${t.body !== undefined ? fArea(t.body, 'body', s.body, 3) : ''}<p class="note">You can also click any text on the slide and type.</p></div>`;
  if (spec.special === 'chart') {
    const donut = s.chartType === 'donut';
    h += `<div class="ins-sec"><h4>Chart</h4><div class="field"><span class="lbl">Type</span><div class="seg" role="group" aria-label="Chart type" style="flex-wrap:wrap">${Object.entries(PC.CHART_TYPES).map(([k, v]) => `<button data-ctype="${k}" class="${s.chartType === k ? 'on' : ''}">${esc(v)}</button>`).join('')}</div></div>
      ${(() => { const id = fid(); return `<div class="field"><label for="${id}">Data <span style="font-weight:400">(${donut ? 'label, value' : 'label, then one column per series'})</span></label><textarea class="txt mono" id="${id}" data-csv="chart" rows="7" spellcheck="false">${esc(chartToCsv(s))}</textarea><div class="err" data-csv-err="chart" role="alert"></div></div>`; })()}
      ${donut ? fText('Centre label', 'chartData.centerLabel', (s.chartData || {}).centerLabel, 'e.g. 100%') + fText('Centre caption', 'chartData.centerSub', (s.chartData || {}).centerSub, 'e.g. Of sessions') : ''}</div>`;
  }
  if (spec.special === 'table') h += `<div class="ins-sec"><h4>Table</h4>${(() => { const id = fid(); const td = s.tableData || {}; return `<div class="field"><label for="${id}">Rows <span style="font-weight:400">(first row is the header)</span></label><textarea class="txt mono" id="${id}" data-csv="table" rows="9" spellcheck="false">${esc(toCsv([td.headers || [], ...(td.rows || [])]))}</textarea><div class="err" data-csv-err="table" role="alert"></div></div>`; })()}</div>`;
  if (spec.special === 'code') { const c = s.code || {}; h += `<div class="ins-sec"><h4>Code</h4>${fSelect('Language', 'code.language', c.language, { json: 'JSON', js: 'JavaScript', html: 'HTML', css: 'CSS', bash: 'Shell', yaml: 'YAML', python: 'Python', text: 'Plain text' })}${fText('File name', 'code.filename', c.filename, 'deck.json')}${fArea('Source', 'code.source', c.source, 10)}</div>`; }
  if (spec.special === 'custom' && !(opts && opts.noCustom)) h += customEditors(s);
  if (spec.special === 'image') { const im = s.image || {}; h += `<div class="ins-sec"><h4>Image</h4>${fText('Image URL (https)', 'image.src', im.src && im.src.startsWith('data:') ? '' : im.src, 'https://…')}<div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="image-upload">${icon('upload', 14)} Upload file</button>${im.src ? `<button class="btn sm" data-act="image-clear">Remove</button>` : ''}<input type="file" id="image-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden></div>${fText('Alt text', 'image.alt', im.alt, 'Describe the picture')}<div class="err" data-csv-err="image" role="alert"></div></div>`; }
  if (spec.list) h += listEditor(s, spec);
  return h;
}

function prettyHtml(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const INLINE = new Set(['strong', 'em', 'mark', 'code', 'span', 'b', 'i', 'a', 'br', 'title']);
  const q = v => v.replace(/"/g, '&quot;');
  const walk = (n, d) => {
    const pad = '  '.repeat(d);
    if (n.nodeType === 3) { const t = n.textContent.trim(); return t ? pad + t + '\n' : ''; }
    if (n.nodeType !== 1) return '';
    const tag = n.tagName.toLowerCase(), attrs = Array.from(n.attributes).map(a => ` ${a.name}="${q(a.value)}"`).join('');
    if (tag === 'svg') return `${pad}<svg${attrs}>…</svg>\n`;
    const kids = Array.from(n.childNodes);
    if (!kids.length) return `${pad}<${tag}${attrs}></${tag}>\n`;
    if (kids.every(k => k.nodeType === 3 || (k.nodeType === 1 && INLINE.has(k.tagName.toLowerCase())))) return `${pad}<${tag}${attrs}>${n.innerHTML}</${tag}>\n`;
    return `${pad}<${tag}${attrs}>\n${kids.map(k => walk(k, d + 1)).join('')}${pad}</${tag}>\n`;
  };
  return Array.from(tpl.content.childNodes).map(n => walk(n, 0)).join('');
}
Ins.prettyHtml = prettyHtml; Ins.fieldFor = fieldFor; Ins.itemTitle = itemTitle;
const customSource = s => { const c = s.custom || {}; return `<!-- html -->\n${c.html || ''}\n\n<style>\n${c.css || ''}\n</style>\n\n<script>\n${c.js || ''}\n</script>`; };
const renderedHtml = s => (s.layout === 'custom' ? customSource(s) : prettyHtml(PC.renderSlide(s, { editable: false, index: S.sel, total: S.count(), deck: S.deck })));
const slideJson = s => JSON.stringify(s, null, 2);

function panelCode(s) {
  const fr = E.frameEl(S.sel), fields = fr ? $$('[data-path]', fr) : [], custom = s.layout === 'custom';
  const lead = custom ? customEditors(s)
    : `<div class="ins-sec"><h4>Edit as HTML, CSS and JS</h4><p class="note" style="margin:0 0 10px">The JSON below is the quick way to change a template slide. For full control, convert the slide to code: it keeps its current look and you can then change anything.</p><div class="row wrap"><button class="btn sm primary" data-build="custom">${icon('code', 14)} Convert to HTML, CSS and JS</button></div></div>`;
  return lead + (custom || S.deck.meta.css ? brandCss() : '') + `<div class="ins-sec"><h4>Slide JSON <span class="hint">what an AI writes</span></h4><textarea class="txt mono" id="code-json" rows="12" spellcheck="false" aria-label="Slide JSON">${esc(slideJson(s))}</textarea><div class="row wrap" style="margin-top:8px"><button class="btn sm primary" data-act="json-apply">Apply changes</button><button class="btn sm" data-act="json-copy">${icon('copy', 14)} Copy</button><button class="btn sm" data-act="json-reset">Reset</button></div><div class="err" id="json-err" role="alert"></div></div>
    ${custom ? '' : `<div class="ins-sec"><h4>Rendered HTML <span class="hint">what the slide is</span></h4><pre class="code-box" id="code-html" aria-label="Rendered HTML"><code>${esc(renderedHtml(s))}</code></pre><div class="row" style="margin-top:8px"><button class="btn sm" data-act="html-copy">${icon('copy', 14)} Copy HTML</button></div></div>`}
    <div class="ins-sec"><h4>Editable fields <span class="hint">${fields.length}</span></h4><div class="sel-list" id="code-fields">${fields.map(el => `<button class="sel-item" data-path-jump="${esc(el.dataset.path)}"><code>${esc(el.dataset.path)}</code><span>${esc(PC.plain(PC.getPath(s, el.dataset.path) ?? '').slice(0, 60))}</span></button>`).join('')}</div></div>
    <div class="ins-sec"><h4>AI helpers</h4><div class="row wrap"><button class="btn sm primary" data-act="ai">${icon('sparkles', 14)} Open AI assistant</button><button class="btn sm" data-act="ai-copy-slide">${icon('wand', 14)} Copy slide prompt</button></div><label class="switch"><span>Show field paths on the canvas</span><input type="checkbox" id="chk-inspect" ${E.inspect ? 'checked' : ''}></label><p class="note">Every slide is <code>&lt;section data-slide-id&gt;</code>. Each text has a <code>data-path</code> that matches the JSON above. Try <code>Pitchcraft.getDeck()</code> in the console.</p></div>`;
}

function panelDeck() {
  const m = S.deck.meta;
  return `<div class="ins-sec"><h4>Deck</h4>${fText('Name', 'meta.name', m.name)}</div>
    <div class="ins-sec"><h4>Theme</h4><div class="theme-list">${Object.entries(PC.THEMES).map(([k, t]) => `<button class="theme-opt${m.theme === k ? ' on' : ''}" data-theme-pick="${k}" aria-pressed="${m.theme === k}"><span class="sw">${t.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span><span><b>${esc(t.name)}</b><span class="d">${esc(t.desc)}</span></span></button>`).join('')}</div></div>
    <div class="ins-sec"><h4>Defaults</h4>${fSelect('Transition', 'meta.transition', m.transition, PC.TRANSITIONS)}<label class="switch"><span>Show slide numbers</span><input type="checkbox" data-meta="numbers" ${m.numbers ? 'checked' : ''}></label><p class="note">Numbers appear in a footer strip at the bottom of each slide, so they never fight your content.</p></div>
    <div class="ins-sec"><h4>Brand CSS</h4><p class="note" style="margin:0 0 10px">Shared CSS for every custom slide is edited in the Code tab.</p><button class="btn sm" data-act="open-brand">${icon('code', 14)} Open Brand CSS</button></div>
    ${recoverSec()}
    <div class="ins-sec"><h4>Save and share</h4><div class="row wrap"><button class="btn sm" data-act="newdeck">${icon('file', 14)} New deck</button><button class="btn sm" data-act="export">${icon('download', 14)} Save</button><button class="btn sm" data-act="share">${icon('share', 14)} Share</button><button class="btn sm" data-act="open">${icon('folder-open', 14)} Open</button><button class="btn sm" data-act="print">${icon('printer', 14)} PDF</button><button class="btn sm" data-act="templates">${icon('layers', 14)} Templates</button></div></div>
    <div class="ins-sec"><h4>AI</h4><button class="btn sm primary" data-act="ai">${icon('sparkles', 14)} Open AI assistant</button><p class="note" style="margin-top:8px">Build a whole deck with any AI chat, or let an AI that lives in your browser edit this deck directly.</p></div>`;
}

/* ── render ── */
Ins.render = function () {
  const s = S.slide(); if (!s) return;
  const panel = $('#panel'), top = panel.scrollTop, same = panel.dataset.sid === s.id + Ins.tab, fs = panel.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.fs : '';
  $('#tabs').innerHTML = TABS.map(([k, l, ic]) => `<button class="tab${Ins.tab === k ? ' on' : ''}" role="tab" id="tab-${k}" aria-selected="${Ins.tab === k}" aria-controls="panel" data-tab="${k}">${icon(ic, 15)}<span>${l}</span></button>`).join('');
  panel.innerHTML = Ins.tab === 'format' ? PC.format.html() : Ins.tab === 'slide' ? (s.layout === 'custom' ? panelBuild(s) + codePointer(s) + panelSlide(s) + panelData(s, { noCustom: true }) : panelBuild(s) + panelSlide(s) + panelData(s)) + panelLayers(s) : Ins.tab === 'code' ? panelCode(s) : panelDeck();
  panel.setAttribute('aria-labelledby', 'tab-' + Ins.tab); panel.dataset.sid = s.id + Ins.tab; if (same) panel.scrollTop = top;
  if (fs) { const el = Array.from($$('[data-fs]', panel)).find(x => x.dataset.fs === fs); if (el) el.focus({ preventScroll: true }); }   // keep keyboard focus on the control that was just used
};
window.addEventListener('pc:fonts', () => { if (Ins.render) Ins.render(); });
Ins.setTab = function (t) { Ins.tab = t; Ins.render(); };
Ins.ensureOpen = function () { const a = $('#app'); if (a.dataset.insp !== 'open') { a.dataset.insp = 'open'; E.syncRibbon(); setTimeout(() => E.fit(), 0); } };
Ins.reveal = function (target) {
  if (target.path && (target.path.startsWith('custom.') || target.path === 'meta.css')) return Ins.focusCode(target.path);
  Ins.ensureOpen(); Ins.tab = 'slide'; Ins.render();
  const panel = $('#panel');
  if (target.list != null) {
    const s = S.slide(); (Ins.open[s.id] || (Ins.open[s.id] = {}))[target.list + target.idx] = true; Ins.render();
    const d = $(`details[data-list="${target.list}"][data-idx="${target.idx}"]`, panel); if (d) { d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); }
  } else if (target.path) {
    const el = $(`[data-f="${target.path}"]`, panel) || $('[data-csv]', panel) || $('[data-add]', panel); if (el) { el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus({ preventScroll: true }); }
  }
};
/** Update the inspector input that mirrors a canvas-edited value, without rebuilding the panel. */
Ins.syncField = function (path) {
  if (Ins.tab === 'slide') { const el = $(`[data-f="${path}"]`, $('#panel')); if (el && document.activeElement !== el && el.tagName !== 'BUTTON' && el.tagName !== 'SELECT') { const v = PC.getPath(S.slide(), path); el.value = v == null ? '' : String(v); } }
  else if (Ins.tab === 'code') Ins.refreshCode();
};
let codeTimer = 0;
Ins.refreshCode = function () {
  clearTimeout(codeTimer);
  codeTimer = setTimeout(() => {
    if (Ins.tab !== 'code') return; const s = S.slide(), ta = $('#code-json'); if (!ta) return;
    if (document.activeElement !== ta) ta.value = slideJson(s);
    const h = $('#code-html code'); if (h) h.textContent = renderedHtml(s);
  }, 250);
};

/* ── events ── */
function setCanvasText(i, path) {
  if (path === 'notes') return;
  const fr = E.frameEl(i), el = fr && fr.querySelector(`[data-path="${path}"]`), v = PC.getPath(S.slide(i), path);
  if (el && el.isContentEditable) {
    if (document.activeElement !== el) el.innerHTML = v != null && String(v) !== '' ? PC.rich(v) : '';
    if (path === 'headline') { if (v) el.dataset.len = PC.lenBucket(v); else el.removeAttribute('data-len'); }
  } else E.renderFrame(i);
}
let metaTimer = 0, customTimer = 0;
function applyField(el) {
  const path = el.dataset.f, i = S.sel; let v = el.value;
  if (path === 'image.src') { const err = $('[data-csv-err="image"]'); if (v && !PC.okUrl(v.trim())) { if (err) err.textContent = 'Use an https:// address, or upload a file.'; return; } if (err) err.textContent = ''; v = v.trim(); }
  if (path === 'bgImage') { const err = $('[data-csv-err="bgImage"]'); v = v.trim(); if (v && !PC.okUrl(v)) { if (err) err.textContent = 'Use an https:// address, or upload a file.'; return; } if (err) err.textContent = ''; structural(s => { if (v) s.bgImage = v; else delete s.bgImage; }, 'bg:img'); return; }
  if (path === 'meta.css') { clearTimeout(metaTimer); metaTimer = setTimeout(() => S.setMeta({ css: v.slice(0, PC.LIMITS.metaCss) }, 'meta:css'), 450); return; }   // restyles every custom slide: wait for a pause in typing
  if (path.startsWith('meta.')) { S.setMeta({ [path.slice(5)]: path === 'meta.name' ? v.slice(0, 80) : v }, 'meta:' + path); return; }
  if (path.startsWith('custom.')) { S.setText(i, path, v.slice(0, PC.LIMITS.custom), 'inspector'); clearTimeout(customTimer); customTimer = setTimeout(() => { delete Ins.errors[S.slide(i).id]; E.renderFrame(i); }, 350); return; }   // reloads the sandbox once typing pauses
  if (el.dataset.kind === 'lines') { S.setText(i, path, v.split('\n').map(x => x.trim()).filter(Boolean), 'inspector'); E.renderFrame(i); E.updateThumb(i); return; }
  S.setText(i, path, v, 'inspector'); setCanvasText(i, path);
  const li = el.closest('details.li'); if (li) { const t = $('.t', li), spec = PC.LAYOUTS[S.slide().layout]; t.textContent = itemTitle(PC.getPath(S.slide(), `${li.dataset.list}.${li.dataset.idx}`), spec, +li.dataset.idx); }
}
function structural(fn, key) { S.mutate(S.sel, fn, key, 'inspector'); }
/** Cards keep their own moved/restyled tweaks when their index changes. */
function remapTweaks(s, key, op, idx) {
  if (!s.tweaks) return;
  const re = new RegExp('^' + key.replace(/\./g, '\\.') + '\\.(\\d+)(\\..+)?$'), out = {};
  Object.keys(s.tweaks).forEach(k => {
    const m = k.match(re); if (!m) { out[k] = s.tweaks[k]; return; }
    let n = +m[1]; const rest = m[2] || '';
    if (op === 'up') { if (n === idx) n = idx - 1; else if (n === idx - 1) n = idx; }
    else if (op === 'down') { if (n === idx) n = idx + 1; else if (n === idx + 1) n = idx; }
    else if (op === 'del') { if (n === idx) return; if (n > idx) n--; }
    else if (op === 'dup') { if (n > idx) n++; else if (n === idx) out[`${key}.${idx + 1}${rest}`] = PC.clone(s.tweaks[k]); }
    out[`${key}.${n}${rest}`] = s.tweaks[k];
  });
  if (Object.keys(out).length) s.tweaks = out; else delete s.tweaks;
}
function listOp(op, key, idx) {
  const spec = PC.LAYOUTS[S.slide().layout], L = spec.list;
  S.mutate(S.sel, s => {
    const a = s[key] = s[key] || [], before = a.length;
    if (op === 'up' && idx > 0) [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
    else if (op === 'down' && idx < a.length - 1) [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]];
    else if (op === 'dup' && (!L.max || a.length < L.max)) a.splice(idx + 1, 0, PC.clone(a[idx]));
    else if (op === 'del' && a.length > (L.min || 0)) a.splice(idx, 1);
    else if (op === 'add' && (!L.max || a.length < L.max)) a.push(PC.clone(L.blank));
    if (op !== 'add' && (op === 'up' || op === 'down' || a.length !== before)) remapTweaks(s, key, op, idx);
  }, '', 'inspector');
  const id = S.slide().id; Ins.open[id] = {}; // indexes shifted, so forget which were open
  if (op === 'add') Ins.open[id][key + (S.slide()[key].length - 1)] = true; if (op === 'dup') Ins.open[id][key + (idx + 1)] = true;
  Ins.render();
}
Ins.listOp = listOp;
function pickFile(file) {
  if (!file) return; const err = $('[data-csv-err="image"]');
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) { if (err) err.textContent = 'Please choose a PNG, JPEG, GIF or WebP image.'; return; }
  if (file.size > 1.5 * 1024 * 1024) { if (err) err.textContent = 'That image is over 1.5 MB. Use a smaller one or link to a URL.'; return; }
  const r = new FileReader(); r.onload = () => { structural(s => { s.image.src = String(r.result); if (!s.image.alt) s.image.alt = file.name.replace(/\.[^.]+$/, ''); }, 'img'); Ins.render(); }; r.readAsDataURL(file);
}

function pickBg(file) {
  if (!file) return; const err = $('[data-csv-err="bgImage"]');
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) { if (err) err.textContent = 'Please choose a PNG, JPEG, GIF or WebP image.'; return; }
  if (file.size > 2 * 1024 * 1024) { if (err) err.textContent = 'That image is over 2 MB. Use a smaller one or link to a URL.'; return; }
  const r = new FileReader(); r.onload = () => { structural(s => { s.bgImage = String(r.result); }, ''); Ins.render(); }; r.readAsDataURL(file);
}
function bind() {
  const panel = $('#panel');
  /* script errors reported by a custom slide's sandbox (only trusted from an editor iframe) */
  window.addEventListener('message', e => {
    const d = e.data; if (!d || typeof d !== 'object' || d.pc !== 'error' || typeof d.msg !== 'string') return;
    const f = $$('#canvas-inner iframe.cs-frame').find(x => x.contentWindow === e.source); if (!f) return;
    const id = f.closest('.frame').dataset.id, msg = 'Script error: ' + d.msg.slice(0, 300); Ins.errors[id] = msg;
    const el = $('[data-custom-err]', panel); if (el && S.slide() && S.slide().id === id) el.textContent = msg;
  });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) Ins.setTab(b.dataset.tab); });
  $('#tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const k = TABS.map(t => t[0]), i = k.indexOf(Ins.tab), n = k[(i + (e.key === 'ArrowRight' ? 1 : k.length - 1)) % k.length];
    Ins.setTab(n); const b = $(`#tab-${n}`); if (b) b.focus();
  });
  panel.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-f]:not([data-kind="select"])') && el.tagName !== 'BUTTON') { applyField(el); return; }
    if (el.matches('[data-csv]')) {
      const kind = el.dataset.csv, err = $(`[data-csv-err="${kind}"]`);
      try {
        if (kind === 'chart') { const d = chartFromCsv(S.slide(), el.value); structural(s => { s.chartData = d; }, 'csv'); } else { const d = tableFromCsv(el.value); structural(s => { s.tableData = d; }, 'csv'); }
        if (err) err.textContent = '';
      } catch (ex) { if (err) err.textContent = ex.message; }
      return;
    }
    if (el.matches('[data-sfill-input]')) { structural(s => { s.fill = el.value; }, 'bg:fill'); return; }
    if (el.matches('[data-sflag]')) { const k = el.dataset.sflag; structural(x => { if (el.checked) x[k] = true; else delete x[k]; }, 'sflag'); E.renderFrame(S.sel); E.updateThumb(S.sel); return; }
    if (el.matches('[data-cflag]')) { const k = el.dataset.cflag; structural(s => { s.custom = s.custom || {}; s.custom[k] = el.checked; }, 'cflag'); E.renderFrame(S.sel); return; }
    if (el.id === 'chk-inspect') { E.inspect = el.checked; $('#canvas-inner').classList.toggle('inspect', E.inspect); E.syncRibbon(); }
    if (el.matches('[data-meta]')) { S.setMeta({ [el.dataset.meta]: el.checked }); }
  });
  panel.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('select[data-f]')) {
      const path = el.dataset.f; if (path.startsWith('meta.')) { S.setMeta({ [path.slice(5)]: el.value }); return; }
      structural(s => PC.setPath(s, path, el.value), 'sel:' + path); if (path.startsWith('items.') || path.startsWith('columns.') || path === 'code.language') Ins.render(); return;
    }
    if (el.id === 'image-file') pickFile(el.files[0]);
    if (el.id === 'bg-file') pickBg(el.files[0]);
    if (el.matches('[data-sfill-input]')) { structural(s => { s.fill = el.value; }, 'bg:fill'); Ins.render(); }
    if (el.matches('[data-f="bgImage"]')) Ins.render();   // show or hide "Remove picture" once the address is committed (never while typing)
  });
  panel.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.li')) { const s = S.slide(); (Ins.open[s.id] || (Ins.open[s.id] = {}))[d.dataset.list + d.dataset.idx] = d.open; } }, true);
  panel.addEventListener('click', e => {
    const t = e.target;
    const op = t.closest('[data-op]'); if (op) { e.preventDefault(); const li = op.closest('details.li'); listOp(op.dataset.op, li.dataset.list, +li.dataset.idx); return; }
    const add = t.closest('[data-add]'); if (add) { listOp('add', add.dataset.add, 0); return; }
    const ic = t.closest('[data-icon]'); if (ic) { structural(s => PC.setPath(s, ic.dataset.f, ic.dataset.icon), 'icon'); $$('[data-icon]', ic.parentElement).forEach(b => b.classList.toggle('on', b === ic)); return; }
    const sf = t.closest('[data-sfill]'); if (sf) { structural(s => { if (sf.dataset.sfill) s.fill = sf.dataset.sfill; else delete s.fill; }, ''); Ins.render(); return; }
    const ly = t.closest('[data-layer]'); if (ly) { PC.stage.selectObject(ly.dataset.layer, false); Ins.render(); return; }
    const bg = t.closest('[data-bg]'); if (bg) { structural(s => { s.bg = bg.dataset.bg; }, 'bg'); Ins.render(); return; }
    const tone = t.closest('[data-tone]'); if (tone) { structural(s => { s.tone = tone.dataset.tone; }, 'tone'); Ins.render(); return; }
    const ct = t.closest('[data-ctype]'); if (ct) { structural(s => convertChart(s, ct.dataset.ctype), ''); Ins.render(); return; }
    const th = t.closest('[data-theme-pick]'); if (th) { S.setMeta({ theme: th.dataset.themePick }); return; }
    const pj = t.closest('[data-path-jump]'); if (pj) { E.focusField(pj.dataset.pathJump); return; }
    const fm = t.closest('[data-fmt]'); if (fm) { UI.toast(fmtField(fm.dataset.fmt, fm.dataset.kind) ? 'Code formatted' : 'Already tidy'); return; }
    const ex = t.closest('[data-expand]'); if (ex) { expandEditor(ex.dataset.expand, ex.dataset.kind, ex.dataset.label); return; }
    const rs = t.closest('[data-restore]'); if (rs) { if (S.restoreBackup(+rs.dataset.restore)) UI.toast('Deck restored. Ctrl+Z undoes this.'); return; }
    const bm = t.closest('[data-build]'); if (bm) { Ins.build(bm.dataset.build); return; }
    const a = t.closest('[data-act]'); if (a) Ins.act(a.dataset.act);
  });
}

/** Switch how the selected slide is built. Template opens the layout picker; Blank and HTML/CSS/JS convert the slide (undoable). */
Ins.build = function (mode) {
  const s = S.slide(), now = buildMode(s);
  if (mode === 'template') return PC.act('layout');
  if (mode === now) { if (mode === 'custom') Ins.focusCode(); return; }
  S.setLayout(S.sel, mode);
  UI.toast(mode === 'custom' ? 'This slide is now HTML, CSS and JS. Ctrl+Z reverses it.' : 'This slide is now blank. Ctrl+Z reverses it.');
  if (mode === 'custom') Ins.focusCode();
};
Ins.focusCode = function (path) {
  Ins.ensureOpen(); if (Ins.tab !== 'code') { Ins.tab = 'code'; Ins.render(); }
  const ta = $(`[data-f="${path || 'custom.html'}"]`, $('#panel')); if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus({ preventScroll: true }); }
};

Ins.act = function (act) {
  const s = S.slide();
  if (act === 'layout') return PC.act('layout');
  if (act === 'bg-upload') return $('#bg-file').click();
  if (act === 'bg-clear') { structural(x => { delete x.bgImage; }, ''); return Ins.render(); }
  if (act === 'image-upload') return $('#image-file').click();
  if (act === 'image-clear') { structural(x => { x.image.src = ''; }, ''); return Ins.render(); }
  if (act === 'open-brand') { Ins.tab = 'code'; Ins.render(); return Ins.focusCode('meta.css'); }
  if (act === 'fmt-all') { ['html', 'css', 'js'].forEach(k => fmtField('custom.' + k, k)); return UI.toast('Code formatted'); }
  if (act === 'json-copy') return UI.copy(slideJson(s), 'Slide JSON copied');
  if (act === 'html-copy') return UI.copy(renderedHtml(s), 'Slide HTML copied');
  if (act === 'json-reset') { $('#code-json').value = slideJson(s); $('#json-err').textContent = ''; return; }
  if (act === 'json-apply') {
    const err = $('#json-err');
    try {
      const raw = JSON.parse($('#code-json').value); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('A slide must be a JSON object.');
      if (raw.layout && !PC.LAYOUTS[raw.layout]) throw new Error(`Unknown layout "${raw.layout}". Try one of: ${Object.keys(PC.LAYOUTS).join(', ')}.`);
      S.replaceSlide(S.sel, raw); err.textContent = ''; UI.toast('Slide updated');
    } catch (ex) { err.textContent = ex.message; }
    return;
  }
  if (act === 'audit-slide') {
    const out = $('#audit-out'); if (!out) return; out.textContent = 'Checking…';
    PC.auditAll({ meta: S.deck.meta, slides: [PC.clone(s)] }).then(r => {
      const e = r[0], list = e.problems || [];
      out.innerHTML = !e.checked ? `<p class="note">${esc(e.note || 'Could not check this slide.')}</p>`
        : list.length ? `<ul class="audit-list">${list.map(p => `<li><b>${esc(p.type)}</b> ${esc(p.text ? '"' + p.text + '" ' : '')}${esc(p.detail || '')}</li>`).join('')}</ul>`
          : `<p class="note ok">No problems found in ${Number(e.texts) || 0} piece(s) of text. This checks text only, so look at colour and images yourself.</p>`;
    });
    return;
  }
  if (act === 'ai-copy-custom') return PC.ai.copy('custom');
  if (act === 'ai-copy-slide') return PC.ai.copy('slide');
  PC.act(act);
};

Ins.init = function () {
  bind(); PC.format.bind(); Ins.render();
  const typingInPanel = () => { const a = document.activeElement; return !!(a && $('#panel').contains(a) && a.matches('input[type=text], input:not([type]), textarea')); };
  ['deck', 'select'].forEach(ev => S.on(ev, () => Ins.render()));
  S.on('history', () => { if (!typingInPanel()) Ins.render(); });   // every keystroke is a history step: rebuilding the panel under the caret dropped focus and swallowed typing
  let hadSel = false;
  S.on('stage', () => {   // clicking something on the slide brings up its formatting; Slide-tab users are moved across, Code/Deck are left alone
    const has = PC.stage.sel.length > 0;
    if (has && !hadSel && Ins.tab === 'slide') Ins.tab = 'format';
    hadSel = has;
    if (Ins.tab === 'format' || Ins.tab === 'slide') Ins.render();
  });
  S.on('slide', e => { if (e.src === 'inspector') { if (Ins.tab === 'code') Ins.refreshCode(); return; } Ins.render(); });
  S.on('meta', () => { if ($('#panel').contains(document.activeElement) && document.activeElement.matches('input[type=text], input:not([type]), textarea')) return; Ins.render(); });
  S.on('text', e => { if (e.src === 'canvas') Ins.syncField(e.path); else if (Ins.tab === 'code') Ins.refreshCode(); });
};
})();
