/** Browser routes and an explicit Android companion handoff, not browser DLNA. */
export function streamUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS stream URL.');
  return url.href;
}
export function receiverLink(value, base) {
  const url = new URL('receiver.html', base);
  url.hash = new URLSearchParams({ stream: streamUrl(value) }).toString();
  return url.href;
}
// Chrome requires a user gesture and a BROWSABLE handler in the companion app.
// Keep provider credentials out of the HTTPS fallback and Pages requests.
export function androidDlnaIntent(value) {
  const url = new URL(streamUrl(value));
  if (url.hash) throw new Error('Use Copy stream URL for streams with fragments.');
  const scheme = url.protocol.slice(0, -1);
  const fallback = 'https://play.google.com/store/apps/details?id=com.bubblesoft.android.bubbleupnp';
  return `intent:${url.href.slice(url.protocol.length)}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;type=video/*;package=com.bubblesoft.android.bubbleupnp;S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
export async function requestRemote(video) {
  // Do not await discovery: prompt must run within the user's click activation.
  if (video.remote && !video.disableRemotePlayback) return video.remote.prompt();
  if (typeof video.webkitShowPlaybackTargetPicker === 'function') return video.webkitShowPlaybackTargetPicker();
  throw new Error('Remote playback is not supported by this browser.');
}
export function initCasting(video, getUrl) {
  const dialog = document.getElementById('modal-cast');
  const status = document.getElementById('cast-status');
  const say = text => { status.textContent = text; };
  document.getElementById('btn-cast').onclick = () => {
    say(getUrl() ? 'Choose a method below.' : 'Select a channel first.');
    document.getElementById('cast-native').disabled = !getUrl();
    document.getElementById('cast-copy').disabled = !getUrl();
    const android = /Android/i.test(navigator.userAgent);
    document.getElementById('cast-android').disabled = !getUrl() || !android;
    document.getElementById('cast-stream-copy').disabled = !getUrl();
    dialog.showModal();
  };
  document.getElementById('cast-close').onclick = () => dialog.close();
  document.getElementById('cast-native').onclick = () => {
    requestRemote(video).then(() => say('Picker opened. Select a compatible TV; playback depends on its stream support.'))
      .catch(error => say(error.name === 'NotAllowedError' ? 'Picker cancelled or permission denied. Try again, or use the TV browser below.' : 'No compatible route available. Use Safari with an AirPlay-enabled LG TV, or try the TV browser below.'));
  };
  document.getElementById('cast-android').onclick = () => {
    try {
      // No async work before navigation: retain Chrome's click activation.
      const intent = androidDlnaIntent(getUrl());
      say('Handing the stream to BubbleUPnP. Select your LG renderer there. This page cannot confirm TV playback. If it does not open, use Copy stream URL.');
      location.href = intent;
    } catch { say('Select an HTTP/HTTPS stream first. For a URL with a fragment, use Copy stream URL.'); }
  };
  document.getElementById('cast-pause').onclick = () => {
    video.pause();
    say('Phone playback paused. TV controls are in BubbleUPnP.');
  };
  document.getElementById('cast-stream-copy').onclick = async () => {
    try {
      const url = streamUrl(getUrl());
      const field = document.getElementById('cast-link');
      field.value = url;
      field.hidden = false;
      try { await navigator.clipboard.writeText(url); say('Private stream URL copied. In BubbleUPnP, use Playlist > menu > Add stream URL.'); }
      catch { field.focus(); field.select(); say('Copy the selected private URL, then use Add stream URL in BubbleUPnP.'); }
    } catch { say('Select a channel with an HTTP or HTTPS stream first.'); }
  };
  document.getElementById('cast-copy').onclick = async () => {
    try {
      const link = receiverLink(getUrl(), location.href);
      const field = document.getElementById('cast-link');
      field.value = link;
      field.hidden = false;
      try { await navigator.clipboard.writeText(link); say('Receiver link copied. Open it on the TV.'); }
      catch { field.focus(); field.select(); say('Copy the selected link manually, then open it on the TV.'); }
    } catch { say('Select a channel with an HTTP or HTTPS stream first.'); }
  };
  dialog.addEventListener('close', () => { const field = document.getElementById('cast-link'); field.value = ''; field.hidden = true; });
  if (video.remote) {
    for (const state of ['connecting', 'connect', 'disconnect']) video.remote.addEventListener(state, () => {
      document.getElementById('btn-cast').title = `TV playback: ${video.remote.state}`;
      say(`TV playback: ${video.remote.state}`);
    });
  }
}
