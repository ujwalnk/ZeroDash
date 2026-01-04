// Developer overlay for displaying screen size and layout info
// Supports right-click menu for layout switching

export function createDevOverlay(layouts, currentLayoutName) {
  // Remove existing overlay and menu if present
  const existing = document.getElementById('dev-overlay');
  if (existing) {
    existing.remove();
  }
  const existingMenu = document.getElementById('dev-overlay-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'dev-overlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    text-align: right;
    z-index: 10000;
    pointer-events: none;
    user-select: none;
  `;

  // Create content container that can receive right-clicks
  const content = document.createElement('div');
  content.style.cssText = `
    pointer-events: auto;
    cursor: default;
  `;

  // Create text elements
  const sizeText = document.createElement('div');
  sizeText.id = 'dev-overlay-size';
  sizeText.style.cssText = `
    text-align: right;
    white-space: nowrap;
  `;

  const layoutText = document.createElement('div');
  layoutText.id = 'dev-overlay-layout';
  layoutText.style.cssText = `
    text-align: right;
    white-space: nowrap;
  `;

  // Append elements first
  content.appendChild(layoutText);
  content.appendChild(sizeText);
  overlay.appendChild(content);

  // Update initial content after elements are in DOM
  updateSize(overlay);
  updateLayout(overlay, currentLayoutName);

  // Create context menu (initially hidden)
  const menu = createContextMenu(layouts);
  document.body.appendChild(menu);

  // Handle right-click on overlay
  content.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu(menu, e.clientX, e.clientY);
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !content.contains(e.target)) {
      hideMenu(menu);
    }
  });

  // Append overlay to body
  document.body.appendChild(overlay);

  return overlay;
}

function updateSize(overlay) {
  const sizeText = overlay.querySelector('#dev-overlay-size');
  if (sizeText) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    sizeText.textContent = `${width} × ${height}`;
  }
}

function updateLayout(overlay, layoutName) {
  const layoutText = overlay.querySelector('#dev-overlay-layout');
  if (layoutText) {
    layoutText.textContent = `${layoutName}`;
  }
}

export function updateDevOverlay(overlay, layoutName) {
  if (!overlay) return;
  updateSize(overlay);
  updateLayout(overlay, layoutName);
}

function createContextMenu(layouts) {
  const menu = document.createElement('div');
  menu.id = 'dev-overlay-menu';
  menu.style.cssText = `
    position: fixed;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    border-radius: 4px;
    padding: 4px 0;
    font-size: 12px;
    font-family: monospace;
    z-index: 10001;
    display: none;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    min-width: 120px;
  `;

  // Create menu items for each layout
  layouts.forEach((layout) => {
    const item = document.createElement('div');
    item.textContent = layout.name;
    item.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      text-align: left;
      white-space: nowrap;
    `;

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchLayout(layout.name);
      hideMenu(menu);
    });

    menu.appendChild(item);
  });

  return menu;
}

function showMenu(menu, x, y) {
  // Position menu initially at cursor
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'block';
  
  // After showing, adjust position to keep it on screen
  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    // Adjust if menu would go off-screen
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - 10;
    }
    if (left < 0) left = 10;
    if (top < 0) top = 10;
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  });
}

function hideMenu(menu) {
  menu.style.display = 'none';
}

function switchLayout(layoutName) {
  // Update URL to /<layoutName>
  const newPath = `/${layoutName}`;
  window.location.href = newPath;
}

