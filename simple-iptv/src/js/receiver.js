import { streamUrl } from './modules/casting.js';
const video = document.getElementById('tv-video');
const field = document.getElementById('stream');
const status = document.getElementById('status');
let hls = null;
let generation = 0;
// Fragment never reaches the host; remove it from the address/history immediately.
const incoming = new URLSearchParams(location.hash.slice(1)).get('stream');
history.replaceState(null, '', location.pathname + location.search);
if (incoming) {
  try { field.value = streamUrl(incoming); } catch { status.textContent = 'Invalid receiver link. Paste an HTTP/HTTPS stream URL.'; }
}
function stop() {
  generation++;
  if (hls) hls.destroy();
  hls = null;
  video.pause();
  video.removeAttribute('src');
  video.load();
}
function failed() { status.textContent = 'Playback failed. Check HTTPS, CORS, TV codec support and provider connection limits. Try an IPTV app or external receiver.'; }
video.addEventListener('error', failed);
video.addEventListener('playing', () => { status.textContent = 'Playing on this TV.'; });
video.addEventListener('waiting', () => { status.textContent = 'Buffering…'; });
document.getElementById('receiver-form').onsubmit = async event => {
  event.preventDefault();
  let url;
  try { url = streamUrl(field.value.trim()); } catch { status.textContent = 'Enter an HTTP/HTTPS stream URL.'; return; }
  stop();
  const attempt = generation;
  status.textContent = 'Loading stream…';
  if (location.protocol === 'https:' && url.startsWith('http:')) {
    status.textContent = 'This HTTPS page may block HTTP streams. Use a trusted HTTPS stream/proxy or a TV IPTV app.';
  }
  try {
    if (/\.m3u8(?:[?#]|$)/i.test(url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
      const { default: Hls } = await import('https://esm.sh/hls.js@1.5.7');
      if (attempt !== generation) return;
      if (!Hls.isSupported()) { failed(); return; }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { hls.destroy(); hls = null; failed(); } });
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => { status.textContent = 'Press Play on the video controls to start.'; }); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
      await video.play();
    }
  } catch { if (attempt === generation) failed(); }
};
document.getElementById('stop').onclick = () => { stop(); field.value = ''; status.textContent = 'Stopped. Stream URL cleared.'; };
window.addEventListener('pagehide', stop);
