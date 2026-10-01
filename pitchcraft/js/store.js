/* ═══════════════════════════════════════════════════════════════
   PITCHCRAFT store — deck state, undo/redo (with typing coalescing), autosave
   Events: 'deck' (everything changed) · 'slide' {i,src} (one slide restructured)
           'text' {i,path,src} (a text value changed) · 'meta' · 'select' {i,src} · 'history' · 'saved'
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const PC = window.PC, KEY = 'pitchcraft.deck.v3', BKEY = 'pitchcraft.backups.v1';
const listeners = {};

const S = PC.store = {
  deck: null, sel: 0, past: [], future: [], pastB: [], futureB: [], crossed: false, snap: '', lastKey: '', lastT: 0, saveTimer: 0, storageOk: true,

  on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  emit(ev, a) { (listeners[ev] || []).slice().forEach(f => f(a)); },
  slide(i = S.sel) { return S.deck.slides[i]; },
  count() { return S.deck.slides.length; },
  indexOf(idOrIndex) { if (typeof idOrIndex === 'number') return idOrIndex; return S.deck.slides.findIndex(s => s.id === idOrIndex); },

  /* ── persistence ── */
  init() {
    let deck = null;
    try { const raw = localStorage.getItem(KEY); if (raw) deck = PC.parseDeck(raw).deck; } catch (e) { console.warn('[pitchcraft] saved deck ignored:', e.message); }
    S.deck = deck || PC.parseDeck(PC.clone(PC.TEMPLATES[0].deck)).deck;
    S.sel = 0; S.snap = JSON.stringify(S.deck); S.past = []; S.future = []; S.pastB = []; S.futureB = [];
  },
  save() {
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S.deck)); S.storageOk = true; S.emit('saved', true); }
      catch (e) { if (S.storageOk) { S.storageOk = false; PC.ui.toast('Browser storage is full or blocked, so autosave is off. Export your deck to keep it.', 'bad'); } S.emit('saved', false); }
    }, 350);
    S.emit('saved', null);
  },
  saveNow() { clearTimeout(S.saveTimer); try { localStorage.setItem(KEY, JSON.stringify(S.deck)); } catch (e) { /* noop */ } },

  /* ── backups: the last few decks that were replaced or undone away, kept in localStorage ── */
  backups() { try { const a = JSON.parse(localStorage.getItem(BKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  backup(snap, reason) {
    try {
      if (!snap || snap.length > 1500000) return;
      const d = JSON.parse(snap), n = (d.slides || []).length; if (!n) return;
      let a = S.backups(); if (a.length && a[0].deck === snap) return;
      const first = d.slides[0] || {}, title = (d.meta && (d.meta.name || d.meta.title)) || first.headline || first.title || 'Untitled deck';
      a.unshift({ t: Date.now(), reason: String(reason || 'Replaced').slice(0, 40), title: String(title).replace(/<[^>]*>/g, '').slice(0, 80), slides: n, deck: snap });
      a = a.slice(0, 6);
      while (a.length) { try { localStorage.setItem(BKEY, JSON.stringify(a)); return; } catch (e) { a.pop(); } }
    } catch (e) { /* backups are best effort */ }
  },
  restoreBackup(i) {
    const b = S.backups()[i]; if (!b) return false;
    try { const r = PC.parseDeck(b.deck); S.load(r.deck, { reason: 'Before restore' }); return true; } catch (e) { return false; }
  },

  /* ── history ── */
  commit(key) {
    const now = JSON.stringify(S.deck); if (now === S.snap) return false;
    const t = Date.now();
    if (!(key && key === S.lastKey && t - S.lastT < 1500)) { S.past.push(S.snap); S.pastB.push(false); if (S.past.length > 120) { S.past.shift(); S.pastB.shift(); } }
    S.snap = now; S.future = []; S.futureB = []; S.lastKey = key || ''; S.lastT = t; S.save(); S.emit('history'); return true;
  },
  canUndo() { return S.past.length > 0; }, canRedo() { return S.future.length > 0; },
  /* An undo step can be a whole-deck replacement (import, template, new deck, AI setDeck). Those are flagged in pastB/futureB.
     Undoing one is allowed, but the deck being left is first copied to the backup list so it can never be lost by a mispress. */
  undo() {
    if (!S.past.length) return false;
    const crossing = !!S.pastB[S.pastB.length - 1];
    if (crossing) S.backup(S.snap, 'Before undo');
    S.future.push(S.snap); S.futureB.push(crossing); S.pastB.pop(); S.snap = S.past.pop(); S.crossed = crossing; S._restore(); return true;
  },
  redo() { if (!S.future.length) return false; S.past.push(S.snap); S.pastB.push(!!S.futureB.pop()); S.snap = S.future.pop(); S.crossed = false; S._restore(); return true; },
  _restore() { S.deck = JSON.parse(S.snap); S.sel = Math.min(S.sel, S.deck.slides.length - 1); S.lastKey = ''; S.save(); S.emit('history'); S.emit('deck'); },

  /* ── whole-deck ── */
  load(deck, opts = {}) {
    S.deck = deck; S.sel = 0; S.lastKey = '';
    if (opts.history !== false) { S.backup(S.snap, opts.reason || 'Replaced'); S.past.push(S.snap); S.pastB.push(true); S.future = []; S.futureB = []; if (S.past.length > 120) { S.past.shift(); S.pastB.shift(); } }
    S.snap = JSON.stringify(S.deck); S.save(); S.emit('history'); S.emit('deck');
  },
  select(i, src) { i = Math.max(0, Math.min(S.count() - 1, i)); if (i === S.sel && src !== 'force') return; S.sel = i; S.emit('select', { i, src }); },

  /* ── slide mutations ── */
  setText(i, path, value, src) {
    PC.setPath(S.slide(i), path, value);
    S.commit('t:' + S.slide(i).id + ':' + path); S.emit('text', { i, path, src });
  },
  /** Run fn(slide) then re-render that slide. src 'inspector' lets the inspector skip its own rebuild. */
  mutate(i, fn, key, src) {
    const s = S.slide(i); fn(s); PC.ensureShape(s); if (s.objects && s.objects.some(o => o.from || o.to)) PC.relinkLines(s, PC.objRect ? o => PC.objRect(s, o) : null);   // glued lines follow their shapes
    S.commit(key || ''); S.emit('slide', { i, src });
  },
  replaceSlide(i, raw) {
    const old = S.slide(i), s = PC.ensureShape(PC.migrateSlide(raw, i)); s.id = old.id;
    S.deck.slides[i] = s; S.commit(''); S.emit('slide', { i, src: 'replace' });
  },
  uniqueId(base) { const ids = new Set(S.deck.slides.map(s => s.id)); let id = base, n = 2; while (ids.has(id)) id = base + '-' + (n++); return id; },
  addSlide(layout, at) {
    if (S.count() >= 200) { PC.ui.toast('Decks are limited to 200 slides.', 'bad'); return -1; }
    at = at == null ? S.sel + 1 : at; at = Math.max(0, Math.min(S.count(), at));
    const s = PC.newSlide(layout, S.uniqueId('s' + Date.now().toString(36).slice(-4)));
    // inherit the deck rhythm: new slides start with the theme default background
    S.deck.slides.splice(at, 0, s); S.sel = at; S.commit(''); S.emit('deck'); S.emit('select', { i: at, src: 'add' }); return at;
  },
  duplicate(i) {
    const s = PC.clone(S.slide(i)); s.id = S.uniqueId(s.id.replace(/-\d+$/, '') + '-copy');
    S.deck.slides.splice(i + 1, 0, s); S.sel = i + 1; S.commit(''); S.emit('deck'); S.emit('select', { i: i + 1, src: 'dup' }); return i + 1;
  },
  remove(i) {
    if (S.count() <= 1) { PC.ui.toast('A deck needs at least one slide.'); return false; }
    S.deck.slides.splice(i, 1); S.sel = Math.min(i, S.count() - 1); S.commit(''); S.emit('deck'); S.emit('select', { i: S.sel, src: 'remove' }); return true;
  },
  move(from, to) {
    to = Math.max(0, Math.min(S.count() - 1, to)); if (from === to || from < 0) return false;
    const [s] = S.deck.slides.splice(from, 1); S.deck.slides.splice(to, 0, s); S.sel = to; S.commit(''); S.emit('deck'); S.emit('select', { i: to, src: 'move' }); return true;
  },
  setLayout(i, layout) {
    const s = S.slide(i), oldSpec = PC.LAYOUTS[s.layout], spec = PC.LAYOUTS[layout], seed = PC.SEEDS[layout] || {};
    if (!spec || s.layout === layout) return;
    const sig = sp => JSON.stringify(((sp && sp.list && sp.list.fields) || []).map(f => f.k));
    if (layout === 'custom' && !(s.custom && s.custom.html)) s.custom = PC.detach(s, S.deck);   // keep what the slide looks like now, as editable code
    if (s.tweaks) delete s.tweaks;   // tweaks belong to the old layout's elements
    if (layout === 'blank' && oldSpec.text) {   // keep the words: turn the generated text into free-form text boxes
      const made = [], at = { kicker: [80, 70, { size: 20, weight: 700, caps: true, color: 'var(--shape)' }], headline: [80, 110, { size: 64, weight: 700, font: 'display', lh: 1.05 }], body: [80, 300, { size: 28, color: 'var(--muted)' }] };
      let ids = new Set((s.objects || []).map(o => o.id));
      ['kicker', 'headline', 'body'].forEach(k => { if (s[k] && oldSpec.text[k] !== undefined) { const o = PC.cleanObject(Object.assign({ type: 'text', text: s[k], x: at[k][0], y: at[k][1], w: 1120 }, at[k][2]), ids); if (o) { made.push(o); ids.add(o.id); } } });
      if (made.length) s.objects = (s.objects || []).concat(made);
    }
    s.layout = layout;
    ['kicker', 'headline', 'body'].forEach(k => { if (spec.text && spec.text[k] !== undefined && !s[k] && seed[k]) s[k] = seed[k]; });
    if (spec.list && (sig(oldSpec) !== sig(spec) || spec.list.key !== (oldSpec.list && oldSpec.list.key))) s[spec.list.key] = PC.clone(seed[spec.list.key] || []);
    if (spec.special === 'chart' && oldSpec.special !== 'chart') { s.chartType = seed.chartType || 'bar'; s.chartData = PC.clone(seed.chartData || PC.SEEDS.chart.chartData); }
    if (layout === 'chart' && !(s.items || []).length && s.items === undefined) s.items = [];
    PC.ensureShape(s); S.commit(''); S.emit('slide', { i, src: 'layout' });
  },
  setMeta(patch, key) {
    Object.assign(S.deck.meta, patch); S.commit(key || 'meta'); S.emit('meta', patch);
  }
};
})();
