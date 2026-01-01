// Keyboard search functionality for dashboard tiles
(function() {
  let searchPopup = null;
  let searchInput = null;
  let searchResults = null;
  let allTiles = [];
  let filteredTiles = [];
  let selectedIndex = 0;

  // Create search popup
  function createSearchPopup() {
    searchPopup = document.createElement('div');
    searchPopup.id = 'search-popup';
    searchPopup.innerHTML = `
      <div class="search-container">
        <input type="text" id="search-input" placeholder="Search tiles..." />
        <div id="search-results"></div>
      </div>
    `;
    document.body.appendChild(searchPopup);
    
    searchInput = document.getElementById('search-input');
    searchResults = document.getElementById('search-results');
    
    // Input event listener
    searchInput.addEventListener('input', handleSearch);
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', handleKeydown);
  }

  // Handle search input
  function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (query === '') {
      filteredTiles = [...allTiles];
    } else {
      filteredTiles = allTiles.filter(tile => 
        tile.label && tile.label.toLowerCase().includes(query)
      );
    }
    
    selectedIndex = 0;
    renderResults();
  }

  // Render search results
  function renderResults() {
    searchResults.innerHTML = '';
    
    if (filteredTiles.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">No tiles found</div>';
      return;
    }
    
    filteredTiles.forEach((tile, index) => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result-item' + (index === selectedIndex ? ' selected' : '');
      
      const img = document.createElement('img');
      img.src = tile.image || '';
      img.onerror = () => { img.style.display = 'none'; };
      
      const label = document.createElement('span');
      label.textContent = tile.label || 'Unnamed';
      
      resultItem.appendChild(img);
      resultItem.appendChild(label);
      
      resultItem.addEventListener('click', () => {
        selectTile(tile);
      });
      
      searchResults.appendChild(resultItem);
    });
    
    // Scroll selected item into view
    const selectedElement = searchResults.children[selectedIndex];
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }

  // Handle keyboard navigation
  function handleKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredTiles.length - 1);
      renderResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTiles.length > 0) {
        selectTile(filteredTiles[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  }

  // Select a tile
  function selectTile(tile) {
    closeSearch();
    
    if (tile.type === 'widget') {
      // Can't navigate to widgets, they're iframes
      return;
    } else if (tile.type === 'button') {
      // Trigger button webhook
      const options = tile.method === "POST" ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tile.payload || {}),
      } : { method: "GET" };
      
      fetch(tile.url, options).catch(err => console.error("Button error:", err));
    } else if (tile.type === 'toggle') {
      // Toggle functionality - would need to check current state
      // For simplicity, just navigate to one of the URLs
      const url = tile.targetUrl?.trueUrl || tile.targetUrl?.falseUrl;
      if (url) {
        fetch(url, { method: tile.method || "GET" }).catch(err => console.error("Toggle error:", err));
      }
    } else if (tile.type === 'webhook') {
      // Trigger webhook
      fetch(tile.targetUrl || tile.url, { method: tile.method || "GET" })
        .catch(err => console.error("Webhook error:", err));
    } else if (tile.type === 'same') {
      window.location.href = tile.url;
    } else if (tile.type === 'new') {
      window.open(tile.url, '_blank');
    }
  }

  // Open search popup
  function openSearch() {
    if (!searchPopup) {
      createSearchPopup();
    }
    
    searchPopup.style.display = 'flex';
    searchInput.value = '';
    filteredTiles = [...allTiles];
    selectedIndex = 0;
    renderResults();
    
    // Focus input after a small delay to ensure it's visible
    setTimeout(() => {
      searchInput.focus();
    }, 10);
  }

  // Close search popup
  function closeSearch() {
    if (searchPopup) {
      searchPopup.style.display = 'none';
    }
  }

  // Update tiles list - called after dashboard renders
  function updateTilesList() {
    // Use allTilesConfig if it exists, otherwise fallback to current config
    if (typeof allTilesConfig !== 'undefined' && allTilesConfig.tiles) {
      allTiles = allTilesConfig.tiles.filter(tile => tile.label && tile.label.trim() !== '');
      console.log('Tiles loaded for search from allTilesConfig:', allTiles.length);
    } else {
      // Fallback: determine which config is active based on breakpoints
      let activeConfig = landscapeConfig; // default
      
      if (typeof breakpointConfigs !== 'undefined') {
        for (const bp of breakpointConfigs) {
          if (window.matchMedia(bp.mediaQuery).matches) {
            activeConfig = bp.config;
            break;
          }
        }
      } else {
        // Legacy fallback
        activeConfig = window.matchMedia("(orientation: portrait)").matches 
          ? portraitConfig 
          : landscapeConfig;
      }
      
      allTiles = activeConfig.tiles.filter(tile => tile.label && tile.label.trim() !== '');
      console.log('Tiles loaded for search from active config:', allTiles.length);
    }
  }

  // Listen for keyboard input
  document.addEventListener('keydown', (e) => {
    // Don't trigger if already in search or typing in an input
    if (searchPopup && searchPopup.style.display === 'flex') {
      return;
    }
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Check if it's a printable character
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openSearch();
      searchInput.value = e.key;
      handleSearch();
    }
  });

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    if (searchPopup && searchPopup.style.display === 'flex') {
      if (!searchPopup.contains(e.target)) {
        closeSearch();
      }
    }
  });

  // Initialize tiles list when page loads
  window.addEventListener('load', () => {
    updateTilesList();
  });

  // Update tiles list when window resizes (orientation change)
  window.addEventListener('resize', () => {
    updateTilesList();
  });

  // Expose function globally for manual updates if needed
  window.dashboardSearch = {
    updateTilesList: updateTilesList
  };
})();