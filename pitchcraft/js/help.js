/* Help: one topic at a time, with a filter box. Written to match what the app does today.
   When a feature changes, change its topic here (tests/e2e/help.spec.js checks the headline facts). */
(function () {
  'use strict';
  const PC = window.PC, UI = PC.ui, { $, $$ } = UI, icon = PC.icon, esc = PC.esc;
  const kbd = keys => keys.map(x => `<kbd>${x}</kbd>`).join(' ');
  const keys = rows => `<div class="keys">${rows.map(([k, what]) => `<span>${kbd(k)}</span><span>${what}</span>`).join('')}</div>`;
  const faq = (q, a) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`;
  const card = (t, p) => `<div class="help-card"><b>${t}</b><p>${p}</p></div>`;
  const grid = (...c) => `<div class="help-grid">${c.join('')}</div>`;
  const ver = () => (PC.VERSION || '');

  /* id, title, icon, html (a function: some topics read live data) */
  const TOPICS = [
    ['start', 'Start here', 'sidebar', () => `
      <p>Pitchcraft is a free presentation studio that runs in your browser. A deck is plain data, so you can build it by hand, ask an AI to build it, or both. Your work saves automatically on this device and is never uploaded.</p>
      ${grid(
        card(`${icon('sidebar', 18)} Slides, on the left`, 'Live thumbnails of every slide. Click to jump, drag to reorder, hover for duplicate and delete. Hidden slides show faded.'),
        card(`${icon('layout', 18)} Ribbon, on top`, 'Tabs for <b>Slide</b>, <b>Insert</b>, <b>Text</b>, <b>Design</b>, <b>Deck</b> and <b>View</b>: add slides, insert text, pictures, shapes, lines and icons, format text, pick a theme, background, accent and transition.'),
        card(`${icon('edit', 18)} Canvas, in the middle`, 'Click any text to type. Drag to move, use the handles to resize and rotate, arrow keys to nudge. Zoom with the buttons at the bottom, or by pinching on a touchscreen.'),
        card(`${icon('sliders', 18)} Inspector, on the right`, '<b>Format</b> for whatever is selected, <b>Slide</b> for layout, background and the slide\'s data, <b>Code</b> for HTML, CSS, JavaScript and JSON, <b>Deck</b> for theme, export and recovery.')
      )}
      <p><b>Top bar:</b> undo and redo, <b>AI</b>, <b>Settings</b> (gear: dark mode, fonts, privacy), <b>Help</b>, and <b>Present</b>.</p>
      <p>New here? Open the <b>product tour</b> from the button below: it is itself a Pitchcraft deck you can edit.</p>`],

    ['slides', 'Slides and layouts', 'layout', () => `
      ${grid(
        card('Start from a layout', 'Templates such as Title, Metrics, Chart, Timeline or Comparison arrange your content. You can still drag any text or card (the move is stored as a small <i>tweak</i>) and change its font and size. <i>Reset position</i> undoes it.'),
        card('Or start from Blank', 'Pick the <b>Blank</b> layout for an empty canvas, then use <b>Insert</b> for text boxes, pictures, shapes, lines and icons anywhere. Drop a picture file straight onto a slide.'),
        card('Or write it as code', 'In the <b>Slide</b> tab, under <i>How this slide is built</i>, choose <b>HTML, CSS and JS</b>. A template slide keeps its look and becomes code you can change freely. See the <i>HTML, CSS and JS</i> topic.')
      )}
      <h4>Slide settings</h4>
      <ul><li><b>Theme</b> (Studio, Editorial, Contrast, Aurora, Brutalist) and <b>accent colour</b> apply to the whole deck. <b>Background</b> (Auto, Tint, Dark, Accent, Gradient), a custom colour or a picture applies per slide.</li>
      <li><b>Transition</b> between slides: choose once for the deck, or override on a slide.</li>
      <li><b>Speaker notes</b> are in the Slide tab. Press <kbd>N</kbd> while presenting to see them. They are included in PowerPoint exports.</li>
      <li><b>Hide a slide</b> (Slide tab) to skip it when presenting and in PDF without deleting it. It stays in the editor and in the PowerPoint file, marked hidden.</li></ul>`],

    ['objects', 'Text, shapes, pictures and icons', 'shapes', () => `
      <p>On any slide, <b>Insert</b> adds free-form objects. Click one to select it; the <b>Format</b> tab shows its controls.</p>
      <ul><li><b>Text box:</b> grows with its content. Put a label <i>inside</i> a shape by selecting the shape and typing: a shape holds its own text, no separate box needed.</li>
      <li><b>Shapes:</b> rectangles, ovals, diamonds, arrows, stars and more, with fill (or a two-colour gradient), outline, dashes, corner radius and shadow.</li>
      <li><b>Pictures:</b> upload, drop a file on the slide, paste an image, or use an https address. Always add alternative text.</li>
      <li><b>Icons:</b> a built-in set that you can recolour and resize.</li>
      <li><b>Bullets and numbers:</b> switch a text or shape to a list in Format.</li></ul>
      <h4>Working with several objects</h4>
      <ul><li><b>Select many:</b> drag a box on empty space, or hold <kbd>Shift</kbd> and click. <kbd>Ctrl</kbd> <kbd>A</kbd> selects all objects on the slide.</li>
      <li><b>Group</b> (<kbd>Ctrl</kbd> <kbd>G</kbd>) makes objects move together; <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>G</kbd> ungroups.</li>
      <li><b>Align and distribute</b>, <b>order</b> (forward, back, front, back-most), <b>flip</b> and <b>rotate</b> are in Format. The Slide tab has a <b>Layers</b> list, top first.</li>
      <li><b>Lock</b> an object to stop accidental moves. <b>Link</b> an object to a web page, an email, or another slide (<code>#slide-id</code>); links work when presenting.</li>
      <li><kbd>Ctrl</kbd> <kbd>C</kbd> / <kbd>V</kbd> copy and paste objects (also between slides). <kbd>Ctrl</kbd> <kbd>D</kbd> duplicates.</li></ul>`],

    ['lines', 'Lines, corners and curves', 'link', () => `
      <p>Connectors work like PowerPoint's. Open <b>Insert &rarr; Shape</b>: the top group is <b>Lines and connectors</b>.</p>
      <ul><li><b>Straight</b>, <b>Elbow</b> (right-angle corners) and <b>Curve</b>, each with or without arrowheads. Pick one, then drag on the slide. A plain click drops a default-sized one. <kbd>Shift</kbd> snaps the angle, <kbd>Esc</kbd> cancels.</li>
      <li><b>Glue:</b> drag an end near a shape and small dots appear on its sides. Release on one and the line is glued: when you move the shape, the line follows. Hold <kbd>Alt</kbd> to place an end without gluing. <i>Unglue</i> is in Format.</li>
      <li><b>Handles:</b> a line has two end handles, and elbows and curves have a third handle on the corner that you can slide to change where it turns.</li>
      <li><b>Format &rarr; Line:</b> type (straight, elbow, curve), start and end arrowheads, colour, weight, dashes, and whether an elbow leaves horizontally or vertically.</li></ul>
      <p>PowerPoint exports lines as real connectors, glued to the same shapes.</p>`],

    ['text', 'Text and fonts', 'type', () => `
      <ul><li><b>Format &rarr; Text:</b> font, size, weight, italic, underline, <b>All caps</b>, alignment, line height and letter spacing.</li>
      <li><b>Inline marks</b> in any text: <code>**bold**</code>, <code>*italic*</code>, <code>==highlight==</code> and <code>\`code\`</code>. The ribbon's B, I, highlight and code buttons add them.</li>
      <li><b>Fonts:</b> the menu groups about fifty bundled fonts (Sans, Serif, Display, Script, Mono) that work everywhere, plus your own.</li></ul>
      <h4>Using fonts from your computer</h4>
      <p>Open <b>Settings</b> (the gear) and press <b>Use my fonts</b> (Chrome and Edge). Your browser asks once, then every installed font appears under <i>On this computer</i> in the Font menu. In other browsers, type the font's name in the box under the Font menu instead.</p>
      <p>A font only shows on computers that have it. Anywhere else the text falls back to the theme font. Bundled fonts are open-source and travel with the deck's look. In a PowerPoint export, web fonts become the closest font PowerPoint already has (Inter becomes Arial, Montserrat becomes Century Gothic, Lora becomes Georgia), so the file looks the same on any computer. The export dialog shows the swaps and has a button to keep the original fonts instead.</p>`],

    ['code', 'HTML, CSS and JS slides', 'code', () => `
      <p><b>Design the slide in place:</b> click anything on an HTML slide to select it (Shift-click for several). <b>Drag</b> to move, use the <b>handles</b> to resize, the <b>arrow keys</b> to nudge (Shift for 10 px), <b>Delete</b> to remove and <b>Ctrl+D</b> to duplicate. The <b>Format</b> tab then changes its font, size, bold, italic, underline, alignment, colour, fill, corner radius, border, shadow, opacity and order, or aligns it to the slide. Each change is written as an inline <code>style</code> on that element in the slide's HTML (the Code tab shows it), so it carries into PDF and PowerPoint.</p>
      <p><b>Edit text in place:</b> double-click any text in an HTML slide, type, and press Enter (Esc cancels). With words selected, the ribbon's Bold, Italic, Highlight and Code format just those words. Text that the slide's JavaScript makes has no place in the HTML, so double-clicking it opens the code instead. Things a script moves, rotates or scales can still be moved but not resized. The <b>&lt;/&gt;</b> button on the slide's bar opens the code too.</p>
      <p>For full control, a slide can be code. Select the slide, open the <b>Code</b> tab, and you will find:</p>
      <ul><li><b>Slide HTML, CSS and JavaScript</b> editors. Each has <b>Format</b> (tidies minified or one-line code) and <b>Expand</b> (a large editor). Formatting also runs when code is pasted or applied.</li>
      <li><b>Brand CSS:</b> shared styles for every custom slide in the deck (colours, fonts, logos).</li>
      <li><b>Slide JSON</b>, the rendered HTML, and each editable field's path, which is what an AI works with.</li></ul>
      <p><b>The sandbox:</b> custom slides run in an isolated frame. Your inline JavaScript <i>does</i> run (animations, interactive diagrams). Blocked: external scripts, network calls, nested frames and forms. Pictures and fonts from <code>https:</code> are allowed. Thumbnails and print do not run JavaScript.</p>
      <p>Custom slides export to PowerPoint as editable text and shapes where possible, and as pictures for things PowerPoint cannot draw.</p>`],

    ['ai', 'Working with an AI', 'sparkles', () => `
      ${grid(
        card('In a chat window', '(ChatGPT, Claude, Gemini…) Click <b>AI</b> in the top bar, then <i>Build with AI</i>. Copy the prompt into your chat. The AI answers with a <code>.pitchcraft</code> file or a JSON block: drop it on this page, or use <i>Open</i>.'),
        card('An AI in your browser', '(Comet, Atlas, Claude for Chrome…) Choose <i>AI in your browser</i> and copy the agent prompt. The AI edits this open deck live through the <code>Pitchcraft</code> API, including objects and lines. <b>Ctrl+Z</b> undoes it.')
      )}
      <p>Both use one guide generated from the app, so it always matches this version (${esc(ver())}): <a href="${esc(PC.GUIDE ? PC.GUIDE.pageUrl : '#')}" target="_blank" rel="noopener noreferrer">the Pitchcraft guide for AI assistants</a>. Agents can check their work with <code>await Pitchcraft.auditAll()</code>, which measures every slide, custom ones included, and reports <i>unknown</i> rather than <i>fine</i> if a slide could not be measured.</p>
      <p>Pitchcraft never contacts an AI service itself. Opening a file validates everything: anything invalid is dropped or corrected, and you get a warning.</p>`],

    ['pptximport', 'Open a PowerPoint file', 'folder-open', () => `
      <p>Click <b>Open</b> and choose a <code>.pptx</code> file, or drop one anywhere on the page. Choose <b>Open as the deck</b> or <b>Add slides to this deck</b>.</p>
      <ul><li>Every PowerPoint slide becomes an <b>HTML slide</b>: text, shapes, lines, pictures, tables and simple charts, placed where they were. Double-click text to edit it in place; the <b>Code</b> tab has the HTML and CSS if you want to go further.</li>
      <li>Speaker notes and hidden slides carry across. Theme colours, fonts and bullet styles are resolved for you. Fonts this computer does not have are replaced by a similar one.</li>
      <li>A report tells you what could not be carried over (for example SmartArt, embedded objects, animations, links and videos). The slide itself is never left blank because of one of these.</li>
      <li>It never leaves your browser. Nothing in the file is run: no macros, scripts or links come across, and pictures are re-encoded.</li></ul>
      <p>Round trip: export to PowerPoint, edit there, and open it again here. It will not be pixel-identical, but it is close.</p>`],

    ['export', 'Save and share', 'download', () => `
      <p>Open <b>Save</b> in the ribbon, or press <b>Share</b> to send the deck to someone.</p>
      <ul><li><b>PowerPoint (.pptx):</b> a native file you can edit in PowerPoint, Keynote or Google Slides. Text stays text (a paragraph is one text box), a shape with text is one shape with the text inside it, lines are connectors, speaker notes, hidden slides and transitions carry across. Charts, icons and complex graphics become pictures. It will not be pixel-perfect: web fonts are swapped for similar fonts PowerPoint has (or keep the originals from the export dialog and install them).</li>
      <li><b>PDF:</b> one slide per page (hidden slides skipped), through your browser's print dialog.</li>
      <li><b>.pitchcraft file</b> (<kbd>Ctrl</kbd> <kbd>S</kbd>) or <b>Copy deck JSON:</b> the whole deck as text. Keep it in git, email it, drop it on this page to reopen.</li>
      <li><b>Share:</b> a link that contains the whole deck, so there is no server and nothing is stored. The other person opens the link and gets their own copy (after a question). Decks with pictures stored in them are too big for a link, so Share saves the file and writes a short message to go with it. A link made today is a snapshot: later edits are not in it.</li></ul>`],

    ['safety', 'Undo, backups and recovery', 'refresh', () => `
      <ul><li><b>Undo and redo</b> (<kbd>Ctrl</kbd> <kbd>Z</kbd>, <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Z</kbd>, or the top-bar arrows) step through your edits, typing included.</li>
      <li><b>Whole-deck changes</b> (loading a template, opening a file, an AI replacing the deck) are marked. Undo goes back to your previous deck in one step, and a message with <b>Redo</b> tells you it happened, so one mispress can't lose your work.</li>
      <li><b>Recover an earlier deck</b> (Deck tab) lists the decks that were replaced. Restore one with a click.</li>
      <li><b>Autosave</b> writes to this browser every few seconds. Clearing your browser data removes it, so download a <code>.pitchcraft</code> file for anything important.</li></ul>`],

    ['touch', 'Phone and tablet gestures', 'move', () => `
      <p>Pitchcraft is built to edit with a finger. A one-finger drag scrolls the canvas, so nothing moves by accident.</p>
      <div class="keys gest">
        <span><b>Tap</b></span><span>Select an object. Tap again on text to type. Tap empty space to clear the selection.</span>
        <span><b>Drag</b></span><span>On a <i>selected</i> object: move it. Use the round handles to resize, rotate or reshape a line. Anywhere else: scroll.</span>
        <span><b>Long-press</b></span><span>Start a multi-selection, then tap more objects to add or remove them. Tap <b>Done</b> or empty space to finish.</span>
        <span><b>Pinch</b></span><span>Zoom the canvas. Pinch back to the full slide to snap to <i>Fit</i>.</span>
        <span><b>Two fingers</b></span><span>Pan while zoomed in.</span>
        <span><b>Double-tap</b></span><span>On empty slide space: zoom between <i>Fit</i> and 100%.</span>
        <span><b>Swipe sideways</b></span><span>At <i>Fit</i>, with nothing selected: previous or next slide.</span>
        <span><b>Action bar</b></span><span>Appears at the bottom when something is selected: <i>Type</i>, <i>Copy</i> (duplicate), <i>Delete</i>, <i>Front</i>, <i>Format</i> (opens the inspector), and <i>Done</i> in multi-select.</span>
      </div>
      <p><b>While presenting:</b> swipe left or right for next and previous, or tap the left quarter of the screen for previous and anywhere else for next.</p>`],

    ['settings', 'Settings and appearance', 'settings', () => `
      <p>The gear in the top bar opens <b>Settings</b>.</p>
      <ul><li><b>Colour scheme:</b> <i>Light</i>, <i>Dark</i>, or <i>Auto</i>, which switches to dark from 19:00 to 07:00. Your choice is remembered on this device. Slides keep their own theme: dark mode only changes the editor.</li>
      <li><b>Fonts on this computer:</b> see <i>Text and fonts</i>.</li>
      <li><b>Privacy:</b> turn anonymous analytics on or off, and read the policy (last topic here).</li></ul>`],

    ['keys', 'Keyboard shortcuts', 'terminal', () => keys([
      [['P'], 'Present from the current slide'], [['Ctrl', 'Z'], 'Undo (add <kbd>Shift</kbd> to redo)'], [['Ctrl', 'S'], 'Download the .pitchcraft file'],
      [['Ctrl', 'D'], 'Duplicate the selected object, or the slide'], [['Ctrl', 'C'], 'Copy, then <kbd>Ctrl</kbd> <kbd>V</kbd> to paste objects'], [['Ctrl', 'A'], 'Select all objects on the slide'],
      [['Ctrl', 'G'], 'Group (<kbd>Shift</kbd> to ungroup)'], [['Shift', 'click'], 'Add to or remove from the selection'], [['Alt', 'drag'], 'Move without snapping (lines: without gluing)'],
      [['↑', '↓'], 'Previous or next slide (nudge when an object is selected)'], [['←', '→'], 'Nudge the selected object (<kbd>Shift</kbd> for 10 px)'], [['Delete'], 'Delete the selected object'],
      [['Enter'], 'Finish editing a text field (a new line inside a text box)'], [['Esc'], 'Finish editing, cancel a line, or clear the selection'], [['?'], 'This help'],
      [['→', 'Space'], 'While presenting: next'], [['←'], 'While presenting: previous'], [['N'], 'While presenting: speaker notes'], [['F'], 'While presenting: fullscreen'], [['Esc'], 'While presenting: exit']])
      + '<p class="muted">On a Mac, use <kbd>Cmd</kbd> in place of <kbd>Ctrl</kbd>.</p>'],

    ['faq', 'Questions', 'help', () => [
      faq('What is a .pitchcraft file?', 'Your whole deck as plain JSON text. Save it from the Save menu, open it in any text editor, keep it in git, and drag it onto this page to load it again.'),
      faq('Where is my work saved?', 'Automatically, in this browser only (local storage). Nothing is uploaded. Download a <code>.pitchcraft</code> file to back it up or share it.'),
      faq('Can I move things on a templated slide?', 'Yes. Click a text or card, then drag it. The move is stored on the slide as a small <i>tweak</i>, so the layout keeps working. <i>Reset position</i> undoes it.'),
      faq('What is the difference between Blank, objects and HTML, CSS and JS?', 'Blank slides and objects are drag-and-drop shapes that follow the theme. <b>HTML, CSS and JS</b> is the full-capability route for any layout, brand style, diagram or animation. Templates are the quick route for plain content. You can switch a slide between them.'),
      faq('How do I start a new deck?', 'Click <b>New deck</b> in the ribbon (or the Deck tab). If the current deck has changes you have not downloaded, you are asked whether to download it first, and it is kept under <i>Recover</i>.'),
      faq('Why does my PowerPoint look slightly different?', 'PowerPoint lays text out with its own engine, and the export swaps web fonts for similar ones it has, so line breaks can move a little. If you would rather keep the exact fonts, choose "Keep the original fonts" in the export dialog and install them (they are free Google Fonts). Everything stays editable, so a small nudge is usually all it needs.'),
      faq('Does it work offline?', 'Yes, once loaded. Pictures from web addresses need a connection to show.'),
      faq('Why does an AI need the guide?', 'Pitchcraft only accepts decks in its own format. The guide lists every layout, field and limit, so the AI writes a deck that imports cleanly.')].join('')],

    ['privacy', 'Privacy and cookies', 'shield', () => `<div class="policy">${PC.policyHtml ? PC.policyHtml() : ''}</div><p><button class="btn sm" type="button" data-help-consent>Change my analytics choice</button></p>`]
  ];

  PC.helpDialog = function (topic) {
    let cur = topic && TOPICS.some(t => t[0] === topic) ? topic : 'start';
    const m = UI.modal({
      title: 'How Pitchcraft works', size: 'xl', cls: 'help-modal',
      body: `<div class="help2"><div class="help-nav-wrap"><input class="inp help-q" type="search" placeholder="Search help" aria-label="Search help" autocomplete="off" spellcheck="false"><nav class="help-nav" aria-label="Help topics">${TOPICS.map(([id, t, ic]) => `<button type="button" data-topic="${id}">${icon(ic, 16)}<span>${t}</span></button>`).join('')}</nav></div><div class="help-pane" tabindex="-1" aria-live="polite"></div></div>`,
      footer: `<button class="btn" data-close>Close</button><button class="btn" id="help-ai">${icon('sparkles', 16)} Build with AI</button><button class="btn primary" id="help-tour">${icon('presentation', 16)} Open the product tour</button>`
    });
    const pane = $('.help-pane', m.el), nav = $('.help-nav', m.el), q = $('.help-q', m.el);
    const show = id => {
      const t = TOPICS.find(x => x[0] === id) || TOPICS[0]; cur = t[0];
      pane.innerHTML = `<h3 class="help-h">${esc(t[1])}</h3>${t[3]()}`; pane.scrollTop = 0;
      $$('button', nav).forEach(b => { const on = b.dataset.topic === cur; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    };
    const text = {}; TOPICS.forEach(t => { const d = document.createElement('div'); d.innerHTML = t[3](); text[t[0]] = (t[1] + ' ' + d.textContent).toLowerCase(); });
    q.addEventListener('input', () => {
      const w = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean); let first = null;
      $$('button', nav).forEach(b => { const hit = !w.length || w.every(x => text[b.dataset.topic].includes(x)); b.hidden = !hit; if (hit && !first) first = b.dataset.topic; });
      if (first && $(`button[data-topic="${cur}"]`, nav).hidden) show(first);
      if (w.length && !first) pane.innerHTML = `<p class="muted">Nothing in help matches “${esc(q.value)}”. Try a shorter word.</p>`;
    });
    nav.addEventListener('click', e => { const b = e.target.closest('[data-topic]'); if (b) show(b.dataset.topic); });
    m.el.addEventListener('click', e => { if (e.target.closest('[data-help-consent]')) { m.close(); PC.consent && PC.consent.reset(); } });
    show(cur);
    $('#help-tour', m.el).addEventListener('click', () => { m.close(); PC.loadTemplate('tour'); });
    $('#help-ai', m.el).addEventListener('click', () => { m.close(); PC.ai.dialog(); });
  };
  PC.HELP_TOPICS = TOPICS.map(t => t[0]);
})();
