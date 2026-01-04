import { TileFactory } from './TileFactory.js';
import { fitAllLabels } from './textFitter.js';

export function renderLayout(layout, container) {
  if (!layout || typeof layout !== 'object') {
    throw new Error('Layout must be an object');
  }

  // Validate layout structure strictly
  validateLayout(layout);

  // Clear container
  container.innerHTML = '';

  // Set up CSS Grid
  container.style.display = 'grid';
  container.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  container.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
  container.style.gap = '10px';
  container.style.width = '100%';
  container.style.height = '100%';

  // Create and render tiles
  if (Array.isArray(layout.tiles)) {
    TileFactory.createAll(layout.tiles, container);
    
    // Apply text fitting after tiles are rendered
    // Use requestAnimationFrame to ensure DOM is fully laid out
    requestAnimationFrame(() => {
      fitAllLabels(container);
    });
  }
}

function validateLayout(layout) {
  const allowedKeys = ['name', 'mediaQuery', 'rows', 'columns', 'tiles'];
  const keys = Object.keys(layout);
  const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
  
  if (unknownKeys.length > 0) {
    throw new Error(`Unknown keys in layout: ${unknownKeys.join(', ')}`);
  }

  if (typeof layout.name !== 'string' || !layout.name) {
    throw new Error('Layout must have a valid name string');
  }

  if (layout.mediaQuery !== undefined && typeof layout.mediaQuery !== 'string') {
    throw new Error('Layout mediaQuery must be a string if provided');
  }

  if (typeof layout.rows !== 'number' || layout.rows <= 0) {
    throw new Error('Layout rows must be a positive number');
  }

  if (typeof layout.columns !== 'number' || layout.columns <= 0) {
    throw new Error('Layout columns must be a positive number');
  }

  if (!Array.isArray(layout.tiles)) {
    throw new Error('Layout tiles must be an array');
  }
}

