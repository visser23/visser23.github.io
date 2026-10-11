# TV playback

## Android Chrome to LG: genuine DLNA through a companion

Android Chrome cannot directly discover LG TVs with SSDP (UDP multicast) or reliably issue arbitrary LAN UPnP SOAP control from this HTTPS website. Remote Playback is not a general-purpose DLNA API. A browser local-network permission does not supply SSDP or bypass TV CORS/mixed-content restrictions. The app therefore hands the current effective HTTP/HTTPS stream URL, including any configured proxy, to **BubbleUPnP for Android**. BubbleUPnP, not this page, performs real UPnP/DLNA discovery and renderer control. No TV browser receiver page is involved in this route. No desktop bridge/server is required for a compatible stream and renderer.

1. Install [BubbleUPnP](https://play.google.com/store/apps/details?id=com.bubblesoft.android.bubbleupnp) on the Android phone. Grant its requested network permissions.
2. Turn the LG TV on and connect it and the phone to the same home LAN. Avoid guest Wi-Fi/client isolation; VPNs can interfere with discovery. Enable DLNA/SmartShare or connection permissions if the model exposes them. Accept any TV connection prompt. Menu names depend on model and firmware.
3. Open BubbleUPnP. In **Now Playing**, use the playback-device selector and select the LG **DLNA renderer**, not Local Renderer or a Chromecast device. If no LG renderer appears, the TV may not expose remotely controllable DLNA. SmartShare library browsing alone is not proof of renderer support.
4. Return to Chrome, open this app, start a channel and tap the TV icon. Tap **Open current stream in BubbleUPnP (Android)**. It sends an Android ACTION_VIEW intent with a video MIME type to the explicit BubbleUPnP package. Select/confirm the LG device and press Play there if required. The website cannot confirm that the handoff or TV playback succeeded.
5. If Chrome cannot resolve the installed app's browser-link handler, or the URL has a fragment, tap **Copy stream URL for DLNA app**, then in BubbleUPnP choose **Playlist > menu > Add stream URL**, paste, select the LG renderer and press Play. This manual route also covers app/version intent incompatibilities. If the app is absent, the automatic handoff opens only its Play Store listing, without the stream URL.
6. Use **Pause phone playback** when ready. Pausing does not guarantee that the player closes its buffered network connection; close this phone page after handing the URL to BubbleUPnP if the provider strictly permits only one connection. The app does not automatically stop local playback or assume the TV started. For a strict connection limit, close the phone page before pressing Play in BubbleUPnP. Use BubbleUPnP for TV pause/stop/volume and clear its playlist when finished.

The TV must be able to fetch the effective stream/proxy URL and decode its container/video/audio. LG DLNA HLS support varies; a compatible MPEG-TS/MP4 stream may work where HLS does not. This change adds no transcoder, DRM bypass or stream conversion. BubbleUPnP Server is not required for this handoff and is not promised to transcode video for LG DLNA (its documented video transcoding support is for Chromecast).

Credentials are necessarily disclosed to the chosen companion and playback device. They are not put in an HTTPS Pages request, Play Store fallback or persisted by the casting module. The Android intent itself contains the private URL; do not share it. Clipboard contents, companion playlists, provider/proxy logs and existing app credential storage remain outside that protection. Copy only on a trusted phone and clear clipboard/playlist manually. The page clears the displayed copied URL when the dialog closes.

### Basis and limits

- [Chrome Android intent requirements](https://developer.chrome.com/docs/android/intents): user gesture and an installed BROWSABLE activity are required.
- [BubbleUPnP capabilities](https://bubblesoftapps.com/bubbleupnp/): LG DLNA playback devices, media links from other apps, and the Now Playing device selector.
- [BubbleUPnP tips](https://bubblesoftapps.com/bubbleupnp/tips2.html): Playlist > Add stream URL.

Automated validation checks the generated intent, exact URL preservation, fixed package, credential-free fallback, invalid URL rejection, UI handlers and existing receiver behaviour. No physical Android phone/LG TV or installed BubbleUPnP handler was available for verification. The one-tap handoff is therefore unverified on hardware; the documented Add stream URL route is the fallback. Actual renderer discovery, codec support and playback require testing on the user's TV.

## Existing browser routes

1. Open https://visser23.github.io/simple-iptv/ and start a channel.
2. Press the TV icon beside Picture-in-Picture.
3. On an AirPlay-compatible LG TV, enable AirPlay in the TV settings, connect both devices to the same Wi-Fi and use Safari on an iPhone, iPad or Mac. Press **Choose TV / AirPlay**. Other browsers may provide a Remote Playback picker if they support it.
4. If the TV is absent or the stream fails, try device-level AirPlay screen mirroring, or Chrome's Cast tab with a separate Google Cast receiver. An LG webOS TV alone is not necessarily a Google Cast receiver. The app uses the Google Cast Web Sender SDK for Chromecast, but does not implement proprietary LG/DLNA control.
5. For independent playback, open https://visser23.github.io/simple-iptv/receiver.html in the TV browser. Paste the stream URL, or open the **Copy receiver link for current stream** link there, and press **Play**. This is a standalone player, not phone-to-TV pairing. Use **Stop and clear** and close the TV browser afterwards.

The receiver link contains the effective stream URL, including any configured proxy and provider credentials. It uses a URL fragment so the URL is not sent to GitHub Pages; the receiver removes the fragment from its address immediately and does not store the URL. Copy only to a trusted device. Clipboard contents are not automatically cleared.

Native casting depends on browser, TV model, firmware and codec support. MediaSource/hls.js local playback can work while remote playback fails. The receiver tries native HLS first, then hls.js 1.5.7 for .m3u8 URLs where MediaSource is supported. Older TV browsers without ES modules cannot run the receiver. No transcoding, DRM bypass or CORS bypass is included. HTTP streams on HTTPS Pages may be blocked; use a trusted HTTPS stream/proxy or a TV IPTV app. The TV must reach the stream/proxy, and simultaneous playback may exceed the provider's connection allowance. Pause local playback if necessary.

## Validation and publishing

Static files are served directly from the root of `main` by the repository's legacy GitHub Pages build; no bundling step or project lint configuration exists.

Run `node --test simple-iptv/tests/casting.test.mjs`, syntax-check the changed JS with `node --check`, and run `git diff --check`. Tests cover URL validation, Android intent construction and credential-free fallback, companion UI handlers, fragment privacy, native picker invocation/error propagation, HTML integration, receiver playback and clearing. Hardware casting requires a compatible TV and was not tested during implementation.

## Chromecast / Google Cast built-in

Select a channel, tap the TV icon, then **Choose Chromecast / Google Cast TV** and select the TV. Keep phone and TV on the same Wi-Fi. The SDK uses Google's default media receiver, so no custom receiver registration is needed. The effective HTTP/HTTPS URL (including the configured proxy) is loaded after receiver selection, never the phone-local hls.js/MediaSource blob. Local playback is left running; pause it when TV playback starts.

The old browser picker only called Remote Playback on the local video element. That is not a Google Cast sender integration and cannot reliably discover/cast an hls.js MediaSource stream. The dedicated button now invokes `CastContext.requestSession()` synchronously from the tap, then `loadMedia()` on the selected session. SDK loading, cancellation, disconnection and load failures have visible feedback, without printing private URLs.

Google documents Web Sender support for Cast-supported browsers on Android: https://developers.google.com/cast/docs/web_sender . If the SDK is blocked or unavailable, there is no reliable SDK-free Chromecast picker for this player. Use BubbleUPnP and select the Chromecast device, or the TV browser receiver fallback. The standalone receiver.html is not a registered Chromecast receiver.

The default receiver must reach and decode the source. HLS is inferred for extensionless URLs; explicit .ts, .mp4 and .mpd URLs use their corresponding MIME types. A provider using a different extensionless format may need a compatible proxy URL or companion app. CORS, HTTP/mixed-content, DRM and connection limits remain. Physical Android/Chromecast playback has not been verified in this environment.
