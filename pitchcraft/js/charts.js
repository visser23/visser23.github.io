/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT charts — pure SVG, themeable via CSS variables (--c1…--c6)
   All charts are drawn at real slide pixels (the stage is a fixed 1280×720).
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC;
const esc = PC.esc;

const fmt = n => {
  if (typeof n !== 'number' || isNaN(n)) return String(n ?? '');
  const a = Math.abs(n);
  if (a >= 1e9) return +(n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return +(n / 1e3).toFixed(1) + 'k';
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(1));
};
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const col = (o, i) => (o && o.color && PC.okColor(o.color) ? o.color : `var(--c${(i % 6) + 1})`);

function niceScale(max) {
  if (max <= 0) return { max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step, ticks = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(+v.toFixed(6));
  return { max: top, step, ticks };
}

/* Fritsch–Carlson monotone cubic: smooth lines that never overshoot the data */
function monotone(pts) {
  const n = pts.length; if (n < 2) return '';
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    d += `C${(pts[i].x + dx[i] / 3).toFixed(1)},${(pts[i].y + t[i] * dx[i] / 3).toFixed(1)} ${(pts[i + 1].x - dx[i] / 3).toFixed(1)},${(pts[i + 1].y - t[i + 1] * dx[i] / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

function series(data) {
  const labels = (data.labels || []).map(String);
  const ss = (data.series || []).map(s => ({ name: String(s.name ?? ''), color: s.color, values: (s.values || []).map(num) }));
  return { labels, ss };
}

/* ── bar (vertical, grouped) ── */
function bar(data, w, h) {
  const { labels, ss } = series(data);
  const max = Math.max(1, ...ss.flatMap(s => s.values)), sc = niceScale(max);
  const padL = 12 + String(fmt(sc.max)).length * 10, padR = 8, padT = 26, padB = 40;
  const pw = w - padL - padR, ph = h - padT - padB, N = Math.max(labels.length, 1), S = Math.max(ss.length, 1);
  const gw = pw / N, bw = Math.min(64, (gw * 0.62) / S), gap = 6, cw = bw * S + gap * (S - 1);
  let g = '', b = '', l = '', v = '';
  sc.ticks.forEach(t => {
    const y = padT + ph - (t / sc.max) * ph;
    g += `<line class="pc-grid" x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}"/><text class="pc-tick" x="${padL - 10}" y="${y + 5}" text-anchor="end">${fmt(t)}</text>`;
  });
  labels.forEach((lb, i) => {
    const gx = padL + i * gw + (gw - cw) / 2;
    ss.forEach((s, si) => {
      const val = s.values[i] ?? 0, bh = Math.max(0, (val / sc.max) * ph), x = gx + si * (bw + gap), y = padT + ph - bh, r = Math.min(10, bw / 2, bh);
      b += `<path class="pc-bar" style="--i:${i * S + si};fill:${col(s, si)}" d="M${x},${y + bh}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + bh}Z"><title>${esc(lb)} · ${esc(s.name)}: ${val}</title></path>`;
      v += `<text class="pc-val" x="${x + bw / 2}" y="${y - 9}" text-anchor="middle">${fmt(val)}</text>`;
    });
    l += `<text class="pc-cat" x="${padL + i * gw + gw / 2}" y="${h - 12}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<svg class="pc-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${g}${b}${v}${l}</svg>`;
}

/* ── horizontal bar ── */
function hbar(data, w, h) {
  const { labels, ss } = series(data);
  const max = Math.max(1, ...ss.flatMap(s => s.values)), sc = niceScale(max);
  const padL = Math.min(240, 24 + Math.max(...labels.map(x => x.length), 4) * 9.5), padR = 64, padT = 8, padB = 8;
  const pw = w - padL - padR, ph = h - padT - padB, N = Math.max(labels.length, 1), S = Math.max(ss.length, 1);
  const rh = ph / N, bh = Math.min(38, (rh * 0.66) / S), gap = 4, ch = bh * S + gap * (S - 1);
  let g = '', b = '';
  sc.ticks.forEach(t => { const x = padL + (t / sc.max) * pw; g += `<line class="pc-grid" x1="${x}" x2="${x}" y1="${padT}" y2="${h - padB}"/>`; });
  labels.forEach((lb, i) => {
    const cy = padT + i * rh + (rh - ch) / 2;
    b += `<text class="pc-cat" x="${padL - 14}" y="${padT + i * rh + rh / 2 + 5}" text-anchor="end">${esc(lb)}</text>`;
    ss.forEach((s, si) => {
      const val = s.values[i] ?? 0, bw = Math.max(0, (val / sc.max) * pw), y = cy + si * (bh + gap), r = Math.min(10, bh / 2, bw);
      b += `<path class="pc-bar pc-hbar" style="--i:${i * S + si};fill:${col(s, si)}" d="M${padL},${y}H${padL + bw - r}Q${padL + bw},${y} ${padL + bw},${y + r}V${y + bh - r}Q${padL + bw},${y + bh} ${padL + bw - r},${y + bh}H${padL}Z"><title>${esc(lb)} · ${esc(s.name)}: ${val}</title></path>`;
      b += `<text class="pc-val" x="${padL + bw + 10}" y="${y + bh / 2 + 5}">${fmt(val)}</text>`;
    });
  });
  return `<svg class="pc-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${g}${b}</svg>`;
}

/* ── line / area ── */
function line(data, w, h, area) {
  const { labels, ss } = series(data);
  const max = Math.max(1, ...ss.flatMap(s => s.values)), sc = niceScale(max);
  const padL = 12 + String(fmt(sc.max)).length * 10, padR = 28, padT = 30, padB = 40;
  const pw = w - padL - padR, ph = h - padT - padB, N = Math.max(labels.length, 2);
  const X = i => padL + (i * pw) / (N - 1), Y = v => padT + ph - (v / sc.max) * ph;
  const id = PC.uid('ar');
  let g = '', defs = '', body = '', l = '';
  sc.ticks.forEach(t => { const y = Y(t); g += `<line class="pc-grid" x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}"/><text class="pc-tick" x="${padL - 10}" y="${y + 5}" text-anchor="end">${fmt(t)}</text>`; });
  labels.forEach((lb, i) => { l += `<text class="pc-cat" x="${X(i)}" y="${h - 12}" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}">${esc(lb)}</text>`; });
  ss.forEach((s, si) => {
    const c = col(s, si), pts = s.values.map((v, i) => ({ x: X(i), y: Y(v), v }));
    if (!pts.length) return;
    const d = monotone(pts.length > 1 ? pts : [pts[0], { x: pts[0].x + 1, y: pts[0].y }]);
    if (area || s.fill) {
      defs += `<linearGradient id="${id}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.38"/><stop offset="1" style="stop-color:${c};stop-opacity:0"/></linearGradient>`;
      body += `<path class="pc-area" d="${d}L${pts[pts.length - 1].x},${padT + ph}L${pts[0].x},${padT + ph}Z" style="fill:url(#${id}${si})"/>`;
    }
    body += `<path class="pc-line" pathLength="1" d="${d}" style="stroke:${c}"/>`;
    pts.forEach((p, i) => { body += `<circle class="pc-dot" style="--i:${i};fill:${c}" cx="${p.x}" cy="${p.y}" r="5.5"><title>${esc(labels[i] ?? '')} · ${esc(s.name)}: ${p.v}</title></circle>`; });
    const last = pts[pts.length - 1], tx = Math.min(last.x, w - 34);
    body += `<g class="pc-flag"><rect x="${tx - 26}" y="${last.y - 38}" width="52" height="26" rx="8" style="fill:${c}"/><text x="${tx}" y="${last.y - 20}" text-anchor="middle">${fmt(last.v)}</text></g>`;
  });
  return `<svg class="pc-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><defs>${defs}</defs>${g}${body}${l}</svg>`;
}

/* ── donut ── */
function donut(data, w, h) {
  const segs = (data.segments || []).map(s => ({ label: String(s.label ?? ''), value: Math.max(0, num(s.value)), color: s.color }));
  const total = segs.reduce((a, s) => a + s.value, 0) || 1, size = Math.min(w, h), cx = w / 2, cy = h / 2, R = size / 2 - 34, sw = Math.max(34, size * 0.17);
  let cum = 0, arcs = '';
  segs.forEach((s, i) => {
    const pct = (s.value / total) * 100, gap = segs.length > 1 ? 0.8 : 0;
    arcs += `<circle class="pc-seg" style="--i:${i};stroke:${col(s, i)}" cx="${cx}" cy="${cy}" r="${R}" pathLength="100" stroke-width="${sw}" stroke-dasharray="${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}" stroke-dashoffset="${-cum}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label)}: ${s.value}</title></circle>`;
    cum += pct;
  });
  const cl = data.centerLabel ? `<text class="pc-center" x="${cx}" y="${cy + (data.centerSub ? 4 : 14)}" text-anchor="middle">${esc(data.centerLabel)}</text>` : '';
  const cs = data.centerSub ? `<text class="pc-centersub" x="${cx}" y="${cy + 34}" text-anchor="middle">${esc(data.centerSub)}</text>` : '';
  return `<svg class="pc-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><circle class="pc-ring" cx="${cx}" cy="${cy}" r="${R}" stroke-width="${sw}"/>${arcs}${cl}${cs}</svg>`;
}

function legend(type, data) {
  if (type === 'donut') {
    const segs = data.segments || [], total = segs.reduce((a, s) => a + Math.max(0, num(s.value)), 0) || 1;
    return `<ul class="pc-legend v">${segs.map((s, i) => `<li><i style="background:${col(s, i)}"></i><span>${esc(s.label)}</span><b>${Math.round((num(s.value) / total) * 100)}%</b></li>`).join('')}</ul>`;
  }
  const ss = data.series || [];
  return ss.length > 1 ? `<ul class="pc-legend">${ss.map((s, i) => `<li><i style="background:${col(s, i)}"></i><span>${esc(s.name)}</span></li>`).join('')}</ul>` : '';
}

PC.Charts = {
  svg(type, data, w, h) {
    data = data || {};
    if (type === 'donut') return donut(data, w, h);
    if (!(data.labels || []).length || !(data.series || []).length) return `<div class="pc-empty" style="width:${w}px;height:${h}px">Add labels and a series in the Slide tab</div>`;
    if (type === 'hbar') return hbar(data, w, h);
    if (type === 'line') return line(data, w, h, false);
    if (type === 'area') return line(data, w, h, true);
    return bar(data, w, h);
  },
  legend,
  /** Full chart block: for donut the legend sits beside the ring, otherwise above the plot. */
  block(type, data, w, h) {
    data = data || {};
    if (type === 'donut') {
      const dw = Math.min(h, Math.round(w * 0.5));
      return `<div class="pc-donut-wrap">${this.svg('donut', data, dw, h)}${legend('donut', data)}</div>`;
    }
    const lg = legend(type, data);
    return `${lg}${this.svg(type, data, w, h - (lg ? 34 : 0))}`;
  }
};
})();
