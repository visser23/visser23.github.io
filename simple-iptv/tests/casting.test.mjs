import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/js/modules/casting.js', import.meta.url), 'utf8');
const { streamUrl, receiverLink, requestRemote, androidDlnaIntent } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
test('reject unsafe and local media URLs', () => {
  for (const url of ['javascript:alert(1)', 'blob:https://example.org/a', 'file:///tmp/a', '']) assert.throws(() => streamUrl(url));
  assert.equal(streamUrl('https://example.org/live.m3u8?token=test'), 'https://example.org/live.m3u8?token=test');
});
test('receiver keeps stream out of request path/query', () => {
  const link = new URL(receiverLink('https://example.org/live.m3u8?token=test', 'https://visser23.github.io/simple-iptv/'));
  assert.equal(link.pathname, '/simple-iptv/receiver.html');
  assert.equal(link.search, '');
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('stream'), 'https://example.org/live.m3u8?token=test');
});
test('remote prompt stays in click activation and handles capabilities', async () => {
  let called = false;
  const promise = requestRemote({ remote: { prompt: () => { called = true; return Promise.resolve(); } } });
  assert.equal(called, true);
  await promise;
  await assert.rejects(requestRemote({}), /not supported/);
  called = false;
  await requestRemote({ webkitShowPlaybackTargetPicker: () => { called = true; } });
  assert.equal(called, true);
  await assert.rejects(requestRemote({ remote: { prompt: () => Promise.reject(new Error('cancelled')) } }), /cancelled/);
});

test('all app and receiver hooks exist in shipped HTML', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['btn-cast', 'modal-cast', 'cast-status', 'cast-native', 'cast-copy', 'cast-link', 'cast-close']) assert.ok(html.includes(`id="${id}"`), id);
  const app = await readFile(new URL('../src/js/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('initCasting(videoElement'));
  assert.ok(app.includes('storage.applyProxyToUrl(url)'));
  const receiver = await readFile(new URL('../receiver.html', import.meta.url), 'utf8');
  assert.ok(receiver.includes('src="src/js/receiver.js"'));
  assert.ok(receiver.includes('content="no-referrer"'));
});

test('receiver scrubs fragment, starts native playback and clears secrets on stop', async () => {
  const { runInNewContext } = await import('node:vm');
  let source = await readFile(new URL('../src/js/receiver.js', import.meta.url), 'utf8');
  source = source.replace("import { streamUrl } from './modules/casting.js';", '');
  const listeners = {};
  const video = { addEventListener: (name, fn) => { listeners[name] = fn; }, pause() {}, load() {}, removeAttribute() { delete this.src; }, canPlayType: () => 'probably', play: async () => {} };
  const elements = { 'tv-video': video, stream: {}, status: {}, 'receiver-form': {}, stop: {} };
  let replaced;
  runInNewContext(source, {
    streamUrl, URLSearchParams,
    document: { getElementById: id => elements[id] },
    location: { hash: '#stream=https%3A%2F%2Fexample.org%2Flive.m3u8', pathname: '/simple-iptv/receiver.html', search: '', protocol: 'https:' },
    history: { replaceState: (...args) => { replaced = args[2]; } },
    window: { addEventListener() {} },
  });
  assert.equal(replaced, '/simple-iptv/receiver.html');
  assert.equal(elements.stream.value, 'https://example.org/live.m3u8');
  await elements['receiver-form'].onsubmit({ preventDefault() {} });
  assert.equal(video.src, 'https://example.org/live.m3u8');
  listeners.playing();
  assert.equal(elements.status.textContent, 'Playing on this TV.');
  elements.stop.onclick();
  assert.equal(elements.stream.value, '');
  assert.equal(video.src, undefined);
  elements.stream.value = 'javascript:alert(1)';
  await elements['receiver-form'].onsubmit({ preventDefault() {} });
  assert.equal(elements.status.textContent, 'Enter an HTTP/HTTPS stream URL.');
});

 test('Android handoff targets only BubbleUPnP and preserves the effective private URL', () => {
  const media = 'https://example.org/live/user/pass/123.m3u8?token=a%26b';
  const intent = androidDlnaIntent(media);
  assert.ok(intent.startsWith('intent://example.org/live/user/pass/123.m3u8?token=a%26b#Intent;'));
  assert.ok(intent.includes('scheme=https;'));
  assert.ok(intent.includes('action=android.intent.action.VIEW;'));
  assert.ok(intent.includes('package=com.bubblesoft.android.bubbleupnp;'));
  assert.ok(intent.includes('type=video/*;'));
  const fallback = intent.match(/S.browser_fallback_url=([^;]+)/)[1];
  assert.equal(decodeURIComponent(fallback), 'https://play.google.com/store/apps/details?id=com.bubblesoft.android.bubbleupnp');
  assert.ok(!decodeURIComponent(fallback).includes('token'));
  assert.ok(androidDlnaIntent('http://example.org/a.ts').includes('scheme=http;'));
  for (const value of ['javascript:alert(1)', 'blob:https://example.org/a', 'https://example.org/a#Intent;package=evil;end']) assert.throws(() => androidDlnaIntent(value));
 });
 test('companion controls and explicit Android limits are shipped', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['cast-android', 'cast-stream-copy', 'cast-pause']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('Chrome cannot discover or control DLNA TVs directly'));
 });

test('Android click hands off synchronously, manual copy works, and local playback is preserved', async () => {
  const { runInNewContext } = await import('node:vm');
  const listeners = {};
  const ids = ['modal-cast', 'cast-status', 'btn-cast', 'cast-native', 'cast-copy', 'cast-link', 'cast-close', 'cast-android', 'cast-stream-copy', 'cast-pause'];
  const elements = Object.fromEntries(ids.map(id => [id, { addEventListener: (name, fn) => { listeners[name] = fn; }, showModal() {}, close() {} }]));
  let paused = false;
  let copied;
  let current = 'https://example.org/live/private.m3u8?token=secret';
  const location = { href: 'https://visser23.github.io/simple-iptv/' };
  const context = {
    URL, URLSearchParams, location,
    navigator: { userAgent: 'Android Chrome', clipboard: { writeText: async value => { copied = value; } } },
    document: { getElementById: id => elements[id] },
  };
  runInNewContext(source.replaceAll('export ', ''), context);
  context.initCasting({ pause: () => { paused = true; } }, () => current);
  elements['btn-cast'].onclick();
  assert.equal(elements['cast-android'].disabled, false);
  elements['cast-android'].onclick();
  assert.equal(location.href, androidDlnaIntent(current));
  assert.equal(paused, false, 'handoff must not interrupt local playback');
  await elements['cast-stream-copy'].onclick();
  assert.equal(copied, current);
  assert.equal(elements['cast-link'].value, current);
  listeners.close();
  assert.equal(elements['cast-link'].value, '');
  assert.equal(elements['cast-link'].hidden, true);
  elements['cast-pause'].onclick();
  assert.equal(paused, true);
  context.navigator.userAgent = 'iPhone Safari';
  elements['btn-cast'].onclick();
  assert.equal(elements['cast-android'].disabled, true);
  current = null;
  elements['btn-cast'].onclick();
  assert.equal(elements['cast-stream-copy'].disabled, true);
});
