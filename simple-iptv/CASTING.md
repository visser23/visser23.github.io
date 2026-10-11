# TV playback

1. Open https://visser23.github.io/simple-iptv/ and start a channel.
2. Press the TV icon beside Picture-in-Picture.
3. On an AirPlay-compatible LG TV, enable AirPlay in the TV settings, connect both devices to the same Wi-Fi and use Safari on an iPhone, iPad or Mac. Press **Choose TV / AirPlay**. Other browsers may provide a Remote Playback picker if they support it.
4. If the TV is absent or the stream fails, try device-level AirPlay screen mirroring, or Chrome's Cast tab with a separate Google Cast receiver. An LG webOS TV alone is not necessarily a Google Cast receiver. The app does not implement the Google Cast SDK or proprietary LG/DLNA control.
5. For independent playback, open https://visser23.github.io/simple-iptv/receiver.html in the TV browser. Paste the stream URL, or open the **Copy receiver link for current stream** link there, and press **Play**. This is a standalone player, not phone-to-TV pairing. Use **Stop and clear** and close the TV browser afterwards.

The receiver link contains the effective stream URL, including any configured proxy and provider credentials. It uses a URL fragment so the URL is not sent to GitHub Pages; the receiver removes the fragment from its address immediately and does not store the URL. Copy only to a trusted device. Clipboard contents are not automatically cleared.

Native casting depends on browser, TV model, firmware and codec support. MediaSource/hls.js local playback can work while remote playback fails. The receiver tries native HLS first, then hls.js 1.5.7 for .m3u8 URLs where MediaSource is supported. Older TV browsers without ES modules cannot run the receiver. No transcoding, DRM bypass or CORS bypass is included. HTTP streams on HTTPS Pages may be blocked; use a trusted HTTPS stream/proxy or a TV IPTV app. The TV must reach the stream/proxy, and simultaneous playback may exceed the provider's connection allowance. Pause local playback if necessary.

## Validation and publishing

Static files are served directly from the root of `main` by the repository's legacy GitHub Pages build; no bundling step or project lint configuration exists.

Run `node --test simple-iptv/tests/casting.test.mjs`, syntax-check the changed JS with `node --check`, and run `git diff --check`. Tests cover URL validation, fragment privacy, native picker invocation/error propagation, HTML integration, receiver playback and clearing. Hardware casting requires a compatible TV and was not tested during implementation.
