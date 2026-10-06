/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT layouts — one renderer per layout, HTML strings.
   Contract for humans, tests and AI agents:
     <section class="slide" data-slide-id data-layout data-theme data-bg data-tone>
       [data-path="headline"]            an editable text field (dot-path into the slide JSON)
       [data-list="items"][data-idx="2"] a list item wrapper (selectable / reorderable)
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, esc = PC.esc, icon = PC.icon, pad2 = PC.pad2;

/* ── syntax highlighting: tokenise the RAW text, escape per token ── */
PC.highlight = function (src, lang) {
  lang = String(lang || '').toLowerCase();
  const hash = ['bash', 'sh', 'shell', 'yaml', 'yml', 'python', 'py', 'toml'].includes(lang);
  const slash = !['json', 'bash', 'sh', 'shell', 'yaml', 'yml', 'python', 'py', 'toml'].includes(lang);
  const keyLang = ['json', 'js', 'javascript', 'ts', 'typescript', 'yaml', 'yml'].includes(lang);
  const KW = /^(?:const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|true|false|null|undefined|try|catch|throw|def|in|of|npm|git|cd|echo)$/;
  const re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$-]*)|([{}\[\](),:;<>=+*\/!|&.])/g;
  const s = String(src ?? ''); let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index)); last = re.lastIndex;
    const t = m[0]; let cls = '';
    if (m[1]) cls = slash ? 'cm' : '';
    else if (m[2]) cls = slash ? 'cm' : '';
    else if (m[3]) cls = hash ? 'cm' : '';
    else if (m[4]) cls = keyLang && /^\s*:/.test(s.slice(last)) ? 'key' : 'str';
    else if (m[5]) cls = 'num';
    else if (m[6]) cls = KW.test(t) ? 'kw' : (s[last] === '(' ? 'fn' : '');
    else if (m[7]) cls = 'br';
    out += cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t);
  }
  return out + esc(s.slice(last));
};

/* Compact, human-friendly JSON (short arrays and small objects stay on one line) */
function compactJson(v, ind = 0) {
  const pad = '  '.repeat(ind);
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
    return '[\n' + v.map(x => pad + '  ' + compactJson(x, ind + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v); if (!ks.length) return '{}';
    const inline = '{ ' + ks.map(k => JSON.stringify(k) + ': ' + compactJson(v[k], 0)).join(', ') + ' }';
    if (inline.length < 46 && !inline.includes('\n')) return inline;
    return '{\n' + ks.map(k => pad + '  ' + JSON.stringify(k) + ': ' + compactJson(v[k], ind + 1)).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(v);
}
PC.compactJson = compactJson;

/* ── helpers ── */
function T(c, path, cls = '', tag = 'div', ph = '', ml = false) {
  const v = PC.getPath(c.s, path), has = v != null && String(v) !== '';
  if (!has && !c.editable) return '';
  const ed = c.editable ? ` contenteditable="${PC.plainSupported ? 'plaintext-only' : 'true'}" spellcheck="false"` : '';
  const len = path === 'headline' && has ? ` data-len="${lenBucket(v)}"` : '';
  const tw = PC.tweakCss(c.s.tweaks && c.s.tweaks[path], true), st = tw ? ` style="${tw}"` : '';   // user nudges / font / size (objects.js)
  return `<${tag} class="${cls}" data-path="${path}" data-ph="${esc(ph)}"${len}${ml ? ' data-ml="1"' : ''}${st}${ed}>${has ? PC.rich(v) : ''}</${tag}>`;
}
let CUR = null;   // the slide being rendered (renderSlide is synchronous), so list items can find their tweaks
function LI(list, i, cls, inner, o = {}) {
  const tag = o.tag || 'div', tw = PC.tweakCss(CUR && CUR.tweaks && CUR.tweaks[list + '.' + i], false), style = (o.style || '') + (o.style && !o.style.endsWith(';') ? ';' : '') + tw;
  return `<${tag} class="${cls}" data-list="${list}" data-idx="${i}"${style ? ` style="${style}"` : ''}${o.attrs || ''}>${inner}</${tag}>`;
}
const head = (c, o = {}) => `<header class="s-head${o.cls ? ' ' + o.cls : ''}">${T(c, 'kicker', 'kicker rv', 'div', 'Kicker')}${T(c, 'headline', 'h2 rv', 'h2', 'Headline', true)}${o.lead ? T(c, 'body', 'lead rv', 'p', 'Supporting text', true) : ''}</header>`;
const clampN = (n, a, b) => Math.max(a, Math.min(b, n));
const chartDims = (side) => (side ? { w: 692, h: 364 } : { w: 1064, h: 364 });
const lenBucket = v => { const n = PC.plain(v).length; return n > 110 ? 'xxl' : n > 85 ? 'xl' : n > 55 ? 'l' : n > 30 ? 'm' : 's'; };
PC.lenBucket = lenBucket;

/* ── the renderers ── */
const R = {
  blank: () => '',

  title: c => `<div class="s-body">${T(c, 'kicker', 'kicker rv', 'div', 'Kicker')}${T(c, 'headline', 'display rv', 'h1', 'Title', true)}${T(c, 'body', 'lead rv', 'p', 'Subtitle', true)}</div>`,

  statement: c => `<div class="s-body center">${T(c, 'kicker', 'kicker rv', 'div', 'Kicker')}${T(c, 'headline', 'display display-m rv', 'h2', 'Statement', true)}${T(c, 'body', 'lead rv', 'p', 'Supporting line', true)}</div>`,

  section: c => `<div class="s-body sec">${T(c, 'kicker', 'sec-num rv', 'div', '00')}<div class="sec-txt">${T(c, 'headline', 'display display-m rv', 'h2', 'Section title', true)}${T(c, 'body', 'lead rv', 'p', 'Description', true)}</div></div>`,

  quote: c => {
    const ini = (String(c.s.body || '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase();
    return `<div class="s-body q-wrap"><div class="q-mark rv">${icon('quote', 64)}</div>${T(c, 'headline', 'q-text rv', 'blockquote', 'Quote', true)}<div class="q-by rv"><span class="q-av">${esc(ini)}</span>${T(c, 'body', 'q-name', 'div', 'Attribution')}</div></div>`;
  },

  closing: c => {
    const items = c.s.items || [];
    return `<div class="s-body center">${T(c, 'kicker', 'kicker rv', 'div', 'Kicker')}${T(c, 'headline', 'display rv', 'h1', 'Closing line', true)}${T(c, 'body', 'lead rv', 'p', 'Supporting line', true)}
      ${items.length ? `<div class="chips">${items.map((it, i) => LI('items', i, 'chip rv', `${it.icon ? icon(it.icon, 22) : ''}<span class="chip-l">${T(c, `items.${i}.label`, '', 'span', 'Label')}</span>${T(c, `items.${i}.value`, 'chip-v', 'span', 'Value')}`)).join('')}</div>` : ''}</div>`;
  },

  metrics: c => {
    const items = c.s.items || [];
    return `${head(c)}<div class="m-grid n${clampN(items.length, 1, 4)}">${items.map((m, i) => LI('items', i, 'card m-card rv',
      `<span class="m-bar"></span>${T(c, `items.${i}.value`, 'm-val', 'div', 'Value')}${T(c, `items.${i}.label`, 'm-label', 'div', 'Label')}
       ${(m.trend || m.note) ? `<div class="m-note ${esc(m.trend || '')}">${m.trend ? icon(m.trend === 'down' ? 'down' : 'up', 18) : ''}${T(c, `items.${i}.note`, '', 'span', 'Note')}</div>` : ''}`)).join('')}</div>`;
  },

  chart: c => {
    const s = c.s, side = !!(s.body || (s.items || []).length), d = chartDims(side);
    const sideHtml = side ? `<aside class="ch-side rv">${T(c, 'body', 'ch-lead', 'p', 'Insight', true)}${(s.items || []).map((it, i) => LI('items', i, 'callout', `${T(c, `items.${i}.value`, 'co-val', 'div', 'Value')}${T(c, `items.${i}.label`, 'co-label', 'div', 'Label')}`)).join('')}</aside>` : '';
    return `${head(c)}<div class="ch-row${side ? ' has-side' : ''}"><div class="card ch-card rv" data-chart="${esc(s.chartType)}">${PC.Charts.block(s.chartType, s.chartData, d.w, d.h)}</div>${sideHtml}</div>`;
  },

  demo: c => {
    const s = c.s, json = compactJson({ chartType: s.chartType, chartData: s.chartData });
    return `${head(c, { lead: true })}<div class="demo-row"><div class="cd-win rv"><div class="cd-bar"><i></i><i></i><i></i><span class="cd-file">slide.json</span><span class="cd-lang">json</span></div><pre class="cd-pre sm"><code>${PC.highlight(json, 'json')}</code></pre></div><div class="demo-arrow rv">${icon('right', 30)}</div><div class="card ch-card rv" data-chart="${esc(s.chartType)}">${PC.Charts.block(s.chartType, s.chartData, 470, 300)}</div></div>`;
  },

  table: c => {
    const td = c.s.tableData || {}, hs = td.headers || [], rows = td.rows || [];
    return `${head(c)}<div class="card t-card rv"><table class="t${rows.length > 6 || hs.length > 5 ? ' dense' : ''}"><thead><tr>${hs.map((h, j) => `<th>${T(c, `tableData.headers.${j}`, '', 'span', 'Header')}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr>${hs.map((_, j) => `<td>${T(c, `tableData.rows.${i}.${j}`, '', 'span', '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  split: c => {
    const cols = c.s.columns || [];
    return `${head(c)}<div class="sp-grid n${clampN(cols.length, 1, 3)}">${cols.map((col, i) => LI('columns', i, 'card sp-card rv',
      `<div class="sp-top">${col.icon ? `<div class="ic-tile lg">${icon(col.icon, 34)}</div>` : ''}<span class="sp-num">${pad2(i + 1)}</span></div>${T(c, `columns.${i}.headline`, 'sp-title', 'h3', 'Headline', true)}${T(c, `columns.${i}.body`, 'sp-body', 'p', 'Body', true)}`)).join('')}</div>`;
  },

  cards: c => {
    const items = c.s.items || [];
    return `${head(c)}<div class="c-grid n${clampN(items.length, 1, 4)}">${items.map((it, i) => LI('items', i, 'card c-card rv',
      `<div class="ic-tile">${icon(it.icon || 'sparkles', 30)}</div>${T(c, `items.${i}.title`, 'c-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'c-body', 'p', 'Body', true)}`)).join('')}</div>`;
  },

  comparison: c => {
    const cols = c.s.columns || [];
    return `${head(c)}<div class="cmp-grid">${cols.map((col, i) => {
      const good = i === cols.length - 1 && cols.length > 1;
      return LI('columns', i, `card cmp-card ${good ? 'pos' : 'neg'} rv`,
        `${T(c, `columns.${i}.headline`, 'cmp-title', 'h3', 'Headline')}${T(c, `columns.${i}.body`, 'cmp-body', 'p', 'Body', true)}
         <ul>${(col.items || []).map((_, j) => `<li>${icon(good ? 'check' : 'x', 20)}${T(c, `columns.${i}.items.${j}`, '', 'span', 'Point')}</li>`).join('')}</ul>`);
    }).join('')}</div>`;
  },

  bullets: c => {
    const items = c.s.items || [];
    return `<div class="bl-wrap">${head(c, { lead: true, cls: 'bl-head' })}<ol class="bl-list">${items.map((it, i) => LI('items', i, 'bl-row rv',
      `<span class="bl-n">${pad2(i + 1)}</span><div>${T(c, `items.${i}.title`, 'bl-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'bl-body', 'p', 'Body', true)}</div>`, { tag: 'li' })).join('')}</ol></div>`;
  },

  process: c => {
    const items = c.s.items || [];
    return `${head(c)}<div class="pr-row n${clampN(items.length, 1, 5)}">${items.map((it, i) => LI('items', i, 'pr-step rv',
      `<div class="pr-top"><span class="pr-badge">${it.icon ? icon(it.icon, 30) : T(c, `items.${i}.step`, '', 'span', '01')}</span>${i < items.length - 1 ? '<span class="pr-line"></span>' : ''}</div>${T(c, `items.${i}.title`, 'pr-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'pr-body', 'p', 'Body', true)}`)).join('')}</div>`;
  },

  timeline: c => {
    const items = c.s.items || [];
    return `${head(c)}<div class="tl rv" style="--n:${clampN(items.length, 1, 6)}">${items.map((it, i) => LI('items', i, `tl-item ${esc(it.status || '')}`,
      `<span class="tl-dot"></span>${T(c, `items.${i}.date`, 'tl-date', 'div', 'Date')}<div class="card tl-card">${T(c, `items.${i}.title`, 'tl-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'tl-body', 'p', 'Body', true)}</div>`)).join('')}</div>`;
  },

  flow: c => {
    const items = c.s.items || [], W = 1120, H = 430, NW = 300, NH = 96, GAP = 22, HUBW = 320, HUBH = 150;
    const cols = { in: [], hub: [], out: [] };
    items.forEach((it, idx) => (cols[it.col] || cols.out).push(idx));
    if (!cols.hub.length && cols.out.length) cols.hub.push(cols.out.shift());
    const place = (arr, x, w, h) => { const tot = arr.length * h + (arr.length - 1) * GAP, y0 = (H - tot) / 2; return arr.map((idx, k) => ({ idx, x, y: y0 + k * (h + GAP), w, h })); };
    const ins = place(cols.in, 0, NW, NH), hub = place(cols.hub.slice(0, 1), (W - HUBW) / 2, HUBW, HUBH), outs = place(cols.out, W - NW, NW, NH);
    const h0 = hub[0];
    let paths = '';
    if (h0) {
      ins.forEach((n, k) => { const y1 = n.y + n.h / 2, y2 = h0.y + h0.h / 2, mx = (n.x + n.w + h0.x) / 2; paths += `<path class="fl-path" style="--i:${k}" d="M${n.x + n.w},${y1} C${mx},${y1} ${mx},${y2} ${h0.x},${y2}"/>`; });
      outs.forEach((n, k) => { const y1 = h0.y + h0.h / 2, y2 = n.y + n.h / 2, mx = (h0.x + h0.w + n.x) / 2; paths += `<path class="fl-path" style="--i:${k + 3}" d="M${h0.x + h0.w},${y1} C${mx},${y1} ${mx},${y2} ${n.x},${y2}"/>`; });
    }
    const node = (p, kind) => { const it = items[p.idx] || {}; return LI('items', p.idx, `fl-node ${kind} rv`, `<div class="ic-tile${kind === 'hub' ? ' lg' : ''}">${icon(it.icon || 'box', kind === 'hub' ? 34 : 26)}</div><div class="fl-txt">${T(c, `items.${p.idx}.title`, 'fl-title', 'h3', 'Title')}${T(c, `items.${p.idx}.body`, 'fl-body', 'p', 'Detail')}</div>`, { style: `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px` }); };
    return `${head(c)}<div class="fl-stage" style="width:${W}px;height:${H}px"><svg class="fl-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${paths}</svg>${ins.map(p => node(p, 'in')).join('')}${hub.map(p => node(p, 'hub')).join('')}${outs.map(p => node(p, 'out')).join('')}</div>`;
  },

  bento: c => {
    const items = c.s.items || [];
    return `${head(c, { cls: 'compact' })}<div class="bento">${items.map((t, i) => {
      const sz = ['s', 'w', 't', 'l'].includes(t.size) ? t.size : 's', tone = t.tone && PC.TONES[t.tone] ? t.tone : '', hasVal = t.value != null && String(t.value) !== '';
      const inner = (t.icon ? `<div class="ic-tile${sz === 's' ? ' sm' : ''}">${icon(t.icon, sz === 's' ? 22 : 28)}</div>` : '') + (hasVal ? T(c, `items.${i}.value`, 'b-val', 'div', 'Value') : '') + T(c, `items.${i}.title`, 'b-title', 'h3', 'Title') + T(c, `items.${i}.body`, 'b-body', 'p', 'Body', true);
      return LI('items', i, `card b-tile b-${sz}${tone ? ' b-fill' : ''} rv`, inner, { attrs: tone ? ` data-tone="${tone}"` : '' });
    }).join('')}</div>`;
  },

  anatomy: c => {
    const items = (c.s.items || []).slice(0, 5), spots = [[9, 58], [45, 14], [48, 60], [89, 58], [90, 5]];
    const mock = `<div class="an-mock card rv"><div class="mk-bar"><span class="mk-logo"></span><span class="mk-line"></span><span class="mk-sp"></span><span class="mk-chip"></span><span class="mk-chip"></span><span class="mk-chip acc"></span></div><div class="mk-rib"><span></span><span></span><span></span><span class="w2"></span><span></span></div>
      <div class="mk-main"><div class="mk-side"><i class="on"></i><i></i><i></i><i></i><i></i></div><div class="mk-canvas"><div class="mk-slide"><b class="k"></b><b class="h"></b><b class="h s"></b><b class="p"></b></div></div><div class="mk-insp"><em></em><b></b><b></b><i></i><b></b><i></i></div></div>
      ${items.map((_, i) => `<span class="hs" style="left:${spots[i][0]}%;top:${spots[i][1]}%">${i + 1}</span>`).join('')}</div>`;
    return `<div class="an-wrap">${mock}<div class="an-txt">${head(c, { lead: true })}<ol class="an-list">${items.map((it, i) => LI('items', i, 'an-item rv', `<span class="an-n">${i + 1}</span><div>${T(c, `items.${i}.title`, 'an-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'an-body', 'p', 'Body', true)}</div>`, { tag: 'li' })).join('')}</ol></div></div>`;
  },

  themes: c => {
    const items = c.s.items || [];
    return `${head(c)}<div class="th-grid n${clampN(items.length, 1, 5)}">${items.map((it, i) => {
      const th = PC.THEMES[it.theme] ? it.theme : 'studio', sw = PC.THEMES[th].swatch;
      return LI('items', i, 'th-card rv', `<div class="th-spec">Aa</div><div class="th-pal">${sw.map(x => `<i style="background:${x}"></i>`).join('')}</div>${T(c, `items.${i}.title`, 'th-title', 'h3', 'Title')}${T(c, `items.${i}.body`, 'th-body', 'p', 'Description', true)}`, { attrs: ` data-theme="${th}"` });
    }).join('')}</div>`;
  },

  code: c => {
    const cd = c.s.code || {}, srcLines = String(cd.source || '').split('\n'), lines = srcLines.length, maxLen = Math.max(0, ...srcLines.map(l => l.length)), size = lines > 20 || maxLen > 66 ? 'xs' : lines > 15 || maxLen > 58 ? 'sm' : '';
    return `<div class="cd-wrap"><div class="cd-side">${head(c, { lead: true })}</div><div class="cd-win rv"><div class="cd-bar"><i></i><i></i><i></i><span class="cd-file">${esc(cd.filename || '')}</span><span class="cd-lang">${esc(cd.language || '')}</span></div><pre class="cd-pre ${size}" data-path="code.source" data-readonly="1"><code>${PC.highlight(cd.source || '', cd.language)}</code></pre></div></div>`;
  },

  image: c => {
    const im = c.s.image || {};
    const fig = im.src ? `<img src="${esc(im.src)}" alt="${esc(im.alt || '')}">` : `<div class="im-ph">${icon('image', 72)}<span>Add an image in the Slide tab</span></div>`;
    return `<div class="im-wrap"><div class="im-fig card rv" data-path="image.src" data-readonly="1">${fig}</div><div class="im-txt">${head(c, { lead: true })}</div></div>`;
  }
};

/* ── custom slides: free-form HTML + CSS + JS, isolated in a sandboxed iframe ──────────────────────────────
   Threat model: the content may come from an AI or a stranger's deck file, so it is treated as hostile.
   • sandbox="allow-scripts" WITHOUT allow-same-origin → the frame gets an opaque origin: it cannot touch the editor's DOM,
     localStorage, cookies or IndexedDB, and cannot navigate the top window, open popups, submit forms or download.
   • a CSP <meta> is the FIRST thing in the document: no network (connect-src none), no nested frames, no forms, no <base>;
     only images/fonts from https:, data: or this site; inline script/style only.
   • thumbnails and print use sandbox="" (no scripts at all) and script-src 'none'.
   The Pitchcraft look (theme variables + kit classes) is pulled in with <link>s to the same two stylesheets the editor uses. */
const KIT_CSS = ['css/base.css', 'css/fonts.css', 'css/slides.css'];
const KIT_JS = `(function(){var P=function(m){try{parent.postMessage(m,'*')}catch(e){}};
window.pc={next:function(){P({pc:'nav',d:1})},prev:function(){P({pc:'nav',d:-1})}};
addEventListener('error',function(e){P({pc:'error',msg:String(e.message||e)+(e.lineno?' (line '+e.lineno+')':'')})});
addEventListener('unhandledrejection',function(e){P({pc:'error',msg:String((e.reason&&e.reason.message)||e.reason)})});
addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey)return;var t=e.target,g=t&&t.tagName;if(e.key!=='Escape'&&((/^(INPUT|TEXTAREA|SELECT)$/.test(g))||(t&&t.isContentEditable)||(/^(BUTTON|A)$/.test(g)&&(e.key===' '||e.key==='Enter'))))return;if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','PageDown','PageUp',' ','Enter','Escape','Home','End','Backspace','f','F','n','N'].indexOf(e.key)>-1)P({pc:'key',key:e.key})});
document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.rv').forEach(function(e,k){e.style.setProperty('--i',k)})});
/* layout check: the editor asks, we measure the rendered text and answer. Nothing here can read the editor. */
var pcWalk=${PC.walkSrc};var pcXd={};addEventListener('message',function(ev){var d=ev.data;if(ev.source!==parent||!d||d.pc!=='export')return;if(pcXd[d.id])return;pcXd[d.id]=1;var go=function(){if(pcXd[d.id]!==1)return;pcXd[d.id]=2;var r;try{r=pcWalk(document.querySelector('.slide'))}catch(x){r={error:String(x&&x.message||x)}}P({pc:'export-result',id:d.id,result:r})};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go,go);setTimeout(go,3500)}else go()});
var pcDone={};addEventListener('message',function(ev){var d=ev.data;if(ev.source!==parent||!d||d.pc!=='audit')return;if(pcDone[d.id]){if(pcDone[d.id]!==1)P({pc:'audit-result',id:d.id,result:pcDone[d.id]});return}pcDone[d.id]=1;var go=function(w){if(pcDone[d.id]!==1)return;var r;try{r=pcAudit();r.fontsReady=w!==false}catch(x){r={error:String(x&&x.message||x)}}pcDone[d.id]=r;P({pc:'audit-result',id:d.id,result:r})};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){go(true)},function(){go(false)});setTimeout(function(){go(false)},3500)}else go(true)});
function pcAudit(){var W=1280,H=720,out=[],items=[],tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n;
var name=function(el){var c=typeof el.className==='string'?el.className.trim().split(' ')[0]:'';return el.tagName.toLowerCase()+(c?'.'+c:'')};
var flag=function(type,el,detail,text){if(out.length<40)out.push({type:type,el:name(el),text:(text||'').slice(0,40),detail:detail})};
var blockOf=function(el){while(el&&el.parentElement&&getComputedStyle(el).display==='inline')el=el.parentElement;return el};
while((n=tw.nextNode())){var t=n.nodeValue.trim();if(!t)continue;var el=n.parentElement;if(!el||el.tagName==='SCRIPT'||el.tagName==='STYLE')continue;
var cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0)continue;
var rg=document.createRange();rg.selectNodeContents(n);var b=rg.getBoundingClientRect();if(b.width<1||b.height<1)continue;
var a={el:el,b:b,t:t,blk:blockOf(el)};items.push(a);var tops={},rs=rg.getClientRects();for(var q=0;q<rs.length;q++)if(rs[q].width>0.5)tops[Math.round(rs[q].top/4)]=1;var lines=Object.keys(tops).length;if(lines>1&&cs.whiteSpace.indexOf('pre')<0&&(t.length<=14||(!/\\s/.test(t)&&t.length<=30)))flag('label-wraps',el,'short text breaks onto '+lines+' lines; widen its box or set white-space:nowrap',t);
if(b.right>W+1||b.bottom>H+1||b.left<-1||b.top<-1)flag('text-off-slide',el,'text spans x '+Math.round(b.left)+'-'+Math.round(b.right)+', y '+Math.round(b.top)+'-'+Math.round(b.bottom)+' on a 1280x720 slide',t);
else if(b.left<48||b.right>W-48||b.top<36||b.bottom>H-36)flag('outside-safe-area',el,'text reaches x '+Math.round(b.left)+'-'+Math.round(b.right)+', y '+Math.round(b.top)+'-'+Math.round(b.bottom)+' (keep 48px side and 36px top/bottom margins)',t);
for(var p=el;p&&p!==document.body;p=p.parentElement){var pc=getComputedStyle(p);if(pc.overflowX!=='visible'||pc.overflowY!=='visible'){var pr=p.getBoundingClientRect();if(b.right>pr.right+2||b.bottom>pr.bottom+2||b.left<pr.left-2||b.top<pr.top-2){flag('clipped',el,'text extends past its container '+name(p)+' ('+Math.round(pr.width)+'x'+Math.round(pr.height)+') which hides overflow',t);break}}}
if(el.scrollWidth>el.clientWidth+2&&cs.display!=='inline'&&cs.overflowX==='visible')flag('text-wider-than-box',el,'content is '+el.scrollWidth+'px wide in a '+el.clientWidth+'px box',t)}
for(var i=0;i<items.length;i++)for(var j=i+1;j<items.length;j++){var p1=items[i],p2=items[j];if(p1.blk===p2.blk)continue;var x=Math.min(p1.b.right,p2.b.right)-Math.max(p1.b.left,p2.b.left),y=Math.min(p1.b.bottom,p2.b.bottom)-Math.max(p1.b.top,p2.b.top);
if(x>3&&y>3&&x*y>0.25*Math.min(p1.b.width*p1.b.height,p2.b.width*p2.b.height))flag('text-overlap',p1.el,'overlaps "'+p2.t.slice(0,30)+'" ('+name(p2.el)+') by '+Math.round(x)+'x'+Math.round(y)+'px',p1.t)}
var boxes=[],all=document.body.getElementsByTagName('*'),k0;for(k0=0;k0<all.length&&boxes.length<400;k0++){var be=all[k0];if(/^(SCRIPT|STYLE|BR|svg|path|g)$/.test(be.tagName))continue;var bc=getComputedStyle(be);if(bc.display==='none'||bc.visibility==='hidden')continue;var br=be.getBoundingClientRect();if(br.width<20||br.height<14||(br.width>W*0.96&&br.height>H*0.9))continue;var bm=bc.backgroundColor.match(/rgba?\\(([^)]+)\\)/),ba=bm?(bm[1].split(',').length>3?parseFloat(bm[1].split(',')[3]):1):0,bd=parseFloat(bc.borderTopWidth)+parseFloat(bc.borderLeftWidth)+parseFloat(bc.borderRightWidth)+parseFloat(bc.borderBottomWidth);if(be.getAttribute('aria-hidden')==='true'||be.closest('[aria-hidden=true]'))continue;if(ba>0.08||bd>0)boxes.push({e:be,r:br})}
var flagged={};items.forEach(function(a,ai){for(var m=0;m<boxes.length;m++){var bx=boxes[m];if(bx.e===a.el&&!bx.e.contains(a.el))continue;var ix=Math.min(a.b.right,bx.r.right)-Math.max(a.b.left,bx.r.left),iy=Math.min(a.b.bottom,bx.r.bottom)-Math.max(a.b.top,bx.r.top);if(ix<=1||iy<=1)continue;var inside=a.b.left>=bx.r.left-1&&a.b.right<=bx.r.right+1&&a.b.top>=bx.r.top-1&&a.b.bottom<=bx.r.bottom+1;if(inside){if(bx.e.contains(a.el)){var gap=Math.min(a.b.left-bx.r.left,bx.r.right-a.b.right,a.b.top-bx.r.top,bx.r.bottom-a.b.bottom);if(gap<3&&!flagged[ai]&&a.b.width>14){flagged[ai]=1;flag('text-cramped',a.el,'text sits '+Math.max(0,Math.round(gap))+'px from the edge of '+name(bx.e)+'; add padding',a.t)}}continue}
if(a.b.left<=bx.r.left+1&&a.b.right>=bx.r.right-1&&a.b.top<=bx.r.top+1&&a.b.bottom>=bx.r.bottom-1)continue;if(ix*iy<0.04*a.b.width*a.b.height)continue;if(flagged[ai])continue;flagged[ai]=1;flag('text-crosses-edge',a.el,'text straddles the edge of '+name(bx.e)+' (box '+Math.round(bx.r.left)+','+Math.round(bx.r.top)+' '+Math.round(bx.r.width)+'x'+Math.round(bx.r.height)+'); it is partly inside and partly outside',a.t)}});
return {problems:out,texts:items.length}}
})();`;
/* Designing a custom slide (editor canvas only, mode 'live'): the designer in js/framedesign.js is injected as source (PC.design.designSrc).
   It selects, moves, resizes, restyles and edits the words of the slide's own HTML elements, and tells the editor what to store
   ({pc:'style'|'edit'|'struct'|...}, see js/htmlformat.js). The editor re-parses custom.html, matches each element by index plus a
   signature, and writes a whitelisted inline style (PC.design.applyStyles) or the text (PC.editCustomHtml). */

const EDIT_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'MARK', 'CODE', 'SPAN', 'BR', 'SMALL', 'SUB', 'SUP']);
/** Write an in-frame text edit back into a custom slide's HTML source. Returns the new HTML, or null if the element cannot be matched. */
PC.editCustomHtml = function (html, idx, tag, old, edited, rich) {
  if (!Number.isInteger(idx) || idx < 0 || typeof html !== 'string' || typeof edited !== 'string' || edited.length > 50000) return null;
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html'), el = doc.body.querySelectorAll('*')[idx];
  const norm = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  if (!el || el.tagName !== String(tag).toUpperCase() || norm(el.textContent) !== norm(old)) return null;
  const src = new DOMParser().parseFromString('<!doctype html><body>' + edited, 'text/html');
  const clean = (from, into) => from.childNodes.forEach(n => {
    if (n.nodeType === 3) into.appendChild(doc.createTextNode(n.nodeValue));
    else if (n.nodeType === 1 && rich && EDIT_INLINE.has(n.tagName)) {
      const c = doc.createElement(n.tagName.toLowerCase());
      if (n.getAttribute('class')) c.setAttribute('class', n.getAttribute('class').slice(0, 200));
      const st = n.getAttribute('style'); if (st && !/url\(|expression|@import|javascript:/i.test(st)) c.setAttribute('style', st.slice(0, 400));
      clean(n, c); into.appendChild(c);
    } else if (n.nodeType === 1) clean(n, into);   // anything else keeps only its text
  });
  while (el.firstChild) el.removeChild(el.firstChild);
  if (rich) clean(src.body, el); else el.appendChild(doc.createTextNode(src.body.textContent));
  return doc.body.innerHTML.slice(0, PC.LIMITS.custom);
};
const inStyle = t => String(t || '').replace(/<\/style/gi, '<\\/style');
const inScript = t => String(t || '').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

PC.customDoc = function (s, meta, mode) {
  const c = s.custom || {}, run = mode === 'live' || mode === 'present', still = !run;
  const origin = location.origin && location.origin !== 'null' ? location.origin : 'file:';
  const csp = ["default-src 'none'", run ? "script-src 'unsafe-inline'" : "script-src 'none'", `style-src 'unsafe-inline' ${origin}`, `img-src data: https: ${origin}`, `font-src data: https: ${origin}`,
    'media-src data: https:', "connect-src 'none'", "frame-src 'none'", "form-action 'none'", "base-uri 'none'"].join('; ');
  const mode2 = PC.fillMode(s, meta), attrs = `data-theme="${esc(meta.theme || 'studio')}"${mode2 ? ` data-bg="${esc(mode2)}"` : ''}${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}${s.fill && PC.okColor(s.fill) ? ` style="--slide-bg:${esc(s.fill)}"` : ''}`;
  const links = KIT_CSS.map(p => `<link rel="stylesheet" href="${esc(new URL(p, document.baseURI).href)}">`).join('');
  return `<!doctype html><html lang="en"${mode === 'present' ? ' class="anim"' : ''}><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">${links}`
    + `<style>html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden;background:transparent}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{-webkit-font-smoothing:antialiased}.slide{width:1280px;height:720px}${still ? '*,*::before,*::after{animation:none!important;transition:none!important}' : ''}</style>`
    + `<style>${inStyle(meta.css)}</style><style>${inStyle(c.css)}</style></head>`
    + `<body><div class="slide layout-${esc(c.base || 'custom')}" data-pc-custom="1" ${attrs}>${c.html || ''}</div>`
    + (run ? `<script>${KIT_JS}</script>${mode === 'live' ? `<script>${PC.design.designSrc}</script>` : ''}${c.js ? `<script>${inScript(c.js)}</script>` : ''}` : '') + '</body></html>';
};

/** Turn any templated slide into the equivalent free-form HTML (what you see, as editable code). */
PC.detach = function (s, deck) {
  const meta = Object.assign({}, (deck && deck.meta) || PC.DEFAULT_META(), { numbers: false });
  const tpl = document.createElement('template');
  tpl.innerHTML = PC.renderSlide(Object.assign({}, s, { objects: [] }), { editable: false, index: 0, total: 1, deck: { meta }, mode: 'thumb' });   // free-form objects stay objects; only the template is baked into code
  const sec = tpl.content.firstElementChild, strip = ['data-path', 'data-list', 'data-idx', 'data-readonly', 'data-ph', 'data-ml'];
  sec.querySelectorAll(strip.map(a => `[${a}]`).join(',')).forEach(el => strip.forEach(a => el.removeAttribute(a)));
  let html = sec.innerHTML;
  if (!/<pre[\s>]/i.test(html)) html = html.replace(/>\s*</g, '>\n<');
  return { html: html.slice(0, PC.LIMITS.custom), css: '', js: '', base: s.layout, interactive: false };
};

/* the custom renderer: the stage section holds one iframe; everything else is inside its sandbox */
R.custom = c => {
  const mode = c.mode, run = mode === 'live' || mode === 'present';
  return `<iframe class="cs-frame" title="${esc(PC.plain(c.s.headline || 'Custom slide'))}" sandbox="${run ? 'allow-scripts' : ''}" tabindex="-1" loading="eager"${c.s.custom && c.s.custom.interactive ? ' data-interactive="1"' : ''} srcdoc="${esc(PC.customDoc(c.s, c.meta, mode))}"></iframe>`;
};

const DECO_LAYOUTS = new Set(['title', 'statement', 'section', 'closing', 'quote']);

/**
 * Render one slide to an HTML string.
 * opts: { editable, index, total, deck, mode }   mode: 'thumb' (default, never runs scripts) | 'live' (editor) | 'present'
 */
PC.renderSlide = function (s, opts = {}) {
  const deck = opts.deck || { meta: PC.DEFAULT_META() }, meta = deck.meta || PC.DEFAULT_META();
  const c = { s, editable: !!opts.editable, mode: opts.mode || 'thumb', meta };
  CUR = s;
  const body = (R[Object.prototype.hasOwnProperty.call(R, s.layout) ? s.layout : 'statement'])(c);
  const deco = DECO_LAYOUTS.has(s.layout) ? '<div class="deco" aria-hidden="true"><i></i><i></i><i></i></div>' : '';
  const bgimg = s.bgImage && PC.okUrl(s.bgImage) && s.layout !== 'custom' ? `<img class="s-bgimg" src="${esc(s.bgImage)}" alt="" draggable="false">` : '';
  const objs = PC.renderObjects(s, c);
  CUR = null;
  const foot = meta.numbers && s.layout !== 'custom' ? `<footer class="s-foot"><span>${esc(meta.name || '')}</span><span>${pad2((opts.index || 0) + 1)} / ${pad2(opts.total || 1)}</span></footer>` : '';
  const attrs = [`data-slide-id="${esc(s.id)}"`, `data-layout="${esc(s.layout)}"`, `data-theme="${esc(meta.theme || 'studio')}"`];
  const mode = PC.fillMode(s, meta);
  if (mode) attrs.push(`data-bg="${esc(mode)}"`);
  if (s.tone) attrs.push(`data-tone="${esc(s.tone)}"`);
  if (s.fill && PC.okColor(s.fill) && s.layout !== 'custom') attrs.push(`style="--slide-bg:${esc(s.fill)}"`);
  return `<section class="slide layout-${esc(s.layout)}" ${attrs.join(' ')}>${deco}${bgimg}${body}${objs}${foot}</section>`;
};
})();
