import { Tile } from './Tile.js';
import { renderText } from '../../widgets/text.js';

export class TextTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('TextTile config must be an object');
    }

    const allowedKeys = ['text', 'url', 'method', 'payload', 'jsonPath', 'refreshInterval', 'css'];
    const unknownKeys = Object.keys(config).filter(key => !allowedKeys.includes(key));
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in TextTile config: ${unknownKeys.join(', ')}`);
    }

    for (const key of ['text', 'url', 'jsonPath', 'css']) {
      if (config[key] !== undefined && typeof config[key] !== 'string') {
        throw new Error(`TextTile config ${key} must be a string if provided`);
      }
    }

    if (!config.text && !config.url) {
      throw new Error('TextTile config needs text, a url to fetch it from, or both');
    }

    if (config.method !== undefined && config.method !== 'GET' && config.method !== 'POST') {
      throw new Error('TextTile config method must be GET or POST');
    }

    if (config.payload !== undefined && (typeof config.payload !== 'object' || config.payload === null || Array.isArray(config.payload))) {
      throw new Error('TextTile config payload must be an object if provided');
    }

    if (config.refreshInterval !== undefined && (typeof config.refreshInterval !== 'number' || config.refreshInterval < 0)) {
      throw new Error('TextTile config refreshInterval must be a number >= 0 if provided');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    this.handle = renderText(tileElement, this.config);
    return tileElement;
  }

  destroy() {
    this.handle?.destroy();
  }
}
