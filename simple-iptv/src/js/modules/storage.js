/**
 * Storage Module
 * Handles localStorage for settings and IndexedDB (via idb-keyval) for large data
 */

// Import idb-keyval from CDN
import { get, set, del, clear, keys } from 'https://esm.sh/idb-keyval@6.2.1';

const STORAGE_PREFIX = 'simple-iptv:';
const STORAGE_VERSION = 1;

// Keys
export const KEYS = {
  CREDENTIALS: 'credentials',
  SETTINGS: 'settings',
  FAVORITES: 'favorites',
  RECENTS: 'recents',
  LAST_CHANNEL: 'lastChannel',
  CHANNELS: 'channels',        // IndexedDB
  EPG: 'epg',                  // IndexedDB
  EPG_LAST_UPDATE: 'epgLastUpdate',
};

/**
 * Local Storage helpers (for small data: settings, credentials, preferences)
 */
export const local = {
  /**
   * Get item from localStorage
   * @param {string} key 
   * @returns {*}
   */
  get(key) {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn(`[Storage] Failed to get ${key}:`, e);
      return null;
    }
  },

  /**
   * Set item in localStorage
   * @param {string} key 
   * @param {*} value 
   */
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] Failed to set ${key}:`, e);
      return false;
    }
  },

  /**
   * Remove item from localStorage
   * @param {string} key 
   */
  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to remove ${key}:`, e);
      return false;
    }
  },

  /**
   * Clear all app data from localStorage
   */
  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (e) {
      console.error('[Storage] Failed to clear localStorage:', e);
      return false;
    }
  }
};

/**
 * IndexedDB helpers (for large data: channels, EPG)
 */
export const db = {
  /**
   * Get item from IndexedDB
   * @param {string} key 
   * @returns {Promise<*>}
   */
  async get(key) {
    try {
      return await get(STORAGE_PREFIX + key);
    } catch (e) {
      console.warn(`[Storage/IDB] Failed to get ${key}:`, e);
      return null;
    }
  },

  /**
   * Set item in IndexedDB
   * @param {string} key 
   * @param {*} value 
   */
  async set(key, value) {
    try {
      await set(STORAGE_PREFIX + key, value);
      return true;
    } catch (e) {
      console.error(`[Storage/IDB] Failed to set ${key}:`, e);
      return false;
    }
  },

  /**
   * Remove item from IndexedDB
   * @param {string} key 
   */
  async remove(key) {
    try {
      await del(STORAGE_PREFIX + key);
      return true;
    } catch (e) {
      console.warn(`[Storage/IDB] Failed to remove ${key}:`, e);
      return false;
    }
  },

  /**
   * Clear all app data from IndexedDB
   */
  async clear() {
    try {
      const allKeys = await keys();
      const appKeys = allKeys.filter(k => 
        typeof k === 'string' && k.startsWith(STORAGE_PREFIX)
      );
      await Promise.all(appKeys.map(k => del(k)));
      return true;
    } catch (e) {
      console.error('[Storage/IDB] Failed to clear:', e);
      return false;
    }
  }
};

/**
 * Clear ALL stored data (localStorage + IndexedDB)
 */
export async function clearAllData() {
  const localCleared = local.clear();
  const dbCleared = await db.clear();
  return localCleared && dbCleared;
}

/**
 * Export all settings as JSON (for backup)
 */
export async function exportData() {
  const data = {
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    settings: local.get(KEYS.SETTINGS),
    credentials: local.get(KEYS.CREDENTIALS),
    favorites: local.get(KEYS.FAVORITES) || [],
    recents: local.get(KEYS.RECENTS) || [],
  };
  return data;
}

/**
 * Import settings from JSON
 * @param {Object} data 
 */
export function importData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid import data');
  }
  
  if (data.settings) local.set(KEYS.SETTINGS, data.settings);
  if (data.credentials) local.set(KEYS.CREDENTIALS, data.credentials);
  if (data.favorites) local.set(KEYS.FAVORITES, data.favorites);
  if (data.recents) local.set(KEYS.RECENTS, data.recents);
  
  return true;
}

// Favorites helpers
export function getFavorites() {
  return local.get(KEYS.FAVORITES) || [];
}

export function setFavorites(favorites) {
  return local.set(KEYS.FAVORITES, favorites);
}

export function toggleFavorite(channelId) {
  const favorites = getFavorites();
  const index = favorites.indexOf(channelId);
  if (index === -1) {
    favorites.push(channelId);
  } else {
    favorites.splice(index, 1);
  }
  setFavorites(favorites);
  return index === -1; // Returns true if added, false if removed
}

export function isFavorite(channelId) {
  return getFavorites().includes(channelId);
}

// Recents helpers
const MAX_RECENTS = 10;

export function getRecents() {
  return local.get(KEYS.RECENTS) || [];
}

export function addRecent(channelId) {
  let recents = getRecents();
  // Remove if already exists
  recents = recents.filter(id => id !== channelId);
  // Add to front
  recents.unshift(channelId);
  // Trim to max
  recents = recents.slice(0, MAX_RECENTS);
  local.set(KEYS.RECENTS, recents);
  return recents;
}

// Settings helpers
export function getSettings() {
  return local.get(KEYS.SETTINGS) || {
    vaultEnabled: false,
    proxyUrl: null,
  };
}

/**
 * Get proxy URL if configured
 * @returns {string|null}
 */
export function getProxyUrl() {
  const settings = getSettings();
  return settings.proxyUrl || null;
}

/**
 * Set proxy URL
 * @param {string|null} url
 */
export function setProxyUrl(url) {
  updateSettings({ proxyUrl: url || null });
}

/**
 * Apply proxy to any URL if proxy is configured
 * @param {string} url - The URL to potentially proxy
 * @param {boolean} force - Force proxy even for same-origin URLs
 * @returns {string} - Proxied URL or original if no proxy configured
 */
export function applyProxyToUrl(url) {
  const proxyUrl = getProxyUrl();
  
  // No proxy configured, return original
  if (!proxyUrl) return url;
  
  // Don't proxy data URLs or blob URLs
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  // Don't proxy if already proxied
  if (url.includes(proxyUrl)) return url;
  
  // Only proxy http/https URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
  
  // Apply proxy
  const baseProxy = proxyUrl.endsWith('/') ? proxyUrl : proxyUrl + '/';
  return baseProxy + encodeURIComponent(url);
}

export function setSettings(settings) {
  return local.set(KEYS.SETTINGS, settings);
}

export function updateSettings(updates) {
  const current = getSettings();
  return setSettings({ ...current, ...updates });
}
