/** Google Cast Web Sender. The TV receives the effective URL, never an MSE blob. */
export function contentType(value) {
  const path = new URL(value).pathname.toLowerCase();
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.ts')) return 'video/mp2t';
  if (path.endsWith('.mpd')) return 'application/dash+xml';
  return 'application/x-mpegURL';
}
export async function requestGoogleCast(context, value, api) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Choose an HTTP/HTTPS stream first.');
  if (!context || !api?.media) throw new Error('Google Cast is not ready.');
  // Must be called before the first await, directly from the user's tap.
  await context.requestSession();
  const session = context.getCurrentSession();
  if (!session) throw new Error('Receiver disconnected.');
  const media = new api.media.MediaInfo(url.href, contentType(url.href));
  const request = new api.media.LoadRequest(media);
  request.autoplay = true;
  await session.loadMedia(request);
}
export function castError(error) {
  const code = typeof error === 'string' ? error : error?.code || error?.message;
  if (code === 'cancel' || code === 'CANCEL') return 'Receiver selection cancelled. Tap Choose Chromecast to try again.';
  if (code === 'Google Cast is not ready.') return 'Google Cast SDK is unavailable or still loading. Wait and retry in Chrome. If it remains unavailable, open the stream in BubbleUPnP and select the Chromecast there.';
  if (code === 'Choose an HTTP/HTTPS stream first.' || code === 'Receiver disconnected.') return code;
  return 'The TV could not load the stream or the Cast connection failed. Check same Wi-Fi, TV access to the stream, HTTPS/CORS, codecs and provider connection limits. Try BubbleUPnP or the TV browser fallback.';
}
export function initGoogleCast(getUrl) {
  const button = document.getElementById('cast-google');
  const status = document.getElementById('cast-status');
  const say = text => { status.textContent = text; };
  let context = null;
  let busy = false;
  window.__onGCastApiAvailable = available => {
    if (!available) { say(castError('Google Cast is not ready.')); return; }
    try {
      const framework = window.cast.framework;
      context = framework.CastContext.getInstance();
      context.setOptions({ receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
      context.addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, event => {
        if (event.sessionState === framework.SessionState.SESSION_ENDED) say('Chromecast session ended. Phone playback is unchanged.');
      });
    } catch { context = null; say(castError('Google Cast is not ready.')); }
  };
  button.onclick = () => {
    if (busy) return;
    if (!getUrl()) { say('Select a channel first.'); return; }
    say('Opening Chromecast receiver selection…');
    busy = true;
    button.disabled = true;
    requestGoogleCast(context, getUrl(), window.chrome?.cast)
      .then(() => say('Stream loaded on Chromecast. Use the TV remote or Cast controls for TV playback. Pause phone playback below if needed.'))
      .catch(error => say(castError(error)))
      .finally(() => { busy = false; button.disabled = false; });
  };
  // Install callback before loading the SDK. Never wait for script loading inside a tap.
  const script = document.createElement('script');
  script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  script.async = true;
  script.onerror = () => say(castError('Google Cast is not ready.'));
  document.head.appendChild(script);
}
