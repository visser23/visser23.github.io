/* ── Portable decks: what will NOT travel inside a .pitchcraft file, and a way to fix the pictures ──
   Pictures you add from your computer are stored inside the deck as data: URIs, so they travel. Pictures that are only LINKED (an https
   address, or a path) stay links and show as blanks on another computer, offline, or when the link dies. Fonts are never stored: the ones
   Pitchcraft ships travel with the app; others show only on computers that have them.
   PC.deckPortability(deck) -> { links: [url...], fonts: [name...] }
   PC.embedLinked(deck, urls)  -> Promise<{ deck, embedded: n, failed: [url...] }>   (a copy; best effort: the site must allow the picture to be read) */
(function () {
  'use strict';
  const PC = window.PC;
  const COMMON = new Set(['arial', 'helvetica', 'helvetica neue', 'times new roman', 'times', 'georgia', 'verdana', 'tahoma', 'trebuchet ms', 'courier new', 'courier', 'impact', 'comic sans ms', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'inherit', 'initial', 'unset', 'emoji', 'math']);
  const FONT_URL = /\.(woff2?|ttf|otf|eot)(\?|#|$)|fonts\.(googleapis|gstatic)\.com/i;
  const isLink = u => typeof u === 'string' && /^(https?:\/\/|\.{1,2}\/|\/[^/])/i.test(u.trim());
  const bundled = () => { const s = new Set(); Object.entries(PC.FONTS || {}).forEach(([k, f]) => { s.add(k.toLowerCase()); if (f.name) s.add(String(f.name).toLowerCase()); }); return s; };

  function scanMarkup(t, links, fonts, own) {
    if (!t) return;
    (String(t).match(/url\(\s*(['"]?)[^'")\s]+\1\s*\)/gi) || []).forEach(m => { const u = m.replace(/^url\(\s*['"]?|['"]?\s*\)$/gi, ''); if (isLink(u) && !FONT_URL.test(u)) links.add(u); });
    (String(t).match(/<img\b[^>]*\bsrc\s*=\s*(["'])[^"']+\1/gi) || []).forEach(m => { const u = m.replace(/^[^]*?src\s*=\s*["']/i, '').replace(/["']$/, ''); if (isLink(u)) links.add(u); });
    (String(t).match(/font-family\s*:\s*[^;}"]+/gi) || []).forEach(d => d.replace(/^font-family\s*:\s*/i, '').split(',').forEach(n => { n = n.replace(/!important/gi, '').replace(/['"]/g, '').trim().toLowerCase(); if (n && !/^var\(/.test(n) && !COMMON.has(n) && !own.has(n)) fonts.add(n); }));
  }
  PC.deckPortability = function (deck) {
    const links = new Set(), fonts = new Set(), own = bundled();
    (deck.slides || []).forEach(s => {
      [s.bgImage, s.image && s.image.src].forEach(u => { if (isLink(u)) links.add(u); });
      (s.objects || []).forEach(o => { if (o.type === 'image' && isLink(o.src)) links.add(o.src); if (o.font && !PC.has(PC.FONTS, o.font) && !COMMON.has(String(o.font).toLowerCase())) fonts.add(String(o.font).toLowerCase()); });
      if (s.custom) { scanMarkup(s.custom.html, links, fonts, own); scanMarkup(s.custom.css, links, fonts, own); }
    });
    if (deck.meta) scanMarkup(deck.meta.css, links, fonts, own);
    return { links: Array.from(links), fonts: Array.from(fonts).map(n => n.replace(/\b\w/g, c => c.toUpperCase())) };
  };

  function toData(url) {
    return new Promise(resolve => {
      if (/\.svg(\?|#|$)/i.test(url)) return resolve(null);
      const im = new Image(), t = setTimeout(() => resolve(null), 15000); im.crossOrigin = 'anonymous';
      im.onload = () => {
        clearTimeout(t);
        try {
          const k = Math.min(1, 1920 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          let d = cv.toDataURL('image/png'); if (d.length > 900 * 1024) d = cv.toDataURL('image/jpeg', .86);
          resolve(d.length > 3.2 * 1024 * 1024 ? null : d);
        } catch (e) { resolve(null); }   // a tainted canvas: the site did not allow it
      };
      im.onerror = () => { clearTimeout(t); resolve(null); };
      im.src = new URL(url, document.baseURI).href;
    });
  }
  PC.embedLinked = async function (deck, urls) {
    const out = PC.clone(deck), map = new Map(), failed = [];
    for (const u of urls.slice(0, 60)) { const d = await toData(u); if (d) map.set(u, d); else failed.push(u); }
    const lim = (PC.LIMITS && PC.LIMITS.custom) || 300000, swap = t => { let r = t; map.forEach((d, u) => { r = r.split(u).join(d); }); return r; };
    out.slides.forEach(s => {
      if (map.has(s.bgImage)) s.bgImage = map.get(s.bgImage);
      if (s.image && map.has(s.image.src)) s.image.src = map.get(s.image.src);
      (s.objects || []).forEach(o => { if (o.type === 'image' && map.has(o.src)) o.src = map.get(o.src); });
      if (s.custom) ['html', 'css'].forEach(f => {
        if (!s.custom[f]) return; const r = swap(s.custom[f]);
        if (r !== s.custom[f]) { if (r.length <= lim) s.custom[f] = r; else map.forEach((d, u) => { if (s.custom[f].includes(u) && !failed.includes(u)) failed.push(u); }); }   // too big for one field: it stays linked
      });
    });
    return { deck: out, embedded: Array.from(map.keys()).filter(u => !failed.includes(u)).length, failed };
  };
})();
