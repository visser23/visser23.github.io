/* ── Share: a deck inside a link, with no server and no storage ──
   The deck JSON is compressed (deflate-raw), given a version byte and a CRC-32, and written after the # of the page address:
   https://…/pitchcraft/#s1=<base64url>. Browsers never send the part after # to any server, so nothing is uploaded or stored; the link IS the deck.
   Opening a link decodes it, checks the CRC (a link cut short by a chat app is reported, never half-loaded), and runs the deck through the same
   sanitiser as a file (PC.parseDeck) before asking the person whether to open it.
   Decks too big for a link (usually because pictures are stored in them) are shared as a file instead: the dialog saves it and writes the message.
   PC.share.encode(deck) -> Promise<string>   PC.share.decode(payload) -> Promise<deck>   PC.share.link(deck) -> Promise<{url, chars, tier}>
   PC.shareDialog()  ·  PC.share.openFromHash() */
(function () {
  'use strict';
  const PC = window.PC, UI = PC.ui, S = PC.store, { $ } = UI, esc = PC.esc, icon = PC.icon;
  const VER = 1, SAFE = 6000, LONG = 30000, MAX_RAW = 24 * 1024 * 1024, CANON = 'https://visser23.github.io/pitchcraft/';
  const supported = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const toB64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const fromB64u = t => { const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pipe(bytes, stream, cap) {
    const rd = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (cap && n > cap) { try { rd.cancel(); } catch (e) { /* noop */ } throw new Error('too big'); } parts.push(value); }
    const out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
  }
  const bad = msg => { const e = new Error(msg); e.friendly = true; return e; };

  const Sh = PC.share = { SAFE, LONG, supported };
  Sh.encode = async function (deck) {
    if (!supported()) throw bad('This browser cannot make share links. Save the file instead.');
    const raw = new TextEncoder().encode(JSON.stringify(deck)), z = await pipe(raw, new CompressionStream('deflate-raw'));
    const body = new Uint8Array(1 + z.length + 4); body[0] = VER; body.set(z, 1);
    const c = crc32(body.subarray(0, 1 + z.length)); new DataView(body.buffer).setUint32(1 + z.length, c);
    return toB64u(body);
  };
  Sh.decode = async function (payload) {
    if (!supported()) throw bad('This browser cannot open share links. Ask for the file instead.');
    let u8; try { u8 = fromB64u(payload); } catch (e) { throw bad('This link is not complete or has been changed on the way. Ask for it again, or for the file.'); }
    if (u8.length < 6) throw bad('This link is not complete or has been changed on the way. Ask for it again, or for the file.');
    if (u8[0] !== VER) throw bad('This link was made by a newer version of Pitchcraft. Refresh the page, or ask for the file.');
    if (new DataView(u8.buffer, u8.byteOffset).getUint32(u8.length - 4) !== crc32(u8.subarray(0, u8.length - 4))) throw bad('This link is not complete or has been changed on the way (chat and email apps sometimes cut long links). Ask for it again, or for the file.');
    let text; try { text = new TextDecoder().decode(await pipe(u8.subarray(1, u8.length - 4), new DecompressionStream('deflate-raw'), MAX_RAW)); } catch (e) { throw bad('This link could not be unpacked.'); }
    const { deck, warnings } = PC.parseDeck(text); deck.__warnings = warnings; return deck;
  };
  Sh.base = () => (/^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/index\.html$/, '') : CANON);
  Sh.link = async function (deck) {
    const url = Sh.base() + '#s1=' + await Sh.encode(deck), chars = url.length;
    return { url, chars, tier: chars <= SAFE ? 'safe' : chars <= LONG ? 'long' : 'file' };
  };

  /* ── the Share dialog ── */
  PC.shareDialog = function () {
    const deck = PC.clone(S.deck), name = deck.meta.name || 'Untitled deck', n = deck.slides.length;
    const body = document.createElement('div'); body.innerHTML = '<p class="hint">Preparing…</p>';
    const foot = document.createElement('div'); foot.style.display = 'contents'; foot.innerHTML = '<button class="btn primary" type="button" data-close>Done</button>';
    const m = UI.modal({ title: 'Share this deck', body, footer: foot, size: 'mid' });
    const message = `I've shared a Pitchcraft deck with you: "${name}" (${n} slide${n === 1 ? '' : 's'}).\nTo open it: go to ${Sh.base()} , click Open, and choose the attached ${PC.slug(name)}.pitchcraft file.`;
    const fileSection = (why) => `<div class="ins-sec"><h4>${why ? 'Send it as a file' : 'Or send it as a file'}</h4>
      <p class="note">${why || 'Files keep everything, including pictures stored in the deck. The other person opens Pitchcraft, clicks <b>Open</b> and chooses the file.'}</p>
      <div class="row wrap"><button class="btn sm" id="sh-file" type="button">${icon('download', 14)} Save deck file</button><button class="btn sm" id="sh-msg" type="button">${icon('copy', 14)} Copy a message to go with it</button>${canShareFile() ? `<button class="btn sm" id="sh-native" type="button">${icon('share', 14)} Share file…</button>` : ''}</div></div>`;
    const canShareFile = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'a.pitchcraft', { type: 'application/json' })] })); } catch (e) { return false; } };
    const wire = () => {
      const f = $('#sh-file', m.el); if (f) f.addEventListener('click', () => PC.exportDeck());
      const g = $('#sh-msg', m.el); if (g) g.addEventListener('click', () => UI.copy(message, 'Message copied'));
      const nat = $('#sh-native', m.el); if (nat) nat.addEventListener('click', () => { const file = new File([JSON.stringify(deck, null, 2)], PC.slug(name) + '.pitchcraft', { type: 'application/json' }); navigator.share({ files: [file], title: name, text: message }).catch(() => { /* cancelled */ }); });
    };
    Sh.link(deck).then(r => {
      if (r.tier === 'file') {
        body.innerHTML = `<p><b>This deck is too big for a link</b> (${r.chars.toLocaleString()} characters). That is almost always pictures stored inside it. A link can only carry about ${LONG.toLocaleString()}.</p>` + fileSection('Send the file and a short message instead.');
      } else {
        const note = r.tier === 'safe' ? 'Short enough for chat, email and QR codes.' : `This is a long link (${r.chars.toLocaleString()} characters). Some chat and email apps cut long links; if that happens the other person sees a "link incomplete" message instead of a broken deck. Sending the file is safer.`;
        body.innerHTML = `<p>Anyone with this link gets their own copy of <b>${esc(name)}</b> when they open it.</p>
          <div class="ins-sec"><h4>Link</h4><div class="row"><input class="txt mono" id="sh-url" readonly aria-label="Share link" value="${esc(r.url)}" style="flex:1;min-width:0"><button class="btn primary" id="sh-copy" type="button">${icon('copy', 14)} Copy link</button></div>
          <p class="note">${note}</p></div>
          <p class="note">The deck is stored inside the link itself. Nothing is uploaded to any server, so it cannot be taken back or updated: later edits are not included. Treat the link like the file, because anyone who has it can read the deck. Pictures linked from the web are included only as their address.</p>` + fileSection();
        const u = $('#sh-url', m.el); u.addEventListener('focus', () => u.select());
        $('#sh-copy', m.el).addEventListener('click', () => UI.copy(r.url, 'Link copied'));
      }
      wire();
    }).catch(e => { body.innerHTML = `<p class="err">${esc(e.friendly ? e.message : 'Could not make a link: ' + (e && e.message || e))}</p>` + fileSection('Send it as a file instead.'); wire(); });
    return m;
  };

  /* ── opening a shared link ── */
  let busy = false;
  Sh.openFromHash = async function () {
    const h = location.hash, mt = /^#s(\d+)=([A-Za-z0-9_-]*)$/.exec(h); if (!mt || busy) return false;
    busy = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* noop */ }
    const fail = msg => { const b = document.createElement('div'); b.innerHTML = `<p>${esc(msg)}</p>`; const f = document.createElement('div'); f.style.display = 'contents'; f.innerHTML = '<button class="btn primary" type="button" data-close>OK</button>'; UI.modal({ title: 'Could not open the shared deck', body: b, footer: f }); busy = false; };
    let deck; try { deck = await Sh.decode(mt[2]); } catch (e) { fail(e.friendly ? e.message : 'This link could not be read.'); return true; }
    const warnings = deck.__warnings || []; delete deck.__warnings;
    const b = document.createElement('div');
    b.innerHTML = `<p><b>${esc(deck.meta.name || 'Untitled deck')}</b> · ${deck.slides.length} slide${deck.slides.length === 1 ? '' : 's'}${warnings.length ? ` · ${warnings.length} note${warnings.length === 1 ? '' : 's'}` : ''}</p>
      <ol class="plain" style="margin:8px 0 12px 18px">${deck.slides.slice(0, 8).map(s => `<li>${esc(String(s.headline || s.title || s.layout).replace(/<[^>]*>/g, '').slice(0, 70))}</li>`).join('')}${deck.slides.length > 8 ? `<li>…and ${deck.slides.length - 8} more</li>` : ''}</ol>
      <p class="hint">Someone shared this deck with you. It is opened as your own copy and nothing is sent back. Opening replaces the deck in the editor now; Ctrl+Z brings yours back until you close the page.</p>`;
    const f = document.createElement('div'); f.style.display = 'contents';
    f.innerHTML = '<button class="btn" data-close>Cancel</button><button class="btn" id="sh-add" type="button">Add slides to this deck</button><button class="btn primary" id="sh-open" type="button">Open as the deck</button>';
    const m = UI.modal({ title: 'Open a shared deck?', body: b, footer: f, onClose: () => { busy = false; } });
    const go = mode => { m.close(); PC.importText(JSON.stringify(deck), mode); UI.toast(mode === 'append' ? 'Shared slides added' : 'Shared deck opened'); };
    $('#sh-open', m.el).addEventListener('click', () => go('replace')); $('#sh-add', m.el).addEventListener('click', () => go('append'));
    return true;
  };
  window.addEventListener('hashchange', () => { if (/^#s\d+=/.test(location.hash)) Sh.openFromHash(); });
})();
