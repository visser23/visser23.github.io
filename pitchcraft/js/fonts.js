/* Fonts that live on the viewer's computer.
   Chrome and Edge expose them through the Local Font Access API (queryLocalFonts), which asks permission once.
   Everywhere else the Font control keeps a "type any installed font name" box. A font that is not installed on the
   machine showing the deck falls back to the theme font, which is why the Settings text says so.
   The family list is held in memory only; nothing about your fonts is stored or sent anywhere. */
(function () {
  'use strict';
  const PC = window.PC, FLAG = 'pitchcraft.localfonts';
  const L = PC.localFonts = { list: [], state: window.queryLocalFonts ? 'off' : 'unsupported' };
  const note = () => { try { window.dispatchEvent(new CustomEvent('pc:fonts')); } catch (e) { /* old browser */ } };

  PC.loadLocalFonts = async function () {
    if (!window.queryLocalFonts) { L.state = 'unsupported'; return L; }
    try {
      const faces = await window.queryLocalFonts();
      const set = new Set(); faces.forEach(f => { if (f.family && PC.cleanFont(f.family) === f.family) set.add(f.family); });
      L.list = [...set].sort((a, b) => a.localeCompare(b)); L.state = L.list.length ? 'ready' : 'empty';
      try { localStorage.setItem(FLAG, '1'); } catch (e) { /* private mode */ }
      console.info('[pitchcraft]', 'local fonts: found', L.list.length, 'families');
    } catch (e) { L.state = 'denied'; console.info('[pitchcraft]', 'local fonts unavailable:', e && e.name); }
    note(); return L;
  };
  PC.forgetLocalFonts = function () { L.list = []; L.state = window.queryLocalFonts ? 'off' : 'unsupported'; try { localStorage.removeItem(FLAG); } catch (e) { /* noop */ } note(); };

  // If you said yes before and the browser still remembers it, pick the list up silently (no prompt).
  (async () => {
    try {
      if (!window.queryLocalFonts || localStorage.getItem(FLAG) !== '1' || !navigator.permissions) return;
      const st = await navigator.permissions.query({ name: 'local-fonts' });
      if (st.state === 'granted') await PC.loadLocalFonts();
    } catch (e) { /* permission name unknown in this browser */ }
  })();

  PC.settingsExtras = PC.settingsExtras || [];
  PC.settingsExtras.push(host => {
    const wrap = document.createElement('div'); host.appendChild(wrap);
    const draw = () => {
      const msg = { unsupported: 'This browser cannot list your fonts. You can still type any installed font name in the Font control, and the bundled fonts always work.', off: 'Let Pitchcraft list the fonts installed on this computer so they appear in the Font menu. Your browser will ask first. The list stays in your browser and is never uploaded.', ready: `${L.list.length} fonts from this computer are in the Font menu under "On this computer".`, empty: 'Your browser allowed access but reported no fonts.', denied: 'Permission was not given. You can change it in your browser\'s site settings.' }[L.state];
      const btn = L.state === 'unsupported' ? '' : L.state === 'ready' ? '<button class="btn sm" type="button" data-lf="forget">Stop using</button>' : '<button class="btn sm" type="button" data-lf="load">Use my fonts</button>';
      wrap.innerHTML = `<div class="settings-h">Fonts</div><div class="settings-row"><div><b>Fonts on this computer</b><small>${msg}</small><small>Fonts you pick are only visible on computers that have them installed. On others, text falls back to the theme font. The bundled fonts work everywhere.</small></div>${btn}</div>`;
    };
    draw(); wrap.addEventListener('click', async e => { const b = e.target.closest('[data-lf]'); if (!b) return; if (b.dataset.lf === 'load') { b.disabled = true; await PC.loadLocalFonts(); } else PC.forgetLocalFonts(); draw(); });
  });
})();
