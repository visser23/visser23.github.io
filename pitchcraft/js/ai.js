/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT ai — the AI assistant: prompts + the dialog behind the top-bar "AI" button.

   Two very different situations, two different flows:
     1. CHAT WINDOW (ChatGPT, Claude, Gemini...): the AI cannot see this page. It is given the guide and a brief, and
        returns a `.pitchcraft` file (or one JSON block) that the user imports.
     2. BROWSER AI (Comet, Atlas, Claude for Chrome, Cursor's browser...): the AI can run JavaScript in this tab, so it
        edits the live deck through `window.Pitchcraft` (see PC.API_DOCS). Everything is validated and undoable.

   The guide itself is GENERATED (scripts/build-guide.js -> js/guide-data.js + ai-guide.md) from the same specs the
   renderer uses, so the prompts below only wrap it; they never restate what the specs already say.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const AI = PC.ai = {};
const G = () => PC.GUIDE || { version: PC.VERSION, md: '(guide missing: run node scripts/build-guide.js)', url: 'https://visser23.github.io/pitchcraft/ai-guide.md', rawUrl: '', pageUrl: '' };
/** The guide as markdown. With a section (a number such as 9, or a word from a heading) only that part, so an agent can fetch it in small pieces. */
AI.guide = function (section) {
  const md = G().md; if (section == null || section === '') return md;
  const parts = md.split(/^(?=## )/m).slice(1), key = String(section).trim().toLowerCase().replace(/^§\s*/, '');
  const num = /^\d+$/.test(key), hit = parts.find(p => { const h = p.split('\n', 1)[0].replace(/^##\s*/, '').toLowerCase(); return num ? h.startsWith(key + '.') : h.includes(key); });
  if (!hit) throw new Error(`No guide section matches "${section}". Sections: ${parts.map(p => p.split('\n', 1)[0].replace(/^##\s*/, '')).join(' | ')}`);
  return hit.trim();
};
AI.guideUrl = () => G().url;

/** Web addresses for the prompts. An AI that pastes a prompt into a chat cannot guess where Pitchcraft lives (it is not in search results),
 *  so every prompt names it. Prefer the address the user is actually on (if it is a real http(s) site), else the published one. */
AI.urls = function () {
  const g = G(), canonical = g.url.replace(/ai-guide\.md$/, '');
  let here = '';
  try { const l = window.location; if (/^https?:$/.test(l.protocol) && !/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(l.hostname)) here = l.origin + l.pathname.replace(/[^/]*$/, ''); } catch (e) { /* no location: use the published address */ }
  const site = here || canonical;
  return { site, canonical, here, guide: site + 'ai-guide.md', full: site + 'llms-full.txt', schema: site + 'pitchcraft.schema.json', differs: !!here && here !== canonical };
};
/** One line naming the app, for the top of every prompt. */
const siteLine = () => { const u = AI.urls(); return `PITCHCRAFT WEB ADDRESS: ${u.site}${u.differs ? `  (also published at ${u.canonical})` : ''}\nThis is the app the deck is for. It is a small open tool, so do not search for it: use this address.`; };

/** How the AI should build slides. The default leaves the choice to the AI but points it at the full-capability route. */
const APPROACHES = {
  auto: 'Choose per slide. Slides can be built three ways: (1) template layouts, fast and consistent, for plain text, lists and simple charts; (2) the "blank" layout with free-form objects; (3) "custom" slides written as HTML, CSS and JavaScript, which can do anything (any layout, brand styling, diagrams, animation, canvas). Use custom slides wherever the design matters. Use templates for the plain slides.',
  templates: 'Use the built-in template layouts only (no custom slides), so the user can edit every slide field by field.',
  custom: 'Build every slide as a custom slide (layout "custom": HTML, CSS and JavaScript), with shared brand CSS in meta.css. The user wants full design control.'
};
AI.APPROACHES = Object.keys(APPROACHES);
const approachLine = o => `HOW TO BUILD THE SLIDES\n${APPROACHES[(o && APPROACHES[o.approach]) ? o.approach : 'auto']}`;

const REPLY = `HOW TO REPLY
- Create a downloadable file named <short-deck-name>.pitchcraft whose entire content is the deck JSON (format "pitchcraft", version 3).
- If you cannot create files, reply with the JSON alone in ONE \`\`\`json code block, with nothing else inside it.
- Valid JSON only: double quotes, no comments, no trailing commas, no "..." placeholders.
- After the file or code block add at most two short lines: the slide count, and anything I should check (for example data you marked [NEEDS EVIDENCE]).`;

const taskLine = (t, ph) => (t && t.trim() ? t.trim() : ph);

/** A prompt for a chat window that can't open links: the whole guide travels inside it. */
AI.promptChat = function (brief, opts) {
  return `You are building a presentation deck for Pitchcraft, a browser presentation studio. Follow the guide at the end of this message exactly: it is the complete specification (deck format, layouts, free-form objects, custom HTML/CSS/JS slides, design rules, writing style).

${siteLine()}

${approachLine(opts)}

YOUR TASK
${taskLine(brief, '[DESCRIBE THE DECK: topic, audience, tone, how many slides, any facts and numbers to use]')}

${REPLY}

────────── PITCHCRAFT GUIDE (v${G().version}) ──────────

${G().md}`;
};

/** A short prompt for assistants that can open web pages: they read the published guide themselves. */
AI.promptLink = function (brief, opts) {
  const g = G(), u = AI.urls();
  return `You are building a presentation deck for Pitchcraft, a browser presentation studio.

${siteLine()}

FIRST read the Pitchcraft guide (it is the complete specification: deck format, layouts, free-form objects, custom HTML/CSS/JS slides, design rules, writing style):
${u.guide}
${u.differs ? `(published copy: ${g.url})\n` : ''}${g.rawUrl ? `(same file on GitHub: ${g.rawUrl})\n` : ''}If you cannot open that link, say so and stop. Do not guess the format.

${approachLine(opts)}

YOUR TASK
${taskLine(brief, '[DESCRIBE THE DECK: topic, audience, tone, how many slides, any facts and numbers to use]')}

${REPLY}`;
};

/** For an AI that can run JavaScript in the open Pitchcraft tab. */
AI.promptAgent = function (task, opts) {
  const g = G(), u = AI.urls(), api = PC.API_DOCS.map(([, sig, doc]) => `  Pitchcraft.${sig}  // ${doc}`).join('\n');
  return `Pitchcraft (a browser presentation studio) is open in the browser tab you control. You can read and edit the live deck with its JavaScript API, \`window.Pitchcraft\`. Every call is validated and undoable (the user can press Ctrl+Z).

${siteLine()}

START HERE
1. Run \`Pitchcraft.guide()\` and read the result. It is the complete specification (deck format, layouts, free-form objects, custom HTML/CSS/JS slides, design rules, writing style). \`Pitchcraft.guide(9)\` returns just section 9. If your tool mangles URLs or equals signs in long output, fetch the plain text copy instead: ${u.guide}
2. Run \`Pitchcraft.getDeck()\` to see the current deck, or \`Pitchcraft.getSlide("s1")\` for one slide.
3. \`Pitchcraft.schema()\` is the JSON Schema of a deck and \`Pitchcraft.manifest()\` lists the API with quickstart recipes. There is no separate import button to find: \`Pitchcraft.importText(json)\` loads a whole deck.

THE API
${api}

${approachLine(opts)}

HOW TO WORK
- A slide can be built three ways, and you can mix them in one deck. (1) Template layout: set fields like headline and items. Quick and consistent. (2) "blank" layout with free-form objects (text, shape, image, icon) placed at x/y/w/h on the 1280 x 720 stage. (3) Custom slide: your own HTML, CSS and JavaScript, with no limits on layout or styling. Route 3 is the full-capability route: use \`Pitchcraft.addCustomSlide({ html, css, js, interactive })\`, then \`Pitchcraft.setCustom(ref, { css })\` to refine. Shared brand CSS goes in \`Pitchcraft.setMeta({ css })\`.
- Custom slides run in a sandbox: no network, no storage, no external scripts. Your own js runs. Thumbnails do not run js, so the html and css must look complete without it.
- Theme fonts can be much wider than you expect (Contrast is about twice the width of Editorial). Call \`Pitchcraft.measureText(text, { font: "display", size: 64, w: 900 })\` before placing text.
- Make the smallest change that does what was asked. Prefer updateObject, setPath, setCustom and setTweak over replacing whole slides.
- Afterwards run \`await Pitchcraft.auditAll()\`. It measures custom slides too. Every slide's problems list should be empty; fix anything it reports. \`Pitchcraft.audit()\` is the quick version and marks custom slides unchecked.
- Never invent facts or numbers; label sample data. Do not reload or navigate away from the page.
- Stop when the slide visibly updates, then tell me in one or two lines what you changed.

TASK
${taskLine(task, '[DESCRIBE WHAT TO BUILD OR CHANGE]')}`;
};

/** Edit one slide (chat or browser): includes the slide as it is now. */
AI.promptSlide = function (slide, task) {
  slide = slide || S.slide(); const id = slide.id, json = JSON.stringify(slide, null, 2), g = G();
  return `You are editing ONE slide of a Pitchcraft deck. The full specification is at ${AI.urls().guide} (or \`Pitchcraft.guide()\` in the page).

${siteLine()}

THE SLIDE NOW (id "${id}")
${json.length > 9000 ? json.slice(0, 9000) + '\n… (truncated; use Pitchcraft.getSlide("' + id + '") for all of it)' : json}

IF YOU CAN RUN JAVASCRIPT IN THE OPEN PITCHCRAFT TAB
  Pitchcraft.getSlide("${id}")                          // read
  Pitchcraft.updateSlide("${id}", { headline: "…" })    // shallow patch
  Pitchcraft.setPath("${id}", "items.0.value", "42")    // one nested field
  Pitchcraft.addObject("${id}", { type: "text", text: "Hello", x: 80, y: 80, w: 600, size: 48 })
  Pitchcraft.updateObject("${id}", "<object id>", { x: 120 })
  Pitchcraft.setTweak("${id}", "headline", { dx: 0, dy: -20, size: 80 })
${slide.layout === 'custom' ? '  Pitchcraft.setPath("' + id + '", "custom.html", "<div>…</div>")   // a custom slide is three strings: custom.html, custom.css, custom.js\n' : ''}IF YOU ARE IN A CHAT WINDOW
Reply with ONLY the complete corrected slide as one JSON object (same shape as above) in a \`\`\`json block. I will paste it into Pitchcraft's Code tab and press Apply changes.

Change only what was asked. Never invent facts. Keep text readable (contrast, at least 22 px) and inside the safe area.
If the look matters more than field-by-field editing, you may rewrite the slide as a custom slide ("layout": "custom" with custom.html, custom.css and custom.js): it can do anything. Say so when you do.

TASK
${taskLine(task, '[DESCRIBE THE EDIT]')}`;
};

/** The authoring guide for free-form HTML/CSS/JS slides. */
AI.promptCustom = function () {
  return `You are writing ONE slide for Pitchcraft as free-form HTML, CSS and JavaScript. Return ONLY this JSON object in one \`\`\`json block (no commentary). The user pastes it into Pitchcraft's Code tab and presses Apply changes:

{ "id": "s1", "layout": "custom", "headline": "short slide name", "notes": "speaker notes",
  "custom": { "html": "…", "css": "…", "js": "…", "interactive": false } }

Custom slides are Pitchcraft's full-capability route: any layout, any styling, diagrams, animation, canvas, interactive demos. Use them wherever the design matters. The full specification is at ${AI.urls().guide}.

${siteLine()}

THE CANVAS
- The slide is exactly 1280 x 720 px. html, css and js are three separate strings. html is the body content only (no <html>, <head> or <script>). The slide is scaled to fit any screen, so use px and design for 1280x720.
- The slide root is an empty, position:relative, overflow:hidden box. Use position:absolute, CSS grid/flex, inline SVG or <canvas>.
- Keep every important element at least 60px from the edges. Text at least 22px; body copy 26px+.

THE KIT (optional: it follows the deck theme and background)
- CSS variables: var(--fg) text, var(--muted) secondary text, var(--acc) accent, var(--on-acc) text ON the accent, var(--slide-bg) background, var(--card) panels, var(--line) borders, var(--radius), var(--shadow), var(--c1)…var(--c6) palette, var(--font-d) display font, var(--font-b) body font, var(--f-mono) code font.
- Helper classes: .kicker, .display, .h2, .lead, mark.hl, and .rv (fades up when presenting; give several elements .rv for a staggered entrance).
- Or ignore all of it and style everything yourself.

BRANDING
- The sandbox blocks network access except https images and fonts. For a guaranteed result embed assets as data: URIs.
- Brand colours, fonts and logo classes that EVERY custom slide shares belong in the deck's meta.css (Code tab, Brand CSS), not in each slide.

BEHAVIOUR
- js runs when the slide is shown, inside a sandbox: no access to the editor, storage, cookies or the network.
- Set "interactive": true only if the slide has buttons or inputs people should click while presenting. Call pc.next() or pc.prev() from your js to move the deck.
- Thumbnails and PDF export draw the slide from html+css without running js, so it must look complete before js runs.
- Theme fonts differ a lot in width (Contrast's display font is about twice as wide as Editorial's). Size headlines for the widest font you might meet, or call Pitchcraft.measureText in the page.
- Respect @media (prefers-reduced-motion: reduce).

RULES
- Never invent facts or numbers; label sample data "Sample data".
- One idea per slide. Text must be readable on its background (4.5:1).
- Your own inline js runs. What the sandbox blocks: external scripts (<script src>), iframes, forms, fetch and other network calls, and storage.
- When you can run JavaScript in the page, finish with await Pitchcraft.auditAll(): it measures overflow, clipping and text overlap inside custom slides.

BRIEF:
[DESCRIBE THE SLIDE, OR PASTE THE BRAND GUIDE]`;
};

/** What `Pitchcraft.manifest()` returns: everything an agent needs to orient itself in one call. */
AI.manifest = function () {
  const g = G();
  return {
    name: 'Pitchcraft', version: PC.VERSION, guideVersion: g.version,
    guide: { url: g.url, rawUrl: g.rawUrl, page: g.pageUrl, inPage: 'Pitchcraft.guide()' },
    file: { extension: '.pitchcraft', format: 'pitchcraft', version: 3, how: 'JSON. Import with the Import dialog, drop the file on the page, or call Pitchcraft.importText(json).' },
    schema: { url: AI.urls().schema, inPage: 'Pitchcraft.schema()' },
    site: AI.urls().site,
    plainText: { guideMarkdown: AI.urls().guide, guideAndApiOneFile: AI.urls().full, oneSection: 'Pitchcraft.guide(9)   // or a word from a heading, e.g. Pitchcraft.guide("custom")', why: 'Plain files with no scripts. Use them if your browser tool rewrites URLs or equals signs in long output.' },
    approaches: { templates: 'quick, consistent, editable field by field', blank: 'free-form objects at x/y/w/h', custom: 'FULL CAPABILITY: your own HTML, CSS and JavaScript for any layout, brand styling, diagrams and animation' },
    themeFontWidth: Object.fromEntries(Object.entries(PC.THEMES).map(([k, t]) => [k, t.em])),
    quickstart: {
      importWholeDeck: 'Pitchcraft.importText(jsonString)   // or Pitchcraft.setDeck(objectOrJson); both validate and report warnings; undoable',
      customHtmlCssJs: 'Pitchcraft.addCustomSlide({ html: "<h1>Hi</h1>", css: "h1{font-size:96px}", js: "", interactive: false }, undefined, "Name")   // sandboxed 1280x720 slide; edit later with Pitchcraft.setCustom(ref, { css })',
      brandCss: 'Pitchcraft.setMeta({ css: ".logo{...}" })   // shared CSS for every custom slide',
      freeFormObjects: 'Pitchcraft.addSlide("blank"); Pitchcraft.addObject(ref, { type: "text", text: "Hi", x: 80, y: 80, w: 600, size: 64 })',
      templateSlide: 'Pitchcraft.addSlide("metrics"); Pitchcraft.updateSlide(ref, { headline: "...", items: [...] })',
      measure: 'Pitchcraft.measureText("Quarterly results", { font: "display", size: 72, w: 800 })   // {width, height, lines, em}',
      check: 'await Pitchcraft.auditAll()   // measures custom slides too; every problems list should be empty. audit() is the fast version and marks custom slides checked:false'
    },
    custom: { layout: 'custom', fields: ['html', 'css', 'js', 'interactive'], sandbox: 'iframe sandbox="allow-scripts", opaque origin, CSP: no network, no frames, no forms', maxCharsPerField: PC.LIMITS.custom, sharedCss: 'meta.css' },
    stage: { width: PC.STAGE.w, height: PC.STAGE.h, unit: 'px' },
    api: PC.API_DOCS.map(([group, sig, doc]) => ({ group, call: 'Pitchcraft.' + sig, doc })),
    layouts: Object.fromEntries(Object.entries(PC.LAYOUTS).map(([k, l]) => [k, { name: l.name, group: l.group, fields: l.doc }])),
    themes: Object.keys(PC.THEMES), transitions: Object.keys(PC.TRANSITIONS), tones: Object.keys(PC.TONES).filter(Boolean), icons: PC.ICON_NAMES,
    objects: { types: Object.keys(PC.OBJECT_TYPES), shapes: Object.keys(PC.SHAPES), fonts: Object.keys(PC.FONTS), colorTokens: PC.COLOR_TOKENS.map(c => c[0]), defaults: PC.OBJ_DEFAULTS, max: PC.LIMITS.objects },
    limits: { slides: 200, objectsPerSlide: PC.LIMITS.objects }
  };
};

/* ── copy helpers ── */
const KINDS = {
  chat: { fn: (b, o) => AI.promptChat(b, o), msg: 'Prompt copied. Paste it into your chat, then import the .pitchcraft file it returns.' },
  link: { fn: (b, o) => AI.promptLink(b, o), msg: 'Short prompt copied. Paste it into an AI that can open web pages.' },
  agent: { fn: (b, o) => AI.promptAgent(b, o), msg: 'Prompt copied. Paste it into the AI that lives in your browser.' },
  slide: { fn: b => AI.promptSlide(null, b), msg: 'Slide prompt copied. Paste it into your AI.' },
  custom: { fn: () => AI.promptCustom(), msg: 'Custom-slide prompt copied. Paste it into your AI with your brief.' },
  guide: { fn: () => AI.guide(), msg: 'Full guide copied' }
};
AI.prompt = (kind, arg, opts) => KINDS[kind].fn(arg, opts);
AI.copy = (kind, arg, opts) => UI.copy(KINDS[kind].fn(arg, opts), KINDS[kind].msg);

/* ── the dialog ── */
AI.dialog = function (tab) {
  const body = document.createElement('div'), g = G();
  body.className = 'ai-dlg';
  body.innerHTML = `
    <p class="ai-lead">Pitchcraft decks are plain JSON, so any AI can write them. Every prompt below includes this site's web address and a full guide, so the AI does not have to find them.</p>
    <fieldset class="ai-approach"><legend>How should the AI build the slides?</legend>
      <label><input type="radio" name="ai-approach" value="auto" checked> <span><b>Let the AI choose</b> custom HTML, CSS and JavaScript where design matters, templates for plain slides</span></label>
      <label><input type="radio" name="ai-approach" value="custom"> <span><b>Custom design</b> every slide is HTML, CSS and JS: full control of the look</span></label>
      <label><input type="radio" name="ai-approach" value="templates"> <span><b>Templates only</b> quick, consistent, editable field by field</span></label>
    </fieldset>
    <p class="ai-lead">Now pick how you are using your AI:</p>
    <div class="ai-tabs" role="tablist" aria-label="Where is your AI?">
      <button role="tab" id="ai-tab-chat" aria-selected="true" aria-controls="ai-pane-chat" data-aitab="chat">${icon('sparkles', 18)}<span><b>In a chat window</b><small>ChatGPT, Claude, Gemini, Copilot…</small></span></button>
      <button role="tab" id="ai-tab-browser" aria-selected="false" aria-controls="ai-pane-browser" data-aitab="browser" tabindex="-1">${icon('globe', 18)}<span><b>AI in your browser</b><small>Comet, Atlas, Claude for Chrome, Cursor…</small></span></button>
    </div>
    <div role="tabpanel" id="ai-pane-chat" aria-labelledby="ai-tab-chat">
      <ol class="ai-steps">
        <li><b>Describe your deck</b> <span class="hint">optional, you can also do it in the chat</span>
          <label class="sr-only" for="ai-brief">What should the deck be about?</label><textarea class="txt" id="ai-brief" rows="3" placeholder="e.g. A 10-slide investor update for a bike-share startup. Confident, data-led. Growth is up 42% quarter on quarter."></textarea></li>
        <li><b>Copy the prompt</b> and paste it into a new chat.
          <div class="ai-mode" role="radiogroup" aria-label="Prompt type">
            <label><input type="radio" name="ai-mode" value="chat" checked> <span><b>Complete</b> works in any chat (the whole guide is inside the prompt)</span></label>
            <label><input type="radio" name="ai-mode" value="link"> <span><b>Short with a link</b> for AIs that can open web pages (they read the published guide)</span></label>
          </div>
          <div class="row wrap"><button class="btn primary" id="ai-copy">${icon('copy', 16)} Copy prompt</button><span class="hint" id="ai-size"></span></div></li>
        <li><b>Import what comes back.</b> The AI returns a <code>.pitchcraft</code> file (or one JSON block). Drop the file on this page, or:
          <div class="row wrap"><button class="btn" id="ai-import">${icon('upload', 16)} Import the reply…</button></div></li>
      </ol>
      <details class="ai-prev"><summary>Preview the prompt</summary><textarea class="txt mono" id="ai-preview" rows="9" readonly spellcheck="false" aria-label="Prompt preview"></textarea></details>
    </div>
    <div role="tabpanel" id="ai-pane-browser" aria-labelledby="ai-tab-browser" hidden>
      <ol class="ai-steps">
        <li><b>Open this page in a browser with an AI agent</b> and let the agent use this tab. It edits your deck live, and every change can be undone with Ctrl+Z.</li>
        <li><b>Say what you want</b>
          <label class="sr-only" for="ai-task">What should the AI do?</label><textarea class="txt" id="ai-task" rows="3" placeholder="e.g. Make slide 3 a blank slide with a big 42% on the left, a rounded card on the right and a caption underneath."></textarea></li>
        <li><b>Copy the prompt</b> and paste it into the agent.
          <div class="row wrap"><button class="btn primary" id="ai-copy-agent">${icon('copy', 16)} Copy agent prompt</button><button class="btn" id="ai-copy-slide">${icon('wand', 16)} Copy prompt for the current slide</button></div></li>
      </ol>
      <div class="ai-can"><b>What the agent can do</b><ul>
        <li>Write whole slides as your own HTML, CSS and JavaScript (any layout, brand styling, animation), and check them with a layout audit that measures the rendered result.</li>
        <li>Edit any text, chart, table or card field on any slide.</li>
        <li>Add, move, resize, rotate and restyle free-form text boxes, shapes, images and icons (the same objects you can drag on the canvas).</li>
        <li>Move and restyle a template slide's own headline, text and cards.</li>
        <li>Add, reorder and delete slides, and switch theme.</li></ul>
        <p class="hint">Agents find everything through <code>Pitchcraft.guide()</code> and <code>Pitchcraft.manifest()</code> in the page. The prompt tells them to.</p></div>
      <details class="ai-prev"><summary>Preview the prompt</summary><textarea class="txt mono" id="ai-preview-agent" rows="9" readonly spellcheck="false" aria-label="Agent prompt preview"></textarea></details>
    </div>
    <p class="ai-foot">Guide v${esc(g.version)}: <a href="${esc(g.pageUrl || g.url)}" target="_blank" rel="noopener noreferrer">open the published guide</a> · <button class="linkish" id="ai-copy-guide">copy the guide</button> · <button class="linkish" id="ai-copy-custom">custom HTML slide prompt</button></p>`;
  const foot = document.createElement('div'); foot.style.display = 'contents'; foot.innerHTML = '<button class="btn" data-close>Close</button>';
  const m = UI.modal({ title: 'Build with AI', body, footer: foot, size: 'mid', cls: 'ai-modal' });
  const el = m.el, mode = () => ($('input[name="ai-mode"]:checked', el) || {}).value || 'chat';
  const opts = () => ({ approach: ($('input[name="ai-approach"]:checked', el) || {}).value || 'auto' });
  const setTab = t => {
    $$('[data-aitab]', el).forEach(b => { const on = b.dataset.aitab === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $('#ai-pane-chat', el).hidden = t !== 'chat'; $('#ai-pane-browser', el).hidden = t !== 'browser';
  };
  const refresh = () => {
    const p = AI.prompt(mode(), $('#ai-brief', el).value, opts()); $('#ai-preview', el).value = p;
    $('#ai-size', el).textContent = `${p.length.toLocaleString()} characters`;
    $('#ai-preview-agent', el).value = AI.prompt('agent', $('#ai-task', el).value, opts());
  };
  el.addEventListener('click', e => {
    const t = e.target, tab = t.closest('[data-aitab]'); if (tab) { setTab(tab.dataset.aitab); return; }
    if (t.closest('#ai-copy')) AI.copy(mode(), $('#ai-brief', el).value, opts());
    else if (t.closest('#ai-copy-agent')) AI.copy('agent', $('#ai-task', el).value, opts());
    else if (t.closest('#ai-copy-slide')) AI.copy('slide', $('#ai-task', el).value);
    else if (t.closest('#ai-copy-guide')) AI.copy('guide');
    else if (t.closest('#ai-copy-custom')) AI.copy('custom');
    else if (t.closest('#ai-import')) { m.close(); PC.importDialog(); }
  });
  el.addEventListener('keydown', e => {
    const b = e.target.closest && e.target.closest('[data-aitab]'); if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const n = b.dataset.aitab === 'chat' ? 'browser' : 'chat'; setTab(n); $(`#ai-tab-${n}`, el).focus();
  });
  el.addEventListener('input', refresh); el.addEventListener('change', refresh);
  refresh(); setTab(tab === 'browser' ? 'browser' : 'chat');
  return m;
};
})();
