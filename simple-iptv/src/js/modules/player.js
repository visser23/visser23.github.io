/**
 * Player Module
 * Handles HLS playback with hls.js or native HLS support
 * 
 * DEBUG MODE: Set window.PLAYER_DEBUG = true in console for verbose logging
 */

import { applyProxyToUrl } from './storage.js';

// Debug logging - disabled in production, enable via console: window.PLAYER_DEBUG = true
const DEBUG = () => window.PLAYER_DEBUG === true;
const log = (...args) => DEBUG() && console.log('[Player]', ...args);
const debug = (...args) => DEBUG() && console.log('[Player:DEBUG]', ...args);
const warn = (...args) => console.warn('[Player]', ...args);
const error = (...args) => console.error('[Player]', ...args);

// Use centralized proxy function
const applyProxy = applyProxyToUrl;

// hls.js will be loaded dynamically when needed
let Hls = null;
let hlsInstance = null;

// Track current state
let currentChannel = null;
let isPlaying = false;
let videoElement = null;

// Track last preflight result for error messaging
let lastPreflightResult = null;

// Error types
export const ErrorTypes = {
  CORS: 'cors',
  BLOCKED: 'blocked',
  NETWORK: 'network',
  FORMAT: 'format',
  MEDIA: 'media',
  EMPTY_STREAM: 'empty_stream',
  CODEC: 'codec',
  UNKNOWN: 'unknown',
};

// Event callbacks
const listeners = {
  onStateChange: [],
  onError: [],
  onTimeUpdate: [],
};

// Known blocking status codes used by IPTV providers
const BLOCKED_STATUS_CODES = [401, 403, 451, 458, 459, 460];


/**
 * Check if browser supports native HLS (Safari/iOS)
 * @returns {boolean}
 */
export function supportsNativeHLS() {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Check if browser supports MSE (required for hls.js)
 * @returns {boolean}
 */
export function supportsMSE() {
  return 'MediaSource' in window || 'WebKitMediaSource' in window;
}

/**
 * Check if browser supports HEVC/H.265 codec
 * @returns {boolean}
 */
export function supportsHEVC() {
  const video = document.createElement('video');
  // Check various HEVC MIME types
  const hevcTypes = [
    'video/mp4; codecs="hvc1"',
    'video/mp4; codecs="hev1"',
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp2t; codecs="hvc1"',
  ];
  return hevcTypes.some(type => video.canPlayType(type) !== '');
}

/**
 * Get codec support info for debugging
 * @returns {Object}
 */
export function getCodecSupport() {
  const video = document.createElement('video');
  return {
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    hevc: supportsHEVC(),
    vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
    av1: video.canPlayType('video/mp4; codecs="av01.0.00M.08"') !== '',
    nativeHLS: supportsNativeHLS(),
    mse: supportsMSE(),
  };
}

/**
 * Load hls.js library dynamically
 * @returns {Promise<void>}
 */
async function loadHlsJs() {
  if (Hls) return;
  
  try {
    const module = await import('https://esm.sh/hls.js@1.5.7');
    Hls = module.default;
    console.log('[Player] hls.js loaded successfully');
  } catch (e) {
    console.error('[Player] Failed to load hls.js:', e);
    throw new Error('Failed to load video library');
  }
}

/**
 * Preflight check - fetch the manifest to detect blocking before playback
 * @param {string} url 
 * @param {boolean} isProxied - Whether this URL has already been proxied
 * @returns {Promise<{ok: boolean, status: number, error?: string}>}
 */
async function preflightCheck(url, isProxied = false) {
  log('Preflight check:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
  
  // Detect content type from URL
  const urlLower = url.toLowerCase();
  const isHLS = urlLower.includes('.m3u8') || urlLower.includes('m3u8');
  const isVOD = urlLower.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm)(\?|$)/i);
  log('  Content type detection:');
  log('    Is HLS:', isHLS);
  log('    Is VOD:', !!isVOD);
  if (isVOD) log('    VOD extension:', isVOD[1]);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    debug('  Creating fetch request...');
    debug('  Mode: cors');
    debug('  Headers: Range: bytes=0-1000');
    
    const startTime = performance.now();
    
    // Build headers with session ID for proxy tracking
    const fetchHeaders = {
      'Range': 'bytes=0-1000'
    };
    
    // Add session ID if using proxy
    if (isProxied) {
      fetchHeaders['X-Session-Id'] = getSessionId();
    }
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: fetchHeaders
    });
    const elapsed = (performance.now() - startTime).toFixed(0);
    
    clearTimeout(timeoutId);
    
    log('PREFLIGHT RESPONSE:');
    log('  Status:', response.status, response.statusText);
    log('  Time:', elapsed + 'ms');
    log('  OK:', response.ok);
    
    // Log important headers
    const contentType = response.headers.get('content-type') || 'unknown';
    const contentLength = response.headers.get('content-length') || 'unknown';
    const contentRange = response.headers.get('content-range') || 'unknown';
    log('  Content-Type:', contentType);
    log('  Content-Length:', contentLength);
    log('  Content-Range:', contentRange);
    
    debug('  All response headers:');
    response.headers.forEach((value, key) => {
      debug('    ' + key + ':', value);
    });
    
    // For VOD files, just check the status - don't try to read body
    if (isVOD) {
      log('  VOD file detected - checking status only (not reading body)');
      
      // Accept 200 OK or 206 Partial Content (from Range request)
      if (response.status === 200 || response.status === 206) {
      log('✓ VOD accessible');
      return { ok: true, status: response.status };
      }
      
      // Check for blocking
      if (BLOCKED_STATUS_CODES.includes(response.status)) {
      log('✗ VOD blocked (status ' + response.status + ')');
      return {
          ok: false,
          status: response.status,
          error: 'blocked',
          message: `VOD blocked by provider (HTTP ${response.status}). Try copying the URL to VLC.`
        };
      }
      
      // Other error
      log('✗ VOD request failed (status ' + response.status + ')');
      return {
        ok: false,
        status: response.status,
        error: 'network',
        message: `VOD request failed (HTTP ${response.status})`
      };
    }
    
    // For HLS streams, read and analyze the manifest
    let bodyText = '';
    try {
      const clone = response.clone();
      // Only read a small chunk to avoid hanging on large responses
      const reader = clone.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        bodyText = value ? new TextDecoder().decode(value) : '';
        reader.releaseLock();
      } else {
        bodyText = await clone.text();
      }
      debug('  Response body preview:', bodyText.substring(0, 300));
      
      // Check for proxy error messages
      if (bodyText.includes('Upstream:') || bodyText.includes('Proxy error:') || bodyText.includes('403')) {
        log('  ⚠️ Response body contains proxy error indicators!');
        log('  Full body:', bodyText);
      }
      
      // Check if it's an HLS manifest
      if (bodyText.includes('#EXTM3U')) {
        log('  📋 Response is HLS manifest');
        
        // Check for empty/dead stream (has #EXTINF but no segment URL after it)
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
        const hasExtInf = lines.some(l => l.startsWith('#EXTINF'));
        const hasEndList = lines.some(l => l.startsWith('#EXT-X-ENDLIST'));
        
        // Look for actual segment URLs (lines that don't start with #)
        const segmentUrls = lines.filter(l => !l.startsWith('#') && l.length > 0);
        
        debug('  Manifest analysis:');
        debug('    Has #EXTINF:', hasExtInf);
        debug('    Has #EXT-X-ENDLIST:', hasEndList);
        debug('    Segment URLs found:', segmentUrls.length);
        if (segmentUrls.length > 0) {
          debug('    First segment:', segmentUrls[0]);
        }
        
        // Empty manifest: has structure but no actual segments
        if (hasEndList && segmentUrls.length === 0) {
        log('⚠️ Empty manifest - stream offline/ended');
        return {
            ok: false,
            status: response.status,
            error: 'empty_stream',
            message: 'Stream is offline or has ended. The channel returned an empty playlist.'
          };
        }
        
        // Check if manifest has very few segments (might be ending soon)
        if (segmentUrls.length < 3 && hasEndList) {
          warn('  ⚠️ Stream has very few segments remaining - may end soon');
        }
      }
    } catch (bodyErr) {
      debug('  Could not read body:', bodyErr.message);
    }
    
    if (BLOCKED_STATUS_CODES.includes(response.status)) {
    log('✗ Blocked (HTTP ' + response.status + ')');
    return {
        ok: false, 
        status: response.status, 
        error: `blocked`,
        message: `Stream blocked by provider (HTTP ${response.status})`
      };
    }
    
    if (!response.ok && response.status !== 206) { // 206 is partial content (range request)
    log('✗ HTTP error ' + response.status);
    return {
        ok: false, 
        status: response.status, 
        error: 'http_error',
        message: `HTTP error ${response.status}`
      };
    }
    
    log('✓ Preflight OK');
    return { ok: true, status: response.status };
    
  } catch (e) {
    error('Preflight error:', e.message);
    
    // Analyze the error type
    if (e.name === 'AbortError') {
      return { ok: false, status: 0, error: 'timeout', message: 'Request timed out' };
    }
    
    if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
      // This usually means CORS blocked or network error
      return { 
        ok: false, 
        status: 0, 
        error: 'cors_or_network',
        message: 'Stream blocked (CORS) or network error'
      };
    }
    
    return { ok: false, status: 0, error: 'unknown', message: e.message };
  }
}

/**
 * Initialize player with video element
 * @param {HTMLVideoElement} element 
 */
export function init(element) {
  videoElement = element;
  
  // Set up event listeners
  videoElement.addEventListener('play', () => {
    isPlaying = true;
    emit('onStateChange', { playing: true });
  });
  
  videoElement.addEventListener('pause', () => {
    isPlaying = false;
    emit('onStateChange', { playing: false });
  });
  
  videoElement.addEventListener('timeupdate', () => {
    emit('onTimeUpdate', {
      currentTime: videoElement.currentTime,
      duration: videoElement.duration,
    });
  });
  
  videoElement.addEventListener('waiting', () => {
    emit('onStateChange', { buffering: true });
  });
  
  videoElement.addEventListener('playing', () => {
    emit('onStateChange', { buffering: false });
  });
  
  videoElement.addEventListener('error', (e) => {
    handleVideoError(e);
  });
  
  console.log('[Player] Initialized');
}

/**
 * Play a channel
 * @param {Object} channel - { id, name, url, ... }
 */
export async function play(channel) {
  if (!videoElement) {
    throw new Error('Player not initialized');
  }
  
  // Stop current playback - this closes browser connections,
  // which the proxy detects and aborts upstream requests
  stop();
  
  currentChannel = channel;
  const originalUrl = channel.url;
  
  // Detect content type
  const contentType = channel.type || 'live';
  const urlLower = originalUrl.toLowerCase();
  const isHLS = urlLower.includes('.m3u8');
  const isVOD = urlLower.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm)(\?|$)/i);
  const extension = isVOD ? isVOD[1] : (isHLS ? 'm3u8' : 'unknown');
  
  log('');
  log('▶ PLAY:', channel.name, isVOD ? '[VOD]' : isHLS ? '[HLS]' : '');
  debug('Channel object:', JSON.stringify(channel, null, 2));
  log('Original stream URL:', originalUrl);
  log('File extension:', extension);
  
  // Warn about potentially problematic containers
  if (extension === 'mkv') {
    warn('⚠️ MKV container detected - browser support varies. May need external player.');
  }
  
  // Apply proxy if configured
  const url = applyProxy(originalUrl);
  const usingProxy = url !== originalUrl;
  
  log('Using proxy:', usingProxy ? 'YES' : 'NO');
  if (usingProxy) {
    log('Proxied URL:', url);
    log('Proxy URL length:', url.length);
  }
  
  emit('onStateChange', { loading: true, channel });
  
  // Log playback capabilities
  log('Supports native HLS:', supportsNativeHLS());
  log('Supports MSE (hls.js):', supportsMSE());
  log('Supports HEVC/H.265:', supportsHEVC());
  
  // Log full codec support for debugging
  const codecSupport = getCodecSupport();
  debug('Full codec support:', codecSupport);
  
  // SKIP preflight when using proxy - the proxy handles errors and returns proper status codes.
  // Preflight was causing DOUBLE requests to upstream (preflight + hls.js), triggering provider blocks.
  if (!usingProxy) {
    log('');
    log('Running preflight check (no proxy)...');
    lastPreflightResult = await preflightCheck(url, false);
    
    if (!lastPreflightResult.ok) {
      error('PREFLIGHT FAILED:', lastPreflightResult);
      
      const err = new Error(lastPreflightResult.message);
      
      switch (lastPreflightResult.error) {
        case 'blocked':
          err.type = ErrorTypes.BLOCKED;
          break;
        case 'cors_or_network':
          err.type = ErrorTypes.CORS;
          break;
        case 'empty_stream':
          err.type = ErrorTypes.EMPTY_STREAM;
          break;
        default:
          err.type = ErrorTypes.NETWORK;
      }
      
      err.hint = getErrorHint(err.type);
      err.status = lastPreflightResult.status;
      
      emit('onStateChange', { loading: false });
      emit('onError', { 
        type: err.type, 
        message: err.message, 
        hint: err.hint,
        status: lastPreflightResult.status 
      });
      throw err;
    }
    
    log('✓ Preflight passed');
  } else {
    log('Skipping preflight (using proxy)');
  }
  
  try {
    if (isHLS && supportsNativeHLS()) {
      // Safari/iOS: native HLS
      log('Playback method: NATIVE HLS (Safari/iOS)');
      log('Setting video.src to:', url);
      await playNative(url);
    } else if (isHLS && supportsMSE()) {
      // Chrome/Firefox/Edge: use hls.js
      log('Playback method: HLS.JS');
      await playWithHls(url);
    } else if (!isHLS) {
      // Direct playback (MP4, etc.)
      log('Playback method: NATIVE (non-HLS)');
      await playNative(url);
    } else {
      throw new Error('HLS playback not supported on this browser');
    }
    
    log('✓ Playback started');
    
  } catch (err) {
    error('PLAYBACK FAILED:', err);
    error('Error name:', err.name);
    error('Error message:', err.message);
    error('Error stack:', err.stack);
    throw err;
  }
}

/**
 * Get helpful hint based on error type
 * @param {string} errorType 
 * @returns {string}
 */
function getErrorHint(errorType) {
  switch (errorType) {
    case ErrorTypes.BLOCKED:
      return 'This provider blocks browser playback. Copy the stream URL and use VLC or another media player.';
    case ErrorTypes.CORS:
      return 'The stream is blocked by browser security (CORS). Copy the URL and use an external player like VLC.';
    case ErrorTypes.NETWORK:
      return 'Network error. Check your connection or try a different channel.';
    case ErrorTypes.FORMAT:
      return 'This stream format is not supported by your browser. Try an external player.';
    case ErrorTypes.MEDIA:
      return 'Media decoding error. The stream may be corrupted or use an unsupported codec.';
    case ErrorTypes.EMPTY_STREAM:
      return 'This channel is offline or the content has ended. Try a different channel or refresh your playlist.';
    case ErrorTypes.CODEC:
      return 'This stream uses HEVC/H.265 codec which may not be supported. Try Safari on macOS, or copy the URL to VLC.';
    default:
      return 'Try copying the stream URL and playing it in VLC or another media player.';
  }
}

/**
 * Play using native video element
 * @param {string} url 
 */
async function playNative(url) {
  log('');
  log('playNative() called');
  debug('  URL:', url);
  
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    // Add event listeners to track what's happening
    const onLoadStart = () => {
      debug('  Event: loadstart');
    };
    
    const onProgress = () => {
      debug('  Event: progress', {
        buffered: videoElement.buffered.length > 0 
          ? `${videoElement.buffered.start(0)}-${videoElement.buffered.end(0)}` 
          : 'none',
        networkState: videoElement.networkState,
        readyState: videoElement.readyState
      });
    };
    
    const onLoadedData = () => {
      debug('  Event: loadeddata');
    };
    
    const onCanPlay = () => {
      log('  Event: canplay - Video is ready!');
      if (resolved) return;
      resolved = true;
      cleanup();
      videoElement.play().catch((e) => {
        error('  Play() method failed:', e);
        reject(e);
      });
      emit('onStateChange', { loading: false });
      resolve();
    };
    
    const onError = (e) => {
      error('  Event: error');
      error('  Video element error object:', videoElement.error);
      error('  Error code:', videoElement.error?.code);
      error('  Error message:', videoElement.error?.message);
      error('  Network state:', videoElement.networkState);
      error('  Ready state:', videoElement.readyState);
      error('  Current src:', videoElement.currentSrc);
      
      if (resolved) return;
      resolved = true;
      cleanup();
      handleVideoError(e);
      reject(new Error('Playback failed'));
    };
    
    const onStalled = () => {
      warn('  Event: stalled - Network not responding');
    };
    
    const onWaiting = () => {
      debug('  Event: waiting');
    };
    
    const onAbort = () => {
      warn('  Event: abort');
    };
    
    let cleanup = () => {
      videoElement.removeEventListener('loadstart', onLoadStart);
      videoElement.removeEventListener('progress', onProgress);
      videoElement.removeEventListener('loadeddata', onLoadedData);
      videoElement.removeEventListener('canplay', onCanPlay);
      videoElement.removeEventListener('error', onError);
      videoElement.removeEventListener('loadedmetadata', onCanPlay);
      videoElement.removeEventListener('stalled', onStalled);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('abort', onAbort);
    };
    
    videoElement.addEventListener('loadstart', onLoadStart);
    videoElement.addEventListener('progress', onProgress);
    videoElement.addEventListener('loadeddata', onLoadedData);
    videoElement.addEventListener('canplay', onCanPlay, { once: true });
    videoElement.addEventListener('loadedmetadata', onCanPlay, { once: true });
    videoElement.addEventListener('error', onError, { once: true });
    videoElement.addEventListener('stalled', onStalled);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('abort', onAbort);
    
    // Detect if this is a VOD file (needs stricter timeout)
    const urlLower = url.toLowerCase();
    const isVOD = urlLower.match(/\.(mp4|mkv|avi|mov|wmv|flv|webm)(\?|$|%)/i);
    
    log('  Setting video.src...');
    log('  Is VOD file:', !!isVOD);
    videoElement.src = url;
    log('  Calling video.load()...');
    videoElement.load();
    log('  Waiting for video events...');
    
    // Timeout fallback - stricter for VOD files since they should load faster
    const timeoutMs = isVOD ? 30000 : 15000;
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        
        error('  ⏱️ TIMEOUT: ' + (timeoutMs/1000) + ' seconds elapsed without playback');
        error('  Network state:', videoElement.networkState);
        error('  Ready state:', videoElement.readyState);
        error('  Current src:', videoElement.currentSrc);
        error('  Buffered ranges:', videoElement.buffered.length);
        
        // Provide helpful error message
        const networkStates = ['EMPTY', 'IDLE', 'LOADING', 'NO_SOURCE'];
        const readyStates = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
        
        let errorMessage = 'Playback timeout';
        let errorHint = 'The video failed to start playing in time.';
        
        if (videoElement.networkState === 3) {
          errorMessage = 'Unable to load video';
          errorHint = 'The video source could not be loaded. It may be blocked, offline, or use an unsupported format.';
        } else if (videoElement.readyState === 0) {
          errorMessage = 'Video not loading';
          errorHint = 'No video data received. Check your network connection or try copying the URL to VLC.';
        } else if (isVOD) {
          errorMessage = 'VOD playback timeout';
          errorHint = 'The movie/episode is taking too long to load. It may use an unsupported codec (like HEVC) or be blocked.';
        }
        
        emit('onStateChange', { loading: false });
        emit('onError', {
          type: ErrorTypes.NETWORK,
          message: errorMessage,
          hint: errorHint
        });
        
        reject(new Error(errorMessage));
      }
    }, timeoutMs);
    
    // Clear timeout when we resolve
    const originalCleanup = cleanup;
    cleanup = () => {
      clearTimeout(timeoutTimer);
      originalCleanup();
    };
  });
}

/**
 * Play using hls.js with enhanced configuration
 * @param {string} url 
 */
async function playWithHls(url) {
  log('');
  log('playWithHls() called');
  debug('  URL:', url);
  
  await loadHlsJs();
  
  if (!Hls.isSupported()) {
    throw new Error('HLS not supported');
  }
  
  return new Promise((resolve, reject) => {
    log('  Creating HLS instance with config...');
    
    // Enhanced hls.js configuration
    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      
      // Reduce parallel requests to look more like single-device playback
      // Default is 6 which can trigger multi-device detection
      maxLoadingFragments: 2,
      
      // XHR setup
      xhrSetup: function(xhr, reqUrl) {
        debug('  HLS XHR setup for:', reqUrl.substring(0, 100));
        xhr.withCredentials = false;
        
        // Log when request completes
        xhr.addEventListener('load', () => {
          debug('  HLS XHR loaded:', xhr.status, xhr.statusText);
          if (xhr.status >= 400) {
            error('  HLS XHR error response:', xhr.status, xhr.responseText?.substring(0, 200));
          }
        });
        xhr.addEventListener('error', () => {
          error('  HLS XHR network error');
        });
      },
      
      // Fragment loading
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 1000,
      
      // Manifest loading
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 1000,
      
      // Level loading
      levelLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 3,
      levelLoadingRetryDelay: 1000,
      
      startLevel: -1,
      debug: DEBUG(), // Enable hls.js debug mode if our debug is on
    });
    
    let settled = false;
    
    hlsInstance.on(Hls.Events.MANIFEST_LOADING, (event, data) => {
      log('  HLS Event: MANIFEST_LOADING');
      debug('    URL:', data.url);
    });
    
    hlsInstance.on(Hls.Events.MANIFEST_LOADED, (event, data) => {
      log('  HLS Event: MANIFEST_LOADED');
      debug('    Levels:', data.levels?.length);
      debug('    URL:', data.url);
    });
    
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      log('  HLS Event: MANIFEST_PARSED - Success!');
      log('    Levels:', data.levels.length);
      debug('    First level:', data.levels[0]);
      if (!settled) {
        settled = true;
        videoElement.play().catch((e) => {
          error('  Play failed:', e);
          reject(e);
        });
        emit('onStateChange', { loading: false });
        resolve();
      }
    });
    
    hlsInstance.on(Hls.Events.LEVEL_LOADING, (event, data) => {
      debug('  HLS Event: LEVEL_LOADING', data.level);
    });
    
    hlsInstance.on(Hls.Events.LEVEL_LOADED, (event, data) => {
      debug('  HLS Event: LEVEL_LOADED', data.level, 'fragments:', data.details?.fragments?.length);
      // CRITICAL: Check if HLS.js detects this as LIVE or VOD
      if (data.details) {
        log('  HLS Stream Type:', data.details.live ? 'LIVE' : 'VOD');
        log('  HLS Total Duration:', data.details.totalduration);
        if (data.details.live) {
          log('  ⚠️ Stream detected as LIVE - seeking may be limited');
        }
      }
    });
    
    hlsInstance.on(Hls.Events.FRAG_LOADING, (event, data) => {
      debug('  HLS Event: FRAG_LOADING sn:', data.frag.sn);
    });
    
    hlsInstance.on(Hls.Events.FRAG_LOADED, (event, data) => {
      log('  HLS Event: FRAG_LOADED sn:', data.frag.sn, 'size:', data.frag.stats?.total);
    });
    
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      error('  HLS Event: ERROR');
      error('    Type:', data.type);
      error('    Details:', data.details);
      error('    Fatal:', data.fatal);
      error('    Response:', data.response);
      if (data.frag) {
        error('    Fragment URL:', data.frag.url);
      }
      if (data.context) {
        error('    Context:', data.context);
      }
      
      const errorInfo = handleHlsError(data);
      
      if (data.fatal && !settled) {
        settled = true;
        const err = new Error(errorInfo.message);
        err.type = errorInfo.type;
        err.hint = errorInfo.hint;
        reject(err);
      }
    });
    
    log('  Calling hlsInstance.loadSource()...');
    hlsInstance.loadSource(url);
    log('  Calling hlsInstance.attachMedia()...');
    hlsInstance.attachMedia(videoElement);
    log('  Waiting for HLS events...');
  });
}

/**
 * Handle hls.js errors with detailed detection
 * @param {Object} data 
 * @returns {Object}
 */
function handleHlsError(data) {
  let errorType = ErrorTypes.UNKNOWN;
  let message = 'Playback error';
  let hint = '';
  
  const responseCode = data.response?.code;
  console.log('[Player] HLS error details:', {
    type: data.type,
    details: data.details,
    fatal: data.fatal,
    responseCode,
    url: data.url || data.frag?.url
  });
  
  if (responseCode && BLOCKED_STATUS_CODES.includes(responseCode)) {
    errorType = ErrorTypes.BLOCKED;
    message = `Stream blocked by provider (HTTP ${responseCode})`;
    hint = getErrorHint(ErrorTypes.BLOCKED);
  }
  else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
    if (responseCode === 0 || responseCode === undefined) {
      if (data.details === 'manifestLoadError') {
        errorType = ErrorTypes.BLOCKED;
        message = 'Stream blocked (CORS/Connection refused)';
        hint = getErrorHint(ErrorTypes.CORS);
      } else if (data.details === 'fragLoadError') {
        errorType = ErrorTypes.BLOCKED;
        message = 'Stream segments blocked';
        hint = getErrorHint(ErrorTypes.BLOCKED);
      } else {
        errorType = ErrorTypes.NETWORK;
        message = 'Network error occurred';
        hint = getErrorHint(ErrorTypes.NETWORK);
      }
    } else if (responseCode >= 400 && responseCode < 500) {
      errorType = ErrorTypes.BLOCKED;
      message = `Access denied (HTTP ${responseCode})`;
      hint = getErrorHint(ErrorTypes.BLOCKED);
    } else if (responseCode >= 500) {
      errorType = ErrorTypes.NETWORK;
      message = `Server error (HTTP ${responseCode})`;
      hint = 'The streaming server may be down. Try again later.';
    } else {
      errorType = ErrorTypes.NETWORK;
      message = 'Network error';
      hint = getErrorHint(ErrorTypes.NETWORK);
    }
  } 
  else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    errorType = ErrorTypes.MEDIA;
    message = 'Media playback error';
    hint = getErrorHint(ErrorTypes.MEDIA);
    
    if (data.fatal && hlsInstance) {
      console.log('[Player] Attempting to recover from media error...');
      hlsInstance.recoverMediaError();
      return { type: errorType, message, hint };
    }
  } 
  else if (data.details === 'manifestLoadError' || data.details === 'manifestParsingError') {
    errorType = ErrorTypes.FORMAT;
    message = 'Invalid stream format';
    hint = getErrorHint(ErrorTypes.FORMAT);
  }
  
  emit('onError', { type: errorType, message, hint, details: data.details, code: responseCode });
  return { type: errorType, message, hint };
}

/**
 * Handle native video errors
 * @param {Event} e 
 */
function handleVideoError(e) {
  const videoError = videoElement?.error;
  let errorType = ErrorTypes.UNKNOWN;
  let message = 'Playback error';
  let hint = '';
  
  log('');
  log('handleVideoError() called');
  log('  MediaError code:', videoError?.code);
  log('  MediaError message:', videoError?.message);
  log('  Video src:', videoElement?.src?.substring(0, 100));
  log('  Video networkState:', videoElement?.networkState);
  log('  Video readyState:', videoElement?.readyState);
  
  // MediaError code reference
  const errorCodeNames = {
    1: 'MEDIA_ERR_ABORTED',
    2: 'MEDIA_ERR_NETWORK', 
    3: 'MEDIA_ERR_DECODE',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
  };
  log('  Error type:', errorCodeNames[videoError?.code] || 'UNKNOWN');
  
  // Check if we have preflight info that tells us the real problem
  if (lastPreflightResult && !lastPreflightResult.ok) {
    log('  Using preflight result for error messaging:', lastPreflightResult);
    errorType = lastPreflightResult.error === 'blocked' ? ErrorTypes.BLOCKED :
                lastPreflightResult.error === 'cors_or_network' ? ErrorTypes.CORS :
                ErrorTypes.NETWORK;
    message = lastPreflightResult.message;
    hint = getErrorHint(errorType);
  }
  else if (videoError) {
    switch (videoError.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        message = 'Playback aborted';
        hint = 'Playback was stopped.';
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        errorType = ErrorTypes.NETWORK;
        message = 'Network error';
        hint = 'A network error occurred. This could also be CORS blocking.';
        break;
      case MediaError.MEDIA_ERR_DECODE:
        errorType = ErrorTypes.MEDIA;
        message = 'Decoding error';
        hint = 'The video could not be decoded.';
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        // Check if this might be a codec issue (HEVC not supported)
        if (!supportsHEVC()) {
          errorType = ErrorTypes.CODEC;
          message = 'Codec not supported';
          hint = 'This stream may use HEVC/H.265 codec. Try Safari on macOS 11+, or copy the URL to VLC.';
          warn('HEVC not supported on this browser - this may be a 4K/HEVC stream');
        } else {
          // HEVC is supported, so it's likely a blocking/CORS issue
          errorType = ErrorTypes.BLOCKED;
          message = 'Stream not accessible';
          hint = 'The stream may be blocked by the provider or your browser. Try copying the URL to VLC.';
        }
        break;
    }
  }
  
  log('  Final error classification:', { type: errorType, message, hint });
  emit('onError', { type: errorType, message, hint });
}

/**
 * Stop playback
 * Destroying hls.js and clearing the video src will cause the browser to
 * close connections, which the proxy detects and uses to abort upstream requests.
 */
export function stop() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  
  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
  }
  
  currentChannel = null;
  isPlaying = false;
  lastPreflightResult = null;
  emit('onStateChange', { playing: false, channel: null });
}

/**
 * Toggle play/pause
 */
export function togglePlay() {
  if (!videoElement) return;
  
  if (videoElement.paused) {
    videoElement.play();
  } else {
    videoElement.pause();
  }
}

/**
 * Seek to a specific time
 * @param {number} time - Time in seconds to seek to
 * @returns {boolean} - Whether seek was attempted
 */
export function seek(time) {
  if (!videoElement) {
    console.warn('[Player] Cannot seek - no video element');
    return false;
  }
  
  console.log('[Player] Seeking to:', time);
  
  // If HLS.js is active, we need to handle seeking carefully
  if (hlsInstance && hlsInstance.media) {
    console.log('[Player] Using HLS.js seek approach');
    
    // Check HLS.js state
    const levels = hlsInstance.levels;
    const currentLevel = hlsInstance.currentLevel;
    console.log('[Player] HLS levels:', levels?.length, 'current:', currentLevel);
    
    // Try using HLS.js's startLoad to force it to seek
    // First, set the start position for loading
    hlsInstance.startPosition = time;
    
    // Then set video currentTime
    videoElement.currentTime = time;
    
    // If that doesn't work, try stopping and restarting load at position
    setTimeout(() => {
      if (Math.abs(videoElement.currentTime - time) > 2) {
        console.log('[Player] Seek failed, trying HLS.js reload approach');
        hlsInstance.stopLoad();
        hlsInstance.startLoad(time);
      }
    }, 200);
  } else {
    // Native playback
    videoElement.currentTime = time;
  }
  
  return true;
}

/**
 * Get HLS.js instance for debugging
 * @returns {object|null}
 */
export function getHlsInstance() {
  return hlsInstance;
}

/**
 * Set volume
 * @param {number} volume - 0 to 1
 */
export function setVolume(volume) {
  if (videoElement) {
    videoElement.volume = Math.max(0, Math.min(1, volume));
  }
}

/**
 * Get volume
 * @returns {number}
 */
export function getVolume() {
  return videoElement?.volume || 1;
}

/**
 * Toggle mute
 */
export function toggleMute() {
  if (videoElement) {
    videoElement.muted = !videoElement.muted;
  }
}

/**
 * Check if muted
 * @returns {boolean}
 */
export function isMuted() {
  return videoElement?.muted || false;
}

/**
 * Enter fullscreen
 */
export async function enterFullscreen() {
  const container = videoElement?.parentElement;
  if (!container) return;
  
  try {
    if (container.requestFullscreen) {
      await container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      await container.webkitRequestFullscreen();
    } else if (videoElement.webkitEnterFullscreen) {
      await videoElement.webkitEnterFullscreen();
    }
  } catch (e) {
    console.warn('[Player] Fullscreen not available:', e);
  }
}

/**
 * Exit fullscreen
 */
export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    }
  } catch (e) {
    console.warn('[Player] Exit fullscreen failed:', e);
  }
}

/**
 * Toggle fullscreen
 */
export async function toggleFullscreen() {
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFs) {
    await exitFullscreen();
  } else {
    await enterFullscreen();
  }
}

/**
 * Check if in fullscreen
 * @returns {boolean}
 */
export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * Request Picture-in-Picture
 */
export async function enterPiP() {
  if (!videoElement || !document.pictureInPictureEnabled) return;
  
  try {
    await videoElement.requestPictureInPicture();
  } catch (e) {
    console.warn('[Player] PiP not available:', e);
  }
}

/**
 * Exit Picture-in-Picture
 */
export async function exitPiP() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  } catch (e) {
    console.warn('[Player] Exit PiP failed:', e);
  }
}

/**
 * Toggle Picture-in-Picture
 */
export async function togglePiP() {
  if (document.pictureInPictureElement) {
    await exitPiP();
  } else {
    await enterPiP();
  }
}

/**
 * Get current channel
 * @returns {Object|null}
 */
export function getCurrentChannel() {
  return currentChannel;
}

/**
 * Get current stream URL
 * @returns {string|null}
 */
export function getCurrentUrl() {
  return currentChannel?.url || null;
}

/**
 * Check if playing
 * @returns {boolean}
 */
export function getIsPlaying() {
  return isPlaying;
}

// =============================================================================
// Event system
// =============================================================================

export function on(event, callback) {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
  return () => off(event, callback);
}

export function off(event, callback) {
  if (listeners[event]) {
    const idx = listeners[event].indexOf(callback);
    if (idx !== -1) listeners[event].splice(idx, 1);
  }
}

function emit(event, data) {
  console.log(`[Player] emit: ${event}`, data, `listeners: ${listeners[event]?.length || 0}`);
  if (listeners[event]) {
    listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[Player] Error in ${event} listener:`, e);
      }
    });
  }
}
