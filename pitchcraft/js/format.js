/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT format panel — the inspector's "Format" tab (what the old Content tab turned into).
   It follows the selection on the canvas:
     · nothing selected      → how to use the canvas + Insert shortcuts
     · object(s)             → position/size/rotation, text, shape, image, icon, arrange
     · generated text field  → font, size, colour... (stored as slide.tweaks) + reset
     · generated card / row  → that item's fields, reorder/duplicate/delete, reset position
   All edits go through PC.stage.patch / the store, so they are undoable and sanitised.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, S = PC.store, UI = PC.ui, E = PC.editor, Ins = PC.inspector, St = PC.stage, { $, $$ } = UI, esc = PC.esc, icon = PC.icon;
const F = PC.format = {};
const fid = () => PC.uid('ff');

/* ── control builders ── */
const num = (label, prop, val, o = {}) => { const id = fid(); return `<div class="field fnum"><label for="${id}">${esc(label)}</label><input class="inp" id="${id}" type="number" inputmode="decimal" data-fmt="${prop}" data-fs="n:${prop}" value="${val == null || val === '' ? '' : esc(String(Math.round(val * 100) / 100))}" step="${o.step || 1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}></div>`; };
const select = (label, prop, val, opts, o = {}) => { const id = fid(); return `<div class="field"><label for="${id}">${esc(label)}</label><select class="sel" style="width:100%" id="${id}" data-fmt-sel="${prop}" data-fs="s:${prop}">${o.groups ? Object.entries(opts).map(([g, m]) => `<optgroup label="${esc(g)}">${Object.entries(m).map(([k, v]) => `<option value="${esc(k)}"${String(val ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</optgroup>`).join('') : Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}"${String(val ?? '') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`; };
const toggle = (label, prop, on, glyph, cls) => `<button type="button" class="tg${on ? ' on' : ''}" data-fmt-toggle="${prop}" data-fs="t:${prop}" aria-pressed="${!!on}" aria-label="${esc(label)}" title="${esc(label)}"><span class="${cls || ''}">${glyph}</span></button>`;
const segBtns = (prop, val, opts) => `<div class="seg" role="group" aria-label="${esc(prop)}">${Object.entries(opts).map(([k, v]) => `<button type="button" data-fmt-set="${prop}" data-v="${k}" data-fs="g:${prop}:${k}" class="${String(val) === k ? 'on' : ''}" aria-pressed="${String(val) === k}">${v}</button>`).join('')}</div>`;
const sec = (title, body, hint) => `<div class="ins-sec"><h4>${esc(title)}${hint ? ` <span class="hint">${esc(hint)}</span>` : ''}</h4>${body}</div>`;

/** A colour picker: theme-aware swatches (resolved against the slide's own theme), "none", and any custom colour. */
function colorField(label, prop, val, o = {}) {
  const fr = E.frameEl(S.sel), slide = fr && $('.slide', fr), cs = slide ? getComputedStyle(slide) : null, cur = String(val || '');
  const sw = PC.COLOR_TOKENS.map(([v, name]) => {
    const css = v.startsWith('var(') && cs ? (cs.getPropertyValue(v.slice(4, -1)).trim() || '#888') : v;
    return `<button type="button" class="swatch${cur === v ? ' on' : ''}" data-fmt-color="${prop}" data-v="${esc(v)}" data-fs="c:${prop}:${v}" style="background:${esc(css)}" title="${esc(name)}" aria-label="${esc(label)}: ${esc(name)}" aria-pressed="${cur === v}"></button>`;
  }).join('');
  const hex = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#5b4bff', custom = cur && !PC.COLOR_TOKENS.some(([v]) => v === cur);
  return `<div class="field"><span class="lbl">${esc(label)}</span><div class="swatches" role="group" aria-label="${esc(label)}">${o.none ? `<button type="button" class="swatch none${!cur ? ' on' : ''}" data-fmt-color="${prop}" data-v="" data-fs="c:${prop}:none" title="None" aria-label="${esc(label)}: none" aria-pressed="${!cur}"></button>` : ''}${sw}<label class="swatch custom${custom ? ' on' : ''}" title="Custom colour"><input type="color" data-fmt-colorinput="${prop}" data-fs="ci:${prop}" value="${hex}" aria-label="${esc(label)}: custom colour"></label></div></div>`;
}
const fontOptions = cur => {
  const g = {}; Object.entries(PC.FONTS).forEach(([k, f]) => { (g[f.group] = g[f.group] || {})[k] = f.name; });
  const lf = (PC.localFonts && PC.localFonts.list) || [];
  if (lf.length) { g['On this computer'] = {}; lf.forEach(f => { g['On this computer'][f] = f; }); }
  if (cur && !PC.has(PC.FONTS, cur) && !lf.includes(cur)) g.Custom = { [cur]: cur };
  return g;
};

/* ── text controls (objects and generated fields share them) ── */
function typoSection(t, d, o = {}) {
  const v = k => (t[k] !== undefined ? t[k] : d[k]);
  const fontOpts = o.inherit ? Object.assign({ '': { '': 'Default for this layout' } }, fontOptions(t.font)) : fontOptions(v('font'));
  return sec('Text', `${select('Font', 'font', o.inherit ? (t.font || '') : v('font'), fontOpts, { groups: true })}
    <div class="field" style="margin-top:-4px"><label for="fontname" class="sm-lbl">Or type an installed font name</label><input class="inp" id="fontname" data-fmt-fontname placeholder="e.g. Helvetica Neue" maxlength="60" autocomplete="off" spellcheck="false"></div>
    <div class="row fsz"><div class="field fnum" style="flex:1;margin:0"><label for="fsize">Size (px)</label><input class="inp" id="fsize" type="number" data-fmt="size" data-fs="n:size" value="${Math.round(v('size') || 0) || ''}" min="4" max="600" step="1"></div>
      <button type="button" class="btn sm" data-fmt-step="-2" aria-label="Smaller text">A−</button><button type="button" class="btn sm" data-fmt-step="2" aria-label="Larger text">A+</button></div>
    <div class="field" style="margin-top:10px"><span class="lbl">Style</span><div class="tg-row">${toggle('Bold', 'bold', +v('weight') >= 600, 'B', 'b')}${toggle('Italic', 'italic', !!v('italic'), 'I', 'i')}${toggle('Underline', 'underline', !!v('underline'), 'U', 'u')}${toggle('Uppercase', 'caps', !!v('caps'), 'AA')}</div></div>
    ${select('Weight', 'weight', o.inherit && t.weight == null ? '' : String(v('weight') || 400), Object.assign(o.inherit ? { '': 'Default' } : {}, PC.WEIGHTS))}
    <div class="field"><span class="lbl">Align</span>${segBtns('align', v('align') || 'left', { left: 'Left', center: 'Centre', right: 'Right', justify: 'Justify' })}</div>
    ${o.list ? select('List', 'list', t.list || '', { '': 'None', bullet: 'Bullets', number: 'Numbered' }) : ''}
    ${o.valign ? `<div class="field"><span class="lbl">Vertical</span>${segBtns('valign', v('valign') || 'top', { top: 'Top', middle: 'Middle', bottom: 'Bottom' })}</div>` : ''}
    ${colorField('Colour', 'color', t.color !== undefined ? t.color : (o.inherit ? '' : d.color))}
    <div class="row">${num('Line height', 'lh', v('lh'), { step: .05, min: .5, max: 4, ph: o.inherit ? 'auto' : '' })}${num('Letter spacing (em)', 'ls', v('ls'), { step: .01, min: -.5, max: 2, ph: o.inherit ? 'auto' : '' })}</div>`, o.hint);
}

/* ── objects ── */
function geometrySection(o, r) {
  return sec('Position and size', `<div class="row">${num('X', 'x', o.x)}${num('Y', 'y', o.y)}</div><div class="row">${num('Width', 'w', o.w, { min: o.type === 'line' ? 0 : 4 })}${num('Height', 'h', o.h != null ? o.h : r.h, { min: o.type === 'line' ? 0 : 2, ph: 'auto' })}</div>
    <div class="row">${num('Rotation (°)', 'rot', o.rot || 0, { min: -360, max: 360 })}<div class="field fnum"><label for="fop">Opacity</label><input id="fop" class="rng" type="range" min="0" max="100" value="${Math.round((o.opacity == null ? 1 : o.opacity) * 100)}" data-fmt="opacity" data-fs="n:opacity" aria-label="Opacity"></div></div>
    <label class="switch"><span>Lock <small class="hint">stops dragging and resizing</small></span><input type="checkbox" data-fmt-check="locked" ${o.locked ? 'checked' : ''}></label>`, 'stage pixels, slide is 1280 × 720');
}
function shapeSection(o) {
  return sec('Shape', `${select('Shape', 'shape', o.shape || 'rect', PC.SHAPES)}
    ${o.shape === 'line' || o.shape === 'connector' ? '' : colorField('Fill', 'fill', o.fill !== undefined ? o.fill : PC.OBJ_DEFAULTS.shape.fill, { none: true })}
    ${o.shape === 'line' || o.shape === 'connector' ? '' : colorField('Gradient to', 'fill2', o.fill2 || '', { none: true }) + (o.fill2 ? `<div class="row">${num('Gradient angle (°)', 'gradAngle', o.gradAngle == null ? 90 : o.gradAngle, { min: 0, max: 360, step: 15 })}</div>` : '')}
    ${colorField(o.shape === 'line' || o.shape === 'connector' ? 'Line colour' : 'Outline', 'stroke', o.stroke !== undefined ? o.stroke : '', { none: true })}
    <div class="row">${num('Line width', 'strokeW', o.strokeW || 0, { min: 0, max: 80 })}${o.shape === 'rect' || o.shape === 'round' ? num('Corner radius', 'radius', o.radius || 0, { min: 0, max: 2000 }) : ''}</div>
    ${select('Line style', 'dash', o.dash || 'solid', { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' })}
    <label class="switch"><span>Shadow</span><input type="checkbox" data-fmt-check="shadow" ${o.shadow ? 'checked' : ''}></label>`);
}
function lineSection(o) {
  const glued = o.from || o.to, bend = o.bend == null ? .5 : o.bend;
  return sec('Line', `<div class="field"><span class="lbl">Type</span>${segBtns('kind', o.kind || 'straight', PC.LINE_KINDS)}</div>
    ${colorField('Colour', 'stroke', o.stroke || PC.OBJ_DEFAULTS.line.stroke)}
    <div class="row">${num('Width', 'strokeW', o.strokeW || 5, { min: .5, max: 80, step: .5 })}${select('Style', 'dash', o.dash || 'solid', { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' })}</div>
    <div class="row">${select('Start', 'arrowStart', o.arrowStart || 'none', PC.ARROWS)}${select('End', 'arrowEnd', o.arrowEnd || 'none', PC.ARROWS)}</div>
    ${o.kind && o.kind !== 'straight' ? `<div class="field"><label for="fbend">Corner position</label><input id="fbend" class="rng" type="range" min="5" max="95" value="${Math.round(bend * 100)}" data-fmt="bend" data-fs="n:bend" aria-label="Corner position"></div><label class="switch"><span>Leave the start vertically</span><input type="checkbox" data-fmt-check="vert" ${o.vert ? 'checked' : ''}></label>` : ''}
    <label class="switch"><span>Shadow</span><input type="checkbox" data-fmt-check="shadow" ${o.shadow ? 'checked' : ''}></label>
    <p class="note">${glued ? `Glued ${o.from ? 'at the start' : ''}${o.from && o.to ? ' and ' : ''}${o.to ? 'at the end' : ''}: it follows its shapes when they move.` : 'Drag an end onto a side of a shape to glue it there. The line then follows that shape.'}</p>
    ${glued ? `<div class="row wrap"><button class="btn sm" type="button" data-fmt-act="unglue">Detach from shapes</button></div>` : ''}`, 'drag the round ends and the yellow corner on the slide');
}
function linkSection(o) {
  return sec('Link and accessibility', `<div class="field"><label for="flink">Link <span style="font-weight:400">(followed when presenting)</span></label><input class="inp" id="flink" data-fmt-text="link" data-fs="x:link" value="${esc(o.link || '')}" placeholder="https://…, mailto:… or #slide-id" autocomplete="off"></div>
    ${o.type === 'image' ? '' : `<div class="field"><label for="falt2">Alt text</label><input class="inp" id="falt2" data-fmt-text="alt" data-fs="x:alt" value="${esc(o.alt || '')}" placeholder="Describe it for screen readers" autocomplete="off"></div>`}<div class="err" data-fmt-err="link" role="alert"></div>`);
}
function imageSection(o) {
  const url = o.src && o.src.startsWith('data:') ? '' : o.src || '';
  return sec('Image', `<div class="field"><label for="fimg">Image address (https)</label><input class="inp" id="fimg" data-fmt-text="src" data-fs="x:src" value="${esc(url)}" placeholder="${o.src && o.src.startsWith('data:') ? 'Embedded picture' : 'https://…'}" autocomplete="off"></div>
    <div class="row wrap" style="margin-bottom:10px"><button class="btn sm" type="button" data-fmt-act="replace-image">${icon('upload', 14)} Replace picture</button></div>
    <div class="field"><label for="falt">Alt text</label><input class="inp" id="falt" data-fmt-text="alt" data-fs="x:alt" value="${esc(o.alt || '')}" placeholder="Describe the picture" autocomplete="off"></div>
    ${select('Fit', 'fit', o.fit || 'cover', { cover: 'Fill the box (crop)', contain: 'Show all (letterbox)', fill: 'Stretch' })}
    <div class="row">${num('Corner radius', 'radius', o.radius || 0, { min: 0, max: 2000 })}${num('Border width', 'strokeW', o.strokeW || 0, { min: 0, max: 80 })}</div>${colorField('Border colour', 'stroke', o.stroke || '', { none: true })}
    <label class="switch"><span>Shadow</span><input type="checkbox" data-fmt-check="shadow" ${o.shadow ? 'checked' : ''}></label><div class="err" data-fmt-err role="alert"></div>`);
}
function iconSection(o) {
  return sec('Icon', `<div class="icon-pick" role="group" aria-label="Icon">${PC.ICON_NAMES.map(n => `<button type="button" data-fmt-set="icon" data-v="${n}" data-fs="g:icon:${n}" class="${o.icon === n ? 'on' : ''}" title="${n}" aria-label="${n}" aria-pressed="${o.icon === n}">${icon(n, 16)}</button>`).join('')}</div><div style="height:10px"></div>${colorField('Colour', 'color', o.color !== undefined ? o.color : PC.OBJ_DEFAULTS.icon.color)}`);
}
function arrangeSection(n, single) {
  const b = (op, label, ic) => `<button type="button" class="btn sm" data-fmt-op="${op}" data-fs="o:${op}" aria-label="${esc(label)}" title="${esc(label)}">${ic ? icon(ic, 14) + ' ' : ''}${esc(label)}</button>`;
  return sec('Arrange', `<div class="row wrap">${b('front', 'To front', 'front')}${b('forward', 'Forward', 'forward')}${b('backward', 'Backward', 'backward')}${b('back', 'To back', 'back')}</div>
    <div class="lbl" style="margin:10px 0 6px">Align ${n > 1 ? 'to each other' : 'to the slide'}</div><div class="row wrap">${['left', 'center', 'right', 'top', 'middle', 'bottom'].map(a => b('align:' + a, a === 'center' ? 'Centre' : a[0].toUpperCase() + a.slice(1))).join('')}</div>
    ${n > 2 ? `<div class="row wrap" style="margin-top:8px">${b('dist:h', 'Space evenly across')}${b('dist:v', 'Space evenly down')}</div>` : ''}
    <div class="row wrap" style="margin-top:10px">${n > 1 ? b('group', 'Group', 'layers') : ''}${b('ungroup', 'Ungroup')}${b('flip:h', 'Flip horizontal')}${b('flip:v', 'Flip vertical')}</div>
    <div class="row wrap" style="margin-top:12px">${b('dup', 'Duplicate', 'copy')}${b('del', 'Delete', 'trash')}</div>`, single ? 'Ctrl+] / Ctrl+[' : '');
}

/* ── generated (template) elements ── */
function computed(it) {
  const el = it.k === 't' ? Array.from((E.frameEl(S.sel) || document).querySelectorAll('[data-path]')).find(e => e.dataset.path === it.key && !e.closest('.ob')) : null;
  if (!el) return {};
  const cs = getComputedStyle(el), ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim().toLowerCase(), key = Object.keys(PC.FONTS).find(k => PC.FONTS[k].family.toLowerCase() === ff);
  return { size: parseFloat(cs.fontSize), weight: +cs.fontWeight, italic: cs.fontStyle === 'italic', underline: /underline/.test(cs.textDecorationLine), caps: cs.textTransform === 'uppercase', align: ({ start: 'left', end: 'right' })[cs.textAlign] || cs.textAlign, font: key || '' };
}
function tweakPanel(tg) {
  const d = computed({ k: 't', key: tg.key }), t = tg.tweak || {};
  return sec(`Text field · ${tg.key}`, `<p class="note" style="margin-bottom:12px">This text comes from the slide layout. Change its look here, or drag it by the <b>move grip</b> that appears beside it. Reset puts it back.</p>`)
    + typoSection(t, Object.assign({ weight: 400 }, d), { inherit: true })
    + sec('Position', `<div class="row wrap"><button class="btn sm" type="button" data-fmt-act="reset-tweaks">${icon('refresh', 14)} Reset position and formatting</button></div>`, t.dx || t.dy ? `moved ${Math.round(t.dx || 0)}, ${Math.round(t.dy || 0)}` : 'not moved');
}
function itemPanel(tg) {
  const m = tg.key.match(/^(.+)\.(\d+)$/), s = S.slide(), spec = PC.LAYOUTS[s.layout]; if (!m || !spec.list || spec.list.key !== m[1]) return sec('Selected', '<p class="note">This element can be moved by dragging it.</p>');
  const L = spec.list, i = +m[2], arr = s[L.key] || [], it = arr[i] || {};
  const ops = `<div class="row wrap"><button class="btn sm" type="button" data-fmt-item="up"${i === 0 ? ' disabled' : ''} aria-label="Move ${L.noun} earlier">${icon('up', 14)} Earlier</button><button class="btn sm" type="button" data-fmt-item="down"${i >= arr.length - 1 ? ' disabled' : ''} aria-label="Move ${L.noun} later">${icon('down', 14)} Later</button><button class="btn sm" type="button" data-fmt-item="dup"${L.max && arr.length >= L.max ? ' disabled' : ''} aria-label="Duplicate ${L.noun}">${icon('copy', 14)} Duplicate</button><button class="btn sm" type="button" data-fmt-item="del"${arr.length <= (L.min || 0) ? ' disabled' : ''} aria-label="Delete ${L.noun}">${icon('trash', 14)} Delete</button></div>`;
  const t = tg.tweak || {};
  return sec(`${L.noun.replace(/^./, c => c.toUpperCase())} ${i + 1} of ${arr.length}`, `${L.fields.map(f => Ins.fieldFor(f, `${L.key}.${i}`, it[f.k], L)).join('')}<div style="height:6px"></div>${ops}`)
    + sec('Position', `<p class="note" style="margin-bottom:10px">Drag the ${esc(L.noun)} on the slide to move it (or use the arrow keys). Click its text to change the font and size.</p><div class="row wrap"><button class="btn sm" type="button" data-fmt-act="reset-tweaks">${icon('refresh', 14)} Reset position</button></div>`, t.dx || t.dy ? `moved ${Math.round(t.dx || 0)}, ${Math.round(t.dy || 0)}` : 'not moved');
}

F.fontOptions = fontOptions;
F.html = function () {
  const T = St.targets();
  if (!T.length) {
    const s = S.slide(), blank = s && s.layout === 'blank';
    if (s && s.layout === 'custom' && PC.htmlFormat) return PC.htmlFormat.html(s);   // an HTML slide: its elements are selectable and formattable
    if (s && s.layout === 'custom') return Ins.panelBuild(s) + sec('Edit this slide', `<p class="note">This slide is code, so there is nothing on it to click and format. Open the code editors to change it, or ask an AI to.</p><div class="row wrap"><button class="btn sm primary" data-build="custom">${icon('code', 14)} Open the code editors</button><button class="btn sm" data-act="ai">${icon('sparkles', 14)} Ask an AI</button></div>`)
      + sec('Add to this slide', `<div class="row wrap"><button class="btn sm" data-act="ins-text">${icon('type', 14)} Text box</button><button class="btn sm" data-act="ins-image">${icon('image', 14)} Image</button><button class="btn sm" data-act="ins-shape">${icon('shapes', 14)} Shape</button><button class="btn sm" data-act="ins-icon">${icon('star', 14)} Icon</button></div>`);
    return (s ? Ins.panelBuild(s) : '') + sec('Format', `<p class="note">Click anything on the slide to format it. <b>Drag</b> to move, use the <b>handles</b> to resize and rotate, <b>double-click</b> a text box to type, arrow keys to nudge, <b>Shift</b> to select several.</p>`)
      + sec(blank ? 'This slide is blank' : 'Add to this slide', `<div class="row wrap"><button class="btn sm" data-act="ins-text">${icon('type', 14)} Text box</button><button class="btn sm" data-act="ins-image">${icon('image', 14)} Image</button><button class="btn sm" data-act="ins-shape">${icon('shapes', 14)} Shape</button><button class="btn sm" data-act="ins-icon">${icon('star', 14)} Icon</button></div>`, blank ? '' : 'sits above the layout');
  }
  const objsSel = T.filter(t => t.obj), fx = T.filter(t => !t.obj);
  if (objsSel.length && fx.length) return sec('Selection', '<p class="note">A mix of free-form objects and layout elements is selected. Drag moves them all together.</p>') + arrangeSection(objsSel.length, false);
  if (fx.length > 1) return sec('Selection', `<p class="note">${fx.length} layout elements selected. Drag to move them together.</p><div class="row wrap"><button class="btn sm" type="button" data-fmt-act="reset-tweaks">${icon('refresh', 14)} Reset</button></div>`);
  if (fx.length) return fx[0].k === 'l' ? itemPanel(fx[0]) : tweakPanel(fx[0]);
  // free-form objects
  const n = objsSel.length;
  if (n > 1) return sec(`${n} objects selected`, `<div class="field"><label for="fop2">Opacity</label><input id="fop2" class="rng" type="range" min="0" max="100" value="${Math.round((objsSel[0].obj.opacity == null ? 1 : objsSel[0].obj.opacity) * 100)}" data-fmt="opacity" data-fs="n:opacity" aria-label="Opacity"></div>`) + arrangeSection(n, false);
  const o = objsSel[0].obj, r = St.targets() && { h: (function () { const el = $(`.ob[data-obj="${CSS.escape(o.id)}"]`, E.frameEl(S.sel) || document); return el ? el.offsetHeight : 60; })() };
  const D = PC.OBJ_DEFAULTS[o.type], d = Object.assign({}, D, o);
  let h = `<div class="fobj-head">${icon(o.type === 'text' ? 'type' : o.type === 'image' ? 'image' : o.type === 'icon' ? 'star' : o.type === 'line' ? 'move' : 'shapes', 18)}<b>${esc(PC.OBJECT_TYPES[o.type])}</b><span>${esc(o.type === 'line' ? PC.LINE_KINDS[o.kind || 'straight'] : PC.SHAPES[o.shape] || '')}</span></div>`;
  h += geometrySection(o, r);
  if (o.type === 'shape') h += shapeSection(o);
  if (o.type === 'line') h += lineSection(o);
  if (o.type === 'image') h += imageSection(o);
  if (o.type === 'icon') h += iconSection(o);
  if (o.type === 'text' || o.type === 'shape') h += typoSection(o, d, { list: true, valign: o.h != null || o.type === 'shape', hint: o.type === 'shape' ? 'double-click the shape to type' : 'double-click the box to type' });
  return h + linkSection(o) + arrangeSection(1, true);
};

/* ── events ── */
const rerender = () => { Ins.render(); };
function patchFrom(prop, raw, key) {
  if (prop === 'opacity') return St.patch({ opacity: Math.max(0, Math.min(1, raw / 100)) }, key);
  if (prop === 'bend') return St.patch({ bend: Math.max(.05, Math.min(.95, raw / 100)) }, key);
  if (raw === '' || raw == null || isNaN(raw)) {
    if (prop === 'h') return St.patch({ h: null }, key);                 // empty height = auto
    if (['lh', 'ls', 'size', 'weight'].includes(prop) && St.targets().every(t => !t.obj)) return St.patch({ [prop]: null }, key);   // generated fields: empty = layout default
    return false;
  }
  return St.patch({ [prop]: raw }, key);
}
F.bind = function () {
  const panel = $('#panel');
  panel.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-fmt]')) { patchFrom(el.dataset.fmt, parseFloat(el.value), 'fmt:' + el.dataset.fmt); return; }
    if (el.matches('[data-fmt-colorinput]')) { St.patch({ [el.dataset.fmtColorinput]: el.value }, 'fmt:c:' + el.dataset.fmtColorinput); return; }
    if (el.matches('[data-fmt-text]')) {
      const p = el.dataset.fmtText, v = el.value.trim();
      if (p === 'link') { const err = $('[data-fmt-err="link"]', panel); if (v && !PC.okLink(v)) { if (err) err.textContent = 'Use https://, mailto: or #slide-id.'; return; } if (err) err.textContent = ''; St.patch({ link: v || null }, 'fmt:link'); return; }
      if (p === 'src') { const err = $('[data-fmt-err]', panel); if (v && !PC.okUrl(v)) { if (err) err.textContent = 'Use an https:// address, or use Replace picture.'; return; } if (err) err.textContent = ''; }
      St.patch({ [p]: p === 'src' ? v : el.value }, 'fmt:' + p);
    }
  });
  panel.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('[data-fmt-sel]')) { const p = el.dataset.fmtSel; let v = el.value; if (v === '' && ['font', 'weight', 'list'].includes(p)) v = null; else if (p === 'weight') v = +v; St.patch({ [p]: v }, ''); rerender(); return; }
    if (el.matches('[data-fmt-fontname]')) { const f = PC.cleanFont(el.value); if (el.value.trim() && !f) { el.setCustomValidity('Letters, numbers, spaces and - . _ & + only'); el.reportValidity(); return; } el.setCustomValidity(''); St.patch({ font: f || null }, ''); rerender(); return; }
    if (el.matches('[data-fmt-check]')) { St.patch({ [el.dataset.fmtCheck]: el.checked ? true : null }, ''); return; }
    if (el.matches('[data-fmt-colorinput]')) rerender();
  });
  panel.addEventListener('click', e => {
    const t = e.target, tg = t.closest('[data-fmt-toggle]');
    if (tg) {
      const p = tg.dataset.fmtToggle, on = tg.getAttribute('aria-pressed') !== 'true', target = St.targets()[0];
      if (p === 'bold') St.patch({ weight: on ? 700 : (target && target.obj ? 400 : null) }, ''); else St.patch({ [p]: on ? true : (target && target.obj ? false : null) }, '');
      rerender(); return;
    }
    const sc = t.closest('[data-fmt-color]'); if (sc) { const v = sc.dataset.v; St.patch({ [sc.dataset.fmtColor]: v === '' ? '' : v }, ''); rerender(); return; }
    const st = t.closest('[data-fmt-set]'); if (st) { const p = st.dataset.fmtSet; St.patch({ [p]: st.dataset.v }, ''); rerender(); return; }
    const step = t.closest('[data-fmt-step]'); if (step) { const cur = parseFloat($('#fsize', panel).value) || 24; St.patch({ size: Math.max(4, Math.min(600, cur + +step.dataset.fmtStep)) }, 'fmt:size'); rerender(); return; }
    const op = t.closest('[data-fmt-op]'); if (op) { const a = op.dataset.fmtOp; if (a === 'dup') St.duplicate(); else if (a === 'del') St.remove(); else if (a.startsWith('align:')) St.align(a.slice(6)); else if (a.startsWith('dist:')) St.distribute(a.slice(5)); else if (a === 'group') St.group(); else if (a === 'ungroup') St.ungroup(); else if (a.startsWith('flip:')) St.flip(a.slice(5)); else St.order(a); rerender(); return; }
    const act = t.closest('[data-fmt-act]'); if (act) {
      const a = act.dataset.fmtAct;
      if (a === 'reset-tweaks') { St.resetTweaks(); rerender(); }
      else if (a === 'unglue') { St.patch({ from: null, to: null }, ''); rerender(); }
      else if (a === 'replace-image') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'; inp.hidden = true; document.body.appendChild(inp); inp.addEventListener('change', async () => { const f = inp.files[0]; inp.remove(); if (f) await F.replaceImage(f); }); inp.click(); }
      return;
    }
    const it = t.closest('[data-fmt-item]'); if (it) {
      const tg0 = St.targets()[0], m = tg0 && tg0.key.match(/^(.+)\.(\d+)$/); if (!m) return; const op = it.dataset.fmtItem, idx = +m[2];
      Ins.listOp(op, m[1], idx, true);
      const n = op === 'up' ? idx - 1 : op === 'down' ? idx + 1 : op === 'dup' ? idx + 1 : -1;
      setTimeout(() => { if (n < 0) St.clear(); else St.setSel([{ k: 'l', key: `${m[1]}.${n}` }]); }, 30);
    }
  });
};
F.replaceImage = async function (file) {
  const t = St.targets()[0]; if (!t || !t.obj || t.obj.type !== 'image') return;
  if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type)) { UI.toast('Please choose a PNG, JPEG, GIF, WebP or SVG image.', 'bad'); return; }
  const r = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
  if (r.length > 3.2 * 1024 * 1024) { UI.toast('That image is very large. Use a smaller one or link to a URL.', 'bad'); return; }
  St.patch({ src: r, alt: t.obj.alt || file.name.replace(/\.[^.]+$/, '') }, ''); rerender();
};
})();
