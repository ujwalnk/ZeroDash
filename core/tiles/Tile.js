import { TileType } from '../TileType.js';

export class Tile {
  constructor(tileConfig) {
    this.validateTileStructure(tileConfig);
    this.validateLayout(tileConfig.layout);
    this.type = tileConfig.type;
    this.x = tileConfig.layout.x;
    this.y = tileConfig.layout.y;
    this.width = tileConfig.layout.width;
    this.height = tileConfig.layout.height;
    this.config = tileConfig.config;
  }

  validateTileStructure(tileConfig) {
    if (!tileConfig || typeof tileConfig !== 'object') {
      throw new Error('Tile config must be an object');
    }

    const allowedKeys = ['type', 'layout', 'config'];
    const keys = Object.keys(tileConfig);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in tile config: ${unknownKeys.join(', ')}`);
    }

    if (!tileConfig.type) {
      throw new Error('Tile config must have a type');
    }

    if (!Object.values(TileType).includes(tileConfig.type)) {
      throw new Error(`Invalid tile type: ${tileConfig.type}`);
    }

    if (!tileConfig.layout) {
      throw new Error('Tile config must have a layout');
    }

    if (!tileConfig.config) {
      throw new Error('Tile config must have a config');
    }
  }

  validateLayout(layout) {
    if (!layout || typeof layout !== 'object') {
      throw new Error('Layout must be an object');
    }

    const allowedKeys = ['x', 'y', 'width', 'height'];
    const keys = Object.keys(layout);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in layout: ${unknownKeys.join(', ')}`);
    }

    if (typeof layout.x !== 'number' || layout.x < 0) {
      throw new Error('Layout x must be a non-negative number');
    }

    if (typeof layout.y !== 'number' || layout.y < 0) {
      throw new Error('Layout y must be a non-negative number');
    }

    if (typeof layout.width !== 'number' || layout.width <= 0) {
      throw new Error('Layout width must be a positive number');
    }

    if (typeof layout.height !== 'number' || layout.height <= 0) {
      throw new Error('Layout height must be a positive number');
    }
  }

  render(container) {
    const tileElement = document.createElement('div');
    tileElement.className = 'tile';
    tileElement.style.gridColumn = `${this.x + 1} / ${this.x + 1 + this.width}`;
    tileElement.style.gridRow = `${this.y + 1} / ${this.y + 1 + this.height}`;
    
    container.appendChild(tileElement);
    return tileElement;
  }
}

