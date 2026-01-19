/**
 * EPG Module
 * Handles XMLTV parsing using a Web Worker for performance
 */

import { db, local, KEYS } from './storage.js';

let epgWorker = null;
let epgData = new Map(); // channelId -> programs[]
let isLoading = false;

// Event callbacks
const listeners = {
  onProgress: [],
  onComplete: [],
  onError: [],
};

/**
 * Initialize EPG worker
 */
function initWorker() {
  if (epgWorker) return;
  
  const workerUrl = new URL('../workers/epg-worker.js', import.meta.url);
  epgWorker = new Worker(workerUrl, { type: 'module' });
  
  epgWorker.onmessage = (e) => {
    const { type, data } = e.data;
    
    switch (type) {
      case 'progress':
        emit('onProgress', data);
        break;
      case 'batch':
        // Store batch of programs
        processBatch(data);
        break;
      case 'complete':
        isLoading = false;
        saveEpgToStorage();
        emit('onComplete', { total: epgData.size });
        break;
      case 'error':
        isLoading = false;
        emit('onError', { message: data.message });
        break;
    }
  };
  
  epgWorker.onerror = (e) => {
    isLoading = false;
    emit('onError', { message: e.message || 'Worker error' });
  };
}

/**
 * Process a batch of programs from worker
 * @param {Array} programs 
 */
function processBatch(programs) {
  for (const program of programs) {
    const channelId = program.channelId;
    if (!epgData.has(channelId)) {
      epgData.set(channelId, []);
    }
    epgData.get(channelId).push(program);
  }
}

/**
 * Load EPG from XMLTV URL
 * @param {string} url - XMLTV URL
 */
export async function loadFromUrl(url) {
  if (isLoading) {
    console.warn('[EPG] Already loading');
    return;
  }
  
  isLoading = true;
  epgData.clear();
  
  initWorker();
  
  epgWorker.postMessage({ type: 'load', url });
}

/**
 * Load EPG from cached data
 */
export async function loadFromCache() {
  const cached = await db.get(KEYS.EPG);
  if (cached && cached.data) {
    epgData = new Map(Object.entries(cached.data));
    emit('onComplete', { total: epgData.size, fromCache: true });
    return true;
  }
  return false;
}

/**
 * Save EPG to IndexedDB
 */
async function saveEpgToStorage() {
  const data = Object.fromEntries(epgData);
  await db.set(KEYS.EPG, { data, timestamp: Date.now() });
  local.set(KEYS.EPG_LAST_UPDATE, Date.now());
}

/**
 * Get current program for a channel
 * @param {string} channelId - EPG channel ID
 * @returns {Object|null}
 */
export function getNow(channelId) {
  const programs = epgData.get(channelId);
  if (!programs || programs.length === 0) return null;
  
  const now = Date.now();
  return programs.find(p => p.start <= now && p.end > now) || null;
}

/**
 * Get next program for a channel
 * @param {string} channelId 
 * @returns {Object|null}
 */
export function getNext(channelId) {
  const programs = epgData.get(channelId);
  if (!programs || programs.length === 0) return null;
  
  const now = Date.now();
  const sortedFuture = programs
    .filter(p => p.start > now)
    .sort((a, b) => a.start - b.start);
  
  return sortedFuture[0] || null;
}

/**
 * Get now and next for a channel
 * @param {string} channelId 
 * @returns {{ now: Object|null, next: Object|null }}
 */
export function getNowNext(channelId) {
  return {
    now: getNow(channelId),
    next: getNext(channelId),
  };
}

/**
 * Get all programs for a channel
 * @param {string} channelId 
 * @returns {Array}
 */
export function getPrograms(channelId) {
  return epgData.get(channelId) || [];
}

/**
 * Check if EPG is loaded
 * @returns {boolean}
 */
export function isLoaded() {
  return epgData.size > 0;
}

/**
 * Check if EPG is loading
 * @returns {boolean}
 */
export function getIsLoading() {
  return isLoading;
}

/**
 * Get last update timestamp
 * @returns {number|null}
 */
export function getLastUpdate() {
  return local.get(KEYS.EPG_LAST_UPDATE);
}

/**
 * Clear EPG data
 */
export async function clear() {
  epgData.clear();
  await db.remove(KEYS.EPG);
  local.remove(KEYS.EPG_LAST_UPDATE);
}

/**
 * Terminate worker
 */
export function terminate() {
  if (epgWorker) {
    epgWorker.terminate();
    epgWorker = null;
  }
}

/**
 * Format time for display
 * @param {number} timestamp 
 * @returns {string}
 */
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get progress percentage for current program
 * @param {Object} program 
 * @returns {number} - 0 to 100
 */
export function getProgress(program) {
  if (!program) return 0;
  
  const now = Date.now();
  const duration = program.end - program.start;
  const elapsed = now - program.start;
  
  return Math.min(100, Math.max(0, (elapsed / duration) * 100));
}

// =============================================================================
// Event system
// =============================================================================

/**
 * Subscribe to events
 * @param {string} event - 'onProgress' | 'onComplete' | 'onError'
 * @param {Function} callback 
 * @returns {Function} - Unsubscribe function
 */
export function on(event, callback) {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
  return () => off(event, callback);
}

/**
 * Unsubscribe from events
 * @param {string} event 
 * @param {Function} callback 
 */
export function off(event, callback) {
  if (listeners[event]) {
    const idx = listeners[event].indexOf(callback);
    if (idx !== -1) listeners[event].splice(idx, 1);
  }
}

/**
 * Emit event
 * @param {string} event 
 * @param {*} data 
 */
function emit(event, data) {
  if (listeners[event]) {
    listeners[event].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[EPG] Error in ${event} listener:`, e);
      }
    });
  }
}
