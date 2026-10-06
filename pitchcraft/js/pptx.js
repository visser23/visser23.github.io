/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT → PowerPoint (.pptx)
   Builds a real Office Open XML package in the browser: no library, no server.

   How it works
     1. Every slide is rendered at 1280x720 and read by PC.walk (walk.js), which reports positions, computed colours,
        fonts and the text as runs. Custom (HTML/CSS/JS) slides are read from inside their sandbox the same way.
     2. Free-form objects are exported from the deck model, so shapes stay real PowerPoint shapes (editable geometry),
        lines stay connectors (glued to their shapes), grouped objects stay grouped.
     3. Text that belongs together becomes ONE text box, and text on a card becomes the text of that shape, not a text box
        laid over it. Headlines become the slide title, so Outline view, navigation and screen readers work.
     4. Pictures are embedded; graphics with no PowerPoint equivalent (charts, icons) are embedded as 2x pictures.
   One slide pixel = 9525 EMU, so the 1280x720 stage maps exactly onto a 13.333 x 7.5 inch slide.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, UI = PC.ui, S = PC.store;
const EMU = 9525, SW = 1280, SH = 720;
const px = n => Math.round((+n || 0) * EMU);
const enc = new TextEncoder();
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const xe = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* ── zip (stored or deflated; CRC-32) ── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function deflate(b) {
  if (typeof CompressionStream !== 'function') return null;
  try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(b); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch (e) { return null; }
}
PC.zip = async function (files) {
  const parts = [], central = []; let off = 0;
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    let body = data, method = 0;
    if (!f.store && data.length > 200) { const z = await deflate(data); if (z && z.length < data.length) { body = z; method = 8; } }
    const head = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(method), ...u16(dt), ...u16(dd), ...u32(crc), ...u32(body.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    parts.push(head, name, body);
    central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(dt), ...u16(dd), ...u32(crc), ...u32(body.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + body.length;
  }
  const cdSize = central.reduce((n, a) => n + a.length, 0);
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), 0, 0]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((n, a) => n + a.length, 0)); let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
  return out;
};

/* ── colour, fill, line, effects ── */
const alphaX = a => a != null && a < .995 ? `<a:alpha val="${Math.round(clampN(a, 0, 1) * 100000)}"/>` : '';
const clr = (c, a) => `<a:srgbClr val="${(c || '000000').toUpperCase()}">${alphaX(a)}</a:srgbClr>`;
const solid = (c, a) => `<a:solidFill>${clr(c, a)}</a:solidFill>`;
function gradFill(g, op) {
  const stops = g.stops.map(s => `<a:gs pos="${Math.round(s.p * 1000)}">${clr(s.c, (s.a == null ? 1 : s.a) * (op == null ? 1 : op))}</a:gs>`).join('');
  if (g.radial) { const l = Math.round(clampN(g.at ? g.at[0] : 50, 0, 100) * 1000), t = Math.round(clampN(g.at ? g.at[1] : 50, 0, 100) * 1000); return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:path path="circle"><a:fillToRect l="${l}" t="${t}" r="${100000 - l}" b="${100000 - t}"/></a:path></a:gradFill>`; }
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${Math.round(g.ang * 60000)}" scaled="0"/></a:gradFill>`;
}
const fillX = (it, op) => it.grad ? gradFill(it.grad, op) : it.fill ? solid(it.fill.c, it.fill.a * (op == null ? 1 : op)) : '<a:noFill/>';
const lnX = (l, op) => l ? `<a:ln w="${px(l.w)}">${solid(l.c, (l.a == null ? 1 : l.a) * (op == null ? 1 : op))}<a:prstDash val="${l.dash || 'solid'}"/><a:miter lim="800000"/></a:ln>` : '<a:ln><a:noFill/></a:ln>';
const shadowX = (s, it) => {
  if (!s) return '';
  const dx = Number(s.dx) || 0, dy = Number(s.dy) || 0, dist = Math.hypot(dx, dy), dir = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360, sp = Number(s.spread) || 0;
  // CSS spread grows or shrinks the shadow's own rectangle (a card's "0 12px 30px -20px" is a small, soft shadow); PowerPoint scales it about its centre
  const scale = sp && it && it.w > 1 && it.h > 1 ? ` sx="${Math.round(clampN((it.w + 2 * sp) / it.w, .02, 3) * 100000)}" sy="${Math.round(clampN((it.h + 2 * sp) / it.h, .02, 3) * 100000)}"` : '';
  return `<a:effectLst><a:outerShdw blurRad="${px(s.blur)}" dist="${px(dist)}" dir="${Math.round(dir * 60000)}"${scale} algn="${scale ? 'ctr' : 'tl'}" rotWithShape="0">${clr(s.c, s.a)}</a:outerShdw></a:effectLst>`;
};
/** a polygon outline (points as fractions of the shape's box) for a clipped or skewed shape */
const custGeomX = (pts, w, h) => {
  const W = Math.max(1, px(w)), H = Math.max(1, px(h)), P = q => `<a:pt x="${Math.round(clampN(q[0], -2, 3) * W)}" y="${Math.round(clampN(q[1], -2, 3) * H)}"/>`;
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${W}" h="${H}"><a:moveTo>${P(pts[0])}</a:moveTo>${pts.slice(1).map(q => `<a:lnTo>${P(q)}</a:lnTo>`).join('')}<a:close/></a:path></a:pathLst></a:custGeom>`;
};

/* ── text ── */
/* Fonts. PowerPoint cannot use the web fonts Pitchcraft ships (it does not read woff2, and neither Mac nor Windows PowerPoint honours fonts embedded in a
   file that did not come from PowerPoint itself), so a font the viewer lacks is swapped for the app's default, usually a serif, and the text reflows.
   Default 'similar': each family becomes the closest font that ships with Office, Windows and macOS. 'keep': the original names, for people who install the fonts. */
const SIMILAR = (() => {
  const m = {}, add = (to, pf, names) => names.split('|').forEach(n => { m[n.toLowerCase()] = { to, pf }; });
  add('Arial', 34, 'Inter|DM Sans|Manrope|Plus Jakarta Sans|Space Grotesk|Work Sans|Sora|Figtree|Lato|Rubik|Archivo|Epilogue|IBM Plex Sans|Cabin|Nunito|Raleway|Bricolage Grotesque|Helvetica|Helvetica Neue|system-ui|sans-serif|ui-sans-serif|-apple-system|BlinkMacSystemFont|Segoe UI|Roboto');
  add('Century Gothic', 34, 'Outfit|Montserrat|Urbanist|Poppins|Josefin Sans|Quicksand');
  add('Arial Black', 34, 'Syne');   // very wide and heavy, like Syne ExtraBold
  add('Arial Narrow', 34, 'Oswald');
  add('Impact', 34, 'Anton|Bebas Neue');
  add('Georgia', 18, 'Instrument Serif|Playfair Display|Lora|Fraunces|Source Serif 4|Libre Baskerville|DM Serif Display|Abril Fatface|Cormorant Garamond|serif|ui-serif');
  add('Courier New', 49, 'JetBrains Mono|Space Mono|IBM Plex Mono|Fira Code|Inconsolata|monospace|ui-monospace|SF Mono|Menlo|Consolas|Monaco');
  add('Brush Script MT', 66, 'Pacifico|Lobster');
  add('Comic Sans MS', 66, 'Caveat');
  return m;
})();
const PITCH = { arial: 34, 'arial narrow': 34, 'century gothic': 34, impact: 34, verdana: 34, tahoma: 34, 'trebuchet ms': 34, calibri: 34, georgia: 18, 'times new roman': 18, cambria: 18, 'courier new': 49 };
let fontMode = 'similar';
PC.pptxFont = (f, mode) => { f = String(f || 'Arial'); const m = (mode || fontMode) === 'keep' ? null : SIMILAR[f.toLowerCase()]; return { name: m ? m.to : f, pf: m ? m.pf : (PITCH[f.toLowerCase()] || 34) }; };
const fontTag = (tag, f) => { const r = PC.pptxFont(f); return `<a:${tag} typeface="${xe(r.name)}" pitchFamily="${r.pf}" charset="0"/>`; };
function runX(r, ctx, op) {
  if (r.br) return `<a:br><a:rPr lang="en-GB" sz="${clampN(Math.round((r.sz || 16) * 75), 100, 400000)}"/></a:br>`;
  const sz = clampN(Math.round((r.sz || 16) * 75), 100, 400000), f = r.f || 'Arial';
  let link = '';
  if (r.link) { const rid = ctx.link(r.link); if (rid) link = `<a:hlinkClick r:id="${rid}"${r.link[0] === '#' ? ' action="ppaction://hlinksldjump"' : ''}/>`; }
  const attrs = `lang="en-GB" sz="${sz}"${r.b && PC.pptxFont(f).name !== 'Arial Black' ? ' b="1"' : ''}${r.i ? ' i="1"' : ''}${r.u ? ' u="sng"' : ''}${r.s ? ' strike="sngStrike"' : ''}${r.cap ? ' cap="all"' : ''}${r.sp ? ` spc="${Math.round(r.sp * 75)}"` : ''}${r.sup ? ' baseline="30000"' : r.sub ? ' baseline="-25000"' : ''} dirty="0"`;
  return `<a:r><a:rPr ${attrs}>${solid(r.c, (r.a == null ? 1 : r.a) * (op == null ? 1 : op))}${r.hl ? `<a:highlight>${clr(r.hl)}</a:highlight>` : ''}${fontTag('latin', f)}${fontTag('cs', f)}${link}</a:rPr><a:t>${xe(r.t)}</a:t></a:r>`;
}
function paraX(p, ctx, op) {
  const sz = p.sz || 16, ind = p.bu ? 24 : 0, marL = (p.ml || 0) + ind;
  let ppr = `<a:pPr algn="${p.al || 'l'}"${marL ? ` marL="${px(marL)}" indent="${px(-ind)}"` : ''}>`;
  ppr += `<a:lnSpc><a:spcPct val="${clampN(Math.round((p.lh || 1.2) / 1.2 * 100000), 40000, 300000)}"/></a:lnSpc>`;
  ppr += `<a:spcBef><a:spcPts val="${Math.round(clampN(p.sb || 0, 0, 400) * 75)}"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>`;
  ppr += p.bu === 'num' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : p.bu ? '<a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>' : '<a:buNone/>';
  ppr += '</a:pPr>';
  const last = (p.runs || []).filter(r => !r.br).slice(-1)[0] || {};
  return `<a:p>${ppr}${(p.runs || []).map(r => runX(r, ctx, op)).join('')}<a:endParaRPr lang="en-GB" sz="${clampN(Math.round((last.sz || sz) * 75), 100, 400000)}" dirty="0"/></a:p>`;
}
function bodyX(it, ctx, op, box) {
  const ins = it.ins || [0, 0, 0, 0], wrap = it.wrap === 'none' ? 'none' : 'square';
  const auto = box ? '<a:noAutofit/>' : (wrap === 'none' ? '<a:spAutoFit/>' : '<a:spAutoFit/>');
  const paras = (it.paras && it.paras.length ? it.paras : [{ runs: [] }]).map(p => paraX(p, ctx, op)).join('');
  return `<p:txBody><a:bodyPr wrap="${wrap}" lIns="${px(ins[0])}" tIns="${px(ins[1])}" rIns="${px(ins[2])}" bIns="${px(ins[3])}" rtlCol="0" anchor="${it.anchor || 't'}">${auto}</a:bodyPr><a:lstStyle/>${paras}</p:txBody>`;
}

/* ── geometry ── */
function xfrm(x, y, w, h, rot, fh, fv) {
  const r = rot ? ` rot="${Math.round(((rot % 360) + 360) % 360 * 60000)}"` : '';
  return `<a:xfrm${r}${fh ? ' flipH="1"' : ''}${fv ? ' flipV="1"' : ''}><a:off x="${px(x)}" y="${px(y)}"/><a:ext cx="${Math.max(0, px(w))}" cy="${Math.max(0, px(h))}"/></a:xfrm>`;
}
const textWiden = (it) => {   // PowerPoint wraps with its own font metrics; a little slack keeps a line that fits in the browser on one line here
  if (!it.paras || it.paras.length === 0) return { x: it.x, w: it.w };
  const al = it.paras[0].al;
  if (it.wrap === 'none') {   // a one-line label must never break: the stand-in font is often wider than the web font, so give it room on the side(s) it may grow into
    const slack = Math.min(260, Math.max(8, it.w * .5));
    if (al === 'ctr') return { x: it.x - slack / 2, w: it.w + slack };
    if (al === 'r') { const nx = Math.max(0, it.x - slack); return { x: nx, w: it.x + it.w - nx }; }
    return { x: it.x, w: Math.min(it.w + slack, Math.max(it.w, SW - it.x)) };
  }
  const extra = Math.min(14, it.w * .035);
  return al === 'ctr' ? { x: it.x - extra / 2, w: it.w + extra } : al === 'r' ? { x: it.x - extra, w: it.w + extra } : { x: it.x, w: it.w + extra };
};
const SHAPE_PRST = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', star: 'star5', arrow: 'rightArrow', chevron: 'chevron', arrowleft: 'leftArrow', arrowup: 'upArrow',
  arrowdown: 'downArrow', arrowboth: 'leftRightArrow', pentagon: 'pentagon', octagon: 'octagon', parallelogram: 'parallelogram', trapezoid: 'trapezoid', plus: 'mathPlus', callout: 'wedgeRoundRectCallout', donut: 'donut', cylinder: 'can', heart: 'heart' };
const SITE_IDX = { rect: { t: 0, l: 1, b: 2, r: 3 }, roundRect: { t: 0, l: 1, b: 2, r: 3 }, diamond: { t: 0, l: 1, b: 2, r: 3 }, ellipse: { t: 0, l: 2, b: 4, r: 6 } };
const ARROW = { triangle: 'triangle', stealth: 'stealth', open: 'arrow', dot: 'oval', diamond: 'diamond' };

/** Find the rotation and flips that make PowerPoint's connector (which always starts at the local top-left and leaves along local +x) land on our start, end and first direction. */
function connectorFrame(o, w, h) {
  const kind = o.kind || 'straight', fhWant = !!o.flipH, fvWant = !!o.flipV, vert = !!o.vert && kind !== 'straight';
  const S0 = [fhWant ? w : 0, fvWant ? h : 0], E0 = [fhWant ? 0 : w, fvWant ? 0 : h];     // wanted start and end, relative to the visual box
  let best = { rot: 0, fh: fhWant, fv: fvWant, err: 1e9 };
  for (const rot of [0, 90, 180, 270]) for (const fh of [false, true]) for (const fv of [false, true]) {
    const swap = rot === 90 || rot === 270, W = swap ? h : w, H = swap ? w : h, cx = W / 2, cy = H / 2, th = rot * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    const vis = (lx, ly) => { const u = lx - cx, v = ly - cy; return [u * c - v * s + w / 2, u * s + v * c + h / 2]; };
    const st = vis(fh ? W : 0, fv ? H : 0), en = vis(fh ? 0 : W, fv ? 0 : H), d = [(fh ? -1 : 1) * c, (fh ? -1 : 1) * s];
    const dirOK = kind === 'straight' ? true : vert ? Math.abs(d[1]) > .5 && Math.sign(d[1]) === Math.sign(E0[1] - S0[1] || 1) : Math.abs(d[0]) > .5 && Math.sign(d[0]) === Math.sign(E0[0] - S0[0] || 1);
    const err = Math.hypot(st[0] - S0[0], st[1] - S0[1]) + Math.hypot(en[0] - E0[0], en[1] - E0[1]) + (dirOK ? 0 : 1000) + (rot ? .01 : 0) + (fh !== fhWant || fv !== fvWant ? .005 : 0);
    if (err < best.err) best = { rot, fh, fv, err };
  }
  const swap = best.rot === 90 || best.rot === 270, cx = w / 2, cy = h / 2, W = swap ? h : w, H = swap ? w : h;
  return { rot: best.rot, fh: best.fh, fv: best.fv, x: cx - W / 2, y: cy - H / 2, w: W, h: H };
}

/* ── per-slide builder ── */
class Slide {
  constructor(pkg, index) { this.pkg = pkg; this.i = index; this.nid = 2; this.rels = []; this.shapes = []; this.titleDone = false; this.ids = {}; this.warn = []; }
  id() { return this.nid++; }
  rel(type, target, ext) { const id = 'rId' + (this.rels.length + 2); this.rels.push({ id, type, target, ext }); return id; }
  link(u) {
    if (!u) return '';
    if (u[0] === '#') { const j = this.pkg.slideIds.indexOf(u.slice(1)); return j < 0 ? '' : this.rel('slide', `slide${j + 1}.xml`); }
    return /^(https?:|mailto:)/i.test(u) ? this.rel('hyperlink', u, true) : '';
  }
  media(m) { return this.rel('image', '../media/' + m.name); }
}

/** Stacked or see-through gradients (a glow on a dark colour) have no faithful PowerPoint equivalent, so they are painted once into a picture that sits behind everything. */
const rasterWanted = bg => { const L = bg && bg.layers || []; return L.length > 1 || (L.length === 1 && (L[0].radial || L[0].stops.some(t => (t.a == null ? 1 : t.a) < .99))); };
function rasterLayers(layers, fill, bw, bh, rad) {
  const K = Math.min(1, 800 / Math.max(bw, bh, 1)), W = Math.max(2, Math.round(bw * K)), H = Math.max(2, Math.round(bh * K)), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); if (!g) return null;
  const rgba = (c, a) => `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a == null ? 1 : a})`;
  if (rad && rad.r > .5) { g.beginPath(); if (rad.circle) g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, 7); else if (g.roundRect) g.roundRect(0, 0, W, H, Math.min(rad.r * K, Math.min(W, H) / 2)); else g.rect(0, 0, W, H); g.clip(); }
  if (fill) { g.fillStyle = rgba(fill.c, fill.a); g.fillRect(0, 0, W, H); }
  layers.slice().reverse().forEach(L => {                       // CSS lists the top layer first, so paint the last one first
    let gr;
    if (L.radial) {
      const cx = (L.at ? L.at[0] : 50) / 100 * W, cy = (L.at ? L.at[1] : 50) / 100 * H;
      let rx = L.rx > 0 ? L.rx * K : 0, ry = L.ry > 0 ? L.ry * K : 0;
      if (!rx) {                                                  // keyword sizes; the default is farthest-corner
        const dx = Math.max(cx, W - cx), dy = Math.max(cy, H - cy), cl = /closest/.test(L.ext || ''), corner = !/side/.test(L.ext || ''), mx = Math.min(cx, W - cx), my = Math.min(cy, H - cy);
        if (L.circle) { const r = cl ? (corner ? Math.hypot(mx, my) : Math.min(mx, my)) : (corner ? Math.hypot(dx, dy) : Math.max(dx, dy)); rx = ry = r; }
        else { const f = corner ? Math.SQRT2 : 1; rx = (cl ? mx : dx) * f; ry = (cl ? my : dy) * f; }
      }
      rx = Math.max(1, rx); ry = Math.max(1, ry || rx);
      g.save(); g.translate(cx, cy); g.scale(1, ry / rx); gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      L.stops.forEach(t => gr.addColorStop(Math.max(0, Math.min(1, t.p / 100)), rgba(t.c, t.a)));
      g.fillStyle = gr; g.fillRect(-cx - W, (-cy - H) * (rx / ry), W * 3, H * 3 * (rx / ry)); g.restore();
    } else {
      const a = (L.ang + 90) * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), len = Math.abs(W * dx) + Math.abs(H * dy), cx = W / 2, cy = H / 2;
      gr = g.createLinearGradient(cx - dx * len / 2, cy - dy * len / 2, cx + dx * len / 2, cy + dy * len / 2);
      L.stops.forEach(t => gr.addColorStop(Math.max(0, Math.min(1, t.p / 100)), rgba(t.c, t.a))); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  });
  return cv.toDataURL('image/png');
}
const rasterBg = bg => rasterLayers(bg.layers, bg.fill ? { c: bg.fill.c, a: 1 } : { c: 'ffffff', a: 1 }, SW, SH, null);
/** a box whose background is stacked glows or fades: the picture goes in first, the box (outline, shadow, words) on top */
async function rasterBox(sl, it) {
  const uri = rasterLayers(it.raster.layers, it.raster.fill, it.w, it.h, { r: it.rad || 0, circle: it.circle }); if (!uri) return '';
  const rec = await getImage(sl.pkg, uri); if (!rec) return '';
  return picXrec(sl, { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot, name: (it.name || 'Box') + ' glow', alt: '', op: it.op, clip: it.clip }, rec);
}

async function buildSlide(pkg, s, i, host, deckMeta, onWarn) {
  const sl = new Slide(pkg, i), res = pkg.walks[i], objsInfo = res.objs || {}, ctx = sl;
  { const c = res.bg && res.bg.fill && /^[0-9a-f]{6}$/i.test(res.bg.fill.c || '') ? res.bg.fill.c : null; sl.dark = !!c && (parseInt(c.slice(0, 2), 16) * .299 + parseInt(c.slice(2, 4), 16) * .587 + parseInt(c.slice(4, 6), 16) * .114) < 110; }   // lets a stand-in picture suit a dark slide
  const items = res.items.slice();
  if (rasterWanted(res.bg)) { const uri = rasterBg(res.bg); if (uri) { items.unshift({ k: 'img', x: 0, y: 0, w: SW, h: SH, src: uri, size: '100% 100%', pos: '0 0', name: 'Background', alt: '' }); res.bg = Object.assign({}, res.bg, { grad: null }); } }
  if (res.bg && res.bg.img) items.unshift({ k: 'img', x: 0, y: 0, w: SW, h: SH, src: res.bg.img.src, size: res.bg.img.size, pos: res.bg.img.pos, name: 'Background', alt: '' });
  const heading = t => items.findIndex(it => it.tag === t && it.k !== 'img' && it.paras && it.paras[0] && it.paras[0].runs.some(r => r.t));
  let titleIdx = items.findIndex(it => it.role === 'title' && it.k !== 'img' && it.paras);
  if (titleIdx < 0) titleIdx = heading('H1');
  if (titleIdx < 0) titleIdx = heading('H2');
  if (titleIdx < 0) {   // no marked heading: the largest text in the top half, if it is heading-sized
    let best = 0; items.forEach((it, k) => { if (it.k !== 'text' || !it.paras || !it.paras[0] || !it.paras[0].runs.some(r => r.t) || it.y > 360) return; const sz = it.paras[0].sz || 0; if (sz >= 30 && sz > best) { best = sz; titleIdx = k; } });
  }
  const out = [];
  for (let k = 0; k < items.length; k++) {
    const it = items[k], op = it.op == null ? 1 : it.op;
    if (it.k === 'box') {
      if (it.raster) { out.push(await rasterBox(sl, it)); if (!it.line && !it.paras && !it.shadow) continue; }
      out.push(boxX(sl, it, k === titleIdx));
    }
    else if (it.k === 'text') out.push(textX(sl, it, k === titleIdx));
    else if (it.k === 'line') out.push(lineX(sl, it));
    else if (it.k === 'img') out.push(await picX(sl, it));
    else if (it.k === 'svg') out.push(await svgX(sl, it, op));
  }
  out.push(...await objectsX(sl, s, objsInfo, host));
  // PowerPoint wants a title for navigation and accessibility; a slide without one gets a hidden, empty title only if nothing else qualifies
  return { sl, xml: slideXml(sl, out.join(''), res.bg, s, deckMeta) };
}

function nameFor(base, sl, extra) { return xe((base || 'Shape').replace(/^\w/, c => c.toUpperCase()).slice(0, 40)); }
function boxX(sl, it, isTitle) {
  const id = sl.id(), rad = it.circle ? 'ellipse' : it.rad > 0.5 ? (it.radMode === 'top' ? 'round2SameRect' : 'roundRect') : 'rect';
  const av = rad === 'roundRect' ? `<a:gd name="adj" fmla="val ${Math.round(clampN(it.rad / Math.max(1, Math.min(it.w, it.h)) * 100000, 0, 50000))}"/>` : rad === 'round2SameRect' ? `<a:gd name="adj1" fmla="val ${Math.round(clampN(it.rad / Math.max(1, Math.min(it.w, it.h)) * 100000, 0, 50000))}"/><a:gd name="adj2" fmla="val 0"/>` : '';
  const ph = isTitle && it.paras && !sl.titleDone ? (sl.titleDone = true, '<p:nvPr><p:ph type="title"/></p:nvPr>') : '<p:nvPr/>';
  const txt = it.paras ? bodyX(it, sl, it.op == null ? 1 : it.op, true) : '<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${nameFor(it.name)}"/><p:cNvSpPr/>${ph}</p:nvSpPr><p:spPr>${xfrm(it.x, it.y, it.w, it.h, it.rot)}${it.clip ? custGeomX(it.clip, it.w, it.h) : `<a:prstGeom prst="${rad}"><a:avLst>${av}</a:avLst></a:prstGeom>`}${fillX(it)}${lnX(it.line)}${shadowX(it.shadow, it)}</p:spPr>${txt}</p:sp>`;
}
function textX(sl, it, isTitle) {
  const id = sl.id(), w = textWiden(it), ph = isTitle && !sl.titleDone ? (sl.titleDone = true, true) : false;
  const first = it.paras && it.paras[0] && it.paras[0].runs.find(r => r.t), nm = ph ? 'Title' : 'Text: ' + (first ? first.t.slice(0, 24) : '');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xe(nm)}"/><p:cNvSpPr${ph ? '' : ' txBox="1"'}/>${ph ? '<p:nvPr><p:ph type="title"/></p:nvPr>' : '<p:nvPr/>'}</p:nvSpPr><p:spPr>${xfrm(w.x, it.y, w.w, it.h, it.rot)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>${bodyX(it, sl, it.op == null ? 1 : it.op, false)}</p:sp>`;
}

function lineX(sl, it) {
  const id = sl.id(), x = Math.min(it.x1, it.x2), y = Math.min(it.y1, it.y2);
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${xe(it.name || 'Line')}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(x, y, Math.abs(it.x2 - it.x1), Math.abs(it.y2 - it.y1))}<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${px(it.w)}">${solid(it.c, it.a)}<a:prstDash val="${it.dash || 'solid'}"/></a:ln></p:spPr></p:cxnSp>`;
}

/* ── pictures ── */
const imgCache = new Map();
function dataBytes(u) { const m = u.match(/^data:([^;,]+)(;base64)?,(.*)$/s); if (!m) return null; try { const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return { mime: m[1], bytes: b }; } catch (e) { return null; } }
/* A picture can be SHOWN from any web address, but a page may only READ its pixels when the site allows it (CORS). Two honest causes of "could not be copied":
   (1) the site never sends the permission, (2) it does, but only when asked with an Origin header, and the browser reuses the copy it cached when it first
   showed the picture without one. We ask once normally, once more as a fresh address (fixes 2), and if both fail we check whether it still shows (tells 1 from "gone"). */
const picLoads = new Map(), picWhy = new Map();
function loadOnce(src, cors) {
  return new Promise(res => {
    const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; const t = setTimeout(() => res(null), 15000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = src;
  });
}
function loadImg(src) {
  if (picLoads.has(src)) return picLoads.get(src);
  const p = (async () => {
    let im = await loadOnce(src, true);
    if (!im && /^https?:/i.test(src)) {
      im = await loadOnce(src + (src.includes('?') ? '&' : '?') + '_pc=' + Date.now().toString(36), true);
      if (!im) picWhy.set(src, (await loadOnce(src, false)) ? 'blocked' : 'gone');
    }
    return im;
  })();
  picLoads.set(src, p); return p;
}
PC.loadCorsImage = loadImg; PC.loadCorsImage.reset = () => { picLoads.clear(); picWhy.clear(); }; PC.loadFailReason = src => picWhy.get(src) || '';
/** Fetch every linked picture the deck names, a few at a time, before the slides are read (so the progress bar can say so, and a slow site costs seconds once). */
async function preloadLinked(deck, say) {
  const urls = new Set(); deck.slides.forEach(s => { [s.bgImage, s.image && s.image.src].forEach(u => { if (/^https?:/i.test(u || '')) urls.add(u); }); (s.objects || []).forEach(o => { if (o.type === 'image' && /^https?:/i.test(o.src || '')) urls.add(o.src); }); });
  const list = Array.from(urls).slice(0, 80); let done = 0; if (!list.length) return;
  say(`Fetching ${list.length} linked picture${list.length === 1 ? '' : 's'}`, 0);
  const q = list.slice(); await Promise.all(Array.from({ length: Math.min(4, q.length) }, async () => { while (q.length) { const u = q.shift(); await loadImg(u); say(`Fetching linked pictures (${++done} of ${list.length})`, .1 * done / list.length); } }));
}
function canvasPng(im, w, h) {
  return new Promise(res => {
    try { const k = Math.min(1, 4096 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : res(null), 'image/png'); } catch (e) { res(null); }
  });
}
/** Resolve a picture to embeddable bytes plus its natural size. Remote pictures need CORS; if the host refuses, the slide gets a labelled placeholder instead. */
async function getImage(pkg, src) {
  if (!src) return null; if (imgCache.has(src) && pkg.media.has(imgCache.get(src).key)) return imgCache.get(src);
  let rec = null; const d = src.startsWith('data:') ? dataBytes(src) : null;
  const im = await loadImg(src);
  if (d && /^image\/(png|jpeg|gif)$/.test(d.mime) && im) rec = { bytes: d.bytes, ext: d.mime === 'image/jpeg' ? 'jpeg' : d.mime.slice(6), w: im.naturalWidth, h: im.naturalHeight };
  else if (im) { const w = im.naturalWidth || 1024, h = im.naturalHeight || 768, b = await canvasPng(im, w, h); if (b) rec = { bytes: b, ext: 'png', w, h }; }
  if (!rec) {
    const why = picWhy.get(src), where = src.startsWith('data:') ? '' : src.replace(/^https?:\/\//, '').slice(0, 70);
    pkg.warn.push(src.startsWith('data:') ? 'A picture could not be embedded (unreadable data).'
      : why === 'blocked' ? `The picture at ${where} shows in Pitchcraft but its website does not let other pages copy it, so it could not go into the file (browsers only allow copying when the site gives permission). Save the picture to your computer and drop it onto the slide; then it travels with the deck.`
      : why === 'gone' ? `The picture at ${where} could not be loaded (offline, moved, or blocked), so it is a grey placeholder in the file.`
      : `A picture could not be embedded (${where}). Save it to your computer and drop it onto the slide instead.`);
    return null;
  }
  rec.name = `image${pkg.media.size + 1}.${rec.ext}`; rec.key = rec.name; pkg.media.set(rec.key, rec); imgCache.set(src, rec); return rec;
}
function cropFor(it, nw, nh) {
  const F = it.full || it;   // a picture that a container clips is measured against its whole (uncropped) box, then windowed
  const fit = it.fit || (/contain/.test(it.size || '') ? 'contain' : /^100%( 100%)?$/.test(it.size || '') ? 'fill' : 'cover');
  const pos = (it.pos || '50% 50%').split(/\s+/).map(v => v.endsWith('%') ? parseFloat(v) / 100 : .5), pxl = isNaN(pos[0]) ? .5 : pos[0], pyl = isNaN(pos[1]) ? .5 : pos[1];
  let box = { x: F.x, y: F.y, w: F.w, h: F.h }, src = '', lr = { l: 0, t: 0, r: 0, b: 0 };
  const same = box;
  if (fit === 'fill' || !nw || !nh) return { box, src, same, lr };
  const sc = fit === 'contain' || fit === 'scale-down' ? Math.min(F.w / nw, F.h / nh) : Math.max(F.w / nw, F.h / nh);
  if (fit === 'contain' || fit === 'scale-down') { const bw = nw * sc, bh = nh * sc; box = { x: F.x + (F.w - bw) * pxl, y: F.y + (F.h - bh) * pyl, w: bw, h: bh }; }
  else { const fw = F.w / (nw * sc), fh = F.h / (nh * sc), l = (1 - fw) * pxl, t = (1 - fh) * pyl; lr = { l, t, r: 1 - fw - l, b: 1 - fh - t }; src = srcRectX(lr); }
  return { box, src, same, lr };
}
const srcRectX = lr => `<a:srcRect l="${Math.round(lr.l * 100000)}" t="${Math.round(lr.t * 100000)}" r="${Math.round(lr.r * 100000)}" b="${Math.round(lr.b * 100000)}"/>`;
/** show only the part of a picture that its container leaves visible (the walker puts that rectangle in it.x/y/w/h) */
function windowOf(c, it) {
  if (!it.full) return c;
  const D = c.box, x0 = Math.max(D.x, it.x), y0 = Math.max(D.y, it.y), x1 = Math.min(D.x + D.w, it.x + it.w), y1 = Math.min(D.y + D.h, it.y + it.h);
  if (x1 - x0 < .5 || y1 - y0 < .5 || D.w < .5 || D.h < .5) return null;
  const b = c.lr, bw = 1 - b.l - b.r, bh = 1 - b.t - b.b;
  const lr = { l: b.l + (x0 - D.x) / D.w * bw, r: b.r + (D.x + D.w - x1) / D.w * bw, t: b.t + (y0 - D.y) / D.h * bh, b: b.b + (D.y + D.h - y1) / D.h * bh };
  return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, src: srcRectX(lr), same: null, lr };
}
async function picX(sl, it, extra) {
  const rec = await getImage(sl.pkg, it.src); extra = extra || {};
  if (!rec) return it.decor ? '' : placeholderX(sl, it);   // a missing background texture is left out (the warning says so); a missing <img> keeps a labelled placeholder
  const id = sl.id(), rid = sl.media(rec), c = windowOf(cropFor(it, rec.w, rec.h), it); if (!c) return '';
  const prst = it.circle ? 'ellipse' : it.rad > .5 ? (it.radMode === 'top' ? 'round2SameRect' : 'roundRect') : 'rect';
  const adjV = Math.round(clampN(it.rad / Math.max(1, Math.min(c.box.w, c.box.h)) * 100000, 0, 50000));
  const av = prst === 'roundRect' ? `<a:gd name="adj" fmla="val ${adjV}"/>` : prst === 'round2SameRect' ? `<a:gd name="adj1" fmla="val ${adjV}"/><a:gd name="adj2" fmla="val 0"/>` : '';
  const link = extra.link ? sl.link(extra.link) : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xe(it.name || 'Picture')}" descr="${xe(it.alt || '')}">${link ? `<a:hlinkClick r:id="${link}"${extra.link[0] === '#' ? ' action="ppaction://hlinksldjump"' : ''}/>` : ''}</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"${it.op != null && it.op < 1 ? `><a:alphaModFix amt="${Math.round(it.op * 100000)}"/></a:blip>` : '/>'}${c.src}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(c.box.x, c.box.y, c.box.w, c.box.h, it.rot, extra.flipH, extra.flipV)}${it.clip && c.box === c.same ? custGeomX(it.clip, c.box.w, c.box.h) : `<a:prstGeom prst="${prst}"><a:avLst>${av}</a:avLst></a:prstGeom>`}${extra.line || it.line ? lnX(extra.line || it.line) : ''}</p:spPr></p:pic>`;
}
function placeholderX(sl, it) {
  const id = sl.id(), label = it.alt || 'Picture';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Missing picture" descr="${xe(it.alt || '')}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(it.x, it.y, it.w, it.h, it.rot)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${solid(sl.dark ? '262A33' : 'E5E7EB')}${lnX({ w: 1, c: sl.dark ? '5B6270' : '9CA3AF', dash: 'dash' })}</p:spPr><p:txBody><a:bodyPr anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-GB" sz="1400"><a:solidFill><a:srgbClr val="${sl.dark ? 'A3A9B5' : '6B7280'}"/></a:solidFill></a:rPr><a:t>${xe(label)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}
async function rasterSvg(markup, w, h) {
  const k = clampN(2, 1, 4096 / Math.max(1, w, h)), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup), im = await loadImg(url);
  if (!im) return null;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  try { c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); } catch (e) { return null; }
  const b = await new Promise(r => c.toBlob(r, 'image/png')); return b ? new Uint8Array(await b.arrayBuffer()) : null;
}
async function svgX(sl, it, op, extra) {
  const F = it.full || it, bytes = await rasterSvg(it.markup, F.w, F.h);
  if (!bytes) { sl.pkg.warn.push('A graphic could not be converted to a picture.'); return ''; }
  const key = 'svg' + sl.pkg.media.size + '_' + bytes.length, rec = { bytes, ext: 'png', w: F.w * 2, h: F.h * 2, name: `image${sl.pkg.media.size + 1}.png`, key };
  sl.pkg.media.set(key, rec);
  const crop = it.full ? { l: (it.x - F.x) / F.w, t: (it.y - F.y) / F.h, r: (F.x + F.w - it.x - it.w) / F.w, b: (F.y + F.h - it.y - it.h) / F.h } : null;
  return picXrec(sl, { x: it.x, y: it.y, w: it.w, h: it.h, name: it.name, alt: it.alt || it.name, op: op, rot: 0, crop }, rec, extra);
}
// picX variant for a record that is already in the package
const picXrec = (sl, it, rec, extra) => {
  extra = extra || {}; const id = sl.id(), rid = sl.media(rec), link = extra.link ? sl.link(extra.link) : '';
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xe(it.name || 'Graphic')}" descr="${xe(it.alt || '')}">${link ? `<a:hlinkClick r:id="${link}"${extra.link[0] === '#' ? ' action="ppaction://hlinksldjump"' : ''}/>` : ''}</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"${it.op != null && it.op < 1 ? `><a:alphaModFix amt="${Math.round(it.op * 100000)}"/></a:blip>` : '/>'}${it.crop ? srcRectX(it.crop) : ''}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(it.x, it.y, it.w, it.h, it.rot, extra.flipH, extra.flipV)}${it.clip ? custGeomX(it.clip, it.w, it.h) : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'}</p:spPr></p:pic>`;
};

/* ── free-form objects, from the model ── */
let probeEl = null;
function resolveColor(host, str, fallback) {
  if (!str) return fallback || null;
  const el = document.createElement('i'); el.style.color = str;
  if (!el.style.color) return /^(none|transparent)$/i.test(String(str).trim()) ? null : (fallback || null);   // not a colour: an invalid value would silently inherit the text colour
  host.appendChild(el);
  const cs = getComputedStyle(el).color, m = cs.match(/rgba?\(([^)]+)\)/); el.remove(); if (!m) return fallback || null;
  const t = m[1].split(/[\s,\/]+/).map(parseFloat), a = t.length > 3 ? t[3] : 1; if (a < .004) return null;
  const h = n => (Math.round(n) < 16 ? '0' : '') + Math.round(n).toString(16); return { c: h(t[0]) + h(t[1]) + h(t[2]), a };
}
const DEFAULTS = () => PC.OBJ_DEFAULTS;
async function objectsX(sl, s, info, host) {
  const list = s.objects || []; if (!list.length) return [];
  const slideEl = host.firstElementChild || host, out = [], D = DEFAULTS();
  const rc = (v, fb) => resolveColor(slideEl, v, fb);
  // first pass: shape ids so connectors can glue to them
  list.forEach(o => { sl.ids[o.id] = sl.id(); });
  const made = list.map(() => null), bounds = [];
  for (let k = 0; k < list.length; k++) {
    const o = list[k], d = Object.assign({}, D[o.type] || {}, o), rec = info[o.id] || {}, id = sl.ids[o.id], op = o.opacity != null ? o.opacity : 1;
    const h = o.h != null ? o.h : (rec.h || (PC.guessHeight ? PC.guessHeight(o) : 100));
    bounds[k] = { x: d.x, y: d.y, w: d.w, h: o.type === 'line' ? (o.h || 0) : h };
    const descr = xe(o.alt || ''), nm = xe(o.name || PC.objectLabel(o).slice(0, 40)), lnk = o.link && PC.okLink(o.link) ? sl.link(o.link) : '';
    const hl = lnk ? `<a:hlinkClick r:id="${lnk}"${o.link[0] === '#' ? ' action="ppaction://hlinksldjump"' : ''}/>` : '';
    const cNv = `<p:cNvPr id="${id}" name="${nm}" descr="${descr}">${hl}</p:cNvPr>`;
    if (o.type === 'text') {
      if (!rec.paras || !rec.paras.length) { made[k] = ''; continue; }
      const hasH = o.h != null, anchor = { top: 't', middle: 'ctr', bottom: 'b' }[d.valign] || 't';
      const it = { x: d.x, y: d.y, w: d.w, h: hasH ? o.h : h, paras: rec.paras, ins: [0, 0, 0, 0], anchor: hasH ? anchor : 't', wrap: rec.wrapOne && !hasH ? 'none' : 'square' };
      const wd = textWiden(it); if (o.fill2) { /* unused for text */ }
      made[k] = `<p:sp><p:nvSpPr>${cNv}<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(wd.x, it.y, wd.w, it.h, d.rot)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>${d.shadow ? shadowX({ dx: 0, dy: 6, blur: 18, c: '000000', a: .28 }) : ''}</p:spPr>${bodyX(it, sl, op, !!hasH)}</p:sp>`;
    } else if (o.type === 'shape' && (d.shape === 'line' || d.shape === 'connector')) {
      const col = rc(d.stroke || d.fill, { c: '333333', a: 1 }) || { c: '333333', a: 1 }, sw = d.strokeW || 6;
      made[k] = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${nm}" descr="${descr}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(d.x, d.y + h / 2, d.w, 0, d.rot)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${px(sw)}">${solid(col.c, col.a * op)}${d.dash === 'dashed' ? '<a:prstDash val="dash"/>' : d.dash === 'dotted' ? '<a:prstDash val="sysDot"/>' : ''}<a:round/>${d.shape === 'connector' ? '<a:tailEnd type="triangle" w="med" len="med"/>' : ''}</a:ln></p:spPr></p:cxnSp>`;
    } else if (o.type === 'shape') {
      const prst = SHAPE_PRST[d.shape] || 'rect', fillC = rc(d.fill, null), f2 = d.fill2 ? rc(d.fill2, null) : null, strokeC = d.stroke && d.strokeW > 0 ? rc(d.stroke, null) : null;
      let fx = '<a:noFill/>';
      if (f2 && fillC) { const a = ((d.gradAngle == null ? 90 : d.gradAngle) - 90 + 360) % 360; fx = gradFill({ ang: a, stops: [{ p: 0, c: fillC.c, a: fillC.a }, { p: 100, c: f2.c, a: f2.a }] }, op); }
      else if (fillC) fx = solid(fillC.c, fillC.a * op);
      const ln = strokeC ? lnX({ w: d.strokeW, c: strokeC.c, a: strokeC.a, dash: d.dash === 'dashed' ? 'dash' : d.dash === 'dotted' ? 'sysDot' : 'solid' }, op) : '<a:ln><a:noFill/></a:ln>';
      const av = prst === 'roundRect' ? `<a:gd name="adj" fmla="val ${Math.round(clampN((d.radius || 28) / Math.max(1, Math.min(d.w, h)) * 100000, 0, 50000))}"/>` : '';
      const pad = rec.pad || [14, 8, 14, 8], anchor = { top: 't', middle: 'ctr', bottom: 'b' }[d.valign] || 'ctr';
      const hasTxt = rec.paras && rec.paras.length;
      const it = { paras: hasTxt ? rec.paras : null, ins: [pad[0] + 6, pad[1], pad[2] + 6, pad[3]], anchor, wrap: rec.wrapOne ? 'none' : 'square' };   // one line: never wrap (a diamond's text area is smaller than the shape)
      made[k] = `<p:sp><p:nvSpPr>${cNv}<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(d.x, d.y, d.w, h, d.rot, d.flipH, d.flipV)}<a:prstGeom prst="${prst}"><a:avLst>${av}</a:avLst></a:prstGeom>${fx}${ln}${d.shadow ? shadowX({ dx: 0, dy: 10, blur: 28, c: '000000', a: .3 }) : ''}</p:spPr>${hasTxt ? bodyX(it, sl, op, true) : '<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></p:txBody>'}</p:sp>`;
    } else if (o.type === 'line') {
      const col = rc(d.stroke, { c: '333333', a: 1 }) || { c: '333333', a: 1 }, kind = d.kind || 'straight', w = d.w, hh = o.h || 0;
      const fr = connectorFrame(d, w, hh), prst = kind === 'elbow' ? 'bentConnector3' : kind === 'curve' ? 'curvedConnector3' : 'straightConnector1';
      const adj = kind === 'straight' ? '' : `<a:gd name="adj1" fmla="val ${Math.round(clampN(d.bend == null ? .5 : d.bend, .02, .98) * 100000)}"/>`;
      const cxn = (end, ref) => { if (!ref) return ''; const [oid, side] = ref.split(':'), tid = sl.ids[oid], tgt = list.find(x => x.id === oid); if (!tid || !tgt) return ''; const tp = tgt.type === 'shape' ? (SHAPE_PRST[tgt.shape || 'rect'] || 'rect') : null; const idx = tp && SITE_IDX[tp] ? SITE_IDX[tp][side] : null; return idx == null ? '' : `<a:${end}Cxn id="${tid}" idx="${idx}"/>`; };
      const wpx = d.strokeW || 5, dash = d.dash === 'dashed' ? '<a:prstDash val="dash"/>' : d.dash === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
      const he = ARROW[d.arrowStart] ? `<a:headEnd type="${ARROW[d.arrowStart]}" w="med" len="med"/>` : '', te = ARROW[d.arrowEnd] ? `<a:tailEnd type="${ARROW[d.arrowEnd]}" w="med" len="med"/>` : '';
      made[k] = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${nm}" descr="${descr}"/><p:cNvCxnSpPr>${cxn('st', d.from)}${cxn('end', d.to)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${fr.rot ? ` rot="${fr.rot * 60000}"` : ''}${fr.fh ? ' flipH="1"' : ''}${fr.fv ? ' flipV="1"' : ''}><a:off x="${px(d.x + fr.x)}" y="${px(d.y + fr.y)}"/><a:ext cx="${px(fr.w)}" cy="${px(fr.h)}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst>${adj}</a:avLst></a:prstGeom><a:ln w="${px(wpx)}" cap="flat">${solid(col.c, col.a * op)}${dash}<a:round/>${he}${te}</a:ln>${d.shadow ? shadowX({ dx: 0, dy: 4, blur: 10, c: '000000', a: .3 }) : ''}</p:spPr></p:cxnSp>`;
    } else if (o.type === 'image') {
      if (!o.src) { made[k] = ''; continue; }
      const sc = d.strokeW && d.stroke ? rc(d.stroke, null) : null;
      const line = sc ? { w: d.strokeW, c: sc.c, a: sc.a } : null;
      made[k] = (await picX(sl, { x: d.x, y: d.y, w: d.w, h: h, rot: d.rot, src: o.src, fit: d.fit, rad: d.radius || 0, name: o.name || 'Picture', alt: o.alt || '', op }, { flipH: d.flipH, flipV: d.flipV, link: lnk ? o.link : null, line })).replace(/<p:cNvPr id="\d+"/, `<p:cNvPr id="${id}"`);
    } else if (o.type === 'icon') {
      if (!rec.svg) { made[k] = ''; continue; }
      const bytes = await rasterSvg(rec.svg, d.w, h);
      if (!bytes) { made[k] = ''; continue; }
      const key = 'icon' + sl.pkg.media.size + '_' + bytes.length, mrec = { bytes, ext: 'png', w: d.w * 2, h: h * 2, name: `image${sl.pkg.media.size + 1}.png`, key }; sl.pkg.media.set(key, mrec);
      made[k] = picXrec(sl, { x: d.x, y: d.y, w: d.w, h: h, rot: d.rot, name: o.name || 'Icon ' + (d.icon || ''), alt: o.alt || d.icon || '', op }, mrec, { flipH: d.flipH, flipV: d.flipV, link: lnk ? o.link : null }).replace(/<p:cNvPr id="\d+"/, `<p:cNvPr id="${id}"`);
    } else made[k] = '';
  }
  // grouped objects become one PowerPoint group, placed where its first member is
  const seen = new Set();
  list.forEach((o, k) => {
    if (!made[k]) return;
    if (!o.group) { out.push(made[k]); return; }
    if (seen.has(o.group)) return; seen.add(o.group);
    const idxs = list.map((x, j) => (x.group === o.group && made[j] ? j : -1)).filter(j => j >= 0);
    if (idxs.length < 2) { out.push(made[k]); return; }
    const bx = idxs.map(j => bounds[j]), x0 = Math.min(...bx.map(b => b.x)), y0 = Math.min(...bx.map(b => b.y)), x1 = Math.max(...bx.map(b => b.x + b.w)), y1 = Math.max(...bx.map(b => b.y + b.h));
    const gid = sl.id();
    out.push(`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${gid}" name="Group ${xe(o.group)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${px(x0)}" y="${px(y0)}"/><a:ext cx="${px(x1 - x0)}" cy="${px(y1 - y0)}"/><a:chOff x="${px(x0)}" y="${px(y0)}"/><a:chExt cx="${px(x1 - x0)}" cy="${px(y1 - y0)}"/></a:xfrm></p:grpSpPr>${idxs.map(j => made[j]).join('')}</p:grpSp>`);
  });
  return out;
}

/* ── package parts ── */
const TRANS = { none: '', fade: '<p:transition spd="med"><p:fade/></p:transition>', slide: '<p:transition spd="med"><p:push dir="l"/></p:transition>', zoom: '<p:transition spd="med"><p:fade/></p:transition>', rise: '<p:transition spd="med"><p:push dir="u"/></p:transition>', blur: '<p:transition spd="med"><p:fade/></p:transition>' };
function slideXml(sl, shapes, bg, s, meta) {
  let bgx = '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';
  if (bg && bg.grad) bgx = `<p:bg><p:bgPr>${gradFill(bg.grad)}<a:effectLst/></p:bgPr></p:bg>`; else if (bg && bg.fill) bgx = `<p:bg><p:bgPr>${solid(bg.fill.c, 1)}<a:effectLst/></p:bgPr></p:bg>`;
  const tr = TRANS[PC.transitionOf({ meta }, s)] || '';
  return `${HDR}<p:sld ${NS}${s.hidden ? ' show="0"' : ''}><p:cSld>${bgx}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${tr}</p:sld>`;
}
const RT = { slide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', layout: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', master: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  notes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide', notesMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster', pres: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps', view: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps', tbl: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles' };
const relsXml = list => `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(r => `<Relationship Id="${r.id}" Type="${RT[r.type] || r.type}" Target="${xe(r.target)}"${r.ext ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;

function themeXml(name, c, majorFont, minorFont) {
  const k = x => (x || '000000').toUpperCase();
  return `${HDR}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${xe(name)}"><a:themeElements><a:clrScheme name="${xe(name)}"><a:dk1><a:srgbClr val="${k(c.fg)}"/></a:dk1><a:lt1><a:srgbClr val="${k(c.bg)}"/></a:lt1><a:dk2><a:srgbClr val="${k(c.muted)}"/></a:dk2><a:lt2><a:srgbClr val="${k(c.tint)}"/></a:lt2>`
    + [1, 2, 3, 4, 5, 6].map(n => `<a:accent${n}><a:srgbClr val="${k(c['c' + n])}"/></a:accent${n}>`).join('') + `<a:hlink><a:srgbClr val="${k(c.c1)}"/></a:hlink><a:folHlink><a:srgbClr val="${k(c.c5)}"/></a:folHlink></a:clrScheme>`
    + `<a:fontScheme name="${xe(name)}"><a:majorFont><a:latin typeface="${xe(majorFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${xe(minorFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
    + '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
    + '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
    + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
}
const phTitle = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${px(80)}" y="${px(48)}"/><a:ext cx="${px(1120)}" cy="${px(120)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"/><a:t>Click to edit the title</a:t></a:r></a:p></p:txBody></p:sp>`;
const grpHead = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const masterXml = (bg, fg, font) => `${HDR}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr>${solid(bg)}<a:effectLst/></p:bgPr></p:bg><p:spTree>${grpHead}${phTitle}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4000" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="2000"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr algn="l"><a:defRPr sz="1800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
const layoutXml = `${HDR}<p:sldLayout ${NS} type="titleOnly" preserve="1"><p:cSld name="Title Only"><p:spTree>${grpHead}${phTitle.replace('Title 1', 'Title 1')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
const notesMasterXml = `${HDR}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grpHead}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-GB"/><a:t>Click to edit notes</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;
const notesXml = text => `${HDR}<p:notes ${NS}><p:cSld><p:spTree>${grpHead}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${String(text).split(/\r?\n/).map(l => `<a:p><a:r><a:rPr lang="en-GB" dirty="0"/><a:t>${xe(l)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;

/* ── reading the slides ── */
/** A custom slide reports its own layout, so its answer is untrusted: only plain numbers, bounded strings, hex colours, known-safe links and pictures survive. */
const HEX6 = /^[0-9a-f]{6}$/i, KEY_OK = /^[A-Za-z0-9_]{1,24}$/;
const WALK_ENUM = { k: ['text', 'box', 'line', 'img', 'svg'], dash: ['solid', 'dash', 'sysDot', 'sysDash', 'dot', 'lgDash', 'dashDot'], al: ['l', 'ctr', 'r', 'just'], anchor: ['t', 'ctr', 'b'], wrap: ['square', 'none'], radMode: ['all', 'top'], role: ['body', 'title'] };
const WALK_TEXT = new Set(['t', 'name', 'alt', 'warn']);
const WALK_NUM = new Set(['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'rot', 'rad', 'op', 'a', 'p', 'ang', 'at', 'sz', 'sp', 'lh', 'ins', 'dx', 'dy', 'blur', 'sb', 'sb0', 'pl', 'ml', 'pad']);
function cleanWalk(v, key, depth) {
  if (v == null || depth > 9) return v == null ? v : undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, v)) : 0;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (key === 'c' || key === 'hl') return HEX6.test(v) ? v.toLowerCase() : '000000';
    if (key === 'f') return PC.cleanFont(v) || 'Arial';
    if (key === 'link' || key === 'href') return PC.okLink(v) ? v.slice(0, 2000) : '';
    if (key === 'src') return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(v) ? v.slice(0, 12e6) : /^https?:\/\//i.test(v) && v.length < 2000 ? v : '';
    if (key === 'markup' || key === 'svg') return v.slice(0, 2e6);
    if (key === 'fonts') return PC.cleanFont(v) || 'Arial';
    if (key === 'size' || key === 'pos') return /^[\w%\s.,()-]{0,60}$/.test(v) ? v : '';   // background-size / -position, e.g. "66% 30%"
    if (WALK_ENUM[key]) return WALK_ENUM[key].includes(v) ? v : WALK_ENUM[key][0];
    if (WALK_TEXT.has(key)) return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 50000);
    if (WALK_NUM.has(key)) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    return /^[\w-]{0,24}$/.test(v) ? v : '';   // any other field is a short token that goes into an XML attribute
  }
  if (Array.isArray(v)) return v.slice(0, 5000).map(x => cleanWalk(x, key, depth + 1));
  if (typeof v === 'object') { const o = {}; Object.keys(v).slice(0, 80).forEach(k => { if (!KEY_OK.test(k)) return; const x = cleanWalk(v[k], k, depth + 1); if (x !== undefined) o[k] = x; }); return o; }
  return undefined;
}
PC.cleanWalk = r => cleanWalk(r, '', 0);
function frameWalk(s, deck) {
  return new Promise(resolve => {
    const f = document.createElement('iframe'), id = 'x' + Math.random().toString(36).slice(2); let done = false, poke = 0;
    f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    // On screen but underneath everything and see-through: a frame that is scrolled out of view is throttled by the browser (no animation frames, slow timers),
    // which freezes a slide's own counters and charts halfway.
    f.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:720px;border:0;pointer-events:none;z-index:-1;opacity:.001';
    const finish = r => { if (done) return; done = true; window.removeEventListener('message', onMsg); clearTimeout(to); clearInterval(poke); f.remove(); resolve(r); };
    const onMsg = e => { if (e.source !== f.contentWindow || !e.data || e.data.pc !== 'export-result' || e.data.id !== id) return; const r = e.data.result; finish(r && typeof r === 'object' && !r.error && Array.isArray(r.items) ? PC.cleanWalk(r) : { error: String((r && r.error) || 'no usable result').slice(0, 200) }); };
    const to = setTimeout(() => finish({ error: 'the slide did not answer within 20s' }), 20000);
    window.addEventListener('message', onMsg);
    f.addEventListener('load', () => setTimeout(() => { const ask = () => { try { f.contentWindow.postMessage({ pc: 'export', id }, '*'); } catch (x) { finish({ error: String(x) }); } }; ask(); poke = setInterval(ask, 2000); }, 700));
    f.srcdoc = PC.customDoc(s, deck.meta, 'export'); document.body.appendChild(f);
  });
}
async function settle(host, ms) {
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* ok */ }
  const imgs = Array.from(host.querySelectorAll('img')).filter(i => !i.complete);
  if (imgs.length) await Promise.race([Promise.all(imgs.map(i => new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), new Promise(r => setTimeout(r, ms || 5000))]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * Build the .pptx for a deck. Returns { bytes, name, report }.
 * report: { slides, warnings[], fonts[], objects } so the caller can tell the user what to check.
 */
PC.pptx = async function (deck, opt) {
  opt = opt || {}; deck = deck || S.deck; fontMode = opt.fonts === 'keep' ? 'keep' : 'similar'; const say = opt.progress || (() => {}); picLoads.clear(); picWhy.clear();
  const host = document.createElement('div'); host.id = 'export-host'; host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;pointer-events:none;overflow:hidden'; document.body.appendChild(host);
  const pkg = { media: new Map(), warn: [], walks: [], slideIds: deck.slides.map(s => s.id), fonts: new Set() };
  try {
    // theme colours and fonts as PowerPoint's own colour scheme, so recolouring and "Design" tools still make sense
    host.innerHTML = PC.renderSlide({ id: 'probe', layout: 'blank' }, { editable: false, index: 0, total: 1, deck, mode: 'thumb' });
    const probe = host.firstElementChild, ps = getComputedStyle(probe), v = n => ps.getPropertyValue(n).trim();
    const cc = n => { const r = resolveColor(probe, n, null); return r ? r.c : null; };
    const colours = { fg: cc('var(--fg)') || '14122b', bg: cc('var(--slide-bg)') || 'ffffff', muted: cc('var(--muted)') || '666666', tint: cc('var(--tint-bg)') || 'eeeeee' };
    for (let n = 1; n <= 6; n++) colours['c' + n] = cc(`var(--c${n})`) || '5b4bff';
    const fam = n => { const e = document.createElement('i'); e.style.fontFamily = `var(${n})`; probe.appendChild(e); const f = getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''); e.remove(); return f || 'Arial'; };
    const majorFont = PC.pptxFont(fam('--font-d')).name, minorFont = PC.pptxFont(fam('--font-b')).name;
    await preloadLinked(deck, say);
    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i]; say(`Reading slide ${i + 1} of ${deck.slides.length}`, .1 + .8 * i / deck.slides.length);
      host.innerHTML = PC.renderSlide(s, { editable: false, index: i, total: deck.slides.length, deck, mode: 'thumb' });
      await settle(host);
      const slideEl = host.firstElementChild; let res = PC.walk(slideEl);
      if (s.layout === 'custom') {
        const r = await frameWalk(s, deck);
        if (r.error) { pkg.warn.push(`Slide ${i + 1} (custom code) could not be read: ${r.error}. It is exported as an empty slide.`); res = Object.assign(res, { items: [], bg: res.bg }); }
        else res = { bg: r.bg, items: r.items, objs: res.objs, warn: r.warn || [], fonts: r.fonts };
      }
      (res.warn || []).forEach(w => { if (!pkg.warn.includes(`Slide ${i + 1}: ${w}`)) pkg.warn.push(`Slide ${i + 1}: ${w}`); });
      (res.fonts || []).forEach(f => pkg.fonts.add(f));
      pkg.walks.push(res);
      pkg.walks[i].host = null;
      // build immediately while this slide is still the one in the host (object colours resolve through its theme scope)
      say(`Building slide ${i + 1} of ${deck.slides.length}`, .1 + .8 * (i + .5) / deck.slides.length);
      const built = await buildSlide(pkg, s, i, host, deck.meta);
      pkg.walks[i] = Object.assign({}, res, { built });
    }
    say('Packing the file', .92);
    const files = [], N = deck.slides.length, title = deck.meta.name || deck.meta.title || 'Presentation';
    const ct = [`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`, `<Default Extension="xml" ContentType="application/xml"/>`, '<Default Extension="png" ContentType="image/png"/>', '<Default Extension="jpeg" ContentType="image/jpeg"/>', '<Default Extension="gif" ContentType="image/gif"/>',
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>', '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>', '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
      '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>', '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>',
      '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>', '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>',
      '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>', '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>', '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
    deck.slides.forEach((s, i) => { ct.push(`<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`); if (s.notes) ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`); });
    files.push({ name: '[Content_Types].xml', data: `${HDR}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join('')}</Types>` });
    files.push({ name: '_rels/.rels', data: relsXml([{ id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', target: 'ppt/presentation.xml' }, { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' }, { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties', target: 'docProps/app.xml' }]) });
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({ name: 'docProps/core.xml', data: `${HDR}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(title)}</dc:title><dc:creator>Pitchcraft</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
    files.push({ name: 'docProps/app.xml', data: `${HDR}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Pitchcraft</Application><Slides>${N}</Slides></Properties>` });
    const pr = [{ id: 'rId1', type: 'master', target: 'slideMasters/slideMaster1.xml' }, { id: 'rId2', type: 'pres', target: 'presProps.xml' }, { id: 'rId3', type: 'view', target: 'viewProps.xml' }, { id: 'rId4', type: 'theme', target: 'theme/theme1.xml' }, { id: 'rId5', type: 'tbl', target: 'tableStyles.xml' }, { id: 'rId6', type: 'notesMaster', target: 'notesMasters/notesMaster1.xml' }];
    deck.slides.forEach((s, i) => pr.push({ id: 'rId' + (7 + i), type: 'slide', target: `slides/slide${i + 1}.xml` }));
    files.push({ name: 'ppt/presentation.xml', data: `${HDR}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId6"/></p:notesMasterIdLst><p:sldIdLst>${deck.slides.map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${7 + i}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${SW * EMU}" cy="${SH * EMU}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` });
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: relsXml(pr) });
    files.push({ name: 'ppt/presProps.xml', data: `${HDR}<p:presentationPr ${NS}/>` }, { name: 'ppt/viewProps.xml', data: `${HDR}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` }, { name: 'ppt/tableStyles.xml', data: `${HDR}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
    files.push({ name: 'ppt/theme/theme1.xml', data: themeXml(title, colours, majorFont, minorFont) }, { name: 'ppt/theme/theme2.xml', data: themeXml('Notes', colours, minorFont, minorFont) });
    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: masterXml(colours.bg, colours.fg, minorFont) }, { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: relsXml([{ id: 'rId1', type: 'layout', target: '../slideLayouts/slideLayout1.xml' }, { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' }]) });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: layoutXml }, { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: relsXml([{ id: 'rId1', type: 'master', target: '../slideMasters/slideMaster1.xml' }]) });
    files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: notesMasterXml }, { name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: relsXml([{ id: 'rId1', type: 'theme', target: '../theme/theme2.xml' }]) });
    deck.slides.forEach((s, i) => {
      const b = pkg.walks[i].built, rels = [{ id: 'rId1', type: 'layout', target: '../slideLayouts/slideLayout1.xml' }].concat(b.sl.rels);
      if (s.notes) { rels.push({ id: 'rId' + (b.sl.rels.length + 2), type: 'notes', target: `../notesSlides/notesSlide${i + 1}.xml` }); files.push({ name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: notesXml(s.notes) }, { name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: relsXml([{ id: 'rId1', type: 'notesMaster', target: '../notesMasters/notesMaster1.xml' }, { id: 'rId2', type: 'slide', target: `../slides/slide${i + 1}.xml` }]) }); }
      files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: b.xml }, { name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: relsXml(rels) });
    });
    pkg.media.forEach(m => files.push({ name: 'ppt/media/' + m.name, data: m.bytes, store: true }));
    const bytes = await PC.zip(files);
    const safe = String(title).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'presentation';
    return { bytes, files, name: safe + '.pptx', report: { slides: N, warnings: pkg.warn, fonts: Array.from(pkg.fonts).sort(), fontMap: Array.from(pkg.fonts).sort().map(f => ({ from: f, to: PC.pptxFont(f).name })), fontMode, pictures: pkg.media.size } };
  } finally { host.remove(); }
};
})();
