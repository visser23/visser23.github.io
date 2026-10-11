import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/js/modules/casting.js', import.meta.url), 'utf8');
const { streamUrl, receiverLink, requestRemote } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
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
