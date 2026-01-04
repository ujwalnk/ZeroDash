/**
 * GLOBAL COMMAND PALETTE SEARCH
 * 
 * State Machine:
 * - IDLE: No overlay visible, normal dashboard behavior
 * - OPENING: Triggered by first printable key, overlay created, input focused
 * - ACTIVE: User typing, results updating, keyboard navigation active
 * - EXECUTING: Result chosen, action performed, no further input
 * - DISMISSING: Overlay removed, state reset, return to IDLE
 */

export class SearchEngine {
  constructor(dashboardConfig, searchConfig = {}) {
    this.dashboardConfig = dashboardConfig;
    this.searchConfig = searchConfig;
    
    // Default prefix configuration
    this.defaultPrefixes = {
      '@': ['application'],
      '#': ['application', 'link'],
      '/': ['button'],
      '.': ['toggle']
    };
    
    // Merge custom prefixes with defaults
    this.prefixes = { ...this.defaultPrefixes, ...searchConfig.prefixes };
    
    // Validate prefixes
    this.validatePrefixes();
    
    // State management
    this.state = 'IDLE';
    this.selectedIndex = 0;
    this.currentQuery = '';
    this.currentResults = [];
    
    // DOM elements
    this.overlay = null;
    this.searchInput = null;
    this.resultsList = null;
    
    // Event listeners tracking
    this.listeners = {
      keydown: null,
      click: null,
      input: null
    };
    
    // Build search index from all layouts
    this.buildSearchIndex();
  }
  
  /**
   * Validate prefix configuration
   */
  validatePrefixes() {
    const allowedTypes = ['application', 'link', 'button', 'toggle', 'widget'];
    
    for (const [prefix, types] of Object.entries(this.prefixes)) {
      if (!Array.isArray(types)) {
        console.warn(`Invalid prefix config for "${prefix}": types must be an array`);
        delete this.prefixes[prefix];
        continue;
      }
      
      for (const type of types) {
        if (!allowedTypes.includes(type)) {
          console.warn(`Invalid tile type "${type}" in prefix "${prefix}"`);
        }
      }
    }
  }
  
  /**
   * Build search index from all layouts in dashboardConfig
   * Extracts searchable tiles: applications, links, buttons, toggles
   */
  buildSearchIndex() {
    this.searchIndex = [];
    
    if (!this.dashboardConfig.layouts || !Array.isArray(this.dashboardConfig.layouts)) {
      console.error('Invalid dashboardConfig: no layouts array');
      return;
    }
    
    for (const layout of this.dashboardConfig.layouts) {
      if (!layout.tiles || !Array.isArray(layout.tiles)) {
        console.warn(`Layout "${layout.name}" has no tiles array`);
        continue;
      }
      
      for (const tile of layout.tiles) {
        this.indexTile(tile);
      }
    }
    
    console.log(`[Search] Indexed ${this.searchIndex.length} searchable items from ${this.dashboardConfig.layouts.length} layouts`);
  }
  
  /**
   * Index a single tile if it's searchable
   */
  indexTile(tileConfig) {
    const type = tileConfig.type;
    const config = tileConfig.config;
    
    // Skip widgets - explicitly excluded
    if (type === 'widget') {
      return;
    }
    
    // Skip tiles without labels
    if (!config || !config.label || typeof config.label !== 'string' || !config.label.trim()) {
      console.debug(`[Search] Skipping tile: no valid label. Type: ${type}`);
      return;
    }
    
    // Index searchable types
    const searchableTypes = ['application', 'link', 'button', 'toggle'];
    
    if (searchableTypes.includes(type)) {
      this.searchIndex.push({
        type,
        label: config.label.trim(),
        config: { ...config },
        tileConfig: { ...tileConfig }
      });
    } else {
      console.debug(`[Search] Skipping tile type: ${type}`);
    }
  }
  
  /**
   * Initialize global keyboard listener
   */
  init() {
    // Global keyboard listener for search trigger
    this.listeners.keydown = (e) => this.handleGlobalKeydown(e);
    document.addEventListener('keydown', this.listeners.keydown);
    console.log('[Search] Initialized. Press any key to open search.');
    console.log(`[Search] Searchable items in index: ${this.searchIndex.length}`);
  }
  
  /**
   * Clean up all event listeners and DOM
   */
  destroy() {
    if (this.listeners.keydown) {
      document.removeEventListener('keydown', this.listeners.keydown);
    }
    this.closeSearch();
  }
  
  /**
   * Check if an element or any ancestor is an input-like element
   */
  isInputFocused() {
    const activeEl = document.activeElement;
    
    // Check direct input types
    if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
      return true;
    }
    
    // Check contenteditable
    if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    // Check if inside iframe
    try {
      return activeEl && activeEl.tagName === 'IFRAME';
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Determine if a key is printable
   */
  isPrintableKey(e) {
    // Ignore modifier keys and special keys
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return false;
    }
    
    // Allow single printable characters
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle global keydown events
   */
  handleGlobalKeydown(e) {
    if (this.state === 'IDLE') {
      // Search trigger: any printable key opens search
      if (this.isPrintableKey(e) && !this.isInputFocused()) {
        e.preventDefault();
        this.openSearch(e.key);
      }
    } else if (this.state === 'ACTIVE') {
      // Search is open - handle navigation and input
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSearch();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevious();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      }
    }
  }
  
  /**
   * Open search overlay and insert first character
   */
  openSearch(firstChar) {
    if (this.state !== 'IDLE') {
      return; // Prevent double opening
    }
    
    this.state = 'OPENING';
    
    // Create overlay and UI
    this.createSearchUI();
    
    // Insert first character
    this.searchInput.value = firstChar;
    this.currentQuery = firstChar;
    this.selectedIndex = 0;
    
    // Update results
    this.updateResults();
    
    this.state = 'ACTIVE';
    this.searchInput.focus();
  }
  
  /**
   * Create search overlay and DOM structure
   */
  createSearchUI() {
    // Create overlay backdrop
    this.overlay = document.createElement('div');
    this.overlay.className = 'search-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Create search container
    const container = document.createElement('div');
    container.className = 'search-container';
    container.style.cssText = `
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create search input
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'search-input';
    this.searchInput.placeholder = 'Search actions...';
    this.searchInput.style.cssText = `
      padding: 16px;
      border: none;
      border-bottom: 1px solid #e0e0e0;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      outline: none;
      background-color: white;
    `;
    
    // Create results list
    this.resultsList = document.createElement('div');
    this.resultsList.className = 'search-results';
    this.resultsList.style.cssText = `
      overflow-y: auto;
      max-height: calc(80vh - 56px);
      flex: 1;
    `;
    
    // Assemble UI
    container.appendChild(this.searchInput);
    container.appendChild(this.resultsList);
    this.overlay.appendChild(container);
    document.body.appendChild(this.overlay);
    
    // Event listeners
    this.listeners.input = (e) => this.handleInput(e);
    this.searchInput.addEventListener('input', this.listeners.input);
    
    this.listeners.click = (e) => this.handleClickOutside(e);
    this.overlay.addEventListener('click', this.listeners.click);
  }
  
  /**
   * Handle search input changes
   */
  handleInput(e) {
    this.currentQuery = e.target.value;
    this.selectedIndex = 0;
    this.updateResults();
  }
  
  /**
   * Handle clicks outside the search container
   */
  handleClickOutside(e) {
    if (e.target === this.overlay) {
      this.closeSearch();
    }
  }
  
  /**
   * Normalize string for comparison
   * - lowercase
   * - remove spaces
   * - remove punctuation
   */
  normalize(str) {
    return str
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^\w]/g, '');
  }
  
  /**
   * Parse query to extract prefix and search term
   */
  parseQuery(query) {
    const trimmed = query.trim();
    
    if (trimmed.length === 0) {
      return { prefix: null, searchTerm: '' };
    }
    
    // Check if first character is a prefix
    const firstChar = trimmed[0];
    
    if (this.prefixes.hasOwnProperty(firstChar)) {
      return {
        prefix: firstChar,
        searchTerm: trimmed.substring(1)
      };
    }
    
    return {
      prefix: null,
      searchTerm: trimmed
    };
  }
  
  /**
   * Filter results based on parsed query
   */
  filterResults(parsedQuery) {
    const { prefix, searchTerm } = parsedQuery;
    const normalized = this.normalize(searchTerm);
    
    let results = [];
    const seen = new Set(); // For uniqueness
    
    // Determine which types to search based on prefix
    let allowedTypes;
    
    if (prefix && this.prefixes[prefix]) {
      allowedTypes = this.prefixes[prefix];
    } else if (prefix) {
      // Invalid prefix - log warning and search all types
      console.warn(`Invalid prefix: "${prefix}"`);
      allowedTypes = ['application', 'link', 'button', 'toggle'];
    } else {
      // No prefix - search all types
      allowedTypes = ['application', 'link', 'button', 'toggle'];
    }
    
    // Search through index
    for (const item of this.searchIndex) {
      // Filter by type
      if (!allowedTypes.includes(item.type)) {
        continue;
      }
      
      // Normalize label for matching
      const normalizedLabel = this.normalize(item.label);
      
      // Substring matching
      if (normalizedLabel.includes(normalized)) {
        // Check uniqueness (label + type)
        const uniqueKey = `${item.label.toLowerCase()}|${item.type}`;
        
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          results.push(item);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Sort results by priority and relevance
   */
  sortResults(results) {
    const typePriority = {
      'application': 0,
      'link': 1,
      'button': 2,
      'toggle': 3
    };
    
    return results.sort((a, b) => {
      // Sort by type priority
      const typePriorityDiff = typePriority[a.type] - typePriority[b.type];
      if (typePriorityDiff !== 0) {
        return typePriorityDiff;
      }
      
      // Sort alphabetically by label
      return a.label.localeCompare(b.label);
    });
  }
  
  /**
   * Update search results and re-render
   */
  updateResults() {
    const parsed = this.parseQuery(this.currentQuery);
    const filtered = this.filterResults(parsed);
    const sorted = this.sortResults(filtered);
    
    this.currentResults = sorted;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.currentResults.length - 1));
    
    this.renderResults();
  }
  
  /**
   * Render search results to DOM
   */
  renderResults() {
    this.resultsList.innerHTML = '';
    
    if (this.currentResults.length === 0) {
      const noResults = document.createElement('div');
      noResults.style.cssText = `
        padding: 24px 16px;
        text-align: center;
        color: #999;
        font-size: 14px;
      `;
      noResults.textContent = 'No results found';
      this.resultsList.appendChild(noResults);
      return;
    }
    
    for (let i = 0; i < this.currentResults.length; i++) {
      const item = this.currentResults[i];
      const resultEl = this.createResultElement(item, i === this.selectedIndex);
      this.resultsList.appendChild(resultEl);
    }
    
    // Scroll selected item into view
    if (this.selectedIndex < this.currentResults.length) {
      const selectedEl = this.resultsList.children[this.selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  
  /**
   * Create a single result element
   */
  createResultElement(item, isSelected) {
    const el = document.createElement('div');
    el.className = `search-result ${isSelected ? 'selected' : ''}`;
    el.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background-color 0.15s;
      background-color: ${isSelected ? '#f5f5f5' : 'white'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      user-select: none;
    `;
    
    // Left side: icon
    const iconEl = document.createElement('img');
    iconEl.style.cssText = `
      width: 24px;
      height: 24px;
      object-fit: contain;
      flex-shrink: 0;
    `;
    
    // Get icon URL based on tile type
    const iconUrl = this.getIconUrl(item);
    if (iconUrl) {
      iconEl.src = iconUrl;
      iconEl.onerror = () => {
        // Hide icon if it fails to load
        iconEl.style.display = 'none';
      };
    } else {
      iconEl.style.display = 'none';
    }
    
    // Middle: label
    const labelEl = document.createElement('span');
    labelEl.style.cssText = `
      flex: 1;
      font-size: 14px;
      color: #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    labelEl.textContent = item.label;
    
    // Right side: type badge
    const typeEl = document.createElement('span');
    typeEl.style.cssText = `
      font-size: 12px;
      color: #999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      font-weight: 500;
      text-transform: uppercase;
      flex-shrink: 0;
    `;
    typeEl.textContent = this.getTileTypeLabel(item.type);
    
    el.appendChild(iconEl);
    el.appendChild(labelEl);
    el.appendChild(typeEl);
    
    // Click handler
    el.addEventListener('click', () => {
      this.selectedIndex = this.currentResults.indexOf(item);
      this.executeSelected();
    });
    
    return el;
  }
  
  /**
   * Get icon URL for a tile based on its type and config
   */
  getIconUrl(item) {
    const { type, config } = item;
    
    // Applications, Links, and Buttons have 'image' property
    if (['application', 'link', 'button'].includes(type) && config.image) {
      return config.image;
    }
    
    // Toggles have image URLs in targetUrl
    if (type === 'toggle' && config.targetUrl) {
      // Return the true state image as default (can be either trueImage or falseImage)
      return config.targetUrl.trueImage || config.targetUrl.falseImage;
    }
    
    return null;
  }
  
  /**
   * Get human-readable label for tile type
   */
  getTileTypeLabel(type) {
    const labels = {
      'application': 'App',
      'link': 'Link',
      'button': 'Button',
      'toggle': 'Toggle'
    };
    return labels[type] || type;
  }
  
  /**
   * Select next result
   */
  selectNext() {
    if (this.currentResults.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.currentResults.length;
    this.renderResults();
  }
  
  /**
   * Select previous result
   */
  selectPrevious() {
    if (this.currentResults.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.currentResults.length) % this.currentResults.length;
    this.renderResults();
  }
  
  /**
   * Execute selected result
   */
  executeSelected() {
    if (this.currentResults.length === 0) {
      this.closeSearch();
      return;
    }
    
    if (this.state !== 'ACTIVE') {
      return; // Prevent double execution
    }
    
    const item = this.currentResults[this.selectedIndex];
    this.state = 'EXECUTING';
    
    this.executeResult(item).then(() => {
      this.closeSearch();
    }).catch((err) => {
      console.error('Error executing search result:', err);
      this.closeSearch();
    });
  }
  
  /**
   * Execute a result based on its type
   */
  async executeResult(item) {
    const { type, config } = item;
    
    switch (type) {
      case 'application':
      case 'link':
        // Navigate to URL
        window.open(config.url, config.target === 'new' ? '_blank' : '_self');
        break;
        
      case 'button':
        // Execute button action via fetch
        await this.executeButtonAction(config);
        break;
        
      case 'toggle':
        // Execute toggle action via fetch
        await this.executeToggleAction(config);
        break;
        
      default:
        console.warn(`Unknown tile type: ${type}`);
    }
  }
  
  /**
   * Execute a button tile action
   */
  async executeButtonAction(config) {
    const { url, method, payload } = config;
    
    const options = {
      method: method || 'GET',
      headers: {}
    };
    
    if (method === 'POST' && payload) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(payload);
    }
    
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        console.error(`Button action failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Button action error:', error);
      throw error;
    }
  }
  
  /**
   * Execute a toggle tile action
   * For now, just toggle between true and false URLs
   */
  async executeToggleAction(config) {
    const { method, payload, statusCheckUrl, targetUrl } = config;
    
    try {
      // Fetch current status
      const statusResponse = await fetch(statusCheckUrl);
      let currentState = false;
      
      if (statusResponse.ok) {
        try {
          const data = await statusResponse.json();
          currentState = data === true || data.status === true || data.value === true || data.state === true;
        } catch {
          const text = await statusResponse.text();
          currentState = text.trim().toLowerCase() === 'true' || text.trim() === '1';
        }
      }
      
      // Determine which URL to use
      const toggleUrl = currentState ? targetUrl.falseUrl : targetUrl.trueUrl;
      
      // Execute toggle action
      const options = {
        method: method || 'GET',
        headers: {}
      };
      
      if (method === 'POST' && payload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }
      
      const response = await fetch(toggleUrl, options);
      if (!response.ok) {
        console.error(`Toggle action failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Toggle action error:', error);
      throw error;
    }
  }
  
  /**
   * Close search overlay and return to IDLE state
   */
  closeSearch() {
    this.state = 'DISMISSING';
    
    // Remove event listeners
    if (this.searchInput && this.listeners.input) {
      this.searchInput.removeEventListener('input', this.listeners.input);
    }
    
    if (this.overlay && this.listeners.click) {
      this.overlay.removeEventListener('click', this.listeners.click);
    }
    
    // Remove overlay from DOM
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    // Reset state
    this.overlay = null;
    this.searchInput = null;
    this.resultsList = null;
    this.currentQuery = '';
    this.currentResults = [];
    this.selectedIndex = 0;
    
    this.state = 'IDLE';
  }
}

/**
 * Initialize search engine with dashboard config and optional search config
 */
export function initSearch(dashboardConfig, searchConfig = {}) {
  const searchEngine = new SearchEngine(dashboardConfig, searchConfig);
  searchEngine.init();
  return searchEngine;
}
