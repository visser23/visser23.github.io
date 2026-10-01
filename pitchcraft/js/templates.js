/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT templates — every deck is real, valid deck JSON.
   The first one doubles as the product tour: it is built from the same layouts it explains.
   Anything with made-up numbers is labelled "Sample data".
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC;
const N = o => (Array.isArray(o) ? o.length : Object.keys(o).length);   // counts come from the registries, so the tour can never drift out of date
const LAYOUT_N = N(PC.LAYOUTS), CHART_N = N(PC.CHART_TYPES), THEME_N = N(PC.THEMES), TRANS_N = N(PC.TRANSITIONS) - 1;   // minus "none"

const tour = {
  meta: { name: 'How Pitchcraft works', theme: 'studio', numbers: true, transition: 'slide' },
  slides: [
    { id: 'tour-title', layout: 'title', bg: 'grad', kicker: 'Pitchcraft', headline: 'Decks that are just ==data==.', body: 'Write a deck as JSON, or ask an AI to. Edit it visually, present it fullscreen, share it as one file.', transition: 'zoom',
      notes: 'This deck is the product tour. Every slide is built from the same layouts you get in the editor. Scroll down, or press Present.' },
    { id: 'tour-idea', layout: 'statement', kicker: 'The idea', headline: 'A presentation is a ==document==, not a drawing.', body: 'Pitchcraft stores every slide as plain, readable JSON, so people and AI can both write them.',
      notes: 'Most slide tools make you push pixels. Here you describe the content and the layout does the rest.' },
    { id: 'tour-flow', layout: 'flow', bg: 'tint', kicker: 'How it works', headline: 'From ==brief== to stage in one file',
      items: [
        { col: 'in', icon: 'edit', title: 'Your brief', body: 'Notes, data, half-formed ideas' },
        { col: 'in', icon: 'wand', title: 'An AI', body: 'Writes a .pitchcraft file for you' },
        { col: 'in', icon: 'layers', title: 'A template', body: 'Or a blank slide' },
        { col: 'hub', icon: 'file', title: 'deck.pitchcraft', body: 'One portable JSON file' },
        { col: 'out', icon: 'presentation', title: 'Present', body: 'Fullscreen with transitions' },
        { col: 'out', icon: 'download', title: 'Export', body: 'File or PDF. PowerPoint next' },
        { col: 'out', icon: 'link', title: 'Share', body: 'Send a file, not an account' }
      ] },
    { id: 'tour-steps', layout: 'process', kicker: 'Get started', headline: 'Ship a deck in ==four== steps',
      items: [
        { step: '01', icon: 'copy', title: 'Build with AI', body: 'Click AI in the top bar. Describe your deck, copy the prompt.' },
        { step: '02', icon: 'sparkles', title: 'Paste into any AI', body: 'ChatGPT, Claude, Gemini. It replies with a .pitchcraft file.' },
        { step: '03', icon: 'upload', title: 'Import', body: 'Drop the file on this page. Fix anything visually.' },
        { step: '04', icon: 'play', title: 'Present', body: 'Press P, or download the file and share it.' }
      ] },
    { id: 'tour-anatomy', layout: 'anatomy', kicker: 'The editor', headline: 'Everything is ==where you expect== it',
      items: [
        { title: 'Slides', body: 'Live thumbnails on the left. Drag to reorder.' },
        { title: 'Ribbon', body: 'Insert text, images, shapes and icons. Restyle the deck.' },
        { title: 'Canvas', body: 'Click text to edit it. Drag, resize and rotate anything.' },
        { title: 'Inspector', body: 'Format, Slide, Code and Deck tabs.' },
        { title: 'Present', body: 'Fullscreen with transitions, notes and touch.' }
      ] },
    { id: 'tour-free', layout: 'blank', bg: 'tint', transition: 'rise',
      notes: 'This slide is a blank slide: no template, every element is a free-form object. Click any of them to drag, resize, rotate or restyle it. Insert more from the Insert tab in the ribbon.',
      objects: [
        { id: 'fk', type: 'text', x: 80, y: 84, w: 640, text: 'Blank slides', size: 26, weight: 700, caps: true, ls: 0.1, color: 'var(--shape)' },
        { id: 'fh', type: 'text', x: 80, y: 130, w: 680, text: 'Place **anything**, anywhere.', size: 72, weight: 800, font: 'display', lh: 1.04 },
        { id: 'fb', type: 'text', x: 80, y: 360, w: 620, text: 'Start from nothing, or drag any text or card on a template to a new spot. Add text, images, shapes and icons from the Insert tab, then choose fonts and sizes in Format.', size: 28, color: 'var(--muted)', lh: 1.4 },
        { id: 'fc', type: 'shape', shape: 'round', x: 820, y: 120, w: 360, h: 240, fill: 'var(--shape)', text: 'Drag me', size: 44, weight: 700, color: 'var(--on-shape)', align: 'center', valign: 'middle', rot: -4, shadow: true },
        { id: 'fe', type: 'shape', shape: 'ellipse', x: 1010, y: 410, w: 170, h: 170, fill: 'var(--shape)' },
        { id: 'fs', type: 'shape', shape: 'star', x: 830, y: 430, w: 130, h: 130, fill: 'var(--c3)', rot: 12 },
        { id: 'fi', type: 'icon', icon: 'sparkles', x: 1050, y: 450, w: 90, h: 90, color: 'var(--on-shape)' },
        { id: 'fl', type: 'shape', shape: 'line', x: 80, y: 600, w: 620, h: 14, stroke: 'var(--muted)', strokeW: 3 }
      ] },
    { id: 'tour-ai', layout: 'split', kicker: 'Working with an AI', headline: 'Two ways to ==use== an AI',
      columns: [
        { icon: 'sparkles', headline: 'In a chat window', body: 'Click AI, then Build with AI. Paste the prompt into ChatGPT, Claude or Gemini. It returns a .pitchcraft file: drop it on the page.' },
        { icon: 'globe', headline: 'In your browser', body: 'Agents such as Comet, Atlas or Cursor edit this deck in place through the Pitchcraft object. The prompt points them at a published guide.' }] },
    { id: 'tour-box', layout: 'section', bg: 'dark', kicker: '02', headline: 'Everything in the box', body: 'Layouts, charts, themes, transitions and free-form objects. All named, all documented, all available to an AI.' },
    { id: 'tour-bento', layout: 'bento', bg: 'tint', kicker: 'The toolbox', headline: 'A ==toolbox== that fits in one file',
      items: [
        { size: 'l', tone: '', icon: 'layers', title: 'Layouts', value: String(LAYOUT_N), body: 'Templates for stories, data and code, plus blank and custom HTML.' },
        { size: 's', tone: '', icon: '', title: 'Chart types', value: String(CHART_N), body: '' },
        { size: 's', tone: 'coral', icon: 'chart', title: 'Animated charts', value: '', body: '' },
        { size: 's', tone: '', icon: '', title: 'Themes', value: String(THEME_N), body: '' },
        { size: 's', tone: '', icon: 'shield', title: 'Private', value: '', body: '' },
        { size: 'w', tone: 'teal', icon: 'globe', title: 'Runs anywhere', value: '', body: 'One static site. Works offline, from a file, or on any host.' },
        { size: 's', tone: '', icon: '', title: 'Transitions', value: String(TRANS_N), body: '' },
        { size: 's', tone: '', icon: 'heart', title: 'Free', value: '', body: '' }
      ] },
    { id: 'tour-zero', layout: 'metrics', bg: 'accent', kicker: 'The footprint', headline: '==Nothing== to install, nothing to sign up for',
      items: [
        { value: '0', label: 'Dependencies', trend: '', note: 'Plain HTML, CSS and JS' },
        { value: '0', label: 'Accounts', trend: '', note: 'Your deck stays in your browser' },
        { value: '1', label: 'File', trend: '', note: 'Your whole deck, portable' }
      ] },
    { id: 'tour-demo', layout: 'demo', kicker: 'Sample data', headline: 'Data in, ==slide== out', body: 'This is the JSON behind the chart. Change a number and the chart follows.', chartType: 'line',
      chartData: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ name: 'Visits', values: [12, 19, 15, 28, 34] }] } },
    { id: 'tour-bar', layout: 'chart', kicker: 'Sample data', headline: 'Compare things with ==bars==', body: 'Bar, horizontal bar, line, area and donut. Each one animates in when you present.', chartType: 'bar',
      chartData: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Free', values: [12, 19, 27, 41] }, { name: 'Paid', values: [4, 9, 18, 33] }] },
      items: [{ value: '+242%', label: 'Free, year on year' }, { value: '8x', label: 'Paid, year on year' }] },
    { id: 'tour-donut', layout: 'chart', bg: 'dark', kicker: 'Sample data', headline: 'Show a ==share== of the whole', body: '', chartType: 'donut',
      chartData: { segments: [{ label: 'Presenting', value: 46 }, { label: 'Editing', value: 31 }, { label: 'Exporting', value: 23 }], centerLabel: '100%', centerSub: 'Of sessions' } },
    { id: 'tour-table', layout: 'table', kicker: 'Reference', headline: 'Keys worth ==knowing==',
      tableData: { headers: ['Key', 'Where', 'What it does'], rows: [
        ['Ctrl / Cmd + Z', 'Editor', 'Undo (add Shift to redo)'], ['P', 'Editor', 'Present from this slide'], ['Arrow keys', 'Editor', 'Nudge the selected object (Shift for 10 px)'],
        ['Arrows, Space', 'Presenter', 'Previous and next slide'], ['N', 'Presenter', 'Show speaker notes'], ['Esc', 'Anywhere', 'Deselect, finish editing or exit'], ['?', 'Anywhere', 'Open help']] } },
    { id: 'tour-themes', layout: 'themes', bg: 'tint', kicker: 'Look and feel', headline: 'Same deck, five ==personalities==',
      items: [
        { theme: 'studio', title: 'Studio', body: 'Clean and confident.' }, { theme: 'editorial', title: 'Editorial', body: 'Serif on warm paper.' },
        { theme: 'contrast', title: 'Contrast', body: 'Loud, dark, uppercase.' }, { theme: 'aurora', title: 'Aurora', body: 'Gradients and glass.' }, { theme: 'brutal', title: 'Brutalist', body: 'Hard edges only.' }] },
    { id: 'tour-motion', layout: 'bullets', kicker: 'Motion', headline: 'Move between ideas ==with intent==', body: 'Set a default for the deck, then override it per slide in the Slide tab.',
      items: [
        { title: 'Fade', body: 'Calm and safe. Works everywhere.' }, { title: 'Slide', body: 'Direction that matches the story.' },
        { title: 'Zoom', body: 'Emphasis for the big reveal.' }, { title: 'Rise and blur', body: 'Soft, modern entrances.' }] },
    { id: 'tour-code', layout: 'code', bg: 'dark', kicker: 'Under the hood', headline: 'Every slide is ==readable JSON==', body: 'Diffable, versionable and easy for an AI to write. The Code tab shows this for any slide.',
      code: { language: 'json', filename: 'slide.json', source: '{\n  "layout": "metrics",\n  "headline": "Key numbers",\n  "items": [\n    { "value": "42%", "label": "Conversion", "trend": "up" },\n    { "value": "1.8s", "label": "Load time", "trend": "down" }\n  ]\n}' } },
    { id: 'tour-custom', layout: 'custom', bg: 'dark', headline: 'No walls: any HTML, CSS and JS',
      notes: 'Templates are the fast path. But any slide can be free-form HTML, CSS and JavaScript, so an AI (or you) can build anything, or match a corporate brand exactly. This slide is one: the code on the right is typing itself out, and the shape is a live animation.',
      custom: {
        html: `<div class="nw">
  <div class="nw-l">
    <div class="kicker rv">No walls</div>
    <h2 class="nw-h rv">Templates are a start.<br>Never a <span class="nw-w" id="w">wall</span>.</h2>
    <p class="nw-p rv">Any slide can be plain HTML, CSS and JavaScript. Ask an AI for any style, or keep your corporate brand exactly.</p>
    <div class="nw-chips rv"><span>HTML</span><span>CSS</span><span>JS</span><span>Your brand</span></div>
  </div>
  <div class="nw-r rv">
    <div class="nw-blob" aria-hidden="true"></div>
    <div class="nw-win"><div class="nw-bar"><i></i><i></i><i></i><span>slide.html</span></div><pre id="code" aria-label="Example code">&lt;section class="slide"&gt;
  &lt;h1 style="font: 800 84px Syne"&gt;
    Your &lt;em&gt;brand&lt;/em&gt;.
    Your rules.
  &lt;/h1&gt;
  &lt;canvas id="anything"&gt;&lt;/canvas&gt;
&lt;/section&gt;</pre></div>
  </div>
</div>`,
        css: `.nw { position: absolute; inset: 0; display: grid; grid-template-columns: 1.08fr .92fr; gap: 40px; padding: 0 80px; align-items: center; }
.nw-h { font-family: var(--font-d); font-weight: var(--d-weight); font-size: 62px; line-height: 1.04; letter-spacing: -.03em; margin: 0; text-transform: var(--d-case); }
.nw-w { color: var(--ink-acc, var(--acc)); display: inline-block; transition: transform .4s; }
.nw-p { font-size: 24px; line-height: 1.45; color: var(--muted); margin: 24px 0 0; max-width: 560px; }
.nw-chips { display: flex; gap: 10px; margin-top: 28px; }
.nw-chips span { padding: 8px 16px; border-radius: 999px; border: 1.5px solid var(--line); font-size: 17px; font-weight: 600; color: var(--fg); background: var(--card); }
.nw-r { position: relative; height: 420px; }
.nw-blob { position: absolute; right: -30px; top: -40px; width: 300px; height: 300px; background: linear-gradient(135deg, var(--g1, var(--acc)), var(--g2, var(--acc))); opacity: .85; border-radius: 42% 58% 60% 40% / 48% 42% 58% 52%; filter: blur(2px); }
.nw-win { position: absolute; left: 0; right: 0; bottom: 0; background: #0b0a1c; border: 1px solid rgba(255,255,255,.14); border-radius: 18px; box-shadow: 0 30px 60px -24px rgba(0,0,0,.7); overflow: hidden; }
.nw-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; background: rgba(255,255,255,.06); font: 500 14px var(--f-mono); color: #b9b6d8; }
.nw-bar i { width: 11px; height: 11px; border-radius: 50%; background: #ff6b57; } .nw-bar i:nth-child(2) { background: #f5a524; } .nw-bar i:nth-child(3) { background: #22b55e; } .nw-bar span { margin-left: 8px; }
#code { margin: 0; padding: 20px 22px; height: 236px; font: 500 19px/1.6 var(--f-mono); color: #ece9ff; white-space: pre-wrap; }
#code .k { color: #9fb0ff; } #code .s { color: #7cf5d4; } #code .c { color: #ff9db0; } #code .caret { display: inline-block; width: 9px; height: 1.1em; vertical-align: text-bottom; background: #ece9ff; animation: nwc 1s steps(1) infinite; }
@keyframes nwc { 50% { opacity: 0; } }`,
        js: `const src = '<section class="slide">\\n  <h1 style="font: 800 84px Syne">\\n    Your <em>brand</em>.\\n    Your rules.\\n  </h1>\\n  <canvas id="anything"></canvas>\\n</section>';
const out = document.getElementById('code'), words = ['wall', 'limit', 'cage', 'box'], w = document.getElementById('w');
const tint = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/&lt;\\/?\\w+|"[^"]*"|\\b(?:class|style|id)\\b/g, m => '<span class="' + (m[0] === '&' ? 'k' : m[0] === '"' ? 's' : 'c') + '">' + m + '</span>');   // one pass, so a match is never re-matched inside an earlier span
let i = 0;
(function type() { i = Math.min(src.length, i + 2); out.innerHTML = tint(src.slice(0, i)) + '<span class="caret"></span>'; if (i < src.length) setTimeout(type, 38); })();
let n = 0; setInterval(() => { w.style.transform = 'translateY(-6px)'; setTimeout(() => { n = (n + 1) % words.length; w.textContent = words[n]; w.style.transform = ''; }, 200); }, 2200);
document.querySelector('.nw-blob').animate([{ borderRadius: '42% 58% 60% 40% / 48% 42% 58% 52%', transform: 'rotate(0deg)' }, { borderRadius: '58% 42% 38% 62% / 55% 60% 40% 45%', transform: 'rotate(18deg)' }], { duration: 4200, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });`
      } },
    { id: 'tour-compare', layout: 'comparison', kicker: 'Why', headline: 'Slides, ==without== the ceremony',
      columns: [
        { headline: 'Design-first tools', body: 'Every slide is drawn by hand.', items: ['Hours of alignment', 'Layouts drift apart', 'Locked inside an app'] },
        { headline: 'Pitchcraft', body: 'Structure first, and drag anything when you want to.', items: ['Layouts fit themselves', 'Move and restyle any element', 'One file you own'] }] },
    { id: 'tour-roadmap', layout: 'timeline', bg: 'tint', kicker: 'Roadmap', headline: 'The ==roadmap== is short',
      items: [
        { date: 'Shipped', title: 'The toolkit', body: 'Free-form objects, AI guide, presenter and PDF.', status: 'done' },
        { date: 'Now', title: 'Templates', body: 'More decks and more chart types.', status: 'now' },
        { date: 'Next', title: 'PowerPoint export', body: 'Planned. Your JSON maps cleanly to .pptx.', status: 'next' },
        { date: 'Later', title: 'Teamwork', body: 'Shared decks and comments.', status: 'next' }] },
    { id: 'tour-end', layout: 'closing', bg: 'grad', kicker: 'Your turn', headline: 'Make something ==worth presenting==.', body: 'Press Present, or open Templates to start from another deck.',
      items: [{ icon: 'play', label: 'Present', value: 'P' }, { icon: 'layers', label: 'Templates', value: 'Deck tab' }, { icon: 'wand', label: 'Build with AI', value: 'Top bar' }] }
  ]
};

const memo = {
  meta: { name: 'Quarterly signal', theme: 'editorial', numbers: true, transition: 'fade' },
  slides: [
    { id: 'm-title', layout: 'title', kicker: 'Q3 memo · sample content', headline: 'What the *numbers* are trying to tell us', body: 'A short read on growth, retention and where we should spend the next quarter.' },
    { id: 'm-metrics', layout: 'metrics', kicker: 'Sample data', headline: 'Three numbers that ==changed== this quarter',
      items: [{ value: '38%', label: 'Weekly active', trend: 'up', note: '+7 points' }, { value: '2.1s', label: 'Median load', trend: 'down', note: '-0.6s' }, { value: '91', label: 'Net promoter', trend: 'up', note: '+12' }] },
    { id: 'm-line', layout: 'chart', kicker: 'Sample data', headline: 'Retention ==finally== bent upward', body: 'The onboarding rewrite shipped in week 5. Every cohort after it holds more users at day 30.', chartType: 'area',
      chartData: { labels: ['W1', 'W3', 'W5', 'W7', 'W9', 'W11'], series: [{ name: 'Day-30 retention', values: [22, 23, 24, 31, 36, 41] }] }, items: [{ value: '+19 pts', label: 'Since week 5' }] },
    { id: 'm-quote', layout: 'quote', bg: 'tint', headline: 'We stopped asking what to *add* and started asking what to ==remove==.', body: 'Product lead, sample quote' },
    { id: 'm-compare', layout: 'comparison', kicker: 'The shift', headline: 'How we ==decide== now',
      columns: [{ headline: 'Before', body: 'Opinions and loudest voice.', items: ['Roadmap by request', 'Metrics after launch', 'Long release cycles'] }, { headline: 'After', body: 'Evidence first.', items: ['Roadmap by measured pain', 'Metrics before launch', 'Weekly releases'] }] },
    { id: 'm-actions', layout: 'bullets', kicker: 'Recommendations', headline: 'Four things to ==do next==', body: 'In order of expected impact.',
      items: [{ title: 'Double down on onboarding', body: 'It moved retention more than anything else.' }, { title: 'Cut two dashboards', body: 'Nobody opens them.' }, { title: 'Hire a data analyst', body: 'We are answering questions by hand.' }, { title: 'Ship weekly', body: 'Smaller changes, faster learning.' }] },
    { id: 'm-end', layout: 'closing', bg: 'dark', kicker: 'Discussion', headline: 'What would you ==change==?', body: 'Bring objections. That is what this memo is for.' }
  ]
};

const launch = {
  meta: { name: 'Product launch', theme: 'aurora', numbers: false, transition: 'blur' },
  slides: [
    { id: 'l-title', layout: 'title', kicker: 'Introducing · sample content', headline: 'Meet ==Halo==, the calmest inbox you will ever use', body: 'Everything that matters, in one quiet place.' },
    { id: 'l-problem', layout: 'statement', kicker: 'The problem', headline: 'Email became a place we ==react==, not think.', body: 'Halo turns your inbox back into a place to decide.' },
    { id: 'l-bento', layout: 'bento', kicker: 'What is inside', headline: 'Built around ==focus==',
      items: [
        { size: 'l', tone: '', icon: 'sparkles', title: 'Daily brief', value: '', body: 'One summary each morning. Only what needs you.' },
        { size: 's', tone: 'violet', icon: 'clock', title: 'Snooze', value: '', body: '' }, { size: 's', tone: '', icon: '', title: 'Time saved', value: '6h', body: '' },
        { size: 's', tone: '', icon: 'shield', title: 'Private', value: '', body: '' }, { size: 's', tone: 'teal', icon: 'bolt', title: 'Instant search', value: '', body: '' },
        { size: 'w', tone: '', icon: 'users', title: 'Shared inboxes', value: '', body: 'Assign, comment and close the loop with your team.' },
        { size: 's', tone: '', icon: '', title: 'Rating', value: '4.9', body: '' }, { size: 's', tone: 'pink', icon: 'heart', title: 'Loved', value: '', body: '' }] },
    { id: 'l-area', layout: 'chart', bg: 'tint', kicker: 'Sample data', headline: 'Waitlist ==doubled== every month', body: 'People are asking for it before we have finished building it.', chartType: 'area',
      chartData: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], series: [{ name: 'Signups', values: [400, 900, 1700, 3100, 5800, 9600] }] }, items: [{ value: '9.6k', label: 'On the waitlist' }] },
    { id: 'l-steps', layout: 'process', kicker: 'Getting started', headline: 'Calm in ==three== minutes',
      items: [{ step: '01', icon: 'link', title: 'Connect', body: 'Sign in with your mail account.' }, { step: '02', icon: 'sliders', title: 'Choose', body: 'Pick what should reach you.' }, { step: '03', icon: 'check', title: 'Breathe', body: 'Everything else waits for the brief.' }] },
    { id: 'l-time', layout: 'timeline', bg: 'dark', kicker: 'Launch plan', headline: 'From private beta to ==everyone==',
      items: [{ date: 'May', title: 'Private beta', body: '500 people, weekly calls.', status: 'done' }, { date: 'Jun', title: 'Public beta', body: 'Open the waitlist.', status: 'now' }, { date: 'Aug', title: 'Launch', body: 'Web, iOS and Android.', status: 'next' }, { date: 'Oct', title: 'Teams', body: 'Shared inboxes for companies.', status: 'next' }] },
    { id: 'l-end', layout: 'closing', bg: 'grad', kicker: 'Join us', headline: 'Get on the ==list==.', body: 'Early members get lifetime pricing.', items: [{ icon: 'globe', label: 'Web', value: 'halo.example' }, { icon: 'mail', label: 'Say hi', value: 'hello@halo.example' }] }
  ]
};

const pitch = {
  meta: { name: 'Investor pitch', theme: 'brutal', numbers: true, transition: 'rise' },
  slides: [
    { id: 'p-title', layout: 'title', bg: 'accent', kicker: 'Seed round · sample content', headline: 'Groceries, delivered by ==neighbours==', body: 'Fresh food in 20 minutes, without another warehouse.' },
    { id: 'p-problem', layout: 'split', kicker: 'The gap', headline: 'Delivery is ==broken== twice over',
      columns: [{ icon: 'clock', headline: 'Too slow', body: 'Same-day delivery still means a two-hour window and a missed doorbell.' }, { icon: 'tag', headline: 'Too costly', body: 'Warehouses and vans make every basket more expensive than it should be.' }] },
    { id: 'p-solution', layout: 'cards', bg: 'tint', kicker: 'Our answer', headline: 'Use the ==shops== that already exist',
      items: [{ icon: 'map', title: 'Local first', body: 'Partner with corner shops within 1km.' }, { icon: 'users', title: 'Neighbour couriers', body: 'People already walking that way earn on the trip.' }, { icon: 'bolt', title: '20 minutes', body: 'Nothing travels further than it has to.' }] },
    { id: 'p-traction', layout: 'metrics', kicker: 'Sample data', headline: 'Traction after ==six months==',
      items: [{ value: '14k', label: 'Orders', trend: 'up', note: '+38% month on month' }, { value: '212', label: 'Partner shops', trend: 'up', note: '+41' }, { value: '18m', label: 'Median delivery', trend: 'down', note: '-4 min' }] },
    { id: 'p-market', layout: 'chart', bg: 'dark', kicker: 'Sample data', headline: 'Where ==orders== come from', body: 'Evenings and weekends carry most of the volume.', chartType: 'hbar',
      chartData: { labels: ['Weekday evening', 'Weekend', 'Lunch', 'Late night', 'Morning'], series: [{ name: 'Orders (k)', values: [5.2, 4.1, 2.6, 1.4, 0.9] }] } },
    { id: 'p-pricing', layout: 'table', kicker: 'Sample pricing', headline: 'Simple ==pricing==',
      tableData: { headers: ['Plan', 'Deliveries', 'Fee', 'Best for'], rows: [['Pay as you go', 'Any', '$3.90', 'Occasional orders'], ['Neighbour', 'Unlimited', '$9 / month', 'Households'], ['Shop partner', 'Unlimited', '4% of basket', 'Local stores']] } },
    { id: 'p-ask', layout: 'closing', bg: 'accent', kicker: 'The ask', headline: 'We are raising ==$2.5M==.', body: 'To open ten new cities and prove the model at scale.', items: [{ icon: 'mail', label: 'Contact', value: 'founders@example.com' }] }
  ]
};

const blank = {
  meta: { name: 'Untitled deck', theme: 'studio', numbers: false, transition: 'fade' },
  slides: [{ id: 'b-title', layout: 'title', kicker: 'Presentation', headline: 'Click here to add your ==title==', body: 'Then add slides from the ribbon.' }]
};

PC.TEMPLATES = [
  { id: 'tour', name: 'How Pitchcraft works', tag: 'The product tour', blurb: 'A guided showcase of every layout, chart, theme and transition. Start here.', deck: tour },
  { id: 'memo', name: 'Quarterly signal', tag: 'Editorial memo', blurb: 'A calm, serif strategy memo with metrics, an area chart and recommendations.', deck: memo },
  { id: 'launch', name: 'Product launch', tag: 'Aurora glow', blurb: 'Gradients, glass and a bento overview for a product announcement.', deck: launch },
  { id: 'pitch', name: 'Investor pitch', tag: 'Brutalist', blurb: 'Hard edges and big type: problem, traction, market and the ask.', deck: pitch },
  { id: 'blank', name: 'Blank deck', tag: 'One slide', blurb: 'Start from nothing. Add slides from the ribbon.', deck: blank }
];
})();
