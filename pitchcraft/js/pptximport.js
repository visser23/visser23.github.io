/* PowerPoint import: .pptx -> deck of custom HTML slides (the opposite of pptx.js).
   Each slide becomes ONE custom slide whose html is absolutely positioned elements on the 1280x720 stage: text boxes and shapes with
   real text (editable in the frame), pictures as background-image rules in the slide css, tables as <table>, lines and presets as inline SVG.
   Layout/master shapes, placeholders, theme colours and fonts, text styles (levels, bullets, spacing, autofit) are resolved the way PowerPoint does.
   The file is untrusted: the zip is size-capped, XML goes through DOMParser only, every string that reaches the html is escaped and every
   number clamped, pictures are decoded and re-encoded through a canvas, and no link, script or external reference survives.
   API: PC.importPptx(bytes, { name, progress }) -> Promise<{ deck, warnings, report }>.  Tests: tests/e2e/pptximport.spec.js. */
(function () {
'use strict';
const PC = window.PC, esc = PC.esc;
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const LIM = { entries: 4000, total: 400e6, one: 80e6, slides: 200, shapes: 700, depth: 12 };

/* ── zip reader (stored + deflate), with caps against zip bombs ── */
PC.unzip = async function (input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('This is not a PowerPoint file (no zip directory found).');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); if (n > LIM.entries) throw new Error('The file has too many parts.');
  const out = new Map(); let total = 0;
  for (let i = 0; i < n; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('The zip directory is damaged.');
    const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), usz = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (name.endsWith('/')) continue;
    if (usz > LIM.one) { if (/^ppt\/(media|embeddings)\//.test(name)) continue; throw new Error('A part of the file is too large to import (the limit is 80 MB per part).'); }
    total += usz; if (total > LIM.total) throw new Error('The file is too large to import.');
    out.set(name, { method, csz, usz, lho, name });
  }
  const get = async ent => {
    if (ent.lho + 30 > u8.length || dv.getUint32(ent.lho, true) !== 0x04034b50) throw new Error('A part of the file is damaged: ' + ent.name);
    const start = ent.lho + 30 + dv.getUint16(ent.lho + 26, true) + dv.getUint16(ent.lho + 28, true), raw = u8.subarray(start, start + ent.csz);
    if (ent.method === 0) return raw;
    if (ent.method !== 8) throw new Error('Unsupported compression in ' + ent.name);
    const rd = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; if (got > Math.min(LIM.one, ent.usz + 1024)) { rd.cancel(); throw new Error('A part inflates larger than declared: ' + ent.name); } parts.push(value); }
    const res = new Uint8Array(got); let o = 0; parts.forEach(c => { res.set(c, o); o += c.length; }); return res;
  };
  return { names: Array.from(out.keys()), has: nm => out.has(nm), bytes: nm => out.has(nm) ? get(out.get(nm)) : Promise.resolve(null), size: nm => out.has(nm) ? out.get(nm).usz : 0 };
};

/* ── xml helpers ── */
const kids = (n, name) => n ? Array.from(n.children).filter(c => !name || c.localName === name) : [];
const kid = (n, ...path) => { let c = n; for (const nm of path) { if (!c) return null; c = kids(c, nm)[0] || null; } return c; };
const at = (n, a, d) => (n && n.hasAttribute(a) ? n.getAttribute(a) : d);
const nu = (n, a, d) => { const v = parseFloat(at(n, a)); return Number.isFinite(v) ? v : d; };
const rattr = (n, a) => (n ? n.getAttributeNS(NS_R, a) || n.getAttribute('r:' + a) || '' : '');
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = v => Math.round(v * 10) / 10;
const px2 = v => Math.round(v * 100) / 100;
function parseXml(txt) {
  const d = new DOMParser().parseFromString(String(txt).replace(/^\uFEFF/, ''), 'application/xml');
  if (d.querySelector('parsererror')) throw new Error('A part of the file is not valid XML.');
  return d.documentElement;
}
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
function resolve(base, target) {
  if (/^[a-z]+:/i.test(target)) return null;
  const parts = (target.startsWith('/') ? target.slice(1) : dirOf(base) + target).split('/'), out = [];
  parts.forEach(s => { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }); return out.join('/');
}

/* ── colour ── */
const hex2 = n => (n < 16 ? '0' : '') + Math.round(clampN(n, 0, 255)).toString(16);
const toRgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (!s) { const v = l * 255; return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const SYS = { windowText: '000000', window: 'ffffff', menuText: '000000', highlight: '3399ff', highlightText: 'ffffff', grayText: '808080', btnFace: 'f0f0f0' };
const PRST = { black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff', yellow: 'ffff00', gray: '808080', grey: '808080', orange: 'ffa500', purple: '800080', cyan: '00ffff', magenta: 'ff00ff', lime: '00ff00', navy: '000080', teal: '008080', silver: 'c0c0c0', maroon: '800000', olive: '808000', darkBlue: '00008b', darkRed: '8b0000', darkGreen: '006400', lightGray: 'd3d3d3', darkGray: 'a9a9a9', dkGray: 'a9a9a9', ltGray: 'd3d3d3', pink: 'ffc0cb', brown: 'a52a2a' };
/** an a:srgbClr / schemeClr / sysClr / prstClr element (or a fill/ln holding one) -> { h: 'rrggbb', a: 0..1 } or null */
function colour(node, X) {
  if (!node) return null;
  if (!/Clr$/.test(node.localName)) node = kids(node).find(c => /Clr$/.test(c.localName)); if (!node) return null;
  let h = null;
  switch (node.localName) {
    case 'srgbClr': h = at(node, 'val', '000000'); break;
    case 'sysClr': h = at(node, 'lastClr', SYS[at(node, 'val')] || '000000'); break;
    case 'prstClr': h = PRST[at(node, 'val')] || '000000'; break;
    case 'scrgbClr': h = hex2(nu(node, 'r', 0) / 1000 * 2.55) + hex2(nu(node, 'g', 0) / 1000 * 2.55) + hex2(nu(node, 'b', 0) / 1000 * 2.55); break;
    case 'hslClr': h = (c => hex2(c[0]) + hex2(c[1]) + hex2(c[2]))(hsl2rgb(nu(node, 'hue', 0) / 21600000, nu(node, 'sat', 0) / 100000, nu(node, 'lum', 0) / 100000)); break;
    case 'schemeClr': { const v = at(node, 'val', 'tx1'); h = v === 'phClr' ? (X.ph || '808080') : X.scheme(v); break; }
    default: return null;
  }
  if (!/^[0-9a-f]{6}$/i.test(h || '')) h = '808080';
  h = h.toLowerCase(); let a = 1;
  kids(node).forEach(m => {
    const v = nu(m, 'val', 0) / 100000;
    if (m.localName === 'alpha') a = clampN(v, 0, 1); else if (m.localName === 'alphaMod') a *= clampN(v, 0, 5); else if (m.localName === 'alphaOff') a = clampN(a + v, 0, 1);
    else if (/^(lumMod|lumOff|satMod|satOff|hueMod|hueOff)$/.test(m.localName)) {
      const [r, g, b] = toRgb(h); let [hh, s, l] = rgb2hsl(r, g, b);
      if (m.localName === 'lumMod') l *= v; else if (m.localName === 'lumOff') l += v; else if (m.localName === 'satMod') s *= v; else if (m.localName === 'satOff') s += v;
      else if (m.localName === 'hueMod') hh *= v; else hh += nu(m, 'val', 0) / 21600000;
      const o = hsl2rgb((hh + 1) % 1, clampN(s, 0, 1), clampN(l, 0, 1)); h = hex2(o[0]) + hex2(o[1]) + hex2(o[2]);
    } else if (m.localName === 'tint') { const c = toRgb(h).map(x => 255 - (255 - x) * v); h = hex2(c[0]) + hex2(c[1]) + hex2(c[2]); }
    else if (m.localName === 'shade') { const c = toRgb(h).map(x => x * v); h = hex2(c[0]) + hex2(c[1]) + hex2(c[2]); }
    else if (m.localName === 'comp' || m.localName === 'inv') { const c = toRgb(h).map(x => 255 - x); h = hex2(c[0]) + hex2(c[1]) + hex2(c[2]); }
    else if (m.localName === 'gray') { const [r, g, b] = toRgb(h), y = .299 * r + .587 * g + .114 * b; h = hex2(y) + hex2(y) + hex2(y); }
  });
  return { h, a };
}
const cssC = (c, mul) => { if (!c) return 'transparent'; const a = clampN(c.a * (mul == null ? 1 : mul), 0, 1); if (a >= .995) return '#' + c.h; const [r, g, b] = toRgb(c.h); return `rgba(${r},${g},${b},${px2(a)})`; };

/* ── fills and lines ── */
function gradOf(g, X) {
  const stops = kids(kid(g, 'gsLst'), 'gs').map(s => ({ p: clampN(nu(s, 'pos', 0) / 1000, 0, 100), c: colour(s, X) })).filter(s => s.c).sort((a, b) => a.p - b.p);
  if (stops.length < 2) return stops.length ? { t: 'solid', c: stops[0].c } : { t: 'none' };
  const lin = kid(g, 'lin'), path = kid(g, 'path'), ftr = path && kid(path, 'fillToRect');
  return { t: 'grad', stops, ang: lin ? nu(lin, 'ang', 0) / 60000 : 90, path: path ? at(path, 'path', 'circle') : null, at: ftr ? [nu(ftr, 'l', 50000) / 1000, nu(ftr, 't', 50000) / 1000] : [50, 50] };
}
/** fill child of spPr / tcPr / bgPr / ln: {t:'none'|'solid'|'grad'|'img'|'patt'} or null when nothing is specified */
/* a:pattFill (hatches, grids, dots) -> a CSS background; the SVG paint falls back to the average colour */
function pattOf(c, X) {
  const fg = colour(kid(c, 'fgClr'), X) || { h: '000000', a: 1 }, bg = colour(kid(c, 'bgClr'), X) || { h: 'ffffff', a: 1 }, p = at(c, 'prst', 'pct50');
  const pct = /^pct(\d+)$/.exec(p), cov = pct ? Number(pct[1]) / 100 : /^(lt|sm|nar)/.test(p) ? .2 : /^(dk|wd|lg)/.test(p) ? .45 : .3;
  const mix = (a, b, t) => { const A = toRgb(a), B = toRgb(b); return A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); };
  const avg = { h: mix(fg.h, bg.h, cov), a: 1 }, F = cssC(fg), B = cssC(bg), n = /^(lt|sm|nar)/.test(p) ? 4 : /^(dk|wd|lg)/.test(p) ? 8 : 6, w = /^(dk|wd)/.test(p) ? 2 : 1;
  let raw;
  if (/Horz|Vert/.test(p)) raw = `repeating-linear-gradient(${/Horz/.test(p) ? 180 : 90}deg,${F} 0 ${w}px,${B} ${w}px ${n}px)`;
  else if (/Diag/.test(p)) raw = `repeating-linear-gradient(${/[Dd]n/.test(p) ? 45 : 135}deg,${F} 0 ${w}px,${B} ${w}px ${n}px)`;
  else if (/Grid/.test(p) && !/^dot/.test(p)) raw = `linear-gradient(${F} ${w}px,transparent ${w}px) 0 0/${n}px ${n}px,linear-gradient(90deg,${F} ${w}px,transparent ${w}px) 0 0/${n}px ${n}px,${B}`;
  else if (/Check/.test(p)) raw = `repeating-conic-gradient(${F} 0 25%,${B} 0 50%) 0 0/${n * 2}px ${n * 2}px`;
  else if (pct || /^dot|Confetti|Sphere/.test(p)) { const r = Math.max(.6, Math.sqrt(cov * n * n / Math.PI)); raw = `radial-gradient(circle,${F} ${px2(r)}px,${B} ${px2(r + .6)}px) 0 0/${n}px ${n}px`; }
  return { t: 'grad', raw, stops: [{ c: avg, p: 0 }, { c: avg, p: 100 }], ang: 90, path: null, at: [50, 50] };
}
function fillOf(pr, X) {
  if (!pr) return null;
  for (const c of kids(pr)) {
    switch (c.localName) {
      case 'noFill': return { t: 'none' };
      case 'solidFill': { const k = colour(c, X); return k ? { t: 'solid', c: k } : { t: 'none' }; }
      case 'gradFill': return gradOf(c, X);
      case 'blipFill': { const b = kid(c, 'blip'), am = b && kid(b, 'alphaModFix'), sr = kid(c, 'srcRect'); return { t: 'img', rid: rattr(b, 'embed'), alpha: am ? nu(am, 'amt', 100000) / 100000 : 1, gray: !!(b && kid(b, 'grayscl')), crop: sr ? [nu(sr, 'l', 0), nu(sr, 't', 0), nu(sr, 'r', 0), nu(sr, 'b', 0)].map(v => v / 100000) : null, tile: !!kid(c, 'tile') }; }
      case 'pattFill': return pattOf(c, X);
      case 'grpFill': return { t: 'inherit' };
      default:
    }
  }
  return null;
}
const DASH = { solid: '', dot: '1 3', sysDot: '1 1', dash: '4 3', sysDash: '3 1', lgDash: '8 3', dashDot: '4 3 1 3', sysDashDot: '3 1 1 1', lgDashDot: '8 3 1 3', lgDashDotDot: '8 3 1 3 1 3', sysDashDotDot: '3 1 1 1 1 1' };
function lineOf(ln, X) {
  if (!ln) return null;
  const f = fillOf(ln, X), w = nu(ln, 'w', null), dash = at(kid(ln, 'prstDash'), 'val', 'solid');
  return { w: w, fill: f, dash, cap: at(ln, 'cap', 'flat'), join: kid(ln, 'round') ? 'round' : kid(ln, 'bevel') ? 'bevel' : 'miter', head: endOf(kid(ln, 'headEnd')), tail: endOf(kid(ln, 'tailEnd')) };
}
const endOf = e => (e && at(e, 'type', 'none') !== 'none' ? { type: at(e, 'type'), w: at(e, 'w', 'med'), l: at(e, 'len', 'med') } : null);
function gradCss(f, k) {
  if (f.raw) return f.raw;
  const stops = f.stops.map(s => `${cssC(s.c)} ${px2(s.p)}%`).join(', ');
  if (f.path) { const circle = f.path === 'circle'; return `radial-gradient(${circle ? 'circle' : 'ellipse'} at ${px2(f.at[0])}% ${px2(f.at[1])}%, ${stops})`; }
  return `linear-gradient(${px2(((f.ang + 90) % 360 + 360) % 360)}deg, ${stops})`;
}

/* ── geometry presets: width/height in px -> css box (radius) or svg paths ── */
const poly = pts => 'M' + pts.map(p => px2(p[0]) + ' ' + px2(p[1])).join('L') + 'Z';
function starPts(n, w, h, inner) {
  const pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? inner : 1, a = -Math.PI / 2 + i * Math.PI / n; pts.push([w / 2 + Math.cos(a) * r * w / 2, h / 2 + Math.sin(a) * r * h / 2]); }
  return poly(pts);
}
function arrowPts(w, h, a1, a2, dir) {   // right arrow, then rotated for the other directions
  const ss = Math.min(w, h), t = h * a1 / 100000, hl = Math.min(ss * a2 / 100000, w), y1 = (h - t) / 2, y2 = (h + t) / 2, xh = w - hl;
  return [[0, y1], [xh, y1], [xh, 0], [w, h / 2], [xh, h], [xh, y2], [0, y2]];
}
function roundedRect(w, h, tl, tr, br, bl) {
  return `M${px2(tl)} 0H${px2(w - tr)}${tr ? `A${px2(tr)} ${px2(tr)} 0 0 1 ${px2(w)} ${px2(tr)}` : ''}V${px2(h - br)}${br ? `A${px2(br)} ${px2(br)} 0 0 1 ${px2(w - br)} ${px2(h)}` : ''}H${px2(bl)}${bl ? `A${px2(bl)} ${px2(bl)} 0 0 1 0 ${px2(h - bl)}` : ''}V${px2(tl)}${tl ? `A${px2(tl)} ${px2(tl)} 0 0 1 ${px2(tl)} 0` : ''}Z`;
}
function snipRect(w, h, tl, tr, br, bl) { return poly([[tl, 0], [w - tr, 0], [w, tr], [w, h - br], [w - br, h], [bl, h], [0, h - bl], [0, tl]]); }
/** returns { css: { radius } } for plain rectangles/rounded rectangles/ellipses, or { paths: [{ d, noFill?, noStroke? }], textInset?: [l,t,r,b] } */
function preset(prst, w, h, av, warn) {
  const ss = Math.min(w, h), a = (n, d) => (av[n] != null ? av[n] : d), f = (n, d) => ss * a(n, d) / 100000;
  switch (prst) {
    case 'rect': case 'flowChartProcess': case 'flowChartAlternateProcess': case 'textBox': case 'frame': case 'flowChartPredefinedProcess': case 'flowChartInternalStorage': return prst === 'flowChartAlternateProcess' ? { css: { radius: ss * .17 } } : prst === 'flowChartPredefinedProcess' ? { paths: [{ d: `M0 0H${w}V${h}H0Z` }, { d: `M${px2(w * .125)} 0V${h}M${px2(w * .875)} 0V${h}`, noFill: true }] } : { css: { radius: 0 } };
    case 'roundRect': return { css: { radius: Math.min(f('adj', 16667), w / 2, h / 2) } };
    case 'flowChartTerminator': return { css: { radius: ss / 2 } };
    case 'ellipse': case 'flowChartConnector': case 'flowChartSummingJunction': case 'flowChartOr': return { css: { radius: 'ellipse' }, textInset: [.1464, .1464, .1464, .1464] };
    case 'round1Rect': { const r = f('adj', 16667); return { paths: [{ d: roundedRect(w, h, 0, r, 0, 0) }] }; }
    case 'round2SameRect': { const r1_ = f('adj1', 16667), r2 = f('adj2', 0); return { paths: [{ d: roundedRect(w, h, r1_, r1_, r2, r2) }] }; }
    case 'round2DiagRect': { const r1_ = f('adj1', 16667), r2 = f('adj2', 0); return { paths: [{ d: roundedRect(w, h, r1_, r2, r1_, r2) }] }; }
    case 'snip1Rect': { const s = f('adj', 16667); return { paths: [{ d: snipRect(w, h, 0, s, 0, 0) }] }; }
    case 'snip2SameRect': { const s1 = f('adj1', 16667), s2 = f('adj2', 0); return { paths: [{ d: snipRect(w, h, s1, s1, s2, s2) }] }; }
    case 'snip2DiagRect': { const s1 = f('adj1', 0), s2 = f('adj2', 16667); return { paths: [{ d: snipRect(w, h, s1, s2, s1, s2) }] }; }
    case 'triangle': return { paths: [{ d: poly([[w * a('adj', 50000) / 100000, 0], [w, h], [0, h]]) }] };
    case 'rtTriangle': return { paths: [{ d: poly([[0, 0], [w, h], [0, h]]) }] };
    case 'parallelogram': case 'flowChartData': { const o = prst === 'flowChartData' ? w * .2 : f('adj', 25000); return { paths: [{ d: poly([[o, 0], [w, 0], [w - o, h], [0, h]]) }] }; }
    case 'trapezoid': { const o = f('adj', 25000); return { paths: [{ d: poly([[o, 0], [w - o, 0], [w, h], [0, h]]) }] }; }
    case 'diamond': case 'flowChartDecision': return { paths: [{ d: poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) }], textInset: [.25, .25, .25, .25] };
    case 'pentagon': case 'flowChartPreparation': return prst === 'pentagon' ? { paths: [{ d: poly([[w / 2, 0], [w, h * .38], [w * .81, h], [w * .19, h], [0, h * .38]]) }] } : { paths: [{ d: poly([[w * .2, 0], [w * .8, 0], [w, h / 2], [w * .8, h], [w * .2, h], [0, h / 2]]) }] };
    case 'hexagon': { const o = f('adj', 25000); return { paths: [{ d: poly([[o, 0], [w - o, 0], [w, h / 2], [w - o, h], [o, h], [0, h / 2]]) }] }; }
    case 'heptagon': return { paths: [{ d: starPts(7, w, h, 1) }] };
    case 'octagon': { const o = f('adj', 29289); return { paths: [{ d: poly([[o, 0], [w - o, 0], [w, o], [w, h - o], [w - o, h], [o, h], [0, h - o], [0, o]]) }] }; }
    case 'decagon': return { paths: [{ d: starPts(10, w, h, 1) }] };
    case 'dodecagon': return { paths: [{ d: starPts(12, w, h, 1) }] };
    case 'star4': return { paths: [{ d: starPts(4, w, h, a('adj', 12500) / 50000) }] };
    case 'star5': return { paths: [{ d: starPts(5, w, h * 1.05, a('adj', 19098) / 50000) }] };
    case 'star6': return { paths: [{ d: starPts(6, w, h, a('adj', 28868) / 50000) }] };
    case 'star7': return { paths: [{ d: starPts(7, w, h, a('adj', 34601) / 50000) }] };
    case 'star8': return { paths: [{ d: starPts(8, w, h, a('adj', 37500) / 50000) }] };
    case 'star10': return { paths: [{ d: starPts(10, w, h, a('adj', 42533) / 50000) }] };
    case 'star12': return { paths: [{ d: starPts(12, w, h, a('adj', 37500) / 50000) }] };
    case 'star16': return { paths: [{ d: starPts(16, w, h, a('adj', 37500) / 50000) }] };
    case 'star24': return { paths: [{ d: starPts(24, w, h, a('adj', 37500) / 50000) }] };
    case 'star32': return { paths: [{ d: starPts(32, w, h, a('adj', 37500) / 50000) }] };
    case 'rightArrow': return { paths: [{ d: poly(arrowPts(w, h, a('adj1', 50000), a('adj2', 50000))) }] };
    case 'leftArrow': return { paths: [{ d: poly(arrowPts(w, h, a('adj1', 50000), a('adj2', 50000)).map(p => [w - p[0], p[1]])) }] };
    case 'downArrow': return { paths: [{ d: poly(arrowPts(h, w, a('adj1', 50000), a('adj2', 50000)).map(p => [p[1], p[0]])) }] };
    case 'upArrow': return { paths: [{ d: poly(arrowPts(h, w, a('adj1', 50000), a('adj2', 50000)).map(p => [p[1], h - p[0]])) }] };
    case 'leftRightArrow': { const t = h * a('adj1', 50000) / 100000, hl = Math.min(ss * a('adj2', 50000) / 100000, w / 2), y1 = (h - t) / 2, y2 = (h + t) / 2; return { paths: [{ d: poly([[0, h / 2], [hl, 0], [hl, y1], [w - hl, y1], [w - hl, 0], [w, h / 2], [w - hl, h], [w - hl, y2], [hl, y2], [hl, h]]) }] }; }
    case 'upDownArrow': { const t = w * a('adj1', 50000) / 100000, hl = Math.min(ss * a('adj2', 50000) / 100000, h / 2), x1 = (w - t) / 2, x2 = (w + t) / 2; return { paths: [{ d: poly([[w / 2, 0], [w, hl], [x2, hl], [x2, h - hl], [w, h - hl], [w / 2, h], [0, h - hl], [x1, h - hl], [x1, hl], [0, hl]]) }] }; }
    case 'chevron': { const o = f('adj', 50000); return { paths: [{ d: poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h], [o, h / 2]]) }] }; }
    case 'homePlate': { const o = f('adj', 50000); return { paths: [{ d: poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h]]) }] }; }
    case 'plus': case 'mathPlus': case 'cross': { const o = prst === 'mathPlus' ? ss * (1 - a('adj1', 23520) / 100000 * 2) / 2 : f('adj', 25000); const x1 = prst === 'mathPlus' ? (w - ss * a('adj1', 23520) / 100000) / 2 : o, y1 = prst === 'mathPlus' ? (h - ss * a('adj1', 23520) / 100000) / 2 : o; return { paths: [{ d: poly([[x1, 0], [w - x1, 0], [w - x1, y1], [w, y1], [w, h - y1], [w - x1, h - y1], [w - x1, h], [x1, h], [x1, h - y1], [0, h - y1], [0, y1], [x1, y1]]) }] }; }
    case 'mathMinus': { const t = h * a('adj1', 23520) / 100000; return { paths: [{ d: poly([[0, (h - t) / 2], [w, (h - t) / 2], [w, (h + t) / 2], [0, (h + t) / 2]]) }] }; }
    case 'donut': { const t = f('adj', 25000), rx = w / 2, ry = h / 2; return { paths: [{ d: `M0 ${ry}A${rx} ${ry} 0 1 0 ${w} ${ry}A${rx} ${ry} 0 1 0 0 ${ry}ZM${t} ${ry}A${rx - t} ${ry - t} 0 1 1 ${w - t} ${ry}A${rx - t} ${ry - t} 0 1 1 ${t} ${ry}Z`, evenodd: true }] }; }
    case 'noSmoking': { const t = f('adj', 18750), rx = w / 2, ry = h / 2; return { paths: [{ d: `M0 ${ry}A${rx} ${ry} 0 1 0 ${w} ${ry}A${rx} ${ry} 0 1 0 0 ${ry}ZM${t} ${ry}A${rx - t} ${ry - t} 0 1 1 ${w - t} ${ry}A${rx - t} ${ry - t} 0 1 1 ${t} ${ry}Z`, evenodd: true }] }; }
    case 'can': case 'flowChartMagneticDisk': { const ry = prst === 'can' ? Math.max(1, f('adj', 25000) / 2) : h * .15, rx = w / 2; return { paths: [{ d: `M0 ${ry}A${rx} ${ry} 0 0 1 ${w} ${ry}V${h - ry}A${rx} ${ry} 0 0 1 0 ${h - ry}Z` }, { d: `M0 ${ry}A${rx} ${ry} 0 0 0 ${w} ${ry}`, noFill: true }] }; }
    case 'cube': { const o = f('adj', 25000); return { paths: [{ d: poly([[0, o], [w - o, o], [w - o, h], [0, h]]) }, { d: poly([[0, o], [o, 0], [w, 0], [w - o, o]]) }, { d: poly([[w - o, o], [w, 0], [w, h - o], [w - o, h]]) }] }; }
    case 'heart': return { paths: [{ d: `M${w / 2} ${h}C${-w * .08} ${h * .55} ${w * .1} ${-h * .1} ${w / 2} ${h * .28}C${w * .9} ${-h * .1} ${w * 1.08} ${h * .55} ${w / 2} ${h}Z` }] };
    case 'lightningBolt': return { paths: [{ d: poly([[.4, 0], [.1, .5], [.38, .5], [.18, 1], [.8, .38], [.5, .38], [.78, 0]].map(p => [p[0] * w, p[1] * h])) }] };
    case 'sun': return { paths: [{ d: starPts(12, w, h, .7) }] };
    case 'moon': return { paths: [{ d: `M${w * .75} 0A${w * .75} ${h / 2} 0 1 0 ${w * .75} ${h}A${w * .5} ${h * .4} 0 1 1 ${w * .75} 0Z` }] };
    case 'cloud': return { paths: [{ d: `M${w * .2} ${h * .78}A${w * .18} ${h * .2} 0 1 1 ${w * .28} ${h * .42}A${w * .22} ${h * .26} 0 0 1 ${w * .55} ${h * .22}A${w * .2} ${h * .22} 0 0 1 ${w * .8} ${h * .36}A${w * .17} ${h * .24} 0 1 1 ${w * .82} ${h * .8}Z` }] };
    case 'smileyFace': return { paths: [{ d: `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z` }, { d: `M${w * .3} ${h * .65}Q${w / 2} ${h * .85} ${w * .7} ${h * .65}`, noFill: true }, { d: `M${w * .33} ${h * .36}h0M${w * .67} ${h * .36}h0`, noFill: true, dots: true }] };
    case 'wedgeRectCallout': case 'wedgeRoundRectCallout': case 'wedgeEllipseCallout': {
      const tx = w / 2 + w * a('adj1', -20833) / 100000, ty = h / 2 + h * a('adj2', 62500) / 100000, dx = tx - w / 2, dy = ty - h / 2, vert = Math.abs(dy) * w >= Math.abs(dx) * h;
      if (prst === 'wedgeEllipseCallout') { const rx = w / 2, ry = h / 2, ang = Math.atan2(dy / ry, dx / rx), s = .35; const p1 = [w / 2 + Math.cos(ang - s) * rx, h / 2 + Math.sin(ang - s) * ry], p2 = [w / 2 + Math.cos(ang + s) * rx, h / 2 + Math.sin(ang + s) * ry]; return { paths: [{ d: `M${px2(p2[0])} ${px2(p2[1])}A${rx} ${ry} 0 1 0 ${px2(p1[0])} ${px2(p1[1])}L${px2(tx)} ${px2(ty)}Z` }] }; }
      const r = prst === 'wedgeRoundRectCallout' ? Math.min(f('adj3', 16667), w / 2, h / 2) : 0, q = Math.min(w, h) * .16, c = vert ? clampN(w / 2 + dx * .3, r + q + 2, w - r - q - 2) : clampN(h / 2 + dy * .3, r + q + 2, h - r - q - 2);
      const top = vert && dy < 0, bot = vert && dy > 0, lef = !vert && dx < 0, rig = !vert && dx > 0, A = (cx, cy) => (r ? `A${px2(r)} ${px2(r)} 0 0 1 ${px2(cx)} ${px2(cy)}` : '');
      let d = `M${px2(r)} 0`; if (top) d += `H${px2(c - q)}L${px2(tx)} ${px2(ty)}L${px2(c + q)} 0`; d += `H${px2(w - r)}${A(w, r)}`; if (rig) d += `V${px2(c - q)}L${px2(tx)} ${px2(ty)}L${w} ${px2(c + q)}`; d += `V${px2(h - r)}${A(w - r, h)}`; if (bot) d += `H${px2(c + q)}L${px2(tx)} ${px2(ty)}L${px2(c - q)} ${h}`; d += `H${px2(r)}${A(0, h - r)}`; if (lef) d += `V${px2(c + q)}L${px2(tx)} ${px2(ty)}L0 ${px2(c - q)}`; d += `V${px2(r)}${A(r, 0)}Z`;
      return { paths: [{ d }] };
    }
    case 'leftBracket': case 'rightBracket': { const o = Math.min(w, h * .1), L = prst === 'leftBracket'; return { paths: [{ d: L ? `M${w} 0Q0 0 0 ${o}V${h - o}Q0 ${h} ${w} ${h}` : `M0 0Q${w} 0 ${w} ${o}V${h - o}Q${w} ${h} 0 ${h}`, noFill: true }] }; }
    case 'leftBrace': case 'rightBrace': { const L = prst === 'leftBrace', m = h / 2, o = Math.min(h * .1, w); return { paths: [{ d: L ? `M${w} 0Q${w / 2} 0 ${w / 2} ${o}V${m - o}Q${w / 2} ${m} 0 ${m}Q${w / 2} ${m} ${w / 2} ${m + o}V${h - o}Q${w / 2} ${h} ${w} ${h}` : `M0 0Q${w / 2} 0 ${w / 2} ${o}V${m - o}Q${w / 2} ${m} ${w} ${m}Q${w / 2} ${m} ${w / 2} ${m + o}V${h - o}Q${w / 2} ${h} 0 ${h}`, noFill: true }] }; }
    case 'arc': { const st = a('adj1', 16200000) / 60000, sw = a('adj2', 0) / 60000, rx = w / 2, ry = h / 2, p = deg => [w / 2 + rx * Math.cos(deg * Math.PI / 180), h / 2 + ry * Math.sin(deg * Math.PI / 180)], s0 = p(st), e0 = p(sw); return { paths: [{ d: `M${px2(s0[0])} ${px2(s0[1])}A${rx} ${ry} 0 ${((sw - st + 360) % 360) > 180 ? 1 : 0} 1 ${px2(e0[0])} ${px2(e0[1])}`, noFill: true }] }; }
    case 'pie': case 'chord': case 'blockArc': { const st = a('adj1', 0) / 60000, en = a('adj2', 16200000) / 60000, rx = w / 2, ry = h / 2, p = deg => [w / 2 + rx * Math.cos(deg * Math.PI / 180), h / 2 + ry * Math.sin(deg * Math.PI / 180)], s0 = p(st), e0 = p(en), large = ((en - st + 360) % 360) > 180 ? 1 : 0; return { paths: [{ d: `M${px2(s0[0])} ${px2(s0[1])}A${rx} ${ry} 0 ${large} 1 ${px2(e0[0])} ${px2(e0[1])}${prst === 'chord' ? '' : `L${w / 2} ${h / 2}`}Z` }] }; }
    default: warn('The shape "' + prst + '" is drawn as a rectangle.'); return { css: { radius: 0 } };
  }
}
/** connector/line presets -> path in a w x h box (start top-left, end bottom-right; flips are applied by the caller) */
function linePath(prst, w, h, av) {
  const a = (n, d) => (av[n] != null ? av[n] : d) / 100000;
  switch (prst) {
    case 'bentConnector2': return `M0 0H${w}V${h}`;
    case 'bentConnector3': { const x = w * a('adj1', 50000); return `M0 0H${px2(x)}V${h}H${w}`; }
    case 'bentConnector4': { const x = w * a('adj1', 50000), y = h * a('adj2', 50000); return `M0 0H${px2(x)}V${px2(y)}H${w}V${h}`; }
    case 'bentConnector5': { const x1 = w * a('adj1', 25000), y = h * a('adj2', 50000), x3 = w * a('adj3', 75000); return `M0 0H${px2(x1)}V${px2(y)}H${px2(x3)}V${h}H${w}`; }
    case 'curvedConnector2': return `M0 0C${w / 2} 0 ${w} ${h / 2} ${w} ${h}`;
    case 'curvedConnector3': case 'curvedConnector4': case 'curvedConnector5': { const x = w * a('adj1', 50000); return `M0 0C${px2(x / 2)} 0 ${px2(x)} ${px2(h / 4)} ${px2(x)} ${px2(h / 2)}S${px2((w + x) / 2)} ${h} ${w} ${h}`; }
    default: return `M0 0L${w} ${h}`;
  }
}
/** custom geometry (a:custGeom) -> svg path data scaled to the shape box */
function custPaths(cg, w, h) {
  const out = [];
  kids(kid(cg, 'pathLst'), 'path').forEach(p => {
    const pw = nu(p, 'w', 0) || w, ph = nu(p, 'h', 0) || h, sx = w / pw, sy = h / ph; let d = '', cur = [0, 0], start = [0, 0];
    const pt = n => { const x = nu(n, 'x', 0) * sx, y = nu(n, 'y', 0) * sy; return [x, y]; }, S = q => px2(q[0]) + ' ' + px2(q[1]);
    kids(p).forEach(c => {
      const pts = kids(c, 'pt').map(pt);
      switch (c.localName) {
        case 'moveTo': if (pts[0]) { d += 'M' + S(pts[0]); cur = start = pts[0]; } break;
        case 'lnTo': if (pts[0]) { d += 'L' + S(pts[0]); cur = pts[0]; } break;
        case 'cubicBezTo': if (pts.length === 3) { d += 'C' + pts.map(S).join(' '); cur = pts[2]; } break;
        case 'quadBezTo': if (pts.length === 2) { d += 'Q' + pts.map(S).join(' '); cur = pts[1]; } break;
        case 'arcTo': {
          const wR = nu(c, 'wR', 0) * sx, hR = nu(c, 'hR', 0) * sy, st = nu(c, 'stAng', 0) / 60000 * Math.PI / 180, sw = nu(c, 'swAng', 0) / 60000 * Math.PI / 180; if (!wR || !hR) break;
          const par = t => Math.atan2(Math.sin(t) * wR, Math.cos(t) * hR), t0 = par(st), t1 = par(st + sw), cx = cur[0] - wR * Math.cos(t0), cy = cur[1] - hR * Math.sin(t0), ex = cx + wR * Math.cos(t1), ey = cy + hR * Math.sin(t1);
          d += `A${px2(wR)} ${px2(hR)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${px2(ex)} ${px2(ey)}`; cur = [ex, ey]; break;
        }
        case 'close': d += 'Z'; cur = start; break;
        default:
      }
    });
    if (d) out.push({ d, noFill: at(p, 'fill', 'norm') === 'none', noStroke: at(p, 'stroke', '1') === '0' || at(p, 'stroke') === 'false' });
  });
  return out;
}

/* ── fonts ── */
const MONO = /mono|courier|consol|menlo|code/i, SERIF = /georgia|times|garamond|serif|palatino|cambria|book|baskerville|didot|playfair|lora|merriweather/i;
function familyCss(face, X) {
  face = String(face || '').trim(); if (/^\+mj/.test(face)) face = X.fonts.major; else if (/^\+mn/.test(face)) face = X.fonts.minor;
  if (!face || /^\+/.test(face)) face = X.fonts.minor || 'Calibri';
  const clean = PC.cleanFont(face); if (!clean) return `Arial, sans-serif`; X.fontsUsed.add(face);
  const nm = clean.replace(/["'\\]/g, ''); return `'${nm}', ${MONO.test(nm) ? 'monospace' : SERIF.test(nm) ? 'serif' : 'sans-serif'}`;
}

/* ── text ── */
const BU_MAP = { w: { '§': '▪', 'Ø': '➢', 'ü': '✓', 'q': '❑', 'l': '●', 'n': '■', 'v': '❖', 'à': '➔', 'ý': '☒', 'þ': '☑', '': '•', 'o': '○', 'p': '□', '¡': '○' }, s: { '·': '•', '§': '♣', '¨': '♦', 'Ø': '∅' } };
const NUM_STYLE = { arabicPeriod: 'decimal', arabicParenR: 'decimal', arabicParenBoth: 'decimal', arabicPlain: 'decimal', romanLcPeriod: 'lower-roman', romanUcPeriod: 'upper-roman', alphaLcPeriod: 'lower-alpha', alphaUcPeriod: 'upper-alpha', alphaLcParenR: 'lower-alpha', alphaUcParenR: 'upper-alpha' };
const lvlNode = (lst, l) => (lst ? kid(lst, 'lvl' + (l + 1) + 'pPr') : null);
/** first value found, from the most specific list style to the least */
function pick(chain, l, get) { for (let i = chain.length - 1; i >= 0; i--) { const n = chain[i]; if (!n) continue; if (n.syn) { const v = get(n.syn, true); if (v !== undefined) return v; continue; } const v = get(lvlNode(n, l), false); if (v !== undefined) return v; } return undefined; }
const defR = lv => (lv ? kid(lv, 'defRPr') : null);
const attrOf = (name, cv) => (lv, syn) => { if (syn) return undefined; const d = defR(lv); if (d && d.hasAttribute(name)) return cv ? cv(d.getAttribute(name)) : d.getAttribute(name); return undefined; };

function runStyle(rPr, pPr, chain, l, X, scale) {
  const g = (name, cv) => { if (rPr && rPr.hasAttribute(name)) return cv ? cv(rPr.getAttribute(name)) : rPr.getAttribute(name); return pick(chain, l, attrOf(name, cv)); };
  const sz = g('sz', Number) || 1800, s = {};
  s.size = sz / 75 * X.k * scale; s.b = g('b') === '1' || g('b') === 'true'; s.i = g('i') === '1' || g('i') === 'true'; s.u = (g('u') || 'none') !== 'none'; s.strike = (g('strike') || 'noStrike') !== 'noStrike';
  s.cap = g('cap') || 'none'; s.spc = (Number(g('spc')) || 0) / 75 * X.k; s.base = Number(g('baseline')) || 0;
  let col = null, face = null, hl = null;
  const own = n => { if (!n) return; const f = kid(n, 'solidFill'); if (f && !col) col = colour(f, X); const lt = kid(n, 'latin'); if (lt && !face) face = at(lt, 'typeface'); const h = kid(n, 'highlight'); if (h && !hl) hl = colour(h, X); };
  own(rPr);
  for (let i = chain.length - 1; i >= 0 && (!col || !face || !hl); i--) { const n = chain[i]; if (!n) continue; if (n.syn) { if (!col && n.syn.color) col = n.syn.color; continue; } own(defR(lvlNode(n, l))); }
  s.color = col || X.defaultText; s.face = face; s.hl = hl; return s;
}
const styleCss = (s, X) => {
  const o = [`font-size:${px2(s.size)}px`, `color:${cssC(s.color)}`, `font-family:${familyCss(s.face, X)}`];
  if (s.b) o.push('font-weight:700'); if (s.i) o.push('font-style:italic');
  if (s.u || s.strike) o.push('text-decoration:' + [s.u ? 'underline' : '', s.strike ? 'line-through' : ''].filter(Boolean).join(' '));
  if (s.cap === 'all') o.push('text-transform:uppercase'); else if (s.cap === 'small') o.push('font-variant:small-caps');
  if (s.spc) o.push(`letter-spacing:${px2(s.spc)}px`); if (s.base) o.push(`vertical-align:${s.base > 0 ? 'super' : 'sub'};font-size:${px2(s.size * .66)}px`);
  if (s.hl) o.push(`background:${cssC(s.hl)}`);
  return o;
};
const sameStyle = (a, b) => a.size === b.size && a.b === b.b && a.i === b.i && a.u === b.u && a.strike === b.strike && a.cap === b.cap && a.spc === b.spc && a.base === b.base && a.color.h === b.color.h && a.color.a === b.color.a && a.face === b.face && String(a.hl && a.hl.h) === String(b.hl && b.hl.h);
const textHtml = t => esc(t).replace(/ {2,}/g, m => ' ' + '&nbsp;'.repeat(m.length - 1)).replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/^ /, '&nbsp;');

/** a:txBody -> { html, text, first }.  chain = list styles from least to most specific; fs = font scale (normAutofit). */
function paragraphs(tx, chain, X, o) {
  const out = [], plain = []; let first = true;
  const scale = o.fontScale || 1, lnRed = o.lnSpcReduction || 0;
  kids(tx, 'p').forEach(p => {
    const pPr = kid(p, 'pPr'), l = clampN(nu(pPr, 'lvl', 0), 0, 8);
    const pg = (n, cv) => { if (pPr && pPr.hasAttribute(n)) return cv ? cv(pPr.getAttribute(n)) : pPr.getAttribute(n); return pick(chain, l, (lv, syn) => (syn || !lv || !lv.hasAttribute(n) ? undefined : cv ? cv(lv.getAttribute(n)) : lv.getAttribute(n))); };
    const sub = n => { const a = pPr && kid(pPr, n); if (a) return a; return pick(chain, l, (lv, syn) => (syn || !lv ? undefined : kid(lv, n) || undefined)) || null; };
    const algn = pg('algn') || 'l', marL = (Number(pg('marL')) || 0) / 9525 * X.k, indent = (Number(pg('indent')) || 0) / 9525 * X.k;
    // runs
    const runs = [];
    kids(p).forEach(c => {
      if (c.localName === 'r' || c.localName === 'fld') { const t = kid(c, 't'); if (!t) return; const st = runStyle(kid(c, 'rPr'), pPr, chain, l, X, scale); runs.push({ t: t.textContent, st, link: !!(kid(kid(c, 'rPr'), 'hlinkClick')) }); }
      else if (c.localName === 'br') runs.push({ br: true, st: runStyle(kid(c, 'rPr'), pPr, chain, l, X, scale) });
    });
    const endSt = runStyle(kid(p, 'endParaRPr'), pPr, chain, l, X, scale), baseSt = (runs.find(r => !r.br && /\S/.test(r.t)) || runs[0] || { st: endSt }).st;
    const lead = runs.find(r => !r.br) ? runs.find(r => !r.br).st : baseSt;
    // bullets: the nearest buNone / buChar / buAutoNum wins (paragraph, then list styles from the most specific)
    const BU = ['buNone', 'buChar', 'buAutoNum'], buIn = n => (n ? BU.map(b => kid(n, b)).find(Boolean) : null);
    let buNode = buIn(pPr); for (let i = chain.length - 1; i >= 0 && !buNode; i--) if (chain[i] && !chain[i].syn) buNode = buIn(lvlNode(chain[i], l));
    let bu = null;
    if (buNode && buNode.localName === 'buChar') { let ch = at(buNode, 'char', '•'); const bf = sub('buFont'), font = bf ? at(bf, 'typeface', '') : ''; const m = /wingdings/i.test(font) ? BU_MAP.w : /symbol/i.test(font) ? BU_MAP.s : null; ch = m && m[ch] ? m[ch] : ch; bu = { t: 'char', ch: ch.slice(0, 2) }; }
    else if (buNode && buNode.localName === 'buAutoNum') bu = { t: 'num', st: NUM_STYLE[at(buNode, 'type', 'arabicPeriod')] || 'decimal', start: nu(buNode, 'startAt', 1) };
    const buClr = sub('buClr') ? colour(sub('buClr'), X) : null;
    // spacing
    const spc = n => { const e = sub(n); if (!e) return null; const pts = kid(e, 'spcPts'), pc = kid(e, 'spcPct'); return pts ? { px: nu(pts, 'val', 0) / 75 * X.k } : pc ? { pct: nu(pc, 'val', 0) / 100000 } : null; };
    const ln = spc('lnSpc'), sb = spc('spcBef'), sa = spc('spcAft'), fsz = lead.size;
    const css = [];
    css.push(`text-align:${{ l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify', justLow: 'justify' }[algn] || 'left'}`);
    if (ln) css.push(ln.px != null ? `line-height:${px2(ln.px)}px` : `line-height:${px2(Math.max(.5, ln.pct - lnRed / 100000) * 1.2)}`); else css.push(`line-height:${px2(Math.max(.6, 1 - lnRed / 100000) * 1.2)}`);
    const mt = sb ? (sb.px != null ? sb.px : sb.pct * fsz * 1.2) : 0, mb = sa ? (sa.px != null ? sa.px : sa.pct * fsz * 1.2) : 0;
    if (mt && !first) css.push(`margin-top:${px2(mt)}px`); if (mb) css.push(`margin-bottom:${px2(mb)}px`);
    if (bu) { css.push('display:list-item'); css.push('list-style-position:outside'); const ls = bu.t === 'num' ? bu.st : `'${bu.ch.replace(/["'\\<>&]/g, '') } '`; css.push(`list-style-type:${ls}`); if (bu.t === 'num' && bu.start > 1) css.push(`counter-set:list-item ${bu.start - 1}`); }
    const ml = marL; if (ml) css.push(`margin-left:${px2(ml)}px`); if (indent && !bu) css.push(`text-indent:${px2(indent)}px`);
    // the paragraph carries the style of its first text run; other runs only add what differs
    const baseCss = styleCss(baseSt, X);
    let inner = '', text = '';
    runs.forEach(r => {
      if (r.br) { inner += '<br>'; text += '\n'; return; }
      const diff = sameStyle(r.st, baseSt) ? [] : styleCss(r.st, X).filter(d => !baseCss.includes(d));
      const t = textHtml(r.t); text += r.t; inner += diff.length ? `<span style="${diff.join(';')}">${t}</span>` : t;
    });
    const marker = bu && buClr ? `;--mk:${cssC(buClr)}` : '';
    if (!runs.length || !/\S/.test(text)) { out.push(`<p style="${css.join(';')};${styleCss(endSt, X).slice(0, 1).join(';')};min-height:1em">${inner || '<br>'}</p>`); plain.push(''); first = false; return; }
    out.push(`<p${bu ? ' class="bu"' : ''} style="${css.join(';')};${baseCss.join(';')}${marker}">${inner}</p>`);
    plain.push(text); first = false;
  });
  return { html: out.join('\n'), text: plain.join('\n').trim(), count: out.length };
}

/* ── pictures ── */
const mimeOf = n => (/\.(png)$/i.test(n) ? 'image/png' : /\.(jpe?g)$/i.test(n) ? 'image/jpeg' : /\.gif$/i.test(n) ? 'image/gif' : /\.webp$/i.test(n) ? 'image/webp' : /\.bmp$/i.test(n) ? 'image/bmp' : /\.svg$/i.test(n) ? 'image/svg+xml' : '');
async function encodeImage(bytes, mime, maxW, maxH, quality) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime })), k = Math.min(1, maxW / bmp.width, maxH / bmp.height, 1600 / Math.max(bmp.width, bmp.height)), W = Math.max(1, Math.round(bmp.width * k)), H = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, W, H); bmp.close && bmp.close();
  // transparent pixels need a format with alpha; opaque photos are much smaller as JPEG
  let alpha = false; if (mime !== 'image/jpeg') { const d = g.getImageData(0, 0, Math.min(W, 64), Math.min(H, 64)).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { alpha = true; break; } if (!alpha && W * H > 4096) { const d2 = g.getImageData(0, 0, W, H).data; for (let i = 3; i < d2.length; i += 4 * 7) if (d2[i] < 250) { alpha = true; break; } } }
  const blob = await new Promise(r => cv.toBlob(r, alpha ? 'image/webp' : 'image/jpeg', quality)); if (!blob) return null;
  const uri = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
  return /^data:image\/(webp|jpeg|png);base64,/.test(uri) ? { uri, w: W, h: H, alpha } : null;
}
class Pics {
  constructor(zip) { this.zip = zip; this.items = new Map(); this.n = 0; }
  /** note that a part is wanted at about w x h pixels; returns the css class that will carry it */
  want(part, w, h, slide) { let it = this.items.get(part); if (!it) { it = { part, id: ++this.n, w: 0, h: 0, slides: new Set() }; this.items.set(part, it); } it.w = Math.max(it.w, w); it.h = Math.max(it.h, h); it.slides.add(slide); return 'pcim' + it.id; }
  async build(budgetPerSlide, warn, report) {
    const res = new Map();
    for (const it of this.items.values()) {
      const raw = await this.zip.bytes(it.part), mime = mimeOf(it.part);
      if (!raw || !mime || mime === 'image/svg+xml' || mime === 'image/bmp') { warn(`A picture (${it.part.split('/').pop()}) is in a format that cannot be imported and was left out.`); continue; }
      const mw = Math.max(16, it.w * 1.5), mh = Math.max(16, it.h * 1.5);
      try { let q = .82, out = await encodeImage(raw, mime, mw, mh, q), sc = 1; while (out && out.uri.length > budgetPerSlide * .6 && sc > .2) { sc *= .7; q = Math.max(.5, q - .08); out = await encodeImage(raw, mime, mw * sc, mh * sc, q); } if (out) { res.set(it.id, out.uri); report.pictures++; } else warn('A picture could not be decoded and was left out.'); }
      catch (e) { warn(`A picture (${it.part.split('/').pop()}) could not be decoded and was left out.`); }
    }
    return res;
  }
}

/* ── the slide ── */
class Ctx {
  constructor(o) { Object.assign(this, o); }
  scheme(v) {
    const m = this.clrMap || {}, t = this.theme.colors, name = m[v] || v;
    return t[name] || t[{ tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' }[name]] || (name === 'phClr' ? '808080' : '000000');
  }
}
const PH_KIND = t => ({ ctrTitle: 'title', title: 'title', subTitle: 'body', body: 'body', obj: 'body', chart: 'body', tbl: 'body', dgm: 'body', media: 'body', clipArt: 'body', pic: 'body', dt: 'dt', ftr: 'ftr', sldNum: 'sldNum' }[t] || 'body');
function phOf(sp) { const nv = kid(sp, 'nvSpPr') || kid(sp, 'nvPicPr') || kid(sp, 'nvGraphicFramePr') || kid(sp, 'nvCxnSpPr'), ph = nv && kid(nv, 'nvPr', 'ph'); return ph ? { type: at(ph, 'type', 'body'), idx: at(ph, 'idx', ''), orient: at(ph, 'orient', '') } : null; }
function findPh(list, ph, byIdx) {
  if (!ph) return null;
  if (byIdx && ph.idx !== '') { const m = list.find(x => x.ph.idx === ph.idx); if (m) return m; }
  return list.find(x => x.ph.type === ph.type) || list.find(x => PH_KIND(x.ph.type) === PH_KIND(ph.type)) || null;
}
const spPrOf = n => kid(n, 'spPr');
function xfrmOf(chainNodes) {
  for (const n of chainNodes) { if (!n) continue; const sp = spPrOf(n) || kid(n, 'grpSpPr') || n, x = kid(sp, 'xfrm') || (n.localName === 'graphicFrame' ? kid(n, 'xfrm') : null); if (x) { const off = kid(x, 'off'), ext = kid(x, 'ext'); if (off && ext) return { x: nu(off, 'x', 0), y: nu(off, 'y', 0), w: nu(ext, 'cx', 0), h: nu(ext, 'cy', 0), rot: nu(x, 'rot', 0) / 60000, fh: at(x, 'flipH') === '1', fv: at(x, 'flipV') === '1', chOff: kid(x, 'chOff') ? [nu(kid(x, 'chOff'), 'x', 0), nu(kid(x, 'chOff'), 'y', 0)] : null, chExt: kid(x, 'chExt') ? [nu(kid(x, 'chExt'), 'cx', 0), nu(kid(x, 'chExt'), 'cy', 0)] : null }; } }
  return null;
}

class SlideBuilder {
  constructor(X, pics, slideNo) { this.X = X; this.pics = pics; this.no = slideNo; this.out = []; this.css = []; this.warn = []; this.count = 0; this.title = ''; this.firstText = ''; this.imgCss = new Map(); this.depth = 0; }
  note(w) { if (!this.warn.includes(w)) this.warn.push(w); }
  px(v) { return v / 9525 * this.X.k; }
  box(f) { return { x: this.X.ox + f.x / 9525 * this.X.k, y: this.X.oy + f.y / 9525 * this.X.k, w: f.w / 9525 * this.X.k, h: f.h / 9525 * this.X.k }; }
  imgClass(rid, rels, w, h, crop) { const part = rels[rid] && rels[rid].part; if (!part) return null; const cw = crop ? 1 - crop[0] - crop[2] : 1, ch = crop ? 1 - crop[1] - crop[3] : 1; return this.pics.want(part, w / Math.max(.1, cw), h / Math.max(.1, ch), this.no); }
  /** background css for an image fill, with crop as size/position */
  imgBg(cls, crop, tile) {
    let size = '100% 100%', pos = '0 0';
    if (crop) { const cw = Math.max(.05, 1 - crop[0] - crop[2]), ch = Math.max(.05, 1 - crop[1] - crop[3]); size = `${px2(100 / cw)}% ${px2(100 / ch)}%`; pos = `${crop[0] + crop[2] > 0 ? px2(crop[0] / (crop[0] + crop[2]) * 100) : 0}% ${crop[1] + crop[3] > 0 ? px2(crop[1] / (crop[1] + crop[3]) * 100) : 0}%`; }
    if (tile) size = 'auto';
    return { cls, size, pos, repeat: tile ? 'repeat' : 'no-repeat' };
  }
}

/* style-matrix fills/lines referenced by p:style (fillRef / lnRef) */
function styleFill(X, ref) {
  const idx = nu(ref, 'idx', 0); if (!idx) return null; const c = colour(ref, X), lst = idx >= 1001 ? X.theme.bgFills : X.theme.fills, e = lst[idx >= 1001 ? idx - 1001 : idx - 1];
  if (!e) return c ? { t: 'solid', c } : null; const Y = Object.assign(Object.create(X), { ph: c ? c.h : null });
  return fillOf(wrapKids([e]), Y) || (c ? { t: 'solid', c } : null);
}
const wrapKids = list => ({ children: list });
function styleLine(X, ref) { const idx = nu(ref, 'idx', 0); if (!idx) return null; const c = colour(ref, X), e = X.theme.lines[idx - 1]; if (!e) return null; const Y = Object.assign(Object.create(X), { ph: c ? c.h : null }); const l = lineOf(e, Y); if (l && c && (!l.fill || l.fill.t === 'inherit')) l.fill = { t: 'solid', c }; return l; }

/* ── building shapes ── */
const SVGNS = 'xmlns="http://www.w3.org/2000/svg"';
let svgSeq = 0;
function svgPaint(f, defs, w, h) {
  if (!f || f.t === 'none' || f.t === 'inherit') return 'none';
  if (f.t === 'solid') return cssC(f.c);
  if (f.t === 'grad') {
    const id = 'g' + (++svgSeq), st = f.stops.map(s => `<stop offset="${px2(s.p)}%" stop-color="#${s.c.h}" stop-opacity="${px2(s.c.a)}"/>`).join('');
    if (f.path) defs.push(`<radialGradient id="${id}" cx="${px2(f.at[0])}%" cy="${px2(f.at[1])}%" r="75%">${st}</radialGradient>`);
    else { const a = (f.ang) * Math.PI / 180, dx = Math.cos(a) / 2, dy = Math.sin(a) / 2; defs.push(`<linearGradient id="${id}" x1="${px2(50 - dx * 100)}%" y1="${px2(50 - dy * 100)}%" x2="${px2(50 + dx * 100)}%" y2="${px2(50 + dy * 100)}%">${st}</linearGradient>`); }
    return `url(#${id})`;
  }
  return '#cccccc';
}
function markerDef(id, end, color, sw) {
  const sz = { sm: 2, med: 3, lg: 5 }, wf = sz[end.w] || 3, lf = sz[end.l] || 3, M = Math.max(sw, 1.5);
  const shape = { triangle: '<path d="M0 0L10 5L0 10Z"/>', stealth: '<path d="M0 0L10 5L0 10L3 5Z"/>', arrow: '<path d="M0 0L10 5L0 10" fill="none" stroke-width="1.6" stroke-linejoin="miter"/>', oval: '<circle cx="5" cy="5" r="5"/>', diamond: '<path d="M5 0L10 5L5 10L0 5Z"/>' }[end.type] || '<path d="M0 0L10 5L0 10Z"/>';
  return `<marker id="${id}" viewBox="0 0 10 10" refX="${end.type === 'arrow' ? 8 : end.type === 'oval' || end.type === 'diamond' ? 5 : 9}" refY="5" markerUnits="userSpaceOnUse" markerWidth="${px2(M * lf)}" markerHeight="${px2(M * wf)}" orient="auto-start-reverse" style="fill:${color};stroke:${color};overflow:visible">${shape}</marker>`;
}
const lineWidthPx = (l, S, dflt) => ((l && l.w != null ? l.w : dflt) / 9525 * S.X.k);

async function buildShapes(parent, S, rels, chain, opts) {
  const X = S.X;
  for (const n of kids(parent)) {
    if (S.count >= LIM.shapes) { S.note('This slide has more than ' + LIM.shapes + ' shapes; the rest were left out.'); return; }
    const nm = n.localName; let node = n;
    if (nm === 'AlternateContent') { const fb = kid(n, 'Fallback') || kid(n, 'Choice'); if (!fb) continue; await buildShapes(fb, S, rels, chain, opts); continue; }
    const cNv = nm === 'sp' ? kid(n, 'nvSpPr', 'cNvPr') : nm === 'pic' ? kid(n, 'nvPicPr', 'cNvPr') : nm === 'cxnSp' ? kid(n, 'nvCxnSpPr', 'cNvPr') : nm === 'grpSp' ? kid(n, 'nvGrpSpPr', 'cNvPr') : nm === 'graphicFrame' ? kid(n, 'nvGraphicFramePr', 'cNvPr') : null;
    if (!cNv && !/^(sp|pic|cxnSp|grpSp|graphicFrame)$/.test(nm)) continue;
    if (at(cNv, 'hidden') === '1') continue;
    if (nm === 'grpSp') { await groupShapes(n, S, rels, chain, opts); continue; }
    if (nm === 'sp') await spShape(n, S, rels, opts, cNv);
    else if (nm === 'pic') await picShape(n, S, rels, opts, cNv);
    else if (nm === 'cxnSp') await spShape(n, S, rels, opts, cNv, true);
    else if (nm === 'graphicFrame') await frameShape(n, S, rels, opts, cNv);
  }
}
async function groupShapes(g, S, rels, chain, opts) {
  if (opts.depth > LIM.depth) return;
  const x = xfrmOf([g]); if (!x) return;
  const sx = x.chExt && x.chExt[0] ? x.w / x.chExt[0] : 1, sy = x.chExt && x.chExt[1] ? x.h / x.chExt[1] : 1, cox = x.chOff ? x.chOff[0] : x.x, coy = x.chOff ? x.chOff[1] : x.y;
  const parent = opts.m, th = x.rot * Math.PI / 180, gx = x.x + x.w / 2, gy = x.y + x.h / 2;
  // child coordinates -> the group's frame -> (a rotated group turns its members about its centre) -> the parent
  const map = (px, py) => {
    let qx = x.x + (px - cox) * sx, qy = x.y + (py - coy) * sy;
    if (x.rot) { const dx = qx - gx, dy = qy - gy; qx = gx + dx * Math.cos(th) - dy * Math.sin(th); qy = gy + dx * Math.sin(th) + dy * Math.cos(th); }
    return parent.map(qx, qy);
  };
  await buildShapes(g, S, rels, chain, Object.assign({}, opts, { depth: opts.depth + 1, m: { map, sx: parent.sx * sx, sy: parent.sy * sy, rot: parent.rot + x.rot } }));
}
const IDM = { map: (x, y) => [x, y], sx: 1, sy: 1, rot: 0 };

/** frame of a shape in slide px, with the group matrix applied */
function frameOf(x, S, opts) {
  const m = opts.m, [x0, y0] = m.map(x.x, x.y), w = x.w * m.sx, h = x.h * m.sy;
  const cx = m.map(x.x + x.w / 2, x.y + x.h / 2); const b = S.box({ x: cx[0] - w / 2, y: cx[1] - h / 2, w, h });
  return Object.assign(b, { rot: x.rot + m.rot, fh: x.fh, fv: x.fv });
}
const posCss = (b, extra) => `left:${px2(b.x)}px;top:${px2(b.y)}px;width:${px2(b.w)}px;height:${px2(b.h)}px${b.rot ? `;transform:rotate(${px2(b.rot)}deg)` : ''}${extra ? ';' + extra : ''}`;
const shadowOf = (eff, X, k) => {
  const sh = eff && kid(eff, 'outerShdw'); if (!sh) return null;
  const c = colour(sh, X) || { h: '000000', a: .4 }, dist = nu(sh, 'dist', 0) / 9525 * k, dir = nu(sh, 'dir', 0) / 60000 * Math.PI / 180, blur = nu(sh, 'blurRad', 0) / 9525 * k;
  return { dx: Math.cos(dir) * dist, dy: Math.sin(dir) * dist, blur, c };
};

async function spShape(n, S, rels, opts, cNv, isCxn) {
  const X = S.X, ph = isCxn ? null : phOf(n);
  const layoutPh = ph ? findPh(opts.layoutPhs || [], ph, true) : null, masterPh = ph ? findPh(opts.masterPhs || [], ph, false) : null;
  const nodes = [n, layoutPh && layoutPh.node, masterPh && masterPh.node];
  const x = xfrmOf(nodes); if (!x) return;
  const b = frameOf(x, S, opts), sp = spPrOf(n), name = at(cNv, 'name', 'Shape');
  const geomNode = nodes.map(q => q && spPrOf(q)).map(q => q && (kid(q, 'prstGeom') || kid(q, 'custGeom'))).find(Boolean);
  const prst = geomNode && geomNode.localName === 'prstGeom' ? at(geomNode, 'prst', 'rect') : geomNode ? 'custom' : (isCxn ? 'line' : 'rect');
  const av = {}; if (geomNode && geomNode.localName === 'prstGeom') kids(kid(geomNode, 'avLst'), 'gd').forEach(g => { const m = /val\s+(-?\d+)/.exec(at(g, 'fmla', '')); if (m) av[at(g, 'name')] = Number(m[1]); });
  const style = kid(n, 'style');
  const specFill = nodes.map(q => q && fillOf(spPrOf(q), X)).find(f => f && f.t !== 'inherit') || null;
  const fill = specFill || (style ? styleFill(X, kid(style, 'fillRef')) : null);
  const lnNode = nodes.map(q => q && kid(spPrOf(q), 'ln')).find(Boolean) || null;
  let line = lnNode ? lineOf(lnNode, X) : null;
  const sline = style ? styleLine(X, kid(style, 'lnRef')) : null;
  if (sline) { if (!line) line = sline; else { if (line.w == null) line.w = sline.w; if (!line.fill) line.fill = sline.fill; if (!kid(lnNode, 'prstDash')) line.dash = sline.dash; } }
  const lineOn = line && line.fill && line.fill.t !== 'none' && line.fill.t !== 'inherit';
  const effect = shadowOf(nodes.map(q => q && kid(spPrOf(q), 'effectLst')).find(Boolean), X, X.k);
  S.count++;
  const label = `<!-- ${esc(name).replace(/--+/g, '-')} -->`;
  const isLine = isCxn || /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(prst);
  const hasText = !isCxn && kid(n, 'txBody');
  // text
  let textHtml_ = '', textInfo = null, bodyPr = null;
  if (hasText) {
    const tb = kid(n, 'txBody'), lst = [tb && kid(tb, 'lstStyle'), layoutPh && kid(layoutPh.node, 'txBody', 'lstStyle'), masterPh && kid(masterPh.node, 'txBody', 'lstStyle')];
    const kind = ph ? PH_KIND(ph.type) : 'other';
    const tx = X.txStyles, base = [X.defaultStyle, kind === 'title' ? tx.title : kind === 'body' ? tx.body : tx.other, lst[2], lst[1], lst[0]];
    const fr = style && kid(style, 'fontRef'); const synthetic = fr && !ph ? colour(fr, X) : null;
    const chain = synthetic ? base.slice(0, 1).concat([{ syn: { color: synthetic } }], base.slice(1)) : base;
    bodyPr = [kid(tb, 'bodyPr'), layoutPh && kid(layoutPh.node, 'txBody', 'bodyPr'), masterPh && kid(masterPh.node, 'txBody', 'bodyPr')];
    const bp = a => { for (const q of bodyPr) if (q && q.hasAttribute(a)) return q.getAttribute(a); return null; };
    const af = bodyPr.map(q => q && kid(q, 'normAutofit')).find(Boolean);
    const par = paragraphs(tb, chain, X, { fontScale: af ? nu(af, 'fontScale', 100000) / 100000 : 1, lnSpcReduction: af ? nu(af, 'lnSpcReduction', 0) : 0 });
    textInfo = { par, bp, wrap: bp('wrap') !== 'none', anchor: bp('anchor') || 't', anchorCtr: bp('anchorCtr') === '1', vert: bp('vert') || 'horz', ins: ['lIns', 'tIns', 'rIns', 'bIns'].map((a, i) => (bp(a) != null ? Number(bp(a)) : [91440, 45720, 91440, 45720][i]) / 9525 * X.k) };
    if (ph && (ph.type === 'title' || ph.type === 'ctrTitle') && par.text && !S.title) S.title = par.text.split('\n')[0];
    if (par.text && !S.firstText) S.firstText = par.text.split('\n')[0];
  }
  const empty = !textInfo || !textInfo.par.text;
  // decide drawing
  if (isLine) {
    const sw = Math.max(.5, lineWidthPx(line, S, 12700)), pad = sw * 4 + 4, w = Math.max(b.w, .01), h = Math.max(b.h, .01), d = geomNode && geomNode.localName === 'custGeom' ? custPaths(geomNode, w, h).map(q => q.d).join('') : linePath(prst, w, h, av);
    const stroke = lineOn ? cssC(line.fill.c) : cssC({ h: X.defaultText.h, a: 1 }), defs = []; let mk = '';
    const dash = DASH[line && line.dash || 'solid'] ? `stroke-dasharray:${DASH[line.dash].split(' ').map(v => px2(v * sw)).join(' ')};` : '';
    if (line && line.head) { defs.push(markerDef('mh' + (++svgSeq), line.head, stroke, sw)); mk += ` marker-start="url(#mh${svgSeq})"`; }
    if (line && line.tail) { defs.push(markerDef('mt' + (++svgSeq), line.tail, stroke, sw)); mk += ` marker-end="url(#mt${svgSeq})"`; }
    const flip = `${x.fh ? 'scaleX(-1) ' : ''}${x.fv ? 'scaleY(-1)' : ''}`.trim();
    S.out.push(`${label}\n<svg class="pi" ${SVGNS} aria-hidden="true" style="${posCss(Object.assign({}, b, { x: b.x - pad, y: b.y - pad, w: w + pad * 2, h: h + pad * 2 }))};overflow:visible" viewBox="${px2(-pad)} ${px2(-pad)} ${px2(w + pad * 2)} ${px2(h + pad * 2)}"><defs>${defs.join('')}</defs><g${flip ? ` style="transform:${flip};transform-origin:${px2(w / 2)}px ${px2(h / 2)}px"` : ''}><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${px2(sw)}" stroke-linejoin="${line && line.join || 'miter'}" stroke-linecap="${line && line.cap === 'rnd' ? 'round' : line && line.cap === 'sq' ? 'square' : 'butt'}" style="${dash}"${mk}/></g></svg>`);
    return;
  }
  let g = prst === 'custom' ? { paths: custPaths(geomNode, b.w, b.h) } : preset(prst, b.w, b.h, av, w => S.note(w));
  if (g.paths && !g.paths.length) g = { css: { radius: 0 } };
  const imgFill = fill && fill.t === 'img' ? fill : null;
  let cls = ''; if (imgFill) cls = S.imgClass(imgFill.rid, rels, b.w, b.h, imgFill.crop);
  const sw = lineOn ? lineWidthPx(line, S, 9525) : 0, shadow = effect ? effect : null;
  const inner = [];
  // text layer
  let tinset = [0, 0, 0, 0]; if (g.textInset) tinset = [g.textInset[0] * b.w, g.textInset[1] * b.h, g.textInset[2] * b.w, g.textInset[3] * b.h];
  if (textInfo && textInfo.par.html) {
    const T = textInfo, just = { t: 'flex-start', ctr: 'center', b: 'flex-end' }[T.anchor] || 'flex-start', vertCss = T.vert === 'vert270' ? 'writing-mode:vertical-rl;transform:rotate(180deg);' : T.vert === 'vert' ? 'writing-mode:vertical-rl;' : '';
    inner.push(`<div class="tx" style="padding:${px2(T.ins[1] + tinset[1])}px ${px2(T.ins[2] + tinset[2])}px ${px2(T.ins[3] + tinset[3])}px ${px2(T.ins[0] + tinset[0])}px;justify-content:${just};${T.wrap ? '' : 'white-space:nowrap;'}${T.anchorCtr ? 'align-items:center;' : ''}${vertCss}">\n${T.par.html}\n</div>`);
  }
  if (g.css) {   // plain box: the fill, line and radius sit on the div itself
    const css = [], rad = g.css.radius === 'ellipse' ? '50%' : g.css.radius ? px2(g.css.radius + sw / 2) + 'px' : '';
    let bb = Object.assign({}, b); if (sw) { bb.x -= sw / 2; bb.y -= sw / 2; bb.w += sw; bb.h += sw; }
    if (fill && fill.t === 'solid') css.push(`background:${cssC(fill.c)}`); else if (fill && fill.t === 'grad') css.push(`background:${gradCss(fill)}`);
    if (rad) css.push(`border-radius:${rad}`);
    if (lineOn) css.push(`border:${px2(sw)}px ${(DASH[line.dash] || '') && /dot/i.test(line.dash) && !/dash/i.test(line.dash) ? 'dotted' : /dash/i.test(line.dash) ? 'dashed' : 'solid'} ${cssC(line.fill.c)}`);
    if (shadow) css.push(`box-shadow:${px2(shadow.dx)}px ${px2(shadow.dy)}px ${px2(shadow.blur)}px ${cssC(shadow.c)}`);
    if (cls) S.imgCss.set(cls, S.imgBg(cls, imgFill.crop, imgFill.tile));
    const opaque = css.length || cls || inner.length;
    if (!opaque) return;
    S.out.push(`${label}\n<div class="pi${cls ? ' im ' + cls : ''}" role="${cls ? 'img' : 'presentation'}"${cls && at(cNv, 'descr') ? ` aria-label="${esc(at(cNv, 'descr').slice(0, 200))}"` : ''} style="${posCss(bb)};${css.join(';')}${imgFill && imgFill.alpha < 1 ? `;opacity:${px2(imgFill.alpha)}` : ''}">${inner.length ? '\n' + inner.join('\n') + '\n' : ''}</div>`);
    return;
  }
  // svg shape
  const defs = [], fillP = fill && fill.t === 'img' ? 'none' : svgPaint(fill, defs, b.w, b.h), stroke = lineOn ? cssC(line.fill.c) : 'none', pad = sw / 2 + 1;
  if (!fill && !lineOn && !inner.length) return;
  // a picture fill on a free-form outline: the picture is a background on a div clipped to the outline (an svg cannot hold our re-encoded data: urls in css)
  const clipped = cls ? `<div class="im ${cls}" style="position:absolute;left:0;top:0;width:100%;height:100%;clip-path:path('${g.paths.filter(q => !q.noFill).map(q => q.d).join(' ')}')${imgFill.alpha < 1 ? `;opacity:${px2(imgFill.alpha)}` : ''}"></div>\n` : '';
  const dash = lineOn && DASH[line.dash] ? `stroke-dasharray:${DASH[line.dash].split(' ').map(v => px2(v * sw)).join(' ')};` : '';
  const flip = `${x.fh ? 'scaleX(-1) ' : ''}${x.fv ? 'scaleY(-1)' : ''}`.trim();
  const pathsSvg = g.paths.map(p => `<path d="${p.d}" fill="${p.noFill ? 'none' : fillP}"${p.evenodd ? ' fill-rule="evenodd"' : ''} stroke="${p.noStroke ? 'none' : stroke}" stroke-width="${px2(sw)}" stroke-linejoin="${lineOn ? line.join : 'miter'}" style="${dash}"/>`).join('');
  if (cls) S.imgCss.set(cls, S.imgBg(cls, imgFill.crop, imgFill.tile));
  const filt = shadow ? `;filter:drop-shadow(${px2(shadow.dx)}px ${px2(shadow.dy)}px ${px2(shadow.blur / 2)}px ${cssC(shadow.c)})` : '';
  S.out.push(`${label}\n<div class="pi" role="presentation" style="${posCss(b)}${filt}">\n${clipped}<svg ${SVGNS} aria-hidden="true" class="sv" viewBox="${px2(-pad)} ${px2(-pad)} ${px2(b.w + pad * 2)} ${px2(b.h + pad * 2)}" style="left:${px2(-pad)}px;top:${px2(-pad)}px;width:${px2(b.w + pad * 2)}px;height:${px2(b.h + pad * 2)}px${flip ? `;transform:${flip}` : ''}"><defs>${defs.join('')}</defs>${pathsSvg}</svg>${inner.length ? '\n' + inner.join('\n') + '\n' : ''}</div>`);
}

async function picShape(n, S, rels, opts, cNv) {
  const X = S.X, x = xfrmOf([n]); if (!x) return;
  const b = frameOf(x, S, opts), bf = kid(n, 'blipFill'), blip = bf && kid(bf, 'blip'), rid = rattr(blip, 'embed'), sp = spPrOf(n), geom = sp && kid(sp, 'prstGeom'), prst = at(geom, 'prst', 'rect');
  const crop = (c => (c ? [nu(c, 'l', 0), nu(c, 't', 0), nu(c, 'r', 0), nu(c, 'b', 0)].map(v => v / 100000) : null))(kid(bf, 'srcRect'));
  const am = blip && kid(blip, 'alphaModFix'), alpha = am ? nu(am, 'amt', 100000) / 100000 : 1, gray = !!(blip && kid(blip, 'grayscl'));
  const cls = rid ? S.imgClass(rid, rels, b.w, b.h, crop) : null; if (!cls) { S.note('A picture could not be found in the file.'); return; }
  const lnN = sp && kid(sp, 'ln'), line = lnN ? lineOf(lnN, X) : null, lineOn = line && line.fill && line.fill.t === 'solid', sw = lineOn ? lineWidthPx(line, S, 9525) : 0;
  S.imgCss.set(cls, S.imgBg(cls, crop, false)); S.count++;
  const bb = Object.assign({}, b); if (sw) { bb.x -= sw / 2; bb.y -= sw / 2; bb.w += sw; bb.h += sw; }
  const rad = prst === 'ellipse' ? '50%' : prst === 'roundRect' ? px2(Math.min(b.w, b.h) * ((() => { const g = kids(kid(geom, 'avLst'), 'gd')[0]; const m = g && /val\s+(\d+)/.exec(at(g, 'fmla', '')); return m ? Number(m[1]) : 16667; })()) / 100000) + 'px' : '';
  const shadow = shadowOf(sp && kid(sp, 'effectLst'), X, X.k);
  const css = [rad && `border-radius:${rad}`, lineOn && `border:${px2(sw)}px solid ${cssC(line.fill.c)}`, alpha < 1 && `opacity:${px2(alpha)}`, gray && 'filter:grayscale(1)', shadow && `box-shadow:${px2(shadow.dx)}px ${px2(shadow.dy)}px ${px2(shadow.blur)}px ${cssC(shadow.c)}`].filter(Boolean);
  const alt = at(cNv, 'descr', '') || at(cNv, 'name', 'Picture');
  S.out.push(`<!-- ${esc(at(cNv, 'name', 'Picture')).replace(/--+/g, '-')} -->\n<div class="pi im ${cls}" role="img" aria-label="${esc(alt.slice(0, 200))}" style="${posCss(bb)};${css.join(';')}"></div>`);
}

/* ── charts: bar / column / line / area / pie / doughnut (and combinations of the first three) drawn as inline SVG ── */
const CH_TYPES = /^(bar|bar3D|line|line3D|area|area3D|pie|pie3D|doughnut|ofPie)Chart$/;
const richText = n => (n ? kids(n).flatMap(function walk(c) { return c.localName === 't' ? [c.textContent] : kids(c).flatMap(walk); }).join('') : '');
function niceTicks(lo, hi, want) {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / Math.max(1, want), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, t = []; for (let v = a; v <= b + step / 2 && t.length < 30; v += step) t.push(Math.round(v / step) * step);
  return t;
}
function fmtNum(v, code) {
  code = String(code || 'General'); const dec = (/\.(0+)/.exec(code) || ['', ''])[1].length;
  if (/%/.test(code)) return (v * 100).toFixed(dec) + '%';
  const s = /General/i.test(code) ? String(Math.round(v * 100) / 100) : Math.abs(v) >= 1000 && /,/.test(code) ? v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : v.toFixed(dec);
  return /^\$|\[\$\$|£|€/.test(code) ? (/£/.test(code) ? '£' : /€/.test(code) ? '€' : '$') + s : s;
}
function readSeries(g, X, kind, idxBase, pie) {
  const lst = [];
  kids(g, 'ser').forEach((s, i) => {
    const cache = (n, which) => { const ref = n && (kid(n, 'numRef') || kid(n, 'strRef') || kid(n, 'multiLvlStrRef')); const c = ref && (kid(ref, 'numCache') || kid(ref, 'strCache') || kid(ref, 'multiLvlStrCache')); if (!c) return []; const out = []; const pts = c.localName === 'multiLvlStrCache' ? kids(kids(c, 'lvl')[0] || c, 'pt') : kids(c, 'pt'); pts.forEach(p => { out[nu(p, 'idx', 0)] = which === 'n' ? parseFloat(kid(p, 'v') ? kid(p, 'v').textContent : '') : (kid(p, 'v') ? kid(p, 'v').textContent : ''); }); const cnt = nu(kid(c, 'ptCount'), 'val', out.length); out.length = Math.min(Math.max(out.length, cnt), 200); return Array.from(out, v => (v === undefined ? (which === 'n' ? NaN : '') : v)); };
    const sp = kid(s, 'spPr'), f = sp && fillOf(sp, X), lnN = sp && kid(sp, 'ln'), ln = lnN ? lineOf(lnN, X) : null;
    const acc = { h: X.scheme('accent' + (((idxBase + i) % 6) + 1)), a: 1 };
    const col = f && f.t === 'solid' ? f.c : ln && ln.fill && ln.fill.t === 'solid' && /line|scatter/.test(kind) ? ln.fill.c : acc;
    const pts = {}; kids(s, 'dPt').forEach(d => { const dp = kid(d, 'spPr'), pf = dp && fillOf(dp, X); if (pf && pf.t === 'solid') pts[nu(kid(d, 'idx') || d, 'val', nu(kid(d, 'idx'), 'val', 0))] = pf.c; });
    const dl = kid(s, 'dLbls') || kid(g, 'dLbls'), on = n => { const e = dl && kid(dl, n); return !!e && at(e, 'val', '1') !== '0'; };
    const mk = kid(s, 'marker'), sym = mk && kid(mk, 'symbol');
    lst.push({ name: (txN => (txN ? (kid(txN, 'strRef', 'strCache', 'pt', 'v') || kid(txN, 'v') || { textContent: richText(txN) }).textContent : ''))(kid(s, 'tx')) || `Series ${i + 1}`, vals: cache(kid(s, 'val'), 'n'), cats: cache(kid(s, 'cat'), 's'), col, ptCol: pts, lw: ln && ln.w ? ln.w : 28575, showVal: on('showVal'), showPct: on('showPercent'), showCat: on('showCatName'), noMarker: !!sym && at(sym, 'val') === 'none', marker: kid(g, 'marker') ? at(kid(g, 'marker'), 'val', '1') !== '0' : true, fmt: at(dl && kid(dl, 'numFmt'), 'formatCode', '') });
  });
  return lst;
}
function chartSvg(root, W, H, X) {
  const cs = kid(root, 'chart'), plot = cs && kid(cs, 'plotArea'); if (!plot) return null;
  const groups = kids(plot).filter(n => CH_TYPES.test(n.localName)); if (!groups.length) return null;
  const pie = /^(pie|pie3D|doughnut|ofPie)Chart$/.test(groups[0].localName) ? groups[0] : null;
  const txPr = kid(root, 'txPr'), defR = txPr && kid(txPr, 'p', 'pPr', 'defRPr'), base = clampN(nu(defR, 'sz', 1000) / 75 * X.k, 7, 40);
  const tcol = (defR && fillOf(defR, X)) ? cssC(fillOf(defR, X).c) : '#595959', face = familyCss(at(kid(defR, 'latin'), 'typeface', ''), X);
  const T = (x, y, s, size, anchor, extra) => `<text x="${px2(x)}" y="${px2(y)}" font-size="${px2(size)}" text-anchor="${anchor || 'start'}" fill="${(extra && extra.fill) || tcol}"${extra && extra.weight ? ` font-weight="${extra.weight}"` : ''}${extra && extra.rot ? ` transform="rotate(${extra.rot} ${px2(x)} ${px2(y)})"` : ''}>${esc(s)}</text>`;
  const out = []; let top = base * .6, left = base * .6, right = W - base * .6, bottom = H - base * .6;
  // title
  const tN = kid(cs, 'title'), title = at(kid(cs, 'autoTitleDeleted'), 'val', '0') === '1' ? '' : richText(tN && kid(tN, 'tx'));
  if (title) { const ts = base * 1.4; out.push(T(W / 2, top + ts * .85, title.slice(0, 120), ts, 'middle', { weight: 400 })); top += ts * 1.6; }
  // series
  let all = [], ci = 0; groups.forEach(g => { const kind = g.localName, ser = readSeries(g, X, kind, ci, !!pie); ci += ser.length; ser.forEach(s => { s.kind = kind.replace(/(3D)?Chart$/, ''); s.grp = at(kid(g, 'grouping'), 'val', 'clustered'); s.dir = at(kid(g, 'barDir'), 'val', 'col'); s.gap = nu(kid(g, 'gapWidth'), 'val', 150); s.ov = nu(kid(g, 'overlap'), 'val', /stacked/i.test(s.grp) ? 100 : 0); s.varyColors = at(kid(g, 'varyColors'), 'val', pie ? '1' : '0') !== '0'; s.first = nu(kid(g, 'firstSliceAng'), 'val', 0); s.hole = nu(kid(g, 'holeSize'), 'val', 50); }); all = all.concat(ser); });
  if (!all.length) return null;
  const cats = all.reduce((a, s) => (s.cats.length > a.length ? s.cats : a), []), n = Math.max(cats.length, ...all.map(s => s.vals.length)); if (!n) return null;
  // legend
  const lgN = kid(cs, 'legend'), lgPos = lgN ? at(kid(lgN, 'legendPos'), 'val', 'r') : null;
  const lgItems = pie ? Array.from({ length: n }, (_, i) => ({ name: String(cats[i] || i + 1), col: (all[0].ptCol[i]) || { h: X.scheme('accent' + ((i % 6) + 1)), a: 1 } })) : all.map(s => ({ name: s.name, col: s.col }));
  if (lgN && lgItems.length && !(lgItems.length === 1 && !pie && false)) {
    const fs = base, sw = fs * .9, wOf = it => it.name.length * fs * .52 + sw + fs * 1.1;
    if (lgPos === 'r' || lgPos === 'l' || lgPos === 'tr') { const lw = Math.min(W * .3, Math.max(...lgItems.map(wOf))), x0 = lgPos === 'l' ? left : right - lw, y0 = (top + bottom) / 2 - lgItems.length * fs * .75;
      lgItems.forEach((it, i) => out.push(`<rect x="${px2(x0)}" y="${px2(y0 + i * fs * 1.5)}" width="${px2(sw)}" height="${px2(sw)}" fill="${cssC(it.col)}"/>${T(x0 + sw + fs * .4, y0 + i * fs * 1.5 + sw * .9, it.name.slice(0, 40), fs)}`)); if (lgPos === 'l') left += lw + fs; else right -= lw + fs; }
    else { const total = lgItems.reduce((a, it) => a + wOf(it), 0), rowW = Math.min(total, right - left); let x0 = (left + right) / 2 - rowW / 2; const y0 = lgPos === 't' ? top : bottom - fs * 1.1;
      lgItems.forEach(it => { const w = wOf(it); if (x0 + w > right + 1) return; out.push(`<rect x="${px2(x0)}" y="${px2(y0 + fs * .1)}" width="${px2(sw)}" height="${px2(sw)}" fill="${cssC(it.col)}"/>${T(x0 + sw + fs * .4, y0 + sw * .95, it.name.slice(0, 40), fs)}`); x0 += w; }); if (lgPos === 't') top += fs * 1.9; else bottom -= fs * 1.9; }
  }
  if (pie) {
    const s0 = all[0], vals = s0.vals.map(v => (isFinite(v) && v > 0 ? v : 0)), tot = vals.reduce((a, b) => a + b, 0) || 1, R = Math.max(10, Math.min(right - left, bottom - top) / 2 * .94), cx = (left + right) / 2, cy = (top + bottom) / 2, hole = pie.localName === 'doughnutChart' ? clampN(s0.hole, 10, 90) / 100 * R : 0;
    let a0 = (s0.first - 90) * Math.PI / 180;
    vals.forEach((v, i) => { if (!v) return; const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, pt = (r, a) => `${px2(cx + r * Math.cos(a))} ${px2(cy + r * Math.sin(a))}`, col = cssC(s0.ptCol[i] || { h: X.scheme('accent' + ((i % 6) + 1)), a: 1 });
      const d = v / tot > .9999 ? `M${pt(R, 0)}A${R} ${R} 0 1 1 ${pt(R, Math.PI)}A${R} ${R} 0 1 1 ${pt(R, 0)}${hole ? `M${pt(hole, 0)}A${hole} ${hole} 0 1 0 ${pt(hole, Math.PI)}A${hole} ${hole} 0 1 0 ${pt(hole, 0)}` : ''}Z` : hole ? `M${pt(R, a0)}A${R} ${R} 0 ${big} 1 ${pt(R, a1)}L${pt(hole, a1)}A${hole} ${hole} 0 ${big} 0 ${pt(hole, a0)}Z` : `M${px2(cx)} ${px2(cy)}L${pt(R, a0)}A${R} ${R} 0 ${big} 1 ${pt(R, a1)}Z`;
      out.push(`<path d="${d}" fill="${col}" fill-rule="evenodd" stroke="#fff" stroke-width="1.5"/>`);
      if (s0.showVal || s0.showPct || s0.showCat) { const am = (a0 + a1) / 2, r = hole ? (R + hole) / 2 : R * .66, parts = []; if (s0.showCat) parts.push(String(cats[i] || '')); if (s0.showVal) parts.push(fmtNum(v, s0.fmt)); if (s0.showPct) parts.push(Math.round(v / tot * 100) + '%'); out.push(T(cx + r * Math.cos(am), cy + r * Math.sin(am) + base * .35, parts.join(' ').slice(0, 30), base, 'middle', { fill: '#fff' })); }
      a0 = a1; });
    return `<svg ${SVGNS} role="img" aria-label="${esc(title || 'Chart')}" class="sv" viewBox="0 0 ${px2(W)} ${px2(H)}" style="left:0;top:0;width:${px2(W)}px;height:${px2(H)}px;font-family:${face}">${out.join('')}</svg>`;
  }
  // cartesian axes
  const horiz = all.some(s => s.kind === 'bar' && s.dir === 'bar'), stacked = all.some(s => /stacked/i.test(s.grp) && s.kind !== 'line'), pct = all.some(s => /percentStacked/i.test(s.grp));
  const vAx = kid(plot, 'valAx'), cAx = kid(plot, 'catAx') || kid(plot, 'dateAx'), sc = vAx && kid(vAx, 'scaling'), rev = cAx && at(kid(cAx, 'scaling', 'orientation'), 'val', 'minMax') === 'maxMin';
  const sums = Array.from({ length: n }, (_, i) => { let p = 0, q = 0; all.forEach(s => { const v = s.vals[i]; if (isFinite(v)) { if (s.kind === 'line' && !/stacked/i.test(s.grp)) return; if (v >= 0) p += v; else q += v; } }); return [q, p]; });
  let lo = 0, hi = 0; if (pct) hi = 1; else if (stacked) { hi = Math.max(0, ...sums.map(s => s[1])); lo = Math.min(0, ...sums.map(s => s[0])); } else { all.forEach(s => s.vals.forEach(v => { if (isFinite(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); } })); }
  const mxN = sc && kid(sc, 'max'), mnN = sc && kid(sc, 'min'); if (mxN) hi = Number(at(mxN, 'val', hi)); if (mnN) lo = Number(at(mnN, 'val', lo));
  const plotH = bottom - top, plotW = right - left, ticks = niceTicks(lo, hi, clampN(Math.round((horiz ? plotW : plotH) / (base * 4.5)), 3, 8)); if (!mxN) hi = Math.max(hi, ticks[ticks.length - 1]); if (!mnN) lo = Math.min(lo, ticks[0]); if (hi <= lo) hi = lo + 1;
  const code = at(vAx && kid(vAx, 'numFmt'), 'formatCode', pct ? '0%' : 'General'), tl = ticks.map(t => fmtNum(t, code)), vDel = vAx && at(kid(vAx, 'delete'), 'val', '0') === '1', cDel = cAx && at(kid(cAx, 'delete'), 'val', '0') === '1';
  const lblW = Math.max(...tl.map(s => s.length)) * base * .55 + base * .7, catLbl = cats.map(c => String(c)), catH = base * 1.7;
  let px0 = left + (!horiz && !vDel ? lblW : 0), px1 = right, py0 = top + base * .4, py1 = bottom - (!horiz && !cDel ? catH : 0);
  if (horiz) { px0 = left + (cDel ? 0 : Math.min(plotW * .3, Math.max(...catLbl.map(s => s.length)) * base * .52 + base)); py1 = bottom - (vDel ? 0 : catH); }
  const vPos = v => (horiz ? px0 + (v - lo) / (hi - lo) * (px1 - px0) : py1 - (v - lo) / (hi - lo) * (py1 - py0)), band = (horiz ? py1 - py0 : px1 - px0) / n, cMid = i => { const j = rev ? n - 1 - i : i; return horiz ? py1 - (j + .5) * band : px0 + (j + .5) * band; };
  const grid = cAx && kid(vAx, 'majorGridlines') !== null || !vAx; const gc = '#d9d9d9';
  ticks.forEach((t, i) => { if (t < lo - 1e-9 || t > hi + 1e-9) return; const p = vPos(t);
    if (!vAx || kid(vAx, 'majorGridlines')) out.push(horiz ? `<line x1="${px2(p)}" y1="${px2(py0)}" x2="${px2(p)}" y2="${px2(py1)}" stroke="${gc}" stroke-width="1"/>` : `<line x1="${px2(px0)}" y1="${px2(p)}" x2="${px2(px1)}" y2="${px2(p)}" stroke="${gc}" stroke-width="1"/>`);
    if (!vDel) out.push(horiz ? T(p, py1 + base * 1.3, tl[i], base, 'middle') : T(px0 - base * .5, p + base * .35, tl[i], base, 'end')); });
  const zero = vPos(clampN(0, lo, hi)); out.push(horiz ? `<line x1="${px2(zero)}" y1="${px2(py0)}" x2="${px2(zero)}" y2="${px2(py1)}" stroke="#bfbfbf" stroke-width="1"/>` : `<line x1="${px2(px0)}" y1="${px2(zero)}" x2="${px2(px1)}" y2="${px2(zero)}" stroke="#bfbfbf" stroke-width="1"/>`);
  const every = Math.max(1, Math.ceil(catLbl.reduce((a, s) => Math.max(a, s.length), 1) * base * .52 / Math.max(1, band * (horiz ? 0 : 1) + (horiz ? 1e9 : 0))));
  if (!cDel) catLbl.forEach((c, i) => { if (i % every) return; const m = cMid(i), maxc = horiz ? 40 : Math.max(4, Math.floor(band / (base * .5))); out.push(horiz ? T(px0 - base * .5, m + base * .35, c.slice(0, maxc), base, 'end') : T(m, py1 + base * 1.2, c.slice(0, maxc), base, 'middle')); });
  // draw series: bars first, then areas, then lines
  const bars = all.filter(s => s.kind === 'bar'), nb = /stacked/i.test((bars[0] || {}).grp || '') ? 1 : Math.max(1, bars.length), ov = Math.max(-1, Math.min(1, ((bars[0] || {}).ov || 0) / 100)), gap = ((bars[0] || {}).gap || 150) / 100;
  const bw = band / (nb - ov * (nb - 1) + gap), cum = Array.from({ length: n }, () => [0, 0]);
  const val = (s, i) => (isFinite(s.vals[i]) ? s.vals[i] : 0), norm = (s, i) => (pct ? val(s, i) / ((sums[i][1] - sums[i][0]) || 1) : val(s, i));
  bars.forEach((s, bi) => { const st = /stacked/i.test(s.grp); for (let i = 0; i < n; i++) { if (!isFinite(s.vals[i])) continue; const v = norm(s, i), c = cssC(s.ptCol[i] || (s.varyColors && bars.length === 1 ? { h: X.scheme('accent' + ((i % 6) + 1)), a: 1 } : s.col));
      let a, b; if (st) { const k = v >= 0 ? 1 : 0; a = cum[i][k]; b = a + v; cum[i][k] = b; } else { a = 0; b = v; }
      const off = (st ? 0 : bi * bw * (1 - ov)) + (band - (nb - ov * (nb - 1)) * bw) / 2, p0 = vPos(a), p1 = vPos(b), m0 = (horiz ? py1 - (rev ? n - 1 - i : i) * band - band : px0 + (rev ? n - 1 - i : i) * band) + off;
      out.push(horiz ? `<rect x="${px2(Math.min(p0, p1))}" y="${px2(m0)}" width="${px2(Math.abs(p1 - p0))}" height="${px2(bw)}" fill="${c}"/>` : `<rect x="${px2(m0)}" y="${px2(Math.min(p0, p1))}" width="${px2(bw)}" height="${px2(Math.abs(p1 - p0))}" fill="${c}"/>`);
      if (s.showVal) out.push(horiz ? T(Math.max(p0, p1) + base * .3, m0 + bw / 2 + base * .35, fmtNum(val(s, i), s.fmt || code), base, 'start') : T(m0 + bw / 2, (st ? (p0 + p1) / 2 + base * .35 : Math.min(p0, p1) - base * .35), fmtNum(val(s, i), s.fmt || code), base, 'middle', st ? { fill: '#fff' } : null)); } });
  const acum = Array.from({ length: n }, () => 0);
  all.filter(s => s.kind === 'area').forEach(s => { const st = /stacked/i.test(s.grp), top1 = [], base1 = []; for (let i = 0; i < n; i++) { const v = norm(s, i), a = st ? acum[i] : 0; base1.push([cMid(i), vPos(a)]); top1.push([cMid(i), vPos(a + v)]); if (st) acum[i] = a + v; }
    out.push(`<path d="M${top1.map(q => px2(q[0]) + ' ' + px2(q[1])).join('L')}L${base1.reverse().map(q => px2(q[0]) + ' ' + px2(q[1])).join('L')}Z" fill="${cssC(s.col, .75)}" stroke="${cssC(s.col)}" stroke-width="1.5"/>`); });
  all.filter(s => s.kind === 'line').forEach(s => { const pts = []; for (let i = 0; i < n; i++) if (isFinite(s.vals[i])) pts.push([horiz ? vPos(norm(s, i)) : cMid(i), horiz ? cMid(i) : vPos(norm(s, i)), i]);
    if (pts.length > 1) out.push(`<polyline points="${pts.map(q => px2(q[0]) + ',' + px2(q[1])).join(' ')}" fill="none" stroke="${cssC(s.col)}" stroke-width="${px2(clampN(s.lw / 9525 * X.k, 1.5, 8))}" stroke-linejoin="round" stroke-linecap="round"/>`);
    if (s.marker && !s.noMarker) pts.forEach(q => out.push(`<circle cx="${px2(q[0])}" cy="${px2(q[1])}" r="${px2(clampN(base * .3, 2.5, 6))}" fill="${cssC(s.col)}"/>`));
    if (s.showVal) pts.forEach(q => out.push(T(q[0], q[1] - base * .6, fmtNum(val(s, q[2]), s.fmt || code), base, 'middle'))); });
  return `<svg ${SVGNS} role="img" aria-label="${esc(title || 'Chart')}" class="sv" viewBox="0 0 ${px2(W)} ${px2(H)}" style="left:0;top:0;width:${px2(W)}px;height:${px2(H)}px;font-family:${face}">${out.join('')}</svg>`;
}
async function chartShape(gd, b, S, rels, cNv) {
  const cn = kid(gd, 'chart'), part = cn && rels[rattr(cn, 'id')] && rels[rattr(cn, 'id')].part, root = await readXml(S.pics.zip, part); if (!root) return false;
  let svg = null; try { svg = chartSvg(root, b.w, b.h, S.X); } catch (e) { console.info('[pitchcraft] chart import failed', e); }
  if (!svg) return false;
  S.count++; S.out.push(`<!-- ${esc(at(cNv, 'name', 'Chart')).replace(/--+/g, '-')} (chart) -->\n<div class="pi" role="presentation" style="${posCss(b)}">${svg}</div>`); return true;
}

async function frameShape(n, S, rels, opts, cNv) {
  const X = S.X, x = xfrmOf([n]); if (!x) return; const b = frameOf(x, S, opts), gd = kid(n, 'graphic', 'graphicData'), uri = at(gd, 'uri', '');
  if (/drawingml\/2006\/table$/.test(uri)) { await tableShape(kid(gd, 'tbl'), b, S, rels, opts, cNv); return; }
  if (/chart/.test(uri) && await chartShape(gd, b, S, rels, cNv)) return;
  if (/chart/.test(uri)) S.note('A chart of this kind was not imported (it is shown as a placeholder).'); else if (/diagram/.test(uri)) S.note('A SmartArt diagram was not imported (it is shown as a placeholder).'); else S.note('An embedded object was not imported (it is shown as a placeholder).');
  S.count++;
  S.out.push(`<!-- ${esc(at(cNv, 'name', 'Object')).replace(/--+/g, '-')} (not imported) -->\n<div class="pi ph" role="img" aria-label="${esc(at(cNv, 'descr', '') || 'Content that could not be imported')}" style="${posCss(b)}"><span>${/chart/.test(uri) ? 'Chart' : /diagram/.test(uri) ? 'Diagram' : 'Object'} not imported</span></div>`);
}

async function tableShape(tbl, b, S, rels, opts, cNv) {
  if (!tbl) return; const X = S.X, cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map(c => nu(c, 'w', 0) / 9525 * X.k), rows = kids(tbl, 'tr');
  const tp = kid(tbl, 'tblPr'), styleId = (kid(tp, 'tableStyleId') || {}).textContent, ts = X.tableStyles[styleId] || X.tableStyles._default;
  const flag = a => tp && (at(tp, a) === '1' || at(tp, a) === 'true'), firstRow = flag('firstRow'), bandRow = flag('bandRow'), firstCol = flag('firstCol'), lastRow = flag('lastRow'), lastCol = flag('lastCol'), bandCol = flag('bandCol');
  const rowSpanSkip = {}; let html = '';
  const sumW = cols.reduce((a, c) => a + c, 0) || b.w, kx = b.w / sumW;
  html += `<colgroup>${cols.map(c => `<col style="width:${px2(c * kx)}px">`).join('')}</colgroup>`;
  for (let ri = 0; ri < rows.length; ri++) {
    const tr = rows[ri], rh = nu(tr, 'h', 0) / 9525 * X.k; html += `<tr style="height:${px2(rh)}px">`; let ci = 0;
    for (const tc of kids(tr, 'tc')) {
      while (rowSpanSkip[ri + ':' + ci]) ci++;
      if (at(tc, 'hMerge') === '1' || at(tc, 'vMerge') === '1') { ci++; continue; }
      const gs = nu(tc, 'gridSpan', 1), rs = nu(tc, 'rowSpan', 1); for (let a = 0; a < rs; a++) for (let c2 = 0; c2 < gs; c2++) if (a || c2) rowSpanSkip[(ri + a) + ':' + (ci + c2)] = 1;
      const tcPr = kid(tc, 'tcPr'), role = (firstRow && ri === 0) ? 'firstRow' : (lastRow && ri === rows.length - 1) ? 'lastRow' : null;
      const bandName = bandRow && !role ? ((ri - (firstRow ? 1 : 0)) % 2 === 0 ? 'band1H' : 'band2H') : null;
      const cellRoles = ['wholeTbl', bandName, bandCol && (ci % 2 === 0) ? 'band1V' : bandCol ? 'band2V' : null, firstCol && ci === 0 ? 'firstCol' : null, lastCol && ci === cols.length - 1 ? 'lastCol' : null, role].filter(Boolean);
      let fill = fillOf(tcPr, X); const cstyle = {}; cellRoles.forEach(r => { const st = ts && ts[r]; if (st) { if (st.fill) cstyle.fill = st.fill; if (st.txB != null) cstyle.b = st.txB; if (st.txColor) cstyle.color = st.txColor; if (st.bdr) cstyle.bdr = Object.assign(cstyle.bdr || {}, st.bdr); } });
      if (!fill || fill.t === 'inherit') fill = cstyle.fill || null;
      const borders = []; ['L', 'R', 'T', 'B'].forEach((s, i) => { const l = lineOf(kid(tcPr, 'ln' + s), X); let use = l && l.fill ? l : null; if (!use && cstyle.bdr) { const key = ['left', 'right', 'top', 'bottom'][i], ins = (i < 2 ? 'insideV' : 'insideH'); use = cstyle.bdr[key] || cstyle.bdr[ins] || null; } if (use && use.fill && use.fill.t === 'solid') borders.push(`border-${['left', 'right', 'top', 'bottom'][i]}:${px2(Math.max(1, (use.w || 12700) / 9525 * X.k))}px solid ${cssC(use.fill.c)}`); });
      const pad = [nu(tcPr, 'marL', 91440), nu(tcPr, 'marT', 45720), nu(tcPr, 'marR', 91440), nu(tcPr, 'marB', 45720)].map(v => v / 9525 * X.k);
      const tx = kid(tc, 'txBody'), chain = [X.defaultStyle, cstyle.b != null || cstyle.color ? { syn: { color: cstyle.color || null } } : null, X.txStyles.other, kid(tx, 'lstStyle')];
      const par = tx ? paragraphs(tx, chain, X, {}) : { html: '' };
      let p = par.html; if (cstyle.b) p = p.replace(/<p ([^>]*)style="/g, (m, a) => `<p ${a}style="font-weight:700;`);
      const va = { t: 'top', ctr: 'middle', b: 'bottom' }[at(tcPr, 'anchor', 't')] || 'top';
      S.count++;
      html += `<td${gs > 1 ? ` colspan="${gs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''} style="padding:${px2(pad[1])}px ${px2(pad[2])}px ${px2(pad[3])}px ${px2(pad[0])}px;vertical-align:${va};${fill && fill.t === 'solid' ? `background:${cssC(fill.c)};` : fill && fill.t === 'grad' ? `background:${gradCss(fill)};` : ''}${borders.join(';')}">\n${p}\n</td>`;
      ci += gs;
    }
    html += '</tr>\n';
  }
  S.out.push(`<!-- ${esc(at(cNv, 'name', 'Table')).replace(/--+/g, '-')} -->\n<table class="pi tb" style="${posCss(b)};border-collapse:collapse;table-layout:fixed">\n${html}</table>`);
}

/* ── package-level reading ── */
async function readRels(zip, part) {
  const rp = dirOf(part) + '_rels/' + part.split('/').pop() + '.rels', out = {};
  if (!zip.has(rp)) return out;
  kids(parseXml(new TextDecoder().decode(await zip.bytes(rp))), 'Relationship').forEach(r => { const tgt = at(r, 'Target', ''), ext = at(r, 'TargetMode') === 'External'; out[at(r, 'Id')] = { type: at(r, 'Type', '').split('/').pop(), part: ext ? null : resolve(part, tgt), external: ext }; });
  return out;
}
const readXml = async (zip, part) => (part && zip.has(part) ? parseXml(new TextDecoder().decode(await zip.bytes(part))) : null);
function readTheme(root) {
  const colors = {}, el = kid(root, 'themeElements'), cs = kid(el, 'clrScheme');
  kids(cs).forEach(c => { const k = kids(c)[0]; if (k) colors[c.localName] = k.localName === 'sysClr' ? at(k, 'lastClr', SYS[at(k, 'val')] || '000000') : at(k, 'val', '000000'); });
  colors.hlink = colors.hlink || '0563c1'; const fs = kid(el, 'fontScheme');
  const fm = kid(el, 'fmtScheme');
  return { colors, fonts: { major: at(kid(fs, 'majorFont', 'latin'), 'typeface', 'Calibri Light'), minor: at(kid(fs, 'minorFont', 'latin'), 'typeface', 'Calibri') }, fills: kids(kid(fm, 'fillStyleLst')), lines: kids(kid(fm, 'lnStyleLst')), bgFills: kids(kid(fm, 'bgFillStyleLst')) };
}
function readTableStyles(root, X) {
  const out = { _default: null };
  if (!root) return out;
  kids(root, 'tblStyle').forEach(ts => {
    const st = {};
    kids(ts).forEach(p => {
      if (p.localName === 'tblBg') return; const e = {}, tcS = kid(p, 'tcStyle'), tcT = kid(p, 'tcTxStyle');
      if (tcT) { e.txB = at(tcT, 'b') === 'on' ? true : at(tcT, 'b') === 'off' ? false : null; const c = colour(tcT, X); if (c) e.txColor = c; }
      if (tcS) { const f = kid(tcS, 'fill'); if (f) e.fill = fillOf(f, X); const bd = kid(tcS, 'tcBdr'); if (bd) { e.bdr = {}; kids(bd).forEach(s => { const ln = kid(s, 'ln'); if (ln) e.bdr[s.localName] = lineOf(ln, X); }); } }
      st[p.localName] = e;
    });
    out[at(ts, 'styleId')] = st;
  });
  const def = at(root, 'def'); out._default = out[def] || null; return out;
}
function builtinTable(X) {   // when the file does not carry the style definition: "Medium Style 2 - Accent 1"
  const a1 = { h: X.scheme('accent1'), a: 1 }, white = { h: 'ffffff', a: 1 }, tint = (k) => ({ h: (c => c.map(v => hex2(255 - (255 - v) * k)).join(''))(toRgb(a1.h)), a: 1 });
  return { wholeTbl: { fill: { t: 'solid', c: tint(.2) }, bdr: { left: { w: 12700, fill: { t: 'solid', c: white } }, right: { w: 12700, fill: { t: 'solid', c: white } }, top: { w: 12700, fill: { t: 'solid', c: white } }, bottom: { w: 12700, fill: { t: 'solid', c: white } }, insideH: { w: 12700, fill: { t: 'solid', c: white } }, insideV: { w: 12700, fill: { t: 'solid', c: white } } } }, band1H: { fill: { t: 'solid', c: tint(.4) } }, firstRow: { fill: { t: 'solid', c: a1 }, txB: true, txColor: white } };
}

const SLIDE_CSS = `.slide{overflow:hidden}
.pi{position:absolute;box-sizing:border-box;margin:0}
.pi p{margin:0;padding:0;white-space:normal;overflow-wrap:break-word}
.pi p.bu::marker{color:var(--mk,currentColor)}
.im{background-repeat:no-repeat;background-size:100% 100%}
.tx{position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.sv{position:absolute;overflow:visible}
.tb td{box-sizing:border-box;overflow:hidden}
.tb td p{white-space:normal}
.ph{display:grid;place-items:center;border:2px dashed #94a3b8;background:rgba(148,163,184,.12);color:#64748b;font:600 18px Inter,sans-serif}`;

/** Public entry point. */
PC.importPptx = async function (input, opt) {
  opt = opt || {}; const say = opt.progress || (() => {}), warnings = [], report = { slides: 0, pictures: 0, shapes: 0, fonts: [], notImported: 0 };
  const warn = w => { if (!warnings.includes(w)) warnings.push(w); };
  say('Opening the file');
  const zip = await PC.unzip(input);
  if (!zip.has('ppt/presentation.xml')) throw new Error('This is not a PowerPoint presentation (no ppt/presentation.xml). Only .pptx files can be imported.');
  const pres = await readXml(zip, 'ppt/presentation.xml'), pRels = await readRels(zip, 'ppt/presentation.xml');
  const sz = kid(pres, 'sldSz'), SW = nu(sz, 'cx', 12192000), SH = nu(sz, 'cy', 6858000);
  const k = Math.min(1280 / (SW / 9525), 720 / (SH / 9525)), ox = (1280 - SW / 9525 * k) / 2, oy = (720 - SH / 9525 * k) / 2;
  if (Math.abs(SW / SH - 16 / 9) > .02) warn(`The slide size is ${r1(SW / 914400)} x ${r1(SH / 914400)} inches, not 16:9; slides are scaled to fit and centred.`);
  const ids = kids(kid(pres, 'sldIdLst'), 'sldId').map(s => pRels[rattr(s, 'id')]).filter(r => r && r.part && zip.has(r.part)).slice(0, LIM.slides);
  if (!ids.length) throw new Error('This presentation has no slides.');
  const kidsOfDefault = kid(pres, 'defaultTextStyle');
  const pics = new Pics(zip), slideOut = [], cache = {};
  const theme = async (rels, part) => { const rr = Object.values(rels).find(r => r.type === 'theme'); if (!rr || !rr.part) return null; if (!cache[rr.part]) cache[rr.part] = readTheme(await readXml(zip, rr.part)); return cache[rr.part]; };
  const tstyles = {}; let tableStylesRoot = null; if (zip.has('ppt/tableStyles.xml')) tableStylesRoot = await readXml(zip, 'ppt/tableStyles.xml');
  const masters = {};
  for (let si = 0; si < ids.length; si++) {
    say(`Reading slide ${si + 1} of ${ids.length}`);
    try {
    const sPart = ids[si].part, sRoot = await readXml(zip, sPart), sRels = await readRels(zip, sPart);
    const lay = Object.values(sRels).find(r => r.type === 'slideLayout'), layRoot = lay && await readXml(zip, lay.part), layRels = lay ? await readRels(zip, lay.part) : {};
    const mas = Object.values(layRels).find(r => r.type === 'slideMaster'); let M = mas && masters[mas.part];
    if (mas && !M) { const root = await readXml(zip, mas.part), rels = await readRels(zip, mas.part); M = masters[mas.part] = { root, rels, theme: await theme(rels, mas.part) || readTheme(parseXml('<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements/></a:theme>')) }; }
    if (!M) { warn(`Slide ${si + 1} has no master; defaults were used.`); M = { root: null, rels: {}, theme: readTheme(parseXml('<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements/></a:theme>')) }; if (!M.theme.colors.dk1) Object.assign(M.theme.colors, { dk1: '000000', lt1: 'ffffff', dk2: '44546a', lt2: 'e7e6e6', accent1: '4472c4', accent2: 'ed7d31', accent3: 'a5a5a5', accent4: 'ffc000', accent5: '5b9bd5', accent6: '70ad47' }); }
    const mCs = M.root ? kid(M.root, 'clrMap') : null, clrMap = {}; if (mCs) Array.from(mCs.attributes).forEach(a => { clrMap[a.name] = a.value; }); else Object.assign(clrMap, { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' });
    ['clrMapOvr'].forEach(() => { [layRoot, sRoot].forEach(r => { const ov = r && kid(r, 'clrMapOvr', 'overrideClrMapping'); if (ov) Array.from(ov.attributes).forEach(a => { clrMap[a.name] = a.value; }); }); });
    const X = new Ctx({ theme: M.theme, clrMap, k, ox, oy, fonts: M.theme.fonts, fontsUsed: new Set(), tableStyles: null, defaultStyle: kidsOfDefault, txStyles: { title: M.root && kid(M.root, 'txStyles', 'titleStyle'), body: M.root && kid(M.root, 'txStyles', 'bodyStyle'), other: M.root && kid(M.root, 'txStyles', 'otherStyle') } });
    X.defaultText = { h: X.scheme('tx1'), a: 1 };
    X.tableStyles = readTableStyles(tableStylesRoot, X); if (!X.tableStyles._default) X.tableStyles._default = builtinTable(X);
    Object.keys(X.tableStyles).forEach(id => { if (id !== '_default' && !Object.keys(X.tableStyles[id]).length) delete X.tableStyles[id]; });
    const S = new SlideBuilder(X, pics, si);
    // placeholders of the layout and master, for inheritance
    const phList = root => (root ? kids(kid(root, 'cSld', 'spTree'), 'sp').map(sp => ({ node: sp, ph: phOf(sp) })).filter(x => x.ph) : []);
    const layoutPhs = phList(layRoot), masterPhs = phList(M.root);
    // background: slide > layout > master
    const bgOf = root => (root ? kid(root, 'cSld', 'bg') : null), bgNode = [sRoot, layRoot, M.root].map(bgOf).find(Boolean), bgRels = bgNode && bgOf(sRoot) === bgNode ? sRels : bgOf(layRoot) === bgNode ? layRels : M.rels;
    let bgFill = null; if (bgNode) { const bp = kid(bgNode, 'bgPr'), br = kid(bgNode, 'bgRef'); if (bp) bgFill = fillOf(bp, X); else if (br) { const Y = Object.assign(Object.create(X), { ph: (colour(br, X) || {}).h }); const idx = nu(br, 'idx', 1001), e = X.theme.bgFills[idx - 1001]; bgFill = e ? fillOf(wrapKids([e]), Y) : (colour(br, X) ? { t: 'solid', c: colour(br, X) } : null); } }
    let bgCss = `background:${cssC({ h: X.scheme('bg1'), a: 1 })}`;
    if (bgFill && bgFill.t === 'solid') bgCss = `background:${cssC(bgFill.c)}`; else if (bgFill && bgFill.t === 'grad') bgCss = `background:${gradCss(bgFill)}`;
    else if (bgFill && bgFill.t === 'img') { const cls = S.imgClass(bgFill.rid, bgRels, 1280, 720, bgFill.crop); if (cls) { S.imgCss.set(cls, S.imgBg(cls, bgFill.crop, false)); S.out.push(`<div class="pi im ${cls}" role="presentation" style="left:0;top:0;width:1280px;height:720px"></div>`); } }
    const showMaster = at(sRoot, 'showMasterSp', '1') !== '0' && (!layRoot || at(layRoot, 'showMasterSp', '1') !== '0');
    // master and layout shapes that are not placeholders
    const deco = async (root, rels) => { const tree = root && kid(root, 'cSld', 'spTree'); if (!tree) return; const keep = kids(tree).filter(c => !(c.localName === 'sp' && phOf(c)) && !/^(nvGrpSpPr|grpSpPr)$/.test(c.localName)); await buildShapes({ children: keep }, S, rels, [], { m: IDM, depth: 0, layoutPhs: [], masterPhs: [] }); };
    if (showMaster && M.root) await deco(M.root, M.rels);
    if (layRoot && at(sRoot, 'showMasterSp', '1') !== '0') await deco(layRoot, layRels);
    const tree = kid(sRoot, 'cSld', 'spTree');
    await buildShapes(tree, S, sRels, [], { m: IDM, depth: 0, layoutPhs, masterPhs });
    // notes
    let notes = ''; const nr = Object.values(sRels).find(r => r.type === 'notesSlide'); if (nr && zip.has(nr.part)) {
      const nroot = await readXml(zip, nr.part); kids(kid(nroot, 'cSld', 'spTree'), 'sp').forEach(sp => { const p = phOf(sp); if (p && p.type === 'body') notes += kids(kid(sp, 'txBody'), 'p').map(pp => kids(pp).map(c => (c.localName === 'br' ? '\n' : c.localName === 'r' || c.localName === 'fld' ? ((kid(c, 't') || {}).textContent || '') : '')).join('')).join('\n'); });
    }
    S.warn.forEach(w => warn(`Slide ${si + 1}: ${w}`)); if (S.imgCss.size || true) report.shapes += S.count; X.fontsUsed.forEach(f => { if (!report.fonts.includes(f)) report.fonts.push(f); });
    slideOut.push({ S, bgCss, notes: notes.trim(), hidden: at(sRoot, 'show') === '0', title: S.title || S.firstText || `Slide ${si + 1}`, fontsUsed: X.fontsUsed });
    } catch (e) {
      warn(`Slide ${si + 1} could not be read (${/xml/i.test(String(e && e.message)) ? 'damaged content' : String(e && e.message || e).slice(0, 80)}) and was left empty.`); console.info('[pitchcraft] pptx slide failed', si + 1, e);
      slideOut.push({ S: { out: [], imgCss: new Map() }, bgCss: 'background:#ffffff', notes: '', hidden: false, title: `Slide ${si + 1}`, fontsUsed: new Set() });
    }
  }
  say('Preparing pictures');
  const uris = await pics.build(200000, warn, report), slides = [];
  slideOut.forEach((o, i) => {
    const cssParts = [SLIDE_CSS, `.slide{${o.bgCss}}`];
    const used = new Set(Array.from(o.S.imgCss.keys())); o.S.imgCss.forEach((v, cls) => { const id = Number(cls.slice(4)); if (!uris.has(id)) return; cssParts.push(`.${cls}{background-image:url(${uris.get(id)});background-size:${v.size};background-position:${v.pos};background-repeat:${v.repeat}}`); });
    let html = `<!-- Imported from PowerPoint slide ${i + 1} -->\n` + o.S.out.join('\n');
    let css = cssParts.join('\n');
    if (html.length > PC.LIMITS.custom) { html = html.slice(0, html.lastIndexOf('\n<!--', PC.LIMITS.custom - 2000)) || html.slice(0, PC.LIMITS.custom); warn(`Slide ${i + 1} is very large; the last shapes were left out.`); }
    if (css.length > PC.LIMITS.custom) { warn(`Slide ${i + 1}: pictures are too large for one slide and were dropped.`); css = cssParts.filter(c => !/data:image/.test(c)).join('\n'); }
    slides.push({ id: 'pp' + (i + 1), layout: 'custom', headline: o.title.slice(0, 120), notes: o.notes.slice(0, 20000), hidden: o.hidden || undefined, custom: { base: 'custom', html, css } });
  });
  report.slides = slides.length;
  const base = String(opt.name || 'Imported presentation').replace(/\.(pptx|potx|ppsx)$/i, '').slice(0, 80);
  const parsed = PC.parseDeck({ format: 'pitchcraft', version: 3, meta: { name: base, theme: 'studio' }, slides });
  parsed.warnings.forEach(w => warn(w)); report.notImported = warnings.filter(w => /not imported|left out|dropped/.test(w)).length;
  say('Done');
  return { deck: parsed.deck, warnings, report };
};
})();
