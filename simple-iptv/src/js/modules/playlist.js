/**
 * Playlist Module
 * Handles M3U parsing and Xtream Codes API
 * 
 * DEBUG MODE: Set window.PLAYLIST_DEBUG = true for verbose logging
 */

import { db, KEYS, getProxyUrl } from './storage.js';

// Debug logging helper
const DEBUG = () => window.PLAYLIST_DEBUG === true;
function log(...args) {
  console.log('[Playlist]', ...args);
}
function debug(...args) {
  if (DEBUG()) console.log('[Playlist:DEBUG]', ...args);
}
function error(...args) {
  console.error('[Playlist]', ...args);
}

// Enable debug mode by default for now
window.PLAYLIST_DEBUG = true;

/**
 * Apply proxy to URL if configured
 * @param {string} url 
 * @returns {string}
 */
function applyProxy(url) {
  const proxyUrl = getProxyUrl();
  
  debug('applyProxy() called');
  debug('  Original URL:', url);
  debug('  Proxy URL from storage:', proxyUrl);
  
  if (!proxyUrl) {
    debug('  No proxy configured, returning original');
    return url;
  }
  
  const baseProxy = proxyUrl.endsWith('/') ? proxyUrl : proxyUrl + '/';
  const proxiedUrl = baseProxy + encodeURIComponent(url);
  
  debug('  Final proxied URL:', proxiedUrl);
  return proxiedUrl;
}

// Simple M3U parser (no external dependency to reduce bundle)
// Format: #EXTM3U, #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name\nURL

/**
 * Parse M3U playlist content
 * @param {string} content - M3U content
 * @returns {Array<Object>} - Array of channels
 */
export function parseM3U(content) {
  const channels = [];
  const lines = content.split(/\r?\n/);
  
  let currentChannel = null;
  let id = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      currentChannel = parseExtInf(line, id++);
    } else if (line && !line.startsWith('#') && currentChannel) {
      // This is the URL line
      currentChannel.url = line;
      channels.push(currentChannel);
      currentChannel = null;
    }
  }
  
  return channels;
}

/**
 * Parse EXTINF line attributes
 * @param {string} line 
 * @param {number} id 
 * @returns {Object}
 */
function parseExtInf(line, id) {
  const channel = {
    id: `ch_${id}`,
    name: 'Unknown',
    logo: null,
    group: 'Uncategorized',
    epgId: null,
    url: '',
  };
  
  // Extract attributes using regex
  const tvgId = line.match(/tvg-id="([^"]*)"/i);
  const tvgName = line.match(/tvg-name="([^"]*)"/i);
  const tvgLogo = line.match(/tvg-logo="([^"]*)"/i);
  const groupTitle = line.match(/group-title="([^"]*)"/i);
  
  // Extract channel name (after the comma)
  const nameMatch = line.match(/,(.+)$/);
  
  if (tvgId) channel.epgId = tvgId[1];
  if (tvgName) channel.name = tvgName[1];
  if (tvgLogo) channel.logo = tvgLogo[1];
  if (groupTitle) channel.group = groupTitle[1] || 'Uncategorized';
  if (nameMatch) channel.name = nameMatch[1].trim();
  
  return channel;
}

/**
 * Fetch and parse M3U from URL
 * @param {string} url 
 * @param {Function} onProgress 
 * @returns {Promise<Array>}
 */
export async function fetchM3U(url, onProgress = null) {
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('fetchM3U() called');
  log('═══════════════════════════════════════════════════════════');
  
  const proxyUrl = getProxyUrl();
  const usingProxy = !!proxyUrl;
  
  log('  Original URL:', url);
  log('  Proxy configured:', usingProxy ? 'YES' : 'NO');
  if (usingProxy) log('  Proxy URL:', proxyUrl);
  
  if (onProgress) onProgress(usingProxy ? 'Fetching via proxy...' : 'Fetching playlist...');
  
  // Normalize URL
  const normalizedUrl = normalizeUrl(url);
  log('  Normalized URL:', normalizedUrl);
  
  const finalUrl = applyProxy(normalizedUrl);
  log('  Final fetch URL:', finalUrl);
  
  let response;
  try {
    log('  Initiating fetch...');
    const startTime = performance.now();
    response = await fetch(finalUrl);
    const elapsed = (performance.now() - startTime).toFixed(0);
    
    log('  Response received in', elapsed + 'ms');
    log('  Status:', response.status, response.statusText);
    log('  OK:', response.ok);
    debug('  Response headers:');
    response.headers.forEach((value, key) => {
      debug('    ' + key + ':', value);
    });
    
  } catch (e) {
    error('Network error fetching M3U:', e.name, e.message);
    error('  Stack:', e.stack);
    if (e.message.includes('Failed to fetch')) {
      throw new Error(`Cannot connect to server. Check the URL and your network connection.`);
    }
    throw new Error(`Network error: ${e.message}`);
  }
  
  if (!response.ok) {
    // Try to read error body
    try {
      const errorBody = await response.text();
      error('  Response body:', errorBody.substring(0, 500));
    } catch (bodyErr) {
      // ignore
    }
    throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
  }
  
  if (onProgress) onProgress('Parsing playlist...');
  
  const content = await response.text();
  log('  Content length:', content.length, 'bytes');
  debug('  Content preview:', content.substring(0, 200));
  
  const channels = parseM3U(content);
  log('  Parsed channels:', channels.length);
  
  if (channels.length === 0) {
    error('  No channels found! Content was:', content.substring(0, 500));
    throw new Error('No channels found in playlist');
  }
  
  if (onProgress) onProgress(`Found ${channels.length} channels`);
  
  log('═══════════════════════════════════════════════════════════');
  return channels;
}

/**
 * Read M3U from uploaded file
 * @param {File} file 
 * @param {Function} onProgress 
 * @returns {Promise<Array>}
 */
export async function readM3UFile(file, onProgress = null) {
  if (onProgress) onProgress('Reading file...');
  
  const content = await file.text();
  
  if (onProgress) onProgress('Parsing playlist...');
  
  const channels = parseM3U(content);
  
  if (channels.length === 0) {
    throw new Error('No channels found in file');
  }
  
  if (onProgress) onProgress(`Found ${channels.length} channels`);
  
  return channels;
}

// =============================================================================
// Xtream Codes API
// =============================================================================

/**
 * Fetch channels from Xtream Codes API
 * @param {Object} creds - { server, username, password }
 * @param {Function} onProgress 
 * @returns {Promise<Array>}
 */
export async function fetchXtream(creds, onProgress = null) {
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('fetchXtream() called');
  log('═══════════════════════════════════════════════════════════');
  
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  const proxyUrl = getProxyUrl();
  const usingProxy = !!proxyUrl;
  
  log('  Server:', server);
  log('  Base URL:', baseUrl);
  log('  Username:', username);
  log('  Proxy configured:', usingProxy ? 'YES' : 'NO');
  if (usingProxy) log('  Proxy URL:', proxyUrl);
  
  if (onProgress) onProgress(usingProxy ? 'Connecting via proxy...' : 'Authenticating...');
  
  // Fetch categories first
  const categoriesUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;
  
  log('');
  log('Step 1: Fetching categories...');
  log('  Categories URL:', categoriesUrl);
  
  const finalCategoriesUrl = applyProxy(categoriesUrl);
  log('  Final fetch URL:', finalCategoriesUrl);
  
  let categoriesResponse;
  try {
    log('  Initiating fetch...');
    const startTime = performance.now();
    categoriesResponse = await fetch(finalCategoriesUrl);
    const elapsed = (performance.now() - startTime).toFixed(0);
    
    log('  Response received in', elapsed + 'ms');
    log('  Status:', categoriesResponse.status, categoriesResponse.statusText);
    debug('  Response headers:');
    categoriesResponse.headers.forEach((value, key) => {
      debug('    ' + key + ':', value);
    });
    
  } catch (e) {
    error('Network error fetching categories:', e.name, e.message);
    error('  Stack:', e.stack);
    if (e.message.includes('Failed to fetch')) {
      throw new Error(`Cannot connect to server. Check the URL and your network connection.`);
    }
    throw new Error(`Network error: ${e.message}`);
  }
  
  if (!categoriesResponse.ok) {
    try {
      const errorBody = await categoriesResponse.text();
      error('  Response body:', errorBody.substring(0, 500));
    } catch (bodyErr) {
      // ignore
    }
    throw new Error(`Authentication failed: ${categoriesResponse.status}`);
  }
  
  let categories = [];
  try {
    const responseText = await categoriesResponse.text();
    debug('  Response text preview:', responseText.substring(0, 200));
    categories = JSON.parse(responseText);
    
    if (!Array.isArray(categories)) {
      log('  Response is not an array, checking for error...');
      log('  Response:', JSON.stringify(categories).substring(0, 300));
      
      if (categories.user_info && categories.user_info.status === 'Disabled') {
        throw new Error('Account disabled');
      }
      throw new Error('Invalid response from server');
    }
    
    log('  Categories count:', categories.length);
    
  } catch (e) {
    error('  Parse error:', e.message);
    if (e.message.includes('Account') || e.message.includes('Invalid')) throw e;
    throw new Error('Failed to parse categories response');
  }
  
  if (onProgress) onProgress('Fetching channels...');
  
  // Fetch live streams
  const streamsUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
  
  log('');
  log('Step 2: Fetching streams...');
  log('  Streams URL:', streamsUrl);
  
  const finalStreamsUrl = applyProxy(streamsUrl);
  log('  Final fetch URL:', finalStreamsUrl);
  
  let streamsResponse;
  try {
    log('  Initiating fetch...');
    const startTime = performance.now();
    streamsResponse = await fetch(finalStreamsUrl);
    const elapsed = (performance.now() - startTime).toFixed(0);
    
    log('  Response received in', elapsed + 'ms');
    log('  Status:', streamsResponse.status, streamsResponse.statusText);
    
  } catch (e) {
    error('Network error fetching streams:', e.name, e.message);
    if (e.message.includes('Failed to fetch')) {
      throw new Error(`Cannot connect to server. Check the URL and your network connection.`);
    }
    throw new Error(`Network error: ${e.message}`);
  }
  
  if (!streamsResponse.ok) {
    throw new Error(`Failed to fetch channels: ${streamsResponse.status}`);
  }
  
  let streams = [];
  try {
    streams = await streamsResponse.json();
    if (!Array.isArray(streams)) {
      error('  Streams response is not an array:', streams);
      throw new Error('Invalid streams response');
    }
    log('  Streams count:', streams.length);
  } catch (e) {
    throw new Error('Failed to parse streams response');
  }
  
  if (onProgress) onProgress('Processing channels...');
  
  // Build category map
  const categoryMap = new Map();
  categories.forEach(cat => {
    categoryMap.set(String(cat.category_id), cat.category_name);
  });
  
  // Convert to our channel format
  const channels = streams.map((stream, index) => ({
    id: `xt_${stream.stream_id || index}`,
    name: stream.name || 'Unknown',
    logo: stream.stream_icon || null,
    group: categoryMap.get(String(stream.category_id)) || 'Uncategorized',
    epgId: stream.epg_channel_id || null,
    url: `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`,
    // Store original stream ID for potential future use
    streamId: stream.stream_id,
  }));
  
  log('  Processed channels:', channels.length);
  
  if (channels.length === 0) {
    throw new Error('No channels found');
  }
  
  if (onProgress) onProgress(`Found ${channels.length} channels`);
  
  // Show sample channel
  if (channels.length > 0) {
    log('  Sample channel URL:', channels[0].url);
  }
  
  log('═══════════════════════════════════════════════════════════');
  return channels;
}

/**
 * Get Xtream account info
 * @param {Object} creds 
 * @returns {Promise<Object>}
 */
export async function getXtreamInfo(creds) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to get account info');
  }
  
  return response.json();
}

// =============================================================================
// Storage & Utilities
// =============================================================================

/**
 * Store channels in IndexedDB
 * @param {Array} channels 
 */
export async function storeChannels(channels) {
  await db.set(KEYS.CHANNELS, channels);
}

/**
 * Load channels from IndexedDB
 * @returns {Promise<Array>}
 */
export async function loadChannels() {
  return await db.get(KEYS.CHANNELS) || [];
}

/**
 * Clear stored channels
 */
export async function clearChannels() {
  await db.remove(KEYS.CHANNELS);
}

/**
 * Get unique groups from channels
 * @param {Array} channels 
 * @returns {Array<string>}
 */
export function getGroups(channels) {
  const groups = new Set();
  channels.forEach(ch => groups.add(ch.group));
  return Array.from(groups).sort((a, b) => a.localeCompare(b));
}

/**
 * Filter channels by group
 * @param {Array} channels 
 * @param {string} group 
 * @returns {Array}
 */
export function filterByGroup(channels, group) {
  if (!group || group === '__all__') return channels;
  return channels.filter(ch => ch.group === group);
}

/**
 * Search channels by name
 * @param {Array} channels 
 * @param {string} query 
 * @returns {Array}
 */
export function searchChannels(channels, query) {
  if (!query) return channels;
  const q = query.toLowerCase();
  return channels.filter(ch => ch.name.toLowerCase().includes(q));
}

/**
 * Normalize URL (add protocol if missing, remove trailing slash)
 * @param {string} url 
 * @returns {string}
 */
export function normalizeUrl(url) {
  url = url.trim();
  
  // Add protocol if missing
  if (!url.match(/^https?:\/\//i)) {
    url = 'http://' + url;
  }
  
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  
  return url;
}
