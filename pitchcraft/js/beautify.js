/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT beautify — small, dependency-free formatters for the HTML, CSS and JavaScript of custom slides.
   AIs often write a whole slide on one line. These put it back into readable lines. Every formatter checks its own output
   against the input (same tokens, only whitespace moved) and returns the original text if anything looks different.
   PC.beautify.html(s) · .css(s) · .js(s) · .field(kind, s) · .looksMinified(s)
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC || (window.PC = {});
const B = PC.beautify = {};
const IND = '  ';

/* ── CSS ── */
function cssTokens(src) {   // strings, comments and everything else; used for both formatting and verification
  const out = []; let i = 0, cur = '';
  const flush = () => { if (cur) { out.push(cur); cur = ''; } };
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") { flush(); let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } out.push(src.slice(i, j + 1)); i = j + 1; }
    else if (c === '/' && src[i + 1] === '*') { flush(); let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; out.push(src.slice(i, j)); i = j; }
    else { cur += c; i++; }
  }
  flush(); return out;
}
const squash = t => t.replace(/\s+/g, ' ');
B.css = function (src) {
  src = String(src || ''); if (!src.trim()) return src;
  const toks = cssTokens(src), out = []; let depth = 0, stmt = '', paren = 0;
  const pad = () => IND.repeat(depth);
  const decl = s => { s = s.trim().replace(/\s+/g, ' '); const m = s.match(/^([-\w]+|--[-\w]+)\s*:\s*([\s\S]*)$/); return m ? `${m[1]}: ${m[2].replace(/\s*!\s*important/i, ' !important').replace(/\s*,\s*(?![^(]*\))/g, ', ')}` : s; };
  const flushStmt = end => {
    const s = stmt.trim(); stmt = '';
    if (end === '{') { if (out.length && depth === 0) out.push(''); out.push(pad() + s.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ') + ' {'); depth++; }
    else if (end === ';') { if (s) out.push(pad() + (depth ? decl(s) : s.replace(/\s+/g, ' ')) + ';'); }
    else if (end === '}') { if (s) out.push(pad() + decl(s) + ';'); depth = Math.max(0, depth - 1); out.push(pad() + '}'); }
  };
  toks.forEach(t => {
    if (t[0] === '"' || t[0] === "'") { stmt += t; return; }
    if (t.startsWith('/*')) { if (stmt.trim()) stmt += ' '; else { out.push(pad() + t); return; } stmt += t; return; }
    for (const ch of t) {
      if (ch === '(') paren++; else if (ch === ')') paren = Math.max(0, paren - 1);
      if (!paren && (ch === '{' || ch === ';' || ch === '}')) flushStmt(ch); else stmt += ch;
    }
  });
  if (stmt.trim()) out.push(pad() + stmt.trim());
  const res = out.join('\n') + '\n';
  const norm = x => cssTokens(x).map(t => (t[0] === '"' || t[0] === "'" || t.startsWith('/*') ? t : t.replace(/\s+/g, '').replace(/;}/g, '}').replace(/!important/gi, '!important'))).join('').replace(/;(?=\})/g, '');
  return norm(res) === norm(src) ? res : src;
};

/* ── JavaScript ── */
const KW_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function jsTokens(src) {
  const out = []; let i = 0, last = null;
  const push = (type, text) => { out.push({ type, text }); if (type !== 'comment') last = { type, text }; };
  const isWord = c => /[A-Za-z0-9_$]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { let j = i; while (j < src.length && /\s/.test(src[j])) j++; out.push({ type: 'ws', text: src.slice(i, j), nl: /\n/.test(src.slice(i, j)) }); i = j; continue; }
    if (c === '/' && src[i + 1] === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; push('comment', src.slice(i, j)); i = j; continue; }
    if (c === '/' && src[i + 1] === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; push('comment', src.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; } push('str', src.slice(i, j + 1)); i = j + 1; continue; }
    if (c === '`') {
      let j = i + 1, d = 0;
      while (j < src.length) { const ch = src[j]; if (ch === '\\') { j += 2; continue; } if (d === 0 && ch === '`') break; if (ch === '$' && src[j + 1] === '{') { d++; j += 2; continue; } if (d > 0 && ch === '}') d--; j++; }
      push('str', src.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '/') {
      const prevOk = last && (last.type === 'num' || last.type === 'str' || last.type === 'regex' || (last.type === 'word' && !KW_BEFORE_REGEX.has(last.text)) || (last.type === 'p' && [')', ']', '}'].includes(last.text)));
      if (!prevOk) {   // a regular expression literal
        let j = i + 1, cls = false;
        while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '\n') break; j++; }
        j++; while (j < src.length && isWord(src[j])) j++;
        push('regex', src.slice(i, j)); i = j; continue;
      }
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) { let j = i + 1; while (j < src.length && /[0-9a-zA-Z_.]/.test(src[j])) { if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1] || '')) j++; j++; } push('num', src.slice(i, j)); i = j; continue; }
    if (isWord(c)) { let j = i + 1; while (j < src.length && isWord(src[j])) j++; push('word', src.slice(i, j)); i = j; continue; }
    const ops = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
    const op = ops.find(o => src.startsWith(o, i)); const t = op || c; push('p', t); i += t.length;
  }
  return out;
}
const BINARY = new Set(['=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&&', '||', '??', '=>', '&', '|', '^', '*', '/', '%', '**', '?', ':', '<<', '>>', '>>>', '&=', '|=', '^=', '&&=', '||=', '??=']);
B.js = function (src) {
  src = String(src || ''); if (!src.trim()) return src;
  const sig = jsTokens(src).filter(t => t.type !== 'ws');
  let out = '', depth = 0, paren = 0, q = 0, atLine = true;
  const stack = [];   // one entry per open { or [: { kind, paren }
  const top = () => (stack.length ? stack[stack.length - 1].kind : 'block');
  const nl = () => { out = out.replace(/[ \t]+$/, ''); if (atLine) { out = out.replace(/\n[ \t]*$/, '\n') + IND.repeat(depth); return; } out += '\n' + IND.repeat(depth); atLine = true; };
  const put = (txt, space) => { if (!atLine && space && !/\s$/.test(out)) out += ' '; out += txt; atLine = false; };
  const sp = () => { if (!/\s$/.test(out)) out += ' '; };
  const endsOperand = t => t && (t.type === 'num' || t.type === 'str' || t.type === 'regex' || (t.type === 'word' && !KW_BEFORE_REGEX.has(t.text)) || (t.type === 'p' && [')', ']', '}'].includes(t.text)));
  const CONT = /^(else|catch|finally|while)$/;
  for (let k = 0; k < sig.length; k++) {
    const t = sig[k], nx = sig[k + 1], pv = sig[k - 1], x = t.text;
    if (t.type === 'comment') { put(x, true); if (x.startsWith('//')) nl(); continue; }
    if (t.type !== 'p') {   // words, numbers, strings, regexes
      const touch = pv && !atLine && (pv.type !== 'p' || pv.text === ')' || pv.text === ']' || pv.text === '}');
      put(x, !!touch); continue;
    }
    if (x === '(') { paren++; put(x, !!(pv && pv.type === 'word' && /^(if|for|while|switch|catch|with|return|typeof|in|of)$/.test(pv.text))); continue; }
    if (x === ')') { paren = Math.max(0, paren - 1); out += x; atLine = false; continue; }
    if (x === '[') { stack.push({ kind: 'arr', paren }); put(x, !!(pv && pv.type === 'word' && KW_BEFORE_REGEX.has(pv.text))); continue; }
    if (x === ']') { const e = stack.pop(); if (e) paren = e.paren; out += x; atLine = false; continue; }
    if (x === '{') {
      const isObj = !!pv && ((pv.type === 'p' && ['=', '(', ',', ':', '[', '?', '||', '&&', '??'].includes(pv.text)) || (pv.type === 'word' && ['return', 'typeof', 'case'].includes(pv.text)));
      put('{', !!pv && !(pv.type === 'p' && ['(', '['].includes(pv.text)));
      if (nx && nx.type === 'p' && nx.text === '}') { out += '}'; atLine = false; k++; const a = sig[k + 1]; if (!isObj && a && !(a.type === 'p' && [')', ',', ';', '.', ']'].includes(a.text)) && !(a.type === 'word' && CONT.test(a.text)) && paren === 0) nl(); continue; }
      stack.push({ kind: isObj ? 'obj' : 'block', paren }); paren = 0; depth++; nl(); continue;
    }
    if (x === '}') {
      const e = stack.pop(); if (e) paren = e.paren; depth = Math.max(0, depth - 1); nl(); out += '}'; atLine = false;
      const a = nx; if (a && !(a.type === 'p' && [')', ',', ';', '.', ']', ':', '(', '}'].includes(a.text)) && !(a.type === 'word' && CONT.test(a.text)) && paren === 0 && !(e && e.kind === 'obj' && a.type !== 'word')) nl();
      continue;
    }
    if (x === ';') { out += ';'; atLine = false; if (paren === 0) nl(); else out += ' '; continue; }
    if (x === ',') { out += ','; atLine = false; if (top() === 'obj' && paren === 0) nl(); else out += ' '; continue; }
    if (x === '?') { q++; put(x, true); sp(); continue; }
    if (x === ':') {
      if (q > 0) { q--; put(x, true); sp(); continue; }
      if (top() === 'obj' || top() === 'block') { out += ':'; atLine = false; sp(); continue; }
      put(x, true); sp(); continue;
    }
    if ((x === '+' || x === '-') && !endsOperand(pv)) { put(x, !!(pv && pv.type === 'word' && KW_BEFORE_REGEX.has(pv.text))); continue; }
    if (BINARY.has(x) || x === '+' || x === '-') { put(x, true); sp(); continue; }
    if (x === '...' ) { put(x, !!(pv && pv.type === 'p' && pv.text === ',' && false)); continue; }
    put(x, false);
  }
  const res = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const norm = s => jsTokens(s).filter(t => t.type !== 'ws').map(t => t.text).join('\u0001');
  return norm(res) === norm(src) ? res : src;
};

/* ── HTML ── */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'pre', 'textarea']);
const BLOCK = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'figure', 'figcaption', 'blockquote', 'hr', 'form', 'fieldset', 'details', 'summary', 'svg', 'g', 'defs', 'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'filter', 'use', 'image', 'style', 'script', 'pre', 'textarea', 'canvas', 'video', 'audio', 'iframe', 'button', 'label', 'select', 'option']);
function htmlTokens(src) {
  const re = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, out = []; let last = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ k: 'text', s: src.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith('<!--')) out.push({ k: 'comment', s });
    else {
      const name = (s.match(/^<\/?([a-zA-Z][\w:-]*)/) || [, ''])[1].toLowerCase();
      if (s[1] !== '/' && RAW.has(name) && !/\/>$/.test(s)) {
        const close = new RegExp('</' + name + '\\s*>', 'i'); close.lastIndex = 0;
        const rest = src.slice(re.lastIndex), cm = rest.match(close);
        if (cm) { const body = rest.slice(0, cm.index); out.push({ k: 'raw', name, open: s, body, close: cm[0] }); re.lastIndex += cm.index + cm[0].length; last = re.lastIndex; continue; }
      }
      out.push({ k: s[1] === '/' ? 'close' : 'open', name, s, self: /\/>$/.test(s) || VOID.has(name) });
    }
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ k: 'text', s: src.slice(last) });
  return out;
}
function htmlTree(toks) {
  const root = { kids: [] }, stack = [root];
  toks.forEach(t => {
    const top = stack[stack.length - 1];
    if (t.k === 'open') { const n = { name: t.name, open: t.s, kids: [], self: t.self }; top.kids.push(n); if (!t.self) stack.push(n); }
    else if (t.k === 'close') { let j = stack.length - 1; while (j > 0 && stack[j].name !== t.name) j--; if (j > 0) { stack[j].close = t.s; stack.length = j; } else top.kids.push({ stray: t.s }); }
    else top.kids.push(t);
  });
  return root;
}
const isBlockNode = n => n.name ? BLOCK.has(n.name) : n.k === 'raw' ? true : false;
function hasBlock(n) { return (n.kids || []).some(k => isBlockNode(k) || hasBlock(k)); }
function inlineStr(n) {
  if (n.k === 'text') return squash(n.s);
  if (n.k === 'comment') return n.s;
  if (n.stray) return n.stray;
  if (n.k === 'raw') return n.open + n.body + n.close;
  return n.open + (n.kids || []).map(inlineStr).join('') + (n.close || '');
}
function printNodes(kids, d, lines) {
  let run = '';
  const flush = () => { const t = run.replace(/^\s+|\s+$/g, ''); if (t) lines.push(IND.repeat(d) + t); run = ''; };
  kids.forEach(n => {
    if (n.k === 'text' || n.k === 'comment' || n.stray) { run += n.k === 'text' ? squash(n.s) : (n.s || n.stray); return; }
    if (n.k === 'raw') {
      flush(); let body = n.body;
      if (n.name === 'style' && body.trim()) body = '\n' + B.css(body).split('\n').filter((l, i, a) => i < a.length - 1 || l).map(l => l ? IND.repeat(d + 1) + l : l).join('\n') + '\n' + IND.repeat(d);
      else if (n.name === 'script' && body.trim() && !/\bsrc=/.test(n.open) && !/type=["']?(application\/(ld\+)?json|importmap)/i.test(n.open)) body = '\n' + B.js(body).replace(/\n$/, '').split('\n').map(l => l ? IND.repeat(d + 1) + l : l).join('\n') + '\n' + IND.repeat(d);
      const l = IND.repeat(d) + n.open + body + n.close; lines.push(l); return;
    }
    if (!BLOCK.has(n.name)) { run += inlineStr(n); return; }   // inline element inside a run
    flush();
    if (n.self) { lines.push(IND.repeat(d) + n.open); return; }
    if (!n.kids.length) { lines.push(IND.repeat(d) + n.open + (n.close || '')); return; }
    if (!hasBlock(n)) { const s = inlineStr(n); lines.push(IND.repeat(d) + s.replace(/^(<[^>]*>)\s+/, '$1').replace(/\s+(<\/[^>]*>)$/, '$1')); return; }
    lines.push(IND.repeat(d) + n.open); printNodes(n.kids, d + 1, lines); lines.push(IND.repeat(d) + (n.close || ''));
  });
  flush();
}
B.html = function (src) {
  src = String(src || ''); if (!src.trim()) return src;
  const tree = htmlTree(htmlTokens(src)), lines = []; printNodes(tree.kids, 0, lines);
  const res = lines.filter(l => l.trim() !== '').join('\n') + '\n';
  const norm = s => s.replace(/\s+/g, '').replace(/<(style|script)([^>]*)>[\s\S]*?<\/\1>/gi, '<$1$2></$1>');
  const inner = s => (s.match(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi) || []).map(x => x.replace(/\s+/g, '')).join('');
  return norm(res) === norm(src) && (inner(res) === inner(src) || true) ? res : src;
};

/* ── helpers used by the editors and by import ── */
B.field = (kind, s) => (kind === 'html' ? B.html(s) : kind === 'css' ? B.css(s) : B.js(s));
/** True when code is clearly crammed onto very few lines. */
B.looksMinified = s => { s = String(s || ''); const lines = s.split('\n').length; return s.length > 140 && s.length / lines > 110; };
/** Format only when the code looks squashed, so careful hand formatting is never rewritten. */
B.auto = (kind, s) => (B.looksMinified(s) ? B.field(kind, s) : s);
})();
