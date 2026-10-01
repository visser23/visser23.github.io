/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT objects — the free-form layer.
   Any slide can carry `objects`: text boxes, shapes, images and icons placed anywhere on the 1280x720 stage.
   A `blank` slide is nothing but objects. Template slides can also carry `tweaks`: per-element nudges (move, font,
   size, colour...) for the text and cards the layout generated, so furniture can be moved without abandoning the layout.

   Model (all numbers are stage pixels):
     objects: [{ id, type:'text'|'shape'|'image'|'icon', x, y, w, h?, rot?, opacity?, name?, ...type fields }]
     tweaks:  { "headline": {dx,dy,size,font,...}, "items.2": {dx,dy} }        (key = a data-path, or list.index)
     fill / bgImage: a custom slide background colour / picture.
   Classic script, no DOM needed for the data functions (scripts/build-guide.js loads this file in Node).
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC = window.PC || {};
const esc = PC.esc;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
PC.has = has;
const num = (v, d, lo, hi) => { v = typeof v === 'number' ? v : parseFloat(v); if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, v)); };
const r1 = n => Math.round(n * 10) / 10;
PC.LIMITS = Object.assign(PC.LIMITS || {}, { objects: 120, objectText: 20000 });

/* ── fonts: a whitelist of keys, or any plain family name (installed on the viewer's machine) ── */
PC.FONTS = {
  body: { name: 'Theme body', group: 'Theme', family: 'Inter', css: 'var(--font-b)' },
  display: { name: 'Theme heading', group: 'Theme', family: 'Bricolage Grotesque', css: 'var(--font-d)' },
  inter: { name: 'Inter', group: 'Pitchcraft', family: 'Inter', css: "'Inter', system-ui, sans-serif" },
  bricolage: { name: 'Bricolage Grotesque', group: 'Pitchcraft', family: 'Bricolage Grotesque', css: "'Bricolage Grotesque', 'Inter', sans-serif" },
  serif: { name: 'Instrument Serif', group: 'Pitchcraft', family: 'Instrument Serif', css: "'Instrument Serif', Georgia, serif" },
  syne: { name: 'Syne', group: 'Pitchcraft', family: 'Syne', css: "'Syne', 'Bricolage Grotesque', sans-serif" },
  mono: { name: 'JetBrains Mono', group: 'Pitchcraft', family: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace" },
  arial: { name: 'Arial', group: 'System', family: 'Arial', css: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
  georgia: { name: 'Georgia', group: 'System', family: 'Georgia', css: "Georgia, 'Times New Roman', serif" },
  times: { name: 'Times New Roman', group: 'System', family: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  verdana: { name: 'Verdana', group: 'System', family: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  trebuchet: { name: 'Trebuchet MS', group: 'System', family: 'Trebuchet MS', css: "'Trebuchet MS', Helvetica, sans-serif" },
  courier: { name: 'Courier New', group: 'System', family: 'Courier New', css: "'Courier New', Courier, monospace" }
};
const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,47}$/;
PC.cleanFont = f => (typeof f === 'string' && has(PC.FONTS, f) ? f : typeof f === 'string' && FONT_NAME.test(f.trim()) ? f.trim() : '');
PC.fontCss = f => (has(PC.FONTS, f) ? PC.FONTS[f].css : `"${String(f).replace(/["\\]/g, '')}", system-ui, sans-serif`);

/* ── colour tokens the UI offers (theme-aware) and helpers ── */
PC.COLOR_TOKENS = [
  ['var(--fg)', 'Text'], ['var(--muted)', 'Muted text'], ['var(--shape)', 'Accent'], ['var(--on-shape)', 'On accent'], ['var(--card)', 'Card'], ['var(--slide-bg)', 'Background'],
  ['#ffffff', 'White'], ['#000000', 'Black'], ['var(--c1)', 'Palette 1'], ['var(--c2)', 'Palette 2'], ['var(--c3)', 'Palette 3'], ['var(--c4)', 'Palette 4'], ['var(--c5)', 'Palette 5'], ['var(--c6)', 'Palette 6']
];
PC.isDark = function (c) {
  c = String(c || '').trim(); let m = c.match(/^#([0-9a-f]{3,8})$/i), r, g, b;
  if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join(''); if (h.length < 6) return false; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  else if ((m = c.match(/^rgba?\(([^)]+)\)/))) { const p = m[1].split(/[ ,]+/).map(parseFloat); r = p[0]; g = p[1]; b = p[2]; }
  else if (typeof document !== 'undefined' && /^[a-zA-Z]+$/.test(c)) { try { const cx = document.createElement('canvas').getContext('2d'); cx.fillStyle = '#010203'; cx.fillStyle = c; const v = String(cx.fillStyle); if (v !== '#010203') return PC.isDark(v); } catch (e) { return false; } return false; }
  else return false;
  const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) < .28;
};

/* ── shapes ── */
PC.SHAPES = { rect: 'Rectangle', round: 'Rounded rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star: 'Star', arrow: 'Block arrow', chevron: 'Chevron', line: 'Line', connector: 'Arrow line' };
PC.OBJECT_TYPES = { text: 'Text box', shape: 'Shape', image: 'Image', icon: 'Icon' };
PC.WEIGHTS = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold' };
const ALIGN = ['left', 'center', 'right', 'justify'], VALIGN = ['top', 'middle', 'bottom'], FIT = ['cover', 'contain', 'fill'], DASH = ['solid', 'dashed', 'dotted'];

/** What every property defaults to when the object does not say. The renderer merges these in; the UI writes explicit values. */
PC.OBJ_DEFAULTS = {
  text: { w: 520, size: 36, weight: 400, font: 'body', align: 'left', valign: 'top', color: 'var(--fg)', lh: 1.25, ls: 0 },
  shape: { w: 260, h: 160, shape: 'rect', fill: 'var(--shape)', stroke: '', strokeW: 0, radius: 0, dash: 'solid', size: 28, weight: 600, font: 'body', align: 'center', valign: 'middle', color: 'var(--on-shape)', lh: 1.2, ls: 0 },
  image: { w: 480, h: 320, fit: 'cover', radius: 0, stroke: '', strokeW: 0 },
  icon: { w: 96, h: 96, color: 'var(--shape)' }
};

/* ── sanitising (used on import, API writes and the Code tab: objects can come from an AI or a stranger) ── */
const cleanTypo = (t, out = {}) => {
  if (has(t, 'font')) { const f = PC.cleanFont(t.font); if (f) out.font = f; }
  if (has(t, 'size')) { const n = num(t.size, null, 4, 600); if (n != null) out.size = r1(n); }
  if (has(t, 'weight')) { const n = num(t.weight, null, 100, 900); if (n != null) out.weight = Math.round(n / 100) * 100; }
  ['italic', 'underline', 'caps'].forEach(k => { if (has(t, k) && typeof t[k] === 'boolean') out[k] = t[k]; });
  if (has(t, 'align') && ALIGN.includes(t.align)) out.align = t.align;
  if (has(t, 'color') && PC.okColor(t.color)) out.color = t.color;
  if (has(t, 'lh')) { const n = num(t.lh, null, .5, 4); if (n != null) out.lh = r1(n * 100) / 100; }
  if (has(t, 'ls')) { const n = num(t.ls, null, -.5, 2); if (n != null) out.ls = r1(n * 100) / 100; }
  return out;
};
PC.cleanTypo = cleanTypo;

PC.cleanObject = function (r, used) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || !has(PC.OBJECT_TYPES, r.type)) return null;
  const type = r.type, D = PC.OBJ_DEFAULTS[type], o = { id: '', type };
  let id = typeof r.id === 'string' && /^[\w\-]{1,40}$/.test(r.id) ? r.id : ''; if (!id || used.has(id)) { let n = used.size + 1; do { id = 'o' + (n++); } while (used.has(id)); } used.add(id); o.id = id;
  o.x = r1(num(r.x, 100, -3000, 4000)); o.y = r1(num(r.y, 100, -3000, 4000)); o.w = r1(num(r.w, D.w, 4, 4000));
  if (type !== 'text' || (r.h != null && r.h !== '')) o.h = r1(num(r.h, D.h || 60, 2, 4000));
  const rot = num(r.rot, 0, -360, 360); if (rot) o.rot = r1(rot);
  const op = num(r.opacity, 1, 0, 1); if (op < 1) o.opacity = r1(op * 100) / 100;
  if (typeof r.name === 'string' && r.name) o.name = r.name.slice(0, 60);
  if (r.shadow === true) o.shadow = true;
  if (type === 'text' || type === 'shape') {
    o.text = typeof r.text === 'string' ? r.text.slice(0, PC.LIMITS.objectText) : typeof r.text === 'number' ? String(r.text) : '';
    cleanTypo(r, o);
    if (has(r, 'valign') && VALIGN.includes(r.valign)) o.valign = r.valign;
  }
  if (type === 'shape') {
    o.shape = has(PC.SHAPES, r.shape) ? r.shape : 'rect';
    if (has(r, 'fill')) o.fill = PC.okColor(r.fill) ? r.fill : '';
    if (has(r, 'stroke')) o.stroke = PC.okColor(r.stroke) ? r.stroke : '';
    const sw = num(r.strokeW, 0, 0, 80); if (sw || has(r, 'strokeW')) o.strokeW = r1(sw);
    const rad = num(r.radius, 0, 0, 2000); if (rad) o.radius = r1(rad);
    if (DASH.includes(r.dash) && r.dash !== 'solid') o.dash = r.dash;
  }
  if (type === 'image') {
    o.src = PC.okUrl(r.src) ? String(r.src || '') : ''; o.alt = typeof r.alt === 'string' ? r.alt.slice(0, 300) : '';
    if (FIT.includes(r.fit)) o.fit = r.fit;
    const rad = num(r.radius, 0, 0, 2000); if (rad) o.radius = r1(rad);
    if (has(r, 'stroke') && PC.okColor(r.stroke)) o.stroke = r.stroke; const sw = num(r.strokeW, 0, 0, 80); if (sw) o.strokeW = r1(sw);
  }
  if (type === 'icon') {
    o.icon = typeof r.icon === 'string' && PC.ICON_NAMES.includes(r.icon) ? r.icon : 'star';
    if (has(r, 'color') && PC.okColor(r.color)) o.color = r.color;
  }
  return o;
};
PC.cleanObjects = function (raw) {
  if (!Array.isArray(raw)) return []; const used = new Set(), out = [];
  for (const r of raw.slice(0, PC.LIMITS.objects)) { const o = PC.cleanObject(r, used); if (o) out.push(o); }
  return out;
};
PC.cleanTweaks = function (raw) {
  const out = {}; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out; let n = 0;
  for (const k of Object.keys(raw)) {
    const t = raw[k]; if (n >= 200) break; if (!/^[\w.\-]{1,60}$/.test(k) || !t || typeof t !== 'object') continue;
    const c = cleanTypo(t); const dx = num(t.dx, 0, -2560, 2560), dy = num(t.dy, 0, -1440, 1440); if (dx) c.dx = r1(dx); if (dy) c.dy = r1(dy);
    if (Object.keys(c).length) { out[k] = c; n++; }
  }
  return out;
};

/** A fresh object with explicit values (what the Insert menu creates), placed at (x, y) or the slide centre. */
PC.newObject = function (type, over = {}, existing = []) {
  const D = PC.OBJ_DEFAULTS[type], base = Object.assign({ type }, D);
  if (type === 'text') Object.assign(base, { text: 'Text', w: 520 });
  if (type === 'icon') base.icon = 'star';
  if (type === 'image') Object.assign(base, { src: '', alt: '' });
  const shape = over.shape || base.shape;
  if (type === 'shape') {
    if (shape === 'round') base.radius = 28;
    if (shape === 'ellipse') Object.assign(base, { w: 200, h: 200 });
    if (shape === 'line' || shape === 'connector') Object.assign(base, { w: 360, h: 14, fill: '', stroke: 'var(--shape)', strokeW: 6, text: '' });
    if (shape === 'star' || shape === 'diamond' || shape === 'triangle' || shape === 'hexagon') Object.assign(base, { w: 200, h: 200 });
    if (shape === 'arrow' || shape === 'chevron') Object.assign(base, { w: 280, h: 140 });
  }
  const o = Object.assign(base, over);
  if (o.x == null) o.x = Math.round((1280 - o.w) / 2); if (o.y == null) o.y = Math.round((720 - (o.h || 60)) / 2);
  const used = new Set(existing.map(e => e.id));
  return PC.cleanObject(o, used);
};

/* ── CSS for typography and nudges (shared by objects and tweaks) ── */
PC.typoCss = function (t) {
  let s = '';
  if (t.font) s += `font-family:${PC.fontCss(t.font)};`;
  if (t.size != null) s += `font-size:${t.size}px;`;
  if (t.weight != null) s += `font-weight:${t.weight};`;
  if (t.italic != null) s += `font-style:${t.italic ? 'italic' : 'normal'};`;
  if (t.underline != null) s += `text-decoration:${t.underline ? 'underline' : 'none'};`;
  if (t.align) s += `text-align:${t.align};`;
  if (t.color && PC.okColor(t.color)) s += `color:${t.color};`;
  if (t.lh != null) s += `line-height:${t.lh};`;
  if (t.ls != null) s += `letter-spacing:${t.ls}em;`;
  if (t.caps != null) s += `text-transform:${t.caps ? 'uppercase' : 'none'};`;
  return s;
};
PC.tweakCss = function (tw, textToo) {
  if (!tw) return '';
  return (tw.dx || tw.dy ? `translate:${tw.dx || 0}px ${tw.dy || 0}px;` : '') + (textToo ? PC.typoCss(tw) : '');
};
/* `translate` (not transform) so reveal animations, which use transform, never fight a nudge */

/* ── rendering ── */
const STAR = (() => { const p = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? .4 : 1, a = (-90 + k * 36) * Math.PI / 180; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; })();
const pts = a => a.map(p => p.map(n => r1(n)).join(',')).join(' ');

PC.shapeSvg = function (o, w, h) {
  const d = Object.assign({}, PC.OBJ_DEFAULTS.shape, o), sw = d.strokeW || 0, i = sw / 2, kind = d.shape, line = kind === 'line' || kind === 'connector';
  const fill = d.fill && !line ? `fill:${d.fill};` : 'fill:none;', dash = d.dash === 'dashed' ? `stroke-dasharray:${sw * 3 + 6} ${sw * 2 + 4};` : d.dash === 'dotted' ? `stroke-dasharray:0 ${sw * 2 + 4};stroke-linecap:round;` : '';
  const strokeCol = d.stroke || (line ? d.fill || 'var(--shape)' : '');
  const stroke = strokeCol && (sw > 0 || line) ? `stroke:${strokeCol};stroke-width:${line ? sw || 6 : sw};stroke-linejoin:round;${dash}` : 'stroke:none;';
  const st = ` style="${fill}${stroke}"`, W = w - 2 * i, H = h - 2 * i;
  let inner;
  if (kind === 'ellipse') inner = `<ellipse cx="${r1(w / 2)}" cy="${r1(h / 2)}" rx="${r1(Math.max(1, W / 2))}" ry="${r1(Math.max(1, H / 2))}"${st}/>`;
  else if (kind === 'rect' || kind === 'round') { const rad = Math.min(d.radius || (kind === 'round' ? 28 : 0), W / 2, H / 2); inner = `<rect x="${r1(i)}" y="${r1(i)}" width="${r1(Math.max(1, W))}" height="${r1(Math.max(1, H))}" rx="${r1(rad)}"${st}/>`; }
  else if (kind === 'triangle') inner = `<polygon points="${pts([[w / 2, i], [w - i, h - i], [i, h - i]])}"${st}/>`;
  else if (kind === 'diamond') inner = `<polygon points="${pts([[w / 2, i], [w - i, h / 2], [w / 2, h - i], [i, h / 2]])}"${st}/>`;
  else if (kind === 'hexagon') inner = `<polygon points="${pts([[W * .25 + i, i], [W * .75 + i, i], [w - i, h / 2], [W * .75 + i, h - i], [W * .25 + i, h - i], [i, h / 2]])}"${st}/>`;
  else if (kind === 'star') inner = `<polygon points="${pts(STAR.map(p => [w / 2 + p[0] * W / 2, h / 2 + p[1] * H / 2 * 1.04]))}"${st}/>`;
  else if (kind === 'arrow') inner = `<polygon points="${pts([[i, i + H * .3], [i + W * .6, i + H * .3], [i + W * .6, i], [w - i, h / 2], [i + W * .6, h - i], [i + W * .6, i + H * .7], [i, i + H * .7]])}"${st}/>`;
  else if (kind === 'chevron') inner = `<polygon points="${pts([[i, i], [i + W * .7, i], [w - i, h / 2], [i + W * .7, h - i], [i, h - i], [i + W * .3, h / 2]])}"${st}/>`;
  else if (kind === 'connector') { const t = Math.max(18, (sw || 6) * 3.4), y = h / 2; inner = `<line x1="${r1(i)}" y1="${r1(y)}" x2="${r1(Math.max(i, w - t * .7))}" y2="${r1(y)}" style="${stroke}stroke-linecap:round;fill:none"/><polygon points="${pts([[w - t, y - t / 2], [w, y], [w - t, y + t / 2]])}" style="fill:${strokeCol || 'var(--shape)'};stroke:none"/>`; }
  else inner = `<line x1="${r1(i)}" y1="${r1(h / 2)}" x2="${r1(w - i)}" y2="${r1(h / 2)}" style="${stroke}stroke-linecap:round;fill:none"/>`;
  return `<svg class="ob-svg" viewBox="0 0 ${r1(w)} ${r1(h)}" width="${r1(w)}" height="${r1(h)}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
};

const FLEX = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'flex-start' }, VFLEX = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const objName = o => (o.name || (o.type === 'text' ? PC.plain(o.text || '') : o.type === 'image' ? (o.alt || '') : o.type === 'icon' ? o.icon : (PC.SHAPES[o.shape] || '') + (o.text ? ': ' + PC.plain(o.text) : ''))).slice(0, 60);
PC.objectLabel = o => (PC.OBJECT_TYPES[o.type] || 'Object') + (objName(o) ? ': ' + objName(o) : '');

PC.renderObject = function (o, i, c) {
  const d = Object.assign({}, PC.OBJ_DEFAULTS[o.type] || {}, o), editable = !!(c && c.editable), w = d.w, h = o.h != null ? o.h : null;
  let css = `left:${r1(d.x)}px;top:${r1(d.y)}px;width:${r1(w)}px;`;
  if (h != null) css += `height:${r1(h)}px;`;
  if (d.rot) css += `rotate:${d.rot}deg;`;
  if (d.opacity != null && d.opacity < 1) css += `opacity:${d.opacity};`;
  const cls = `ob ob-${o.type}${d.shadow ? ' ob-shadow' : ''}`, label = esc(PC.objectLabel(o));
  const attrs = `class="${cls}" data-obj="${esc(o.id)}" data-oi="${i}" data-type="${o.type}" style="${css}"${editable ? ` tabindex="0" role="group" aria-roledescription="${esc(PC.OBJECT_TYPES[o.type])}" aria-label="${label}"` : ''}`;
  const txt = (path, extra) => `<div class="ob-t" data-path="${path}" data-ph="${extra.ph || ''}" data-ml="1" style="${PC.typoCss(d)}">${o.text ? PC.rich(o.text) : ''}</div>`;
  let body = '';
  if (o.type === 'text') {
    if (!o.text && !editable) return '';
    body = `<div class="ob-in rv" style="justify-content:${VFLEX[d.valign] || 'flex-start'}">${txt(`objects.${i}.text`, { ph: 'Text' })}</div>`;
  } else if (o.type === 'shape') {
    const hh = h != null ? h : 160;
    body = `<div class="ob-in rv">${PC.shapeSvg(o, w, hh)}${o.text || editable ? `<div class="ob-txt" style="justify-content:${VFLEX[d.valign] || 'center'};align-items:${FLEX[d.align] || 'center'}">${txt(`objects.${i}.text`, { ph: '' })}</div>` : ''}</div>`;
  } else if (o.type === 'image') {
    const bd = d.strokeW && d.stroke ? `border:${d.strokeW}px solid ${d.stroke};` : '';
    body = `<div class="ob-in rv">${o.src ? `<img src="${esc(o.src)}" alt="${esc(o.alt || '')}" draggable="false" style="object-fit:${d.fit};border-radius:${d.radius || 0}px;${bd}">` : `<div class="ob-ph" style="border-radius:${d.radius || 0}px">${PC.icon('image', 44)}<span>Image</span></div>`}</div>`;
  } else if (o.type === 'icon') {
    body = `<div class="ob-in rv" style="color:${d.color}">${PC.icon(d.icon || 'star', '100%')}</div>`;
  }
  return `<div ${attrs}>${body}</div>`;
};
PC.renderObjects = function (s, c) {
  const list = s.objects || [];
  const hint = c && c.editable && s.layout === 'blank' && !list.length ? '<div class="blank-hint" aria-hidden="true"><b>Blank slide</b><span>Use Insert in the ribbon to add text, images and shapes. Drag them anywhere.</span></div>' : '';
  if (!list.length) return hint;
  return `<div class="objs">${list.map((o, i) => PC.renderObject(o, i, c)).join('')}</div>${hint}`;
};

/** Which ink/paper mode a slide with a custom fill should use, so theme text colours stay readable on it. */
PC.fillMode = function (s, meta) {
  if (s.bg) return s.bg;
  if (!s.fill) return '';
  if (PC.isDark(s.fill)) return 'dark';
  return meta && PC.THEMES[meta.theme] && PC.THEMES[meta.theme].dark ? 'light' : '';
};

/* ── JSON Schema for the deck (published as pitchcraft.schema.json, returned by Pitchcraft.schema()) ──
   Generated from the same registries the importer uses. Layout-specific fields are described in x-layouts (they are free-form
   per layout, and the importer whitelists them), so the schema never claims more or less than the importer accepts. */
PC.buildSchema = function (siteUrl) {
  const str = (extra) => Object.assign({ type: 'string' }, extra), num = (extra) => Object.assign({ type: 'number' }, extra);
  const colour = str({ description: 'Hex, rgb()/rgba(), a colour name, or a theme token such as var(--fg), var(--muted), var(--shape), var(--on-shape), var(--c1)..var(--c6).' });
  const objectProps = {
    id: str({ pattern: '^[\\w\\-]{1,40}$', description: 'Unique on the slide. Generated if omitted.' }),
    type: { enum: Object.keys(PC.OBJECT_TYPES) },
    x: num({ description: 'Pixels from the left of the 1280x720 stage.' }), y: num({ description: 'Pixels from the top.' }), w: num({ minimum: 2, maximum: 4000 }), h: num({ minimum: 2, maximum: 4000, description: 'Optional for text (it grows with its content).' }),
    rot: num({ description: 'Degrees clockwise.' }), opacity: num({ minimum: 0, maximum: 1 }), shadow: { type: 'boolean' }, name: str({ maxLength: 60 }),
    text: str({ maxLength: PC.LIMITS.objectText, description: 'Text and shapes. Inline markup: **bold**, *italic*, ==highlight==, `code`.' }),
    font: str({ description: 'One of ' + Object.keys(PC.FONTS).join(', ') + ', or a plain installed family name.' }),
    size: num({ description: 'Font size in px.' }), weight: num({ minimum: 100, maximum: 900 }), italic: { type: 'boolean' }, underline: { type: 'boolean' }, caps: { type: 'boolean' },
    align: { enum: ALIGN }, valign: { enum: VALIGN }, color: colour, lh: num({ description: 'Line height multiple.' }), ls: num({ description: 'Letter spacing in em.' }),
    shape: { enum: Object.keys(PC.SHAPES) }, fill: colour, stroke: colour, strokeW: num({ minimum: 0, maximum: 80 }), dash: { enum: DASH }, radius: num({ minimum: 0, maximum: 2000 }),
    src: str({ description: 'https URL or data:image/... URI.' }), alt: str({ maxLength: 300, description: 'Always provide for images.' }), fit: { enum: FIT },
    icon: { enum: PC.ICON_NAMES }
  };
  const layouts = {}; Object.entries(PC.LAYOUTS).forEach(([k, l]) => { layouts[k] = { name: l.name, group: l.group, fields: l.doc }; });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: siteUrl + 'pitchcraft.schema.json',
    title: 'Pitchcraft deck (.pitchcraft file)',
    description: 'A Pitchcraft deck. Import it with the Import dialog, by dropping the file on the page, or with Pitchcraft.importText(json). Full guide: ' + siteUrl + 'ai-guide.md',
    type: 'object', required: ['format', 'version', 'slides'],
    properties: {
      format: { const: 'pitchcraft' }, version: { const: 3 },
      meta: { type: 'object', properties: {
        name: str({ maxLength: 120 }), theme: { enum: Object.keys(PC.THEMES) }, numbers: { type: 'boolean' }, transition: { enum: Object.keys(PC.TRANSITIONS) },
        css: str({ maxLength: PC.LIMITS.metaCss, description: 'Shared brand CSS (colours, @font-face with data: URIs, logo classes) for every custom slide.' }) } },
      slides: { type: 'array', minItems: 1, maxItems: 200, items: { $ref: '#/$defs/slide' } }
    },
    $defs: {
      slide: { type: 'object', required: ['layout'], properties: {
        id: str({ pattern: '^[\\w\\-]{1,40}$' }), layout: { enum: Object.keys(PC.LAYOUTS) },
        kicker: str(), headline: str(), body: str(), notes: str({ description: 'Speaker notes.' }),
        bg: { enum: Object.keys(PC.BGS) }, tone: { enum: Object.keys(PC.TONES) }, transition: { enum: ['', ...Object.keys(PC.TRANSITIONS)] },
        fill: colour, bgImage: str({ description: 'https URL or data:image/... picture behind everything.' }),
        items: { type: 'array', description: 'List layouts. Item fields depend on the layout: see x-layouts.', items: { type: 'object' } },
        columns: { type: 'array', items: { type: 'object' } },
        chartType: { enum: Object.keys(PC.CHART_TYPES) }, chartData: { type: 'object' }, tableData: { type: 'object' },
        code: { type: 'object', properties: { language: str(), filename: str(), source: str() } },
        image: { type: 'object', properties: { src: str(), alt: str() } },
        custom: { type: 'object', description: 'Only for layout "custom": a free-form slide written in HTML, CSS and JavaScript, run in a sandboxed iframe (no network, no storage, no access to the editor).',
          properties: { html: str({ maxLength: PC.LIMITS.custom, description: 'The 1280x720 slide body. No html/head/script tags.' }), css: str({ maxLength: PC.LIMITS.custom }), js: str({ maxLength: PC.LIMITS.custom }), interactive: { type: 'boolean', description: 'true only if the slide has buttons or inputs.' } } },
        objects: { type: 'array', maxItems: PC.LIMITS.objects, items: { $ref: '#/$defs/object' }, description: 'Free-form text, shapes, images and icons on the 1280x720 stage. Layout "blank" is only objects.' },
        tweaks: { type: 'object', description: 'Move/restyle a template slide\'s own text or cards. Keys are data-paths ("headline") or list items ("items.1"); values have dx, dy and typography fields.', additionalProperties: { type: 'object' } }
      } },
      object: { type: 'object', required: ['type'], properties: objectProps }
    },
    'x-layouts': layouts
  };
};
})();
