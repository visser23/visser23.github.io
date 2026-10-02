/* ─────────────────────────────────────────────
   The Wall — story rail, Amstrad launcher, virtual keyboard
   Content comes from data/*.json; this file only renders it.
   Depends on placeholders.js (getPlaceholder).
   ───────────────────────────────────────────── */
(() => {
'use strict';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/* ═══════════════ STORY RAIL ═══════════════ */

const CHAPTERS = [
  { id: 1, label: 'Computers at home' },
  { id: 2, label: 'Internet era' },
  { id: 3, label: 'First career' },
  { id: 4, label: 'BBC' },
  { id: 5, label: 'Consulting' },
  { id: 6, label: 'NHS & AI' }
];
const chapterLabel = id => (CHAPTERS.find(c => c.id === id) || {}).label || '';

// What each kind of card hangs from
const CLIP_BY_TYPE = { photo: 'peg', cassette: 'peg', note: 'binder', terminal: 'binder', certificate: 'brass' };

let storyData = [];
let currentCard = 0;
let currentOffset = 0;
let isDragging = false;
let suppressClickUntil = 0;
let swayTimer = null;

const railOuter = $('#rail-outer');
const railTrack = $('#rail-track');

function cssPx(name, fallback) {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue(name), 10) || fallback;
}
const cardWidth = () => cssPx('--card-w', 230);
const cardGap   = () => cssPx('--card-gap', 34);
const cardStep  = () => cardWidth() + cardGap();

function buildPhoto(card, wrapRoot) {
  const box = $('.polaroid-photo', wrapRoot);
  const fallback = () => { box.innerHTML = getPlaceholder(card.placeholder || 'default', 190, 160); };
  if (!card.image) { fallback(); return; }
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.addEventListener('error', fallback, { once: true });
  img.src = card.image;
  box.appendChild(img);
}

function renderStory(data) {
  storyData = data;
  railTrack.innerHTML = '';

  data.forEach((card, i) => {
    const type = card.type || 'photo';
    const clip = CLIP_BY_TYPE[type] || 'peg';
    const wrap = document.createElement('div');
    wrap.className = 'card-wrap';
    wrap.dataset.index = i;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '-1');
    wrap.setAttribute('aria-label', `${card.year}: ${card.title}`);
    wrap.style.setProperty('--rot', `${card.rotation || 0}deg`);

    wrap.innerHTML = `
      <div class="hang">
        <div class="clip clip-${clip}" aria-hidden="true"></div>
        <div class="polaroid card-type-${esc(type)}">
          <div class="polaroid-photo" aria-hidden="true"></div>
          <div class="polaroid-caption">
            <div class="polaroid-year">${esc(card.year)}</div>
            <div class="polaroid-title">${esc(card.title)}</div>
          </div>
        </div>
      </div>`;
    buildPhoto(card, wrap);

    wrap.addEventListener('click', () => {
      if (performance.now() < suppressClickUntil) return;
      goToCard(i);
    });
    wrap.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToCard(i); }
    });
    railTrack.appendChild(wrap);
  });

  renderChapters(data);
  goToCard(0, { animate: false });
}

function updateReader(card, animate) {
  $('#reader-year').textContent = card.year;
  $('#reader-chapter').textContent = chapterLabel(card.chapter);
  $('#reader-title').textContent = card.title;
  $('#reader-text').textContent = card.caption;
  if (!animate) return;
  const inner = $('#reader-inner');
  inner.style.animation = 'none';
  void inner.offsetWidth;            // restart the fade-in
  inner.style.animation = '';
}

// Cards are hung on pegs, so moving the line makes them swing about the peg.
function swayCards(direction, distance) {
  if (prefersReducedMotion()) return;
  const kick = -direction * Math.min(6.5, 2.2 + distance * 1.1);
  railTrack.style.setProperty('--kick', `${kick.toFixed(2)}deg`);
  $$('.card-wrap', railTrack).forEach((el, i) => {
    el.style.setProperty('--d', Math.min(8, Math.abs(i - currentCard)));
  });
  railTrack.classList.remove('swaying');
  void railTrack.offsetWidth;
  railTrack.classList.add('swaying');
  clearTimeout(swayTimer);
  swayTimer = setTimeout(() => railTrack.classList.remove('swaying'), 2000);
}

function goToCard(idx, { animate = true, direction } = {}) {
  if (idx < 0 || idx >= storyData.length) return;
  const previous = currentCard;
  currentCard = idx;

  // #rail-track has 50vw of left padding, so card[0] begins at the viewport centre.
  currentOffset = -(idx * cardStep()) - (cardWidth() / 2);

  if (animate) {
    railTrack.classList.add('smooth');
    setTimeout(() => railTrack.classList.remove('smooth'), 650);
  }
  railTrack.style.setProperty('--lean', '0deg');
  railTrack.style.transform = `translateX(${currentOffset}px)`;

  $$('.card-wrap', railTrack).forEach((el, i) => {
    const dist = Math.abs(i - idx);
    el.classList.toggle('active', dist === 0);
    el.classList.toggle('distant', dist > 2);
    el.setAttribute('tabindex', dist === 0 ? '0' : '-1');
    if (dist === 0) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });

  $('#btn-prev').disabled = idx === 0;
  $('#btn-next').disabled = idx === storyData.length - 1;
  $('#story-pos').textContent = `${idx + 1} / ${storyData.length}`;

  const card = storyData[idx];
  updateReader(card, animate && idx !== previous);
  $$('.chapter-dot').forEach(dot => {
    dot.classList.toggle('active', parseInt(dot.dataset.chapter, 10) === card.chapter);
  });

  const dir = direction ?? Math.sign(idx - previous);
  if (animate && dir !== 0) swayCards(dir, Math.abs(idx - previous));
}

function renderChapters(data) {
  const bar = $('#chapter-bar');
  bar.innerHTML = '';
  CHAPTERS.forEach(ch => {
    const first = data.findIndex(c => c.chapter === ch.id);
    if (first === -1) return;
    const dot = document.createElement('button');
    dot.className = 'chapter-dot';
    dot.type = 'button';
    dot.dataset.chapter = ch.id;
    dot.textContent = ch.label;
    dot.setAttribute('aria-label', `Jump to chapter: ${ch.label}`);
    dot.addEventListener('click', () => goToCard(first));
    bar.appendChild(dot);
  });
}

// Drag / swipe — pointer events cover mouse, touch and pen
function initRailDrag() {
  let startX = 0, lastX = 0, startOffset = 0, startCard = 0, moved = false, pointerId = null;

  railOuter.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDragging = true; moved = false;
    startX = lastX = e.clientX;
    startOffset = currentOffset;
    startCard = currentCard;
    pointerId = e.pointerId;
    railTrack.classList.remove('smooth');
  });

  railOuter.addEventListener('pointermove', e => {
    if (!isDragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      try { railOuter.setPointerCapture(pointerId); } catch (_) { /* pointer already gone */ }
    }
    if (!moved) return;
    currentOffset = startOffset + dx;
    railTrack.style.transform = `translateX(${currentOffset}px)`;
    // cards lag behind the line a little as it's pulled
    const lean = clamp((e.clientX - lastX) * 0.4, -7, 7);
    railTrack.style.setProperty('--lean', `${lean.toFixed(2)}deg`);
    lastX = e.clientX;
  });

  const end = e => {
    if (!isDragging || (e && e.pointerId !== pointerId)) return;
    isDragging = false;
    if (!moved) return;
    suppressClickUntil = performance.now() + 120;
    const raw = -(currentOffset + cardWidth() / 2) / cardStep();
    const idx = clamp(Math.round(raw), 0, storyData.length - 1);
    const dir = idx === startCard ? Math.sign(startX - lastX) || 0 : Math.sign(idx - startCard);
    goToCard(idx, { animate: true, direction: dir });
    if (idx === startCard && dir !== 0) swayCards(dir, 0.5);
  };
  railOuter.addEventListener('pointerup', end);
  railOuter.addEventListener('pointercancel', end);

  // Trackpad two-finger swipe: one card per gesture
  let wheelQuietTimer = null, wheelLocked = false;
  railOuter.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 4) return;
    e.preventDefault();
    clearTimeout(wheelQuietTimer);
    wheelQuietTimer = setTimeout(() => { wheelLocked = false; }, 140);
    if (wheelLocked) return;
    wheelLocked = true;
    goToCard(currentCard + Math.sign(e.deltaX));
  }, { passive: false });
}

$('#btn-prev').addEventListener('click', () => goToCard(currentCard - 1));
$('#btn-next').addEventListener('click', () => goToCard(currentCard + 1));

// ←/→ move the story unless you're inside the Amstrad, a form field, or a game.
document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  const active = document.activeElement;
  if (active && (active.closest('#screen') || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
  if ($('#game-overlay').classList.contains('on')) return;
  e.preventDefault();
  goToCard(currentCard + (e.key === 'ArrowRight' ? 1 : -1));
});

window.addEventListener('resize', () => {
  if (storyData.length) goToCard(currentCard, { animate: false });
});

/* ═══════════════ AMSTRAD LAUNCHER ═══════════════ */

const CATEGORY_LABEL = { product: 'PRODUCT', tool: 'TOOL', 'open-source': 'OPEN SRC', reference: 'INFO' };

let projectData = [];
let gamesData = [];
let currentMode = 'projects';
let selected = 0;
let launching = false;
let powered = false;

const rig = $('#rig');
const screenEl = $('#screen');
const listEl = $('#project-list');
const detailEl = $('#project-detail');
const tapeOverlay = $('#tape-overlay');
const tapeText = $('#tape-text');
const tapeBar = $('#tape-bar');
const tapeCounter = $('#tape-counter');
const cassetteLabel = $('#cassette-label');

const items = () => (currentMode === 'games' ? gamesData : projectData);
const shortName = proj => proj.title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

function renderList() {
  listEl.innerHTML = '';
  items().forEach((proj, i) => {
    const el = document.createElement('div');
    el.className = 'project-item';
    el.id = `proj-${currentMode}-${i}`;
    el.setAttribute('role', 'option');
    el.dataset.index = i;
    const tag = currentMode === 'games' ? proj.year : (CATEGORY_LABEL[proj.category] || '');
    el.innerHTML = `
      <span class="proj-num">${i + 1}</span>
      <span class="proj-name">${esc(proj.title.toUpperCase())}</span>
      <span class="proj-lead" aria-hidden="true"></span>
      <span class="proj-tag">${esc(tag)}</span>`;
    el.addEventListener('click', () => {
      if (i === selected) launch(i);
      else select(i);
    });
    listEl.appendChild(el);
  });
  select(clamp(selected, 0, items().length - 1), { focus: false });
}

function renderDetail() {
  const proj = items()[selected];
  if (!proj) { detailEl.innerHTML = ''; return; }
  const isGame = currentMode === 'games';
  let meta, link;
  if (isGame) {
    meta = [proj.publisher, proj.year].filter(Boolean).join(' · ');
    link = `CPC emulator · ${proj.format === 'dsk' ? 'disk' : 'snapshot'}`;
  } else {
    meta = [(proj.status || '').toUpperCase(), proj.year, CATEGORY_LABEL[proj.category]].filter(Boolean).join(' · ');
    try { link = proj.external ? new URL(proj.link).host : proj.link; } catch (_) { link = proj.link; }
  }
  detailEl.innerHTML = `
    <div class="d-head">
      <span class="d-title">&gt; ${esc(proj.title.toUpperCase())}</span>
      <span class="d-meta">${esc(meta)}</span>
    </div>
    <div class="d-sum">${esc(proj.summary || '')}</div>
    <div class="d-foot">
      <span class="d-link">${proj.external ? '&#8599; ' : ''}${esc(link)}</span>
      <button class="run-btn" type="button">ENTER &#9656; RUN"${esc(shortName(proj))}"</button>
    </div>`;
}

function select(i, { focus = false } = {}) {
  const list = items();
  selected = clamp(i, 0, list.length - 1);
  $$('.project-item', listEl).forEach((el, idx) => {
    const on = idx === selected;
    el.classList.toggle('selected', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
    el.setAttribute('tabindex', on ? '0' : '-1');
    if (on) {
      const top = el.offsetTop, bottom = top + el.offsetHeight;
      if (top < listEl.scrollTop) listEl.scrollTop = top;
      else if (bottom > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = bottom - listEl.clientHeight;
      if (focus) el.focus({ preventScroll: true });
    }
  });
  renderDetail();
}

function setMode(mode, { focusTab = false } = {}) {
  if (mode === currentMode) return;
  currentMode = mode;
  selected = 0;
  $$('.screen-tab').forEach(t => {
    const on = t.dataset.mode === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on && focusTab) t.focus({ preventScroll: true });
  });
  cassetteLabel.textContent = mode.toUpperCase();
  listEl.setAttribute('aria-label', mode === 'games' ? 'Games' : 'Projects');
  renderList();
}

// ── Tape deck ──
let counterValue = 0, counterTimer = null;
function spinTape(on) {
  rig.classList.toggle('running', on);
  clearInterval(counterTimer);
  if (on) {
    counterTimer = setInterval(() => {
      counterValue = (counterValue + 1) % 1000;
      tapeCounter.textContent = String(counterValue).padStart(3, '0');
    }, 28);
  }
}

function launch(i) {
  if (launching) return;
  const proj = items()[i];
  if (!proj) return;
  launching = true;

  const isGame = currentMode === 'games' && proj.file;
  const name = shortName(proj);
  cassetteLabel.textContent = proj.title.toUpperCase().slice(0, 14);
  tapeOverlay.classList.add('on');
  tapeBar.style.width = '0';
  spinTape(true);

  const later = (ms, fn) => setTimeout(fn, ms);
  const finish = () => {
    tapeOverlay.classList.remove('on');
    tapeBar.style.width = '0';
    spinTape(false);
    cassetteLabel.textContent = currentMode.toUpperCase();
    launching = false;
  };

  if (isGame) {
    tapeText.textContent = `RUN"${name}"\nPress PLAY then any key:\nLoading ${proj.title} 1`;
    later(100,  () => { tapeBar.style.width = '40%'; });
    later(600,  () => { tapeBar.style.width = '80%'; });
    later(1200, () => { tapeBar.style.width = '100%'; });
    later(1500, () => { finish(); openGameEmulator(proj); });
  } else {
    tapeText.textContent = `RUN"${name}"\nPress PLAY then any key:`;
    later(250, () => { tapeText.textContent += `\nLoading ${name} 1`; tapeBar.style.width = '45%'; });
    later(650, () => { tapeBar.style.width = '85%'; });
    later(950, () => { tapeBar.style.width = '100%'; tapeText.textContent += '\nReady'; });
    later(1150, () => {
      finish();
      openProject(proj);
    });
  }
}

// window.open from a timer can be blocked on Safari; fall back to same-tab navigation.
function openProject(proj) {
  let win = null;
  try { win = window.open(proj.link, '_blank'); } catch (_) { win = null; }
  if (win) { try { win.opener = null; } catch (_) { /* cross-origin already */ } }
  else window.location.assign(proj.link);
}

// ── Game emulator overlay ──
function openGameEmulator(game) {
  const overlay = $('#game-overlay');
  const iframe = $('#game-iframe');
  const hint = $('#game-hint');
  overlay.style.setProperty('--game-mobile-kb', '0px');

  iframe.src = `games/cpc.html?file=${encodeURIComponent(game.file)}`;
  $('#game-now-playing').textContent = `${game.title} (${game.year})`;

  const mobileNote = isTouchDevice() ? '<span class="note">On-screen controls shown by default on mobile</span>' : '';
  if (game.format === 'dsk') {
    hint.innerHTML = `Type <span class="cmd">${esc(game.run || 'CAT')}</span> then <span class="cmd">ENTER</span>${mobileNote}`;
  } else {
    hint.innerHTML = `Controls: <span class="cmd">Arrow Keys</span> + <span class="cmd">Space</span>${mobileNote}`;
  }

  overlay.classList.add('on');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { iframe.focus(); iframe.contentWindow?.focus(); }, 300);
}

function closeGameEmulator() {
  const overlay = $('#game-overlay');
  overlay.classList.remove('on');
  overlay.style.setProperty('--game-mobile-kb', '0px');
  $('#game-iframe').src = 'about:blank';
  document.body.style.overflow = '';
}

window.addEventListener('message', event => {
  if (!event?.data || event.data.type !== 'cpc-keyboard-layout') return;
  const overlay = $('#game-overlay');
  if (!overlay.classList.contains('on') || !isTouchDevice()) return;
  const kb = Number(event.data.keyboardHeight) || 0;
  overlay.style.setProperty('--game-mobile-kb', `${Math.max(0, kb)}px`);
});
$('#game-close').addEventListener('click', closeGameEmulator);
$('#game-screen').addEventListener('pointerdown', () => {
  const iframe = $('#game-iframe');
  iframe.focus();
  iframe.contentWindow?.focus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#game-overlay').classList.contains('on')) closeGameEmulator();
});

// ── Screen input ──
$$('.screen-tab').forEach(tab => {
  tab.setAttribute('aria-pressed', tab.classList.contains('active') ? 'true' : 'false');
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

detailEl.addEventListener('click', e => {
  if (e.target.closest('.run-btn')) launch(selected);
});

screenEl.addEventListener('keydown', e => {
  if (bootActive) { skipBoot(); e.preventDefault(); return; }
  const onButton = e.target.closest('button');
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); e.stopPropagation(); select(selected + 1, { focus: true }); break;
    case 'ArrowUp':   e.preventDefault(); e.stopPropagation(); select(selected - 1, { focus: true }); break;
    case 'ArrowLeft': case 'ArrowRight': {
      e.preventDefault(); e.stopPropagation();
      const next = e.key === 'ArrowRight' ? 'games' : 'projects';
      if (next !== currentMode) { setMode(next); $('.project-item.selected', listEl)?.focus({ preventScroll: true }); }
      break;
    }
    case 'Enter': case ' ':
      if (onButton) break;                 // let tabs and RUN button handle their own activation
      e.preventDefault(); e.stopPropagation(); launch(selected);
      break;
    default: break;
  }
});

/* ═══════════════ POWER-ON + BOOT ═══════════════ */

const BOOT_TEXT =
  'Amstrad 64K Microcomputer  (v1)\n\n' +
  '©1984 Amstrad Consumer Electronics plc\n' +
  '          and Locomotive Software Ltd.\n\n' +
  'BASIC 1.0\n\n' +
  'Ready\n' +
  'RUN"PROJECTS"';

const bootOverlay = $('#boot-overlay');
const bootPre = $('#boot-text');
let bootActive = false, bootTimer = null;

function finishBoot() {
  bootActive = false;
  clearTimeout(bootTimer);
  bootOverlay.classList.add('fade');
  setTimeout(() => { bootOverlay.classList.remove('on', 'fade'); bootPre.textContent = ''; }, 380);
}
function skipBoot() { if (bootActive) finishBoot(); }

function runBoot() {
  bootActive = true;
  bootOverlay.classList.add('on');
  let n = 0;
  const step = () => {
    if (!bootActive) return;
    n++;
    bootPre.textContent = BOOT_TEXT.slice(0, n) + '█';
    if (n >= BOOT_TEXT.length) { bootTimer = setTimeout(finishBoot, 380); return; }
    const ch = BOOT_TEXT[n - 1];
    bootTimer = setTimeout(step, ch === '\n' ? 70 : 9);
  };
  step();
}

function powerOn() {
  if (powered) return;
  powered = true;
  rig.classList.add('on-air');
  screenEl.classList.remove('off');
  if (prefersReducedMotion()) return;
  screenEl.classList.add('powering');
  screenEl.addEventListener('animationend', () => screenEl.classList.remove('powering'), { once: true });
  setTimeout(runBoot, 650);
}

function armPowerOn() {
  const skip = () => { powerOn(); skipBoot(); };
  screenEl.addEventListener('pointerdown', skip);
  screenEl.addEventListener('focusin', powerOn);
  if (!('IntersectionObserver' in window)) { powerOn(); return; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(en => en.isIntersecting)) { powerOn(); io.disconnect(); }
  }, { threshold: 0.45 });
  io.observe(screenEl);
}

/* ═══════════════ VIRTUAL KEYBOARD ═══════════════ */

// [legend, columns (of 30), class, matching e.key values]
const K = (l, span = 2, cls = '', match = null) => ({ l, span, cls, match: match || [l.toLowerCase()] });
const MAIN_KEYS = [
  K('ESC', 2, 'red', ['escape']),
  ...'1234567890-^'.split('').map(c => K(c)),
  K('CLR', 2, '', ['delete']), K('DEL', 2, '', ['backspace']),

  K('TAB', 3, '', ['tab']),
  ...'QWERTYUIOP@['.split('').map(c => K(c)),
  K('RETURN', 3, 'blue tall', ['enter']),

  K('CAPS', 3, '', ['capslock']),
  ...'ASDFGHJKL;:]'.split('').map(c => K(c)),

  K('SHIFT', 4, '', ['shift']),
  ...'ZXCVBNM,./'.split('').map(c => K(c)),
  K('SHIFT', 6, '', ['shift']),

  K('CTRL', 5, '', ['control']),
  K(' ', 20, 'space', ['space']),
  K('ENTER', 5, 'blue', ['enter'])
];
const CLUSTER_KEYS = [
  { l: '↑', cls: 'k-up', match: ['arrowup'] },
  { l: '←', cls: 'k-left', match: ['arrowleft'] },
  { l: 'COPY', cls: 'k-copy blue', match: ['home', 'end'] },
  { l: '→', cls: 'k-right', match: ['arrowright'] },
  { l: '↓', cls: 'k-down', match: ['arrowdown'] }
];

const keyMap = new Map();

function addKey(host, def, spanStyle) {
  const el = document.createElement('div');
  el.className = `key ${def.cls || ''}`.trim();
  if (spanStyle) {
    el.style.gridColumn = `span ${def.span}`;
  }
  el.textContent = def.l.trim() ? def.l : '';
  (def.match || []).forEach(k => {
    if (!keyMap.has(k)) keyMap.set(k, []);
    keyMap.get(k).push(el);
  });
  host.appendChild(el);
}

function buildKeyboard() {
  const main = $('#kb-main'), cluster = $('#kb-cluster');
  MAIN_KEYS.forEach(def => addKey(main, def, true));
  CLUSTER_KEYS.forEach(def => addKey(cluster, def, false));

  const keyName = e => (e.key === ' ' ? 'space' : e.key.toLowerCase());
  document.addEventListener('keydown', e => {
    (keyMap.get(keyName(e)) || []).forEach(el => el.classList.add('down'));
  });
  document.addEventListener('keyup', e => {
    (keyMap.get(keyName(e)) || []).forEach(el => el.classList.remove('down'));
  });
  window.addEventListener('blur', () => $$('.key.down').forEach(el => el.classList.remove('down')));
}

/* ═══════════════ NAV + BOOTSTRAP ═══════════════ */

function initNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

async function loadData() {
  const [story, projects, games] = await Promise.all(
    ['data/story.json', 'data/projects.json', 'data/games.json'].map(async url => {
      const res = await fetch(url, { cache: 'no-cache' });   // always revalidate so edits show up straight away
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.json();
    })
  );
  return { story, projects, games };
}

async function init() {
  initNav();
  buildKeyboard();
  armPowerOn();
  try {
    const data = await loadData();
    projectData = data.projects;
    gamesData = data.games;
    initRailDrag();
    renderStory(data.story);
    renderList();
  } catch (err) {
    console.warn('Could not load data files:', err);
    $('#reader-title').textContent = 'The wall is empty for a moment';
    $('#reader-text').textContent = 'The story data did not load. If you are opening this file directly, serve the folder over http instead.';
  }
}

init();
})();
