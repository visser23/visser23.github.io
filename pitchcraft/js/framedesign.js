/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT frame design — select, move, resize and restyle the elements of an HTML slide, in the editor canvas.

   An HTML slide is a sandboxed iframe, so the editor cannot touch its DOM. This file has two halves:
     1. `pcDesign`, a self-contained function whose source text is injected into the frame in live mode (like pcWalk). It numbers
        the slide's own elements in document order, draws a selection overlay (a shadow-DOM host outside the slide, so it is never
        exported, audited or styled by the slide), moves / resizes / restyles the selected elements, and reports what it did as
        {pc:'style', changes:[{i, tag, sig, set, del}]}. Moves use the `translate` property (or left/top when the element is
        positioned and that is exact); resizes use width/height. Everything it writes is an inline `style` declaration.
     2. Parent helpers (PC.design): `cleanDecl` (the one whitelist of properties and values, shared with the frame), `mergeStyle`,
        `applyStyles` and `structure`, which re-parse the stored HTML, require the same tag / id / class / text at element i, and
        write the validated declarations back. Anything the frame says is untrusted data: forged messages are refused here.
   Classic script, no PC globals inside the injected functions.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC = window.PC || {};
const D = PC.design = {};

/** Every property the designer may write, and the only ones the parent will accept. */
D.PROPS = ['color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'text-transform', 'text-decoration-line',
  'line-height', 'letter-spacing', 'opacity', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'left', 'top', 'right', 'bottom', 'translate', 'z-index',
  'position', 'flex', 'border-radius', 'border-width', 'border-style', 'border-color', 'padding', 'box-shadow', 'text-shadow', 'object-fit'];

/* ── validation (also injected into the frame, so it must stay self-contained) ── */
function cleanDecl(prop, value) {
  var v = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!v || v.length > 240 || /[;{}<>\\@]|url\s*\(|expression|javascript|image-set|attr\s*\(|!\s*important|\/\*|\*\/|data:/i.test(v)) return null;
  var len = function (s, neg, max) {
    var m = /^(-?(?:\d+\.?\d*|\.\d+))(px|em|rem|%|vw|vh|pt)?$/.exec(s); if (!m) return false;
    var n = parseFloat(m[1]); if (!neg && n < 0) return false; if (!m[2] && n !== 0) return false; return Math.abs(n) <= (max || 10000);
  };
  var lens = function (s, neg, max, many) { var p = s.split(' '); if (p.length > many) return false; for (var k = 0; k < p.length; k++) if (!len(p[k], neg, max)) return false; return true; };
  var color = function (s) { return /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,30}|(?:rgb|hsl)a?\([\d\s.,%\/-]+\)|var\(--[\w-]+\))$/i.test(s); };
  var shadow = function (s) { return s === 'none' || (/^[\w\s.,()#%\/-]{1,200}$/.test(s) && !/[()]/.test(s.replace(/(?:rgba?|hsla?|var)\([^()]*\)/g, ''))); };
  var ok;
  switch (prop) {
    case 'color': case 'background-color': case 'border-color': ok = color(v); break;
    case 'background-image': ok = v === 'none'; break;
    case 'font-family': { var f = v.replace(/var\(--[\w-]+\)/g, ''); ok = /^[\p{L}\p{N} ,'"._&+-]*$/u.test(f); break; }
    case 'font-size': ok = len(v, false, 2000) && parseFloat(v) > 0; break;
    case 'font-weight': ok = /^(?:[1-9]00|normal|bold|bolder|lighter)$/.test(v); break;
    case 'font-style': ok = /^(?:normal|italic|oblique)$/.test(v); break;
    case 'text-align': ok = /^(?:left|right|center|justify|start|end)$/.test(v); break;
    case 'text-transform': ok = /^(?:none|uppercase|lowercase|capitalize)$/.test(v); break;
    case 'text-decoration-line': ok = /^(?:none|(?:underline|line-through|overline)(?: (?:underline|line-through|overline)){0,2})$/.test(v); break;
    case 'line-height': ok = v === 'normal' || (/^\d*\.?\d+$/.test(v) && parseFloat(v) >= 0.5 && parseFloat(v) <= 6) || len(v, false, 1000); break;
    case 'letter-spacing': ok = v === 'normal' || len(v, true, 200); break;
    case 'opacity': ok = /^\d*\.?\d+$/.test(v) && parseFloat(v) >= 0 && parseFloat(v) <= 1; break;
    case 'width': case 'height': case 'min-width': case 'min-height': case 'max-width': case 'max-height': ok = /^(?:auto|none|fit-content|max-content|min-content)$/.test(v) || len(v, false, 6000); break;
    case 'left': case 'top': case 'right': case 'bottom': ok = v === 'auto' || len(v, true, 6000); break;
    case 'translate': ok = v === 'none' || lens(v, true, 6000, 2); break;
    case 'z-index': ok = /^(?:auto|-?\d{1,5})$/.test(v); break;
    case 'position': ok = v === 'relative'; break;
    case 'flex': ok = v === 'none' || v === '0 0 auto'; break;
    case 'border-radius': case 'border-width': case 'padding': ok = lens(v, false, 2000, 4); break;
    case 'border-style': ok = /^(?:none|solid|dashed|dotted|double)$/.test(v); break;
    case 'box-shadow': case 'text-shadow': ok = shadow(v); break;
    case 'object-fit': ok = /^(?:fill|contain|cover|none|scale-down)$/.test(v); break;
    default: ok = false;
  }
  return ok ? v : null;
}

/** What identifies an element between the frame and the stored HTML: tag, id, class, child count and its own text. */
function sigOf(el) {
  var t = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue;
  return el.tagName + '|' + (el.getAttribute('id') || '') + '|' + (el.getAttribute('class') || '').slice(0, 80) + '|' + el.childElementCount + '|' + t.replace(/\s+/g, ' ').trim().slice(0, 60);
}
D.cleanDecl = cleanDecl; D.sigOf = sigOf;

/* ── the style attribute ── */
function splitDecls(text) {
  const out = []; let cur = '', q = '', depth = 0;
  for (const ch of String(text || '')) {
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && !depth) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean).map(s => { const k = s.indexOf(':'); return k < 0 ? { raw: s, name: '' } : { raw: s, name: s.slice(0, k).trim().toLowerCase() }; });
}
/** Set and delete declarations in a style attribute, leaving every other declaration exactly as it was written. */
D.mergeStyle = function (attr, set, del) {
  let decls = splitDecls(attr);
  (del || []).forEach(n => { decls = decls.filter(d => d.name !== n); });
  Object.keys(set || {}).forEach(n => {
    if (n === 'background-color') decls = decls.filter(d => !(d.name === 'background' && /^background\s*:\s*(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([^)]*\)|var\(--[\w-]+\))\s*$/i.test(d.raw)));   // a plain-colour shorthand is replaced, not stacked under
    const idx = decls.map(d => d.name).lastIndexOf(n);
    decls = decls.filter((d, k) => d.name !== n || k === idx);
    const nd = { name: n, raw: n + ':' + set[n] }, j = decls.findIndex(d => d.name === n);
    if (j >= 0) decls[j] = nd; else decls.push(nd);
  });
  return decls.map(d => d.raw).join(';');
};

const parse = html => new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
const finish = doc => { const out = doc.body.innerHTML; return out.length > (PC.LIMITS ? PC.LIMITS.custom : 300000) ? null : out; };

/**
 * Write the frame's style changes into the stored HTML.
 * changes: [{ i, tag, sig, set:{prop:value}, del:[prop] }]. Returns { html, applied, rejected } or null when any element does not match
 * (the editor then reloads the frame from the stored HTML, which is the truth). Values that fail `cleanDecl` are dropped and counted.
 */
D.applyStyles = function (html, changes) {
  if (typeof html !== 'string' || !Array.isArray(changes) || !changes.length || changes.length > 80) return null;
  const doc = parse(html), all = doc.body.querySelectorAll('*'); let applied = 0, rejected = 0;
  for (const c of changes) {
    if (!c || typeof c !== 'object' || !Number.isInteger(c.i) || typeof c.sig !== 'string' || c.sig.length > 400) return null;
    const el = all[c.i]; if (!el || sigOf(el) !== c.sig) return null;
    const set = {}, del = [];
    Object.keys(c.set && typeof c.set === 'object' ? c.set : {}).slice(0, 30).forEach(p => { const v = D.PROPS.includes(p) ? cleanDecl(p, c.set[p]) : null; if (v == null) rejected++; else set[p] = v; });
    (Array.isArray(c.del) ? c.del : []).slice(0, 30).forEach(p => { if (D.PROPS.includes(p)) del.push(p); });
    const next = D.mergeStyle(el.getAttribute('style') || '', set, del);
    if (next.length > 3000) { rejected++; continue; }
    if (next) el.setAttribute('style', next); else el.removeAttribute('style');
    applied++;
  }
  const out = finish(doc); return out == null ? null : { html: out, applied, rejected };
};

/**
 * Structural edits: delete, dup (duplicate), front, back, forward, backward (order among siblings).
 * items: [{ i, sig }]. Returns { html, sel } where sel are the new indices to reselect, or null when anything does not match.
 */
D.structure = function (html, op, items) {
  if (typeof html !== 'string' || !['delete', 'dup', 'front', 'back', 'forward', 'backward'].includes(op) || !Array.isArray(items) || !items.length || items.length > 50) return null;
  const doc = parse(html), all = Array.from(doc.body.querySelectorAll('*')), picked = [];
  for (const it of items) {
    if (!it || !Number.isInteger(it.i) || typeof it.sig !== 'string') return null;
    const el = all[it.i]; if (!el || sigOf(el) !== it.sig) return null;
    if (!picked.includes(el)) picked.push(el);
  }
  const top = picked.filter(el => !picked.some(o => o !== el && o.contains(el)));   // an element inside another picked one rides along
  top.sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
  const made = [];
  if (op === 'delete') top.forEach(el => el.remove());
  else if (op === 'dup') {
    top.forEach(el => {
      const c = el.cloneNode(true), used = id => !!doc.body.querySelector('[id="' + String(id).replace(/"/g, '') + '"]');
      [c].concat(Array.from(c.querySelectorAll('[id]'))).forEach(n => { if (!n.getAttribute) return; const id = n.getAttribute('id'); if (id) { let k = 2, nid = id + '-copy'; while (used(nid)) nid = id + '-copy' + (k++); n.setAttribute('id', nid); } });
      const dec = splitDecls(c.getAttribute('style') || '').find(d => d.name === 'translate'), tv = dec ? dec.raw.slice(dec.raw.indexOf(':') + 1).trim() : '';
      const m = /^(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?$/.exec(tv);
      if (!tv || m) c.setAttribute('style', D.mergeStyle(c.getAttribute('style') || '', { translate: ((m ? parseFloat(m[1]) : 0) + 24) + 'px ' + ((m ? parseFloat(m[2] || 0) : 0) + 24) + 'px' }));   // offset the copy so it is visible
      el.after(c); made.push(c);
    });
  } else {
    top.forEach(el => {
      const p = el.parentNode; if (!p) return;
      if (op === 'front') p.appendChild(el);
      else if (op === 'back') p.insertBefore(el, p.firstChild);
      else if (op === 'forward') { let n = el.nextElementSibling; while (n && /^(SCRIPT|STYLE)$/.test(n.tagName)) n = n.nextElementSibling; if (n) n.after(el); }
      else { let n = el.previousElementSibling; while (n && /^(SCRIPT|STYLE)$/.test(n.tagName)) n = n.previousElementSibling; if (n) n.before(el); }
      made.push(el);
    });
  }
  const after = Array.from(doc.body.querySelectorAll('*')), out = finish(doc);
  return out == null ? null : { html: out, sel: made.map(el => after.indexOf(el)).filter(k => k >= 0) };
};

/* ── the part that runs inside the frame ─────────────────────────────────────────────────────────────────────────────────────── */
function pcDesign(cleanDecl, sigOf, PROPS) {
  'use strict';
  var root = document.querySelector('[data-pc-custom]'); if (!root) return;
  var P = function (m) { try { parent.postMessage(m, '*'); } catch (e) { /* no parent */ } };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var INL = 'b,strong,i,em,u,s,mark,code,span,br,small,sub,sup';
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, BUTTON: 1, CANVAS: 1, IMG: 1, VIDEO: 1, IFRAME: 1, NOSCRIPT: 1, TEMPLATE: 1, svg: 1 };
  var REPL = { IMG: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, OBJECT: 1, svg: 1 };
  var NOPICK = { SCRIPT: 1, STYLE: 1, BR: 1, TEMPLATE: 1, NOSCRIPT: 1, HEAD: 1, META: 1, LINK: 1 };
  var DEEP = ['color', 'font-family', 'font-weight', 'font-style', 'text-align', 'text-transform', 'text-decoration-line', 'letter-spacing'];
  var MIN = 8, KEEP = 24, SNAP = 6;
  var els = [].slice.call(root.querySelectorAll('*')), sigs = els.map(sigOf), orig = els.map(function (e) { return e.textContent; });
  var K = 0.6, S = 1 / K, sel = [], cur = null, drag = null, touched = [], hoverEl = null, lastSig = '', host, sh, lay, chip, hov, hs = {}, boxes = [], guideNodes = [];
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var px = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var norm = function (t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); };
  var ownText = function (el) { var t = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue; return t.replace(/\s+/g, ' ').trim(); };

  /* ── what can be selected ── */
  function pickable(el) {
    if (!el || el === root || NOPICK[el.tagName]) return false;
    var d = getComputedStyle(el).display; if (d === 'none' || d === 'contents') return false;
    return d !== 'inline' || !!REPL[el.tagName];
  }
  function pickEl(t) {
    while (t && t.nodeType !== 1) t = t.parentNode;
    if (!t || !root.contains(t)) return null;
    while (t && t !== root && t.namespaceURI === SVGNS && t.tagName !== 'svg') t = t.parentElement;      // an svg is one thing
    while (t && t !== root && t.parentElement && t.parentElement !== root && t.parentElement.namespaceURI === SVGNS) t = t.parentElement;
    while (t && t !== root && (!pickable(t) || els.indexOf(t) < 0)) t = t.parentElement;               // script-made nodes have no source: pick what they sit in
    return t && t !== root ? t : null;
  }
  function simple(el) {
    var cs = getComputedStyle(el);
    if ((cs.rotate && cs.rotate !== 'none') || (cs.scale && cs.scale !== 'none')) return false;
    var t = cs.transform; if (!t || t === 'none') return true;
    var m = /^matrix\(([^)]+)\)$/.exec(t); if (!m) return false;
    var v = m[1].split(',').map(parseFloat); return Math.abs(v[0] - 1) < 1e-3 && Math.abs(v[3] - 1) < 1e-3 && Math.abs(v[1]) < 1e-3 && Math.abs(v[2]) < 1e-3;
  }
  var canResize = function (el) { return simple(el) && getComputedStyle(el).display !== 'inline'; };
  var labelOf = function (el) { var c = (el.getAttribute('class') || '').trim().split(/\s+/)[0]; return el.tagName.toLowerCase() + (el.id ? '#' + el.id : c ? '.' + c : ''); };
  var hasText = function (el) { return !REPL[el.tagName] && /\S/.test(el.textContent || ''); };
  function kindOf(el) { return el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS' || el.tagName === 'svg' ? 'img' : ownText(el) ? 'text' : 'box'; }
  function isContainer(el) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (pickable(c) && hasText(c)) return true; return false; }

  /* ── reporting ── */
  function mark(el, p) { var t = null; for (var k = 0; k < touched.length; k++) if (touched[k].el === el) t = touched[k]; if (!t) touched.push(t = { el: el, props: {} }); t.props[p] = 1; }
  function put(el, p, v) { el.style.setProperty(p, v); mark(el, p); }
  function drop(el, p) { el.style.removeProperty(p); mark(el, p); }
  function report(key) {
    var changes = [];
    touched.forEach(function (t) {
      var i = els.indexOf(t.el); if (i < 0) return; var set = {}, del = [];
      Object.keys(t.props).forEach(function (p) { var v = t.el.style.getPropertyValue(p); if (v) set[p] = v; else del.push(p); });
      changes.push({ i: i, tag: t.el.tagName, sig: sigs[i], set: set, del: del });
    });
    touched = [];
    if (changes.length) P({ pc: 'style', changes: changes, key: key || 'style' });
    announce();
  }
  function info() {
    var el = sel[sel.length - 1]; if (!el) return null;
    var cs = getComputedStyle(el), rr = root.getBoundingClientRect(), r = el.getBoundingClientRect(), i = els.indexOf(el), inl = {};
    PROPS.forEach(function (p) { var v = el.style.getPropertyValue(p); if (v) inl[p] = v; });
    return {
      n: sel.length, i: i, tag: el.tagName.toLowerCase(), label: labelOf(el), text: ownText(el).slice(0, 60), kind: kindOf(el), canResize: canResize(el), container: isContainer(el), hasText: hasText(el),
      rect: { x: r1(r.left - rr.left), y: r1(r.top - rr.top), w: r1(r.width), h: r1(r.height) },
      cs: { color: cs.color, bg: cs.backgroundColor, bgImage: cs.backgroundImage === 'none' ? '' : 'yes', family: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(), size: px(cs.fontSize), weight: +cs.fontWeight || 400, style: cs.fontStyle,
        align: cs.textAlign, deco: cs.textDecorationLine, caps: cs.textTransform, lh: cs.lineHeight === 'normal' ? 0 : px(cs.lineHeight) / (px(cs.fontSize) || 1), ls: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing) / (px(cs.fontSize) || 1),
        opacity: +cs.opacity, radius: px(cs.borderTopLeftRadius), bw: px(cs.borderTopWidth), bc: cs.borderTopColor, shadow: cs.boxShadow !== 'none', pad: px(cs.paddingTop), pos: cs.position },
      inl: inl, auto: { w: !el.style.width, h: !el.style.height }, moved: !!el.style.translate,
      items: sel.map(function (e) { var k = els.indexOf(e); return { i: k, sig: sigs[k] }; })
    };
  }
  function announce() { P({ pc: 'pick', info: info() }); }
  function sendTree() {
    var out = [];
    for (var k = 0; k < els.length && out.length < 90; k++) {
      var e = els[k]; if (!pickable(e) || e.namespaceURI === SVGNS && e.tagName !== 'svg') continue;
      var b = e.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
      var d = 0; for (var p = e.parentElement; p && p !== root; p = p.parentElement) d++;
      out.push({ i: k, d: Math.min(d, 8), label: labelOf(e), text: ownText(e).slice(0, 40) });
    }
    P({ pc: 'tree', items: out });
  }

  /* ── translate, left/top, width/height ── */
  function trPx(el) {
    var v = el.style.getPropertyValue('translate');
    if (!v) { var c = getComputedStyle(el).translate; if (!c || c === 'none') return [0, 0]; v = c; }
    var p = v.trim().split(/\s+/), conv = function (s, whole) { var n = parseFloat(s); if (isNaN(n)) return 0; return /%$/.test(s) ? n / 100 * whole : n; };
    return [conv(p[0] || '0', el.getBoundingClientRect().width), conv(p[1] || '0', el.getBoundingClientRect().height)];
  }
  function setTr(el, x, y) { x = r1(x); y = r1(y); if (!x && !y) drop(el, 'translate'); else put(el, 'translate', x + 'px ' + y + 'px'); }
  function prep(el) {
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { el: el, r0: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, t0: trPx(el), pos: cs.position, left0: cs.left === 'auto' ? NaN : px(cs.left), top0: cs.top === 'auto' ? NaN : px(cs.top),
      inlT: el.style.getPropertyValue('translate'), style0: el.getAttribute('style') };
  }
  /** Express the net movement of a gesture as left/top when that is exact (positioned elements), otherwise as translate. */
  function settle(it) {
    var el = it.el, rf = el.getBoundingClientRect(), c = trPx(el), dx = c[0] - it.t0[0], dy = c[1] - it.t0[1];
    if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) { if (!it.t0[0] && !it.t0[1]) { if (!it.inlT) drop(el, 'translate'); } else setTr(el, it.t0[0], it.t0[1]); return; }
    if (/^(absolute|fixed|relative)$/.test(it.pos) && !it.t0[0] && !it.t0[1] && !it.inlT && !isNaN(it.left0) && !isNaN(it.top0)) {
      var sl = el.style.getPropertyValue('left'), st = el.style.getPropertyValue('top');
      el.style.removeProperty('translate');
      el.style.setProperty('left', r1(it.left0 + dx) + 'px'); el.style.setProperty('top', r1(it.top0 + dy) + 'px');
      var r2 = el.getBoundingClientRect();
      if (Math.abs(r2.left - rf.left) < 0.6 && Math.abs(r2.top - rf.top) < 0.6 && Math.abs(r2.width - rf.width) < 0.6 && Math.abs(r2.height - rf.height) < 0.6) { mark(el, 'left'); mark(el, 'top'); mark(el, 'translate'); return; }
      if (sl) el.style.setProperty('left', sl); else el.style.removeProperty('left');
      if (st) el.style.setProperty('top', st); else el.style.removeProperty('top');
    }
    setTr(el, c[0], c[1]);
  }
  function flexParent(el) { var p = el.parentElement; return !!p && /flex/.test(getComputedStyle(p).display); }
  function setSize(el, axis, v) {
    var w = axis === 'w', cs = getComputedStyle(el), extra = cs.boxSizing === 'border-box' ? 0 : w ? px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth) : px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    var p = w ? 'width' : 'height', have = function () { var b = el.getBoundingClientRect(); return w ? b.width : b.height; };
    put(el, p, Math.max(1, r1(v - extra)) + 'px');
    if (Math.abs(have() - v) > 1.5) {
      var now = getComputedStyle(el);
      if ((w ? now.maxWidth : now.maxHeight) !== 'none') put(el, 'max-' + p, 'none');
      if (px(w ? now.minWidth : now.minHeight) > 0) put(el, 'min-' + p, '0px');
      if (Math.abs(have() - v) > 1.5 && flexParent(el)) put(el, 'flex', 'none');
    }
  }

  /* ── overlay (a shadow-DOM host outside the slide) ── */
  function buildUi() {
    var css = ':host{all:initial}.lay{position:fixed;left:0;top:0;width:1280px;height:720px;pointer-events:none;--s:1}i{display:block;position:fixed;box-sizing:border-box;pointer-events:none;font-style:normal}'
      + '.b{border:calc(2px*var(--s)) solid #5b4bff;border-radius:calc(2px*var(--s));box-shadow:0 0 0 calc(1px*var(--s)) rgba(255,255,255,.7)}.b.multi{border-style:dashed}.b.hov{border-width:calc(1px*var(--s));border-color:rgba(91,75,255,.6);box-shadow:none}'
      + '.h{width:calc(11px*var(--s));height:calc(11px*var(--s));margin:calc(-5.5px*var(--s)) 0 0 calc(-5.5px*var(--s));background:#fff;border:calc(1.6px*var(--s)) solid #5b4bff;border-radius:calc(2.5px*var(--s));pointer-events:auto;touch-action:none}'
      + '.h.n,.h.s{cursor:ns-resize}.h.e,.h.w{cursor:ew-resize}.h.nw,.h.se{cursor:nwse-resize}.h.ne,.h.sw{cursor:nesw-resize}'
      + '.chip{background:#5b4bff;color:#fff;font:600 calc(11px*var(--s))/1.2 system-ui,-apple-system,Segoe UI,sans-serif;padding:calc(3px*var(--s)) calc(7px*var(--s));border-radius:calc(5px*var(--s));white-space:nowrap}'
      + '.g{background:#ff3d8b}';
    host = document.createElement('div'); host.className = 'pc-design-ui'; host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:1280px;height:720px;z-index:2147483647;pointer-events:none';
    sh = host.attachShadow({ mode: 'open' }); sh.innerHTML = '<style>' + css + '</style><div class="lay"></div>'; lay = sh.querySelector('.lay');
    var mk = function (cls) { var n = document.createElement('i'); n.className = cls; n.style.display = 'none'; lay.appendChild(n); return n; };
    hov = mk('b hov');
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (h) { var n = mk('h ' + h); hs[h] = n; n.addEventListener('pointerdown', function (e) { startResize(h, e); }); });
    chip = mk('chip');
    document.documentElement.appendChild(host);
    var st = document.createElement('style'); st.setAttribute('data-pc-design', '');
    st.textContent = '[data-pc-sel]{touch-action:none;cursor:move}.pc-dragging,.pc-dragging *{user-select:none!important;-webkit-user-select:none!important;cursor:grabbing!important}';
    document.head.appendChild(st);
    buildUi.mk = mk;
  }
  function place(n, x, y, w, h) { n.style.display = 'block'; n.style.left = x + 'px'; n.style.top = y + 'px'; if (w != null) { n.style.width = w + 'px'; n.style.height = h + 'px'; } }
  function draw() {
    if (!host) return;
    lay.style.setProperty('--s', S);
    while (boxes.length < sel.length) boxes.push(buildUi.mk('b'));
    boxes.forEach(function (b, k) {
      if (k >= sel.length || cur) { b.style.display = 'none'; return; }
      var r = sel[k].getBoundingClientRect(); place(b, r.left, r.top, r.width, r.height); b.classList.toggle('multi', sel.length > 1);
    });
    var single = sel.length === 1 && !cur && canResize(sel[0]), r0 = sel.length && !cur ? sel[sel.length - 1].getBoundingClientRect() : null;
    Object.keys(hs).forEach(function (h) {
      var n = hs[h]; if (!single || !r0) { n.style.display = 'none'; return; }
      var small = (r0.width < 28 * S && /^[ns]$/.test(h)) || (r0.height < 28 * S && /^[ew]$/.test(h)); if (small) { n.style.display = 'none'; return; }
      place(n, r0.left + r0.width * (/e/.test(h) ? 1 : /w/.test(h) ? 0 : 0.5), r0.top + r0.height * (/s/.test(h) ? 1 : /n/.test(h) ? 0 : 0.5));
    });
    if (hoverEl && !cur && !drag && sel.indexOf(hoverEl) < 0) { var hr = hoverEl.getBoundingClientRect(); place(hov, hr.left, hr.top, hr.width, hr.height); } else hov.style.display = 'none';
    if (r0) {
      var u = unionRect(sel.map(function (e) { return e.getBoundingClientRect(); })), rr = root.getBoundingClientRect();
      chip.textContent = drag && drag.started ? (drag.mode === 'resize' ? Math.round(u.width) + ' × ' + Math.round(u.height) : Math.round(u.left - rr.left) + ', ' + Math.round(u.top - rr.top)) : sel.length > 1 ? sel.length + ' selected' : labelOf(sel[sel.length - 1]);
      place(chip, u.left, u.top - 22 * S >= 0 ? u.top - 22 * S : u.bottom + 5 * S);
    } else chip.style.display = 'none';
    lastSig = sigNow();
  }
  var sigNow = function () { return sel.map(function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(r1).join(','); }).join('|'); };
  function unionRect(rs) {
    var l = 1e9, t = 1e9, rt = -1e9, b = -1e9; rs.forEach(function (r) { l = Math.min(l, r.left); t = Math.min(t, r.top); rt = Math.max(rt, r.right); b = Math.max(b, r.bottom); });
    return { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t };
  }
  function showGuides(list) {
    while (guideNodes.length < list.length) { var n = buildUi.mk('g'); guideNodes.push(n); }
    guideNodes.forEach(function (n, k) {
      if (k >= list.length) { n.style.display = 'none'; return; }
      var g = list[k]; if (g.axis === 'x') place(n, g.pos - S / 2, 0, S, 720); else place(n, 0, g.pos - S / 2, 1280, S);
    });
  }

  /* ── selection ── */
  function setSel(list) {
    sel.forEach(function (e) { e.removeAttribute('data-pc-sel'); });
    sel = list.filter(function (e, k) { return e && list.indexOf(e) === k; });
    sel.forEach(function (e) { e.setAttribute('data-pc-sel', ''); });
    draw(); announce();
  }
  function selectIdx(list, add) {
    var picked = list.map(function (i) { return els[i]; }).filter(function (e) { return e && pickable(e); });
    setSel(add ? sel.concat(picked) : picked);
  }

  /* ── dragging ── */
  function beginDrag(mode, e, h) {
    if (cur || !sel.length) return;
    drag = { mode: mode, h: h, x0: e.clientX, y0: e.clientY, id: e.pointerId, started: false, items: sel.map(prep), snap: null };
    drag.u0 = unionRect(drag.items.map(function (it) { return it.r0; }));
    if (mode === 'resize') { drag.w0 = drag.items[0].r0.width; drag.h0 = drag.items[0].r0.height; }
  }
  function snapTargets() {
    var xs = [0, 640, 1280], ys = [0, 360, 720], n = 0;
    for (var k = 0; k < els.length && n < 160; k++) {
      var e = els[k]; if (!pickable(e) || e.namespaceURI === SVGNS && e.tagName !== 'svg') continue;
      if (sel.some(function (s) { return s === e || s.contains(e) || e.contains(s); })) continue;
      var r = e.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || (r.width > 1200 && r.height > 650)) continue;
      xs.push(r.left, r.left + r.width / 2, r.right); ys.push(r.top, r.top + r.height / 2, r.bottom); n++;
    }
    return { xs: xs, ys: ys };
  }
  function snapMove(dx, dy, on) {
    var u = drag.u0, guides = [];
    var l = u.left + dx, t = u.top + dy, w = u.width, h = u.height;
    l = clamp(l, KEEP - w, 1280 - KEEP); t = clamp(t, KEEP - h, 720 - KEEP);
    if (on) {
      if (!drag.snap) drag.snap = snapTargets();
      var th = SNAP * S, best = function (cands, targets) { var d = 1e9, pick = null; cands.forEach(function (c) { targets.forEach(function (g) { var q = g - c; if (Math.abs(q) < Math.abs(d)) { d = q; pick = g; } }); }); return Math.abs(d) <= th ? { d: d, g: pick } : null; };
      var bx = best([l, l + w / 2, l + w], drag.snap.xs), by = best([t, t + h / 2, t + h], drag.snap.ys);
      if (bx) { l += bx.d; guides.push({ axis: 'x', pos: bx.g }); } if (by) { t += by.d; guides.push({ axis: 'y', pos: by.g }); }
    }
    return { dx: l - u.left, dy: t - u.top, guides: guides };
  }
  function moveDrag(e) {
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.started) {
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.started = true; document.documentElement.classList.add('pc-dragging'); try { document.documentElement.setPointerCapture(drag.id); } catch (x) { /* ignore */ }
      var gs = getSelection(); if (gs) gs.removeAllRanges();
    }
    if (drag.mode === 'move') {
      var sn = snapMove(dx, dy, !e.altKey);
      drag.items.forEach(function (it) { setTr(it.el, it.t0[0] + sn.dx, it.t0[1] + sn.dy); });
      showGuides(sn.guides);
    } else resizeBy(dx, dy, e.shiftKey);
    draw();
  }
  function resizeBy(dx, dy, shift) {
    var it = drag.items[0], el = it.el, h = drag.h, W = drag.w0, H = drag.h0, nw = W + (/e/.test(h) ? dx : /w/.test(h) ? -dx : 0), nh = H + (/s/.test(h) ? dy : /n/.test(h) ? -dy : 0);
    var keep = shift !== (kindOf(el) === 'img');
    if (keep && h.length === 2) { var sx = nw / W, sy = nh / H, k = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy; nw = W * k; nh = H * k; }
    nw = Math.max(MIN, nw); nh = Math.max(MIN, nh);
    if (/[ew]/.test(h) || (keep && h.length === 2)) setSize(el, 'w', nw);
    if (/[ns]/.test(h) || (keep && h.length === 2)) setSize(el, 'h', nh);
    setTr(el, it.t0[0], it.t0[1]);
    var r = el.getBoundingClientRect(), wantL = /w/.test(h) ? it.r0.right - r.width : it.r0.left, wantT = /n/.test(h) ? it.r0.bottom - r.height : it.r0.top;
    setTr(el, it.t0[0] + (wantL - r.left), it.t0[1] + (wantT - r.top));
  }
  function startResize(h, e) {
    e.preventDefault(); e.stopPropagation(); if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (sel.length !== 1 || cur) return; beginDrag('resize', e, h);
  }
  function suppressClick() { var f = function (ev) { ev.stopPropagation(); ev.preventDefault(); }; addEventListener('click', f, true); setTimeout(function () { removeEventListener('click', f, true); }, 60); }
  function endDrag(e) {
    var d = drag; if (!d || (e && e.pointerId !== d.id)) return; drag = null;
    document.documentElement.classList.remove('pc-dragging'); showGuides([]);
    try { document.documentElement.releasePointerCapture(d.id); } catch (x) { /* ignore */ }
    if (!d.started) { draw(); return; }
    d.items.forEach(settle); suppressClick(); report(d.mode === 'resize' ? 'resize' : 'move'); draw();
  }
  function cancelDrag() {
    var d = drag; if (!d) return; drag = null; touched = [];
    d.items.forEach(function (it) { if (it.style0 == null) it.el.removeAttribute('style'); else it.el.setAttribute('style', it.style0); });
    document.documentElement.classList.remove('pc-dragging'); showGuides([]); draw();
  }
  /** Move the selection by (dx, dy) as one step (keyboard nudges, alignment). */
  function moveBy(items, deltas, key) {
    items.forEach(function (it, k) { var d = deltas[k] || deltas[0]; setTr(it.el, it.t0[0] + d[0], it.t0[1] + d[1]); });
    items.forEach(settle); report(key); draw();
  }
  function alignSel(mode) {
    var items = sel.map(prep); if (!items.length) return;
    var rr = root.getBoundingClientRect(), b = items.length > 1 ? unionRect(items.map(function (it) { return it.r0; })) : { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom, width: rr.width, height: rr.height };
    var ds = items.map(function (it) {
      var r = it.r0, d = [0, 0];
      if (mode === 'left') d[0] = b.left - r.left; else if (mode === 'right') d[0] = b.right - r.right; else if (mode === 'center') d[0] = (b.left + b.width / 2) - (r.left + r.width / 2);
      else if (mode === 'top') d[1] = b.top - r.top; else if (mode === 'bottom') d[1] = b.bottom - r.bottom; else if (mode === 'middle') d[1] = (b.top + b.height / 2) - (r.top + r.height / 2);
      return d;
    });
    moveBy(items, ds, 'align');
  }

  /* ── panel commands ── */
  function applyStyle(d) {
    if (cur) end(true);
    var set = d.set && typeof d.set === 'object' ? d.set : {}, del = Array.isArray(d.del) ? d.del : [], targets = sel.slice();
    if (d.deep) sel.forEach(function (e) { els.forEach(function (x) { if (x !== e && e.contains(x) && ownText(x) && !NOPICK[x.tagName] && !REPL[x.tagName] && targets.indexOf(x) < 0) targets.push(x); }); });
    targets.forEach(function (el, k) {
      var isSel = sel.indexOf(el) >= 0;
      Object.keys(set).forEach(function (p) {
        if (!isSel && DEEP.indexOf(p) < 0) return;
        var v = cleanDecl(p, set[p]); if (v == null) return;
        put(el, p, v);
        if (p === 'border-width' && parseFloat(v) > 0 && getComputedStyle(el).borderTopStyle === 'none' && !el.style.getPropertyValue('border-style')) put(el, 'border-style', 'solid');
        if (p === 'background-color' && v !== 'transparent' && getComputedStyle(el).backgroundImage !== 'none') put(el, 'background-image', 'none');
      });
      del.forEach(function (p) { if (typeof p === 'string' && /^[a-z-]{2,30}$/.test(p) && (isSel || DEEP.indexOf(p) >= 0)) drop(el, p); });
    });
    report(String(d.key || 'fmt').slice(0, 30)); draw();
  }
  function setGeom(d) {
    if (cur) end(true); var el = sel[0]; if (sel.length !== 1 || !el) return;
    var it = prep(el), rr = root.getBoundingClientRect(), num = function (v) { return typeof v === 'number' && isFinite(v); };
    if (d.w === null) drop(el, 'width'); else if (num(d.w)) setSize(el, 'w', clamp(d.w, MIN, 6000));
    if (d.h === null) drop(el, 'height'); else if (num(d.h)) setSize(el, 'h', clamp(d.h, MIN, 6000));
    if (num(d.x) || num(d.y)) {
      var r = el.getBoundingClientRect(), c = trPx(el);
      setTr(el, c[0] + (num(d.x) ? rr.left + clamp(d.x, -3000, 4000) - r.left : 0), c[1] + (num(d.y) ? rr.top + clamp(d.y, -3000, 4000) - r.top : 0));
    }
    settle(it); report('geom'); draw();
  }
  function textCmd(cmd) {
    var s = getSelection(); if (!cur) return;
    var wrap = function (tag) {
      if (!s.rangeCount || s.isCollapsed) return;
      var rg = s.getRangeAt(0), a = rg.startContainer.nodeType === 1 ? rg.startContainer : rg.startContainer.parentElement, up = a && a.closest ? a.closest(tag) : null;
      if (up && cur.el.contains(up)) { var f = document.createDocumentFragment(); while (up.firstChild) f.appendChild(up.firstChild); up.replaceWith(f); return; }
      var n = document.createElement(tag); n.appendChild(rg.extractContents()); rg.insertNode(n); s.removeAllRanges(); var r2 = document.createRange(); r2.selectNodeContents(n); s.addRange(r2);
    };
    if (cmd === 'bold') document.execCommand('bold'); else if (cmd === 'italic') document.execCommand('italic'); else if (cmd === 'underline') document.execCommand('underline');
    else if (cmd === 'strike') { document.execCommand('strikeThrough'); [].slice.call(cur.el.querySelectorAll('strike')).forEach(function (n) { var t = document.createElement('s'); while (n.firstChild) t.appendChild(n.firstChild); n.replaceWith(t); }); }
    else if (cmd === 'mark') wrap('mark'); else if (cmd === 'code') wrap('code');
    else if (cmd === 'clear') { if (s.isCollapsed) cur.el.textContent = cur.el.textContent; else document.execCommand('removeFormat'); }
  }

  /* ── editing the words (double-click) ── */
  function ok(el) {
    if (!el || el === root || SKIP[el.tagName] || el.closest('svg')) return false; var t = false;
    for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) { if (/\S/.test(c.nodeValue)) t = true; } else if (c.nodeType !== 1 && c.nodeType !== 8) return false; }
    return t && !el.querySelector(':not(' + INL + ')');
  }
  function end(keep) {
    if (!cur) return; var c = cur; cur = null; var el = c.el;
    el.removeAttribute('contenteditable'); el.setAttribute('style', c.style); if (!c.style) el.removeAttribute('style');
    if (!keep) { el.innerHTML = c.before; P({ pc: 'editing', on: false }); draw(); return; }
    var html = el.innerHTML;
    if (c.before.indexOf('<br') < 0) html = html.replace(/(?:<br\s*\/?>)+$/i, '');
    if (html !== el.innerHTML) el.innerHTML = html;
    if (html !== c.before) {
      P({ pc: 'edit', i: c.i, tag: el.tagName, old: orig[c.i], html: html, rich: true });
      var d1 = [].slice.call(el.querySelectorAll('*')), args = function (a) { return [c.i + 1, c.n0].concat(a); };
      els.splice.apply(els, args(d1)); sigs.splice.apply(sigs, args(d1.map(sigOf))); orig.splice.apply(orig, args(d1.map(function (e) { return e.textContent; })));
      sigs[c.i] = sigOf(el); orig[c.i] = el.textContent;
    }
    P({ pc: 'editing', on: false }); draw(); announce();
  }
  function startEdit(el) {
    var i = els.indexOf(el); if (i < 0 || !ok(el)) return false;
    if (norm(el.textContent) !== norm(orig[i])) { P({ pc: 'code' }); return false; }              // a script wrote these words: there is no source text to edit
    if (cur) end(true);
    cur = { el: el, i: i, before: el.innerHTML, style: el.getAttribute('style') || '', n0: el.querySelectorAll('*').length };
    el.setAttribute('contenteditable', 'true'); if (el.contentEditable === 'false') el.setAttribute('contenteditable', 'true');
    el.style.outline = '2px solid #5b4bff'; el.style.outlineOffset = '4px'; el.style.cursor = 'text'; el.style.userSelect = 'text'; el.style.webkitUserSelect = 'text'; el.focus();
    el.addEventListener('blur', function f() { el.removeEventListener('blur', f); end(true); });
    el.addEventListener('paste', function (ev) { ev.preventDefault(); var t = (ev.clipboardData && ev.clipboardData.getData('text/plain')) || ''; document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' ')); });
    el.addEventListener('keydown', function k(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); el.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); var c = cur; if (c) { cur = null; el.removeAttribute('contenteditable'); el.setAttribute('style', c.style); if (!c.style) el.removeAttribute('style'); el.innerHTML = c.before; P({ pc: 'editing', on: false }); } el.removeEventListener('keydown', k); el.blur(); draw(); }
    });
    P({ pc: 'editing', on: true }); draw(); return true;
  }

  /* ── events ── */
  addEventListener('pointerdown', function (e) {
    P({ pc: 'sel' });
    if (e.target === host || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (cur && cur.el.contains(e.target)) return;                                    // placing the caret in the words being edited
    var el = pickEl(e.target), tg = e.target.closest ? e.target.closest('input,textarea,select') : null;
    if (!el) { if (!e.shiftKey) setSel([]); return; }
    if (e.shiftKey) { var k = sel.indexOf(el); if (k >= 0) { setSel(sel.filter(function (x) { return x !== el; })); return; } setSel(sel.concat(el)); }
    else if (sel.indexOf(el) < 0) setSel([el]);
    if (!tg) beginDrag('move', e);
  }, true);
  addEventListener('pointermove', function (e) {
    if (drag) { if (e.pointerId === drag.id) moveDrag(e); return; }
    if (cur || e.target === host) return; var el = pickEl(e.target); if (el !== hoverEl) { hoverEl = el; draw(); }
  }, true);
  addEventListener('pointerup', endDrag, true); addEventListener('pointercancel', endDrag, true);
  document.documentElement.addEventListener('mouseleave', function () { if (hoverEl) { hoverEl = null; draw(); } });
  addEventListener('dragstart', function (e) { e.preventDefault(); }, true);
  addEventListener('click', function (e) { var a = e.target.closest ? e.target.closest('a[href]') : null; if (a) e.preventDefault(); }, true);
  addEventListener('dblclick', function (e) {
    if (cur) return; var el = e.target; while (el && el !== root && !ok(el)) el = el.parentElement;
    if (el && el !== root) while (el.parentElement && el.parentElement !== root && el.matches(INL) && ok(el.parentElement)) el = el.parentElement;
    if (!el || el === root) { P({ pc: 'code' }); return; }
    if (els.indexOf(el) < 0) { P({ pc: 'code' }); return; }
    if (sel.length !== 1 || sel[0] !== el) setSel([el]);
    startEdit(el);
  }, true);
  addEventListener('keydown', function (e) {
    if (cur) return;
    var tg = e.target; if (tg && tg.closest && tg.closest('input,textarea,select,[contenteditable="true"]')) return;   // typing in the slide's own form fields
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), eat = function () { e.preventDefault(); e.stopPropagation(); };
    if (drag) { if (e.key === 'Escape') { eat(); cancelDrag(); } return; }
    if (mod && !e.altKey) {
      if (k === 'z') { eat(); P({ pc: 'cmd', cmd: e.shiftKey ? 'redo' : 'undo' }); }
      else if (k === 'y') { eat(); P({ pc: 'cmd', cmd: 'redo' }); }
      else if (k === 'd' && sel.length) { eat(); P({ pc: 'struct', op: 'dup' }); }
      else if ((k === 'b' || k === 'i' || k === 'u') && sel.length) { eat(); P({ pc: 'cmd', cmd: k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline' }); }
      return;
    }
    if (!sel.length) return;
    var step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { eat(); moveBy(sel.map(prep), [[e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0]], 'nudge'); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { eat(); P({ pc: 'struct', op: 'delete' }); }
    else if (e.key === 'Escape') { eat(); setSel([]); }
    else if ((e.key === 'Enter' || e.key === 'F2') && sel.length === 1 && ok(sel[0])) { eat(); startEdit(sel[0]); }
  }, true);
  addEventListener('message', function (ev) {
    var d = ev.data; if (ev.source !== parent || !d || typeof d !== 'object') return;
    if (d.pc === 'init' || d.pc === 'scale') { var k = +d.k; if (k > 0.05 && k < 6) { K = k; S = 1 / k; } if (Array.isArray(d.sel)) selectIdx(d.sel.filter(function (n) { return typeof n === 'number'; }), false); draw(); }
    else if (d.pc === 'deselect') { if (sel.length) setSel([]); hoverEl = null; draw(); }
    else if (d.pc === 'apply') applyStyle(d);
    else if (d.pc === 'geom') setGeom(d);
    else if (d.pc === 'select') { if (cur) end(true); selectIdx(Array.isArray(d.i) ? d.i.filter(function (n) { return typeof n === 'number'; }).slice(0, 50) : [], !!d.add); }
    else if (d.pc === 'cmd') {
      var c = String(d.cmd);
      if (cur) { textCmd(c); return; }
      if (/^align:(left|center|right|top|middle|bottom)$/.test(c)) alignSel(c.slice(6));
      else if (c === 'nudge' && typeof d.dx === 'number' && typeof d.dy === 'number') moveBy(sel.map(prep), [[clamp(d.dx, -50, 50), clamp(d.dy, -50, 50)]], 'nudge');
      else if (c === 'edit' && sel.length === 1) startEdit(sel[0]);
      else if (c === 'parent' && sel.length === 1) { var p = sel[0].parentElement; while (p && p !== root && (!pickable(p) || els.indexOf(p) < 0)) p = p.parentElement; if (p && p !== root) setSel([p]); }
      else if (c === 'child' && sel.length === 1) { for (var q = sel[0].firstElementChild; q; q = q.nextElementSibling) if (pickable(q) && els.indexOf(q) >= 0) { setSel([q]); break; } }
    }
  });
  setInterval(function () { if (sel.length && !drag && !cur && sigNow() !== lastSig) draw(); }, 350);   // a script or an animation moved the selection: follow it

  buildUi();
  P({ pc: 'ready', n: els.length }); sendTree();
}

D.designSrc = '(' + pcDesign.toString() + ')(' + cleanDecl.toString() + ',' + sigOf.toString() + ',' + JSON.stringify(D.PROPS) + ');';
})();
