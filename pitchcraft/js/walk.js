/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT slide walker — reads a rendered slide and describes it as plain data.
   The PowerPoint exporter turns that description into native PowerPoint objects.
   It reads the browser's own layout (positions, computed colours, fonts, wrapping), so every layout, theme and
   custom slide is covered by one piece of code instead of one converter per layout.

   `pcWalk` must stay self-contained: its source text is also injected into custom-slide sandboxes (see KIT_JS in
   layouts.js), where it walks the slide from the inside and posts the result back. It touches no PC globals.

   Result: { bg, items, objs, warn, vars }
     items: in paint order. k = 'box' | 'text' | 'img' | 'svg'. Boxes can carry text (a shape with its words inside it).
     objs:  measurements of free-form objects (.ob), keyed by id, so the exporter can use the model for geometry
            and the browser only for what the browser knows (text runs, auto height).
   Units are slide pixels on the 1280 x 720 stage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
function pcWalk(root, opt) {
  opt = opt || {};
  var RB = root.getBoundingClientRect(), SC = (RB.width / (root.offsetWidth || 1280)) || 1;
  var items = [], objs = {}, warn = [], fonts = {};
  var win = root.ownerDocument.defaultView, cache = new Map();
  var gcs = function (el, ps) { if (ps) return win.getComputedStyle(el, ps); var c = cache.get(el); if (!c) { c = win.getComputedStyle(el); cache.set(el, c); } return c; };
  var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var hex = function (r, g, b) { var h = function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }; return h(r) + h(g) + h(b); };
  var cvs = null;
  function viaCanvas(s) {
    try {
      cvs = cvs || root.ownerDocument.createElement('canvas'); cvs.width = cvs.height = 1; var x = cvs.getContext('2d', { willReadFrequently: true });
      x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = s; x.fillRect(0, 0, 1, 1); var d = x.getImageData(0, 0, 1, 1).data;
      return d[3] < 2 ? null : { c: hex(d[0], d[1], d[2]), a: d[3] / 255 };
    } catch (e) { return null; }
  }
  /** a CSS colour as { c: 'rrggbb', a: 0..1 }, or null when it is transparent */
  function col(s) {
    if (!s || s === 'transparent' || s === 'none') return null;
    var m = s.match(/^rgba?\((.+)\)$/);
    if (m) {
      var t = m[1].split(/[\s,\/]+/).filter(Boolean); if (t.length < 3) return viaCanvas(s);
      var a = t.length > 3 ? (t[3].indexOf('%') > -1 ? parseFloat(t[3]) / 100 : parseFloat(t[3])) : 1; if (isNaN(a)) a = 1;
      return a < .004 ? null : { c: hex(parseFloat(t[0]), parseFloat(t[1]), parseFloat(t[2])), a: Math.min(1, a) };
    }
    m = s.match(/^color\(srgb (.+)\)$/);
    if (m) {
      var q = m[1].split(/[\s\/]+/).filter(Boolean), a2 = q.length > 3 ? (q[3].indexOf('%') > -1 ? parseFloat(q[3]) / 100 : parseFloat(q[3])) : 1;
      return a2 < .004 ? null : { c: hex(parseFloat(q[0]) * 255, parseFloat(q[1]) * 255, parseFloat(q[2]) * 255), a: Math.min(1, a2) };
    }
    return viaCanvas(s);
  }
  function splitTop(s) { var out = [], d = 0, cur = ''; for (var i = 0; i < s.length; i++) { var ch = s[i]; if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
  /** the first usable layer of a background-image value: { grad } or { url } */
  function layers(bg, W, H, sizes) {
    var out = []; if (!bg || bg === 'none') return out;
    splitTop(bg).forEach(function (p, li) {
      var sz = sizes && sizes.length ? sizes[li % sizes.length] : 'auto', whole = /^(auto|auto auto|100%|100% 100%|cover|contain)$/.test(sz);   // a gradient sized to a tile (a grid of hairlines, a pattern) is not one flat fill
      var g = p.match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/), u = p.match(/^url\((['"]?)([\s\S]*?)\1\)$/);
      if (g && !g[1] && g[2] !== 'conic') { if (whole) { var pg = parseGrad(g[2], g[3], W || 1280, H || 720); if (pg) out.push({ grad: pg }); } } else if (u) out.push({ url: u[2] });
    });
    return out;
  }
  var KW = { left: 0, right: 100, top: 0, bottom: 100, center: 50 };
  /** a CSS <position> ("8% -12%", "top left", "120px 40px") as percentages of the box */
  function posOf(str, W, H) {
    var t = str.trim().split(/\s+/), tv = function (v, d) { return /%$/.test(v) ? parseFloat(v) : /px$/.test(v) ? parseFloat(v) / d * 100 : null; };
    if (t.length === 1) { if (t[0] === 'top' || t[0] === 'bottom') return [50, KW[t[0]]]; var x1 = t[0] in KW ? KW[t[0]] : tv(t[0], W); return [x1 == null ? 50 : x1, 50]; }
    var a = t[0], b = t[1]; if (a === 'top' || a === 'bottom' || b === 'left' || b === 'right') { var sw = a; a = b; b = sw; }
    var x = a in KW ? KW[a] : tv(a, W), y = b in KW ? KW[b] : tv(b, H); return [x == null ? 50 : x, y == null ? 50 : y];
  }
  function parseGrad(kind, body, W, H) {
    var parts = splitTop(body), first = parts[0], ang = 180, radial = kind === 'radial', at = [50, 50], rx = null, ry = null, circle = false, ext = '';
    if (!radial && /^(-?[\d.]+(deg|turn|rad|grad)|to )/.test(first)) {
      parts.shift();
      var m = first.match(/^(-?[\d.]+)(deg|turn|rad|grad)/);
      if (m) { var v = parseFloat(m[1]); ang = m[2] === 'turn' ? v * 360 : m[2] === 'rad' ? v * 180 / Math.PI : m[2] === 'grad' ? v * .9 : v; }
      else { var dir = first.replace('to ', ''); ang = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 }[dir] || 180; }
    } else if (radial && !/^(rgb|color|hsl|#|transparent)/.test(first)) {
      parts.shift(); var am = first.match(/(?:^|\s)at\s+(.+)$/), pre = am ? first.slice(0, am.index) : first;
      if (am) at = posOf(am[1], W, H);
      circle = /\bcircle\b/.test(pre); var em = pre.match(/(closest|farthest)-(side|corner)/); if (em) ext = em[0];
      var lens = (pre.match(/-?[\d.]+(?:px|%)/g) || []).map(function (v) { return /%$/.test(v) ? null : parseFloat(v); });
      if (lens.length === 1 && lens[0] != null) { rx = ry = lens[0]; circle = true; } else if (lens.length >= 2) { var pc = pre.match(/-?[\d.]+(?:px|%)/g); rx = /%$/.test(pc[0]) ? parseFloat(pc[0]) / 100 * W : parseFloat(pc[0]); ry = /%$/.test(pc[1]) ? parseFloat(pc[1]) / 100 * H : parseFloat(pc[1]); }
    }
    var stops = parts.map(function (p) {
      var pm = p.match(/\s+(-?[\d.]+)(%|px)?\s*$/), pos = pm ? parseFloat(pm[1]) : null, c = col(pm ? p.slice(0, pm.index) : p);
      if (pm && pm[2] === 'px') { var axis = radial ? (rx || ry || Math.max(W, H) / 2) : Math.abs(W * Math.sin(ang * Math.PI / 180)) + Math.abs(H * Math.cos(ang * Math.PI / 180)); pos = axis > 0 ? pos / axis * 100 : null; }
      return { p: pos, c: c ? c.c : null, a: c ? c.a : 0 };
    });
    if (stops.length < 2) return null;
    stops.forEach(function (s) { if (s.c === null) s.c = null; });
    var prev = stops.find(function (s) { return s.c; }) || { c: '000000' };
    stops.forEach(function (s) { if (!s.c) s.c = prev.c; else prev = s; });          // transparent stops take the neighbour's hue, so fades do not turn grey
    if (stops[0].p === null) stops[0].p = 0; if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 100;
    for (var i = 1; i < stops.length - 1; i++) if (stops[i].p === null) { var j = i; while (stops[j].p === null) j++; var step = (stops[j].p - stops[i - 1].p) / (j - i + 1); for (var k = i; k < j; k++) stops[k].p = stops[k - 1].p + step; }
    return { ang: ((ang - 90) % 360 + 360) % 360, radial: radial, at: at, rx: rx, ry: ry, circle: circle, ext: ext, stops: stops.map(function (s) { return { p: Math.max(0, Math.min(100, s.p)), c: s.c, a: s.a }; }) };
  }
  function rel(r) { return { x: (r.left - RB.left) / SC, y: (r.top - RB.top) / SC, w: r.width / SC, h: r.height / SC }; }
  function geom(el, cs) {
    var g = rel(el.getBoundingClientRect()), rot = 0, t = cs.transform;
    if (t && t !== 'none') { var m = t.match(/^matrix\(([^)]+)\)$/); if (m) { var p = m[1].split(',').map(parseFloat); rot = Math.atan2(p[1], p[0]) * 180 / Math.PI; } }
    if (cs.rotate && cs.rotate !== 'none') { var rm = cs.rotate.match(/(-?[\d.]+)(deg|rad|turn)/); if (rm) rot += rm[2] === 'rad' ? parseFloat(rm[1]) * 180 / Math.PI : rm[2] === 'turn' ? parseFloat(rm[1]) * 360 : parseFloat(rm[1]); }
    if (Math.abs(rot) > .3 && el.offsetWidth) { var w = el.offsetWidth, h = el.offsetHeight, cx = g.x + g.w / 2, cy = g.y + g.h / 2; g = { x: cx - w / 2, y: cy - h / 2, w: w, h: h }; } else rot = 0;
    g.rot = r1(rot); return g;
  }
  var GENERIC = { 'sans-serif': 'Arial', 'system-ui': 'Arial', '-apple-system': 'Arial', 'ui-sans-serif': 'Arial', serif: 'Georgia', 'ui-serif': 'Georgia', monospace: 'Courier New', 'ui-monospace': 'Courier New', cursive: 'Comic Sans MS', fantasy: 'Impact' };
  function family(cs) {
    var list = (cs.fontFamily || '').split(',').map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean), f = list[0] || 'Arial';
    return GENERIC[f.toLowerCase()] || f;
  }
  /** character formatting of the element that directly holds the text */
  function runStyle(el) {
    var cs = gcs(el), size = num(cs.fontSize) || 16, c = col(cs.color), fill = cs.webkitTextFillColor, f = family(cs), hl = col(cs.backgroundColor);
    if (fill && (fill === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(fill))) {
      var gl = layers(cs.backgroundImage).filter(function (l) { return l.grad; })[0]; c = gl ? { c: gl.grad.stops[0].c, a: 1 } : c;   // gradient text: PowerPoint gets the first colour
    }
    fonts[f] = 1; var td = cs.textDecorationLine || '';
    var op = num(cs.opacity); if (op > 0 && op < 1 && c) c = { c: c.c, a: c.a * op };
    return { f: f, sz: size, b: (parseInt(cs.fontWeight, 10) || 400) >= 600, i: cs.fontStyle === 'italic' || cs.fontStyle === 'oblique', u: td.indexOf('underline') > -1, s: td.indexOf('line-through') > -1,
      c: c ? c.c : '000000', a: c ? c.a : 1, cap: cs.textTransform === 'uppercase', lc: cs.textTransform === 'lowercase', tc: cs.textTransform === 'capitalize',
      sp: cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing), sup: el.tagName === 'SUP' || cs.verticalAlign === 'super', sub: el.tagName === 'SUB' || cs.verticalAlign === 'sub',
      hl: hl && hl.a > .4 && cs.display === 'inline' ? hl.c : null, mono: /mono|courier|consol/i.test(f) };
  }
  var BLOCKISH = { IMG: 1, SVG: 1, CANVAS: 1, VIDEO: 1, IFRAME: 1, INPUT: 1, BUTTON: 0, TEXTAREA: 1, SELECT: 1, OBJECT: 1, AUDIO: 1 };
  /** true when the element holds only text and inline phrasing, which becomes one paragraph */
  function inlineOnly(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) continue; if (n.nodeType !== 1) continue;
      var tag = n.tagName.toUpperCase(); if (tag === 'BR') continue;
      if (BLOCKISH[tag] || n.namespaceURI === 'http://www.w3.org/2000/svg') return false;
      var cs = gcs(n); if (cs.display === 'none') continue;
      if (cs.display !== 'inline' || cs.position === 'absolute' || cs.position === 'fixed' || cs.float !== 'none') return false;
      if (!inlineOnly(n)) return false;
    }
    return true;
  }
  var hasText = function (el) { return /\S/.test(el.textContent || ''); };
  function collectRuns(el, out, link) {
    var cs = gcs(el), pre = /^pre/.test(cs.whiteSpace);
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        var t = n.nodeValue; if (!t) continue;
        if (pre) { var segs = t.split('\n'); segs.forEach(function (sg, i) { if (i) out.push({ pb: 1 }); if (sg) out.push(Object.assign({ t: tcase(sg, runStyle(el)), link: link || undefined }, runStyle(el))); }); }
        else { t = t.replace(/[\t\n\r\f ]+/g, ' '); if (t) { var st = runStyle(el); out.push(Object.assign({ t: tcase(t, st), link: link || undefined }, st)); } }
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { out.push({ br: 1 }); continue; }
        var ccs = gcs(n); if (ccs.display === 'none' || ccs.visibility === 'hidden') continue;
        var href = n.tagName === 'A' && n.getAttribute('href') ? n.getAttribute('href') : null;
        collectRuns(n, out, href || link);
      }
    }
  }
  function tcase(t, st) { return st.lc ? t.toLowerCase() : st.tc ? t.replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }) : t; }
  /** split flat runs into paragraphs at pb markers, collapse the whitespace the way the browser does */
  function toParas(runs, base) {
    var paras = [], cur = [];
    runs.forEach(function (r) { if (r.pb) { paras.push(cur); cur = []; } else cur.push(r); });
    paras.push(cur);
    return paras.map(function (rs, pi) {
      var lastSpace = true, out = [];
      rs.forEach(function (r) {
        if (r.br) { if (out.length && out[out.length - 1].t) out[out.length - 1].t = out[out.length - 1].t.replace(/ $/, ''); out.push(r); lastSpace = true; return; }
        var t = r.t; if (lastSpace) t = t.replace(/^ /, ''); if (!t) return; lastSpace = / $/.test(t); r.t = t; out.push(r);
      });
      while (out.length && out[out.length - 1].br) out.pop();
      if (out.length && out[out.length - 1].t) out[out.length - 1].t = out[out.length - 1].t.replace(/ $/, '');
      out = out.filter(function (r) { return r.br || r.t; });
      return Object.assign({ runs: out }, base, pi ? { sb0: 0 } : {});
    });
  }
  function paraBase(el) {
    var cs = gcs(el), size = num(cs.fontSize) || 16, lh = cs.lineHeight === 'normal' ? 1.2 : (num(cs.lineHeight) / size) || 1.2;
    var ta = cs.textAlign, al = ta === 'center' ? 'ctr' : ta === 'right' || ta === 'end' || ta === '-webkit-right' ? 'r' : ta === 'justify' ? 'just' : 'l';
    return { al: al, lh: r1(lh), sz: size };
  }
  /** an element made of text only -> its paragraphs */
  function textParas(el) {
    var runs = []; collectRuns(el, runs); var ps = toParas(runs, paraBase(el)).filter(function (p) { return p.runs.length; });
    var mk = el.getAttribute && el.getAttribute('data-mk');
    if (mk && ps.length) ps[0].bu = /\d/.test(mk) ? 'num' : 'dot';
    var cs = gcs(el); if (el.tagName === 'LI' && cs.listStyleType !== 'none' && ps.length) { var par = el.parentElement; ps[0].bu = par && par.tagName === 'OL' ? 'num' : 'dot'; }
    return ps;
  }
  function isTextBlock(el) { return hasText(el) && inlineOnly(el); }
  function masked(cs) { var m = cs.webkitMaskImage || cs.maskImage; return !!m && m !== 'none'; }
  function boxy(cs) {
    if (masked(cs)) return false;                                                       // faded or patterned by a mask: not one flat shape
    var bgi = bgFor(cs, 1);
    if (bgi.fill || bgi.grad || bgi.img) { return true; }
    var s = ['Top', 'Right', 'Bottom', 'Left'];
    for (var i = 0; i < 4; i++) if (num(cs['border' + s[i] + 'Width']) > 0 && cs['border' + s[i] + 'Style'] !== 'none' && col(cs['border' + s[i] + 'Color'])) return true;
    return false;
  }
  /** can this element be one paragraph of a run of text? (no box of its own, no decoration, not the slide title) */
  function plainText(n) {
    if (n.nodeType !== 1) return false;
    var tag = n.tagName; if (/^(SCRIPT|STYLE)$/.test(tag)) return false;
    var cs = gcs(n); if (cs.display === 'none' || cs.visibility === 'hidden' || num(cs.opacity) === 0) return false;
    if (cs.position === 'absolute' || cs.position === 'fixed') return false;
    if (boxy(cs) || BLOCKISH[tag.toUpperCase()] || n.namespaceURI === 'http://www.w3.org/2000/svg') return false;
    if (roleOf(n, n.getAttribute('data-path'))) return false;
    if (hasDeco(n)) return false;
    if (cs.display === 'flex' || cs.display === 'inline-flex' || cs.display === 'grid') return isTextBlock(n);
    return true;
  }
  function hasDeco(n) {
    if (n.hasAttribute && n.hasAttribute('data-mk')) return false;                      // list markers become real bullets
    var b = gcs(n, '::before').content, a = gcs(n, '::after').content;
    return (b && b !== 'none' && b !== 'normal' && b !== '""') || (a && a !== 'none' && a !== 'normal' && a !== '""');
  }
  /** stacked text elements -> one list of paragraphs, with the gaps between them as paragraph spacing. null when they are not simple stacked text. */
  function mergeKids(kids, g, acc) {
    acc = acc || { last: null, paras: [] };
    for (var k = 0; k < kids.length; k++) {
      var c = kids[k], cg = rel(c.getBoundingClientRect());
      if (!cg.h) continue;
      if (acc.last !== null && cg.y < acc.last - 2) return null;                       // side by side, not stacked
      if (cg.x < g.x - 2 || cg.x + cg.w > g.x + g.w + 2) return null;
      var ps;
      if (isTextBlock(c)) ps = textParas(c);
      else { var sub = { last: acc.last, paras: [] }; if (!mergeParas(c, g, sub)) return null; sub.paras.forEach(function (p) { acc.paras.push(p); }); acc.last = sub.last; continue; }
      if (!ps.length) continue;
      var gap = acc.last === null ? 0 : Math.max(0, cg.y - acc.last);
      if (gap > 2.4 * Math.max(ps[0].sz || 16, 16)) return null;                         // far apart: separate pieces of the design, not one run of text
      var cs2 = gcs(c), padL = num(cs2.paddingLeft);
      ps.forEach(function (p, pi) {
        var lm = cg.x - g.x; if (p.al === 'l' && lm > 3) p.ml = r1(lm);
        if (cg.w < g.w - 8 && p.al === 'l' && Math.abs((cg.x - g.x) - (g.x + g.w - cg.x - cg.w)) < 4 && lm > 12 && p.bu === undefined) p.al = 'ctr';
        p.sb = pi === 0 ? r1(gap) : 0; p.pl = padL;
      });
      acc.last = cg.y + cg.h; ps.forEach(function (p) { acc.paras.push(p); });
    }
    return acc.paras.length ? acc.paras : null;
  }
  function mergeParas(el, g, acc) {
    var kids = [];
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (/\S/.test(n.nodeValue)) return null; continue; }
      if (n.nodeType !== 1) continue;
      var cs = gcs(n); if (cs.display === 'none' || cs.visibility === 'hidden' || num(cs.opacity) === 0 || /^(SCRIPT|STYLE)$/.test(n.tagName)) continue;
      if (!plainText(n)) return null;
      kids.push(n);
    }
    return kids.length ? mergeKids(kids, g, acc) : null;
  }
  function sides(cs, g) {
    var S = ['Top', 'Right', 'Bottom', 'Left'], out = [];
    S.forEach(function (s) {
      var w = num(cs['border' + s + 'Width']), st = cs['border' + s + 'Style'], c = col(cs['border' + s + 'Color']);
      out.push(w > 0 && st !== 'none' && st !== 'hidden' && c ? { w: w, c: c.c, a: c.a, st: st } : null);
    });
    return out;
  }
  function radiusOf(cs, g) {
    var m = Math.min(g.w, g.h), cv = function (v) { v = (v || '0').split(' ')[0]; return v.indexOf('%') > -1 ? parseFloat(v) / 100 * m : num(v); };
    var r = [cv(cs.borderTopLeftRadius), cv(cs.borderTopRightRadius), cv(cs.borderBottomRightRadius), cv(cs.borderBottomLeftRadius)];
    var mx = Math.max.apply(null, r); if (mx < .5) return { r: 0 };
    var top = r[0] > 0 && r[1] > 0 && (r[2] + r[3]) <= .25 * (r[0] + r[1]), bot = r[2] > 0 && r[3] > 0 && (r[0] + r[1]) <= .25 * (r[2] + r[3]);   // a square-ish end counts as square (an arch with 12px feet)
    return { r: Math.min(mx, m / 2), mode: top ? 'top' : bot ? 'bottom' : 'all', circle: mx >= m / 2 - .5 && Math.abs(g.w - g.h) < 3 };
  }
  function shadowOf(cs) {
    var v = cs.boxShadow; if (!v || v === 'none') return null;
    var first = splitTop(v)[0]; if (!first || /inset/.test(first)) return null;
    var cm = first.match(/(rgba?\([^)]+\)|color\([^)]+\)|#[0-9a-f]{3,8})/i), c = cm ? col(cm[1]) : null; if (!c) return null;
    var nums = first.replace(cm[1], '').trim().split(/\s+/).map(num);
    return { dx: nums[0] || 0, dy: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, c: c.c, a: c.a };
  }

  /** clip-path: polygon(...) as points in fractions of the element's box, or null (other shapes are left to the corner radius) */
  function clipPoly(cs, w, h) {
    var v = cs.clipPath; if (!v || v === 'none') return null;
    var m = v.match(/^polygon\(([\s\S]*)\)/); if (!m || !w || !h) return null;
    var parts = splitTop(m[1]); if (parts.length && /^(nonzero|evenodd)$/.test(parts[0])) parts.shift();
    var pts = [];
    for (var i = 0; i < parts.length; i++) {
      var xy = parts[i].trim().split(/\s+/); if (xy.length !== 2 || /calc|var/.test(parts[i])) return null;
      var f = function (t, d) { return /%$/.test(t) ? parseFloat(t) / 100 : /px$/.test(t) ? parseFloat(t) / d : t === '0' ? 0 : NaN; };
      var px = f(xy[0], w), py = f(xy[1], h); if (isNaN(px) || isNaN(py)) return null; pts.push([px, py]);
    }
    return pts.length >= 3 ? pts : null;
  }
  function matrixOf(cs) {
    var t = cs.transform; if (!t || t === 'none') return null;
    var m = t.match(/^matrix\(([^)]+)\)$/); if (!m) return null; var p = m[1].split(',').map(parseFloat);
    return p.length === 6 && !p.some(isNaN) ? { a: p[0], b: p[1], c: p[2], d: p[3], e: p[4], f: p[5] } : null;
  }
  /** a rotation (with any plain scale of 1) is carried by the rotation of the PowerPoint shape; anything else (skew, stretch, scaled and turned) needs the corners */
  function plainTurn(M) {
    var sx = Math.hypot(M.a, M.b), sy = Math.hypot(M.c, M.d), dot = Math.abs(M.a * M.c + M.b * M.d);
    if (dot > .02 * Math.max(sx * sy, 1e-6) || Math.abs(sx - sy) > .02) return false;
    return Math.abs(M.b) < 1e-4 || Math.abs(sx - 1) < .02;
  }
  /** a clipped or skewed element as its true outline: { box: {x,y,w,h}, pts: [[fx,fy],...] } (points as fractions of box), or null when a plain rectangle will do */
  function outlineOf(el, cs, g) {
    var M = matrixOf(cs), needM = M && !plainTurn(M), w = el.offsetWidth, h = el.offsetHeight;
    var poly = clipPoly(cs, w || g.w, h || g.h);
    if (!needM) return poly ? { box: { x: g.x, y: g.y, w: g.w, h: g.h }, pts: poly } : null;
    var st = el.style, keep = ['transform', 'rotate', 'scale', 'translate'].map(function (k) { return [k, st.getPropertyValue(k), st.getPropertyPriority(k)]; }), r0;
    try { keep.forEach(function (k) { st.setProperty(k[0], 'none', 'important'); }); r0 = rel(el.getBoundingClientRect()); }
    finally { keep.forEach(function (k) { if (k[1]) st.setProperty(k[0], k[1], k[2]); else st.removeProperty(k[0]); }); }
    var o = (cs.transformOrigin || '').split(/\s+/).map(parseFloat), ox = r0.x + (isNaN(o[0]) ? r0.w / 2 : o[0]), oy = r0.y + (isNaN(o[1]) ? r0.h / 2 : o[1]);
    var local = poly || [[0, 0], [1, 0], [1, 1], [0, 1]];
    var abs = local.map(function (q) { var x = r0.x + q[0] * r0.w - ox, y = r0.y + q[1] * r0.h - oy; return [ox + M.a * x + M.c * y + M.e, oy + M.b * x + M.d * y + M.f]; });
    var x0 = Math.min.apply(null, abs.map(function (q) { return q[0]; })), x1 = Math.max.apply(null, abs.map(function (q) { return q[0]; })), y0 = Math.min.apply(null, abs.map(function (q) { return q[1]; })), y1 = Math.max.apply(null, abs.map(function (q) { return q[1]; }));
    var bw = Math.max(.1, x1 - x0), bh = Math.max(.1, y1 - y0);
    return { box: { x: x0, y: y0, w: bw, h: bh }, pts: abs.map(function (q) { return [r1((q[0] - x0) / bw * 1e3) / 1e3, r1((q[1] - y0) / bh * 1e3) / 1e3]; }) };
  }
  var curClip = null;
  function bgFor(cs, op) {
    var clipText = /text/.test(cs.webkitBackgroundClip || cs.backgroundClip || '');            // gradient TEXT: the gradient is the colour of the words, not a box
    var ls = clipText ? [] : layers(cs.backgroundImage, num(cs.width) || 1280, num(cs.height) || 720, splitTop(cs.backgroundSize || '')), out = { fill: null, grad: null, img: null, over: null, layers: [] }, c = clipText ? null : col(cs.backgroundColor);
    if (c) out.fill = { c: c.c, a: c.a * op };
    ls.forEach(function (l) { if (l.grad) out.layers.push(l.grad); });
    ls.forEach(function (l, i) { if (l.grad && !out.grad && !out.img) out.grad = l.grad; else if (l.url && !out.img && !out.grad) out.img = { src: l.url, size: cs.backgroundSize, pos: cs.backgroundPosition }; });
    if (out.grad && out.fill && out.grad.stops.some(function (s) { return s.a < .95; })) out.over = true;   // gradient over a colour
    if (op < 1 && out.grad) out.grad.stops.forEach(function (s) { s.a *= op; });
    return out;
  }
  function nameOf(el) {
    var p = el.getAttribute && el.getAttribute('data-path'); if (p) return p.replace(/\./g, ' ');
    var c = (el.getAttribute && el.getAttribute('class')) || ''; c = c.split(/\s+/).filter(function (x) { return x && !/^(rv|anim|in|out)$/.test(x); })[0];
    return c ? c.replace(/[-_]/g, ' ') : el.tagName.toLowerCase();
  }
  function textFrame(el, g, cs, paras, hasBox, lead) {
    var bl = hasBox ? num(cs.borderLeftWidth) : 0, br = hasBox ? num(cs.borderRightWidth) : 0, bt = hasBox ? num(cs.borderTopWidth) : 0, bb = hasBox ? num(cs.borderBottomWidth) : 0;
    var pl = num(cs.paddingLeft), pr = num(cs.paddingRight), pt = num(cs.paddingTop), pb = num(cs.paddingBottom);
    var rng = root.ownerDocument.createRange(); rng.selectNodeContents(el); var rr = rel(rng.getBoundingClientRect());
    var contentL = g.x + bl + pl, contentR = g.x + g.w - br - pr, tTop = rr.y - g.y, tBot = g.y + g.h - (rr.y + rr.h);
    var anchor = 't', ins = [pl + bl, pt + bt, pr + br, pb + bb];
    var first = paras[0], lhPx = (first && first.lh ? first.lh * (first.sz || 16) : 20), oneLine = paras.length === 1 && rr.h < lhPx * 1.6 && !paras[0].runs.some(function (r) { return r.br; });
    if (rr.h > 0 && Math.abs(tTop - tBot) <= Math.max(3, .06 * g.h) && (hasBox || tTop > pt + bt + 3)) { anchor = 'ctr'; ins[1] = ins[3] = Math.max(0, Math.min(pt + bt, pb + bb)); }
    else if (rr.h > 0 && tBot < 3 && tTop > pt + bt + 3 + lhPx * .5 && g.h > rr.h + 6) { anchor = 'b'; }
    if (lead > 0 && !hasBox) { ins[0] += lead; anchor = anchor; }
    else if (oneLine && rr.w > 0) {                                                     // a short label centred or pushed right by flex/auto margins
      var lg = rr.x - contentL, rg = contentR - (rr.x + rr.w);
      if (lg > 4 && Math.abs(lg - rg) <= 4) paras.forEach(function (p) { p.al = 'ctr'; }); else if (lg > 4 && rg < 3) paras.forEach(function (p) { p.al = 'r'; });
    }
    // One line in a tall line box (line-height 3, say): PowerPoint puts all the extra space ABOVE the line, the browser splits it, so the text lands low.
    // Use a normal line and let the vertical anchor (or the measured offset from the top) place it.
    if (oneLine && first && first.lh > 1.3) {
      if (anchor === 't') ins[1] = Math.max(0, rr.y - g.y);
      paras.forEach(function (p) { p.lh = 1.2; });
    }
    return { ins: ins.map(r1), anchor: anchor, wrap: oneLine ? 'none' : 'square', rr: rr };
  }
  function pushBox(el, cs, g, op, paras) {
    var b = bgFor(cs, op), sd = sides(cs, g), rad = radiusOf(cs, g), sh = shadowOf(cs);
    var uniform = sd[0] && sd[1] && sd[2] && sd[3] && sd[0].w === sd[1].w && sd[0].w === sd[2].w && sd[0].w === sd[3].w && sd[0].c === sd[1].c && sd[0].c === sd[3].c && sd[0].c === sd[2].c;
    var line = uniform ? { w: sd[0].w, c: sd[0].c, a: sd[0].a * op, dash: sd[0].st === 'dashed' ? 'dash' : sd[0].st === 'dotted' ? 'sysDot' : 'solid' } : null;
    // stacked glows, radial fades, a gradient over a colour: PowerPoint has no equivalent, so they are painted once into a picture behind the shape
    var L = b.layers, rl = L.length > 1 || (L.length === 1 && (L[0].radial || L[0].stops.some(function (t) { return t.a < .99; }))) || (b.over && !!b.grad);
    var raster = rl ? { layers: L.slice(0, 8), fill: b.fill || null } : null;
    var hasFace = b.fill || b.grad || line || raster;
    if (!raster && b.over && b.fill) emit({ k: 'box', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, fill: b.fill, clip: curClip, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' colour' });
    if (b.img && cs.mixBlendMode && cs.mixBlendMode !== 'normal') b.img = null;                    // a blended texture (film grain) cannot be reproduced and would only cover the slide
    if (b.img && op < .04) b.img = null;
    if (b.img) emit({ k: 'img', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, src: b.img.src, size: b.img.size, pos: b.img.pos, rad: rad.r, circle: rad.circle, clip: curClip, decor: true, name: nameOf(el) + ' picture', alt: '', op: op });
    var it = { k: 'box', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, fill: raster || b.over ? null : b.fill, grad: raster ? null : b.grad, raster: raster, line: line, rad: rad.r, radMode: rad.mode, circle: rad.circle, shadow: hasFace ? sh : null, clip: curClip, name: nameOf(el), op: op };
    if (paras) { var tf = textFrame(el, g, cs, paras, true); it.paras = paras; it.ins = tf.ins; it.anchor = tf.anchor; it.wrap = tf.wrap; }
    if (hasFace || paras) { if (!hasFace && !paras) return null; emit(it); }
    else if (b.img) { /* picture only */ }
    // one-sided borders (a coloured bar on the left of a card, a rule under a heading) become thin rectangles
    if (!uniform) sd.forEach(function (s, i) {
      if (!s) return; var t = s.w;
      if (s.st === 'dashed' || s.st === 'dotted') {
        var yy = i === 0 ? g.y + t / 2 : i === 2 ? g.y + g.h - t / 2 : null, xx = i === 3 ? g.x + t / 2 : i === 1 ? g.x + g.w - t / 2 : null;
        emit({ k: 'line', x1: r1(xx === null ? g.x : xx), y1: r1(yy === null ? g.y : yy), x2: r1(xx === null ? g.x + g.w : xx), y2: r1(yy === null ? g.y + g.h : yy), w: t, c: s.c, a: s.a * op, dash: s.st === 'dashed' ? 'dash' : 'sysDot', name: nameOf(el) + ' rule' });
        return;
      }
      var rc = i === 0 ? { x: g.x, y: g.y, w: g.w, h: t } : i === 2 ? { x: g.x, y: g.y + g.h - t, w: g.w, h: t } : i === 1 ? { x: g.x + g.w - t, y: g.y, w: t, h: g.h } : { x: g.x, y: g.y, w: t, h: g.h };
      emit({ k: 'box', x: r1(rc.x), y: r1(rc.y), w: r1(rc.w), h: r1(rc.h), rot: g.rot, fill: { c: s.c, a: s.a * op }, name: nameOf(el) + ' rule' });
    });
    return it;
  }
  function b0(cs) { return layers(cs.backgroundImage).length > 0; }
  function pseudo(el, which, g, op) {
    var cs = gcs(el, which), content = cs.content; if (!content || content === 'none' || content === 'normal') return;
    if (cs.display === 'none' || !(cs.position === 'absolute' || cs.position === 'fixed')) return;
    if ((cs.webkitMaskImage && cs.webkitMaskImage !== 'none') || (cs.maskImage && cs.maskImage !== 'none') || (cs.backgroundSize && !/^auto( auto)?$/.test(cs.backgroundSize) && b0(cs))) return;   // a masked or tiled pattern (the faint grid) is not one flat shape
    var b = bgFor(cs, op); if (!b.fill && !b.grad) return;
    var parent = gcs(el), w = num(cs.width), h = num(cs.height), x, y;
    if (!w || !h) return;
    var pad = el.getBoundingClientRect(), pr = rel(pad), bw = num(parent.borderLeftWidth), bh = num(parent.borderTopWidth);
    var L = cs.left !== 'auto' ? num(cs.left) : null, R = cs.right !== 'auto' ? num(cs.right) : null, T = cs.top !== 'auto' ? num(cs.top) : null, B = cs.bottom !== 'auto' ? num(cs.bottom) : null;
    x = L !== null ? pr.x + bw + L : R !== null ? pr.x + pr.w - bw - R - w : pr.x; y = T !== null ? pr.y + bh + T : B !== null ? pr.y + pr.h - bh - B - h : pr.y;
    var rad = radiusOf(cs, { w: w, h: h });
    emit({ k: 'box', x: r1(x), y: r1(y), w: r1(w), h: r1(h), rot: 0, fill: b.fill ? { c: b.fill.c, a: b.fill.a * op } : null, grad: b.grad, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' accent', inner: true });
  }
  /** a short bar or dot drawn with ::before / ::after in line with the text (a kicker's dash). Returns how far the text is pushed right by it. */
  function pseudoInline(el, g, cs, op, paras) {
    var lead = 0;
    ['::before', '::after'].forEach(function (which) {
      var pc = gcs(el, which), content = pc.content; if (!content || content === 'none' || content === 'normal' || pc.position === 'absolute' || pc.position === 'fixed' || pc.display === 'none') return;
      var b = bgFor(pc, op), w = num(pc.width), h = num(pc.height); if (!(b.fill || b.grad) || !w || !h) return;
      var rng = root.ownerDocument.createRange(); rng.selectNodeContents(el); var rr = rel(rng.getBoundingClientRect()), first = paras && paras[0], lh = first ? first.lh * (first.sz || 16) : rr.h;
      var contentL = g.x + num(cs.borderLeftWidth) + num(cs.paddingLeft);
      var x = which === '::before' ? contentL : rr.x + rr.w + num(pc.marginLeft), y = rr.y + Math.min(lh, rr.h) / 2 - h / 2;
      var rad = radiusOf(pc, { w: w, h: h });
      emit({ k: 'box', x: r1(x), y: r1(y), w: r1(w), h: r1(h), rot: 0, fill: b.fill ? { c: b.fill.c, a: b.fill.a * op } : null, grad: b.grad, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' mark', inner: true });
      if (which === '::before') lead = Math.max(0, rr.x - contentL);
    });
    return lead;
  }
  function svgMarkup(el, skip) {
    var clone = el.cloneNode(true), a = [el].concat([].slice.call(el.querySelectorAll('*'))), b = [clone].concat([].slice.call(clone.querySelectorAll('*')));
    var P = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stop-opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'color'];
    for (var i = 0; i < a.length; i++) {
      var cs = gcs(a[i]), tag = a[i].tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || (skip && skip.indexOf(a[i]) > -1)) { b[i].parentNode && b[i].parentNode.removeChild(b[i]); continue; }
      var st = '';
      P.forEach(function (p) { var v = cs.getPropertyValue(p); if (v && v !== 'normal' && !(p === 'color')) st += p + ':' + v.replace(/"/g, "'") + ';'; });
      b[i].removeAttribute('class'); b[i].setAttribute('style', st);
    }
    var r = el.getBoundingClientRect(), w = r.width / SC, h = r.height / SC;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', r1(w)); clone.setAttribute('height', r1(h));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + r1(w) + ' ' + r1(h));
    return new win.XMLSerializer().serializeToString(clone);
  }
  /** the words inside an <svg> (axis labels, map labels, chart legends) as real text; the drawing is painted without them */
  function svgRuns(el, out, sc, o) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        var t = n.nodeValue.replace(/[\t\n\r\f ]+/g, ' '); if (!t) continue;
        var st = runStyle(el), cs = gcs(el), c = col(cs.fill), fo = cs.fillOpacity === '' ? 1 : (isNaN(parseFloat(cs.fillOpacity)) ? 1 : parseFloat(cs.fillOpacity));
        st.sz = (num(cs.fontSize) || 16) * sc; st.sp = (cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing)) * sc;
        st.c = c ? c.c : '000000'; st.a = (c ? c.a : 1) * fo * o; out.push(Object.assign({ t: tcase(t, st) }, st));
      } else if (n.nodeType === 1 && n.tagName.toLowerCase() === 'tspan') {
        var cs2 = gcs(n); if (cs2.display === 'none' || cs2.visibility === 'hidden') continue;
        var dy = n.getAttribute('dy'), nl = (dy && parseFloat(dy) !== 0) || n.hasAttribute('y');
        if (nl && out.length) out.push({ pb: 1 });
        svgRuns(n, out, sc, o);
      }
    }
  }
  function svgTexts(svg, op) {
    var items2 = [], skip = [];
    [].slice.call(svg.querySelectorAll('text')).forEach(function (t) {
      try {
        if (t.closest('defs,clipPath,mask,pattern,symbol,marker') || t.querySelector('textPath') || !/\S/.test(t.textContent || '')) return;
        var o = op, e = t;
        for (; e && e !== svg; e = e.parentNode) {
          if (e.nodeType !== 1) break; var cs = gcs(e);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          if (cs.opacity !== '' && !isNaN(parseFloat(cs.opacity))) { if (parseFloat(cs.opacity) === 0) return; o *= parseFloat(cs.opacity); }
        }
        var ctm = t.getScreenCTM(); if (!ctm) return;
        var sc = Math.hypot(ctm.a, ctm.b) / SC, rot = Math.atan2(ctm.b, ctm.a) * 180 / Math.PI; if (!(sc > 0)) return;
        var runs = []; svgRuns(t, runs, sc, o); var tcs = gcs(t);
        var anchor = tcs.textAnchor, al = anchor === 'middle' ? 'ctr' : anchor === 'end' ? 'r' : 'l', base = { al: al, lh: 1.2, sz: (num(tcs.fontSize) || 16) * sc };
        var paras = toParas(runs, base).filter(function (p) { return p.runs.length; }); if (!paras.length) return;
        var rg = root.ownerDocument.createRange(); rg.selectNodeContents(t); var bb = rel(rg.getBoundingClientRect()); if (bb.w < .5 || bb.h < .5) return;
        var turned = Math.abs(Math.abs(rot) - 90) < 8, ang = turned ? rot : (Math.abs(rot) < .8 ? 0 : rot);
        var w = turned ? bb.h : bb.w, h = turned ? bb.w : bb.h, cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
        if (paras.length > 1) paras.forEach(function (p) { p.lh = r1(Math.max(1, h / paras.length / (p.sz || 16))); });
        items2.push({ k: 'text', x: r1(cx - w / 2), y: r1(cy - h / 2), w: r1(w), h: r1(h), rot: r1(ang), paras: paras, ins: [0, 0, 0, 0], anchor: 'ctr', wrap: paras.length > 1 ? 'square' : 'none', name: 'Label', op: 1 });
        skip.push(t);
      } catch (x) { /* leave this label in the picture */ }
    });
    return { items: items2, skip: skip };
  }
  function svgItem(el, op, name) {
    var g = rel(el.getBoundingClientRect()); if (g.w < 1 || g.h < 1) return;
    try {
      var tx = svgTexts(el, op);
      emit({ k: 'svg', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), markup: svgMarkup(el, tx.skip), op: op, name: name || (el.getAttribute('aria-label') || 'Graphic'), alt: el.getAttribute('aria-label') || '' });
      tx.items.forEach(function (it) { emit(it); });
    } catch (e) { warn.push('A graphic could not be read: ' + e.message); }
  }
  function imgItem(el, op, cs) {
    var g = geom(el, cs), rad = radiusOf(cs, g), b = bgFor(cs, op), sd = sides(cs, g), sh = shadowOf(cs);
    var uniform = sd[0] && sd[1] && sd[2] && sd[3] && sd[0].w === sd[1].w && sd[0].w === sd[2].w && sd[0].w === sd[3].w && sd[0].c === sd[1].c && sd[0].c === sd[3].c && sd[0].c === sd[2].c;
    var line = uniform ? { w: sd[0].w, c: sd[0].c, a: sd[0].a * op, dash: sd[0].st === 'dashed' ? 'dash' : sd[0].st === 'dotted' ? 'sysDot' : 'solid' } : null;
    var box = { x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, rad: rad.r, radMode: rad.mode, circle: rad.circle }, cp = clipPoly(cs, el.offsetWidth || g.w, el.offsetHeight || g.h);
    if (b.fill || b.grad || sh) emit(Object.assign({ k: 'box', fill: b.fill, grad: b.grad, shadow: sh, name: 'Picture backdrop', op: op }, box));   // behind a contained picture, and the carrier of its shadow
    var inset = line ? line.w / 2 : 0;                                                  // a PowerPoint outline is centred on the edge, a CSS border sits inside it
    emit({ k: 'img', x: r1(g.x + inset), y: r1(g.y + inset), w: r1(g.w - 2 * inset), h: r1(g.h - 2 * inset), rot: g.rot, src: el.currentSrc || el.src, fit: cs.objectFit || 'fill', pos: cs.objectPosition, rad: Math.max(0, rad.r - inset), circle: rad.circle, line: line, clip: cp, name: 'Picture', alt: el.getAttribute('alt') || '', op: op });
  }
  function recordObjs(layer) {
    [].slice.call(layer.children).forEach(function (ob) {
      var id = ob.getAttribute('data-obj'); if (!id) return;
      var t = ob.querySelector('.ob-t'), rec = { h: ob.offsetHeight, w: ob.offsetWidth };
      if (t) {
        var ps = isTextBlock(t) ? textParas(t) : (mergeParas(t, rel(t.getBoundingClientRect())) || []);
        rec.paras = ps; rec.wrapOne = ps.length === 1 && !ps[0].runs.some(function (r) { return r.br; }) && rel(t.getBoundingClientRect()).h < (ps[0].lh || 1.2) * (ps[0].sz || 16) * 1.6;
        var tx = ob.querySelector('.ob-txt'); if (tx) { var cs = gcs(tx); rec.pad = [num(cs.paddingLeft), num(cs.paddingTop), num(cs.paddingRight), num(cs.paddingBottom)]; }
      }
      var sv = ob.getAttribute('data-type') === 'icon' ? ob.querySelector('svg') : null; if (sv) { try { rec.svg = svgMarkup(sv); } catch (e) { /* skip */ } }
      objs[id] = rec;
    });
  }
  /** a blurred coloured shape (the soft glows in the themes): PowerPoint cannot blur, so the blur is painted once into a picture */
  function glowItem(el, cs, op, blur) {
    var g = rel(el.getBoundingClientRect()), b = bgFor(cs, 1), c = b.fill || (b.grad && b.grad.stops[0] ? { c: b.grad.stops[0].c, a: 1 } : null); if (!c || g.w < 4 || g.h < 4) return;
    try {
      var pad = Math.ceil(blur * 2.5), k = Math.min(1, 320 / (g.w + 2 * pad), 320 / (g.h + 2 * pad)), cv = root.ownerDocument.createElement('canvas'); cv.width = Math.max(2, Math.round((g.w + 2 * pad) * k)); cv.height = Math.max(2, Math.round((g.h + 2 * pad) * k));
      var x = cv.getContext('2d'), rad = radiusOf(cs, g); x.filter = 'blur(' + (blur * k) + 'px)'; x.fillStyle = '#' + c.c; x.globalAlpha = c.a;
      x.beginPath(); if (rad.circle) x.ellipse(cv.width / 2, cv.height / 2, g.w * k / 2, g.h * k / 2, 0, 0, 7); else if (x.roundRect) x.roundRect(pad * k, pad * k, g.w * k, g.h * k, rad.r * k); else x.rect(pad * k, pad * k, g.w * k, g.h * k); x.fill();
      emit({ k: 'img', x: r1(g.x - pad), y: r1(g.y - pad), w: r1(g.w + 2 * pad), h: r1(g.h + 2 * pad), src: cv.toDataURL('image/png'), fit: 'fill', name: 'Glow', alt: '', op: op });
    } catch (e) { warn.push('A soft glow could not be exported.'); }
  }
  /** children in the order the browser paints them: layers with a negative z-index first, ordinary content, then positioned content, then higher z-index (DOM order within each) */
  function paintOrder(el) {
    var kids = [].slice.call(el.childNodes), flex = /flex|grid/.test(gcs(el).display), varied = false;
    var key = kids.map(function (n) {
      if (n.nodeType !== 1) return 0;
      var cs = gcs(n), z = cs.zIndex, pos = cs.position !== 'static', zn = z === 'auto' ? NaN : parseInt(z, 10);
      var k = !isNaN(zn) && (pos || flex) ? (zn < 0 ? zn : zn + 1) : pos ? .5 : 0;
      if (k !== 0) varied = true; return k;
    });
    if (!varied) return kids;
    return kids.map(function (n, i) { return { n: n, k: key[i], i: i }; }).sort(function (a, b) { return a.k - b.k || a.i - b.i; }).map(function (o) { return o.n; });
  }
  var curEl = null;
  function emit(it) { it._el = curEl; items.push(it); }
  function visit(el, op, top) { var prev = curEl; curEl = el; try { visitOne(el, op, top); } finally { curEl = prev; } }
  function visitOne(el, op, top) {
    try {
      var cs = gcs(el), tag = el.tagName.toLowerCase();
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var o = num(cs.opacity); if (cs.opacity !== '' && o === 0) return; op = op * (cs.opacity === '' || isNaN(parseFloat(cs.opacity)) ? 1 : o);
      if (/^(script|style|noscript|template|link|meta|head)$/.test(tag)) return;
      if (el.classList && el.classList.contains('objs')) { recordObjs(el); return; }
      if (el.hasAttribute && el.hasAttribute('data-pc-skip')) return;
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') { if (tag === 'svg') svgItem(el, op); return; }
      if (tag === 'img') { imgItem(el, op, cs); return; }
      if (tag === 'canvas') { try { emit({ k: 'img', x: 0, y: 0, w: 0, h: 0, src: el.toDataURL('image/png'), fit: 'fill', name: 'Canvas', alt: '', op: op }); var g0 = rel(el.getBoundingClientRect()); var li = items[items.length - 1]; li.x = r1(g0.x); li.y = r1(g0.y); li.w = r1(g0.w); li.h = r1(g0.h); } catch (e) { warn.push('A canvas could not be read.'); } return; }
      if (/^(iframe|video|audio|object|embed)$/.test(tag)) { if (tag === 'iframe' && el.classList.contains('cs-frame')) return; warn.push('A ' + tag + ' cannot be exported.'); return; }
      var f = cs.filter || ''; var bm = f.match(/blur\(([\d.]+)px\)/); if (bm && parseFloat(bm[1]) >= 8 && !(bgFor(cs, 1).layers.length)) { glowItem(el, cs, op, parseFloat(bm[1])); return; }   // a gradient glow is already soft: it goes through as a gradient shape      // soft glows become one soft-edged picture
      var g = geom(el, cs), isRoot = top === true, promoted = false;
      curClip = null;
      if (!isRoot) {
        var ol = outlineOf(el, cs, g);
        if (ol) { curClip = ol.pts; if (ol.box.x !== g.x || ol.box.y !== g.y || ol.box.w !== g.w || ol.box.h !== g.h) { g = { x: ol.box.x, y: ol.box.y, w: ol.box.w, h: ol.box.h, rot: 0 }; } }
        // a full-slide wrapper that carries the design's background (stacked glows, a gradient) IS the slide background, not a shape on top of it
        if (!bgOver && !items.length && op === 1 && !curClip && !g.rot && g.x <= 3 && g.y <= 3 && g.w >= SW * .97 && g.h >= SH * .97) {
          var pb = bgFor(cs, 1);
          if ((pb.layers.length || pb.fill || pb.img) && !sides(cs, g).some(Boolean) && !shadowOf(cs)) { bgOver = pb; promoted = true; }
        }
      }
      if (!isRoot) {
        var role = null, dp = el.getAttribute && el.getAttribute('data-path');
        var paras = null; if (isTextBlock(el)) paras = textParas(el); else if (!el.classList.contains('deco')) paras = mergeParas(el, g);
        if (paras && !paras.length) paras = null;
        var bx = !promoted && (boxy(cs) || (shadowOf(cs) && col(cs.backgroundColor)));
        pseudo(el, '::before', g, op);
        if (bx) { var it = pushBox(el, cs, g, op, paras); if (paras) { if (it) { it.role = roleOf(el, dp); it.tag = el.tagName; } pseudo(el, '::after', g, op); return; } }
        else if (paras) {
          var lead = hasDeco(el) ? pseudoInline(el, g, cs, op, paras) : 0;
          var tf = textFrame(el, g, cs, paras, false, lead);
          emit({ k: 'text', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, paras: paras, ins: tf.ins, anchor: tf.anchor, wrap: tf.wrap, name: nameOf(el), role: roleOf(el, dp), tag: el.tagName, op: op });
          return;
        }
      }
      var run = [];
      var flush = function () {
        if (!run.length) return; var r = run; run = [];
        if (r.length === 1) { visit(r[0], op, false); return; }
        var rs = r.map(function (e) { return rel(e.getBoundingClientRect()); }).filter(function (q) { return q.w > 0 && q.h > 0; });
        if (!rs.length) return;
        var x0 = Math.min.apply(null, rs.map(function (q) { return q.x; })), y0 = Math.min.apply(null, rs.map(function (q) { return q.y; })), x1 = Math.max.apply(null, rs.map(function (q) { return q.x + q.w; })), y1 = Math.max.apply(null, rs.map(function (q) { return q.y + q.h; }));
        var u = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, ps = mergeKids(r, u);
        if (!ps) { r.forEach(function (e) { visit(e, op, false); }); return; }
        emit({ k: 'text', x: r1(u.x), y: r1(u.y), w: r1(u.w), h: r1(u.h), rot: 0, paras: ps, ins: [0, 0, 0, 0], anchor: 't', wrap: 'square', name: 'text', role: null, op: op });
      };
      var order = paintOrder(el);
      for (var oi = 0; oi < order.length; oi++) { var n = order[oi];
        if (n.nodeType === 1) {
          if ((n.tagName === 'UL' || n.tagName === 'OL' || isTextBlock(n)) && plainText(n) && !n.classList.contains('deco') && !n.querySelector('.ob')) run.push(n); else { flush(); visit(n, op, false); }
        } else if (n.nodeType === 3 && /\S/.test(n.nodeValue)) {
          flush();
          var rng = root.ownerDocument.createRange(); rng.selectNode(n); var rr = rel(rng.getBoundingClientRect());
          var st = runStyle(el), t = n.nodeValue.replace(/[\t\n\r\f ]+/g, ' ').trim(); if (!t) continue;
          var pb = Object.assign({ t: tcase(t, st) }, st);
          emit({ k: 'text', x: r1(rr.x), y: r1(rr.y), w: r1(rr.w + 2), h: r1(rr.h), rot: 0, paras: [Object.assign({ runs: [pb] }, paraBase(el))], ins: [0, 0, 0, 0], anchor: 't', wrap: 'none', name: 'text', op: op });
        }
      }
      flush();
      if (!isRoot) pseudo(el, '::after', g, op);
    } catch (e) { warn.push('Skipped an element (' + (e && e.message) + ')'); }
  }
  function roleOf(el, dp) { return /^H1$/.test(el.tagName) || dp === 'headline' || dp === 'title' ? 'title' : null; }

  /** what a pixel-shaped container (overflow hidden / clip, with or without rounded corners) leaves visible of a picture, graphic or box that sticks out of it */
  function clipPass() {
    var kept = [];
    items.forEach(function (it) {
      var el = it._el; delete it._el;
      if (!el || (it.k !== 'img' && it.k !== 'svg' && it.k !== 'box') || it.rot || it.clip || it.paras) { kept.push(it); return; }
      var x0 = it.x, y0 = it.y, x1 = it.x + it.w, y1 = it.y + it.h, holder = null, bounded = false;
      for (var a = it.inner ? el : el.parentElement; a; a = a.parentElement) {
        var cs = gcs(a), cx = cs.overflowX !== 'visible', cy = cs.overflowY !== 'visible', isRoot = a === root;
        if ((cx || cy) && !(a.namespaceURI === 'http://www.w3.org/2000/svg')) {
          var r = rel(a.getBoundingClientRect()), px0 = r.x + num(cs.borderLeftWidth), py0 = r.y + num(cs.borderTopWidth), px1 = r.x + r.w - num(cs.borderRightWidth), py1 = r.y + r.h - num(cs.borderBottomWidth);
          if (cx) { x0 = Math.max(x0, px0); x1 = Math.min(x1, px1); } if (cy) { y0 = Math.max(y0, py0); y1 = Math.min(y1, py1); }
          if (!holder) { var rd = radiusOf(cs, { w: px1 - px0, h: py1 - py0 }); if (rd.r > .5) holder = { rd: rd, x: px0, y: py0, w: px1 - px0, h: py1 - py0 }; }
          if (isRoot) bounded = true;
        }
        if (isRoot) break;
      }
      if (!bounded) { x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, SW); y1 = Math.min(y1, SH); }   // nothing outside the slide itself
      if (x1 - x0 < .5 || y1 - y0 < .5) return;                                       // entirely hidden by its container
      if (Math.abs(x0 - it.x) < .5 && Math.abs(y0 - it.y) < .5 && Math.abs(x1 - (it.x + it.w)) < .5 && Math.abs(y1 - (it.y + it.h)) < .5) { kept.push(it); return; }
      if (it.k === 'img' || it.k === 'svg') {
        it.full = { x: it.x, y: it.y, w: it.w, h: it.h };
        if (holder && Math.abs(x0 - holder.x) < 1.5 && Math.abs(y0 - holder.y) < 1.5 && Math.abs(x1 - (holder.x + holder.w)) < 1.5 && Math.abs(y1 - (holder.y + holder.h)) < 1.5 && !(it.rad > .5)) {
          it.rad = holder.rd.r; it.radMode = holder.rd.mode; it.circle = holder.rd.circle;                 // a photo cropped into a circle or an arch takes that shape
        }
      }
      it.x = r1(x0); it.y = r1(y0); it.w = r1(x1 - x0); it.h = r1(y1 - y0); kept.push(it);
    });
    items = kept;
  }
  var rcs = gcs(root), rb = bgFor(rcs, 1), bgOver = null, SW = RB.width / SC, SH = RB.height / SC;
  visit(root, 1, true);
  clipPass();
  if (bgOver) { if (!bgOver.fill && rcs && col(rcs.backgroundColor)) bgOver.fill = col(rcs.backgroundColor); rb = bgOver; }
  return { bg: { fill: rb.fill, grad: rb.grad, img: rb.img, layers: rb.layers.slice(0, 8) }, items: items, objs: objs, warn: warn, fonts: Object.keys(fonts) };
}
window.PC = window.PC || {};
PC.walk = pcWalk;
PC.walkSrc = pcWalk.toString();
})();
