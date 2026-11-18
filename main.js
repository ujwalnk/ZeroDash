import { loadConfig } from './core/configStore.js';
import { selectLayout } from './core/layoutSelector.js';
import { renderLayout } from './core/renderer.js';
import { fitAllLabels } from './core/textFitter.js';
import { createDevOverlay, updateDevOverlay } from './core/devOverlay.js';
import { initSearch } from './core/search.js';

async function init() {
  try {
    const { config: dashboardConfig, source } = await loadConfig();

    // Validate root config structure
    if (!dashboardConfig || typeof dashboardConfig !== 'object') {
      throw new Error('Dashboard config must be an object');
    }

    const allowedKeys = ['layouts', 'search'];
    const keys = Object.keys(dashboardConfig);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in dashboard config: ${unknownKeys.join(', ')}`);
    }

    if (!Array.isArray(dashboardConfig.layouts)) {
      throw new Error('Dashboard config must have a layouts array');
    }

    if (dashboardConfig.search !== undefined &&
        (!dashboardConfig.search || typeof dashboardConfig.search !== 'object' || Array.isArray(dashboardConfig.search))) {
      throw new Error('Dashboard config "search" must be an object if provided');
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
    const searchEngine = initSearch(dashboardConfig, dashboardConfig.search ?? {});

    // Edit button (editor code is only downloaded when it is clicked)
    mountEditButton(() => import('./core/editor/editor.js').then(m => {
      document.getElementById('zd-edit-btn')?.remove();
      document.getElementById('dev-overlay')?.remove();
      document.getElementById('dev-overlay-menu')?.remove();
      m.startEditor({ config: dashboardConfig, layoutName: currentLayoutName, container, source });
    }));
    if (location.hash === '#edit') document.getElementById('zd-edit-btn')?.click();

    // Handle window resize for media query changes and text fitting
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (document.body.classList.contains('zd-editing')) return; // editor manages its own stage
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

function mountEditButton(onClick) {
  const btn = document.createElement('button');
  btn.id = 'zd-edit-btn';
  btn.type = 'button';
  btn.title = 'Edit dashboard';
  btn.setAttribute('aria-label', 'Edit dashboard');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  btn.addEventListener('click', onClick);
  document.body.appendChild(btn);
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

