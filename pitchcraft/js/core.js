/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT core — utilities, icons, layout specs, data model
   Classic script (no modules) so index.html also works from file://
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC = window.PC || {};
PC.VERSION = '3.3.0';
PC.STAGE = { w: 1280, h: 720 };

/* ── utilities ─────────────────────────────────────────────── */
PC.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
PC.clone = o => JSON.parse(JSON.stringify(o));
PC.getPath = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
PC.setPath = (obj, path, val) => {
  const ks = String(path).split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[k];
  }
  o[ks[ks.length - 1]] = val;
};
PC.slug = s => String(s || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'deck';
PC.pad2 = n => String(n).padStart(2, '0');
PC.uid = (() => { let n = 0; return p => (p || 'u') + (++n); })();

/* Inline mini-markup used in every text field:  **bold**  *italic*  ==accent==  `code` */
PC.rich = s => PC.esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/==(.+?)==/g, '<mark class="hl">$1</mark>')
  .replace(/(^|[^*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>')
  .replace(/`([^`\n]+)`/g, '<code>$1</code>');
PC.plain = s => String(s ?? '').replace(/\*\*|==|`/g, '').replace(/\*([^*\n]+)\*/g, '$1').replace(/\s+/g, ' ').trim();

/* contenteditable="plaintext-only" where the browser supports it */
PC.plainSupported = (() => { try { const d = document.createElement('div'); d.setAttribute('contenteditable', 'plaintext-only'); return d.contentEditable === 'plaintext-only'; } catch (e) { return false; } })();

/* ── icons (24×24 stroke set) ──────────────────────────────── */
const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ICONS = {
  // UI
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', copy: 'M9 9h11v11H9zM5 15V4h11',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6',
  chevdown: 'M6 9l6 6 6-6', play: 'F:M7 4.5v15l13-7.5z', x: 'M6 6l12 12M18 6L6 18',
  layout: 'M3 4h18v16H3zM3 10h18M10 10v10', palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.6-1.1-1.9-1.1-3.1 0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4c0-4.1-4-7.3-9-7.3zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16', upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  help: c(12, 12, 9) + 'M9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.7M12 17h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' + c(12, 12, 3), sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  sidebar: 'M3 4h18v16H3zM9 4v16', panel: 'M3 4h18v16H3zM15 4v16', bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M14 5h-4M14 19h-4M15 5l-6 14', marker: 'M4 21h16M8 16l8-8 3 3-8 8H8zM15 9l-1-1', clear: 'M6 5h12M12 5v10M9 19h6M5 21L19 9',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', notes: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  more: 'M5 12h.01M12 12h.01M19 12h.01', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  printer: 'M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', menu: 'M4 6h16M4 12h16M4 18h16',
  file: 'M6 3h9l4 4v14H6zM15 3v4h4', zoomin: c(11, 11, 7) + 'M21 21l-5-5M11 8v6M8 11h6', clipboard: 'M9 4h6v3H9zM6 5h3M15 5h3M6 5v16h12V5',
  // content
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', globe: c(12, 12, 9) + 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  wand: 'M5 19 17 7M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z', cursor: 'M5 3l14 7-6 2-2 6z',
  clock: c(12, 12, 9) + 'M12 7v5l3 2', check: 'M5 13l4 4L19 7', users: c(9, 8, 4) + 'M2 21c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 0 1 0 7M22 21c0-3-2-5-5-5.5',
  user: c(12, 8, 4) + 'M4 21c0-4 3.5-6 8-6s8 2 8 6', target: c(12, 12, 9) + c(12, 12, 4.5) + 'M12 12h.01',
  rocket: 'M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 4c3-1 6-1 7-1 0 1 0 4-1 7l-7 7-6-6zM15 9h.01', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4', box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', type: 'M5 7V4h14v3M12 4v16M9 20h6',
  image: 'M3 5h18v14H3z' + c(8.5, 9.5, 1.5) + 'M21 16l-5-5-8 8', table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  pie: 'M12 3v9h9M20.5 15A9 9 0 1 1 9 3.5', terminal: 'M4 5h16v14H4zM7 10l3 2-3 2M12 15h5', flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  presentation: 'M3 4h18v12H3zM12 16v4M8 20h8', quote: 'M4 18v-5a5 5 0 0 1 5-5M13 18v-5a5 5 0 0 1 5-5M4 13h5v5H4zM13 13h5v5h-5z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z', key: c(8, 15, 4) + 'M11 12l9-9M17 6l3 3M15 8l2 2',
  puzzle: 'M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z', git: c(6, 6, 2) + c(6, 18, 2) + c(18, 8, 2) + 'M6 8v8M18 10c0 4-6 3-10 7',
  compass: c(12, 12, 9) + 'M15.5 8.5l-2 5-5 2 2-5z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6', feather: 'M20 4c-6 0-12 4-12 11l-3 5M8 15h6M12 11h5', gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01', map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  shapes: 'M3 13h8v8H3z' + c(17, 17, 4) + 'M12 3l4.5 7h-9z', move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  forward: 'M8 8h12v12H8zM4 16V4h12', backward: 'M4 4h12v12H4zM20 8v12H8', front: 'M9 9h11v11H9zM4 15V4h11', back: 'M4 4h11v11H4zM20 9v11H9', rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', lockshape: 'M6 11h12v9H6z'
};
PC.ICON_NAMES = ['bolt', 'layers', 'sparkles', 'chart', 'lock', 'globe', 'wand', 'cursor', 'clock', 'check', 'users', 'user', 'target', 'rocket', 'shield', 'cpu', 'box', 'link', 'star', 'type', 'image', 'table', 'pie', 'terminal', 'flag', 'presentation', 'heart', 'key', 'puzzle', 'git', 'compass', 'mail', 'feather', 'gauge', 'edit', 'tag', 'map', 'file', 'code', 'download', 'upload', 'eye', 'palette', 'grid', 'play'];
ICONS.code = 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14';
PC.icon = (name, size = 20, cls = '') => {
  const d = ICONS[name] || ICONS.sparkles; const fill = d.startsWith('F:');
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${fill ? d.slice(2) : d}"/></svg>`;
};

/* Logo mark: a stack of slides with a spark. Used in header, favicon and README. */
PC.logoMark = (size = 28) => `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="pcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c6bff"/><stop offset="1" stop-color="#ff6b57"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="9" fill="url(#pcg)"/><rect x="8" y="9" width="14" height="10" rx="2.2" fill="#fff" opacity=".45"/><rect x="10.5" y="12" width="14" height="10" rx="2.2" fill="#fff"/><path d="M22.5 6.2l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#fff"/></svg>`;

/* ── themes, tones, backgrounds, transitions ───────────────── */
PC.THEMES = {
  studio: { name: 'Studio', desc: 'Clean and confident. Bricolage Grotesque headlines.', font: 'Bricolage Grotesque', em: { display: 0.47, body: 0.48 }, swatch: ['#5b4bff', '#ff6b57', '#12b5a5'] },
  editorial: { name: 'Editorial', desc: 'Instrument Serif on warm paper. Reads like a magazine.', font: 'Instrument Serif', em: { display: 0.33, body: 0.48 }, swatch: ['#b3432b', '#1d2433', '#c99a3c'] },
  contrast: { name: 'Contrast', dark: true, desc: 'Loud, dark and uppercase. Syne headlines.', font: 'Syne', em: { display: 1.01, body: 0.48 }, swatch: ['#ff5d73', '#c8ff3d', '#0c0b12'] },
  aurora: { name: 'Aurora', dark: true, desc: 'Deep gradients and glass cards.', font: 'Bricolage Grotesque', em: { display: 0.47, body: 0.48 }, swatch: ['#7cf5d4', '#9b7bff', '#ff8ad8'] },
  brutal: { name: 'Brutalist', desc: 'Hard borders, hard shadows, no apologies.', font: 'Syne', em: { display: 0.77, body: 0.48 }, swatch: ['#ffd93d', '#ff4d2e', '#111111'] }
};
PC.TONES = { '': 'Theme', coral: 'Coral', amber: 'Amber', teal: 'Teal', green: 'Green', blue: 'Blue', violet: 'Violet', pink: 'Pink' };
PC.TONE_HEX = { '': '', coral: '#ff6b57', amber: '#f5a524', teal: '#12b5a5', green: '#22b55e', blue: '#2f80ff', violet: '#9b5cff', pink: '#ff4fa3' };
PC.BGS = { '': 'Auto', tint: 'Tint', dark: 'Dark', accent: 'Accent', grad: 'Gradient' };
PC.TRANSITIONS = { none: 'None', fade: 'Fade', slide: 'Slide', zoom: 'Zoom', rise: 'Rise', blur: 'Blur' };
PC.CHART_TYPES = { bar: 'Bar', hbar: 'Horizontal bar', line: 'Line', area: 'Area', donut: 'Donut' };

/* ── layout specs: ONE source of truth for renderer, inspector, picker and AI prompt ── */
const TXT = { kicker: 'Kicker', headline: 'Headline', body: 'Body' };
const ic = { k: 'icon', label: 'Icon', t: 'icon' };
PC.LAYOUTS = {
  blank: { name: 'Blank', group: 'Free-form', desc: 'An empty canvas. Add text, images and shapes anywhere.', text: {}, special: 'blank',
    doc: 'objects:[{id,type:"text"|"shape"|"image"|"icon",x,y,w,h?,...}] - the whole slide is free-form objects on the 1280x720 stage (see "Free-form objects" in the AI guide). No kicker/headline/body.' },
  title: { name: 'Title', group: 'Story', desc: 'Big opening statement', text: { kicker: 'Kicker', headline: 'Title', body: 'Subtitle' }, doc: 'kicker, headline, body' },
  statement: { name: 'Statement', group: 'Story', desc: 'One idea, centred', text: { kicker: 'Kicker', headline: 'Statement', body: 'Supporting line' }, doc: 'kicker, headline, body' },
  section: { name: 'Section', group: 'Story', desc: 'Chapter divider with a huge number', text: { kicker: 'Number', headline: 'Section title', body: 'Description' }, doc: 'kicker (the number, e.g. "02"), headline, body' },
  quote: { name: 'Quote', group: 'Story', desc: 'A pull quote with attribution', text: { headline: 'Quote', body: 'Attribution' }, doc: 'headline (the quote), body (who said it)' },
  closing: { name: 'Closing', group: 'Story', desc: 'Final call to action', text: TXT, doc: 'kicker, headline, body, items:[{icon?,label,value}]',
    list: { key: 'items', noun: 'chip', max: 5, min: 0, fields: [ic, { k: 'label', label: 'Label' }, { k: 'value', label: 'Value' }], blank: { icon: 'check', label: 'Label', value: 'Value' } } },
  metrics: { name: 'Metrics', group: 'Data', desc: 'Big-number KPI cards', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{value,label,trend:"up"|"down"?,note?}] (2-4 items)',
    list: { key: 'items', noun: 'metric', min: 1, max: 4, fields: [{ k: 'value', label: 'Value' }, { k: 'label', label: 'Label' }, { k: 'trend', label: 'Trend', t: 'select', opts: { '': 'None', up: 'Up', down: 'Down' } }, { k: 'note', label: 'Note' }], blank: { value: '0', label: 'Label', trend: '', note: '' } } },
  chart: { name: 'Chart', group: 'Data', desc: 'Bar, line, area or donut with insight', text: { kicker: 'Kicker', headline: 'Headline', body: 'Insight' }, special: 'chart',
    doc: 'kicker, headline, body (insight), chartType:"bar"|"hbar"|"line"|"area"|"donut", chartData:{labels:[],series:[{name,values:[]}]} or {segments:[{label,value}],centerLabel?,centerSub?}, items?:[{value,label}] callouts',
    list: { key: 'items', noun: 'callout', min: 0, max: 3, fields: [{ k: 'value', label: 'Value' }, { k: 'label', label: 'Label' }], blank: { value: '0', label: 'Label' } } },
  demo: { name: 'Data → slide', group: 'Data', desc: 'Shows the JSON next to what it renders', text: { kicker: 'Kicker', headline: 'Headline', body: 'Caption' }, special: 'chart', doc: 'same fields as chart; the code panel is generated from chartData' },
  table: { name: 'Table', group: 'Data', desc: 'Reference table', text: { kicker: 'Kicker', headline: 'Headline' }, special: 'table', doc: 'kicker, headline, tableData:{headers:[],rows:[[]]}' },
  split: { name: 'Split', group: 'Structure', desc: 'Two big ideas side by side', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, columns:[{icon?,headline,body}] (2-3)',
    list: { key: 'columns', noun: 'column', min: 2, max: 3, fields: [ic, { k: 'headline', label: 'Headline' }, { k: 'body', label: 'Body', t: 'area' }], blank: { icon: 'sparkles', headline: 'Headline', body: 'Body' } } },
  cards: { name: 'Cards', group: 'Structure', desc: 'Three or four icon cards', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{icon,title,body}] (3-4)',
    list: { key: 'items', noun: 'card', min: 2, max: 4, fields: [ic, { k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }], blank: { icon: 'sparkles', title: 'Title', body: 'Body' } } },
  comparison: { name: 'Comparison', group: 'Structure', desc: 'Before / after, us / them', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, columns:[{headline,body,items:["line",…]}] (exactly 2; first is the "old", second the "new")',
    list: { key: 'columns', noun: 'column', min: 2, max: 2, fields: [{ k: 'headline', label: 'Headline' }, { k: 'body', label: 'Body', t: 'area' }, { k: 'items', label: 'Points (one per line)', t: 'lines' }], blank: { headline: 'Headline', body: '', items: ['Point'] } } },
  bullets: { name: 'Bullets', group: 'Structure', desc: 'Numbered points beside a headline', text: TXT, doc: 'kicker, headline, body, items:[{title,body}] (3-5)',
    list: { key: 'items', noun: 'point', min: 1, max: 6, fields: [{ k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }], blank: { title: 'Title', body: 'Body' } } },
  process: { name: 'Process', group: 'Structure', desc: 'Steps left to right', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{step?,icon?,title,body}] (3-5)',
    list: { key: 'items', noun: 'step', min: 2, max: 5, fields: [{ k: 'step', label: 'Step label' }, ic, { k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }], blank: { step: '05', title: 'Step', body: 'What happens' } } },
  timeline: { name: 'Timeline', group: 'Structure', desc: 'Milestones along a line', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{date,title,body,status:"done"|"now"|"next"?}] (3-5)',
    list: { key: 'items', noun: 'milestone', min: 2, max: 5, fields: [{ k: 'date', label: 'Date / phase' }, { k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }, { k: 'status', label: 'Status', t: 'select', opts: { '': 'None', done: 'Done', now: 'Now', next: 'Next' } }], blank: { date: 'Q4', title: 'Milestone', body: 'What ships', status: 'next' } } },
  flow: { name: 'Flow diagram', group: 'Structure', desc: 'Inputs → hub → outputs', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{col:"in"|"hub"|"out",icon,title,body}] (1-3 "in", exactly 1 "hub", 1-3 "out")',
    list: { key: 'items', noun: 'node', min: 3, max: 7, fields: [{ k: 'col', label: 'Column', t: 'select', opts: { in: 'Input', hub: 'Hub', out: 'Output' } }, ic, { k: 'title', label: 'Title' }, { k: 'body', label: 'Body' }], blank: { col: 'out', icon: 'box', title: 'Node', body: 'Detail' } } },
  bento: { name: 'Bento', group: 'Visual', desc: 'Mixed-size tile grid', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{size:"s"|"w"|"t"|"l",tone?,icon?,title,value?,body?}] (aim for tiles that fill a 4x3 grid: e.g. one "l", one "w" and six "s")',
    list: { key: 'items', noun: 'tile', min: 2, max: 10, fields: [{ k: 'size', label: 'Size', t: 'select', opts: { s: 'Small (1×1)', w: 'Wide (2×1)', t: 'Tall (1×2)', l: 'Large (2×2)' } }, { k: 'tone', label: 'Fill', t: 'select', opts: { '': 'None', coral: 'Coral', amber: 'Amber', teal: 'Teal', green: 'Green', blue: 'Blue', violet: 'Violet', pink: 'Pink' } }, ic, { k: 'title', label: 'Title' }, { k: 'value', label: 'Big value' }, { k: 'body', label: 'Body', t: 'area' }], blank: { size: 's', tone: '', icon: 'sparkles', title: 'Tile', value: '', body: '' } } },
  anatomy: { name: 'Editor anatomy', group: 'Visual', desc: 'Annotated diagram of the editor', text: TXT, doc: 'kicker, headline, body, items:[{title,body}] (up to 5; numbered hotspots on a drawing of the editor)',
    list: { key: 'items', noun: 'hotspot', min: 1, max: 5, fields: [{ k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }], blank: { title: 'Part', body: 'What it does' } } },
  themes: { name: 'Themes', group: 'Visual', desc: 'Live previews of the built-in themes', text: { kicker: 'Kicker', headline: 'Headline' }, doc: 'kicker, headline, items:[{theme:"studio"|"editorial"|"contrast"|"aurora"|"brutal",title,body}]',
    list: { key: 'items', noun: 'theme card', min: 1, max: 5, fields: [{ k: 'theme', label: 'Theme', t: 'select', opts: Object.fromEntries(Object.entries(PC.THEMES).map(([k, v]) => [k, v.name])) }, { k: 'title', label: 'Title' }, { k: 'body', label: 'Body', t: 'area' }], blank: { theme: 'studio', title: 'Theme', body: 'Description' } } },
  code: { name: 'Code', group: 'Visual', desc: 'Syntax-highlighted window', text: TXT, special: 'code', doc: 'kicker, headline, body, code:{language:"json"|"js"|"html"|"css"|"bash",filename?,source}' },
  custom: { name: 'HTML, CSS and JS', group: 'Custom', desc: 'Write the slide as code: any layout, brand style or animation.', text: { headline: 'Slide name (only used in menus)' }, special: 'custom',
    doc: 'headline (a NAME only, not drawn), custom:{html,css?,js?,base?,interactive?}. html is the whole 1280x720 slide: write anything. See "Custom layout" in the AI guide.' },
  image: { name: 'Image', group: 'Visual', desc: 'Picture beside text', text: TXT, special: 'image', doc: 'kicker, headline, body, image:{src (https URL or data URI),alt}' }
};
PC.LAYOUT_GROUPS = ['Free-form', 'Story', 'Data', 'Structure', 'Visual', 'Custom'];

/* ── seed content (used for new slides, layout-switching and layout-picker previews) ── */
PC.SEEDS = {
  blank: { objects: [] },
  title: { kicker: 'Presentation', headline: 'A title worth *reading*', body: 'One sentence that says what this deck is about.' },
  statement: { kicker: 'The point', headline: 'One idea, said ==loudly==.', body: 'Land the point before you back it up.' },
  section: { kicker: '02', headline: 'Section title', body: 'What this part of the story covers.' },
  quote: { headline: 'The best way to predict the future is to ==invent== it.', body: 'Alan Kay' },
  closing: { kicker: 'Next', headline: 'Thank you.', body: 'Questions, ideas, objections - all welcome.', items: [{ icon: 'mail', label: 'Email', value: 'you@example.com' }, { icon: 'globe', label: 'Web', value: 'example.com' }] },
  metrics: { kicker: 'By the numbers', headline: 'Three numbers that ==matter==', items: [{ value: '42%', label: 'Conversion', trend: 'up', note: '+6 pts' }, { value: '1.8s', label: 'Load time', trend: 'down', note: '-0.4s' }, { value: '12k', label: 'Active users', trend: 'up', note: '+18%' }] },
  chart: { kicker: 'Sample data', headline: 'Revenue grew every quarter', body: 'Q4 was the strongest quarter yet, driven by repeat customers.', chartType: 'bar', chartData: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Revenue', values: [12, 19, 27, 41] }] }, items: [{ value: '+242%', label: 'Year on year' }] },
  demo: { kicker: 'Sample data', headline: 'Data in, slide out', body: 'Edit the numbers and the chart follows.', chartType: 'line', chartData: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ name: 'Visits', values: [12, 19, 15, 28, 34] }] } },
  table: { kicker: 'Reference', headline: 'Plans at a glance', tableData: { headers: ['Plan', 'Seats', 'Support', 'Price'], rows: [['Starter', '3', 'Email', '$0'], ['Team', '25', 'Priority', '$29'], ['Company', 'Unlimited', 'Dedicated', 'Talk to us']] } },
  split: { kicker: 'Two paths', headline: 'Pick the route that fits', columns: [{ icon: 'users', headline: 'For teams', body: 'Explain the first option in two short sentences.' }, { icon: 'user', headline: 'For individuals', body: 'Explain the second option in two short sentences.' }] },
  cards: { kicker: 'Why it works', headline: 'Three reasons to ==care==', items: [{ icon: 'bolt', title: 'Fast', body: 'Say why the first benefit matters.' }, { icon: 'shield', title: 'Safe', body: 'Say why the second benefit matters.' }, { icon: 'sparkles', title: 'Delightful', body: 'Say why the third benefit matters.' }] },
  comparison: { kicker: 'The shift', headline: 'Before and after', columns: [{ headline: 'Before', body: 'How it used to work.', items: ['Manual steps', 'Slow feedback', 'Lost context'] }, { headline: 'After', body: 'How it works now.', items: ['One click', 'Instant feedback', 'Everything in one place'] }] },
  bullets: { kicker: 'Key points', headline: 'What you need to remember', body: 'Four things, in order of importance.', items: [{ title: 'Start with the why', body: 'People remember purpose before detail.' }, { title: 'Show, then tell', body: 'A picture earns the right to explain.' }, { title: 'One idea per slide', body: 'If it needs two, make two.' }, { title: 'End with an ask', body: 'Say what should happen next.' }] },
  process: { kicker: 'How it works', headline: 'Four steps, nothing else', items: [{ step: '01', icon: 'download', title: 'Collect', body: 'Bring the inputs together.' }, { step: '02', icon: 'wand', title: 'Shape', body: 'Turn them into a story.' }, { step: '03', icon: 'play', title: 'Present', body: 'Deliver with confidence.' }, { step: '04', icon: 'upload', title: 'Share', body: 'Send it anywhere.' }] },
  timeline: { kicker: 'Roadmap', headline: 'Where we are, where we are going', items: [{ date: 'Q1', title: 'Foundation', body: 'Core product shipped.', status: 'done' }, { date: 'Q2', title: 'Growth', body: 'First 1,000 customers.', status: 'now' }, { date: 'Q3', title: 'Scale', body: 'Team and infrastructure.', status: 'next' }, { date: 'Q4', title: 'Expand', body: 'New markets.', status: 'next' }] },
  flow: { kicker: 'Architecture', headline: 'How the pieces fit', items: [{ col: 'in', icon: 'edit', title: 'Your brief', body: 'Notes, data, ideas' }, { col: 'in', icon: 'wand', title: 'An AI', body: 'Drafts the deck' }, { col: 'hub', icon: 'file', title: 'Deck file', body: 'Portable JSON' }, { col: 'out', icon: 'presentation', title: 'Present', body: 'Fullscreen' }, { col: 'out', icon: 'download', title: 'Export', body: 'Share the file' }] },
  bento: { kicker: 'Everything in the box', headline: 'A grid that ==tells a story==', items: [{ size: 'l', tone: '', icon: 'sparkles', title: 'The big idea', value: '', body: 'Give the most important point the most room.' }, { size: 's', tone: '', icon: '', title: 'Satisfaction', value: '98%', body: '' }, { size: 's', tone: 'coral', icon: 'bolt', title: 'Fast', value: '', body: '' }, { size: 's', tone: '', icon: '', title: 'Faster', value: '3×', body: '' }, { size: 's', tone: '', icon: 'shield', title: 'Safe', value: '', body: '' }, { size: 'w', tone: 'teal', icon: 'globe', title: 'Works everywhere', value: '', body: 'Any browser, any device.' }, { size: 's', tone: '', icon: '', title: 'Setup', value: '0 min', body: '' }, { size: 's', tone: '', icon: 'heart', title: 'Loved', value: '', body: '' }] },
  anatomy: { kicker: 'The editor', headline: 'Find your way around', body: '', items: [{ title: 'Slides', body: 'Live thumbnails. Drag to reorder.' }, { title: 'Ribbon', body: 'Insert text, images and shapes. Restyle the deck.' }, { title: 'Canvas', body: 'Click to edit. Drag to move and resize.' }, { title: 'Inspector', body: 'Format, Slide, Code and Deck tabs.' }, { title: 'Present', body: 'Fullscreen with transitions.' }] },
  themes: { kicker: 'Look and feel', headline: 'Five themes, one deck', items: [{ theme: 'studio', title: 'Studio', body: 'Clean and confident.' }, { theme: 'editorial', title: 'Editorial', body: 'Serif on paper.' }, { theme: 'contrast', title: 'Contrast', body: 'Loud and dark.' }, { theme: 'aurora', title: 'Aurora', body: 'Glass and glow.' }, { theme: 'brutal', title: 'Brutalist', body: 'Hard edges.' }] },
  code: { kicker: 'Under the hood', headline: 'It is just ==JSON==', body: 'Readable, diffable, and easy for an AI to write.', code: { language: 'json', filename: 'deck.pitchcraft', source: '{\n  "layout": "metrics",\n  "headline": "Key numbers",\n  "items": [\n    { "value": "42", "label": "The answer" }\n  ]\n}' } },
  custom: {
    headline: 'Custom slide',
    custom: {
      html: '<div class="wrap">\n  <div class="kicker">Custom HTML</div>\n  <h1 class="big">Anything you can <span class="hl">build</span>,<br>you can present.</h1>\n  <p class="sub">This whole slide is plain HTML, CSS and JavaScript. Edit it in the Slide tab, or paste in whatever an AI wrote.</p>\n  <div class="orb"></div>\n</div>',
      css: '.wrap { position: absolute; inset: 0; padding: 0 90px; display: flex; flex-direction: column; justify-content: center; }\n.big { font-family: var(--font-d); font-weight: var(--d-weight); font-size: 84px; line-height: 1.02; letter-spacing: -.03em; margin: 0; max-width: 880px; }\n.hl { color: var(--ink-acc, var(--acc)); }\n.sub { font-size: 26px; color: var(--muted); max-width: 700px; margin: 26px 0 0; }\n.orb { position: absolute; right: 90px; bottom: 80px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, var(--acc), transparent 70%); opacity: .5; }',
      js: "// Runs when the slide is shown. Any JavaScript works here.\ndocument.querySelector('.orb').animate(\n  [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }],\n  { duration: 2400, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }\n);",
      interactive: false
    }
  },
  image: { kicker: 'Picture this', headline: 'Show it, do not describe it', body: 'Add an image URL or upload a file in the Slide tab.', image: { src: '', alt: '' } }
};

/* ── data model ───────────────────────────────────────────── */
const arr = v => (Array.isArray(v) ? PC.clone(v).slice(0, 40) : []);
const str = (v, d = '') => (v == null ? d : String(v));
PC.LIMITS = { custom: 300000, metaCss: 600000 };   // characters per custom html/css/js field, and for the deck-wide brand CSS
const okColor = c => typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s,.%]+\)|var\(--[\w-]+\))$/.test(c);
PC.okColor = okColor;
const okUrl = u => typeof u === 'string' && (/^(https?:\/\/|\.{0,2}\/|data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);)/i.test(u) || u === '');
PC.okUrl = okUrl;

PC.migrateSlide = function (raw, i = 0) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const tone = raw.tone === 'acid' ? 'amber' : raw.tone;
  const s = {
    id: str(raw.id, 's' + (i + 1)).slice(0, 40),
    layout: typeof raw.layout === 'string' && Object.prototype.hasOwnProperty.call(PC.LAYOUTS, raw.layout) ? raw.layout : 'statement',
    bg: PC.BGS[raw.bg] !== undefined ? raw.bg : '',
    tone: PC.TONES[tone] !== undefined ? tone : '',
    transition: PC.TRANSITIONS[raw.transition] ? raw.transition : '',
    kicker: str(raw.kicker), headline: str(raw.headline), body: str(raw.body), notes: str(raw.notes),
    items: arr(raw.items), columns: arr(raw.columns),
    chartType: PC.CHART_TYPES[raw.chartType] ? raw.chartType : 'bar',
    chartData: raw.chartData && typeof raw.chartData === 'object' ? PC.clone(raw.chartData) : {},
    tableData: raw.tableData && typeof raw.tableData === 'object' ? PC.clone(raw.tableData) : {},
    code: { language: 'json', filename: '', source: '' },
    image: { src: '', alt: '' }
  };
  // free-form layer (objects.js): text boxes / shapes / images / icons placed anywhere, per-element tweaks, custom background
  if (Array.isArray(raw.objects) && raw.objects.length) s.objects = PC.cleanObjects(raw.objects);
  else if (raw.layout === 'blank') s.objects = [];
  const tw = PC.cleanTweaks(raw.tweaks); if (Object.keys(tw).length) s.tweaks = tw;
  if (typeof raw.fill === 'string' && raw.fill && okColor(raw.fill)) s.fill = raw.fill;
  if (typeof raw.bgImage === 'string' && raw.bgImage && okUrl(raw.bgImage)) s.bgImage = raw.bgImage;
  // custom HTML/CSS/JS slide content (rendered in a sandboxed iframe; see layouts.js). Kept only when it has code or the layout is custom.
  const rc = raw.custom && typeof raw.custom === 'object' && !Array.isArray(raw.custom) ? raw.custom : null, cap = v => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').slice(0, PC.LIMITS.custom);
  if (rc && (cap(rc.html) || raw.layout === 'custom') || raw.layout === 'custom') {
    const c = rc || {};
    s.custom = { html: cap(c.html), css: cap(c.css), js: cap(c.js), interactive: c.interactive === true };
    if (typeof c.base === 'string' && c.base !== 'custom' && PC.LAYOUTS[c.base]) s.custom.base = c.base;
  }
  if (raw.code && typeof raw.code === 'object') Object.assign(s.code, { language: str(raw.code.language, 'json'), filename: str(raw.code.filename), source: str(raw.code.source) });
  if (raw.image && typeof raw.image === 'object') Object.assign(s.image, { src: okUrl(raw.image.src) ? str(raw.image.src) : '', alt: str(raw.image.alt) });
  // v1/v2 compat: comparison items used to be plain arrays already; timeline used no status
  return s;
};

/** Fill in any structure a layout needs but the slide does not have yet (from the layout's seed). */
PC.ensureShape = function (s) {
  const spec = PC.LAYOUTS[s.layout], seed = PC.SEEDS[s.layout] || {};
  if (!spec) return s;
  if (spec.list && !(s[spec.list.key] || []).length && (spec.list.min || 0) > 0) s[spec.list.key] = PC.clone(seed[spec.list.key] || []);
  if (spec.list && (s[spec.list.key] || []).length < (spec.list.min || 0)) s[spec.list.key] = PC.clone(seed[spec.list.key] || []);
  if (spec.special === 'chart') {
    const cd = s.chartData || {};
    const ok = (s.chartType === 'donut') ? (cd.segments || []).length : (cd.labels || []).length && (cd.series || []).length;
    if (!ok) { s.chartType = seed.chartType || 'bar'; s.chartData = PC.clone((PC.SEEDS.chart).chartData); }
  }
  if (spec.special === 'table' && !((s.tableData || {}).headers || []).length) s.tableData = PC.clone(seed.tableData);
  if (spec.special === 'code' && !(s.code || {}).source) s.code = PC.clone(seed.code);
  if (s.layout === 'custom' && !(s.custom && s.custom.html)) s.custom = PC.clone(seed.custom);
  if (s.layout === 'flow' && !(s.items || []).some(i => i.col === 'hub')) s.items = PC.clone(seed.items);
  return s;
};

PC.newSlide = function (layout = 'statement', id) {
  const seed = PC.clone(PC.SEEDS[layout] || PC.SEEDS.statement);
  const s = PC.migrateSlide(Object.assign({ layout, id: id || PC.uid('s') + Date.now().toString(36).slice(-3) }, seed), 0);
  return PC.ensureShape(s);
};

PC.DEFAULT_META = () => ({ name: 'Untitled deck', theme: 'studio', numbers: false, transition: 'fade' });

/** Accepts a JSON string / array (v1, v2) / {meta,slides} (v3). Returns {deck, warnings} or throws Error with a friendly message. */
PC.parseDeck = function (input) {
  const warnings = []; let raw = input;
  if (typeof input === 'string') { try { raw = JSON.parse(input); } catch (e) { throw new Error('That is not valid JSON (' + e.message + ').'); } }
  let slides, meta = {};
  if (Array.isArray(raw)) slides = raw;
  else if (raw && Array.isArray(raw.slides)) { slides = raw.slides; meta = raw.meta || {}; }
  else throw new Error('Expected a list of slides, or an object like { "meta": {…}, "slides": […] }.');
  if (!slides.length) throw new Error('The deck has no slides.');
  if (slides.length > 200) throw new Error('Decks are limited to 200 slides.');
  const seen = new Set();
  const out = slides.map((r, i) => {
    if (!r || typeof r !== 'object') { warnings.push(`Slide ${i + 1} was not an object, so it was replaced with a blank slide.`); r = {}; }
    if (r.layout && !PC.has(PC.LAYOUTS, r.layout)) warnings.push(`Slide ${i + 1}: unknown layout "${r.layout}", using "statement".`);
    const s = PC.ensureShape(PC.migrateSlide(r, i));
    let id = s.id; while (seen.has(id)) id += '_' + i; s.id = id; seen.add(id);
    return s;
  });
  const m = Object.assign(PC.DEFAULT_META(), {
    name: str(meta.name, 'Untitled deck').slice(0, 80), theme: PC.THEMES[meta.theme] ? meta.theme : 'studio',
    numbers: !!meta.numbers, transition: PC.TRANSITIONS[meta.transition] ? meta.transition : 'fade'
  });
  if (typeof meta.css === 'string' && meta.css) m.css = meta.css.slice(0, PC.LIMITS.metaCss);   // shared brand CSS for custom slides
  return { deck: { format: 'pitchcraft', version: 3, meta: m, slides: out }, warnings };
};

/* ── the in-browser API, documented once: feeds the AI guide, Pitchcraft.manifest() and the tests that keep it honest ── */
PC.API_DOCS = [
  ['Read', 'guide(section?)', 'The complete AI guide as markdown (this document). Pass a section number such as 9, or a word from its heading, to get just that part. Read it before editing.'],
  ['Read', 'manifest()', 'JSON: version, guide URL, every method below, layouts, themes, object types, limits.'],
  ['Read', 'getDeck()', 'Copy of the whole deck JSON.'],
  ['Read', 'getSlide(ref)', 'Copy of one slide. ref = slide id ("s3") or 0-based index.'],
  ['Read', 'getObjects(ref)', 'Copy of the free-form objects on a slide.'],
  ['Read', 'html(ref)', 'The rendered HTML of one slide (what the DOM contains).'],
  ['Read', 'prettyHtml(ref)', 'The same, indented for reading.'],
  ['Read', 'exportJSON()', 'The deck as a JSON string, exactly what a .pitchcraft file contains.'],
  ['Read', 'audit(deck?)', 'Fast layout audit of templated and blank slides: finds text that clips or leaves the safe area. Returns one entry per slide with a problems list. It cannot see inside custom slides: those come back with checked:false. Use auditAll() for them.'],
  ['Read', 'auditAll(deck?)', 'Async. Everything audit() does, plus it runs each custom slide in a hidden sandbox and measures the rendered text: text off the slide, outside the safe area, clipped by its container, or overlapping other text. Entries have checked:true. Await it.'],
  ['Read', 'measureText(text, opts?)', 'Measure text before you place it. opts {font "display"|"body"|"mono"|a CSS family, size (px, default 28), weight, caps, ls, lh, w (box width px)}. Returns {width, height, lines, em}: width of the longest line, height at the wrapped width, and the average em per character in this theme.'],
  ['Read', 'current()', 'Index of the selected slide.'],
  ['Read', 'count()', 'Number of slides.'],
  ['Read', 'schema()', 'JSON Schema (draft 2020-12) of a deck, including slide custom {html, css, js}, objects and tweaks. Also published as pitchcraft.schema.json.'],
  ['Deck', 'setDeck(deckOrJson)', 'Replace the whole deck (object or JSON string). Returns {slides, warnings}. Undoable.'],
  ['Deck', 'importText(text, mode?)', 'Import deck JSON text. mode "replace" (default) or "append". Returns {deck, warnings}.'],
  ['Deck', 'setMeta(patch)', 'Patch deck meta: {name, theme, numbers, transition, css}.'],
  ['Deck', 'setTheme(theme)', 'Set the deck theme key.'],
  ['Deck', 'newDeck()', 'Replace the deck with a fresh one-slide deck (the starter). Undoable. The New deck button asks the user to save first; this call does not.'],
  ['Deck', 'loadTemplate(id)', 'Load a built-in template deck (for example "tour").'],
  ['Slides', 'addSlide(layout, at?)', 'Insert a slide with a layout key at an index. Returns its index. Use "blank" for a free-form slide.'],
  ['Slides', 'removeSlide(ref)', 'Delete a slide.'],
  ['Slides', 'duplicateSlide(ref)', 'Duplicate a slide.'],
  ['Slides', 'moveSlide(from, to)', 'Reorder slides.'],
  ['Slides', 'updateSlide(ref, patch)', 'Shallow-merge a patch into a slide (validated). Returns the slide.'],
  ['Slides', 'setPath(ref, path, value)', 'Set one nested field, for example setPath("s2", "items.0.value", "42").'],
  ['Slides', 'setLayout(ref, layout)', 'Change a slide layout, keeping compatible content. To blank converts the text to text boxes.'],
  ['Slides', 'addCustomSlide(custom, at?, name?)', 'Add a free-form HTML/CSS/JS slide in one call. custom = {html, css, js, interactive}. Returns its index. See section 9 of the guide.'],
  ['Slides', 'setCustom(ref, patch)', 'Patch the html, css, js or interactive flag of a custom slide (converts the slide to custom first if it is not one). Returns the slide.'],
  ['Slides', 'goTo(ref)', 'Select and scroll to a slide.'],
  ['Objects', 'addObject(ref, object)', 'Add a free-form object (text, shape, image or icon) to any slide. Returns the cleaned object with its id. Sits on top of the stack.'],
  ['Objects', 'updateObject(ref, id, patch)', 'Patch an object. A null value removes a property. Returns the cleaned object.'],
  ['Objects', 'removeObject(ref, id)', 'Delete an object. Returns true. Throws (listing the existing ids) if the id is not on that slide.'],
  ['Objects', 'setTweak(ref, key, patch)', 'Move or restyle a text field or card that a template layout generated. key = data-path ("headline") or list item ("items.1"). A patch of null resets it.'],
  ['Present', 'preparePrint()', 'Builds the print layout (one page per slide) that the PDF button uses. Rarely needed by an AI.'],
  ['Present', 'present(from?)', 'Start presenting from a slide index.'],
  ['Present', 'closePresent()', 'Stop presenting.'],
  ['Present', 'isPresenting()', 'True while presenting.'],
  ['History', 'undo()', 'Undo the last change.'],
  ['History', 'redo()', 'Redo.']
];

PC.transitionOf = (deck, s) => s.transition || (deck.meta && deck.meta.transition) || 'fade';

})();
