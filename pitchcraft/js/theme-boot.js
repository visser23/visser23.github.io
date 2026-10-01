/* Applies the saved appearance before the first paint, so dark mode never flashes light.
   pitchcraft.ui = 'light' | 'dark' (a manual choice) or absent (Auto: dark from 19:00 to 06:59, local time). Kept tiny and dependency-free on purpose. */
(function () {
  'use strict';
  var KEY = 'pitchcraft.ui';
  function pref() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; } }
  function evening() { var h = new Date().getHours(); return h >= 19 || h < 7; }
  function apply() { var p = pref(), dark = p === 'dark' || (p === 'auto' && evening()); document.documentElement.setAttribute('data-ui', dark ? 'dark' : 'light'); return dark; }
  window.PCUI = { KEY: KEY, pref: pref, apply: apply, evening: evening,
    set: function (v) { try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (e) { /* private mode: the choice lasts until reload */ } return apply(); } };
  apply();
  setInterval(function () { if (pref() === 'auto') apply(); }, 600000);
})();
