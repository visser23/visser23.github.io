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
  function layers(bg) {
    var out = []; if (!bg || bg === 'none') return out;
    splitTop(bg).forEach(function (p) {
      var g = p.match(/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/), u = p.match(/^url\((['"]?)([\s\S]*?)\1\)$/);
      if (g && !g[1] && g[2] !== 'conic') out.push({ grad: parseGrad(g[2], g[3]) }); else if (u) out.push({ url: u[2] });
    });
    return out;
  }
  function parseGrad(kind, body) {
    var parts = splitTop(body), first = parts[0], ang = 180, radial = kind === 'radial', at = [50, 50];
    if (!radial && /^(-?[\d.]+(deg|turn|rad|grad)|to )/.test(first)) {
      parts.shift();
      var m = first.match(/^(-?[\d.]+)(deg|turn|rad|grad)/);
      if (m) { var v = parseFloat(m[1]); ang = m[2] === 'turn' ? v * 360 : m[2] === 'rad' ? v * 180 / Math.PI : m[2] === 'grad' ? v * .9 : v; }
      else { var dir = first.replace('to ', ''); ang = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 }[dir] || 180; }
    } else if (radial && !/^(rgb|color|hsl|#|transparent)/.test(first)) {
      parts.shift(); var am = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/); if (am) at = [parseFloat(am[1]), parseFloat(am[2])];
    }
    var stops = parts.map(function (p) {
      var pm = p.match(/\s+(-?[\d.]+)%\s*$/), pos = pm ? parseFloat(pm[1]) : null, c = col(pm ? p.slice(0, pm.index) : p);
      return { p: pos, c: c ? c.c : null, a: c ? c.a : 0 };
    });
    if (stops.length < 2) return null;
    stops.forEach(function (s) { if (s.c === null) s.c = null; });
    var prev = stops.find(function (s) { return s.c; }) || { c: '000000' };
    stops.forEach(function (s) { if (!s.c) s.c = prev.c; else prev = s; });          // transparent stops take the neighbour's hue, so fades do not turn grey
    if (stops[0].p === null) stops[0].p = 0; if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 100;
    for (var i = 1; i < stops.length - 1; i++) if (stops[i].p === null) { var j = i; while (stops[j].p === null) j++; var step = (stops[j].p - stops[i - 1].p) / (j - i + 1); for (var k = i; k < j; k++) stops[k].p = stops[k - 1].p + step; }
    return { ang: ((ang - 90) % 360 + 360) % 360, radial: radial, at: at, stops: stops.map(function (s) { return { p: Math.max(0, Math.min(100, s.p)), c: s.c, a: s.a }; }) };
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
  function boxy(cs) {
    if (col(cs.backgroundColor)) return true;
    if (layers(cs.backgroundImage).length) return true;
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
    var top = r[0] > 0 && r[1] > 0 && !r[2] && !r[3], bot = !r[0] && !r[1] && r[2] > 0 && r[3] > 0;
    return { r: Math.min(mx, m / 2), mode: top ? 'top' : bot ? 'bottom' : 'all', circle: mx >= m / 2 - .5 && Math.abs(g.w - g.h) < 3 };
  }
  function shadowOf(cs) {
    var v = cs.boxShadow; if (!v || v === 'none') return null;
    var first = splitTop(v)[0]; if (!first || /inset/.test(first)) return null;
    var cm = first.match(/(rgba?\([^)]+\)|color\([^)]+\)|#[0-9a-f]{3,8})/i), c = cm ? col(cm[1]) : null; if (!c) return null;
    var nums = first.replace(cm[1], '').trim().split(/\s+/).map(num);
    return { dx: nums[0] || 0, dy: nums[1] || 0, blur: nums[2] || 0, c: c.c, a: c.a };
  }
  function bgFor(cs, op) {
    var ls = layers(cs.backgroundImage), out = { fill: null, grad: null, img: null, over: null }, c = col(cs.backgroundColor);
    if (c) out.fill = { c: c.c, a: c.a * op };
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
    return { ins: ins.map(r1), anchor: anchor, wrap: oneLine ? 'none' : 'square', rr: rr };
  }
  function pushBox(el, cs, g, op, paras) {
    var b = bgFor(cs, op), sd = sides(cs, g), rad = radiusOf(cs, g), sh = shadowOf(cs);
    var uniform = sd[0] && sd[1] && sd[2] && sd[3] && sd[0].w === sd[1].w && sd[0].w === sd[2].w && sd[0].w === sd[3].w && sd[0].c === sd[1].c && sd[0].c === sd[3].c && sd[0].c === sd[2].c;
    var line = uniform ? { w: sd[0].w, c: sd[0].c, a: sd[0].a * op, dash: sd[0].st === 'dashed' ? 'dash' : sd[0].st === 'dotted' ? 'sysDot' : 'solid' } : null;
    var hasFace = b.fill || b.grad || line;
    if (b.over && b.fill) items.push({ k: 'box', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, fill: b.fill, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' colour' });
    if (b.img) items.push({ k: 'img', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, src: b.img.src, size: b.img.size, pos: b.img.pos, rad: rad.r, circle: rad.circle, name: nameOf(el) + ' picture', alt: '' });
    var it = { k: 'box', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, fill: b.over ? null : b.fill, grad: b.grad, line: line, rad: rad.r, radMode: rad.mode, circle: rad.circle, shadow: hasFace ? sh : null, name: nameOf(el), op: op };
    if (paras) { var tf = textFrame(el, g, cs, paras, true); it.paras = paras; it.ins = tf.ins; it.anchor = tf.anchor; it.wrap = tf.wrap; }
    if (hasFace || paras) { if (!hasFace && !paras) return null; items.push(it); }
    else if (b.img) { /* picture only */ }
    // one-sided borders (a coloured bar on the left of a card, a rule under a heading) become thin rectangles
    if (!uniform) sd.forEach(function (s, i) {
      if (!s) return; var t = s.w;
      if (s.st === 'dashed' || s.st === 'dotted') {
        var yy = i === 0 ? g.y + t / 2 : i === 2 ? g.y + g.h - t / 2 : null, xx = i === 3 ? g.x + t / 2 : i === 1 ? g.x + g.w - t / 2 : null;
        items.push({ k: 'line', x1: r1(xx === null ? g.x : xx), y1: r1(yy === null ? g.y : yy), x2: r1(xx === null ? g.x + g.w : xx), y2: r1(yy === null ? g.y + g.h : yy), w: t, c: s.c, a: s.a * op, dash: s.st === 'dashed' ? 'dash' : 'sysDot', name: nameOf(el) + ' rule' });
        return;
      }
      var rc = i === 0 ? { x: g.x, y: g.y, w: g.w, h: t } : i === 2 ? { x: g.x, y: g.y + g.h - t, w: g.w, h: t } : i === 1 ? { x: g.x + g.w - t, y: g.y, w: t, h: g.h } : { x: g.x, y: g.y, w: t, h: g.h };
      items.push({ k: 'box', x: r1(rc.x), y: r1(rc.y), w: r1(rc.w), h: r1(rc.h), rot: g.rot, fill: { c: s.c, a: s.a * op }, name: nameOf(el) + ' rule' });
    });
    return it;
  }
  function pseudo(el, which, g, op) {
    var cs = gcs(el, which), content = cs.content; if (!content || content === 'none' || content === 'normal') return;
    if (cs.display === 'none' || !(cs.position === 'absolute' || cs.position === 'fixed')) return;
    var b = bgFor(cs, op); if (!b.fill && !b.grad) return;
    var parent = gcs(el), w = num(cs.width), h = num(cs.height), x, y;
    if (!w || !h) return;
    var pad = el.getBoundingClientRect(), pr = rel(pad), bw = num(parent.borderLeftWidth), bh = num(parent.borderTopWidth);
    var L = cs.left !== 'auto' ? num(cs.left) : null, R = cs.right !== 'auto' ? num(cs.right) : null, T = cs.top !== 'auto' ? num(cs.top) : null, B = cs.bottom !== 'auto' ? num(cs.bottom) : null;
    x = L !== null ? pr.x + bw + L : R !== null ? pr.x + pr.w - bw - R - w : pr.x; y = T !== null ? pr.y + bh + T : B !== null ? pr.y + pr.h - bh - B - h : pr.y;
    var rad = radiusOf(cs, { w: w, h: h });
    items.push({ k: 'box', x: r1(x), y: r1(y), w: r1(w), h: r1(h), rot: 0, fill: b.fill ? { c: b.fill.c, a: b.fill.a * op } : null, grad: b.grad, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' accent' });
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
      items.push({ k: 'box', x: r1(x), y: r1(y), w: r1(w), h: r1(h), rot: 0, fill: b.fill ? { c: b.fill.c, a: b.fill.a * op } : null, grad: b.grad, rad: rad.r, radMode: rad.mode, circle: rad.circle, name: nameOf(el) + ' mark' });
      if (which === '::before') lead = Math.max(0, rr.x - contentL);
    });
    return lead;
  }
  function svgMarkup(el) {
    var clone = el.cloneNode(true), a = [el].concat([].slice.call(el.querySelectorAll('*'))), b = [clone].concat([].slice.call(clone.querySelectorAll('*')));
    var P = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stop-opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'color'];
    for (var i = 0; i < a.length; i++) {
      var cs = gcs(a[i]), tag = a[i].tagName.toLowerCase();
      if (tag === 'style' || tag === 'script') { b[i].parentNode && b[i].parentNode.removeChild(b[i]); continue; }
      var st = '';
      P.forEach(function (p) { var v = cs.getPropertyValue(p); if (v && v !== 'normal' && !(p === 'color')) st += p + ':' + v.replace(/"/g, "'") + ';'; });
      b[i].removeAttribute('class'); b[i].setAttribute('style', st);
    }
    var r = el.getBoundingClientRect(), w = r.width / SC, h = r.height / SC;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', r1(w)); clone.setAttribute('height', r1(h));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + r1(w) + ' ' + r1(h));
    return new win.XMLSerializer().serializeToString(clone);
  }
  function svgItem(el, op, name) {
    var g = rel(el.getBoundingClientRect()); if (g.w < 1 || g.h < 1) return;
    try { items.push({ k: 'svg', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), markup: svgMarkup(el), op: op, name: name || (el.getAttribute('aria-label') || 'Graphic'), alt: el.getAttribute('aria-label') || '' }); } catch (e) { warn.push('A graphic could not be read: ' + e.message); }
  }
  function imgItem(el, op, cs) {
    var g = geom(el, cs), rad = radiusOf(cs, g);
    items.push({ k: 'img', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, src: el.currentSrc || el.src, fit: cs.objectFit || 'fill', pos: cs.objectPosition, rad: rad.r, circle: rad.circle, name: 'Picture', alt: el.getAttribute('alt') || '', op: op });
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
  function visit(el, op, top) {
    try {
      var cs = gcs(el), tag = el.tagName.toLowerCase();
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var o = num(cs.opacity); if (cs.opacity !== '' && o === 0) return; op = op * (cs.opacity === '' || isNaN(parseFloat(cs.opacity)) ? 1 : o);
      if (/^(script|style|noscript|template|link|meta|head)$/.test(tag)) return;
      if (el.classList && el.classList.contains('objs')) { recordObjs(el); return; }
      if (el.hasAttribute && el.hasAttribute('data-pc-skip')) return;
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') { if (tag === 'svg') svgItem(el, op); return; }
      if (tag === 'img') { imgItem(el, op, cs); return; }
      if (tag === 'canvas') { try { items.push({ k: 'img', x: 0, y: 0, w: 0, h: 0, src: el.toDataURL('image/png'), fit: 'fill', name: 'Canvas', alt: '', op: op }); var g0 = rel(el.getBoundingClientRect()); var li = items[items.length - 1]; li.x = r1(g0.x); li.y = r1(g0.y); li.w = r1(g0.w); li.h = r1(g0.h); } catch (e) { warn.push('A canvas could not be read.'); } return; }
      if (/^(iframe|video|audio|object|embed)$/.test(tag)) { if (tag === 'iframe' && el.classList.contains('cs-frame')) return; warn.push('A ' + tag + ' cannot be exported.'); return; }
      var f = cs.filter || ''; var bm = f.match(/blur\(([\d.]+)px\)/); if (bm && parseFloat(bm[1]) >= 8) return;      // soft glows have no PowerPoint equivalent that looks right
      var g = geom(el, cs);
      var isRoot = top === true;
      if (!isRoot) {
        var role = null, dp = el.getAttribute && el.getAttribute('data-path');
        var paras = null; if (isTextBlock(el)) paras = textParas(el); else if (!el.classList.contains('deco')) paras = mergeParas(el, g);
        if (paras && !paras.length) paras = null;
        var bx = boxy(cs) || (shadowOf(cs) && col(cs.backgroundColor));
        pseudo(el, '::before', g, op);
        if (bx) { var it = pushBox(el, cs, g, op, paras); if (paras) { if (it) { it.role = roleOf(el, dp); } pseudo(el, '::after', g, op); return; } }
        else if (paras) {
          var lead = hasDeco(el) ? pseudoInline(el, g, cs, op, paras) : 0;
          var tf = textFrame(el, g, cs, paras, false, lead);
          items.push({ k: 'text', x: r1(g.x), y: r1(g.y), w: r1(g.w), h: r1(g.h), rot: g.rot, paras: paras, ins: tf.ins, anchor: tf.anchor, wrap: tf.wrap, name: nameOf(el), role: roleOf(el, dp), op: op });
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
        items.push({ k: 'text', x: r1(u.x), y: r1(u.y), w: r1(u.w), h: r1(u.h), rot: 0, paras: ps, ins: [0, 0, 0, 0], anchor: 't', wrap: 'square', name: 'text', role: null, op: op });
      };
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1) {
          if ((n.tagName === 'UL' || n.tagName === 'OL' || isTextBlock(n)) && plainText(n) && !n.classList.contains('deco') && !n.querySelector('.ob')) run.push(n); else { flush(); visit(n, op, false); }
        } else if (n.nodeType === 3 && /\S/.test(n.nodeValue)) {
          flush();
          var rng = root.ownerDocument.createRange(); rng.selectNode(n); var rr = rel(rng.getBoundingClientRect());
          var st = runStyle(el), t = n.nodeValue.replace(/[\t\n\r\f ]+/g, ' ').trim(); if (!t) continue;
          var pb = Object.assign({ t: tcase(t, st) }, st);
          items.push({ k: 'text', x: r1(rr.x), y: r1(rr.y), w: r1(rr.w + 2), h: r1(rr.h), rot: 0, paras: [Object.assign({ runs: [pb] }, paraBase(el))], ins: [0, 0, 0, 0], anchor: 't', wrap: 'none', name: 'text', op: op });
        }
      }
      flush();
      if (!isRoot) pseudo(el, '::after', g, op);
    } catch (e) { warn.push('Skipped an element (' + (e && e.message) + ')'); }
  }
  function roleOf(el, dp) { return /^H1$/.test(el.tagName) || dp === 'headline' || dp === 'title' ? 'title' : null; }

  var rcs = gcs(root), rb = bgFor(rcs, 1);
  visit(root, 1, true);
  return { bg: { fill: rb.fill, grad: rb.grad, img: rb.img }, items: items, objs: objs, warn: warn, fonts: Object.keys(fonts) };
}
window.PC = window.PC || {};
PC.walk = pcWalk;
PC.walkSrc = pcWalk.toString();
})();
