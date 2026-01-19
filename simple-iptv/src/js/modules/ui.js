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

// Virtual scrolling state
const ITEM_HEIGHT = 48;
const BUFFER_SIZE = 10;
let scrollTop = 0;
let viewportHeight = 0;

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
    
    // Counts
    countAll: document.getElementById('count-all'),
    countFavorites: document.getElementById('count-favorites'),
    countRecents: document.getElementById('count-recents'),
    
    // Search
    searchInput: document.getElementById('search-input'),
    
    // Player area
    onboarding: document.getElementById('onboarding'),
    player: document.getElementById('player'),
    playerLoading: document.getElementById('player-loading'),
    playerError: document.getElementById('player-error'),
    errorMessage: document.getElementById('error-message'),
    nowPlaying: document.getElementById('now-playing'),
    
    // EPG
    epgNowTitle: document.getElementById('epg-now-title'),
    epgNextTitle: document.getElementById('epg-next-title'),
    epgNextTime: document.getElementById('epg-next-time'),
    epgProgressFill: document.getElementById('epg-progress-fill'),
    
    // Toasts
    toastContainer: document.getElementById('toast-container'),
  };
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize virtual scrolling
  initVirtualScroll();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search
  elements.searchInput?.addEventListener('input', debounce(handleSearch, 150));
  
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
}

/**
 * Initialize virtual scrolling
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
}

/**
 * Set channels data
 * @param {Array} channelList 
 */
export function setChannels(channelList) {
  channels = channelList;
  applyFilters();
  updateCounts();
  renderGroups();
  renderChannels();
}

/**
 * Get groups from channels
 * @returns {Array<string>}
 */
function getGroups() {
  const groups = new Set();
  channels.forEach(ch => groups.add(ch.group));
  return Array.from(groups).sort((a, b) => a.localeCompare(b));
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
  } else if (currentCategory !== '__all__') {
    result = result.filter(ch => ch.group === currentCategory);
  }
  
  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(ch => ch.name.toLowerCase().includes(q));
  }
  
  filteredChannels = result;
}

/**
 * Select category
 * @param {string} category 
 */
export function selectCategory(category) {
  currentCategory = category;
  
  // Update active state
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.classList.toggle('category-item--active', btn.dataset.category === category);
  });
  
  applyFilters();
  scrollTop = 0;
  if (elements.channelViewport) {
    elements.channelViewport.scrollTop = 0;
  }
  renderChannels();
  
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
  applyFilters();
  scrollTop = 0;
  if (elements.channelViewport) {
    elements.channelViewport.scrollTop = 0;
  }
  renderChannels();
}

/**
 * Render channels with virtual scrolling
 */
function renderChannels() {
  if (!elements.channelContent) return;
  
  const totalHeight = filteredChannels.length * ITEM_HEIGHT;
  elements.channelContent.style.height = `${totalHeight}px`;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    filteredChannels.length,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );
  
  // Get visible channels
  const visibleChannels = filteredChannels.slice(startIndex, endIndex);
  const favorites = storage.getFavorites();
  
  // Render
  elements.channelContent.innerHTML = visibleChannels.map((channel, i) => {
    const actualIndex = startIndex + i;
    const top = actualIndex * ITEM_HEIGHT;
    const isFavorite = favorites.includes(channel.id);
    const isActive = channel.id === selectedChannelId;
    
    // Get EPG info if available
    const nowInfo = epg.getNow(channel.epgId);
    const epgText = nowInfo ? nowInfo.title : '';
    
    return `
      <div class="channel-item ${isActive ? 'channel-item--active' : ''}" 
           data-id="${channel.id}" 
           style="top: ${top}px">
        ${channel.logo 
          ? `<img class="channel-logo" src="${escapeHtml(applyProxyToUrl(channel.logo))}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="channel-logo channel-logo--placeholder">${getInitials(channel.name)}</div>`
        }
        <div class="channel-info">
          <div class="channel-name">${escapeHtml(channel.name)}</div>
          ${epgText ? `<div class="channel-epg">${escapeHtml(epgText)}</div>` : ''}
        </div>
        <button class="channel-favorite ${isFavorite ? 'channel-favorite--active' : ''}" 
                data-favorite="${channel.id}"
                title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
          <svg class="icon" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  elements.channelContent.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.channel-favorite')) return;
      const id = item.dataset.id;
      const channel = channels.find(ch => ch.id === id);
      if (channel) {
        selectChannel(channel);
      }
    });
  });
  
  elements.channelContent.querySelectorAll('.channel-favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.favorite;
      storage.toggleFavorite(id);
      updateCounts();
      if (currentCategory === '__favorites__') {
        applyFilters();
      }
      renderChannels();
      onFavoriteToggle(id);
    });
  });
}

/**
 * Select a channel
 * @param {Object} channel 
 */
export function selectChannel(channel) {
  selectedChannelId = channel.id;
  storage.addRecent(channel.id);
  updateCounts();
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
  if (elements.player) elements.player.hidden = true;
}

/**
 * Show player view
 */
export function showPlayer() {
  if (elements.onboarding) elements.onboarding.hidden = true;
  if (elements.player) elements.player.hidden = false;
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
  
  if (elements.epgNowTitle) {
    elements.epgNowTitle.textContent = now?.title || '—';
  }
  
  if (elements.epgNextTitle) {
    elements.epgNextTitle.textContent = next?.title || '—';
  }
  
  if (elements.epgNextTime) {
    elements.epgNextTime.textContent = next ? epg.formatTime(next.start) : '';
  }
  
  if (elements.epgProgressFill && now) {
    const progress = epg.getProgress(now);
    elements.epgProgressFill.style.width = `${progress}%`;
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
  // Don't handle if in input
  if (e.target.matches('input, textarea')) {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }
  
  switch (e.key) {
    case '/':
      e.preventDefault();
      elements.searchInput?.focus();
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
