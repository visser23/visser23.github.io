/**
 * Locale Module (Lightweight)
 * Language-prioritized search with pre-compiled patterns
 */

// Compact config: country -> [primary markers], [language family markers]
// Note: 'ENGLISH' is in family markers, not primary - so "CA| ENGLISH" ranks below "UK|" for UK users
const LOCALE_CONFIG = {
  // English-speaking
  GB: [['GB','UK','BRITISH'], ['EN','ENGLISH','US','AU','NZ','CA','IE']],
  US: [['US','USA','AMERICAN'], ['EN','ENGLISH','GB','UK','AU','NZ','CA']],
  AU: [['AU','AUS','AUSTRALIA'], ['EN','ENGLISH','GB','UK','US','NZ','CA']],
  NZ: [['NZ'], ['EN','ENGLISH','GB','UK','US','AU','CA']],
  CA: [['CA','CAN','CANADA'], ['EN','ENGLISH','GB','UK','US','AU','FR']],
  IE: [['IE','IRISH'], ['EN','ENGLISH','GB','UK','US']],
  // European
  DE: [['DE','GER','GERMAN','DEUTSCH'], ['AT','CH']],
  FR: [['FR','FRA','FRENCH'], ['BE','CH','CA']],
  ES: [['ES','ESP','SPANISH','ESPAÑA'], ['MX','LATINO']],
  IT: [['IT','ITA','ITALIAN'], []],
  PT: [['PT','POR','PORTUGAL'], ['BR']],
  BR: [['BR','BRA','BRASIL'], ['PT','POR']],
  NL: [['NL','NED','DUTCH'], ['BE']],
  PL: [['PL','POL','POLISH'], []],
  RU: [['RU','RUS','RUSSIAN'], ['UA','BY']],
  UA: [['UA','UKR'], ['RU']],
  TR: [['TR','TUR','TURKISH'], []],
  GR: [['GR','GRE','GREEK'], ['CY']],
  SE: [['SE','SWE','SWEDISH'], ['NO','DK','FI']],
  NO: [['NO','NOR','NORWEGIAN'], ['SE','DK']],
  DK: [['DK','DAN','DANISH'], ['SE','NO']],
  FI: [['FI','FIN','FINNISH'], []],
  RO: [['RO','ROM','ROMANIAN'], []],
  HU: [['HU','HUN','HUNGARIAN'], []],
  CZ: [['CZ','CZE','CZECH'], ['SK']],
  // Middle East / Asia
  SA: [['SA','KSA','SAUDI'], ['AR','ARA','ARABIC','AE','EG']],
  AE: [['AE','UAE','EMIRATES'], ['AR','ARA','ARABIC','SA','EG']],
  IN: [['IN','IND','INDIA','HINDI','BOLLYWOOD'], []],
  JP: [['JP','JPN','JAPAN','ANIME'], []],
  KR: [['KR','KOR','KOREAN'], []],
  CN: [['CN','CHN','CHINESE'], ['TW','HK']],
  MX: [['MX','MEX','MEXICO'], ['ES','ESP','LATINO']],
};

// Pre-compiled patterns (built once when country changes)
let primaryPattern = null;   // Exact country match
let familyPattern = null;    // Same language family
let foreignPattern = null;   // Other languages (to deprioritize)

// State
let activeCountry = 'GB';
const STORAGE_KEY = 'simpleiptv_locale';

/**
 * Build regex pattern from marker array
 */
function buildPattern(markers) {
  if (!markers.length) return null;
  // Match markers with word boundaries or brackets: [UK] (UK) |UK|
  const escaped = markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b|[\\[\\(\\|](${escaped.join('|')})[\\]\\)\\|]`, 'i');
}

/**
 * Rebuild patterns for current country
 */
function rebuildPatterns() {
  const config = LOCALE_CONFIG[activeCountry] || LOCALE_CONFIG.GB;
  const [primary, family] = config;
  
  // Primary: exact country markers
  primaryPattern = buildPattern(primary);
  
  // Family: country + language family
  familyPattern = buildPattern([...primary, ...family]);
  
  // Foreign: all markers NOT in our family (for deprioritizing)
  const familySet = new Set([...primary, ...family]);
  const foreign = [];
  for (const [, [p, f]] of Object.entries(LOCALE_CONFIG)) {
    p.forEach(m => { if (!familySet.has(m)) foreign.push(m); });
    f.forEach(m => { if (!familySet.has(m)) foreign.push(m); });
  }
  foreignPattern = buildPattern([...new Set(foreign)]);
}

/**
 * Initialize - sync, no network calls
 */
export function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const browserDetected = detectFromBrowser();
  
  if (stored) {
    try { 
      const parsed = JSON.parse(stored);
      // Explicit override takes priority, otherwise use browser detection
      activeCountry = parsed.country || browserDetected;
      console.log('[Locale] Stored override:', parsed.country || 'none (auto-detect)');
    }
    catch { 
      activeCountry = browserDetected; 
      console.log('[Locale] Failed to parse stored settings, using browser');
    }
  } else {
    activeCountry = browserDetected;
    console.log('[Locale] No stored settings, using browser detection');
  }
  
  rebuildPatterns();
  console.log('[Locale] Ready:', activeCountry, '| Browser detected:', browserDetected);
}

function detectFromBrowser() {
  const lang = navigator.language || '';
  const parts = lang.split('-');
  if (parts[1] && LOCALE_CONFIG[parts[1].toUpperCase()]) return parts[1].toUpperCase();
  const map = {en:'GB',de:'DE',fr:'FR',es:'ES',it:'IT',pt:'PT',nl:'NL',pl:'PL',ru:'RU',ar:'SA',ja:'JP',ko:'KR',zh:'CN',tr:'TR'};
  return map[parts[0]] || 'GB';
}

export function getActiveCountry() { return activeCountry; }
export function getCountryOverride() { 
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) try { return JSON.parse(stored).country || null; } catch { return null; }
  return null;
}

export function setCountryOverride(code) {
  const previousCountry = activeCountry;
  activeCountry = code ? code.toUpperCase() : detectFromBrowser();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ country: code || null }));
  rebuildPatterns();
  console.log('[Locale] Override changed:', previousCountry, '->', activeCountry, '| Stored:', code || 'null (auto-detect)');
}

/**
 * Get sort score for an item (higher = better match)
 * Call ONCE per item, then sort by score
 */
export function getScore(name) {
  if (!name) return 0;
  if (primaryPattern?.test(name)) return 3;  // Exact country
  if (familyPattern?.test(name)) return 2;   // Language family
  if (foreignPattern?.test(name)) return 0;  // Foreign language
  return 1; // Unmarked
}

/**
 * Pre-compute and CACHE locale scores on items (call once at load time)
 * This avoids re-calculating scores on every sort/filter operation
 * @param {Array} items - Array of items with 'name' property
 * @param {Function} getName - Optional function to extract name
 */
export function cacheScores(items, getName = null) {
  if (!items || items.length === 0) return;
  
  const extractName = getName || (item => typeof item === 'string' ? item : (item.name || ''));
  
  items.forEach(item => {
    const name = extractName(item);
    // Use underscore prefix to indicate cached/internal property
    item._localeScore = getScore(name);
    item._isLowPriority = isLowPriority(name);
  });
  
  console.log(`[Locale] Cached scores for ${items.length} items`);
}

// Patterns for low-priority content (4K, 24/7)
const LOW_PRIORITY_PATTERN = /\b(4K|UHD|24\/7|24-7)\b/i;

/**
 * Check if item should be deprioritized (4K, 24/7 content)
 */
export function isLowPriority(name) {
  if (!name) return false;
  return LOW_PRIORITY_PATTERN.test(name);
}

/**
 * Sort an array of items by locale preference
 * Uses CACHED scores if available (from cacheScores()), otherwise calculates on-the-fly
 * @param {Array} items - Array of items with 'name' property (or strings)
 * @param {Function} getName - Optional function to extract name from item (default: item.name or item)
 * @returns {Array} - Sorted array (mutates original)
 */
export function sortByLocale(items, getName = null) {
  if (!items || items.length === 0) return items;
  
  const extractName = getName || (item => typeof item === 'string' ? item : (item.name || ''));
  
  // Check if scores are already cached (first item has _localeScore)
  const scoresAreCached = items.length > 0 && typeof items[0]._localeScore === 'number';
  
  // Only calculate scores if not cached
  if (!scoresAreCached) {
    items.forEach(item => {
      const name = extractName(item);
      item._localeScore = getScore(name);
      item._isLowPriority = isLowPriority(name);
    });
  }
  
  // Sort: low-priority last > locale score > alphabetical
  items.sort((a, b) => {
    // 1. Low-priority items (4K, 24/7) go to the end
    if (a._isLowPriority && !b._isLowPriority) return 1;
    if (!a._isLowPriority && b._isLowPriority) return -1;
    
    // 2. Locale score (higher = better)
    const scoreDiff = (b._localeScore || 0) - (a._localeScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    
    // 3. Alphabetical fallback
    const aName = extractName(a).toLowerCase();
    const bName = extractName(b).toLowerCase();
    return aName.localeCompare(bName);
  });
  
  // Only clean up if we calculated them (not cached)
  // Cached scores persist for future sorts
  if (!scoresAreCached) {
    items.forEach(item => {
      delete item._localeScore;
      delete item._isLowPriority;
    });
  }
  
  return items;
}

/**
 * Sort groups/categories by locale preference
 * @param {Array<string>} groups - Array of group names
 * @returns {Array<string>} - Sorted array
 */
export function sortGroups(groups) {
  if (!groups || groups.length === 0) return groups;
  
  // Create wrapper objects for sorting
  const wrapped = groups.map(g => ({ name: g, _original: g }));
  sortByLocale(wrapped);
  return wrapped.map(w => w._original);
}

// Legacy API (for compatibility) - use getScore() instead for bulk operations
export function isExactCountryMatch(name) { return primaryPattern?.test(name) || false; }
export function isPreferredLanguage(name) { return familyPattern?.test(name) || false; }
export function isNonPreferredLanguage(name) { return foreignPattern?.test(name) && !familyPattern?.test(name); }
