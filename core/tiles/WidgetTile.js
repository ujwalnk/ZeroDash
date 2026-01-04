import { Tile } from './Tile.js';

export class WidgetTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('WidgetTile config must be an object');
    }

    const allowedKeys = ['url', 'RefreshInterval'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in WidgetTile config: ${unknownKeys.join(', ')}`);
    }

    if (typeof config.url !== 'string' || !config.url) {
      throw new Error('WidgetTile config must have a valid url string');
    }

    if (typeof config.RefreshInterval !== 'number' || config.RefreshInterval < 0) {
      throw new Error('WidgetTile config must have RefreshInterval >= 0');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    const iframe = document.createElement('iframe');
    iframe.src = this.config.url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    tileElement.appendChild(iframe);

    if (this.config.RefreshInterval > 0) {
      this.intervalId = setInterval(() => {
        iframe.src = iframe.src; // Force reload
      }, this.config.RefreshInterval * 1000);
    }

    return tileElement;
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

