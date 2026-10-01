/* Cookie consent and Google Analytics.
   • Nothing from Google is requested until the visitor presses "Accept analytics". Refusing (or ignoring the banner) loads nothing.
   • The choice lives in localStorage ('pitchcraft.consent') and can be changed any time in Settings > Privacy.
   • Withdrawing stops the tag on the next load and deletes the _ga cookies now.
   • Never active on localhost / file:, so development and the test-suite do not pollute the numbers.
   • Strictly necessary storage (the deck, appearance) is not covered by this banner: see the policy. */
(function () {
  'use strict';
  const PC = window.PC, KEY = 'pitchcraft.consent', GA_ID = 'G-EF7CY6HHYP', VERSION = 1;
  const C = PC.consent = { GA_ID, local: /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:' };
  let loaded = false;

  C.get = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.v === VERSION && typeof v.analytics === 'boolean' ? v : null; } catch (e) { return null; } };
  C.analyticsAllowed = () => !!(C.get() && C.get().analytics);
  C.active = () => loaded;

  C.loadAnalytics = function () {
    if (loaded || C.local || !C.analyticsAllowed()) return false;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    s.id = 'pc-ga'; document.head.appendChild(s);
    console.info('[pitchcraft] analytics enabled (consented)');
    return true;
  };

  function clearCookies() {
    const host = location.hostname.split('.'), names = document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga(_|$)/.test(n) || n === '_gid' || n === '_gat');
    names.forEach(n => {
      for (let i = 0; i < host.length - 1; i++) { const d = host.slice(i).join('.'); ['', ';domain=' + d, ';domain=.' + d].forEach(dm => { document.cookie = `${n}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${dm}`; }); }
      document.cookie = `${n}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
    return names.length;
  }

  C.set = function (analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics: !!analytics, at: new Date().toISOString() })); } catch (e) { /* private mode: the choice lasts for this page only */ }
    if (analytics) C.loadAnalytics();
    else {
      if (loaded) { window['ga-disable-' + GA_ID] = true; const s = document.getElementById('pc-ga'); if (s) s.remove(); loaded = false; }
      clearCookies();
    }
    hideBanner(); window.dispatchEvent(new CustomEvent('pc:consent'));
  };
  C.reset = function () { try { localStorage.removeItem(KEY); } catch (e) { /* noop */ } clearCookies(); showBanner(); };

  /* ── banner ── */
  let banner = null;
  function hideBanner() { if (banner) { banner.remove(); banner = null; } document.documentElement.classList.remove('has-consent-bar'); }
  function showBanner() {
    if (banner || C.get()) return;
    banner = document.createElement('div'); banner.className = 'consent'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-modal', 'false'); banner.setAttribute('aria-label', 'Cookie notice');
    banner.innerHTML = `<div class="consent-t"><b>Can we count visits?</b><p>Pitchcraft keeps your decks in your browser and never uploads them. With your OK we would also use Google Analytics cookies to see which features are used, anonymously. Nothing is sent if you decline. <button type="button" class="consent-link" data-consent="policy">Cookie and privacy policy</button></p></div>
      <div class="consent-b"><button type="button" class="btn" data-consent="no">Decline</button><button type="button" class="btn" data-consent="yes">Accept analytics</button></div>`;
    banner.addEventListener('click', e => { const b = e.target.closest('[data-consent]'); if (!b) return; const a = b.dataset.consent; if (a === 'policy') PC.policyDialog(); else C.set(a === 'yes'); });
    document.body.appendChild(banner); document.documentElement.classList.add('has-consent-bar');
  }
  C.showBanner = showBanner;

  /* ── Settings > Privacy ── */
  PC.settingsExtras = PC.settingsExtras || [];
  PC.settingsExtras.push(host => {
    const wrap = document.createElement('div'); host.appendChild(wrap);
    const draw = () => {
      const g = C.get(), on = !!(g && g.analytics);
      wrap.innerHTML = `<div class="settings-h">Privacy</div>
        <div class="settings-row"><div><b>Anonymous analytics</b><small>${g ? (on ? 'On: Google Analytics counts visits.' : 'Off: nothing is sent to Google.') : 'Not decided yet: nothing is sent to Google.'} Your decks are never included.${C.local ? ' (Inactive on localhost.)' : ''}</small></div>
          <div class="seg" role="group" aria-label="Analytics"><button type="button" data-an="on" aria-pressed="${on}">On</button><button type="button" data-an="off" aria-pressed="${!on}">Off</button></div></div>
        <div class="settings-row"><div><b>Cookie and privacy policy</b><small>What is stored, who sees it, and your rights.</small></div><button class="btn sm" type="button" data-an="policy">Read it</button></div>`;
    };
    draw(); wrap.addEventListener('click', e => { const b = e.target.closest('[data-an]'); if (!b) return; if (b.dataset.an === 'policy') PC.policyDialog(); else { C.set(b.dataset.an === 'on'); draw(); } });
  });

  function boot() { if (C.get()) C.loadAnalytics(); else showBanner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
