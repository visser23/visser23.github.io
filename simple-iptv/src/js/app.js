/**
 * Simple IPTV - Main Application
 * Orchestrates all modules and handles app lifecycle
 */

// MUST BE FIRST: Debug module controls console.log behavior
// In production, this silences all console.log for performance
// Enable with ?debug=true URL param or localStorage.simpleiptv_debug = 'true'
import './modules/debug.js';

import * as storage from './modules/storage.js';
import * as credentials from './modules/credentials.js';
import * as playlist from './modules/playlist.js';
import * as player from './modules/player.js';
import * as epg from './modules/epg.js';
import * as ui from './modules/ui.js';
import * as locale from './modules/locale.js';

// App state
let currentCredentials = null;
let channels = [];
let isInitialized = false;

// Content type state (live/movies/series)
let currentContentType = 'live';
let vodCategories = [];
let seriesCategories = [];
let currentVodItems = [];
let currentSeriesItems = [];
let vodCategoryCache = {}; // { categoryId: items[] }
let seriesCategoryCache = {}; // { categoryId: items[] }

/**
 * Clear all VOD/Series caches (called when switching playlists)
 */
function clearVodSeriesCaches() {
  vodCategories = [];
  seriesCategories = [];
  currentVodItems = [];
  currentSeriesItems = [];
  vodCategoryCache = {};
  seriesCategoryCache = {};
  allVodItems = [];
  allSeriesItems = [];
  isLoadingVodForSearch = false;
  isLoadingSeriesForSearch = false;
}

/**
 * Initialize the application
 */
async function init() {
  // Ensure all modals are closed on start
  ensureModalsClosedOnStart();
  
  // Initialize UI
  ui.init({
    onChannelSelect: handleChannelSelect,
    onFavoriteToggle: () => {}, // Handled by UI module
  });
  
  // Initialize locale (for language-prioritized search)
  locale.init();
  ui.setLocaleModule(locale);
  
  // Initialize player
  const videoElement = document.getElementById('video');
  if (videoElement) {
    player.init(videoElement);
    setupPlayerListeners();
    // Attach DIRECT video element listeners for UI sync (more reliable)
    setupVideoElementListeners(videoElement);
  }
  
  // Set up modal handlers
  setupModals();
  
  // Set up player controls
  setupPlayerControls();
  
  // Set up settings
  setupSettings();
  
  // Set up content type tabs (Live/Movies/Series)
  setupContentTypeTabs();
  
  // Initial UI state (hide logout button if not logged in)
  updateSettingsInfo();
  
  // Check for stored credentials and decide initial view
  await checkInitialState();
  
  isInitialized = true;
}

/**
 * Ensure all modals are closed when app starts
 */
function ensureModalsClosedOnStart() {
  document.querySelectorAll('dialog').forEach(dialog => {
    if (dialog.open) dialog.close();
  });
}

/**
 * Check initial state and show appropriate view
 */
async function checkInitialState() {
  try {
    const hasCredentials = credentials.hasStoredCredentials();
    
    if (hasCredentials) {
      if (credentials.needsPin()) {
        showPinModal('unlock');
      } else {
        const loaded = await loadStoredCredentials();
        if (!loaded) {
          ui.showOnboarding();
        }
      }
    } else {
      ui.showOnboarding();
    }
  } catch (error) {
    console.error('[App] Error checking initial state:', error);
    ui.showOnboarding();
  }
}

/**
 * Load stored credentials and playlist
 */
async function loadStoredCredentials(pin = null) {
  console.log('[App] ═══════════════════════════════════════════════════════════');
  console.log('[App] loadStoredCredentials called');
  
  try {
    currentCredentials = await credentials.getCredentials(pin);
    
    console.log('[App] Retrieved credentials:', currentCredentials ? {
      mode: currentCredentials.mode,
      server: currentCredentials.server || 'N/A',
      hasUsername: !!currentCredentials.username,
      hasPassword: !!currentCredentials.password,
      epgUrl: currentCredentials.epgUrl || 'NOT SET'
    } : 'NULL');
    
    if (!currentCredentials) {
      if (pin !== null) {
        // Wrong PIN - show error but don't close modal
        const errorEl = document.getElementById('pin-error');
        if (errorEl) {
          errorEl.textContent = 'Incorrect PIN';
          errorEl.hidden = false;
        }
        return false;
      }
      console.log('[App] No credentials found, showing onboarding');
      return false;
    }
    
    // Try to load cached channels first
    channels = await playlist.loadChannels();
    console.log('[App] Loaded', channels.length, 'channels from cache');
    
    if (channels.length > 0) {
      ui.setChannels(channels);
      ui.showPlayer();
      updateSettingsInfo();
      
      // Update global search with loaded channels
      updateGlobalSearchItems();
      
      // VOD/Series now loaded on-demand when user searches (not eagerly)
      // See loadVodSeriesOnDemand() for the on-demand loading logic
      
      // Load EPG from cache first
      console.log('[App] Loading EPG from cache...');
      const cachedEpgCount = await epg.loadFromCache();
      console.log('[App] EPG cache result:', cachedEpgCount, 'channels');
      
      // If we have Xtream credentials, try to load fresh EPG
      if (currentCredentials.mode === 'xtream' && currentCredentials.server) {
        const { server, username, password } = currentCredentials;
        if (server && username && password) {
          const cleanServer = server.replace(/\/+$/, '');
          const epgUrl = `${cleanServer}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
          console.log('[App] Will load fresh EPG from:', epgUrl);
          // Don't await - load in background
          loadEpg(epgUrl);
        }
      } else if (currentCredentials.epgUrl) {
        console.log('[App] Loading fresh EPG from stored URL:', currentCredentials.epgUrl);
        loadEpg(currentCredentials.epgUrl);
      } else {
        console.log('[App] No EPG URL available for fresh load');
      }
    } else {
      // No cached channels, need to fetch
      console.log('[App] No cached channels, calling refreshPlaylist');
      await refreshPlaylist();
    }
    
    console.log('[App] ═══════════════════════════════════════════════════════════');
    return true;
  } catch (error) {
    console.error('[App] Failed to load credentials:', error);
    ui.showToast('Failed to load saved data', 'error');
    return false;
  }
}

/**
 * Refresh playlist from source
 */
async function refreshPlaylist() {
  if (!currentCredentials) {
    ui.showOnboarding();
    return;
  }
  
  try {
    ui.showPlayer();
    ui.showLoading(true);
    ui.setNowPlaying('Loading playlist...');
    
    const { mode } = currentCredentials;
    
    if (mode === 'xtream') {
      channels = await playlist.fetchXtream(currentCredentials, (msg) => {
        ui.setNowPlaying(msg);
      });
    } else if (mode === 'm3u-url') {
      channels = await playlist.fetchM3U(currentCredentials.playlistUrl, (msg) => {
        ui.setNowPlaying(msg);
      });
    } else if (mode === 'm3u-file') {
      channels = await playlist.loadChannels();
    }
    
    // Store channels
    await playlist.storeChannels(channels);
    
    // Update UI
    ui.setChannels(channels);
    ui.showLoading(false);
    ui.setNowPlaying('Select a channel');
    
    // Update global search with new channels
    updateGlobalSearchItems();
    
    // VOD/Series now loaded on-demand when user searches (not eagerly)
    // See loadVodSeriesOnDemand() for the on-demand loading logic
    
    // Load EPG if URL provided
    console.log('[App] ═══════════════════════════════════════════════════════════');
    console.log('[App] EPG CHECK - Credentials mode:', currentCredentials?.mode);
    console.log('[App] EPG CHECK - Stored epgUrl:', currentCredentials?.epgUrl || 'NOT SET');
    
    if (currentCredentials?.epgUrl) {
      console.log('[App] EPG: Loading from stored credentials URL');
      loadEpg(currentCredentials.epgUrl);
    } else if (currentCredentials?.mode === 'xtream') {
      // Generate EPG URL for Xtream if not stored
      const { server, username, password } = currentCredentials;
      console.log('[App] EPG: Xtream mode - server:', server, 'username:', username ? 'SET' : 'NOT SET');
      
      if (server && username && password) {
        const cleanServer = server.replace(/\/+$/, '');
        const epgUrl = `${cleanServer}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        console.log('[App] EPG: Generated Xtream XMLTV URL:', epgUrl);
        currentCredentials.epgUrl = epgUrl;
        loadEpg(epgUrl);
      } else {
        console.warn('[App] EPG: Cannot generate URL - missing server/username/password');
        ui.showToast('EPG: Missing credentials for Xtream', 'warning');
      }
    } else if (currentCredentials?.mode === 'm3u-url' || currentCredentials?.mode === 'm3u-file') {
      console.log('[App] EPG: M3U mode - no EPG URL configured');
      // Could show hint to user about adding EPG URL
    } else {
      console.warn('[App] EPG: Unknown mode or no credentials:', currentCredentials?.mode);
    }
    console.log('[App] ═══════════════════════════════════════════════════════════');
    
    updateSettingsInfo();
    ui.showToast(`Loaded ${channels.length} channels`, 'success');
    
  } catch (error) {
    console.error('[App] Failed to refresh playlist:', error);
    ui.showLoading(false);
    ui.setNowPlaying('Failed to load playlist');
    ui.showToast(error.message || 'Failed to load playlist', 'error');
  }
}

// =============================================================================
// Content Type Switching (Live TV / Movies / Series)
// =============================================================================

/**
 * Set up content type tab handlers
 */
function setupContentTypeTabs() {
  const tabs = document.querySelectorAll('.content-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchContentType(tab.dataset.type));
  });
}

/**
 * Switch between content types (live/movies/series)
 */
async function switchContentType(type) {
  if (type === currentContentType) return;
  if (!currentCredentials || currentCredentials.mode !== 'xtream') {
    // Only Xtream supports Movies/Series
    if (type !== 'live') {
      ui.showToast('Movies & Series require Xtream login', 'error');
      return;
    }
  }
  
  // Update tab UI
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.classList.toggle('content-tab--active', tab.dataset.type === type);
  });
  
  currentContentType = type;
  
  // Load content for the selected type
  try {
    if (type === 'live') {
      await loadLiveContent();
    } else if (type === 'movies') {
      await loadMoviesContent();
    } else if (type === 'series') {
      await loadSeriesContent();
    }
  } catch (error) {
    console.error(`[App] Failed to load ${type} content:`, error);
    ui.showToast(`Failed to load ${type}`, 'error');
  }
}

/**
 * Load Live TV content
 */
async function loadLiveContent() {
  // Live TV content is already in channels array
  if (channels.length === 0) {
    // Try loading from cache
    channels = await playlist.loadChannels();
  }
  
  ui.setChannels(channels);
  ui.setContentType('live');
}

/**
 * Load Movies (VOD) content - lazy load
 */
async function loadMoviesContent() {
  const tab = document.querySelector('[data-type="movies"]');
  tab?.classList.add('content-tab--loading');
  
  try {
    // Load categories first (fast)
    if (vodCategories.length === 0) {
      ui.showLoading(true);
      ui.setNowPlaying('Loading movie categories...');
      
      // Try cache first
      vodCategories = await playlist.loadVodCategories();
      
      if (vodCategories.length === 0) {
        vodCategories = await playlist.fetchVodCategories(currentCredentials);
        await playlist.storeVodCategories(vodCategories);
      }
    }
    
    ui.setContentType('movies', vodCategories);
    ui.showLoading(false);
    ui.setNowPlaying('Select a category');
    
  } finally {
    tab?.classList.remove('content-tab--loading');
  }
}

/**
 * Load Series content - lazy load
 */
async function loadSeriesContent() {
  const tab = document.querySelector('[data-type="series"]');
  tab?.classList.add('content-tab--loading');
  
  try {
    // Load categories first (fast)
    if (seriesCategories.length === 0) {
      ui.showLoading(true);
      ui.setNowPlaying('Loading series categories...');
      
      // Try cache first
      seriesCategories = await playlist.loadSeriesCategories();
      
      if (seriesCategories.length === 0) {
        seriesCategories = await playlist.fetchSeriesCategories(currentCredentials);
        await playlist.storeSeriesCategories(seriesCategories);
      }
    }
    
    ui.setContentType('series', seriesCategories);
    ui.showLoading(false);
    ui.setNowPlaying('Select a category');
    
  } finally {
    tab?.classList.remove('content-tab--loading');
  }
}

/**
 * Load items for a specific VOD category (called from UI when category selected)
 */
async function loadVodCategory(categoryId) {
  ui.showLoading(true);
  ui.setNowPlaying('Loading movies...');
  
  try {
    // Check cache first
    if (vodCategoryCache[categoryId]) {
      currentVodItems = vodCategoryCache[categoryId];
    } else {
      // Fetch from API
      currentVodItems = await playlist.fetchVodStreams(currentCredentials, categoryId);
      vodCategoryCache[categoryId] = currentVodItems;
      
      // Update global search with new items
      updateGlobalSearchItems();
    }
    
    ui.setItems(currentVodItems);
    ui.showLoading(false);
    ui.setNowPlaying(`${currentVodItems.length} movies`);
    
  } catch (error) {
    console.error('[App] Failed to load VOD category:', error);
    ui.showLoading(false);
    ui.showToast('Failed to load movies', 'error');
  }
}

/**
 * Load items for a specific Series category (called from UI when category selected)
 */
async function loadSeriesCategory(categoryId) {
  ui.showLoading(true);
  ui.setNowPlaying('Loading series...');
  
  try {
    // Check cache first
    if (seriesCategoryCache[categoryId]) {
      currentSeriesItems = seriesCategoryCache[categoryId];
    } else {
      // Fetch from API
      currentSeriesItems = await playlist.fetchSeriesList(currentCredentials, categoryId);
      seriesCategoryCache[categoryId] = currentSeriesItems;
      
      // Update global search with new items
      updateGlobalSearchItems();
    }
    
    ui.setItems(currentSeriesItems);
    ui.showLoading(false);
    ui.setNowPlaying(`${currentSeriesItems.length} series`);
    
  } catch (error) {
    console.error('[App] Failed to load series category:', error);
    ui.showLoading(false);
    ui.showToast('Failed to load series', 'error');
  }
}

/**
 * Load series details (seasons/episodes) - called when series is selected
 */
async function loadSeriesDetails(seriesId) {
  ui.showLoading(true);
  ui.setNowPlaying('Loading episodes...');
  
  try {
    const seriesInfo = await playlist.fetchSeriesInfo(currentCredentials, seriesId);
    ui.showSeriesDetails(seriesInfo);
    ui.showLoading(false);
    
  } catch (error) {
    console.error('[App] Failed to load series details:', error);
    ui.showLoading(false);
    ui.showToast('Failed to load episodes', 'error');
  }
}

// Export content loading functions for UI callbacks
window.app = window.app || {};
window.app.loadVodCategory = loadVodCategory;
window.app.loadSeriesCategory = loadSeriesCategory;
window.app.loadSeriesDetails = loadSeriesDetails;

// All items storage for global search (loaded in background)
let allVodItems = [];
let allSeriesItems = [];
let isLoadingVodForSearch = false;
let isLoadingSeriesForSearch = false;

/**
 * Update all searchable items for global search
 * Collects live channels + all VOD + all series
 */
function updateGlobalSearchItems() {
  const allItems = [];
  
  // Add live channels (mark them with type: 'live')
  channels.forEach(ch => {
    allItems.push({
      ...ch,
      type: 'live'
    });
  });
  
  // Add all VOD items (from full list, not just cache)
  allVodItems.forEach(item => {
    allItems.push(item); // Already has type: 'vod'
  });
  
  // Add all series items (from full list, not just cache)
  allSeriesItems.forEach(item => {
    allItems.push(item); // Already has type: 'series'
  });
  
  // Pass to UI for global search
  ui.setAllSearchableItems(allItems);
  
  console.log(`[App] Updated global search: ${channels.length} live + ${allVodItems.length} movies + ${allSeriesItems.length} series = ${allItems.length} total`);
}

/**
 * Load all VOD items in background for global search
 */
async function loadAllVodForSearch() {
  if (!currentCredentials || currentCredentials.mode !== 'xtream') return;
  if (isLoadingVodForSearch || allVodItems.length > 0) return;
  
  isLoadingVodForSearch = true;
  console.log('[App] Loading all movies for global search...');
  
  try {
    // Fetch ALL VOD streams (no category filter)
    allVodItems = await playlist.fetchVodStreams(currentCredentials, null);
    console.log(`[App] Loaded ${allVodItems.length} movies for search`);
    updateGlobalSearchItems();
  } catch (error) {
    console.error('[App] Failed to load VOD for search:', error);
  } finally {
    isLoadingVodForSearch = false;
  }
}

/**
 * Load all series items in background for global search
 */
async function loadAllSeriesForSearch() {
  if (!currentCredentials || currentCredentials.mode !== 'xtream') return;
  if (isLoadingSeriesForSearch || allSeriesItems.length > 0) return;
  
  isLoadingSeriesForSearch = true;
  console.log('[App] Loading all series for global search...');
  
  try {
    // Fetch ALL series (no category filter)
    allSeriesItems = await playlist.fetchSeriesList(currentCredentials, null);
    console.log(`[App] Loaded ${allSeriesItems.length} series for search`);
    updateGlobalSearchItems();
  } catch (error) {
    console.error('[App] Failed to load series for search:', error);
  } finally {
    isLoadingSeriesForSearch = false;
  }
}

/**
 * Load VOD/Series on-demand when user starts searching
 * Called from UI when search is triggered (not eagerly at startup)
 * @returns {Promise<boolean>} true if data was loaded/available
 */
async function loadVodSeriesOnDemand() {
  if (!currentCredentials || currentCredentials.mode !== 'xtream') {
    // Only Xtream supports Movies/Series
    return false;
  }
  
  // If already loaded, return immediately
  if (allVodItems.length > 0 && allSeriesItems.length > 0) {
    return true;
  }
  
  // If already loading, wait for completion
  if (isLoadingVodForSearch || isLoadingSeriesForSearch) {
    // Return a promise that resolves when loading completes
    return new Promise(resolve => {
      const checkLoading = setInterval(() => {
        if (!isLoadingVodForSearch && !isLoadingSeriesForSearch) {
          clearInterval(checkLoading);
          resolve(true);
        }
      }, 100);
    });
  }
  
  console.log('[App] Loading VOD/Series on-demand for search...');
  
  // Load both in parallel
  const loadPromises = [];
  
  if (allVodItems.length === 0) {
    loadPromises.push(loadAllVodForSearch());
  }
  if (allSeriesItems.length === 0) {
    loadPromises.push(loadAllSeriesForSearch());
  }
  
  await Promise.all(loadPromises);
  return true;
}

// Expose the on-demand loader for UI to call
window.loadVodSeriesOnDemand = loadVodSeriesOnDemand;

/**
 * Load EPG data
 * @param {string} url 
 */
async function loadEpg(url) {
  console.log('[App] ═══════════════════════════════════════════════════════════');
  console.log('[App] loadEpg called with URL:', url);
  
  epg.on('onProgress', (data) => {
    console.log('[App] EPG Progress:', data.phase || data.status, data);
  });
  
  epg.on('onComplete', (data) => {
    console.log('[App] ✓ EPG Complete:', data);
    if (data.total > 0) {
      ui.showToast(`EPG loaded: ${data.total} channels`, 'success');
    } else {
      ui.showToast('EPG loaded but no data found', 'warning');
    }
    ui.refresh();
  });
  
  epg.on('onError', (data) => {
    console.error('[App] ✗ EPG Error:', data);
    ui.showToast(`EPG failed: ${data.message || 'Unknown error'}`, 'error');
  });
  
  console.log('[App] Calling epg.loadFromUrl...');
  await epg.loadFromUrl(url);
  console.log('[App] ═══════════════════════════════════════════════════════════');
}

/**
 * Handle channel selection
 * @param {Object} channel 
 */
async function handleChannelSelect(channel) {
  ui.showLoading(true);
  ui.hideError();
  ui.setNowPlaying(channel.name);
  ui.updateNowPlayingPanel(channel); // Update the Now Playing panel
  
  try {
    await player.play(channel);
    
    // Update EPG
    if (channel.epgId) {
      const nowNext = epg.getNowNext(channel.epgId);
      ui.updateEpg(nowNext);
      startEpgUpdater(channel.epgId);
    } else {
      ui.updateEpg(null);
    }
    
  } catch (error) {
    console.error('[App] Playback failed:', error);
    ui.showLoading(false);
    // Error might be an Error object or our custom format
    ui.showError({
      message: error.message || 'Playback failed',
      hint: error.hint || null,
      type: error.type || 'unknown'
    });
  }
}

// EPG updater interval
let epgUpdaterInterval = null;

/**
 * Start EPG updater for current channel
 */
function startEpgUpdater(epgId) {
  stopEpgUpdater();
  epgUpdaterInterval = setInterval(() => {
    const nowNext = epg.getNowNext(epgId);
    ui.updateEpg(nowNext);
  }, 30000);
}

/**
 * Stop EPG updater
 */
function stopEpgUpdater() {
  if (epgUpdaterInterval) {
    clearInterval(epgUpdaterInterval);
    epgUpdaterInterval = null;
  }
}

// Favorites toggle is handled directly by UI module

/**
 * Set up player event listeners
 */
function setupPlayerListeners() {
  console.log('[App] Setting up player listeners');
  player.on('onStateChange', (state) => {
    if (state.loading !== undefined) {
      ui.showLoading(state.loading);
    }
  });
  
  player.on('onError', (error) => {
    ui.showLoading(false);
    ui.showError(error);
  });
}

/**
 * Direct video element event listeners for UI sync
 * More reliable than going through abstraction layer
 * @param {HTMLVideoElement} video 
 */
function setupVideoElementListeners(video) {
  console.log('[App] Attaching direct video element listeners');
  
  // Play/Pause state sync
  video.addEventListener('play', () => {
    console.log('[Video] play event');
    updatePlayPauseButton(true);
  });
  
  video.addEventListener('pause', () => {
    console.log('[Video] pause event');
    updatePlayPauseButton(false);
  });
  
  // Volume/Mute state sync
  video.addEventListener('volumechange', () => {
    console.log('[Video] volumechange event', { muted: video.muted, volume: video.volume });
    updateVolumeIcon();
  });
  
  // Progress bar update
  video.addEventListener('timeupdate', () => {
    updateProgressBar(video.currentTime, video.duration);
  });
  
  // Seeking feedback (optional: show seeking state)
  video.addEventListener('seeking', () => {
    console.log('[Video] seeking to', video.currentTime);
  });
  
  video.addEventListener('seeked', () => {
    console.log('[Video] seeked to', video.currentTime);
  });
}

/**
 * Update play/pause button state
 */
function updatePlayPauseButton(playing) {
  console.log('[App] updatePlayPauseButton:', playing);
  const playIcon = document.querySelector('#btn-play-pause .icon-play');
  const pauseIcon = document.querySelector('#btn-play-pause .icon-pause');
  console.log('[App] Found icons:', { playIcon: !!playIcon, pauseIcon: !!pauseIcon });
  
  if (playIcon && pauseIcon) {
    // Use CSS class toggle instead of hidden attribute (more reliable for SVGs)
    playIcon.classList.toggle('is-hidden', playing);
    pauseIcon.classList.toggle('is-hidden', !playing);
    console.log('[App] Icon classes after toggle:', {
      playHidden: playIcon.classList.contains('is-hidden'),
      pauseHidden: pauseIcon.classList.contains('is-hidden')
    });
  }
}

// Global debug functions for testing from browser console
window.debugPlayerControls = {
  testPlayPause: () => {
    const playIcon = document.querySelector('#btn-play-pause .icon-play');
    const pauseIcon = document.querySelector('#btn-play-pause .icon-pause');
    console.log('Play icon:', playIcon);
    console.log('Pause icon:', pauseIcon);
    console.log('Play classes:', playIcon?.className);
    console.log('Pause classes:', pauseIcon?.className);
  },
  showPause: () => {
    document.querySelector('#btn-play-pause .icon-play')?.classList.add('is-hidden');
    document.querySelector('#btn-play-pause .icon-pause')?.classList.remove('is-hidden');
    console.log('Switched to pause icon');
  },
  showPlay: () => {
    document.querySelector('#btn-play-pause .icon-play')?.classList.remove('is-hidden');
    document.querySelector('#btn-play-pause .icon-pause')?.classList.add('is-hidden');
    console.log('Switched to play icon');
  },
  testMute: () => {
    const volumeIcon = document.querySelector('#btn-mute .icon-volume');
    const mutedIcon = document.querySelector('#btn-mute .icon-muted');
    console.log('Volume icon:', volumeIcon);
    console.log('Muted icon:', mutedIcon);
    console.log('Volume classes:', volumeIcon?.className);
    console.log('Muted classes:', mutedIcon?.className);
  },
  showMuted: () => {
    document.querySelector('#btn-mute .icon-volume')?.classList.add('is-hidden');
    document.querySelector('#btn-mute .icon-muted')?.classList.remove('is-hidden');
    console.log('Switched to muted icon');
  },
  showVolume: () => {
    document.querySelector('#btn-mute .icon-volume')?.classList.remove('is-hidden');
    document.querySelector('#btn-mute .icon-muted')?.classList.add('is-hidden');
    console.log('Switched to volume icon');
  },
  videoState: () => {
    const video = document.getElementById('video');
    console.log('Video element:', video);
    console.log('Paused:', video?.paused);
    console.log('Muted:', video?.muted);
    console.log('Volume:', video?.volume);
    console.log('Duration:', video?.duration);
    console.log('CurrentTime:', video?.currentTime);
    
    // Check seekable ranges
    if (video?.seekable) {
      console.log('Seekable ranges:', video.seekable.length);
      for (let i = 0; i < video.seekable.length; i++) {
        console.log(`  Range ${i}: ${video.seekable.start(i)} - ${video.seekable.end(i)}`);
      }
    }
    
    // Check buffered ranges
    if (video?.buffered) {
      console.log('Buffered ranges:', video.buffered.length);
      for (let i = 0; i < video.buffered.length; i++) {
        console.log(`  Range ${i}: ${video.buffered.start(i)} - ${video.buffered.end(i)}`);
      }
    }
  },
  
  seekTo: (seconds) => {
    const video = document.getElementById('video');
    if (!video) {
      console.error('No video element');
      return;
    }
    console.log('=== SEEK DEBUG ===');
    console.log('Target:', seconds);
    console.log('Duration:', video.duration);
    console.log('ReadyState:', video.readyState);
    console.log('NetworkState:', video.networkState);
    console.log('Paused:', video.paused);
    console.log('Current time BEFORE:', video.currentTime);
    
    // Direct assignment
    video.currentTime = seconds;
    
    console.log('Current time IMMEDIATELY AFTER:', video.currentTime);
    
    // Check multiple times
    setTimeout(() => console.log('After 50ms:', video.currentTime), 50);
    setTimeout(() => console.log('After 100ms:', video.currentTime), 100);
    setTimeout(() => console.log('After 200ms:', video.currentTime), 200);
    setTimeout(() => console.log('After 500ms:', video.currentTime), 500);
  },
  
  // Try seeking with fastSeek (if available)
  fastSeekTo: (seconds) => {
    const video = document.getElementById('video');
    if (!video) return;
    console.log('=== FAST SEEK ===');
    if (video.fastSeek) {
      console.log('fastSeek is available');
      video.fastSeek(seconds);
    } else {
      console.log('fastSeek not available, using currentTime');
      video.currentTime = seconds;
    }
    setTimeout(() => console.log('After 200ms:', video.currentTime), 200);
  },
  
  // Check HLS.js internal state
  hlsState: () => {
    const video = document.getElementById('video');
    const hls = player.getHlsInstance();
    
    console.log('=== HLS STATE DEBUG ===');
    console.log('Video src:', video?.src);
    console.log('HLS instance:', hls ? 'ACTIVE' : 'none');
    
    if (hls) {
      console.log('HLS media:', hls.media ? 'attached' : 'not attached');
      console.log('HLS levels:', hls.levels?.length);
      console.log('HLS currentLevel:', hls.currentLevel);
      console.log('HLS startPosition:', hls.startPosition);
      
      // Check level details for live/VOD
      if (hls.levels && hls.levels[hls.currentLevel]) {
        const details = hls.levels[hls.currentLevel].details;
        if (details) {
          console.log('Level details - live:', details.live);
          console.log('Level details - totalduration:', details.totalduration);
          console.log('Level details - endSN:', details.endSN);
        }
      }
    }
    
    // Check buffered ranges
    if (video?.buffered?.length > 0) {
      console.log('Buffered ranges:');
      for (let i = 0; i < video.buffered.length; i++) {
        console.log(`  ${i}: ${video.buffered.start(i).toFixed(2)} - ${video.buffered.end(i).toFixed(2)}`);
      }
    }
  },
  
  // Force HLS.js to seek by restarting load at position
  hlsSeek: (seconds) => {
    const hls = player.getHlsInstance();
    const video = document.getElementById('video');
    
    if (!hls) {
      console.log('No HLS instance, using direct seek');
      if (video) video.currentTime = seconds;
      return;
    }
    
    console.log('=== HLS.js FORCE SEEK ===');
    console.log('Target:', seconds);
    
    // Method 1: Stop and restart load at position
    hls.stopLoad();
    hls.startLoad(seconds);
    
    // Also set video time
    setTimeout(() => {
      video.currentTime = seconds;
      console.log('After HLS startLoad + currentTime:', video.currentTime);
    }, 100);
  }
};

/**
 * Update progress bar
 */
function updateProgressBar(currentTime, duration) {
  const progressFill = document.getElementById('progress-fill');
  const scrubber = document.getElementById('progress-scrubber');
  const progressBar = document.getElementById('progress-bar');
  
  // Don't update if dragging (user is scrubbing)
  if (progressBar?.classList.contains('is-dragging')) return;
  
  if (!progressFill || !duration || !isFinite(duration)) return;
  
  const percent = (currentTime / duration) * 100;
  progressFill.style.width = `${percent}%`;
  if (scrubber) scrubber.style.left = `${percent}%`;
}

/**
 * Set up player controls
 */
function setupPlayerControls() {
  // Play/Pause button - directly control video element
  document.getElementById('btn-play-pause')?.addEventListener('click', () => {
    const video = document.getElementById('video');
    if (!video) return;
    
    console.log('[App] Play/Pause clicked, paused:', video.paused);
    if (video.paused) {
      video.play().catch(err => console.warn('[App] Play failed:', err));
    } else {
      video.pause();
    }
    // play/pause events will trigger updatePlayPauseButton via direct listener
  });
  
  // Volume slider - directly control video element
  const volumeSlider = document.getElementById('volume-slider');
  volumeSlider?.addEventListener('input', (e) => {
    const video = document.getElementById('video');
    if (!video) return;
    
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    // Unmute if adjusting volume while muted
    if (video.muted && vol > 0) {
      video.muted = false;
    }
    // volumechange event will trigger updateVolumeIcon via direct listener
  });
  
  // Mute button - toggles mute and restores previous volume
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    const video = document.getElementById('video');
    if (!video) return;
    
    console.log('[App] Mute button clicked, current muted:', video.muted);
    
    if (video.muted) {
      // Unmute and restore previous volume
      video.muted = false;
      const prevVolume = parseFloat(volumeSlider?.dataset.prevVolume || '1');
      video.volume = prevVolume;
      if (volumeSlider) volumeSlider.value = prevVolume;
    } else {
      // Mute and remember current volume
      if (volumeSlider) volumeSlider.dataset.prevVolume = video.volume;
      video.muted = true;
      if (volumeSlider) volumeSlider.value = 0;
    }
    // volumechange event will trigger updateVolumeIcon via direct listener
  });
  
  // Progress bar scrubbing (click and drag)
  setupProgressBarScrubbing();
  
  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    player.toggleFullscreen();
  });
  
  document.getElementById('btn-pip')?.addEventListener('click', () => {
    player.togglePiP();
  });
  
  document.getElementById('btn-copy-url')?.addEventListener('click', copyStreamUrl);
  document.getElementById('btn-copy-stream')?.addEventListener('click', copyStreamUrl);
  
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
}

/**
 * Update volume icon based on state
 */
function updateVolumeIcon() {
  const video = document.getElementById('video');
  const volumeIcon = document.querySelector('#btn-mute .icon-volume');
  const mutedIcon = document.querySelector('#btn-mute .icon-muted');
  
  if (!video) return;
  
  // Show muted icon if muted OR volume is 0
  const showMuted = video.muted || video.volume === 0;
  console.log('[App] updateVolumeIcon:', { muted: video.muted, volume: video.volume, showMuted });
  
  if (volumeIcon && mutedIcon) {
    // Use CSS class toggle instead of hidden attribute (more reliable for SVGs)
    volumeIcon.classList.toggle('is-hidden', showMuted);
    mutedIcon.classList.toggle('is-hidden', !showMuted);
    console.log('[App] Volume icon classes after toggle:', {
      volumeHidden: volumeIcon.classList.contains('is-hidden'),
      mutedHidden: mutedIcon.classList.contains('is-hidden')
    });
  }
}

/**
 * Update fullscreen icon based on state
 */
function updateFullscreenIcon() {
  const expandIcon = document.querySelector('#btn-fullscreen .icon-expand');
  const compressIcon = document.querySelector('#btn-fullscreen .icon-compress');
  const isFs = player.isFullscreen();
  if (expandIcon && compressIcon) {
    expandIcon.classList.toggle('is-hidden', isFs);
    compressIcon.classList.toggle('is-hidden', !isFs);
  }
}

/**
 * Format seconds as timecode (H:MM:SS or M:SS)
 * @param {number} seconds 
 * @returns {string}
 */
function formatTimecode(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Set up progress bar scrubbing with click, drag, and tooltip
 */
function setupProgressBarScrubbing() {
  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');
  const scrubber = document.getElementById('progress-scrubber');
  const tooltip = document.getElementById('progress-tooltip');
  const video = document.getElementById('video');
  
  if (!progressBar) {
    console.warn('[App] Progress bar not found');
    return;
  }
  
  let isDragging = false;
  
  /**
   * Calculate percent from mouse position
   */
  function getPercentFromEvent(e) {
    const rect = progressBar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }
  
  /**
   * Update tooltip position and text
   */
  function updateTooltip(e, percent) {
    if (!tooltip || !video?.duration || !isFinite(video.duration) || video.duration === 0) return;
    
    const time = percent * video.duration;
    tooltip.textContent = formatTimecode(time) + ' / ' + formatTimecode(video.duration);
    
    // Position tooltip at cursor
    const rect = progressBar.getBoundingClientRect();
    const tooltipX = e.clientX - rect.left;
    tooltip.style.left = `${tooltipX}px`;
  }
  
  /**
   * Seek to position
   */
  function seekToPercent(percent) {
    if (!video) {
      console.warn('[App] Cannot seek - no video element');
      return;
    }
    
    // Check if video has valid duration
    if (!video.duration || !isFinite(video.duration) || video.duration === 0) {
      console.warn('[App] Cannot seek - no valid duration (live stream?)');
      return;
    }
    
    // Calculate seek time
    const seekTime = percent * video.duration;
    
    // Validate seek time
    if (!isFinite(seekTime) || seekTime < 0) {
      console.warn('[App] Invalid seek time:', seekTime);
      return;
    }
    
    console.log('[App] Seeking to:', formatTimecode(seekTime), 'of', formatTimecode(video.duration), '(' + (percent * 100).toFixed(1) + '%)');
    
    // Use the player module's seek function (handles HLS.js properly)
    player.seek(seekTime);
  }
  
  /**
   * Update scrubber and fill visually during drag
   */
  function updateScrubberPosition(percent) {
    if (scrubber) scrubber.style.left = `${percent * 100}%`;
    if (progressFill) progressFill.style.width = `${percent * 100}%`;
  }
  
  // Mouse down - start drag
  progressBar.addEventListener('mousedown', (e) => {
    if (!video?.duration || !isFinite(video.duration)) return;
    
    isDragging = true;
    progressBar.classList.add('is-dragging');
    
    const percent = getPercentFromEvent(e);
    updateScrubberPosition(percent);
    updateTooltip(e, percent);
    
    e.preventDefault(); // Prevent text selection
  });
  
  // Mouse move - update preview during drag, show tooltip on hover
  progressBar.addEventListener('mousemove', (e) => {
    const percent = getPercentFromEvent(e);
    updateTooltip(e, percent);
    
    if (isDragging) {
      updateScrubberPosition(percent);
    }
  });
  
  // Mouse up on progress bar - seek
  progressBar.addEventListener('mouseup', (e) => {
    if (!video?.duration || !isFinite(video.duration)) return;
    
    const percent = getPercentFromEvent(e);
    seekToPercent(percent);
    
    isDragging = false;
    progressBar.classList.remove('is-dragging');
  });
  
  // Mouse leave - cancel drag preview if not committed
  progressBar.addEventListener('mouseleave', () => {
    if (isDragging) {
      // Reset to actual position
      if (video?.duration && isFinite(video.duration)) {
        const actualPercent = video.currentTime / video.duration;
        updateScrubberPosition(actualPercent);
      }
    }
  });
  
  // Global mouse up - finish drag even if mouse leaves progress bar
  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      progressBar.classList.remove('is-dragging');
      
      // If we're still over the progress bar area, seek
      const rect = progressBar.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        const percent = getPercentFromEvent(e);
        seekToPercent(percent);
      } else {
        // Reset to actual position
        if (video?.duration && isFinite(video.duration)) {
          const actualPercent = video.currentTime / video.duration;
          updateScrubberPosition(actualPercent);
        }
      }
    }
  });
  
  // Global mouse move - continue drag even if mouse leaves progress bar
  document.addEventListener('mousemove', (e) => {
    if (isDragging && video?.duration && isFinite(video.duration)) {
      const rect = progressBar.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      updateScrubberPosition(percent);
    }
  });
  
  console.log('[App] Progress bar scrubbing initialized');
}

/**
 * Copy current stream URL to clipboard
 */
async function copyStreamUrl() {
  const url = player.getCurrentUrl();
  if (!url) {
    ui.showToast('No stream URL available', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(url);
    ui.showToast('Stream URL copied!', 'success');
  } catch (e) {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    ui.showToast('Stream URL copied!', 'success');
  }
}

// =============================================================================
// Modal Handling - Fixed version
// =============================================================================

const modals = {
  playlist: null,
  settings: null,
  pin: null,
  confirm: null,
};

/**
 * Set up modal handlers
 */
function setupModals() {
  // Cache modal elements
  modals.playlist = document.getElementById('modal-playlist');
  modals.settings = document.getElementById('modal-settings');
  modals.pin = document.getElementById('modal-pin');
  modals.confirm = document.getElementById('modal-confirm');
  
  // Set up dialog event handlers
  Object.entries(modals).forEach(([name, modal]) => {
    if (modal) {
      // Handle click on backdrop (clicking outside the dialog)
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(name);
      });
    }
  });
  
  // Add Playlist button
  document.getElementById('btn-add-playlist')?.addEventListener('click', () => {
    showModal('playlist');
  });
  
  // Playlist modal tabs
  document.querySelectorAll('#playlist-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => switchPlaylistTab(tab.dataset.tab));
  });
  
  // Close buttons
  document.getElementById('modal-playlist-close')?.addEventListener('click', () => hideModal('playlist'));
  document.getElementById('modal-settings-close')?.addEventListener('click', () => hideModal('settings'));
  document.getElementById('btn-cancel-playlist')?.addEventListener('click', () => hideModal('playlist'));
  document.getElementById('btn-close-settings')?.addEventListener('click', () => hideModal('settings'));
  document.getElementById('btn-cancel-pin')?.addEventListener('click', () => {
    hideModal('pin');
    // If canceling PIN unlock on first load, show onboarding
    if (!isInitialized || channels.length === 0) {
      credentials.clearCredentials();
      ui.showOnboarding();
    }
  });
  document.getElementById('btn-confirm-cancel')?.addEventListener('click', () => hideModal('confirm'));
  
  // Settings button
  document.getElementById('btn-settings')?.addEventListener('click', () => showModal('settings'));
  
  // Load playlist button
  document.getElementById('btn-load-playlist')?.addEventListener('click', handleLoadPlaylist);
  
  // File drop area
  setupFileDrop();
  
  // PIN modal
  document.getElementById('btn-submit-pin')?.addEventListener('click', handlePinSubmit);
  document.getElementById('pin-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });
}

/**
 * Show a modal
 */
function showModal(name) {
  const modal = modals[name];
  if (modal && !modal.open) {
    // Pre-populate playlist form with current credentials if available
    if (name === 'playlist' && currentCredentials) {
      prefillPlaylistForm(currentCredentials);
    }
    modal.showModal();
  }
}

/**
 * Pre-fill the playlist form with existing credentials
 */
function prefillPlaylistForm(creds) {
  if (creds.mode === 'xtream') {
    // Switch to Xtream tab
    switchPlaylistTab('xtream');
    
    // Fill in fields
    const serverInput = document.getElementById('xtream-server');
    const usernameInput = document.getElementById('xtream-username');
    const passwordInput = document.getElementById('xtream-password');
    
    if (serverInput) serverInput.value = creds.server || '';
    if (usernameInput) usernameInput.value = creds.username || '';
    if (passwordInput) passwordInput.value = creds.password || '';
  } else if (creds.mode === 'm3u-url' && creds.url) {
    // Switch to M3U URL tab
    switchPlaylistTab('m3u-url');
    
    const urlInput = document.getElementById('m3u-url-input');
    if (urlInput) urlInput.value = creds.url;
  }
}

/**
 * Hide a modal
 */
function hideModal(name) {
  const modal = modals[name];
  if (modal?.open) modal.close();
}


/**
 * Switch playlist tab
 */
function switchPlaylistTab(tab) {
  document.querySelectorAll('#playlist-tabs .tab').forEach(t => {
    t.classList.toggle('tab--active', t.dataset.tab === tab);
  });
  
  document.querySelectorAll('#modal-playlist .tab-content').forEach(content => {
    const isActive = content.dataset.tab === tab;
    content.classList.toggle('tab-content--active', isActive);
    content.hidden = !isActive;
  });
  
  hideFormError();
}

/**
 * Set up file drop area
 */
function setupFileDrop() {
  const dropArea = document.getElementById('file-drop');
  const fileInput = document.getElementById('m3u-file');
  const fileNameSpan = document.getElementById('file-name');
  
  if (!dropArea || !fileInput) return;
  
  dropArea.addEventListener('click', () => fileInput.click());
  
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('file-drop--active');
  });
  
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('file-drop--active');
  });
  
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('file-drop--active');
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      if (fileNameSpan) fileNameSpan.textContent = file.name;
    }
  });
  
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && fileNameSpan) {
      fileNameSpan.textContent = file.name;
    }
  });
}

/**
 * Handle load playlist button click
 */
async function handleLoadPlaylist() {
  const activeTab = document.querySelector('#playlist-tabs .tab--active')?.dataset.tab;
  
  hideFormError();
  
  // Clear any existing VOD/Series caches when loading new playlist
  clearVodSeriesCaches();
  
  try {
    let creds = null;
    let loadedChannels = [];
    
    if (activeTab === 'xtream') {
      const server = document.getElementById('xtream-server').value.trim();
      const username = document.getElementById('xtream-username').value.trim();
      const password = document.getElementById('xtream-password').value;
      const remember = document.getElementById('xtream-remember').checked;
      
      if (!server || !username || !password) {
        throw new Error('Please fill in all fields');
      }
      
      // Build EPG URL for Xtream - XMLTV endpoint
      const cleanServer = server.replace(/\/+$/, ''); // Remove trailing slashes
      const epgUrl = `${cleanServer}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      
      creds = { mode: 'xtream', server, username, password, epgUrl };
      console.log('[App] Xtream EPG URL:', epgUrl);
      
      showLoadingState('Connecting to server...');
      loadedChannels = await playlist.fetchXtream(creds, updateLoadingMessage);
      
    } else if (activeTab === 'm3u-url') {
      const playlistUrl = document.getElementById('m3u-url').value.trim();
      const epgUrl = document.getElementById('epg-url').value.trim();
      
      if (!playlistUrl) {
        throw new Error('Please enter a playlist URL');
      }
      
      creds = { mode: 'm3u-url', playlistUrl, epgUrl: epgUrl || null };
      
      showLoadingState('Fetching playlist...');
      loadedChannels = await playlist.fetchM3U(playlistUrl, updateLoadingMessage);
      
    } else if (activeTab === 'm3u-file') {
      const fileInput = document.getElementById('m3u-file');
      const epgUrl = document.getElementById('file-epg-url').value.trim();
      
      if (!fileInput.files || !fileInput.files[0]) {
        throw new Error('Please select a file');
      }
      
      creds = { mode: 'm3u-file', epgUrl: epgUrl || null };
      
      showLoadingState('Reading file...');
      loadedChannels = await playlist.readM3UFile(fileInput.files[0], updateLoadingMessage);
    }
    
    if (!loadedChannels || loadedChannels.length === 0) {
      throw new Error('No channels found in playlist');
    }
    
    // Store channels
    await playlist.storeChannels(loadedChannels);
    channels = loadedChannels;
    
    // Store credentials - get the remember checkbox for this tab type
    let remember = true; // Default to remembering
    if (activeTab === 'xtream') {
      const checkbox = document.getElementById('xtream-remember');
      remember = checkbox?.checked ?? true;
    } else if (activeTab === 'm3u-url') {
      const checkbox = document.getElementById('m3u-url-remember');
      remember = checkbox?.checked ?? true;
    }
    await credentials.storeCredentials(creds, remember);
    currentCredentials = creds;
    
    // Update UI
    hideLoadingState();
    hideModal('playlist');
    ui.setChannels(channels);
    ui.showPlayer();
    ui.showToast(`Loaded ${channels.length} channels`, 'success');
    updateSettingsInfo();
    
    // Update global search with new channels
    updateGlobalSearchItems();
    
    // VOD/Series now loaded on-demand when user searches (not eagerly)
    // See loadVodSeriesOnDemand() for the on-demand loading logic
    
    // Load EPG if URL provided
    if (creds.epgUrl) {
      loadEpg(creds.epgUrl);
    }
    
  } catch (error) {
    console.error('[App] Load playlist error:', error);
    hideLoadingState();
    showFormError(error.message);
  }
}

/**
 * Show loading state in modal
 */
function showLoadingState(message) {
  const loading = document.getElementById('form-loading');
  const loadingMessage = document.getElementById('loading-message');
  
  // Hide all forms in the playlist modal
  document.querySelectorAll('#modal-playlist .form').forEach(f => f.hidden = true);
  
  if (loading) loading.hidden = false;
  if (loadingMessage) loadingMessage.textContent = message;
}

/**
 * Update loading message
 */
function updateLoadingMessage(message) {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) loadingMessage.textContent = message;
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loading = document.getElementById('form-loading');
  
  if (loading) loading.hidden = true;
  
  // Show the active form
  const activeTab = document.querySelector('#playlist-tabs .tab--active')?.dataset.tab;
  document.querySelectorAll('#modal-playlist .tab-content').forEach(content => {
    content.hidden = content.dataset.tab !== activeTab;
  });
}

/**
 * Show form error
 */
function showFormError(message) {
  const errorDiv = document.getElementById('form-error');
  const errorText = document.getElementById('error-text');
  if (errorDiv) errorDiv.hidden = false;
  if (errorText) errorText.textContent = message;
}

/**
 * Hide form error
 */
function hideFormError() {
  const errorDiv = document.getElementById('form-error');
  if (errorDiv) errorDiv.hidden = true;
}

// =============================================================================
// PIN Modal
// =============================================================================

let pinMode = 'unlock';

/**
 * Show PIN modal
 */
function showPinModal(mode) {
  pinMode = mode;
  
  const title = document.getElementById('pin-title');
  const description = document.getElementById('pin-description');
  const input = document.getElementById('pin-input');
  const error = document.getElementById('pin-error');
  
  if (mode === 'unlock') {
    if (title) title.textContent = 'Enter PIN';
    if (description) description.textContent = 'Enter your PIN to unlock credentials.';
  } else if (mode === 'create') {
    if (title) title.textContent = 'Create PIN';
    if (description) description.textContent = 'Create a 4-8 digit PIN to protect your credentials.';
  }
  
  if (input) input.value = '';
  if (error) error.hidden = true;
  
  showModal('pin');
  
  // Focus input after modal animation
  setTimeout(() => input?.focus(), 100);
}

/**
 * Handle PIN submit
 */
async function handlePinSubmit() {
  const input = document.getElementById('pin-input');
  const error = document.getElementById('pin-error');
  const pin = input?.value || '';
  
  if (pin.length < 4 || pin.length > 8) {
    if (error) {
      error.textContent = 'PIN must be 4-8 digits';
      error.hidden = false;
    }
    return;
  }
  
  if (pinMode === 'unlock') {
    const success = await loadStoredCredentials(pin);
    if (success) {
      hideModal('pin');
    }
  } else if (pinMode === 'create') {
    try {
      await credentials.enableVault(pin);
      storage.updateSettings({ vaultEnabled: true });
      hideModal('pin');
      ui.showToast('Vault enabled', 'success');
      updateSettingsInfo();
    } catch (e) {
      if (error) {
        error.textContent = e.message;
        error.hidden = false;
      }
    }
  }
}

// =============================================================================
// Settings
// =============================================================================

/**
 * Set up settings handlers
 */
function setupSettings() {
  document.getElementById('btn-change-playlist')?.addEventListener('click', () => {
    hideModal('settings');
    showModal('playlist');
  });
  
  document.getElementById('btn-refresh-playlist')?.addEventListener('click', async () => {
    hideModal('settings');
    await refreshPlaylist();
  });
  
  const vaultToggle = document.getElementById('toggle-vault');
  vaultToggle?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (!currentCredentials) {
        ui.showToast('Load a playlist first', 'error');
        e.target.checked = false;
        return;
      }
      hideModal('settings');
      showPinModal('create');
    } else {
      try {
        credentials.disableVault();
        storage.updateSettings({ vaultEnabled: false });
        ui.showToast('Vault disabled', 'info');
        updateSettingsInfo();
      } catch (err) {
        e.target.checked = true;
        ui.showToast('Failed to disable vault', 'error');
      }
    }
  });
  
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const data = await storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simple-iptv-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    ui.showToast('Settings exported', 'success');
  });
  
  const importFile = document.getElementById('import-file');
  document.getElementById('btn-import')?.addEventListener('click', () => {
    importFile?.click();
  });
  
  importFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      storage.importData(data);
      ui.showToast('Settings imported - reloading...', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      ui.showToast('Invalid import file', 'error');
    }
    e.target.value = '';
  });
  
  // Locale/Country selector
  const localeSelect = document.getElementById('locale-select');
  const localeInfo = document.getElementById('settings-locale-info');
  
  // Set initial value from locale module
  if (localeSelect) {
    const override = locale.getCountryOverride();
    localeSelect.value = override || '';
    updateLocaleInfo();
  }
  
  localeSelect?.addEventListener('change', (e) => {
    const country = e.target.value || null;
    locale.setCountryOverride(country);
    updateLocaleInfo();
    
    // Refresh UI with new locale sorting
    ui.refreshForLocaleChange();
    
    ui.showToast(country ? `Language set to ${e.target.options[e.target.selectedIndex].text}` : 'Using auto-detected language', 'success');
  });
  
  function updateLocaleInfo() {
    if (!localeInfo) return;
    const activeCountry = locale.getActiveCountry();
    const override = locale.getCountryOverride();
    localeInfo.textContent = override 
      ? `Set to ${activeCountry}` 
      : `Auto-detected: ${activeCountry}`;
  }
  
  // Logout button (in header)
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    showConfirmDialog(
      'Logout',
      'This will clear your saved credentials and return to the login screen.',
      async () => {
        await logout();
      }
    );
  });
  
  // Proxy URL settings
  const proxyUrlInput = document.getElementById('proxy-url');
  const saveProxyBtn = document.getElementById('btn-save-proxy');
  const proxyHelpLink = document.getElementById('link-proxy-help');
  
  // Load current proxy URL
  if (proxyUrlInput) {
    const settings = storage.getSettings();
    proxyUrlInput.value = settings.proxyUrl || '';
  }
  
  saveProxyBtn?.addEventListener('click', () => {
    const url = proxyUrlInput?.value.trim() || null;
    storage.setProxyUrl(url);
    ui.showToast(url ? 'Proxy saved' : 'Proxy cleared', 'success');
  });
  
  // Test proxy button
  const testProxyBtn = document.getElementById('btn-test-proxy');
  const testResults = document.getElementById('proxy-test-results');
  const testStatus = document.getElementById('proxy-test-status');
  const testLog = document.getElementById('proxy-test-log');
  
  testProxyBtn?.addEventListener('click', async () => {
    const proxyUrl = proxyUrlInput?.value.trim();
    if (!proxyUrl) {
      ui.showToast('Enter a proxy URL first', 'error');
      return;
    }
    
    // Show results area
    testResults.hidden = false;
    testStatus.className = 'proxy-test-status testing';
    testStatus.textContent = '⏳ Testing proxy...';
    testLog.innerHTML = '';
    
    await runProxyTest(proxyUrl, testStatus, testLog);
  });
  
  proxyHelpLink?.addEventListener('click', (e) => {
    e.preventDefault();
    showProxyHelp();
  });
}

/**
 * Run comprehensive proxy test
 */
async function runProxyTest(proxyUrl, statusEl, logEl) {
  const log = (msg, type = '') => {
    const span = document.createElement('span');
    span.className = type ? `log-${type}` : '';
    span.textContent = msg + '\n';
    logEl.appendChild(span);
    logEl.scrollTop = logEl.scrollHeight;
  };
  
  log('PROXY DIAGNOSTIC TEST');
  log('─'.repeat(40));
  
  const baseProxy = proxyUrl.endsWith('/') ? proxyUrl : proxyUrl + '/';
  
  // Test 1: Basic connectivity
  log('TEST 1: Basic proxy connectivity');
  log('─────────────────────────────────');
  try {
    const response = await fetch(baseProxy, { method: 'GET' });
    log(`Status: ${response.status} ${response.statusText}`);
    const body = await response.text();
    log(`Response: ${body.substring(0, 200)}`);
    if (response.ok) {
      log('✓ Proxy is reachable', 'success');
    } else {
      log('✗ Proxy returned error', 'error');
    }
  } catch (e) {
    log(`✗ Failed to reach proxy: ${e.message}`, 'error');
    statusEl.className = 'proxy-test-status error';
    statusEl.textContent = '❌ Proxy unreachable';
    return;
  }
  log('');
  
  // Test 2: Test with a known public URL
  log('TEST 2: Proxy with public URL (httpbin.org)');
  log('─────────────────────────────────');
  const testUrl = 'https://httpbin.org/headers';
  const proxiedTestUrl = baseProxy + encodeURIComponent(testUrl);
  log(`Target: ${testUrl}`);
  log(`Proxied: ${proxiedTestUrl}`, 'url');
  
  try {
    const response = await fetch(proxiedTestUrl);
    log(`Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      const data = await response.json();
      log('Headers seen by upstream server:');
      for (const [key, value] of Object.entries(data.headers || {})) {
        log(`  ${key}: ${value}`, 'header');
      }
      log('✓ Proxy successfully forwarded request', 'success');
    } else {
      const body = await response.text();
      log(`Response: ${body.substring(0, 300)}`, 'error');
    }
  } catch (e) {
    log(`✗ Error: ${e.message}`, 'error');
  }
  log('');
  
  // Test 3: Test with a loaded channel's stream URL
  {
    log('TEST 3: Proxy with HLS stream URL');
    log('─────────────────────────────────');
    
    // Use first loaded channel if available
    let streamUrl = null;
    let channelName = 'No channel loaded';
    
    if (channels.length > 0) {
      streamUrl = channels[0].url;
      channelName = channels[0].name;
    }
    
    if (!streamUrl) {
      log('⚠️ No channels loaded - skipping stream test', 'warn');
      log('   Load a playlist first to test stream proxying.');
      log('');
    } else {
    
    const proxiedStreamUrl = baseProxy + encodeURIComponent(streamUrl);
    
    log(`Channel: ${channelName}`);
    log(`Stream: ${streamUrl}`, 'url');
    log(`Proxied: ${proxiedStreamUrl.substring(0, 80)}...`, 'url');
    log('');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      log('Fetching (timeout: 15s)...');
      const startTime = performance.now();
      const response = await fetch(proxiedStreamUrl, {
        signal: controller.signal,
        headers: { 'Range': 'bytes=0-1000' }
      });
      const elapsed = (performance.now() - startTime).toFixed(0);
      clearTimeout(timeoutId);
      
      log(`Status: ${response.status} ${response.statusText}`);
      log(`Time: ${elapsed}ms`);
      log('');
      log('Response headers:');
      response.headers.forEach((value, key) => {
        log(`  ${key}: ${value}`, 'header');
      });
      log('');
      
      // Read body
      const body = await response.text();
      log(`Body length: ${body.length} bytes`);
      log(`Body preview: ${body.substring(0, 300)}`);
      log('');
      
      // Check if manifest is valid HLS with segments
      const isHLS = body.includes('#EXTM3U');
      const hasSegments = body.includes('.ts') || body.includes('.m3u8');
      const hasEndList = body.includes('#EXT-X-ENDLIST');
      const isEmpty = isHLS && hasEndList && !hasSegments;
      
      if (isEmpty) {
        log('⚠️ EMPTY MANIFEST - Stream is offline/ended', 'warn');
        log('The manifest has no video segments. This channel may have finished broadcasting.', 'warn');
        statusEl.className = 'proxy-test-status warn';
        statusEl.textContent = '⚠️ Stream offline';
      } else if (response.ok || response.status === 206) {
        log('✓ Stream accessible through proxy!', 'success');
        if (hasSegments) {
          log(`✓ Valid HLS manifest with video segments detected`, 'success');
        }
        statusEl.className = 'proxy-test-status success';
        statusEl.textContent = '✅ Proxy working!';
      } else if (response.status === 403) {
        log('✗ Upstream returned 403 Forbidden', 'error');
        log('', 'warn');
        log('The IPTV provider is blocking datacenter IPs.', 'warn');
        log('Cloudflare Workers use well-known IP ranges that many providers block.', 'warn');
        log('', 'warn');
        log('Options:', 'warn');
        log('  1. Use a residential proxy service (paid)', 'warn');
        log('  2. Self-host proxy on a home server', 'warn');
        log('  3. Copy stream URLs to VLC/IINA', 'warn');
        statusEl.className = 'proxy-test-status error';
        statusEl.textContent = '❌ Provider blocks datacenter IPs';
      } else {
        log(`✗ Unexpected status: ${response.status}`, 'error');
        statusEl.className = 'proxy-test-status error';
        statusEl.textContent = `❌ HTTP ${response.status}`;
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        log('✗ Request timed out', 'error');
      } else {
        log(`✗ Error: ${e.message}`, 'error');
      }
      statusEl.className = 'proxy-test-status error';
      statusEl.textContent = '❌ Request failed';
    }
    }
  }
  
  log('');
  log('─'.repeat(40));
  log('TEST COMPLETE');
}

/**
 * Logout - clear all stored data and return to onboarding
 */
async function logout() {
  try {
    // Clear all storage
    await storage.clearAllData();
    await playlist.clearChannels();
    await epg.clear();
    credentials.clearCredentials();
    
    // Clear app state
    currentCredentials = null;
    channels = [];
    
    ui.showToast('Logged out - reloading...', 'success');
    
    // Reload to show onboarding
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    console.error('[App] Logout error:', error);
    ui.showToast('Error logging out', 'error');
  }
}

/**
 * Show proxy setup help - opens help in a new window with formatted content
 */
function showProxyHelp() {
  const helpHtml = `
<!DOCTYPE html><html><head><title>Proxy Setup Guide</title>
<style>body{font-family:system-ui;background:#1a1a25;color:#f0f0f5;padding:2rem;max-width:600px;margin:0 auto}
h1{color:#00d4ff}h2{color:#a855f7;margin-top:1.5rem}code{background:#2a2a35;padding:2px 6px;border-radius:4px}
ul{line-height:1.8}</style></head><body>
<h1>🔐 Proxy Setup Guide</h1>
<p>Some IPTV providers block browser playback. A proxy can help bypass this.</p>
<h2>Requirements</h2>
<ul>
<li>A serverless edge function (Cloudflare Workers, Fly.io, etc.)</li>
<li>Forward requests with media player headers</li>
<li>Add CORS headers to responses</li>
<li>Rewrite relative URLs in HLS manifests</li>
</ul>
<h2>Key Concepts</h2>
<ul>
<li>Decode the URL from the request path</li>
<li>Use <code>User-Agent: Lavf/60.3.100</code> (FFmpeg)</li>
<li>Follow HTTP redirects</li>
<li>Stream large content without buffering</li>
</ul>
<h2>Free Hosting Options</h2>
<ul>
<li><strong>Fly.io</strong> - fly.io</li>
<li><strong>Cloudflare Workers</strong> - dash.cloudflare.com</li>
<li><strong>Railway</strong> - railway.app</li>
</ul>
<p>URL format: <code>https://your-proxy.example.com/{encoded-url}</code></p>
</body></html>`;
  
  const win = window.open('', '_blank', 'width=650,height=600');
  if (win) win.document.write(helpHtml);
}

/**
 * Update settings info display
 */
function updateSettingsInfo() {
  const playlistInfo = document.getElementById('settings-playlist-info');
  const vaultToggle = document.getElementById('toggle-vault');
  
  if (playlistInfo) {
    if (currentCredentials) {
      const { mode } = currentCredentials;
      if (mode === 'xtream') {
        playlistInfo.textContent = `Xtream: ${currentCredentials.server}`;
      } else if (mode === 'm3u-url') {
        playlistInfo.textContent = 'M3U URL';
      } else if (mode === 'm3u-file') {
        playlistInfo.textContent = 'Local file';
      }
    } else {
      playlistInfo.textContent = 'None loaded';
    }
  }
  
  if (vaultToggle) {
    const settings = storage.getSettings();
    vaultToggle.checked = settings.vaultEnabled || false;
  }
  
  // Update proxy URL input
  const proxyUrlInput = document.getElementById('proxy-url');
  if (proxyUrlInput) {
    const settings = storage.getSettings();
    proxyUrlInput.value = settings.proxyUrl || '';
  }
  
  // Show/hide logout button based on login state
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.hidden = !currentCredentials;
  }
}

/**
 * Show confirm dialog
 */
function showConfirmDialog(title, message, onConfirm) {
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const confirmBtn = document.getElementById('btn-confirm-ok');
  
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  
  // Clone to remove old listeners
  if (confirmBtn) {
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', () => {
      hideModal('confirm');
      onConfirm();
    });
  }
  
  showModal('confirm');
}

// =============================================================================
// Initialize on DOM ready
// =============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.SimpleIPTV = {
  storage,
  credentials,
  playlist,
  player,
  epg,
  ui,
  getChannels: () => channels,
  getCurrentCredentials: () => currentCredentials,
  clearAll: async () => {
    await storage.clearAllData();
    await playlist.clearChannels();
    credentials.clearCredentials();
  }
};
