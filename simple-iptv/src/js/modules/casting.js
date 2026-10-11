/** Browser-provided routes only: no assumption that LG implements Google Cast. */
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
    dialog.showModal();
  };
  document.getElementById('cast-close').onclick = () => dialog.close();
  document.getElementById('cast-native').onclick = () => {
    requestRemote(video).then(() => say('Picker opened. Select a compatible TV; playback depends on its stream support.'))
      .catch(error => say(error.name === 'NotAllowedError' ? 'Picker cancelled or permission denied. Try again, or use the TV browser below.' : 'No compatible route available. Use Safari with an AirPlay-enabled LG TV, or try the TV browser below.'));
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
