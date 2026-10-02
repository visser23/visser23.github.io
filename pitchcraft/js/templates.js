/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT templates — every deck is real, valid deck JSON.
   The first one doubles as the product tour: it is built from the same layouts it explains, and written plainly:
   what each part does and where to find it, with no selling. The last one ("blank") is the one-slide starter that "New deck" loads.
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
    { id: 'tour-title', layout: 'title', bg: 'grad', kicker: 'Pitchcraft', headline: 'A slide editor that an ==AI== can use too', body: 'This deck is the manual. Every slide is editable, so change anything as you read.', transition: 'zoom',
      notes: 'This deck is the manual for Pitchcraft. It is built with the same layouts you get in the editor, so you can click any text and change it. Press P to present.' },
    { id: 'tour-idea', layout: 'statement', kicker: 'What it is', headline: 'A deck is one ==file==.', body: 'Pitchcraft runs in your browser and needs no account. You export a deck as a .pitchcraft file (plain JSON), which an AI can write and you can edit.',
      notes: 'The deck is saved in this browser as you work. The .pitchcraft file is the same data, for keeping, sharing and handing to an AI.' },
    { id: 'tour-flow', layout: 'flow', bg: 'tint', kicker: 'How it works', headline: 'How a deck ==gets made==',
      items: [
        { col: 'in', icon: 'edit', title: 'Your brief', body: 'Topic, notes and data' },
        { col: 'in', icon: 'wand', title: 'An AI', body: 'Optional. Writes the file for you' },
        { col: 'in', icon: 'layers', title: 'A template', body: 'Or a single blank slide' },
        { col: 'hub', icon: 'file', title: 'deck.pitchcraft', body: 'One JSON file' },
        { col: 'out', icon: 'presentation', title: 'Present', body: 'Fullscreen in the browser' },
        { col: 'out', icon: 'download', title: 'Save', body: 'A file, a link, or a PDF' },
        { col: 'out', icon: 'link', title: 'Share', body: 'Send the file to someone' }
      ] },
    { id: 'tour-steps', layout: 'process', kicker: 'Fastest start', headline: 'Build a deck with an ==AI chat==',
      items: [
        { step: '01', icon: 'sparkles', title: 'Click AI', body: 'Top bar, then Build with AI.' },
        { step: '02', icon: 'edit', title: 'Describe it', body: 'Topic, audience, slide count. Then copy the prompt.' },
        { step: '03', icon: 'wand', title: 'Paste into a chat', body: 'ChatGPT, Claude or Gemini replies with a .pitchcraft file.' },
        { step: '04', icon: 'folder-open', title: 'Open', body: 'Drop the file on this page, then fix details by hand.' }
      ] },
    { id: 'tour-ai', layout: 'split', kicker: 'Two routes', headline: 'Which AI are you ==using==?',
      columns: [
        { icon: 'sparkles', headline: 'A chat window', body: 'ChatGPT, Claude, Gemini. The AI cannot see this page, so the prompt carries the full guide. It replies with a file and you open it.' },
        { icon: 'globe', headline: 'An AI in your browser', body: 'Comet, Atlas, Claude for Chrome, Cursor. Open this page and let the agent use the tab. It edits the deck directly, and Ctrl+Z undoes it.' }],
      notes: 'The chat route works with any AI. The browser route is quicker for small edits because the agent changes the live deck.' },
    { id: 'tour-prompt', layout: 'bullets', kicker: 'The prompt', headline: 'Where the ==prompt== is', body: 'Click AI in the top bar. The dialog holds everything an AI needs.',
      items: [
        { title: 'Choose how it builds', body: 'Let the AI choose, custom HTML, CSS and JS slides, or templates only.' },
        { title: 'Chat tab', body: 'A complete prompt, or a short one with a link for AIs that can open web pages.' },
        { title: 'Browser tab', body: 'A prompt for agents, and one for the current slide only.' },
        { title: 'The web address', body: 'Every prompt names this site and its guide, so the AI does not have to search for them.' }
      ] },
    { id: 'tour-anatomy', layout: 'anatomy', kicker: 'The editor', headline: 'Five parts of the ==editor==',
      items: [
        { title: 'Slides', body: 'Thumbnails on the left. Drag to reorder.' },
        { title: 'Ribbon', body: 'Insert text, shapes, images and icons. Change the theme.' },
        { title: 'Canvas', body: 'Click text to edit it. Drag to move, resize or rotate.' },
        { title: 'Inspector', body: 'Format, Slide, Code and Deck tabs.' },
        { title: 'Present', body: 'Fullscreen, with notes and touch support.' }
      ] },
    { id: 'tour-modes', layout: 'cards', bg: 'tint', kicker: 'Building slides', headline: 'Each slide uses one of ==three== methods',
      items: [
        { icon: 'layers', title: 'Template', body: 'Pick a layout and fill in the fields. Quickest for text, lists and charts.' },
        { icon: 'edit', title: 'Blank', body: 'Place text, shapes, images and icons wherever you want them.' },
        { icon: 'code', title: 'HTML, CSS and JS', body: 'Write the slide as code. No limit on layout, brand styling or animation.' }
      ],
      notes: 'Switch between them in the Slide tab, under How this slide is built. Converting a template slide to HTML keeps what it looks like and turns it into code you can edit in the Code tab. Undo reverses it.' },
    { id: 'tour-free', layout: 'blank', bg: 'tint', transition: 'rise',
      notes: 'This slide is a blank slide: no template, every element is a free-form object. Click any of them to drag, resize, rotate or restyle it. Insert more from the Insert tab in the ribbon.',
      objects: [
        { id: 'fk', type: 'text', x: 80, y: 84, w: 640, text: 'Blank slides', size: 26, weight: 700, caps: true, ls: 0.1, color: 'var(--shape)' },
        { id: 'fh', type: 'text', x: 80, y: 130, w: 680, text: 'Put things **where you want** them.', size: 64, weight: 800, font: 'display', lh: 1.06 },
        { id: 'fb', type: 'text', x: 80, y: 360, w: 620, text: 'Add text, images, shapes, lines and icons from the Insert tab. Connectors snap to shapes and follow them. Drag to move, drag a corner to resize, and use the Format tab for fonts and colours. Text and cards on template slides can be dragged too.', size: 28, color: 'var(--muted)', lh: 1.4 },
        { id: 'fc', type: 'shape', shape: 'round', x: 820, y: 120, w: 360, h: 240, fill: 'var(--shape)', text: 'Drag me', size: 44, weight: 700, color: 'var(--on-shape)', align: 'center', valign: 'middle', rot: -4, shadow: true },
        { id: 'fe', type: 'shape', shape: 'ellipse', x: 1010, y: 410, w: 170, h: 170, fill: 'var(--shape)' },
        { id: 'fs', type: 'shape', shape: 'star', x: 830, y: 430, w: 130, h: 130, fill: 'var(--c3)', rot: 12 },
        { id: 'fi', type: 'icon', icon: 'sparkles', x: 1050, y: 450, w: 90, h: 90, color: 'var(--on-shape)' },
        { id: 'fl', type: 'shape', shape: 'line', x: 80, y: 600, w: 620, h: 14, stroke: 'var(--muted)', strokeW: 3 },
        { id: 'fx', type: 'line', kind: 'elbow', vert: true, flipH: true, from: 'fc:b', to: 'fs:t', x: 895, y: 360, w: 105, h: 70, stroke: 'var(--muted)', strokeW: 3, arrowEnd: 'triangle' }
      ] },
    { id: 'tour-custom', layout: 'custom', bg: 'dark', headline: 'HTML, CSS and JS slide',
      notes: 'Templates are the quick route. Any slide can instead be HTML, CSS and JavaScript, so you or an AI can build any layout, or match a company brand exactly. This slide is one: the box on the right types itself out, and the shape is a live animation. Thumbnails show the slide before its JavaScript runs.',
      custom: {
        html: `<div class="nw">
  <div class="nw-l">
    <div class="kicker rv">Custom slides</div>
    <h2 class="nw-h rv">Write a slide as <span class="nw-w">code</span>.</h2>
    <p class="nw-p rv">Choose HTML, CSS and JS in the Slide tab, and the code opens in the Code tab. Or ask an AI to write one. Colours and fonts shared by every custom slide go in the Code tab, under Brand CSS.</p>
    <div class="nw-chips rv"><span>HTML</span><span>CSS</span><span>JS</span><span>Sandboxed</span></div>
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
.nw-w { color: var(--ink-acc, var(--acc)); }
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
const out = document.getElementById('code');
const tint = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/&lt;\\/?\\w+|"[^"]*"|\\b(?:class|style|id)\\b/g, m => '<span class="' + (m[0] === '&' ? 'k' : m[0] === '"' ? 's' : 'c') + '">' + m + '</span>');   // one pass, so a match is never re-matched inside an earlier span
let i = 0;
(function type() { i = Math.min(src.length, i + 2); out.innerHTML = tint(src.slice(0, i)) + '<span class="caret"></span>'; if (i < src.length) setTimeout(type, 38); })();
document.querySelector('.nw-blob').animate([{ borderRadius: '42% 58% 60% 40% / 48% 42% 58% 52%', transform: 'rotate(0deg)' }, { borderRadius: '58% 42% 38% 62% / 55% 60% 40% 45%', transform: 'rotate(18deg)' }], { duration: 4200, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });`
      } },
    { id: 'tour-bento', layout: 'bento', bg: 'tint', kicker: 'Built in', headline: 'What is ==included==',
      items: [
        { size: 'l', tone: '', icon: 'layers', title: 'Layouts', value: String(LAYOUT_N), body: 'Templates for stories, data and structure, plus blank and custom HTML.' },
        { size: 's', tone: '', icon: '', title: 'Chart types', value: String(CHART_N), body: '' },
        { size: 's', tone: 'coral', icon: 'chart', title: 'Animated charts', value: '', body: '' },
        { size: 's', tone: '', icon: '', title: 'Themes', value: String(THEME_N), body: '' },
        { size: 's', tone: '', icon: 'shield', title: 'Local storage', value: '', body: '' },
        { size: 'w', tone: 'teal', icon: 'globe', title: 'Static site', value: '', body: 'No server. It works offline, from a file, or on any web host.' },
        { size: 's', tone: '', icon: '', title: 'Transitions', value: String(TRANS_N), body: '' },
        { size: 's', tone: '', icon: 'heart', title: 'No account', value: '', body: '' }
      ] },
    { id: 'tour-saving', layout: 'bullets', kicker: 'Saving', headline: 'Where your ==deck== is kept', body: 'Nothing is uploaded to a server.',
      items: [
        { title: 'Autosave', body: 'Every change is saved in this browser.' },
        { title: 'Save', body: 'Ctrl+S saves a .pitchcraft file. That file is your real copy. Share makes a link to it.' },
        { title: 'Clearing browser data', body: 'This deletes the autosave. Save a file first.' },
        { title: 'PDF', body: 'The PDF button prints one page per slide.' }
      ] },
    { id: 'tour-demo', layout: 'demo', kicker: 'Sample data', headline: 'Charts are drawn from ==data==', body: 'This is the JSON behind the chart. Change a number and the chart follows.', chartType: 'line',
      chartData: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ name: 'Visits', values: [12, 19, 15, 28, 34] }] } },
    { id: 'tour-bar', layout: 'chart', kicker: 'Sample data', headline: 'Bars compare ==categories==', body: 'Bar, horizontal bar, line, area and donut charts all animate when you present.', chartType: 'bar',
      chartData: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Free', values: [12, 19, 27, 41] }, { name: 'Paid', values: [4, 9, 18, 33] }] },
      items: [{ value: '+242%', label: 'Free, year on year' }, { value: '8x', label: 'Paid, year on year' }] },
    { id: 'tour-table', layout: 'table', kicker: 'Reference', headline: 'Keys worth ==knowing==',
      tableData: { headers: ['Key', 'Where', 'What it does'], rows: [
        ['Ctrl / Cmd + Z', 'Editor', 'Undo (add Shift to redo)'], ['P', 'Editor', 'Present from this slide'], ['Arrow keys', 'Editor', 'Nudge the selected object (Shift for 10 px)'],
        ['Arrows, Space', 'Presenter', 'Previous and next slide'], ['N', 'Presenter', 'Show speaker notes'], ['Esc', 'Anywhere', 'Deselect, finish editing or exit'], ['?', 'Anywhere', 'Open help']] } },
    { id: 'tour-themes', layout: 'themes', bg: 'tint', kicker: 'Themes', headline: 'Five themes, one ==deck==',
      items: [
        { theme: 'studio', title: 'Studio', body: 'Clean sans-serif.' }, { theme: 'editorial', title: 'Editorial', body: 'Serif on warm paper.' },
        { theme: 'contrast', title: 'Contrast', body: 'Dark, with wide uppercase headings.' }, { theme: 'aurora', title: 'Aurora', body: 'Gradients and glass.' }, { theme: 'brutal', title: 'Brutalist', body: 'Hard edges.' }],
      notes: 'Change the theme in the Deck tab. Headings in Contrast are about twice as wide as Editorial, so long headlines wrap sooner.' },
    { id: 'tour-motion', layout: 'bullets', kicker: 'Transitions', headline: 'Choose how slides ==change==', body: 'Set a default in the Deck tab, then override it per slide in the Slide tab.',
      items: [
        { title: 'Fade', body: 'Plain, and works everywhere.' }, { title: 'Slide', body: 'Moves in the direction of the story.' },
        { title: 'Zoom', body: 'Use it once, for the big reveal.' }, { title: 'Rise and blur', body: 'A softer entrance.' }] },
    { id: 'tour-code', layout: 'code', bg: 'dark', kicker: 'Under the hood', headline: 'Every slide is ==JSON==', body: 'Open the Code tab to read or paste the JSON for the selected slide. This is what an AI writes.',
      code: { language: 'json', filename: 'slide.json', source: '{\n  "layout": "metrics",\n  "headline": "Key numbers",\n  "items": [\n    { "value": "42%", "label": "Conversion", "trend": "up" },\n    { "value": "1.8s", "label": "Load time", "trend": "down" }\n  ]\n}' } },
    { id: 'tour-limits', layout: 'comparison', kicker: 'Limits', headline: 'What it ==does not== do yet',
      columns: [
        { headline: 'Not available', body: 'Deliberately or not yet.', items: ['Several people editing at once', 'Accounts or cloud storage', 'Comments and sharing links'] },
        { headline: 'Works today', body: 'In any current browser.', items: ['Present fullscreen, on a phone too', 'Save as PowerPoint, PDF or a file, or share a link', 'Custom HTML, CSS and JS slides'] }] },
    { id: 'tour-roadmap', layout: 'timeline', bg: 'tint', kicker: 'Roadmap', headline: 'What is ==next==',
      items: [
        { date: 'Shipped', title: 'The toolkit', body: 'Blank and custom slides, connectors, AI guide, presenter, PDF, PowerPoint export, dark mode.', status: 'done' },
        { date: 'Now', title: 'Templates', body: 'More decks and more chart types.', status: 'now' },
        { date: 'Next', title: 'Native PowerPoint charts', body: 'Charts export as pictures today. Editable ones are next.', status: 'next' },
        { date: 'Later', title: 'Shared decks', body: 'Sharing and comments.', status: 'next' }] },
    { id: 'tour-end', layout: 'closing', bg: 'grad', kicker: 'Next', headline: 'Try it on ==this deck==.', body: 'Click any text to edit it, press P to present, or start a new deck from the Deck tab.',
      items: [{ icon: 'play', label: 'Present', value: 'P' }, { icon: 'file', label: 'New deck', value: 'Deck tab' }, { icon: 'wand', label: 'Build with AI', value: 'Top bar' }] }
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

/* The deck "New deck" starts from: one slide that explains how to have an AI build the rest. */
const blank = {
  meta: { name: 'New deck', theme: 'studio', numbers: false, transition: 'fade' },
  slides: [
    { id: 'new-start', layout: 'split', kicker: 'New deck', headline: 'Ask an ==AI== to build this deck',
      columns: [
        { icon: 'sparkles', headline: 'AI in a chat window', body: 'Click AI in the top bar, then Build with AI. Describe the deck, copy the prompt, paste it into ChatGPT, Claude or Gemini, then open the .pitchcraft file it sends back.' },
        { icon: 'globe', headline: 'AI in your browser', body: 'Open this page in Comet, Atlas, Claude for Chrome or Cursor. Click AI, switch to the browser tab, copy the agent prompt and paste it into the agent. It edits this deck directly.' }],
      objects: [
        { id: 'where', type: 'text', x: 80, y: 626, w: 1120, text: 'The stock prompt is under **AI** in the top bar. It names this site and carries the full guide. Replace this slide when you are done.', size: 24, color: 'var(--muted)' }
      ],
      notes: 'The prompt is under the AI button in the top bar (Build with AI). It includes this site\'s web address and the whole guide, so you can paste it into any AI as it is. Delete or replace this slide when the real deck is ready.' }
  ]
};

PC.TEMPLATES = [
  { id: 'tour', name: 'How Pitchcraft works', tag: 'The product tour', blurb: 'A guided showcase of every layout, chart, theme and transition. Start here.', deck: tour },
  { id: 'memo', name: 'Quarterly signal', tag: 'Editorial memo', blurb: 'A calm, serif strategy memo with metrics, an area chart and recommendations.', deck: memo },
  { id: 'launch', name: 'Product launch', tag: 'Aurora glow', blurb: 'Gradients, glass and a bento overview for a product announcement.', deck: launch },
  { id: 'pitch', name: 'Investor pitch', tag: 'Brutalist', blurb: 'Hard edges and big type: problem, traction, market and the ask.', deck: pitch },
  { id: 'blank', name: 'New deck', tag: 'One slide', blurb: 'A single slide that explains how to have an AI build the deck. Add slides from the ribbon.', deck: blank }
];
})();
