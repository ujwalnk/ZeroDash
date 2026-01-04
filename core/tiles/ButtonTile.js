import { Tile } from './Tile.js';
import { renderButton } from '../../widgets/button.js';

export class ButtonTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('ButtonTile config must be an object');
    }

    const allowedKeys = ['image', 'label', 'url', 'method', 'payload'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in ButtonTile config: ${unknownKeys.join(', ')}`);
    }

    if (config.image !== undefined && typeof config.image !== 'string') {
      throw new Error('ButtonTile config image must be a string if provided');
    }

    if (typeof config.label !== 'string' || !config.label) {
      throw new Error('ButtonTile config must have a valid label string');
    }

    if (typeof config.url !== 'string' || !config.url) {
      throw new Error('ButtonTile config must have a valid url string');
    }

    if (config.method !== 'GET' && config.method !== 'POST') {
      throw new Error('ButtonTile config method must be GET or POST');
    }

    if (config.payload !== undefined && (typeof config.payload !== 'object' || Array.isArray(config.payload))) {
      throw new Error('ButtonTile config payload must be an object if provided');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    renderButton(tileElement, {
      image: this.config.image,
      label: this.config.label,
      url: this.config.url,
      method: this.config.method,
      payload: this.config.payload
    });

    return tileElement;
  }
}

