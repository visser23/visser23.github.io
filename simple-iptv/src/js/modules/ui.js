/**
 * UI Module
 * Handles DOM manipulation, event binding, and virtual scrolling
 */

import * as storage from './storage.js';
import { applyProxyToUrl } from './storage.js';
import * as epg from './epg.js';

// DOM element references
let elements = {};

// State
let channels = [];
let filteredChannels = [];
let currentCategory = '__all__';
let searchQuery = '';
let selectedChannelId = null;

// Content type state
let currentContentType = 'live';
let vodSeriesCategories = []; // Categories for current VOD/Series view
let currentItems = []; // Items for current VOD/Series category

// Global search state - holds ALL searchable content across all types
let allSearchableItems = []; // Combined: channels + movies + series
let isGlobalSearchActive = false; // True when search results span all types

// Search overlay state
let searchOverlayActive = false;
let searchOverlayQuery = '';
let searchOverlayFilter = 'all'; // 'all', 'live', 'vod', 'series'
let searchOverlayResults = [];
let imageObserver = null; // IntersectionObserver for lazy loading images
const MAX_SEARCH_RESULTS = 200; // Limit for performance

// Locale module reference (for language-prioritized search)
let localeModule = null;

// Virtual scrolling state (channel list)
const ITEM_HEIGHT = 48;
const BUFFER_SIZE = 10;
let scrollTop = 0;
let viewportHeight = 0;

// Virtual scrolling state (content grid)
const GRID_CARD_MIN_WIDTH = 180;    // Matches CSS minmax(180px, 1fr)
const GRID_GAP = 16;                // var(--space-4)
const GRID_CARD_ASPECT_RATIO = 1.7; // Approximate height/width including text
const GRID_BUFFER_ROWS = 2;
const GRID_VIRTUALIZE_THRESHOLD = 50; // Only virtualize if more items
let contentGridScrollTop = 0;
let contentGridViewportHeight = 0;
let contentGridViewportWidth = 0;
let contentGridColumns = 4;
let contentGridCardWidth = 180;
let contentGridRowHeight = 306;
let contentGridInitialized = false;

// Callbacks
let onChannelSelect = null;
let onFavoriteToggle = null;

/**
 * Initialize UI
 * @param {Object} callbacks - { onChannelSelect, onFavoriteToggle }
 */
export function init(callbacks = {}) {
  onChannelSelect = callbacks.onChannelSelect || (() => {});
  onFavoriteToggle = callbacks.onFavoriteToggle || (() => {});
  
  // Cache DOM elements
  elements = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    categoryGroups: document.getElementById('category-groups'),
    channelViewport: document.getElementById('channel-viewport'),
    channelContent: document.getElementById('channel-content'),
    
    // EPG View elements
    epgView: document.getElementById('epg-view'),
    contentGrid: document.getElementById('content-grid'),
    contentGridInner: document.getElementById('content-grid-inner'),
    channelList: document.getElementById('channel-list'),
    
    // Now Playing Panel
    nowPlayingPanel: document.getElementById('now-playing-panel'),
    channelLogo: document.getElementById('channel-logo'),
    channelLogoPlaceholder: document.getElementById('channel-logo-placeholder'),
    panelChannelName: document.getElementById('panel-channel-name'),
    panelCategory: document.getElementById('panel-category'),
    panelEpg: document.getElementById('panel-epg'),
    panelEpgNow: document.getElementById('panel-epg-now'),
    panelEpgNext: document.getElementById('panel-epg-next'),
    panelEpgNextTime: document.getElementById('panel-epg-next-time'),
    panelEpgProgress: document.getElementById('panel-epg-progress'),
    panelVod: document.getElementById('panel-vod'),
    panelVodDuration: document.getElementById('panel-vod-duration'),
    panelVodYear: document.getElementById('panel-vod-year'),
    panelVodRating: document.getElementById('panel-vod-rating'),
    
    // Counts
    countAll: document.getElementById('count-all'),
    countFavorites: document.getElementById('count-favorites'),
    countRecents: document.getElementById('count-recents'),
    
    // Search (sidebar - triggers overlay)
    searchInput: document.getElementById('search-input'),
    
    // Search Overlay
    searchOverlay: document.getElementById('search-overlay'),
    searchOverlayInput: document.getElementById('search-overlay-input'),
    searchOverlayClear: document.getElementById('search-overlay-clear'),
    searchOverlayClose: document.getElementById('search-overlay-close'),
    searchFilters: document.getElementById('search-filters'),
    searchInfo: document.getElementById('search-info'),
    searchResultCount: document.getElementById('search-result-count'),
    searchLoadingIndicator: document.getElementById('search-loading-indicator'),
    searchResults: document.getElementById('search-results'),
    searchGrid: document.getElementById('search-grid'),
    searchLoading: document.getElementById('search-loading'),
    searchEmpty: document.getElementById('search-empty'),
    searchInitial: document.getElementById('search-initial'),
    
    // Player area
    onboarding: document.getElementById('onboarding'),
    player: document.getElementById('player'),
    playerLoading: document.getElementById('player-loading'),
    playerError: document.getElementById('player-error'),
    errorMessage: document.getElementById('error-message'),
    nowPlaying: document.getElementById('now-playing'),
    
    // EPG (player controls)
    epgNowTitle: document.getElementById('epg-now-title'),
    epgNextTitle: document.getElementById('epg-next-title'),
    epgNextTime: document.getElementById('epg-next-time'),
    epgProgressFill: document.getElementById('epg-progress-fill'),
    
    // Toasts
    toastContainer: document.getElementById('toast-container'),
    
    // Templates (PERF: cloning is faster than innerHTML parsing)
    channelRowTemplate: document.getElementById('channel-row-template'),
    searchCardTemplate: document.getElementById('search-card-template'),
  };
  
  // Initialize image lazy loading observer
  initImageObserver();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize virtual scrolling
  initVirtualScroll();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search input in header - clicking opens overlay
  elements.searchInput?.addEventListener('focus', () => {
    enterSearchMode();
  });
  elements.searchInput?.addEventListener('click', () => {
    enterSearchMode();
  });
  
  // Search overlay events
  elements.searchOverlayInput?.addEventListener('input', debounce(handleOverlaySearch, 150));
  elements.searchOverlayClear?.addEventListener('click', clearOverlaySearch);
  elements.searchOverlayClose?.addEventListener('click', exitSearchMode);
  
  // Filter tabs
  elements.searchFilters?.querySelectorAll('.search-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      setSearchFilter(btn.dataset.filter);
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);
  
  // Category buttons
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.category));
  });
  
  // Mobile sidebar toggle
  elements.sidebarToggle?.addEventListener('click', toggleSidebar);
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        elements.sidebar?.classList.contains('sidebar--open') &&
        !elements.sidebar.contains(e.target) &&
        e.target !== elements.sidebarToggle) {
      closeSidebar();
    }
  });
  
  // PERF: Event delegation for search overlay grid
  initSearchOverlayDelegation();
}

/**
 * Initialize virtual scrolling for channel list
 */
function initVirtualScroll() {
  if (!elements.channelViewport) return;
  
  viewportHeight = elements.channelViewport.clientHeight;
  
  elements.channelViewport.addEventListener('scroll', () => {
    scrollTop = elements.channelViewport.scrollTop;
    requestAnimationFrame(renderChannels);
  });
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    viewportHeight = elements.channelViewport.clientHeight;
    renderChannels();
  });
  resizeObserver.observe(elements.channelViewport);
  
  // PERF: Event delegation for channel list (single handler instead of per-row)
  initChannelListDelegation();
}

/**
 * Initialize event delegation for channel list
 * Single handler on parent instead of handlers on each row (memory + performance win)
 */
function initChannelListDelegation() {
  if (!elements.channelContent) return;
  
  elements.channelContent.addEventListener('click', (e) => {
    // Handle favorite button clicks
    const favoriteBtn = e.target.closest('.channel-favorite');
    if (favoriteBtn) {
      e.stopPropagation();
      const id = favoriteBtn.dataset.favorite;
      storage.toggleFavorite(id);
      updateCounts();
      if (currentCategory === '__favorites__') {
        applyFilters();
      }
      // Re-render the appropriate view
      if (isGlobalSearchActive) {
        renderGlobalSearchResults();
      } else {
        renderChannels();
      }
      onFavoriteToggle(id);
      return;
    }
    
    // Handle row/item clicks (.channel-row for channels, .channel-item for search results)
    const row = e.target.closest('.channel-row, .channel-item');
    if (row) {
      const id = row.dataset.id;
      const type = row.dataset.type; // 'live', 'vod', 'series' (for global search)
      
      // Global search mode: handle different content types
      if (type) {
        if (type === 'series') {
          // Load series details
          window.app?.loadSeriesDetails?.(id);
        } else {
          // Live TV or VOD - play directly
          const item = allSearchableItems.find(i => String(i.id) === String(id));
          if (item) {
            selectedChannelId = id;
            
            if (type === 'live') {
              storage.addRecent(id);
              updateCounts();
            }
            
            renderGlobalSearchResults();
            onChannelSelect(item);
            
            if (window.innerWidth <= 768) {
              closeSidebar();
            }
          }
        }
        return;
      }
      
      // Normal channel list mode
      const channel = channels.find(ch => ch.id === id);
      if (channel) {
        selectChannel(channel);
      }
    }
  });
  
  console.log('[UI] Channel list event delegation initialized');
}

/**
 * Initialize event delegation for content grid (Movies/Series cards)
 */
function initContentGridDelegation() {
  const container = elements.contentGridInner || elements.contentGrid;
  if (!container) return;
  
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.search-card');
    if (!card) return;
    
    const id = card.dataset.id;
    const type = card.dataset.type || 'vod';
    
    // Find item from current items list
    const item = currentItems.find(i => String(i.id) === String(id));
    if (item) {
      handleSearchCardClick(item);
    }
  });
  
  // Keyboard handler for accessibility
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    
    const card = e.target.closest('.search-card');
    if (!card) return;
    
    e.preventDefault();
    const id = card.dataset.id;
    const item = currentItems.find(i => String(i.id) === String(id));
    if (item) {
      handleSearchCardClick(item);
    }
  });
  
  console.log('[UI] Content grid event delegation initialized');
}

/**
 * Initialize event delegation for search overlay results
 */
function initSearchOverlayDelegation() {
  if (!elements.searchGrid) return;
  
  elements.searchGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.search-card');
    if (!card) return;
    
    const id = card.dataset.id;
    
    // Find item from search results
    const item = searchOverlayResults.find(i => String(i.id) === String(id));
    if (item) {
      handleSearchCardClick(item);
    }
  });
  
  // Keyboard handler for accessibility
  elements.searchGrid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    
    const card = e.target.closest('.search-card');
    if (!card) return;
    
    e.preventDefault();
    const id = card.dataset.id;
    const item = searchOverlayResults.find(i => String(i.id) === String(id));
    if (item) {
      handleSearchCardClick(item);
    }
  });
  
  console.log('[UI] Search overlay event delegation initialized');
}

/**
 * Initialize virtual scrolling for content grid (Movies/Series)
 */
function initContentGridVirtualScroll() {
  if (!elements.contentGrid || contentGridInitialized) return;
  
  contentGridInitialized = true;
  
  // PERF: Event delegation for content grid cards
  initContentGridDelegation();
  
  // Calculate initial dimensions
  updateContentGridDimensions();
  
  // Scroll listener with requestAnimationFrame for performance
  let scrollTicking = false;
  elements.contentGrid.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        contentGridScrollTop = elements.contentGrid.scrollTop;
        renderContentGridVirtual();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    updateContentGridDimensions();
    renderContentGridVirtual();
  });
  resizeObserver.observe(elements.contentGrid);
  
  console.log('[UI] Content grid virtual scroll initialized');
}

/**
 * Update content grid dimensions based on viewport size
 */
function updateContentGridDimensions() {
  if (!elements.contentGrid) return;
  
  contentGridViewportHeight = elements.contentGrid.clientHeight;
  contentGridViewportWidth = elements.contentGrid.clientWidth - (GRID_GAP * 2); // Account for padding
  
  // Calculate number of columns based on width
  contentGridColumns = Math.max(1, Math.floor((contentGridViewportWidth + GRID_GAP) / (GRID_CARD_MIN_WIDTH + GRID_GAP)));
  
  // Calculate actual card width
  contentGridCardWidth = (contentGridViewportWidth - (GRID_GAP * (contentGridColumns - 1))) / contentGridColumns;
  
  // Calculate row height (card + text below)
  contentGridRowHeight = Math.ceil(contentGridCardWidth * GRID_CARD_ASPECT_RATIO) + GRID_GAP;
  
  // Set CSS custom properties for card positioning
  elements.contentGrid.style.setProperty('--grid-cols', contentGridColumns);
  elements.contentGrid.style.setProperty('--grid-gap', `${GRID_GAP}px`);
  
  console.log(`[UI] Content grid: ${contentGridColumns} cols, ${contentGridCardWidth}px card width, ${contentGridRowHeight}px row height`);
}

/**
 * Set channels data
 * @param {Array} channelList 
 */
export function setChannels(channelList) {
  channels = channelList;
  
  // PERF: Cache locale scores once at load time (avoids recalculating on every filter/sort)
  if (localeModule?.cacheScores) {
    localeModule.cacheScores(channels);
  }
  
  applyFilters();
  updateCounts();
  renderGroups();
  renderChannels();
}

/**
 * Set content type and categories
 * @param {string} type - 'live', 'movies', or 'series'
 * @param {Array} categories - Categories for VOD/Series (optional)
 */
export function setContentType(type, categories = []) {
  currentContentType = type;
  vodSeriesCategories = categories;
  currentItems = [];
  currentCategory = '__all__';
  searchQuery = '';
  isGlobalSearchActive = false;
  
  // Clear search - always show global search hint
  if (elements.searchInput) {
    elements.searchInput.value = '';
    elements.searchInput.placeholder = 'Search all content... (press /)';
  }
  
  // Update counts display
  const countLabels = {
    live: 'All Channels',
    movies: 'All Movies',
    series: 'All Series'
  };
  
  const allBtn = document.querySelector('[data-category="__all__"] span:first-of-type');
  if (allBtn) allBtn.textContent = countLabels[type] || 'All';
  
  // Hide favorites/recents for VOD/Series (not applicable)
  const favBtn = document.querySelector('[data-category="__favorites__"]');
  const recBtn = document.querySelector('[data-category="__recents__"]');
  if (favBtn) favBtn.hidden = type !== 'live';
  if (recBtn) recBtn.hidden = type !== 'live';
  
  // Switch between channel list (Live) and content grid (Movies/Series)
  if (elements.channelList) {
    elements.channelList.hidden = type !== 'live';
  }
  if (elements.contentGrid) {
    elements.contentGrid.hidden = type === 'live';
  }
  
  if (type === 'live') {
    // Live TV - show channel groups
    applyFilters();
    updateCounts();
    renderGroups();
    renderChannels();
  } else {
    // VOD/Series - show categories
    renderVodSeriesCategories();
    renderContentGrid([]);
  }
}

/**
 * Set items for current VOD/Series category
 * @param {Array} items 
 */
export function setItems(items) {
  // PERF: Cache locale scores if not already cached
  if (localeModule?.cacheScores && items.length > 0 && typeof items[0]._localeScore !== 'number') {
    localeModule.cacheScores(items);
  }
  
  currentItems = items;
  renderContentGrid(items);
}

/**
 * Set all searchable items for global search
 * @param {Array} items - Combined array of all channels, movies, and series
 */
export function setAllSearchableItems(items) {
  // PERF: Cache locale scores for search (channels already cached, but VOD/series may not be)
  if (localeModule?.cacheScores) {
    // Only cache items that don't already have scores
    const uncachedItems = items.filter(item => typeof item._localeScore !== 'number');
    if (uncachedItems.length > 0) {
      localeModule.cacheScores(uncachedItems);
    }
  }
  
  allSearchableItems = items;
}

/**
 * Set locale module reference for language-prioritized search
 * @param {Object} module - The locale module
 */
export function setLocaleModule(module) {
  localeModule = module;
  console.log('[UI] Locale module set');
}

/**
 * Get icon SVG for content type
 * @param {string} type - 'live', 'vod', 'series', 'episode'
 * @returns {string} SVG markup
 */
function getContentTypeIcon(type) {
  switch (type) {
    case 'live':
      // TV icon for live
      return `<svg class="content-type-icon content-type-icon--live" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
      </svg>`;
    case 'vod':
      // Film icon for movies
      return `<svg class="content-type-icon content-type-icon--vod" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="2" y1="7" x2="7" y2="7"/>
        <line x1="2" y1="17" x2="7" y2="17"/>
        <line x1="17" y1="17" x2="22" y2="17"/>
        <line x1="17" y1="7" x2="22" y2="7"/>
      </svg>`;
    case 'series':
      // Signal/antenna icon for series
      return `<svg class="content-type-icon content-type-icon--series" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 11a9 9 0 0 1 9 9"/>
        <path d="M4 4a16 16 0 0 1 16 16"/>
        <circle cx="5" cy="19" r="2"/>
      </svg>`;
    case 'episode':
      // Play circle for episodes
      return `<svg class="content-type-icon content-type-icon--series" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16 10 8"/>
      </svg>`;
    default:
      return '';
  }
}

/**
 * Render VOD/Series categories
 */
function renderVodSeriesCategories() {
  if (!elements.categoryGroups) return;
  
  // Reset "All" count 
  if (elements.countAll) {
    elements.countAll.textContent = '...';
  }
  
  // Sort categories by locale preference
  let sortedCategories = [...vodSeriesCategories];
  if (localeModule?.sortByLocale) {
    localeModule.sortByLocale(sortedCategories, cat => cat.category_name);
  }
  
  elements.categoryGroups.innerHTML = sortedCategories.map(cat => `
    <button class="category-item" data-vod-category="${cat.category_id}">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHtml(cat.category_name)}</span>
    </button>
  `).join('');
  
  // Add click handlers
  elements.categoryGroups.querySelectorAll('[data-vod-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const categoryId = btn.dataset.vodCategory;
      
      // Update active state
      document.querySelectorAll('[data-vod-category]').forEach(b => {
        b.classList.remove('category-item--active');
      });
      btn.classList.add('category-item--active');
      document.querySelector('[data-category="__all__"]')?.classList.remove('category-item--active');
      
      // Load items for this category
      if (currentContentType === 'movies') {
        window.app?.loadVodCategory?.(categoryId);
      } else if (currentContentType === 'series') {
        window.app?.loadSeriesCategory?.(categoryId);
      }
    });
  });
}

/**
 * Render content grid for Movies/Series
 * Uses VIRTUAL SCROLLING for large lists (>50 items)
 * Falls back to static rendering for small lists
 */
function renderContentGrid(items) {
  const container = elements.contentGridInner || elements.contentGrid;
  if (!container) {
    console.error('[UI] renderContentGrid: contentGrid element not found');
    return;
  }
  
  console.log(`[UI] renderContentGrid: ${items.length} items`);
  
  let filtered = searchQuery 
    ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [...items];
  
  // Sort by locale preference (4K/24/7 to the end)
  if (localeModule?.sortByLocale) {
    localeModule.sortByLocale(filtered);
  }
  
  // Update "All" count
  if (elements.countAll) {
    elements.countAll.textContent = filtered.length;
  }
  
  // Store items reference for virtual scrolling
  currentItems = filtered;
  
  // Reset scroll position
  if (elements.contentGrid) {
    elements.contentGrid.scrollTop = 0;
    contentGridScrollTop = 0;
  }
  
  // For small lists, use static rendering (simpler, no overhead)
  if (filtered.length <= GRID_VIRTUALIZE_THRESHOLD) {
    renderContentGridStatic(filtered, container);
    return;
  }
  
  // For large lists, use virtual scrolling
  initContentGridVirtualScroll();
  updateContentGridDimensions();
  
  // Remove static mode class if present
  elements.contentGrid?.classList.remove('content-grid--static');
  
  renderContentGridVirtual();
}

/**
 * Static rendering for small lists (no virtualization overhead)
 */
function renderContentGridStatic(items, container) {
  // Add static mode class
  elements.contentGrid?.classList.add('content-grid--static');
  
  container.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  
  items.forEach((item, index) => {
    const card = createSearchCard(item, index);
    card.classList.add('content-grid__item');
    
    if (item.id === selectedChannelId) {
      card.classList.add('search-card--active');
    }
    
    fragment.appendChild(card);
  });
  
  container.appendChild(fragment);
  console.log(`[UI] renderContentGrid (static): ${items.length} cards rendered`);
  
  // Observe images for lazy loading
  observeContentGridImages(container);
}

/**
 * Virtual rendering for large lists
 * Only renders visible items + buffer
 */
function renderContentGridVirtual() {
  const container = elements.contentGridInner;
  if (!container || currentItems.length === 0) return;
  
  const totalItems = currentItems.length;
  const totalRows = Math.ceil(totalItems / contentGridColumns);
  const totalHeight = totalRows * contentGridRowHeight;
  
  // Set container height for scrollbar
  container.style.height = `${totalHeight}px`;
  
  // Calculate visible row range
  const startRow = Math.max(0, Math.floor(contentGridScrollTop / contentGridRowHeight) - GRID_BUFFER_ROWS);
  const visibleRows = Math.ceil(contentGridViewportHeight / contentGridRowHeight);
  const endRow = Math.min(totalRows, startRow + visibleRows + (GRID_BUFFER_ROWS * 2));
  
  // Calculate item indices
  const startIndex = startRow * contentGridColumns;
  const endIndex = Math.min(totalItems, endRow * contentGridColumns);
  
  // Get visible items
  const visibleItems = currentItems.slice(startIndex, endIndex);
  
  // Clear and render only visible items
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  
  visibleItems.forEach((item, i) => {
    const actualIndex = startIndex + i;
    const row = Math.floor(actualIndex / contentGridColumns);
    const col = actualIndex % contentGridColumns;
    
    // Calculate position
    const top = row * contentGridRowHeight;
    const left = col * (contentGridCardWidth + GRID_GAP);
    
    const card = createSearchCard(item, actualIndex);
    card.classList.add('content-grid__item');
    card.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      width: ${contentGridCardWidth}px;
    `;
    
    if (item.id === selectedChannelId) {
      card.classList.add('search-card--active');
    }
    
    fragment.appendChild(card);
  });
  
  container.appendChild(fragment);
  
  // Observe images for lazy loading
  observeContentGridImages(container);
}

/**
 * Observe content grid images for lazy loading
 */
function observeContentGridImages(container) {
  requestAnimationFrame(() => {
    const images = container.querySelectorAll('img[data-src]');
    if (imageObserver) {
      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for older browsers - load in batches
      let index = 0;
      const loadBatch = () => {
        const batch = Array.from(images).slice(index, index + 10);
        batch.forEach(img => {
          img.onerror = () => img.style.display = 'none';
          img.onload = () => {
            img.style.opacity = '1';
            img.classList.add('loaded');
          };
          img.src = img.dataset.src;
        });
        index += 10;
        if (index < images.length) {
          requestAnimationFrame(loadBatch);
        }
      };
      loadBatch();
    }
  });
}

/**
 * Legacy function for backwards compatibility
 */
function renderItems(items) {
  renderContentGrid(items);
}

/**
 * Show series details modal with seasons/episodes
 * @param {Object} seriesInfo - { info, seasons, episodes }
 */
export function showSeriesDetails(seriesInfo) {
  const { info, episodes } = seriesInfo;
  
  // Group episodes by season
  const seasons = {};
  episodes.forEach(ep => {
    const s = ep.season || 1;
    if (!seasons[s]) seasons[s] = [];
    seasons[s].push(ep);
  });
  
  // Create modal content
  const modalHtml = `
    <div class="series-modal" id="series-modal">
      <div class="series-modal__header">
        <div class="series-modal__info">
          ${info.cover ? `<img class="series-modal__cover" src="${escapeHtml(applyProxyToUrl(info.cover))}" alt="">` : ''}
          <div>
            <h2 class="series-modal__title">${escapeHtml(info.name || 'Series')}</h2>
            <p class="series-modal__meta">${escapeHtml([info.genre, info.releaseDate].filter(Boolean).join(' • '))}</p>
            ${info.plot ? `<p class="series-modal__plot">${escapeHtml(info.plot.substring(0, 200))}${info.plot.length > 200 ? '...' : ''}</p>` : ''}
          </div>
        </div>
        <button class="series-modal__close" id="close-series-modal" aria-label="Close">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="series-modal__seasons">
        ${Object.entries(seasons).map(([num, eps]) => `
          <div class="series-season">
            <h3 class="series-season__title">Season ${num}</h3>
            <div class="series-episodes">
              ${eps.map(ep => `
                <button class="series-episode" data-episode-url="${escapeHtml(ep.url)}" data-episode-name="${escapeHtml(ep.name)}">
                  <span class="series-episode__num">E${ep.episode}</span>
                  <span class="series-episode__title">${escapeHtml(ep.name)}</span>
                  ${ep.duration ? `<span class="series-episode__duration">${escapeHtml(ep.duration)}</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Create overlay
  let overlay = document.getElementById('series-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'series-overlay';
    overlay.className = 'series-overlay';
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = modalHtml;
  overlay.hidden = false;
  
  // Add event handlers
  document.getElementById('close-series-modal')?.addEventListener('click', () => {
    overlay.hidden = true;
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.hidden = true;
    }
  });
  
  // Episode click handlers
  overlay.querySelectorAll('.series-episode').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.episodeUrl;
      const name = btn.dataset.episodeName;
      
      // Create a channel-like object for the player
      const episode = {
        id: url,
        name: name,
        url: url,
        type: 'episode'
      };
      
      selectedChannelId = url;
      overlay.hidden = true;
      onChannelSelect(episode);
    });
  });
}

/**
 * Get groups from channels, sorted by locale preference
 * @returns {Array<string>}
 */
function getGroups() {
  const groups = new Set();
  channels.forEach(ch => groups.add(ch.group));
  const groupArray = Array.from(groups);
  
  // Sort by locale preference if locale module is available
  if (localeModule?.sortGroups) {
    return localeModule.sortGroups(groupArray);
  }
  
  // Fallback to alphabetical
  return groupArray.sort((a, b) => a.localeCompare(b));
}

/**
 * Render category groups in sidebar
 */
function renderGroups() {
  if (!elements.categoryGroups) return;
  
  const groups = getGroups();
  
  elements.categoryGroups.innerHTML = groups.map(group => `
    <button class="category-item" data-category="${escapeHtml(group)}">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHtml(group)}</span>
      <span class="category-count">${channels.filter(ch => ch.group === group).length}</span>
    </button>
  `).join('');
  
  // Add click handlers
  elements.categoryGroups.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.category));
  });
}

/**
 * Update counts in sidebar
 */
function updateCounts() {
  if (elements.countAll) {
    elements.countAll.textContent = channels.length;
  }
  if (elements.countFavorites) {
    const favorites = storage.getFavorites();
    const count = channels.filter(ch => favorites.includes(ch.id)).length;
    elements.countFavorites.textContent = count;
  }
  if (elements.countRecents) {
    const recents = storage.getRecents();
    const count = recents.filter(id => channels.some(ch => ch.id === id)).length;
    elements.countRecents.textContent = count;
  }
}

/**
 * Apply filters and update filtered channels
 */
function applyFilters() {
  let result = [...channels];
  
  // Category filter
  if (currentCategory === '__favorites__') {
    const favorites = storage.getFavorites();
    result = result.filter(ch => favorites.includes(ch.id));
  } else if (currentCategory === '__recents__') {
    const recents = storage.getRecents();
    result = recents
      .map(id => channels.find(ch => ch.id === id))
      .filter(Boolean);
    // Don't re-sort recents - preserve order by recent usage
    filteredChannels = result;
    return;
  } else if (currentCategory !== '__all__') {
    result = result.filter(ch => ch.group === currentCategory);
  }
  
  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(ch => ch.name.toLowerCase().includes(q));
  }
  
  // Sort by locale preference (4K/24/7 to the end)
  if (localeModule?.sortByLocale) {
    localeModule.sortByLocale(result);
  }
  
  filteredChannels = result;
}

/**
 * Select category
 * @param {string} category 
 */
export function selectCategory(category) {
  currentCategory = category;
  scrollTop = 0;
  
  if (elements.channelViewport) {
    elements.channelViewport.scrollTop = 0;
  }
  
  // Update active state for fixed categories
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.classList.toggle('category-item--active', btn.dataset.category === category);
  });
  
  // For Live TV, use standard filtering
  if (currentContentType === 'live') {
    applyFilters();
    renderChannels();
  } else {
    // For VOD/Series, "All" means clear selection (show empty until category chosen)
    // Also clear any VOD category selection
    document.querySelectorAll('[data-vod-category]').forEach(b => {
      b.classList.remove('category-item--active');
    });
    currentItems = [];
    renderItems([]);
  }
  
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

/**
 * Handle search input
 */
function handleSearch(e) {
  searchQuery = e.target.value.trim();
  scrollTop = 0;
  if (elements.channelViewport) {
    elements.channelViewport.scrollTop = 0;
  }
  
  // Global search: when there's a query, search across ALL content types
  if (searchQuery && allSearchableItems.length > 0) {
    isGlobalSearchActive = true;
    renderGlobalSearchResults();
  } else {
    // No query - revert to normal content type browsing
    isGlobalSearchActive = false;
    
    // For Live TV, use filters and render channels
    // For VOD/Series, re-render items with search filter
    if (currentContentType === 'live') {
      applyFilters();
      renderChannels();
    } else {
      renderItems(currentItems);
    }
  }
}

/**
 * Render global search results across all content types
 */
function renderGlobalSearchResults() {
  if (!elements.channelContent) return;
  
  const q = searchQuery.toLowerCase();
  
  // Search across all items
  const results = allSearchableItems.filter(item => 
    item.name.toLowerCase().includes(q)
  );
  
  // Pre-calculate additional sort keys
  results.forEach(item => {
    const name = item.name.toLowerCase();
    item._startsWithQuery = name.startsWith(q);
    item._localeScore = localeModule?.getScore?.(item.name) || 1;
    item._isLowPriority = localeModule?.isLowPriority?.(item.name) || false;
  });
  
  // Sort: low-priority last > locale score > starts-with > alphabetical
  results.sort((a, b) => {
    // 1. Low-priority items (4K, 24/7) go to the end
    if (a._isLowPriority && !b._isLowPriority) return 1;
    if (!a._isLowPriority && b._isLowPriority) return -1;
    
    // 2. Locale score (higher = better)
    const scoreDiff = (b._localeScore || 0) - (a._localeScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    
    // 3. Starts-with matches
    if (a._startsWithQuery && !b._startsWithQuery) return -1;
    if (!a._startsWithQuery && b._startsWithQuery) return 1;
    
    // 4. Alphabetical fallback
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  
  // Clean up temp properties
  results.forEach(item => {
    delete item._startsWithQuery;
    delete item._localeScore;
    delete item._isLowPriority;
  });
  
  // Update count display
  if (elements.countAll) {
    elements.countAll.textContent = results.length;
  }
  
  const totalHeight = results.length * ITEM_HEIGHT;
  elements.channelContent.style.height = `${totalHeight}px`;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    results.length,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );
  
  const visibleItems = results.slice(startIndex, endIndex);
  const favorites = storage.getFavorites();
  
  // Render search results with content type indicators
  elements.channelContent.innerHTML = visibleItems.map((item, i) => {
    const actualIndex = startIndex + i;
    const top = actualIndex * ITEM_HEIGHT;
    const isActive = item.id === selectedChannelId;
    
    // Determine content type
    const contentType = item.type || 'live';
    const typeIcon = getContentTypeIcon(contentType);
    
    // Build subtitle based on content type
    let subtitle = '';
    if (contentType === 'vod') {
      subtitle = [item.year, item.duration, item.genre].filter(Boolean).join(' • ');
    } else if (contentType === 'series') {
      subtitle = item.genre || '';
    } else if (contentType === 'live' && item.epgId) {
      const nowInfo = epg.getNow(item.epgId);
      subtitle = nowInfo ? nowInfo.title : '';
    }
    
    // Show favorite star only for live channels
    const isFavorite = contentType === 'live' && favorites.includes(item.id);
    const showFavorite = contentType === 'live';
    
    return `
      <div class="channel-item ${isActive ? 'channel-item--active' : ''}" 
           data-id="${item.id}" 
           data-type="${contentType}"
           style="top: ${top}px">
        ${item.logo 
          ? `<img class="channel-logo" src="${escapeHtml(applyProxyToUrl(item.logo))}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="channel-logo channel-logo--placeholder">${getInitials(item.name)}</div>`
        }
        <div class="channel-info">
          <div class="channel-name">
            ${typeIcon}
            <span>${escapeHtml(item.name)}</span>
          </div>
          ${subtitle ? `<div class="channel-epg">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${contentType === 'series' 
          ? `<svg class="icon channel-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <polyline points="9 18 15 12 9 6"/>
             </svg>`
          : showFavorite 
            ? `<button class="channel-favorite ${isFavorite ? 'channel-favorite--active' : ''}" 
                      data-favorite="${item.id}"
                      title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                <svg class="icon" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>`
            : ''
        }
      </div>
    `;
  }).join('');
  
  // Click handlers are now handled via event delegation (initChannelListDelegation)
  // No per-item handlers needed - this is a significant performance improvement
}

/**
 * Render channels with EPG-style rows (Now/Next format)
 * PERF: Uses template cloning instead of innerHTML parsing
 */
function renderChannels() {
  if (!elements.channelContent) return;
  
  const ROW_HEIGHT = 72; // Taller rows for EPG style
  const totalHeight = filteredChannels.length * ROW_HEIGHT;
  elements.channelContent.style.height = `${totalHeight}px`;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    filteredChannels.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_SIZE
  );
  
  // Get visible channels
  const visibleChannels = filteredChannels.slice(startIndex, endIndex);
  const favorites = storage.getFavorites();
  
  // Clear and rebuild using template cloning (faster than innerHTML)
  const fragment = document.createDocumentFragment();
  const template = elements.channelRowTemplate?.content;
  
  visibleChannels.forEach((channel, i) => {
    const actualIndex = startIndex + i;
    const top = actualIndex * ROW_HEIGHT;
    const isFavorite = favorites.includes(channel.id);
    const isActive = channel.id === selectedChannelId;
    
    // Get EPG info if available
    const nowInfo = epg.getNow(channel.epgId);
    const nextInfo = epg.getNext(channel.epgId);
    const hasEpg = nowInfo || nextInfo;
    
    // Clone template or create element
    let row;
    if (template) {
      row = template.cloneNode(true).firstElementChild;
    } else {
      // Fallback if template not available
      row = document.createElement('div');
      row.className = 'channel-row';
    }
    
    // Set attributes
    row.dataset.id = channel.id;
    row.style.cssText = `position: absolute; top: ${top}px; left: 0; right: 0;`;
    if (isActive) row.classList.add('channel-row--active');
    
    // Logo
    const logoEl = row.querySelector('.channel-row__logo');
    const placeholderEl = row.querySelector('.channel-row__logo-placeholder');
    
    if (channel.logo) {
      if (logoEl) {
        logoEl.src = applyProxyToUrl(channel.logo);
        logoEl.style.display = '';
        logoEl.onerror = () => {
          logoEl.style.display = 'none';
          if (placeholderEl) {
            placeholderEl.textContent = getInitials(channel.name);
            placeholderEl.style.display = '';
          }
        };
      }
      if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
      if (logoEl) logoEl.style.display = 'none';
      if (placeholderEl) {
        placeholderEl.textContent = getInitials(channel.name);
        placeholderEl.style.display = '';
      }
    }
    
    // Name
    const nameEl = row.querySelector('.channel-row__name');
    if (nameEl) nameEl.textContent = channel.name;
    
    // EPG info
    const nowEl = row.querySelector('.channel-row__now');
    const nextEl = row.querySelector('.channel-row__next');
    const noEpgEl = row.querySelector('.channel-row__no-epg');
    
    if (hasEpg) {
      if (nowEl) {
        nowEl.style.display = '';
        const nowTitle = nowEl.querySelector('.channel-row__epg-title');
        if (nowTitle) nowTitle.textContent = nowInfo?.title || '—';
      }
      if (nextEl) {
        nextEl.style.display = '';
        const nextTitle = nextEl.querySelector('.channel-row__epg-title');
        if (nextTitle) nextTitle.textContent = nextInfo?.title || '—';
      }
      if (noEpgEl) noEpgEl.style.display = 'none';
    } else {
      if (nowEl) nowEl.style.display = 'none';
      if (nextEl) nextEl.style.display = 'none';
      if (noEpgEl) noEpgEl.style.display = '';
    }
    
    // Favorite button
    const favBtn = row.querySelector('.channel-favorite');
    if (favBtn) {
      favBtn.dataset.favorite = channel.id;
      favBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
      if (isFavorite) {
        favBtn.classList.add('channel-favorite--active');
        const svg = favBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'currentColor');
      } else {
        favBtn.classList.remove('channel-favorite--active');
        const svg = favBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'none');
      }
    }
    
    fragment.appendChild(row);
  });
  
  // Single DOM update
  elements.channelContent.innerHTML = '';
  elements.channelContent.appendChild(fragment);
  
  // Click handlers handled via event delegation (initChannelListDelegation)
}

/**
 * Select a channel
 * @param {Object} channel 
 */
export function selectChannel(channel) {
  selectedChannelId = channel.id;
  storage.addRecent(channel.id);
  updateCounts();
  updateNowPlayingPanel(channel);
  renderChannels();
  onChannelSelect(channel);
  
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

/**
 * Show onboarding view
 */
export function showOnboarding() {
  if (elements.onboarding) elements.onboarding.hidden = false;
  if (elements.epgView) elements.epgView.hidden = true;
}

/**
 * Show player view (EPG view)
 */
export function showPlayer() {
  if (elements.onboarding) elements.onboarding.hidden = true;
  if (elements.epgView) elements.epgView.hidden = false;
}

/**
 * Update Now Playing panel with current item info
 * @param {Object} item - Channel or VOD item
 */
export function updateNowPlayingPanel(item) {
  if (!item) {
    // Reset panel
    if (elements.panelChannelName) elements.panelChannelName.textContent = 'Select a channel';
    if (elements.panelCategory) elements.panelCategory.textContent = '';
    if (elements.channelLogo) elements.channelLogo.hidden = true;
    if (elements.channelLogoPlaceholder) elements.channelLogoPlaceholder.hidden = false;
    if (elements.panelEpg) elements.panelEpg.hidden = true;
    if (elements.panelVod) elements.panelVod.hidden = true;
    return;
  }
  
  const type = item.type || 'live';
  
  // Update logo
  if (item.logo) {
    if (elements.channelLogo) {
      elements.channelLogo.src = applyProxyToUrl(item.logo);
      elements.channelLogo.hidden = false;
      elements.channelLogo.onerror = () => {
        elements.channelLogo.hidden = true;
        if (elements.channelLogoPlaceholder) elements.channelLogoPlaceholder.hidden = false;
      };
    }
    if (elements.channelLogoPlaceholder) elements.channelLogoPlaceholder.hidden = true;
  } else {
    if (elements.channelLogo) elements.channelLogo.hidden = true;
    if (elements.channelLogoPlaceholder) elements.channelLogoPlaceholder.hidden = false;
  }
  
  // Update name
  if (elements.panelChannelName) {
    elements.panelChannelName.textContent = item.name || 'Unknown';
  }
  
  // Update category
  if (elements.panelCategory) {
    elements.panelCategory.textContent = item.group || item.genre || '';
  }
  
  // Type-specific info
  if (type === 'live') {
    // Show EPG info for live channels
    if (elements.panelEpg) elements.panelEpg.hidden = false;
    if (elements.panelVod) elements.panelVod.hidden = true;
    
    // Get EPG data
    const nowInfo = epg.getNow(item.epgId);
    const nextInfo = epg.getNext(item.epgId);
    
    if (elements.panelEpgNow) {
      elements.panelEpgNow.textContent = nowInfo?.title || '—';
    }
    if (elements.panelEpgNext) {
      elements.panelEpgNext.textContent = nextInfo?.title || '—';
    }
    if (elements.panelEpgNextTime) {
      elements.panelEpgNextTime.textContent = nextInfo ? epg.formatTime(nextInfo.start) : '';
    }
    if (elements.panelEpgProgress && nowInfo) {
      elements.panelEpgProgress.style.width = `${epg.getProgress(nowInfo)}%`;
    }
  } else {
    // Show VOD metadata
    if (elements.panelEpg) elements.panelEpg.hidden = true;
    if (elements.panelVod) elements.panelVod.hidden = false;
    
    if (elements.panelVodDuration) {
      elements.panelVodDuration.textContent = item.duration || '';
      elements.panelVodDuration.hidden = !item.duration;
    }
    if (elements.panelVodYear) {
      elements.panelVodYear.textContent = item.year || '';
      elements.panelVodYear.hidden = !item.year;
    }
    if (elements.panelVodRating) {
      elements.panelVodRating.textContent = item.rating || '';
      elements.panelVodRating.hidden = !item.rating;
    }
  }
}

/**
 * Show loading state
 * @param {boolean} show 
 */
export function showLoading(show) {
  if (elements.playerLoading) elements.playerLoading.hidden = !show;
  if (elements.playerError) elements.playerError.hidden = true;
}

/**
 * Show error state
 * @param {string} message 
 */
/**
 * Show error state
 * @param {string|Object} error - Error message or { message, hint, type }
 */
export function showError(error) {
  if (elements.playerLoading) elements.playerLoading.hidden = true;
  if (elements.playerError) elements.playerError.hidden = false;
  
  const message = typeof error === 'string' ? error : error.message || 'Playback error';
  const hint = typeof error === 'object' ? error.hint : null;
  const errorType = typeof error === 'object' ? error.type : 'unknown';
  
  if (elements.errorMessage) {
    // Build error HTML with hint if available
    let html = `<span class="error-title">${escapeHtml(message)}</span>`;
    
    if (hint) {
      html += `<span class="error-hint">${escapeHtml(hint)}</span>`;
    }
    
    // Add type-specific guidance
    if (errorType === 'blocked' || errorType === 'cors') {
      html += `<span class="error-hint">💡 Copy the stream URL below and open it in VLC, IINA, or another media player.</span>`;
    }
    
    elements.errorMessage.innerHTML = html;
  }
}

/**
 * Hide error state
 */
export function hideError() {
  if (elements.playerError) elements.playerError.hidden = true;
}

/**
 * Update now playing text
 * @param {string} text 
 */
export function setNowPlaying(text) {
  if (elements.nowPlaying) {
    elements.nowPlaying.textContent = text || 'No channel selected';
  }
}

/**
 * Update EPG display
 * @param {Object} nowNext - { now, next }
 */
export function updateEpg(nowNext) {
  const { now, next } = nowNext || {};
  
  // Get EPG container to show/hide
  const epgContainer = document.getElementById('epg-info');
  
  // If no EPG data at all, hide the entire section
  if (!now && !next) {
    if (epgContainer) epgContainer.hidden = true;
    return;
  }
  
  // Show the section if we have data
  if (epgContainer) epgContainer.hidden = false;
  
  if (elements.epgNowTitle) {
    elements.epgNowTitle.textContent = now?.title || 'No info';
  }
  
  if (elements.epgNextTitle) {
    elements.epgNextTitle.textContent = next?.title || 'No info';
  }
  
  if (elements.epgNextTime) {
    elements.epgNextTime.textContent = next ? epg.formatTime(next.start) : '';
  }
  
  if (elements.epgProgressFill) {
    if (now) {
      const progress = epg.getProgress(now);
      elements.epgProgressFill.style.width = `${progress}%`;
    } else {
      elements.epgProgressFill.style.width = '0%';
    }
  }
}

/**
 * Show toast notification
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3000) {
  if (!elements.toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast--out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e 
 */
function handleKeydown(e) {
  // Handle Escape in search overlay
  if (e.key === 'Escape' && searchOverlayActive) {
    e.preventDefault();
    exitSearchMode();
    return;
  }
  
  // Don't handle other shortcuts if in input (except Escape which is handled above)
  if (e.target.matches('input, textarea')) {
    if (e.key === 'Escape') {
      e.target.blur();
      // If in search overlay input, exit search mode
      if (e.target === elements.searchOverlayInput) {
        exitSearchMode();
      }
    }
    return;
  }
  
  // Don't handle shortcuts if search overlay is active
  if (searchOverlayActive) {
    return;
  }
  
  switch (e.key) {
    case '/':
      e.preventDefault();
      enterSearchMode();
      break;
    case 'ArrowDown':
      e.preventDefault();
      navigateChannels(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      navigateChannels(-1);
      break;
    case 'Enter':
      e.preventDefault();
      playSelectedChannel();
      break;
    case 'Escape':
      closeSidebar();
      break;
  }
}

/**
 * Navigate channels with arrow keys
 * @param {number} direction - 1 for down, -1 for up
 */
function navigateChannels(direction) {
  if (filteredChannels.length === 0) return;
  
  const currentIndex = filteredChannels.findIndex(ch => ch.id === selectedChannelId);
  let newIndex;
  
  if (currentIndex === -1) {
    newIndex = direction > 0 ? 0 : filteredChannels.length - 1;
  } else {
    newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = filteredChannels.length - 1;
    if (newIndex >= filteredChannels.length) newIndex = 0;
  }
  
  const channel = filteredChannels[newIndex];
  if (channel) {
    selectedChannelId = channel.id;
    renderChannels();
    scrollToChannel(newIndex);
  }
}

/**
 * Scroll to channel index
 * @param {number} index 
 */
function scrollToChannel(index) {
  if (!elements.channelViewport) return;
  
  const itemTop = index * ITEM_HEIGHT;
  const itemBottom = itemTop + ITEM_HEIGHT;
  const viewTop = elements.channelViewport.scrollTop;
  const viewBottom = viewTop + viewportHeight;
  
  if (itemTop < viewTop) {
    elements.channelViewport.scrollTop = itemTop;
  } else if (itemBottom > viewBottom) {
    elements.channelViewport.scrollTop = itemBottom - viewportHeight;
  }
}

/**
 * Play the currently selected channel
 */
function playSelectedChannel() {
  const channel = filteredChannels.find(ch => ch.id === selectedChannelId);
  if (channel) {
    selectChannel(channel);
  }
}

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
  elements.sidebar?.classList.toggle('sidebar--open');
}

/**
 * Close sidebar
 */
function closeSidebar() {
  elements.sidebar?.classList.remove('sidebar--open');
}

// =============================================================================
// Search Overlay (Netflix-style full-screen search)
// =============================================================================

// Track image loading stats for debugging
let imageLoadStats = { attempted: 0, success: 0, failed: 0 };

/**
 * Initialize IntersectionObserver for lazy loading images
 */
function initImageObserver() {
  if (!('IntersectionObserver' in window)) {
    console.warn('[UI] IntersectionObserver not supported, images will not lazy load');
    return;
  }
  
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          imageLoadStats.attempted++;
          
          // Set up load/error handlers before setting src
          img.onload = () => {
            imageLoadStats.success++;
            img.classList.remove('search-card__skeleton', 'content-card__skeleton');
            img.style.opacity = '1';
            // Log periodically, not every image
            if (imageLoadStats.success % 50 === 0) {
              console.log(`[UI] Image load progress: ${imageLoadStats.success} loaded, ${imageLoadStats.failed} failed of ${imageLoadStats.attempted} attempted`);
            }
          };
          
          img.onerror = () => {
            imageLoadStats.failed++;
            console.warn(`[UI] Image failed to load (${imageLoadStats.failed}):`, src.substring(0, 100) + '...');
            // Hide the broken image, placeholder will show
            img.style.display = 'none';
            img.classList.remove('search-card__skeleton', 'content-card__skeleton');
          };
          
          img.src = src;
          img.removeAttribute('data-src');
        }
        imageObserver.unobserve(img);
      }
    });
  }, {
    rootMargin: '200px', // Start loading 200px before entering viewport
    threshold: 0.01
  });
  
  console.log('[UI] Image observer initialized');
}

/**
 * Enter search overlay mode
 */
export function enterSearchMode() {
  if (searchOverlayActive) return;
  
  searchOverlayActive = true;
  searchOverlayQuery = '';
  searchOverlayResults = [];
  
  // Show overlay
  if (elements.searchOverlay) {
    elements.searchOverlay.hidden = false;
  }
  
  // Clear and focus input
  if (elements.searchOverlayInput) {
    elements.searchOverlayInput.value = '';
    // Small delay to allow animation
    setTimeout(() => elements.searchOverlayInput.focus(), 100);
  }
  
  // Reset filter to 'all'
  setSearchFilter('all');
  
  // Show initial state
  showSearchState('initial');
  
  // Blur header search input
  elements.searchInput?.blur();
  
  // Trigger on-demand loading of VOD/Series (if not already loaded)
  // This runs in background and updates allSearchableItems when complete
  if (window.loadVodSeriesOnDemand) {
    // Show loading indicator
    showSearchLoadingIndicator(true);
    
    window.loadVodSeriesOnDemand().then(loaded => {
      // Hide loading indicator
      showSearchLoadingIndicator(false);
      
      if (loaded && searchOverlayQuery) {
        // Re-run search with newly loaded data
        performOverlaySearch();
      }
    }).catch(() => {
      // Hide on error too
      showSearchLoadingIndicator(false);
    });
  }
  
  console.log('[UI] Entered search mode');
}

/**
 * Show/hide the "Loading movies & series..." indicator
 */
function showSearchLoadingIndicator(show) {
  if (elements.searchLoadingIndicator) {
    elements.searchLoadingIndicator.hidden = !show;
  }
}

/**
 * Exit search overlay mode
 */
export function exitSearchMode() {
  if (!searchOverlayActive) return;
  
  searchOverlayActive = false;
  searchOverlayQuery = '';
  searchOverlayResults = [];
  
  // Hide overlay
  if (elements.searchOverlay) {
    elements.searchOverlay.hidden = true;
  }
  
  // Clear grid
  if (elements.searchGrid) {
    elements.searchGrid.innerHTML = '';
  }
  
  // Hide loading indicator
  showSearchLoadingIndicator(false);
  
  console.log('[UI] Exited search mode');
}

/**
 * Handle search input in overlay
 */
function handleOverlaySearch(e) {
  searchOverlayQuery = e.target.value.trim();
  
  if (!searchOverlayQuery) {
    searchOverlayResults = [];
    showSearchState('initial');
    updateSearchResultCount();
    return;
  }
  
  // Show loading briefly
  showSearchState('loading');
  
  // Perform search
  performOverlaySearch();
}

/**
 * Perform the actual search across all items
 */
function performOverlaySearch() {
  const q = searchOverlayQuery.toLowerCase();
  
  // Filter by search query
  let results = allSearchableItems.filter(item => 
    item.name.toLowerCase().includes(q)
  );
  
  // Apply type filter
  if (searchOverlayFilter !== 'all') {
    results = results.filter(item => {
      const type = item.type || 'live';
      return type === searchOverlayFilter;
    });
  }
  
  // Pre-calculate scores for locale sorting (O(n) instead of O(n log n))
  if (localeModule) {
    results.forEach(item => {
      item._localeScore = localeModule.getScore(item.name);
    });
  }
  
  // Sort by: locale score > exact match > starts-with > alphabetical
  results.sort((a, b) => {
    // 1. Locale score (higher = better)
    if (localeModule) {
      const scoreDiff = (b._localeScore || 0) - (a._localeScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
    }
    
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    
    // 2. Exact search match
    const aExact = aName === q;
    const bExact = bName === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // 3. Starts-with
    const aStarts = aName.startsWith(q);
    const bStarts = bName.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    // 4. Alphabetical
    return aName.localeCompare(bName);
  });
  
  // Clean up temp scores
  results.forEach(item => delete item._localeScore);
  
  // Limit results for performance
  searchOverlayResults = results.slice(0, MAX_SEARCH_RESULTS);
  
  // Update UI
  updateSearchResultCount(results.length);
  
  if (searchOverlayResults.length === 0) {
    showSearchState('empty');
  } else {
    showSearchState('results');
    renderSearchGrid();
  }
}

/**
 * Clear search in overlay
 */
function clearOverlaySearch() {
  searchOverlayQuery = '';
  searchOverlayResults = [];
  
  if (elements.searchOverlayInput) {
    elements.searchOverlayInput.value = '';
    elements.searchOverlayInput.focus();
  }
  
  showSearchState('initial');
  updateSearchResultCount();
}

/**
 * Set search filter (all/live/vod/series)
 */
function setSearchFilter(filter) {
  searchOverlayFilter = filter;
  
  // Update active state on buttons
  elements.searchFilters?.querySelectorAll('.search-filter').forEach(btn => {
    btn.classList.toggle('search-filter--active', btn.dataset.filter === filter);
  });
  
  // Re-run search if there's a query
  if (searchOverlayQuery) {
    performOverlaySearch();
  }
}

/**
 * Show search state (initial/loading/results/empty)
 */
function showSearchState(state) {
  if (elements.searchInitial) elements.searchInitial.hidden = state !== 'initial';
  if (elements.searchLoading) elements.searchLoading.hidden = state !== 'loading';
  if (elements.searchEmpty) elements.searchEmpty.hidden = state !== 'empty';
  if (elements.searchGrid) elements.searchGrid.hidden = state !== 'results';
}

/**
 * Update search result count display
 */
function updateSearchResultCount(totalFound = 0) {
  if (!elements.searchResultCount) return;
  
  if (!searchOverlayQuery) {
    elements.searchResultCount.textContent = 'Type to search...';
  } else if (totalFound === 0) {
    elements.searchResultCount.textContent = 'No results found';
  } else if (totalFound > MAX_SEARCH_RESULTS) {
    elements.searchResultCount.textContent = `Showing ${MAX_SEARCH_RESULTS} of ${totalFound} results`;
  } else {
    elements.searchResultCount.textContent = `${totalFound} result${totalFound !== 1 ? 's' : ''}`;
  }
}

/**
 * Render search results as a grid
 */
function renderSearchGrid() {
  if (!elements.searchGrid) return;
  
  // Clear existing content
  elements.searchGrid.innerHTML = '';
  
  // Create document fragment for performance
  const fragment = document.createDocumentFragment();
  
  searchOverlayResults.forEach((item, index) => {
    const card = createSearchCard(item, index);
    fragment.appendChild(card);
  });
  
  elements.searchGrid.appendChild(fragment);
  
  // Observe images for lazy loading
  if (imageObserver) {
    elements.searchGrid.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback: load all images immediately
    elements.searchGrid.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
}

/**
 * Create a search result card element
 * PERF: Uses template cloning when available (faster than innerHTML)
 */
function createSearchCard(item, index) {
  const type = item.type || 'live';
  const template = elements.searchCardTemplate?.content;
  
  // Build meta text
  let meta = '';
  if (type === 'live' && item.epgId) {
    const nowInfo = epg.getNow(item.epgId);
    meta = nowInfo ? nowInfo.title : item.group || '';
  } else if (type === 'vod') {
    meta = [item.year, item.genre, item.duration].filter(Boolean).join(' • ');
  } else if (type === 'series') {
    meta = [item.year, item.genre].filter(Boolean).join(' • ');
  }
  
  // Get image URL (with proxy if needed)
  const imageUrl = item.logo ? applyProxyToUrl(item.logo) : '';
  
  let card;
  
  if (template) {
    // PERF: Clone template (faster than innerHTML parsing)
    card = template.cloneNode(true).firstElementChild;
    
    // Set attributes
    card.dataset.id = item.id;
    card.dataset.type = type;
    card.setAttribute('aria-label', `${item.name} - ${getTypeLabel(type)}`);
    
    // Image/Placeholder
    const imgEl = card.querySelector('.search-card__image');
    const placeholderEl = card.querySelector('.search-card__placeholder');
    
    if (imageUrl) {
      if (imgEl) {
        imgEl.dataset.src = imageUrl;
        imgEl.style.display = '';
        imgEl.onerror = () => {
          imgEl.style.display = 'none';
          if (placeholderEl) {
            placeholderEl.textContent = getInitials(item.name);
            placeholderEl.style.display = '';
          }
        };
      }
      if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
      if (imgEl) imgEl.style.display = 'none';
      if (placeholderEl) {
        placeholderEl.textContent = getInitials(item.name);
        placeholderEl.style.display = '';
      }
    }
    
    // Badge
    const badgeEl = card.querySelector('.search-card__badge');
    if (badgeEl) {
      badgeEl.className = `search-card__badge search-card__badge--${type}`;
      badgeEl.innerHTML = type === 'live'
        ? `${getBadgeIcon(type)}<span class="search-card__live-indicator"><span class="search-card__live-dot"></span>LIVE</span>`
        : `${getBadgeIcon(type)}${getTypeLabel(type).toUpperCase()}`;
    }
    
    // Title
    const titleEl = card.querySelector('.search-card__title');
    if (titleEl) titleEl.textContent = item.name;
    
    // Meta
    const metaEl = card.querySelector('.search-card__meta');
    if (metaEl) {
      if (meta) {
        metaEl.textContent = meta;
        metaEl.style.display = '';
      } else {
        metaEl.style.display = 'none';
      }
    }
  } else {
    // Fallback: create with innerHTML (for older browsers without template support)
    card = document.createElement('div');
    card.className = 'search-card';
    card.dataset.id = item.id;
    card.dataset.type = type;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${item.name} - ${getTypeLabel(type)}`);
    
    card.innerHTML = `
      <div class="search-card__image-container">
        ${imageUrl 
          ? `<img class="search-card__image search-card__skeleton" data-src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'search-card__placeholder\\'>${escapeHtml(getInitials(item.name))}</div>'">`
          : `<div class="search-card__placeholder">${escapeHtml(getInitials(item.name))}</div>`
        }
        <div class="search-card__badge search-card__badge--${type}">
          ${getBadgeIcon(type)}
          ${type === 'live' 
            ? `<span class="search-card__live-indicator"><span class="search-card__live-dot"></span>LIVE</span>` 
            : getTypeLabel(type).toUpperCase()
          }
        </div>
        <div class="search-card__play">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      </div>
      <div class="search-card__content">
        <div class="search-card__title">${escapeHtml(item.name)}</div>
        ${meta ? `<div class="search-card__meta">${escapeHtml(meta)}</div>` : ''}
      </div>
    `;
  }
  
  // Click and keyboard handlers are handled via event delegation
  // (initSearchOverlayDelegation and initContentGridDelegation)
  
  return card;
}

/**
 * Handle click on a search result card
 * Works for both search overlay AND content grid
 */
function handleSearchCardClick(item) {
  const type = item.type || 'live';
  
  if (type === 'series') {
    // For series, load episode picker
    window.app?.loadSeriesDetails?.(item.id);
    // Only close search if we're in search overlay
    if (isSearchOverlayOpen()) {
      closeSearchOverlay();
    }
  } else {
    // For live/VOD, play directly
    selectedChannelId = item.id;
    
    if (type === 'live') {
      storage.addRecent(item.id);
      updateCounts();
    }
    
    // Update now playing panel
    updateNowPlayingPanel(item);
    
    // Only exit search mode if we're in search overlay
    if (isSearchOverlayOpen()) {
      exitSearchMode();
    }
    
    onChannelSelect(item);
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }
}

/**
 * Check if search overlay is currently open
 */
function isSearchOverlayOpen() {
  return elements.searchOverlay && !elements.searchOverlay.hidden;
}

/**
 * Get badge icon HTML for type
 */
function getBadgeIcon(type) {
  switch (type) {
    case 'live':
      return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
        <polyline points="17 2 12 7 7 2"/>
      </svg>`;
    case 'vod':
      return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>`;
    case 'series':
      return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 11a9 9 0 0 1 9 9"/>
        <path d="M4 4a16 16 0 0 1 16 16"/>
        <circle cx="5" cy="19" r="2"/>
      </svg>`;
    default:
      return '';
  }
}

/**
 * Get type label
 */
function getTypeLabel(type) {
  switch (type) {
    case 'live': return 'Live';
    case 'vod': return 'Movie';
    case 'series': return 'Series';
    default: return '';
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Debounce function
 * @param {Function} fn 
 * @param {number} delay 
 */
function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Escape HTML entities
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get initials from name
 * @param {string} name 
 * @returns {string}
 */
function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return name.substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Force refresh of channel list
 */
export function refresh() {
  updateCounts();
  renderChannels();
}

/**
 * Full refresh after locale change - re-renders groups and channels with new sorting
 */
export function refreshForLocaleChange() {
  console.log('[UI] Refreshing for locale change');
  
  // Re-sort and re-render based on current content type
  if (currentContentType === 'live') {
    applyFilters();  // Re-sorts filtered channels
    renderGroups();  // Re-sorts groups
    renderChannels();
  } else {
    // VOD/Series - re-render categories and items
    renderVodSeriesCategories();
    if (currentItems.length > 0) {
      renderContentGrid(currentItems);
    }
  }
  
  updateCounts();
}
