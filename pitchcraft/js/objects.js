/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT objects — the free-form layer.
   Any slide can carry `objects`: text boxes, shapes, images and icons placed anywhere on the 1280x720 stage.
   A `blank` slide is nothing but objects. Template slides can also carry `tweaks`: per-element nudges (move, font,
   size, colour...) for the text and cards the layout generated, so furniture can be moved without abandoning the layout.

   Model (all numbers are stage pixels):
     objects: [{ id, type:'text'|'shape'|'image'|'icon'|'line', x, y, w, h?, rot?, opacity?, name?, flipH?, flipV?, locked?, link?, group?, alt?, ...type fields }]
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
/* Forty more bundled OFL families (css/fonts.css, fonts/). The key is the file stem. Grouped for the picker. */
[['dmsans', 'DM Sans', 'Sans', 'sans-serif'], ['manrope', 'Manrope', 'Sans', 'sans-serif'], ['plusjakartasans', 'Plus Jakarta Sans', 'Sans', 'sans-serif'], ['spacegrotesk', 'Space Grotesk', 'Sans', 'sans-serif'], ['outfit', 'Outfit', 'Sans', 'sans-serif'], ['montserrat', 'Montserrat', 'Sans', 'sans-serif'], ['worksans', 'Work Sans', 'Sans', 'sans-serif'], ['sora', 'Sora', 'Sans', 'sans-serif'], ['figtree', 'Figtree', 'Sans', 'sans-serif'], ['urbanist', 'Urbanist', 'Sans', 'sans-serif'], ['poppins', 'Poppins', 'Sans', 'sans-serif'], ['raleway', 'Raleway', 'Sans', 'sans-serif'], ['nunito', 'Nunito', 'Sans', 'sans-serif'], ['lato', 'Lato', 'Sans', 'sans-serif'], ['rubik', 'Rubik', 'Sans', 'sans-serif'], ['archivo', 'Archivo', 'Sans', 'sans-serif'], ['epilogue', 'Epilogue', 'Sans', 'sans-serif'], ['ibmplexsans', 'IBM Plex Sans', 'Sans', 'sans-serif'], ['josefinsans', 'Josefin Sans', 'Sans', 'sans-serif'], ['quicksand', 'Quicksand', 'Sans', 'sans-serif'], ['cabin', 'Cabin', 'Sans', 'sans-serif'],
  ['playfairdisplay', 'Playfair Display', 'Serif', 'serif'], ['lora', 'Lora', 'Serif', 'serif'], ['fraunces', 'Fraunces', 'Serif', 'serif'], ['sourceserif4', 'Source Serif 4', 'Serif', 'serif'], ['cormorantgaramond', 'Cormorant Garamond', 'Serif', 'serif'], ['librebaskerville', 'Libre Baskerville', 'Serif', 'serif'], ['dmserifdisplay', 'DM Serif Display', 'Serif', 'serif'],
  ['oswald', 'Oswald', 'Display', 'sans-serif'], ['anton', 'Anton', 'Display', 'sans-serif'], ['bebasneue', 'Bebas Neue', 'Display', 'sans-serif'], ['abrilfatface', 'Abril Fatface', 'Display', 'serif'],
  ['pacifico', 'Pacifico', 'Script', 'cursive'], ['lobster', 'Lobster', 'Script', 'cursive'], ['caveat', 'Caveat', 'Script', 'cursive'],
  ['spacemono', 'Space Mono', 'Mono', 'monospace'], ['ibmplexmono', 'IBM Plex Mono', 'Mono', 'monospace'], ['firacode', 'Fira Code', 'Mono', 'monospace'], ['inconsolata', 'Inconsolata', 'Mono', 'monospace']].forEach(([k, name, group, generic]) => { PC.FONTS[k] = { name, group, family: name, css: `'${name}', ${generic === 'monospace' ? 'ui-monospace, Menlo, Consolas, monospace' : generic === 'serif' ? 'Georgia, serif' : generic === 'cursive' ? 'cursive' : 'system-ui, sans-serif'}` }; });
/* Any plain family name is accepted (the viewer's own installed fonts): letters, digits and a little punctuation, never quotes, slashes, semicolons or brackets. */
const FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} \-._&+]{0,59}$/u;
PC.cleanFont = f => (typeof f === 'string' && has(PC.FONTS, f) ? f : typeof f === 'string' && FONT_NAME.test(f.trim()) ? f.trim() : '');
PC.fontCss = f => (has(PC.FONTS, f) ? PC.FONTS[f].css : `"${String(f).replace(/[^\p{L}\p{N} \-._&+]/gu, '')}", system-ui, sans-serif`);

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
PC.SHAPES = { rect: 'Rectangle', round: 'Rounded rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hexagon: 'Hexagon', star: 'Star', arrow: 'Right arrow', chevron: 'Chevron',
  arrowleft: 'Left arrow', arrowup: 'Up arrow', arrowdown: 'Down arrow', arrowboth: 'Left-right arrow', pentagon: 'Pentagon', octagon: 'Octagon', parallelogram: 'Parallelogram', trapezoid: 'Trapezoid',
  plus: 'Cross', callout: 'Speech bubble', donut: 'Ring', cylinder: 'Cylinder', heart: 'Heart', line: 'Line (old)', connector: 'Arrow line (old)' };
/** Shapes the Insert menu offers. 'line' and 'connector' still load and render, but new lines are the `line` object type. */
PC.SHAPE_MENU = Object.keys(PC.SHAPES).filter(k => k !== 'line' && k !== 'connector');
PC.OBJECT_TYPES = { text: 'Text box', shape: 'Shape', image: 'Image', icon: 'Icon', line: 'Line' };
PC.LINE_KINDS = { straight: 'Straight', elbow: 'Elbow (corners)', curve: 'Curved' };
PC.ARROWS = { none: 'None', triangle: 'Triangle', stealth: 'Stealth', open: 'Open arrow', dot: 'Dot', diamond: 'Diamond' };
/** The one-click lines in the Insert menu: [label, kind, arrowStart, arrowEnd] */
PC.LINE_PRESETS = { line: ['Line', 'straight', 'none', 'none'], arrow: ['Arrow', 'straight', 'none', 'triangle'], darrow: ['Double arrow', 'straight', 'triangle', 'triangle'], elbow: ['Elbow connector', 'elbow', 'none', 'none'], elbowarrow: ['Elbow arrow', 'elbow', 'none', 'triangle'], curve: ['Curved connector', 'curve', 'none', 'none'], curvearrow: ['Curved arrow', 'curve', 'none', 'triangle'] };
PC.WEIGHTS = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold' };
const ALIGN = ['left', 'center', 'right', 'justify'], VALIGN = ['top', 'middle', 'bottom'], FIT = ['cover', 'contain', 'fill'], DASH = ['solid', 'dashed', 'dotted'];

/** What every property defaults to when the object does not say. The renderer merges these in; the UI writes explicit values. */
PC.OBJ_DEFAULTS = {
  text: { w: 520, size: 36, weight: 400, font: 'body', align: 'left', valign: 'top', color: 'var(--fg)', lh: 1.25, ls: 0 },
  shape: { w: 260, h: 160, shape: 'rect', fill: 'var(--shape)', stroke: '', strokeW: 0, radius: 0, dash: 'solid', size: 28, weight: 600, font: 'body', align: 'center', valign: 'middle', color: 'var(--on-shape)', lh: 1.2, ls: 0 },
  image: { w: 480, h: 320, fit: 'cover', radius: 0, stroke: '', strokeW: 0 },
  icon: { w: 96, h: 96, color: 'var(--shape)' },
  line: { w: 320, h: 0, kind: 'straight', stroke: 'var(--shape)', strokeW: 5, dash: 'solid', arrowStart: 'none', arrowEnd: 'none', bend: .5 }
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
  const line = type === 'line';
  o.x = r1(num(r.x, 100, -3000, 4000)); o.y = r1(num(r.y, 100, -3000, 4000)); o.w = r1(num(r.w, D.w, line ? 0 : 4, 4000));
  if (type !== 'text' || (r.h != null && r.h !== '')) o.h = r1(num(r.h, line ? 0 : D.h || 60, line ? 0 : 2, 4000));
  const rot = num(r.rot, 0, -360, 360); if (rot) o.rot = r1(rot);
  if (type !== 'text') { if (r.flipH === true) o.flipH = true; if (r.flipV === true) o.flipV = true; }
  if (r.locked === true) o.locked = true;
  if (typeof r.alt === 'string' && r.alt && type !== 'image') o.alt = r.alt.slice(0, 300);
  if (typeof r.link === 'string' && PC.okLink(r.link.trim())) o.link = r.link.trim().slice(0, 500);
  if (typeof r.group === 'string' && /^[\w-]{1,24}$/.test(r.group)) o.group = r.group;
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
    if (has(r, 'fill2') && PC.okColor(r.fill2)) { o.fill2 = r.fill2; const ga = num(r.gradAngle, 90, 0, 360); if (ga !== 90) o.gradAngle = Math.round(ga); }   // a second colour makes a linear gradient
  }
  if (type === 'line') {
    o.kind = has(PC.LINE_KINDS, r.kind) ? r.kind : 'straight';
    if (o.kind !== 'straight' && r.vert === true) o.vert = true;
    if (o.kind !== 'straight') { const b = num(r.bend, .5, .05, .95); if (Math.abs(b - .5) > .004) o.bend = Math.round(b * 1000) / 1000; }
    o.stroke = PC.okColor(r.stroke) ? r.stroke : 'var(--shape)';
    o.strokeW = r1(num(r.strokeW, D.strokeW, .5, 80));
    if (DASH.includes(r.dash) && r.dash !== 'solid') o.dash = r.dash;
    if (has(PC.ARROWS, r.arrowStart) && r.arrowStart !== 'none') o.arrowStart = r.arrowStart;
    if (has(PC.ARROWS, r.arrowEnd) && r.arrowEnd !== 'none') o.arrowEnd = r.arrowEnd;
    ['from', 'to'].forEach(k => { if (typeof r[k] === 'string' && /^[\w-]{1,40}:[trbl]$/.test(r[k])) o[k] = r[k]; });   // glued to a connection site "objectId:t|r|b|l"
  }
  if ((type === 'text' || type === 'shape') && (r.list === 'bullet' || r.list === 'number')) o.list = r.list;
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
/** Links that may be attached to an object or a slide: https, mailto, or a jump to another slide ("#slide-id"). Never javascript: or data:. */
PC.okLink = u => typeof u === 'string' && /^(https:\/\/[^\s"'<>]{3,}|mailto:[^\s"'<>]{3,}|#[\w-]{1,40})$/i.test(u);
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
  if (type === 'line' && over.kind && over.kind !== 'straight' && over.h == null) base.h = 120;
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

/* normalised outlines (0..1 in both axes) for the straight-edged shapes */
const POLY = {
  arrow: [[0, .3], [.6, .3], [.6, 0], [1, .5], [.6, 1], [.6, .7], [0, .7]],
  arrowleft: [[1, .3], [.4, .3], [.4, 0], [0, .5], [.4, 1], [.4, .7], [1, .7]],
  arrowup: [[.3, 1], [.3, .4], [0, .4], [.5, 0], [1, .4], [.7, .4], [.7, 1]],
  arrowdown: [[.3, 0], [.3, .6], [0, .6], [.5, 1], [1, .6], [.7, .6], [.7, 0]],
  arrowboth: [[0, .5], [.25, 0], [.25, .3], [.75, .3], [.75, 0], [1, .5], [.75, 1], [.75, .7], [.25, .7], [.25, 1]],
  chevron: [[0, 0], [.7, 0], [1, .5], [.7, 1], [0, 1], [.3, .5]],
  triangle: [[.5, 0], [1, 1], [0, 1]], diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]],
  hexagon: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
  pentagon: [[.5, 0], [1, .38], [.81, 1], [.19, 1], [0, .38]],
  octagon: [[.29, 0], [.71, 0], [1, .29], [1, .71], [.71, 1], [.29, 1], [0, .71], [0, .29]],
  parallelogram: [[.22, 0], [1, 0], [.78, 1], [0, 1]], trapezoid: [[.2, 0], [.8, 0], [1, 1], [0, 1]],
  plus: [[.33, 0], [.67, 0], [.67, .33], [1, .33], [1, .67], [.67, .67], [.67, 1], [.33, 1], [.33, .67], [0, .67], [0, .33], [.33, .33]]
};
PC.POLY = POLY;
const HEART = 'M50 92C8 62 0 42 0 26 0 11 12 0 27 0c10 0 19 5 23 14C54 5 63 0 73 0c15 0 27 11 27 26 0 16-8 36-50 66z';
let gradN = 0;

PC.shapeSvg = function (o, w, h) {
  const d = Object.assign({}, PC.OBJ_DEFAULTS.shape, o), sw = d.strokeW || 0, i = sw / 2, kind = d.shape, line = kind === 'line' || kind === 'connector';
  let defs = '', fillCss = d.fill && !line ? `fill:${d.fill};` : 'fill:none;';
  if (d.fill2 && !line) {   // two colours: a linear gradient at gradAngle (CSS convention: 90 = left to right, 180 = top to bottom)
    const gid = 'pcgr' + (++gradN), a = ((d.gradAngle == null ? 90 : d.gradAngle) - 90) * Math.PI / 180, dx = Math.cos(a) / 2, dy = Math.sin(a) / 2;
    defs = `<defs><linearGradient id="${gid}" x1="${r1(.5 - dx)}" y1="${r1(.5 - dy)}" x2="${r1(.5 + dx)}" y2="${r1(.5 + dy)}"><stop offset="0" stop-color="${esc(d.fill || 'var(--shape)')}"/><stop offset="1" stop-color="${esc(d.fill2)}"/></linearGradient></defs>`;
    fillCss = `fill:url(#${gid});`;
  }
  const dash = d.dash === 'dashed' ? `stroke-dasharray:${sw * 3 + 6} ${sw * 2 + 4};` : d.dash === 'dotted' ? `stroke-dasharray:0 ${sw * 2 + 4};stroke-linecap:round;` : '';
  const strokeCol = d.stroke || (line ? d.fill || 'var(--shape)' : '');
  const stroke = strokeCol && (sw > 0 || line) ? `stroke:${strokeCol};stroke-width:${line ? sw || 6 : sw};stroke-linejoin:round;${dash}` : 'stroke:none;';
  const st = ` style="${fillCss}${stroke}"`, W = w - 2 * i, H = h - 2 * i;
  let inner;
  if (kind === 'ellipse') inner = `<ellipse cx="${r1(w / 2)}" cy="${r1(h / 2)}" rx="${r1(Math.max(1, W / 2))}" ry="${r1(Math.max(1, H / 2))}"${st}/>`;
  else if (kind === 'rect' || kind === 'round') { const rad = Math.min(d.radius || (kind === 'round' ? 28 : 0), W / 2, H / 2); inner = `<rect x="${r1(i)}" y="${r1(i)}" width="${r1(Math.max(1, W))}" height="${r1(Math.max(1, H))}" rx="${r1(rad)}"${st}/>`; }
  else if (kind === 'star') inner = `<polygon points="${pts(STAR.map(p => [w / 2 + p[0] * W / 2, h / 2 + p[1] * H / 2 * 1.04]))}"${st}/>`;
  else if (POLY[kind]) inner = `<polygon points="${pts(POLY[kind].map(p => [i + p[0] * W, i + p[1] * H]))}"${st}/>`;
  else if (kind === 'callout') { const rad = Math.min(d.radius || 24, W / 2, H / 3), by = i + H * .76, x0 = i, x1 = i + W, y0 = i; inner = `<path d="M${r1(x0 + rad)} ${r1(y0)}H${r1(x1 - rad)}Q${r1(x1)} ${r1(y0)} ${r1(x1)} ${r1(y0 + rad)}V${r1(by - rad)}Q${r1(x1)} ${r1(by)} ${r1(x1 - rad)} ${r1(by)}H${r1(i + W * .38)}L${r1(i + W * .2)} ${r1(i + H)}L${r1(i + W * .24)} ${r1(by)}H${r1(x0 + rad)}Q${r1(x0)} ${r1(by)} ${r1(x0)} ${r1(by - rad)}V${r1(y0 + rad)}Q${r1(x0)} ${r1(y0)} ${r1(x0 + rad)} ${r1(y0)}Z"${st}/>`; }
  else if (kind === 'donut') { const cx = w / 2, cy = h / 2, rx = Math.max(1, W / 2), ry = Math.max(1, H / 2), k = .55; inner = `<path fill-rule="evenodd" d="M${r1(cx - rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0ZM${r1(cx - rx * k)} ${r1(cy)}a${r1(rx * k)} ${r1(ry * k)} 0 1 1 ${r1(2 * rx * k)} 0a${r1(rx * k)} ${r1(ry * k)} 0 1 1 ${r1(-2 * rx * k)} 0Z"${st}/>`; }
  else if (kind === 'cylinder') { const rx = Math.max(1, W / 2), ry = Math.max(2, Math.min(H * .14, 40)), x0 = i, y0 = i; inner = `<path d="M${r1(x0)} ${r1(y0 + ry)}A${r1(rx)} ${r1(ry)} 0 0 1 ${r1(x0 + W)} ${r1(y0 + ry)}V${r1(y0 + H - ry)}A${r1(rx)} ${r1(ry)} 0 0 1 ${r1(x0)} ${r1(y0 + H - ry)}Z"${st}/><path d="M${r1(x0)} ${r1(y0 + ry)}A${r1(rx)} ${r1(ry)} 0 0 0 ${r1(x0 + W)} ${r1(y0 + ry)}" style="fill:none;${stroke.replace('stroke:none;', 'stroke:rgba(0,0,0,.25);stroke-width:1;')}"/>`; }
  else if (kind === 'heart') inner = `<path d="${HEART}" transform="translate(${r1(i)} ${r1(i)}) scale(${r1(W / 100 * 1000) / 1000} ${r1(H / 92 * 1000) / 1000})"${st}/>`;
  else if (kind === 'connector') { const t = Math.max(18, (sw || 6) * 3.4), y = h / 2; inner = `<line x1="${r1(i)}" y1="${r1(y)}" x2="${r1(Math.max(i, w - t * .7))}" y2="${r1(y)}" style="${stroke}stroke-linecap:round;fill:none"/><polygon points="${pts([[w - t, y - t / 2], [w, y], [w - t, y + t / 2]])}" style="fill:${strokeCol || 'var(--shape)'};stroke:none"/>`; }
  else inner = `<line x1="${r1(i)}" y1="${r1(h / 2)}" x2="${r1(w - i)}" y2="${r1(h / 2)}" style="${stroke}stroke-linecap:round;fill:none"/>`;
  return `<svg class="ob-svg" viewBox="0 0 ${r1(w)} ${r1(h)}" width="${r1(w)}" height="${r1(h)}" preserveAspectRatio="none" aria-hidden="true">${defs}${inner}</svg>`;
};

/* ── lines and connectors ──────────────────────────────────────────────────────────────────────
   A line is a box (x, y, w, h) whose start is the top-left corner and whose end is the bottom-right corner, flipped by flipH/flipV.
   That is also how PowerPoint stores a connector, so a line moves, nudges and aligns like any other object and exports one-to-one.
   straight: a diagonal.  elbow: horizontal-vertical-horizontal (vert:true = vertical-horizontal-vertical), the middle run sits at `bend` (0..1).
   curve: the PowerPoint S-curve through the same points. Ends can carry arrowheads. from/to glue an end to "objectId:t|r|b|l". */
PC.lineGeom = function (o, w, h) {
  const kind = o.kind || 'straight', vert = !!o.vert, b = o.bend == null ? .5 : o.bend, fh = !!o.flipH, fv = !!o.flipV;
  let poly = null, bez = null, mid;
  if (kind === 'elbow') { poly = vert ? [[0, 0], [0, h * b], [w, h * b], [w, h]] : [[0, 0], [w * b, 0], [w * b, h], [w, h]]; mid = vert ? [w / 2, h * b] : [w * b, h / 2]; }
  else if (kind === 'curve') {
    if (vert) { const y2 = h * b; bez = [[0, 0], [0, y2 / 2], [w / 4, y2], [w / 2, y2], [3 * w / 4, y2], [w, (h + y2) / 2], [w, h]]; mid = [w / 2, y2]; }
    else { const x2 = w * b; bez = [[0, 0], [x2 / 2, 0], [x2, h / 4], [x2, h / 2], [x2, 3 * h / 4], [(w + x2) / 2, h], [w, h]]; mid = [x2, h / 2]; }
  } else { poly = [[0, 0], [w, h]]; mid = [w / 2, h / 2]; }
  const F = p => [fh ? w - p[0] : p[0], fv ? h - p[1] : p[1]];
  if (poly) poly = poly.map(F); if (bez) bez = bez.map(F); mid = F(mid);
  const pool = poly || bez, start = pool[0], end = pool[pool.length - 1], far = q => Math.hypot(q[0] - start[0], q[1] - start[1]) > .5, farE = q => Math.hypot(q[0] - end[0], q[1] - end[1]) > .5;
  const unit = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
  const next = pool.slice(1).find(far) || pool[1], prev = pool.slice(0, -1).reverse().find(farE) || pool[pool.length - 2];
  return { poly, bez, mid, start, end, startDir: unit(start, next), endDir: unit(prev, end) };
};
const shorten = (g, atEnd, len) => {   // pull one end of the path back along its own direction (so a filled arrowhead covers the stroke)
  if (!len) return;
  if (g.poly) {
    const pts2 = g.poly, a = atEnd ? pts2[pts2.length - 1] : pts2[0], bb = atEnd ? pts2[pts2.length - 2] : pts2[1], L = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
    if (!L) return; const k = Math.min(len, L * .9) / L; a[0] += (bb[0] - a[0]) * k; a[1] += (bb[1] - a[1]) * k;
  } else {   // split the end cubic where the curve is `len` away from its tip
    const z = g.bez, seg = atEnd ? [z[3], z[4], z[5], z[6]] : [z[0], z[1], z[2], z[3]], tip = atEnd ? seg[3] : seg[0];
    const at = t => { const u = 1 - t; return [u * u * u * seg[0][0] + 3 * u * u * t * seg[1][0] + 3 * u * t * t * seg[2][0] + t * t * t * seg[3][0], u * u * u * seg[0][1] + 3 * u * u * t * seg[1][1] + 3 * u * t * t * seg[2][1] + t * t * t * seg[3][1]]; };
    let lo = 0, hi = 1; for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2, p = at(m), tooFar = Math.hypot(p[0] - tip[0], p[1] - tip[1]) > len; if (atEnd ? tooFar : !tooFar) lo = m; else hi = m; }
    const t = (lo + hi) / 2, lerp = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const ab = lerp(seg[0], seg[1]), bc = lerp(seg[1], seg[2]), cd = lerp(seg[2], seg[3]), abc = lerp(ab, bc), bcd = lerp(bc, cd), m = lerp(abc, bcd);
    if (atEnd) { z[4] = ab; z[5] = abc; z[6] = m; } else { z[0] = m; z[1] = bcd; z[2] = cd; }
  }
};
const headShape = (type, P, u, sw) => {   // u points out of the line, through the tip
  const L = Math.max(11, Math.min(60, sw * 3.6)), Wd = L * .9, n = [-u[1], u[0]], at = (a, b) => [P[0] - u[0] * a + n[0] * b, P[1] - u[1] * a + n[1] * b];
  if (type === 'triangle') return { back: L * .92, svg: `<polygon points="${pts([P, at(L, Wd / 2), at(L, -Wd / 2)])}"/>` };
  if (type === 'stealth') return { back: L * .7, svg: `<polygon points="${pts([P, at(L, Wd / 2), at(L * .7, 0), at(L, -Wd / 2)])}"/>` };
  if (type === 'diamond') return { back: L * .9, svg: `<polygon points="${pts([P, at(L / 2, Wd / 2), at(L, 0), at(L / 2, -Wd / 2)])}"/>` };
  if (type === 'dot') { const c = at(Wd / 2, 0); return { back: Wd * .4, svg: `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(Wd / 2)}"/>` }; }
  if (type === 'open') return { back: 0, svg: `<polyline points="${pts([at(L * .9, Wd / 2), P, at(L * .9, -Wd / 2)])}" style="fill:none;stroke-linejoin:miter"/>` };
  return null;
};
PC.lineSvg = function (o, w, h) {
  const d = Object.assign({}, PC.OBJ_DEFAULTS.line, o), sw = d.strokeW || 5, col = d.stroke || 'var(--shape)';
  const g = PC.lineGeom(d, w, h), hs = headShape(d.arrowStart, g.start, [-g.startDir[0], -g.startDir[1]], sw), he = headShape(d.arrowEnd, g.end, g.endDir, sw);
  const sh = { poly: g.poly && g.poly.map(p => p.slice()), bez: g.bez && g.bez.map(p => p.slice()) };
  if (hs) shorten(sh, false, hs.back); if (he) shorten(sh, true, he.back);
  const dpath = sh.poly ? 'M' + sh.poly.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') : `M${sh.bez[0].map(r1).join(' ')}C${sh.bez.slice(1, 4).map(p => p.map(r1).join(' ')).join(' ')}C${sh.bez.slice(4).map(p => p.map(r1).join(' ')).join(' ')}`;
  const dash = d.dash === 'dashed' ? `stroke-dasharray:${sw * 3 + 6} ${sw * 2 + 4};` : d.dash === 'dotted' ? `stroke-dasharray:0 ${sw * 2 + 4};stroke-linecap:round;` : '';
  const ink = `stroke:${col};stroke-width:${sw};stroke-linejoin:${d.kind === 'curve' ? 'round' : 'miter'};stroke-linecap:${d.dash === 'dotted' ? 'round' : 'butt'};`;
  const headStyle = `fill:${col};stroke:${col};stroke-width:${r1(sw * .25)};stroke-linejoin:round;`;
  const hv = Math.max(h, 1), hit = Math.max(sw, 16);
  const hd = [[hs, d.arrowStart], [he, d.arrowEnd]].map(([x, t]) => (x ? `<g style="${t === 'open' ? `stroke:${col};stroke-width:${sw};stroke-linecap:round;fill:none` : headStyle}">${x.svg}</g>` : '')).join('');
  return `<svg class="ob-svg ob-linesvg" viewBox="0 0 ${r1(Math.max(w, 1))} ${r1(hv)}" width="${r1(Math.max(w, 1))}" height="${r1(hv)}" preserveAspectRatio="none" aria-hidden="true"><path class="ln-hit" d="${dpath}" style="fill:none;stroke:transparent;stroke-width:${hit}"/><path d="${dpath}" style="fill:none;${ink}${dash}"/>${hd}</svg>`;
};
/** Where a line starts and ends on the stage (accounts for flips and rotation). */
PC.lineEnds = function (o) {
  const w = o.w || 0, h = o.h || 0, s = [o.flipH ? w : 0, o.flipV ? h : 0], e = [o.flipH ? 0 : w, o.flipV ? 0 : h], rad = (o.rot || 0) * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
  const T = p => { const dx = p[0] - w / 2, dy = p[1] - h / 2; return { x: r1(o.x + w / 2 + dx * c - dy * sn), y: r1(o.y + h / 2 + dx * sn + dy * c) }; };
  return { s: T(s), e: T(e) };
};
/** The box fields that put a line's ends at two stage points (rotation is folded in). */
PC.lineFromEnds = function (s, e) { return { x: r1(Math.min(s.x, e.x)), y: r1(Math.min(s.y, e.y)), w: r1(Math.abs(e.x - s.x)), h: r1(Math.abs(e.y - s.y)), flipH: s.x > e.x, flipV: s.y > e.y }; };
const SITE = { t: [.5, 0], r: [1, .5], b: [.5, 1], l: [0, .5] };
PC.SITES = Object.keys(SITE);
PC.sitePoint = (r, site) => ({ x: r1(r.x + r.w * SITE[site][0]), y: r1(r.y + r.h * SITE[site][1]) });
/** The height the data alone can promise for an object (text without an explicit height grows with its lines). */
PC.guessHeight = o => (o.h != null ? o.h : Math.round((o.size || 36) * (o.lh || 1.25) * Math.max(1, String(o.text || '').split('\n').length)) + 4);
/** Re-aim every glued line at its objects. `rectOf(o)` may supply live geometry (while dragging). Missing targets unglue the line. Returns the ids that changed. */
PC.relinkLines = function (slide, rectOf) {
  const list = (slide && slide.objects) || [], byId = {}; list.forEach(o => { byId[o.id] = o; }); const changed = [];
  list.forEach(o => {
    if (o.type !== 'line' || (!o.from && !o.to)) return;
    const ends = PC.lineEnds(o); let sP = ends.s, eP = ends.e, dirty = false;
    ['from', 'to'].forEach(k => {
      if (!o[k]) return; const [id, site] = o[k].split(':'), t = byId[id];
      if (!t || t.type === 'line' || !SITE[site]) { delete o[k]; dirty = true; return; }
      const r = (rectOf && rectOf(t)) || { x: t.x, y: t.y, w: t.w, h: PC.guessHeight(t) }, p = PC.sitePoint(r, site);
      if (k === 'from') { if (p.x !== sP.x || p.y !== sP.y) { sP = p; dirty = true; } } else if (p.x !== eP.x || p.y !== eP.y) { eP = p; dirty = true; }
    });
    if (dirty) { Object.assign(o, PC.lineFromEnds(sP, eP)); delete o.rot; changed.push(o.id); }
  });
  return changed;
};
/** Which edge of a box a line should leave from: used when gluing a freshly drawn line to the nearest site. */
PC.nearestSite = function (rects, p, thr) {
  let best = null;
  rects.forEach(({ id, r }) => PC.SITES.forEach(site => { const q = PC.sitePoint(r, site), dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd <= thr && (!best || dd < best.d)) best = { id, site, d: dd, x: q.x, y: q.y }; }));
  return best;
};

const FLEX = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'flex-start' }, VFLEX = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const objName = o => (o.name || (o.type === 'line' ? (PC.LINE_KINDS[o.kind || 'straight'] || 'Line') + (o.arrowEnd || o.arrowStart ? ' arrow' : '') : o.type === 'text' ? PC.plain(o.text || '') : o.type === 'image' ? (o.alt || '') : o.type === 'icon' ? o.icon : (PC.SHAPES[o.shape] || '') + (o.text ? ': ' + PC.plain(o.text) : ''))).slice(0, 60);
PC.objectLabel = o => (PC.OBJECT_TYPES[o.type] || 'Object') + (objName(o) ? ': ' + objName(o) : '');

/** Text with its lines as bullets or numbers (a hanging marker per line). Falls back to inline markup alone. */
PC.richList = function (text, list) {
  if (!list) return PC.rich(text);
  let n = 0;
  return String(text).split('\n').map(line => { const empty = !line.trim(); if (!empty) n++; return `<span class="bl${empty ? ' bl-0' : ''}" data-mk="${empty ? '' : list === 'number' ? n + '.' : '•'}">${empty ? '\u200b' : PC.rich(line)}</span>`; }).join('');
};
const flipCss = d => (d.flipH || d.flipV ? `transform:scale(${d.flipH ? -1 : 1},${d.flipV ? -1 : 1});` : '');
PC.renderObject = function (o, i, c) {
  const d = Object.assign({}, PC.OBJ_DEFAULTS[o.type] || {}, o), editable = !!(c && c.editable), w = d.w, h = o.h != null ? o.h : null;
  let css = `left:${r1(d.x)}px;top:${r1(d.y)}px;width:${r1(w)}px;`;
  if (h != null) css += `height:${r1(h)}px;`;
  if (d.rot) css += `rotate:${d.rot}deg;`;
  if (d.opacity != null && d.opacity < 1) css += `opacity:${d.opacity};`;
  const cls = `ob ob-${o.type}${d.shadow ? ' ob-shadow' : ''}${d.locked ? ' ob-locked' : ''}${d.link ? ' ob-link' : ''}`, label = esc(PC.objectLabel(o));
  const extra = (d.link && PC.okLink(d.link) ? ` data-link="${esc(d.link)}"` : '') + (d.group ? ` data-group="${esc(d.group)}"` : '') + (d.locked ? ' data-locked="1"' : '') + (o.type === 'line' && (d.from || d.to) ? ` data-glue="${esc((d.from || '') + '>' + (d.to || ''))}"` : '');
  const aria = editable ? ` tabindex="0" role="group" aria-roledescription="${esc(PC.OBJECT_TYPES[o.type])}" aria-label="${label}"` : (d.alt && o.type !== 'text' ? ` role="img" aria-label="${esc(d.alt)}"` : '');
  const attrs = `class="${cls}" data-obj="${esc(o.id)}" data-oi="${i}" data-type="${o.type}" style="${css}"${extra}${aria}`;
  const txt = (path, extra2) => `<div class="ob-t" data-path="${path}" data-ph="${extra2.ph || ''}" data-ml="1" style="${PC.typoCss(d)}">${o.text ? PC.richList(o.text, d.list) : ''}</div>`;
  let body = '';
  if (o.type === 'text') {
    if (!o.text && !editable) return '';
    body = `<div class="ob-in rv" style="justify-content:${VFLEX[d.valign] || 'flex-start'}">${txt(`objects.${i}.text`, { ph: 'Text' })}</div>`;
  } else if (o.type === 'shape') {
    const hh = h != null ? h : 160, svg = PC.shapeSvg(o, w, hh).replace('<svg class="ob-svg"', `<svg class="ob-svg"${flipCss(d) ? ` style="${flipCss(d)}"` : ''}`);
    body = `<div class="ob-in rv">${svg}${o.text || editable ? `<div class="ob-txt" style="justify-content:${VFLEX[d.valign] || 'center'};align-items:${FLEX[d.align] || 'center'}">${txt(`objects.${i}.text`, { ph: '' })}</div>` : ''}</div>`;
  } else if (o.type === 'line') {
    body = `<div class="ob-in rv">${PC.lineSvg(o, w, h != null ? h : 0)}</div>`;
  } else if (o.type === 'image') {
    const bd = d.strokeW && d.stroke ? `border:${d.strokeW}px solid ${d.stroke};` : '';
    body = `<div class="ob-in rv">${o.src ? `<img src="${esc(o.src)}" alt="${esc(o.alt || '')}" draggable="false" style="object-fit:${d.fit};border-radius:${d.radius || 0}px;${bd}${flipCss(d)}">` : `<div class="ob-ph" style="border-radius:${d.radius || 0}px">${PC.icon('image', 44)}<span>Image</span></div>`}</div>`;
  } else if (o.type === 'icon') {
    body = `<div class="ob-in rv" style="color:${d.color};${flipCss(d)}">${PC.icon(d.icon || 'star', '100%')}</div>`;
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
    icon: { enum: PC.ICON_NAMES },
    flipH: { type: 'boolean', description: 'Mirror left-right (lines: the start is on the right).' }, flipV: { type: 'boolean', description: 'Mirror top-bottom.' },
    locked: { type: 'boolean', description: 'The editor will not move, resize or edit it until unlocked.' }, group: str({ pattern: '^[\\w-]{1,24}$', description: 'Objects sharing a group id select and move together.' }),
    link: str({ description: 'https://, mailto: or #slide-id. Followed when presenting.' }), alt: str({ maxLength: 300, description: 'Alternative text for shapes, icons and lines (images use alt).' }),
    list: { enum: ['bullet', 'number'], description: 'Text and shapes: each line becomes a bullet or numbered item.' },
    fill2: colour, gradAngle: num({ minimum: 0, maximum: 360, description: 'With fill2: a linear gradient from fill to fill2. 90 = left to right, 180 = top to bottom.' }),
    kind: { enum: Object.keys(PC.LINE_KINDS), description: 'type "line": straight, elbow (right-angle corners) or curve. Start = top-left of the box, end = bottom-right, unless flipped.' },
    vert: { type: 'boolean', description: 'Elbow and curve: leave the start vertically instead of horizontally.' }, bend: num({ minimum: .05, maximum: .95, description: 'Elbow and curve: where the middle run sits, 0..1 (default 0.5).' }),
    arrowStart: { enum: Object.keys(PC.ARROWS) }, arrowEnd: { enum: Object.keys(PC.ARROWS) },
    from: str({ pattern: '^[\\w-]{1,40}:[trbl]$', description: 'type "line": glue the start to a side of another object, "objectId:t|r|b|l". The line follows when the object moves.' }), to: str({ pattern: '^[\\w-]{1,40}:[trbl]$', description: 'Glue the end likewise.' })
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
        hidden: { type: 'boolean', description: 'Skipped when presenting and exported as a hidden slide.' }, fill: colour, bgImage: str({ description: 'https URL or data:image/... picture behind everything.' }),
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
