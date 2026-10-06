# Pitchcraft: guide for AI assistants

Version 3.9.3 · canonical copy: https://visser23.github.io/pitchcraft/ai-guide.md · also inside the app: `Pitchcraft.guide()`

Pitchcraft is a browser presentation studio. A deck is **plain JSON**. You write or edit that JSON, the user opens it in Pitchcraft, edits it visually and presents it. There is no server: everything is validated and rendered in the user's browser. This guide is generated from the same specs the app runs on, so it is always accurate for version 3.9.3.

**Plain-text routes.** If your tool rewrites URLs, equals signs or long output, fetch this guide as plain markdown (https://visser23.github.io/pitchcraft/ai-guide.md) or together with the schema in one file (https://visser23.github.io/pitchcraft/llms-full.txt). In the page, `Pitchcraft.guide(9)` returns one section at a time.

**Three ways to build a slide, and you can mix them in one deck.**

1. **Template layout**: fill in fields such as `headline` and `items`. Fast and consistent. Best for plain text, lists and simple charts (section 4).
2. **Blank layout with objects**: text, shapes, images and icons placed at x/y/w/h (section 6).
3. **Custom slide**: your own HTML, CSS and JavaScript (section 9). This is the full-capability route. It can do any layout, brand styling, diagram, animation or canvas. When the look of a slide matters, write a custom slide.

## 1. Which job are you doing?

1. **You are a chat window** (ChatGPT, Claude, Gemini, Copilot, etc.) and you cannot touch the user's open Pitchcraft. Produce a deck file (section 2) for the user to import. Follow sections 3 to 10.
2. **You are an AI inside the user's browser** (a browser agent or assistant with the Pitchcraft tab open). Edit the live deck with the `Pitchcraft` API (section 11). Read sections 3 to 10 first so your edits are valid.

## 2. Delivering a deck (chat windows)

- Preferred: create a downloadable file named `<deck-name>.pitchcraft` whose entire content is the deck JSON. The user drops it onto Pitchcraft (Open, or drag it anywhere on the page).
- If you cannot create files: reply with the JSON alone in a single ```` ```json ```` code block, with no commentary inside it. The user copies it and uses Open, then pastes it.
- Output valid JSON only: double quotes, no comments, no trailing commas, no `...` placeholders.
- The importer sanitises everything (unknown layouts become "statement", bad colours and URLs are dropped, limits are enforced) and reports warnings. It never runs code from the deck outside a sandbox.

## 3. Deck format

```json
{ "format": "pitchcraft", "version": 3,
  "meta": { "name": "Deck title", "theme": "studio", "numbers": false, "transition": "fade" },
  "slides": [ { "id": "s1", "layout": "title", "...": "layout fields" } ] }
```

- `meta.theme`: one of `studio`, `editorial`, `contrast`, `aurora`, `brutal`. `meta.transition`: `none`, `fade`, `slide`, `zoom`, `rise`, `blur`. `meta.numbers`: show slide numbers. `meta.css`: optional shared CSS for custom slides (section 9).
- Slide fields that every layout accepts: `id` (unique, letters digits `-` `_`), `layout`, `bg` (`""`, `tint`, `dark`, `accent`, `grad`), `tone` (accent colour: `coral`, `amber`, `teal`, `green`, `blue`, `violet`, `pink`), `transition` (per-slide override), `notes` (speaker notes), `fill` (custom background colour), `bgImage` (https or `data:image/...` picture behind everything), `objects` (section 6), `tweaks` (section 7).
- Limits: 120 objects per slide, 200 slides per deck, 20000 characters per text object, 300000 characters per custom html/css/js field.

### Themes

- `studio`: Studio. Clean and confident. Bricolage Grotesque headlines.
- `editorial`: Editorial. Instrument Serif on warm paper. Reads like a magazine.
- `contrast`: Contrast. Loud, dark and uppercase. Syne headlines. (dark theme)
- `aurora`: Aurora. Deep gradients and glass cards. (dark theme)
- `brutal`: Brutalist. Hard borders, hard shadows, no apologies.

## 4. Layouts

Every slide has exactly one `layout`. Pick the layout whose fields match your content. Fields not listed for a layout are ignored.

### Free-form

- `blank`: Blank. An empty canvas. Add text, images and shapes anywhere. Fields: objects:[{id,type:"text"|"shape"|"image"|"icon",x,y,w,h?,...}] - the whole slide is free-form objects on the 1280x720 stage (see "Free-form objects" in the AI guide). No kicker/headline/body.

### Story

- `title`: Title. Big opening statement. Fields: kicker, headline, body
- `statement`: Statement. One idea, centred. Fields: kicker, headline, body
- `section`: Section. Chapter divider with a huge number. Fields: kicker (the number, e.g. "02"), headline, body
- `quote`: Quote. A pull quote with attribution. Fields: headline (the quote), body (who said it)
- `closing`: Closing. Final call to action. Fields: kicker, headline, body, items:[{icon?,label,value}]

### Data

- `metrics`: Metrics. Big-number KPI cards. Fields: kicker, headline, items:[{value,label,trend:"up"|"down"?,note?}] (2-4 items)
- `chart`: Chart. Bar, line, area or donut with insight. Fields: kicker, headline, body (insight), chartType:"bar"|"hbar"|"line"|"area"|"donut", chartData:{labels:[],series:[{name,values:[]}]} or {segments:[{label,value}],centerLabel?,centerSub?}, items?:[{value,label}] callouts
- `demo`: Data → slide. Shows the JSON next to what it renders. Fields: same fields as chart; the code panel is generated from chartData
- `table`: Table. Reference table. Fields: kicker, headline, tableData:{headers:[],rows:[[]]}

### Structure

- `split`: Split. Two big ideas side by side. Fields: kicker, headline, columns:[{icon?,headline,body}] (2-3)
- `cards`: Cards. Three or four icon cards. Fields: kicker, headline, items:[{icon,title,body}] (3-4)
- `comparison`: Comparison. Before / after, us / them. Fields: kicker, headline, columns:[{headline,body,items:["line",…]}] (exactly 2; first is the "old", second the "new")
- `bullets`: Bullets. Numbered points beside a headline. Fields: kicker, headline, body, items:[{title,body}] (3-5)
- `process`: Process. Steps left to right. Fields: kicker, headline, items:[{step?,icon?,title,body}] (3-5)
- `timeline`: Timeline. Milestones along a line. Fields: kicker, headline, items:[{date,title,body,status:"done"|"now"|"next"?}] (3-5)
- `flow`: Flow diagram. Inputs → hub → outputs. Fields: kicker, headline, items:[{col:"in"|"hub"|"out",icon,title,body}] (1-3 "in", exactly 1 "hub", 1-3 "out")

### Visual

- `bento`: Bento. Mixed-size tile grid. Fields: kicker, headline, items:[{size:"s"|"w"|"t"|"l",tone?,icon?,title,value?,body?}] (aim for tiles that fill a 4x3 grid: e.g. one "l", one "w" and six "s")
- `anatomy`: Editor anatomy. Annotated diagram of the editor. Fields: kicker, headline, body, items:[{title,body}] (up to 5; numbered hotspots on a drawing of the editor)
- `themes`: Themes. Live previews of the built-in themes. Fields: kicker, headline, items:[{theme:"studio"|"editorial"|"contrast"|"aurora"|"brutal",title,body}]
- `code`: Code. Syntax-highlighted window. Fields: kicker, headline, body, code:{language:"json"|"js"|"html"|"css"|"bash",filename?,source}
- `image`: Image. Picture beside text. Fields: kicker, headline, body, image:{src (https URL or data URI),alt}

### Custom

- `custom`: HTML, CSS and JS. Write the slide as code: any layout, brand style or animation. Fields: headline (a NAME only, not drawn), custom:{html,css?,js?,base?,interactive?}. html is the whole 1280x720 slide: write anything. See "Custom layout" in the AI guide.

Icon names (for `icon` fields and icon objects): `bolt`, `layers`, `sparkles`, `chart`, `lock`, `globe`, `wand`, `cursor`, `clock`, `check`, `users`, `user`, `target`, `rocket`, `shield`, `cpu`, `box`, `link`, `star`, `type`, `image`, `table`, `pie`, `terminal`, `flag`, `presentation`, `heart`, `key`, `puzzle`, `git`, `compass`, `mail`, `feather`, `gauge`, `edit`, `tag`, `map`, `file`, `code`, `download`, `upload`, `eye`, `palette`, `grid`, `play`

### Text markup (every text field, including text in objects)

`**bold**`, `*italic*`, `==accent highlight==` and `` `code` ``. Use `==highlight==` on one or two words of a headline. Line breaks inside free-form text objects are kept; generated fields are single-line.

## 5. Choosing between template, free-form and custom

Decide per slide. The three routes mix freely, so a deck can be mostly templates with a few custom slides, or custom all the way through.

- **Custom slide** (section 9): your own HTML, CSS and JavaScript. Use it whenever the design matters: a brand look, a diagram, a timeline, a chart that is not one of the built-in types, an animation, a canvas, an interactive demo. There is no layout it cannot produce. If the user supplied a brand guide, build in custom slides and put the shared styling in `meta.css`. Custom slides cost more effort to write, and they are edited as code rather than field by field.
- **Template layouts** (section 4): plain text, lists, simple charts, tables. They adapt to every theme and the user can edit them field by field without touching code. Use them for slides where the content matters more than the layout.
- **Blank layout + objects** (section 6): precise placement without code. Good for a big number, a logo, photos, callouts and simple diagrams built from shapes.
- **Objects on top of a template slide**: any layout accepts `objects`; they float above the layout. Good for a logo, a sticker, an annotation.

If the user said nothing about style, a good default is templates for the plain slides and custom slides for the two or three that carry the story.

## 6. Free-form objects

`objects` is an array, drawn in order: later items are on top. The stage is **1280 wide, 720 tall**, origin top-left, all units are pixels, `rot` is degrees clockwise. Maximum 120 objects per slide.

Common fields: `id` (unique on the slide; generated if you omit it), `type`, `x`, `y`, `w`, `h` (optional for text: it grows with its content), `rot`, `opacity` (0 to 1), `shadow` (true), `name` (label shown in the editor's layers list), `flipH` / `flipV` (mirror), `locked` (the editor will not move or edit it), `group` (objects sharing a group id select and move together), `link` (`https://`, `mailto:` or `#slide-id`, followed when presenting), `alt` (alternative text for shapes, icons and lines).

A slide can also be hidden from the presentation with `"hidden": true` (it stays in the editor and is skipped when presenting and exporting to PDF).

| type | extra fields |
|---|---|
| `text` | `text`, `font`, `size` (px), `weight` (100 to 900), `italic`, `underline`, `caps` (uppercase), `align` (left, center, right, justify), `valign` (top, middle, bottom; only when `h` is set), `color`, `lh` (line height multiple), `ls` (letter spacing in em) |
| `shape` | `shape`, `fill`, `fill2` + `gradAngle` (a two-colour gradient), `stroke`, `strokeW`, `dash` (solid, dashed, dotted), `radius` (rect only), and all the text fields above for text inside the shape. Put a label in the shape's own `text`; do not lay a separate text object over it |
| `line` | `kind` (`straight`, `elbow` for right-angle corners, `curve`), `stroke`, `strokeW`, `dash`, `arrowStart` / `arrowEnd` (`none`, `triangle`, `stealth`, `open`, `dot`, `diamond`), `vert` (elbow and curve leave vertically instead of horizontally), `bend` (0.05 to 0.95: where the middle run sits), `from` / `to` (glue an end to another object: `"objectId:t"`, `:r`, `:b` or `:l`; the line follows when that object moves). The start is the top-left of the box and the end the bottom-right, unless `flipH` / `flipV` mirror it |
| `image` | `src` (https URL or `data:image/...`), `alt` (always write it), `fit` (cover, contain, fill), `radius`, `stroke`, `strokeW` |
| `icon` | `icon` (name from the list in section 4), `color` |

Shapes: `rect` (Rectangle), `round` (Rounded rectangle), `ellipse` (Ellipse), `triangle` (Triangle), `diamond` (Diamond), `hexagon` (Hexagon), `star` (Star), `arrow` (Right arrow), `chevron` (Chevron), `arrowleft` (Left arrow), `arrowup` (Up arrow), `arrowdown` (Down arrow), `arrowboth` (Left-right arrow), `pentagon` (Pentagon), `octagon` (Octagon), `parallelogram` (Parallelogram), `trapezoid` (Trapezoid), `plus` (Cross), `callout` (Speech bubble), `donut` (Ring), `cylinder` (Cylinder), `heart` (Heart), `line` (Line (old)), `connector` (Arrow line (old)). For a diagram, glue connectors to boxes with `from` / `to` rather than guessing coordinates: `{ "type": "line", "kind": "elbow", "from": "a:r", "to": "b:l", "arrowEnd": "triangle", "stroke": "var(--muted)", "strokeW": 3 }`. Their `x`, `y`, `w`, `h` are recomputed from the glue.

Fonts (`font`): `body` (Theme body), `display` (Theme heading), `inter` (Inter), `bricolage` (Bricolage Grotesque), `serif` (Instrument Serif), `syne` (Syne), `mono` (JetBrains Mono), `arial` (Arial), `georgia` (Georgia), `times` (Times New Roman), `verdana` (Verdana), `trebuchet` (Trebuchet MS), `courier` (Courier New), `dmsans` (DM Sans), `manrope` (Manrope), `plusjakartasans` (Plus Jakarta Sans), `spacegrotesk` (Space Grotesk), `outfit` (Outfit), `montserrat` (Montserrat), `worksans` (Work Sans), `sora` (Sora), `figtree` (Figtree), `urbanist` (Urbanist), `poppins` (Poppins), `raleway` (Raleway), `nunito` (Nunito), `lato` (Lato), `rubik` (Rubik), `archivo` (Archivo), `epilogue` (Epilogue), `ibmplexsans` (IBM Plex Sans), `josefinsans` (Josefin Sans), `quicksand` (Quicksand), `cabin` (Cabin), `playfairdisplay` (Playfair Display), `lora` (Lora), `fraunces` (Fraunces), `sourceserif4` (Source Serif 4), `cormorantgaramond` (Cormorant Garamond), `librebaskerville` (Libre Baskerville), `dmserifdisplay` (DM Serif Display), `oswald` (Oswald), `anton` (Anton), `bebasneue` (Bebas Neue), `abrilfatface` (Abril Fatface), `pacifico` (Pacifico), `lobster` (Lobster), `caveat` (Caveat), `spacemono` (Space Mono), `ibmplexmono` (IBM Plex Mono), `firacode` (Fira Code), `inconsolata` (Inconsolata). Any other plain family name (letters, digits, spaces and `- . _ & +`) also works but only renders if installed on the viewer's machine, so prefer the keys. They are all bundled and load on demand.

Colours (`color`, `fill`, `stroke`): hex (`#1a1a2e`), `rgb()`/`rgba()`, a plain colour name, or a **theme token** that follows the deck theme and the slide background. Prefer tokens so the slide survives a theme change: `var(--fg)` text, `var(--muted)` muted text, `var(--shape)` accent, `var(--on-shape)` on accent, `var(--card)` card, `var(--slide-bg)` background, `#ffffff` white, `#000000` black, `var(--c1)` palette 1, `var(--c2)` palette 2, `var(--c3)` palette 3, `var(--c4)` palette 4, `var(--c5)` palette 5, `var(--c6)` palette 6.

Defaults when a field is omitted:

- `text`: w 520, size 36, weight 400, font "body", align "left", valign "top", color "var(--fg)", lh 1.25, ls 0
- `shape`: w 260, h 160, shape "rect", fill "var(--shape)", stroke "", strokeW 0, radius 0, dash "solid", size 28, weight 600, font "body", align "center", valign "middle", color "var(--on-shape)", lh 1.2, ls 0
- `image`: w 480, h 320, fit "cover", radius 0, stroke "", strokeW 0
- `icon`: w 96, h 96, color "var(--shape)"
- `line`: w 320, h 0, kind "straight", stroke "var(--shape)", strokeW 5, dash "solid", arrowStart "none", arrowEnd "none", bend 0.5

Rules for good free-form slides:
- Keep everything inside the safe area: x from 74 to 1205, y from 40 to 668, unless it is a deliberate full-bleed shape or image.
- Body text at least 26 px; nothing under 22 px except small captions. Headlines 56 to 88 px, weight 700, `font: "display"`.
- Text needs contrast against what is behind it (4.5:1). On a coloured shape use `var(--on-shape)`; on the slide use `var(--fg)`.
- Align objects to a grid (multiples of 8) and reuse the same left margin. Give a text object enough `w` for its longest line; it wraps inside `w`.
- Do not stack text boxes on top of each other unless it is deliberate.

## 7. Tweaks: moving and restyling a template slide's own elements

Every editable text in a template slide has a path (`headline`, `body`, `kicker`, `items.1.title`) and every card or row has an item key (`items.1`). `tweaks` nudges or restyles them without leaving the layout:

```json
"tweaks": { "headline": { "dx": 40, "dy": -20, "size": 96, "color": "var(--shape)" }, "items.1": { "dx": 0, "dy": 24 } }
```

`dx` and `dy` are pixel offsets. Text fields also accept `font`, `size`, `weight`, `italic`, `underline`, `caps`, `align`, `color`, `lh`, `ls`. Tweaks are optional: do not add them unless the user asks for a specific move or restyle.

## 8. Design rules

- 8 to 14 slides for a full deck. Start with a `title` slide, end with a `closing` slide.
- One idea per slide. Headlines under 9 words. Body text under 30 words. Cards and rows: short phrases.
- Use varied layouts: never the same layout twice in a row. Alternate `bg` (`dark`, `accent`, `tint`) every few slides for rhythm.
- Never invent facts, numbers, quotes or logos. If data is unknown, write `[NEEDS EVIDENCE]` or label the kicker "Sample data".
- Choose a theme that fits the tone of the brief; do not mix `bg` and `fill` on the same slide (`bg` wins).
- Write speaker notes (`notes`) when the user will be presenting.

### Writing style

Slides are read in seconds, so weak writing shows. Write the way a knowledgeable person who has one point to make would write it.

- State the point first. No scene-setting ("In today's fast-moving world"), no announcing ("Let's break this down"), no "In summary" or "The bottom line" slide unless the content needs one.
- Plain words. Use "use" and not "leverage"; avoid "unlock", "seamless", "robust", "powerful", "game-changing", "holistic", "journey", "landscape", "ecosystem", "tangible value", "actionable insights".
- Say what happens. Name who does what ("The team reviews each order") and avoid abstract nouns such as "alignment", "capability", "transformation" and "outcomes".
- No "not X but Y" or "it's not just X, it's Y". No rhetorical question followed by its answer. No dramatic fragments ("The result? Chaos.").
- Do not group everything in threes. Use as many points as the subject has. Do not invent frameworks, pillars or named models.
- Few em dashes. Use commas, colons, brackets or a new sentence.
- Do not overclaim. Skip "crucially", "importantly", "ultimately", and superlatives you cannot back up. Give a number or a source, or leave the claim out.
- Do not attribute feelings to the audience ("You may be wondering"), and do not reassure, cheer or sell. No exclamation marks.
- Do not end with a slogan, a call to embrace change or "Now is the time to". End on the actual next step or decision.
- Vary the length of bullets and sentences. A slide where every bullet is a bold label, a colon and eight words reads as machine output.

## 9. Custom layout (HTML, CSS, JavaScript)

```json
{ "id": "s5", "layout": "custom", "headline": "short name", "custom": { "html": "...", "css": "...", "js": "...", "interactive": false } }
```

- `custom.html` is the whole 1280 x 720 slide body (no `<html>`, `<head>` or `<script>`). The root is an empty `position:relative; overflow:hidden` box: use absolute positioning, grid, flex, inline SVG or canvas.
- It runs in a sandboxed iframe with no access to the editor, storage or network. Your inline `js` runs. What is blocked: external scripts (`<script src>`), iframes, forms, `fetch` and other network calls, and storage. Images and fonts: `data:` URIs always work; `https:` images and fonts load but may fail offline, so embed brand assets.
- Theme variables are available: `var(--fg)`, `var(--muted)`, `var(--acc)`, `var(--on-acc)`, `var(--slide-bg)`, `var(--card)`, `var(--line)`, `var(--radius)`, `var(--shadow)`, `var(--c1)` to `var(--c6)`, `var(--font-d)`, `var(--font-b)`, `var(--f-mono)`. Helper classes: `.kicker`, `.display`, `.h2`, `.lead`, `mark.hl`, `.rv` (fades up when presenting).
- Shared brand CSS (colours, `@font-face`, logo classes) belongs in `meta.css`, not in each slide.
- Set `interactive: true` only if the slide has buttons or inputs.
- **The user can design your slide by hand.** In the editor they click any element of your HTML and move it, resize it, restyle it (font, size, bold, italic, colour, fill, border, shadow, opacity, order) or retype its words. Each change is saved as an **inline `style`** on that element (`translate` or `left`/`top`, `width`/`height`, `color`, `font-*`, `background-color` ...), so when you are later asked to edit the slide, read the `style` attributes and keep them. To make your slide pleasant to edit, build it from real elements: give the main blocks an `id` or a meaningful `class`, put each text in its own element (`h1`, `p`, `div`), prefer absolute or flex/grid layout over text tricks, and put repeated styling in `css` or `meta.css` rather than relying on `js` to restyle things. Elements a script creates have no place in the HTML, so they cannot be selected (their container can).
- **Thumbnails and PDF export do not run `js`.** They draw the slide from html + css, so it must look complete before `js` runs. If something only appears after `js` runs (a canvas, ripples, counters), the sidebar thumbnail will not show it. That is expected.
- Keep every important element 60 px from the edges, text at least 22 px, respect `prefers-reduced-motion`.

### Text width: theme fonts are wide

Headline fonts differ a lot. The Contrast theme sets headlines in uppercase Syne ExtraBold, roughly twice the width of Editorial's serif. Do not assume a character is half its font size. Estimate with these averages (em per character, measured on mixed English text; multiply by the font size in px to get the width of one character):

| theme | headline font | em per character, headline | em per character, body |
|---|---|---|---|
| `studio` | Bricolage Grotesque | 0.47 | 0.48 |
| `editorial` | Instrument Serif | 0.33 | 0.48 |
| `contrast` | Syne, UPPERCASE | 1.01 | 0.48 |
| `aurora` | Bricolage Grotesque | 0.47 | 0.48 |
| `brutal` | Syne | 0.77 | 0.48 |

Characters per line is about `box width / (font size x em)`. Example: a 900 px box at 64 px in Contrast fits about 900 / (64 x 1.01) = 13 characters per line; in Editorial it fits about 42. Size from the widest theme the deck might use, or measure: `Pitchcraft.measureText("Quarterly results", { font: "display", size: 72, w: 900 })` returns the real width, height and line count in the current theme. Long words never wrap, so check the longest word.

### Checking a custom slide

`Pitchcraft.audit()` cannot see inside a custom slide (the slide is a sandboxed iframe), so it returns `checked: false` for those. Use `await Pitchcraft.auditAll()`: it runs each custom slide in a hidden sandbox, waits for its `js` and fonts, and measures the rendered text. It reports `text-off-slide`, `outside-safe-area`, `clipped` (hidden by an `overflow:hidden` container), `text-wider-than-box`, `text-overlap` and `script-error`. It checks text only: it cannot judge colour contrast, images or canvas drawings, so still look at a screenshot when you can.

### Writing a custom slide without a file (browser AIs)

```js
Pitchcraft.addCustomSlide({
  html: '<div class="wrap"><h1>Hello</h1><canvas id="c" width="600" height="300"></canvas></div>',
  css: '.wrap{position:absolute;inset:0;padding:90px} h1{font:800 96px var(--font-d);margin:0}',
  js: 'const c=document.getElementById("c").getContext("2d"); c.fillStyle="#5b4bff"; c.fillRect(0,0,300,150);',
  interactive: false
}, undefined, "Hello");                       // returns the slide index
Pitchcraft.setCustom(2, { css: "h1{color:var(--acc)}" });   // patch one field later
Pitchcraft.setMeta({ css: "@font-face{...} .logo{...}" });   // brand CSS shared by every custom slide
```

The machine-readable description of all of this is the JSON Schema: `Pitchcraft.schema()`, or https://visser23.github.io/pitchcraft/pitchcraft.schema.json.

## 10. Worked example

This deck is validated against the importer when the guide is built.

```json
{
  "format": "pitchcraft",
  "version": 3,
  "meta": {
    "name": "Quarterly review",
    "theme": "studio",
    "numbers": false,
    "transition": "fade"
  },
  "slides": [
    {
      "id": "s1",
      "layout": "title",
      "kicker": "Q3 review",
      "headline": "Growth, **on purpose**",
      "body": "What worked, what did not, and what we do next",
      "notes": "Open with the headline number."
    },
    {
      "id": "s2",
      "layout": "blank",
      "notes": "One big number, placed by hand.",
      "objects": [
        {
          "id": "label",
          "type": "text",
          "x": 80,
          "y": 90,
          "w": 700,
          "text": "Revenue growth",
          "size": 28,
          "weight": 700,
          "caps": true,
          "ls": 0.08,
          "color": "var(--shape)"
        },
        {
          "id": "big",
          "type": "text",
          "x": 80,
          "y": 150,
          "w": 720,
          "text": "**42%**",
          "size": 220,
          "weight": 800,
          "font": "display",
          "lh": 1
        },
        {
          "id": "card",
          "type": "shape",
          "shape": "round",
          "x": 820,
          "y": 150,
          "w": 380,
          "h": 300,
          "fill": "var(--shape)",
          "text": "Sample data: replace with your number",
          "size": 30,
          "color": "var(--on-shape)"
        },
        {
          "id": "rule",
          "type": "shape",
          "shape": "line",
          "x": 80,
          "y": 520,
          "w": 1120,
          "h": 14,
          "stroke": "var(--muted)",
          "strokeW": 3
        },
        {
          "id": "note",
          "type": "text",
          "x": 80,
          "y": 560,
          "w": 1000,
          "text": "Quarter on quarter, all regions. Source: [NEEDS EVIDENCE]",
          "size": 26,
          "color": "var(--muted)"
        }
      ]
    },
    {
      "id": "s3",
      "layout": "closing",
      "kicker": "Next",
      "headline": "Three bets for Q4",
      "body": "We will know by December.",
      "tweaks": {
        "headline": {
          "dy": -10
        }
      }
    }
  ]
}
```

## 11. Editing the live deck in the browser (browser AIs)

When Pitchcraft is open in the tab you control, use the global `Pitchcraft` object (for example through the page's JavaScript console). There is no separate "AI import" button because you do not need one: `Pitchcraft.importText(json)` loads a whole deck, `Pitchcraft.addCustomSlide(...)` adds an HTML/CSS/JS slide, and `Pitchcraft.schema()` / `Pitchcraft.manifest()` describe everything. (Humans use the AI button, then Import.) Every call is validated and **undoable** (the user can press Ctrl+Z). `ref` is a slide id (`"s3"`) or a 0-based index.

**Read**

- `Pitchcraft.guide(section?)`: The complete AI guide as markdown (this document). Pass a section number such as 9, or a word from its heading, to get just that part. Read it before editing.
- `Pitchcraft.manifest()`: JSON: version, guide URL, every method below, layouts, themes, object types, limits.
- `Pitchcraft.getDeck()`: Copy of the whole deck JSON.
- `Pitchcraft.getSlide(ref)`: Copy of one slide. ref = slide id ("s3") or 0-based index.
- `Pitchcraft.getObjects(ref)`: Copy of the free-form objects on a slide.
- `Pitchcraft.html(ref)`: The rendered HTML of one slide (what the DOM contains).
- `Pitchcraft.prettyHtml(ref)`: The same, indented for reading.
- `Pitchcraft.exportPptx()`: Async. Builds a native PowerPoint file from the deck and returns { filename, base64, report } (report lists slides, pictures, fonts and warnings). Text stays editable text; shapes stay shapes. Does not download anything; save the base64 yourself.
- `Pitchcraft.exportJSON()`: The deck as a JSON string, exactly what a .pitchcraft file contains.
- `Pitchcraft.audit(deck?)`: Fast layout audit of templated and blank slides: finds text that clips or leaves the safe area. Returns one entry per slide with a problems list. It cannot see inside custom slides: those come back with status "unknown", checked:false and problems:null (never an empty list that looks clean). Use auditAll() for them.
- `Pitchcraft.auditAll(deck?)`: Async. Everything audit() does, plus it runs each custom slide in a hidden sandbox and measures the rendered text: text off the slide, outside the safe area, clipped by its container, overlapping other text, short labels that wrap (label-wraps), text that straddles a box edge (text-crosses-edge) and text jammed against its box (text-cramped). Each entry has status "clean", "issues" or "unknown". The first measurement is retried once with more time. Await it.
- `Pitchcraft.measureText(text, opts?)`: Measure text before you place it. opts {font "display"|"body"|"mono"|a CSS family, size (px, default 28), weight, caps, ls, lh, w (box width px)}. Returns {width, height, lines, em}: width of the longest line, height at the wrapped width, and the average em per character in this theme.
- `Pitchcraft.current()`: Index of the selected slide.
- `Pitchcraft.count()`: Number of slides.
- `Pitchcraft.schema()`: JSON Schema (draft 2020-12) of a deck, including slide custom {html, css, js}, objects and tweaks. Also published as pitchcraft.schema.json.

**Deck**

- `Pitchcraft.shareLink()`: Async. A link that contains this whole deck (nothing is uploaded). Returns the URL, or an empty string when the deck is too big for a link: use exportJSON() or save the file instead.
- `Pitchcraft.setDeck(deckOrJson)`: Replace the whole deck (object or JSON string). Returns {slides, warnings}. Undoable. The deck it replaced is kept in backups().
- `Pitchcraft.backups()`: The last few decks that were replaced or undone away: [{index, title, slides, reason, t}]. They survive a reload.
- `Pitchcraft.restoreBackup(index)`: Put one of those decks back. Undoable. Returns true on success.
- `Pitchcraft.importPptx(base64OrBytes, mode?, name?)`: Async. Open a PowerPoint (.pptx) file as HTML slides. data = base64 string or Uint8Array; mode "replace" (default) or "append". Every slide becomes a custom HTML slide (text, shapes, pictures, tables and simple charts positioned on the 1280x720 stage). Returns {deck, warnings, report}; warnings list what could not be carried over.
- `Pitchcraft.importText(text, mode?)`: Open deck JSON text (what the Open dialog does with pasted or dropped text). mode "replace" (default) or "append". Returns {deck, warnings}.
- `Pitchcraft.setMeta(patch)`: Patch deck meta: {name, theme, numbers, transition, css}.
- `Pitchcraft.setTheme(theme)`: Set the deck theme key.
- `Pitchcraft.newDeck()`: Replace the deck with a fresh one-slide deck (the starter). Undoable. The New deck button asks the user to save first; this call does not.
- `Pitchcraft.loadTemplate(id)`: Load a built-in template deck (for example "tour").

**Slides**

- `Pitchcraft.addSlide(layout, at?)`: Insert a slide with a layout key at an index. Returns its index. Use "blank" for a free-form slide.
- `Pitchcraft.removeSlide(ref)`: Delete a slide.
- `Pitchcraft.duplicateSlide(ref)`: Duplicate a slide.
- `Pitchcraft.moveSlide(from, to)`: Reorder slides.
- `Pitchcraft.updateSlide(ref, patch)`: Shallow-merge a patch into a slide (validated). Returns the slide.
- `Pitchcraft.setPath(ref, path, value)`: Set one nested field, for example setPath("s2", "items.0.value", "42").
- `Pitchcraft.setLayout(ref, layout)`: Change a slide layout, keeping compatible content. To blank converts the text to text boxes.
- `Pitchcraft.addCustomSlide(custom, at?, name?)`: Add a free-form HTML/CSS/JS slide in one call. custom = {html, css, js, interactive}. Returns its index. See section 9 of the guide.
- `Pitchcraft.setCustom(ref, patch)`: Patch the html, css, js or interactive flag of a custom slide (converts the slide to custom first if it is not one). Returns the slide.
- `Pitchcraft.goTo(ref)`: Select and scroll to a slide.

**Objects**

- `Pitchcraft.addObject(ref, object)`: Add a free-form object (text, shape, image or icon) to any slide. Returns the cleaned object with its id. Sits on top of the stack.
- `Pitchcraft.updateObject(ref, id, patch)`: Patch an object. A null value removes a property. Returns the cleaned object.
- `Pitchcraft.removeObject(ref, id)`: Delete an object. Returns true. Throws (listing the existing ids) if the id is not on that slide.
- `Pitchcraft.setTweak(ref, key, patch)`: Move or restyle a text field or card that a template layout generated. key = data-path ("headline") or list item ("items.1"). A patch of null resets it.

**Present**

- `Pitchcraft.preparePrint()`: Builds the print layout (one page per slide) that the PDF button uses. Rarely needed by an AI.
- `Pitchcraft.present(from?)`: Start presenting from a slide index.
- `Pitchcraft.closePresent()`: Stop presenting.
- `Pitchcraft.isPresenting()`: True while presenting.

**History**

- `Pitchcraft.undo()`: Undo the last change.
- `Pitchcraft.redo()`: Redo.

Workflow:
1. `Pitchcraft.guide()` (this document; `Pitchcraft.guide(9)` for one section) and `Pitchcraft.getDeck()` to understand the current state. If your tool mangles URLs or equals signs in long output, use the plain-text copies named at the top of this guide.
2. Make the smallest change that does what was asked. Prefer `updateObject`, `setPath`, `setCustom` and `setTweak` over replacing whole slides.
3. `await Pitchcraft.auditAll()` afterwards: every slide's `problems` list should be empty and `checked` should be `true`. Fix what it reports. `Pitchcraft.audit()` is the instant version and marks custom slides `checked: false`.
4. Stop when the slide visibly updates. Do not reload the page (unsaved work lives in the tab and autosaves locally).

Direct DOM route (read-only, useful for finding things): every slide is `<section data-slide-id="s1" data-layout="title">`; every editable text has `data-path`; free-form objects are `.ob[data-obj="<id>"]`. Custom slides render in a sandboxed iframe, so edit their `custom.html`/`custom.css`/`custom.js` strings instead.

Examples:

```js
Pitchcraft.addSlide("blank");                                    // returns the new index
Pitchcraft.addObject(2, { type: "text", text: "Q3 results", x: 80, y: 80, w: 900, size: 72, weight: 700, font: "display" });
Pitchcraft.addObject(2, { type: "shape", shape: "round", x: 80, y: 260, w: 360, h: 200, fill: "var(--shape)", text: "**42%** growth", color: "var(--on-shape)" });
Pitchcraft.updateObject(2, "o1", { x: 120, size: 64 });
Pitchcraft.setTweak("s1", "headline", { dx: 0, dy: -30, size: 88 });
Pitchcraft.setPath("s3", "items.0.value", "42");
```

## 12. Checklist before you answer

- Valid JSON, `format: "pitchcraft"`, `version: 3`, unique slide ids.
- Every `layout` is one of: `blank`, `title`, `statement`, `section`, `quote`, `closing`, `metrics`, `chart`, `demo`, `table`, `split`, `cards`, `comparison`, `bullets`, `process`, `timeline`, `flow`, `bento`, `anatomy`, `themes`, `code`, `custom`, `image`.
- Every icon name is from the list; every object has a `type`; image objects have `alt`.
- Nothing invented; headings short; contrast good; safe area respected; text sized for the theme's font width (section 9).
- Writing follows the style notes in section 8: plain words, the point first, no slogans.
- Browser AIs: `await Pitchcraft.auditAll()` shows no problems and every slide `checked: true`.
- Delivered as a `.pitchcraft` file, or one JSON code block if files are impossible.
