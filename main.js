import { dashboardConfig } from './user/config.js';
import { selectLayout } from './core/layoutSelector.js';
import { renderLayout } from './core/renderer.js';
import { fitAllLabels } from './core/textFitter.js';
import { createDevOverlay, updateDevOverlay } from './core/devOverlay.js';
import { initSearch } from './core/search.js';
import { searchConfig } from './user/searchConfig.js';

function init() {
  try {
    // Validate root config structure
    if (!dashboardConfig || typeof dashboardConfig !== 'object') {
      throw new Error('Dashboard config must be an object');
    }

    const allowedKeys = ['layouts'];
    const keys = Object.keys(dashboardConfig);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in dashboard config: ${unknownKeys.join(', ')}`);
    }

    if (!Array.isArray(dashboardConfig.layouts)) {
      throw new Error('Dashboard config must have a layouts array');
    }

    // Select layout based on rules
    const selectedLayout = selectLayout(dashboardConfig.layouts);
    console.log('Selected layout:', selectedLayout.name);

    // Get container
    const container = document.getElementById('dashboard');
    if (!container) {
      throw new Error('Dashboard container element not found');
    }

    // Render layout
    renderLayout(selectedLayout, container);

    // Track current layout name for resize handler
    let currentLayoutName = selectedLayout.name;

    // Create developer overlay
    let devOverlay = createDevOverlay(dashboardConfig.layouts, currentLayoutName);

    // Initialize global search
    const searchEngine = initSearch(dashboardConfig, searchConfig);

    // Handle window resize for media query changes and text fitting
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Update overlay size immediately
        updateDevOverlay(devOverlay, currentLayoutName);

        // Only re-select if no URL override (to avoid breaking override)
        if (!getUrlOverride()) {
          try {
            const newLayout = selectLayout(dashboardConfig.layouts);
            if (newLayout.name !== currentLayoutName) {
              currentLayoutName = newLayout.name;
              renderLayout(newLayout, container);
              // Update overlay with new layout name
              updateDevOverlay(devOverlay, currentLayoutName);
            } else {
              // Layout didn't change, but window resized - re-fit text
              requestAnimationFrame(() => {
                fitAllLabels(container);
              });
            }
          } catch (error) {
            console.error('Layout reselection error:', error);
          }
        } else {
          // URL override active - just re-fit text on resize
          requestAnimationFrame(() => {
            fitAllLabels(container);
          });
        }
      }, 250);
    });

  } catch (error) {
    console.error('Fatal error initializing dashboard:', error);
    const container = document.getElementById('dashboard');
    if (container) {
      container.innerHTML = `<div style="padding: 20px; color: red; font-size: 1.2em;">Fatal Error: ${error.message}</div>`;
    }
  }
}

function getUrlOverride() {
  const pathname = window.location.pathname;
  
  // Check path: /<layoutName> (highest priority - direct path)
  if (pathname !== '/' && pathname.length > 1) {
    const directMatch = pathname.match(/^\/([^\/]+)$/);
    if (directMatch) {
      const layoutName = decodeURIComponent(directMatch[1]);
      // Only return if it's not a common path like "index.html"
      if (layoutName && !layoutName.includes('.')) {
        return layoutName;
      }
    }
  }

  // Check path: /layout/<layoutName>
  const pathMatch = pathname.match(/\/layout\/([^\/]+)/);
  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }
  
  // Check query parameter: ?layout=<layoutName>
  const params = new URLSearchParams(window.location.search);
  return params.get('layout') ? decodeURIComponent(params.get('layout')) : null;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

