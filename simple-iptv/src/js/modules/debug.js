/**
 * Debug Module
 * Controls console logging for production performance
 * 
 * Enable debug mode by setting localStorage.simpleiptv_debug = 'true'
 * or adding ?debug=true to the URL
 * 
 * When debug is DISABLED:
 * - console.log is replaced with a no-op (silent)
 * - console.warn and console.error still work
 * 
 * When debug is ENABLED:
 * - All console methods work normally
 */

// Check for debug mode
const DEBUG_STORAGE_KEY = 'simpleiptv_debug';
const urlParams = new URLSearchParams(window.location.search);
const debugFromUrl = urlParams.get('debug') === 'true';
const debugFromStorage = localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';

export const DEBUG_ENABLED = debugFromUrl || debugFromStorage;

// Save URL debug flag to storage for persistence
if (debugFromUrl && !debugFromStorage) {
  localStorage.setItem(DEBUG_STORAGE_KEY, 'true');
}

// Store original console.log
const originalConsoleLog = console.log.bind(console);

/**
 * PRODUCTION MODE: Silence console.log when debug is disabled
 * This prevents 175+ log statements from running in production
 */
if (!DEBUG_ENABLED) {
  // Replace console.log with a no-op
  console.log = function() {};
  
  // Single startup message using original log
  originalConsoleLog('[SimpleIPTV] Production mode - logging disabled. Add ?debug=true to URL to enable.');
} else {
  originalConsoleLog('[Debug] Debug mode ENABLED - verbose logging active');
  originalConsoleLog('[Debug] To disable: localStorage.removeItem("simpleiptv_debug") and refresh');
}

/**
 * Force log even in production (use sparingly for critical info)
 * @param  {...any} args - Arguments to log
 */
export function forceLog(...args) {
  originalConsoleLog(...args);
}

/**
 * Conditional log - respects debug flag
 * @param  {...any} args - Arguments to log
 */
export function debug(...args) {
  if (DEBUG_ENABLED) {
    originalConsoleLog(...args);
  }
}

/**
 * Always logs warnings
 * @param  {...any} args - Arguments to log
 */
export function warn(...args) {
  console.warn(...args);
}

/**
 * Always logs errors  
 * @param  {...any} args - Arguments to log
 */
export function error(...args) {
  console.error(...args);
}
