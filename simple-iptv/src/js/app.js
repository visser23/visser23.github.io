/**
 * Simple IPTV - Main Application
 * Orchestrates all modules and handles app lifecycle
 */

import * as storage from './modules/storage.js';
import * as credentials from './modules/credentials.js';
import * as playlist from './modules/playlist.js';
import * as player from './modules/player.js';
import * as epg from './modules/epg.js';
import * as ui from './modules/ui.js';

// App state
let currentCredentials = null;
let channels = [];
let isInitialized = false;

// Modal state
const openModals = new Set();

/**
 * Initialize the application
 */
async function init() {
  // Ensure all modals are closed on start
  ensureModalsClosedOnStart();
  
  // Initialize UI
  ui.init({
    onChannelSelect: handleChannelSelect,
    onFavoriteToggle: handleFavoriteToggle,
  });
  
  // Initialize player
  const videoElement = document.getElementById('video');
  if (videoElement) {
    player.init(videoElement);
    setupPlayerListeners();
  }
  
  // Set up modal handlers
  setupModals();
  
  // Set up player controls
  setupPlayerControls();
  
  // Set up settings
  setupSettings();
  
  // Check for stored credentials and decide initial view
  await checkInitialState();
  
  isInitialized = true;
}

/**
 * Ensure all modals are closed when app starts
 */
function ensureModalsClosedOnStart() {
  document.querySelectorAll('dialog').forEach(dialog => {
    if (dialog.open) {
      dialog.close();
    }
  });
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.hidden = true;
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
  try {
    currentCredentials = await credentials.getCredentials(pin);
    
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
      return false;
    }
    
    // Try to load cached channels first
    channels = await playlist.loadChannels();
    
    if (channels.length > 0) {
      ui.setChannels(channels);
      ui.showPlayer();
      updateSettingsInfo();
      
      // Load EPG from cache
      await epg.loadFromCache();
    } else {
      // No cached channels, need to fetch
      await refreshPlaylist();
    }
    
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
    
    // Load EPG if URL provided
    if (currentCredentials.epgUrl) {
      loadEpg(currentCredentials.epgUrl);
    }
    
    updateSettingsInfo();
    ui.showToast(`Loaded ${channels.length} channels`, 'success');
    
  } catch (error) {
    console.error('[App] Failed to refresh playlist:', error);
    ui.showLoading(false);
    ui.setNowPlaying('Failed to load playlist');
    ui.showToast(error.message || 'Failed to load playlist', 'error');
  }
}

/**
 * Load EPG data
 * @param {string} url 
 */
async function loadEpg(url) {
  epg.on('onComplete', () => {
    ui.showToast('EPG loaded', 'success');
    ui.refresh();
  });
  
  epg.on('onError', (data) => {
    console.error('[EPG] Error:', data);
    ui.showToast('EPG failed to load', 'error');
  });
  
  await epg.loadFromUrl(url);
}

/**
 * Handle channel selection
 * @param {Object} channel 
 */
async function handleChannelSelect(channel) {
  ui.showLoading(true);
  ui.hideError();
  ui.setNowPlaying(channel.name);
  
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

/**
 * Handle favorite toggle
 */
function handleFavoriteToggle(channelId) {
  // Favorites toggle handled by UI module
}

/**
 * Set up player event listeners
 */
function setupPlayerListeners() {
  player.on('onStateChange', (state) => {
    if (state.loading !== undefined) {
      ui.showLoading(state.loading);
    }
    if (state.playing !== undefined) {
      updatePlayPauseButton(state.playing);
    }
  });
  
  player.on('onError', (error) => {
    ui.showLoading(false);
    // Pass full error object for better messaging
    ui.showError(error);
  });
}

/**
 * Update play/pause button state
 */
function updatePlayPauseButton(playing) {
  const playIcon = document.querySelector('.icon-play');
  const pauseIcon = document.querySelector('.icon-pause');
  if (playIcon) playIcon.hidden = playing;
  if (pauseIcon) pauseIcon.hidden = !playing;
}

/**
 * Set up player controls
 */
function setupPlayerControls() {
  document.getElementById('btn-play-pause')?.addEventListener('click', () => {
    player.togglePlay();
  });
  
  const volumeSlider = document.getElementById('volume-slider');
  volumeSlider?.addEventListener('input', (e) => {
    player.setVolume(parseFloat(e.target.value));
    updateVolumeIcon();
  });
  
  document.getElementById('btn-mute')?.addEventListener('click', () => {
    player.toggleMute();
    updateVolumeIcon();
  });
  
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
  const volumeIcon = document.querySelector('.icon-volume');
  const mutedIcon = document.querySelector('.icon-muted');
  const isMuted = player.isMuted();
  if (volumeIcon) volumeIcon.hidden = isMuted;
  if (mutedIcon) mutedIcon.hidden = !isMuted;
}

/**
 * Update fullscreen icon based on state
 */
function updateFullscreenIcon() {
  const expandIcon = document.querySelector('.icon-expand');
  const compressIcon = document.querySelector('.icon-compress');
  const isFs = player.isFullscreen();
  if (expandIcon) expandIcon.hidden = isFs;
  if (compressIcon) compressIcon.hidden = !isFs;
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
  
  // Set up dialog close event handlers to track state
  Object.entries(modals).forEach(([name, modal]) => {
    if (modal) {
      // Track when dialog is closed (by any means)
      modal.addEventListener('close', () => {
        openModals.delete(name);
      });
      
      // Handle click on backdrop (clicking outside the dialog)
      modal.addEventListener('click', (e) => {
        // If click is on the dialog element itself (not its children), it's the backdrop
        if (e.target === modal) {
          hideModal(name);
        }
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
    openModals.add(name);
    
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
  if (modal && modal.open) {
    modal.close();
    openModals.delete(name);
  }
}

/**
 * Hide all modals
 */
function hideAllModals() {
  Object.keys(modals).forEach(name => hideModal(name));
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
      
      creds = { mode: 'xtream', server, username, password };
      
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
  
  document.getElementById('btn-clear-data')?.addEventListener('click', () => {
    showConfirmDialog(
      'Clear All Data',
      'This will remove all stored data including credentials, favorites, and cached channels. This cannot be undone.',
      async () => {
        await logout();
      }
    );
  });
  
  // Logout button
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
  
  log('═══════════════════════════════════════════════════════════');
  log('PROXY DIAGNOSTIC TEST');
  log('═══════════════════════════════════════════════════════════');
  log('');
  
  // Normalize proxy URL
  const baseProxy = proxyUrl.endsWith('/') ? proxyUrl : proxyUrl + '/';
  log(`Proxy URL: ${baseProxy}`, 'url');
  log('');
  
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
  log('═══════════════════════════════════════════════════════════');
  log('TEST COMPLETE');
  log('═══════════════════════════════════════════════════════════');
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
 * Show proxy setup help
 */
function showProxyHelp() {
  const helpText = `
🔐 PROXY SETUP GUIDE

Some IPTV providers block browser playback. A proxy can help.

WHAT YOU NEED:
• A serverless edge function (Cloudflare Workers, Fly.io, etc.)
• The function should forward requests with media player headers
• It must add CORS headers to responses
• HLS manifests need URL rewriting for relative paths

KEY CONCEPTS:
• Decode the encoded URL from the request path
• Mimic VLC/FFmpeg User-Agent headers
• Follow redirects from the upstream server  
• Stream content without buffering large segments
• Rewrite .m3u8 playlist URLs to route back through proxy

HEADERS TO CONSIDER:
• User-Agent: Lavf/60.3.100 (FFmpeg)
• Access-Control-Allow-Origin: *
• Icy-MetaData: 1

PLATFORMS (all have free tiers):
• Cloudflare Workers - dash.cloudflare.com
• Fly.io - fly.io
• Railway - railway.app
• Render - render.com

The proxy URL format should be:
https://your-proxy.example.com/{encoded-target-url}

Check the project README for more details.
  `.trim();
  
  // Create a temporary modal or alert
  alert(helpText);
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
