/**
 * Playlist Module
 * Handles M3U parsing and Xtream Codes API
 * 
 * DEBUG MODE: Set window.PLAYLIST_DEBUG = true for verbose logging
 */

import { db, KEYS, applyProxyToUrl } from './storage.js';

// Debug logging - disabled in production, enable via console: window.PLAYLIST_DEBUG = true
const DEBUG = () => window.PLAYLIST_DEBUG === true;
const log = (...args) => DEBUG() && console.log('[Playlist]', ...args);
const debug = (...args) => DEBUG() && console.log('[Playlist:DEBUG]', ...args);
const error = (...args) => console.error('[Playlist]', ...args);

// Use centralized proxy function
const applyProxy = applyProxyToUrl;

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
// VOD (Movies) API
// =============================================================================

/**
 * Fetch VOD categories from Xtream API
 * @param {Object} creds - { server, username, password }
 * @returns {Promise<Array>} - Array of category objects
 */
export async function fetchVodCategories(creds) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`;
  
  const response = await fetch(applyProxy(url));
  if (!response.ok) throw new Error('Failed to fetch VOD categories');
  
  const categories = await response.json();
  return Array.isArray(categories) ? categories : [];
}

/**
 * Fetch VOD streams for a specific category (or all if no category)
 * @param {Object} creds - { server, username, password }
 * @param {string|null} categoryId - Category ID to filter by (null for all)
 * @returns {Promise<Array>} - Array of VOD items
 */
export async function fetchVodStreams(creds, categoryId = null) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  
  let url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
  
  // Filter by category for performance - don't load all 50k movies!
  if (categoryId) {
    url += `&category_id=${encodeURIComponent(categoryId)}`;
  }
  
  const response = await fetch(applyProxy(url));
  if (!response.ok) throw new Error('Failed to fetch VOD streams');
  
  const streams = await response.json();
  if (!Array.isArray(streams)) return [];
  
  // Normalize VOD data to common format
  return streams.map(vod => ({
    id: vod.stream_id || vod.num,
    name: vod.name,
    logo: vod.stream_icon || vod.cover || '',
    group: vod.category_id,
    url: buildVodUrl(baseUrl, username, password, vod.stream_id, vod.container_extension),
    type: 'vod',
    // VOD-specific fields
    year: vod.year || vod.releaseDate?.split('-')[0] || '',
    rating: vod.rating || '',
    duration: vod.duration || '',
    plot: vod.plot || '',
    cast: vod.cast || '',
    director: vod.director || '',
    genre: vod.genre || '',
    containerExtension: vod.container_extension || 'mp4'
  }));
}

/**
 * Build VOD stream URL
 */
function buildVodUrl(baseUrl, username, password, streamId, extension = 'mp4') {
  return `${baseUrl}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${extension}`;
}

// =============================================================================
// Series API
// =============================================================================

/**
 * Fetch Series categories from Xtream API
 * @param {Object} creds - { server, username, password }
 * @returns {Promise<Array>} - Array of category objects
 */
export async function fetchSeriesCategories(creds) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_categories`;
  
  const response = await fetch(applyProxy(url));
  if (!response.ok) throw new Error('Failed to fetch series categories');
  
  const categories = await response.json();
  return Array.isArray(categories) ? categories : [];
}

/**
 * Fetch Series list for a specific category (or all if no category)
 * @param {Object} creds - { server, username, password }
 * @param {string|null} categoryId - Category ID to filter by (null for all)
 * @returns {Promise<Array>} - Array of series
 */
export async function fetchSeriesList(creds, categoryId = null) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  
  let url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;
  
  // Filter by category for performance
  if (categoryId) {
    url += `&category_id=${encodeURIComponent(categoryId)}`;
  }
  
  const response = await fetch(applyProxy(url));
  if (!response.ok) throw new Error('Failed to fetch series');
  
  const series = await response.json();
  if (!Array.isArray(series)) return [];
  
  // Normalize series data
  return series.map(s => ({
    id: s.series_id,
    name: s.name,
    logo: s.cover || '',
    group: s.category_id,
    type: 'series',
    // Series-specific fields
    year: s.year || s.releaseDate?.split('-')[0] || '',
    rating: s.rating || '',
    plot: s.plot || '',
    cast: s.cast || '',
    director: s.director || '',
    genre: s.genre || '',
    episodeCount: s.episode_run_time || s.num || ''
  }));
}

/**
 * Fetch Series info (seasons and episodes)
 * @param {Object} creds - { server, username, password }
 * @param {string} seriesId - Series ID
 * @returns {Promise<Object>} - Series info with seasons/episodes
 */
export async function fetchSeriesInfo(creds, seriesId) {
  const { server, username, password } = creds;
  const baseUrl = normalizeUrl(server);
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  
  const response = await fetch(applyProxy(url));
  if (!response.ok) throw new Error('Failed to fetch series info');
  
  const info = await response.json();
  
  // Build episodes with URLs
  const episodes = [];
  if (info.episodes) {
    for (const [seasonNum, seasonEpisodes] of Object.entries(info.episodes)) {
      for (const ep of seasonEpisodes) {
        episodes.push({
          id: ep.id,
          name: ep.title || `Episode ${ep.episode_num}`,
          season: parseInt(seasonNum),
          episode: ep.episode_num,
          url: buildSeriesUrl(baseUrl, username, password, ep.id, ep.container_extension),
          logo: ep.info?.movie_image || info.info?.cover || '',
          plot: ep.info?.plot || '',
          duration: ep.info?.duration || '',
          rating: ep.info?.rating || '',
          containerExtension: ep.container_extension || 'mp4'
        });
      }
    }
  }
  
  return {
    info: info.info || {},
    seasons: info.seasons || [],
    episodes: episodes.sort((a, b) => (a.season - b.season) || (a.episode - b.episode))
  };
}

/**
 * Build Series episode stream URL
 */
function buildSeriesUrl(baseUrl, username, password, episodeId, extension = 'mp4') {
  return `${baseUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${episodeId}.${extension}`;
}

// =============================================================================
// VOD/Series Storage
// =============================================================================

const VOD_CATEGORIES_KEY = 'vod_categories';
const VOD_STREAMS_KEY = 'vod_streams';
const SERIES_CATEGORIES_KEY = 'series_categories';
const SERIES_LIST_KEY = 'series_list';

/**
 * Store VOD categories
 */
export async function storeVodCategories(categories) {
  await db.set(VOD_CATEGORIES_KEY, categories);
}

/**
 * Load VOD categories
 */
export async function loadVodCategories() {
  return await db.get(VOD_CATEGORIES_KEY) || [];
}

/**
 * Store VOD streams for a category
 */
export async function storeVodStreams(categoryId, streams) {
  const key = `${VOD_STREAMS_KEY}_${categoryId || 'all'}`;
  await db.set(key, streams);
}

/**
 * Load VOD streams for a category
 */
export async function loadVodStreams(categoryId) {
  const key = `${VOD_STREAMS_KEY}_${categoryId || 'all'}`;
  return await db.get(key) || null;
}

/**
 * Store Series categories
 */
export async function storeSeriesCategories(categories) {
  await db.set(SERIES_CATEGORIES_KEY, categories);
}

/**
 * Load Series categories
 */
export async function loadSeriesCategories() {
  return await db.get(SERIES_CATEGORIES_KEY) || [];
}

/**
 * Store Series list for a category
 */
export async function storeSeriesList(categoryId, series) {
  const key = `${SERIES_LIST_KEY}_${categoryId || 'all'}`;
  await db.set(key, series);
}

/**
 * Load Series list for a category
 */
export async function loadSeriesList(categoryId) {
  const key = `${SERIES_LIST_KEY}_${categoryId || 'all'}`;
  return await db.get(key) || null;
}

/**
 * Clear all VOD/Series cached data
 */
export async function clearVodSeriesCache() {
  // Clear categories
  await db.remove(VOD_CATEGORIES_KEY);
  await db.remove(SERIES_CATEGORIES_KEY);
  // Note: Individual category streams would need to be cleared separately
  // This is a basic implementation - could be enhanced with a key prefix scan
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
