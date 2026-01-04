import { Tile } from './Tile.js';
import { renderApplication } from '../../widgets/application.js';

export class ApplicationTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('ApplicationTile config must be an object');
    }

    const allowedKeys = ['image', 'label', 'url', 'target', 'availabilityUrl'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in ApplicationTile config: ${unknownKeys.join(', ')}`);
    }

    if (config.image !== undefined && typeof config.image !== 'string') {
      throw new Error('ApplicationTile config image must be a string if provided');
    }

    if (typeof config.label !== 'string' || !config.label) {
      throw new Error('ApplicationTile config must have a valid label string');
    }

    if (typeof config.url !== 'string' || !config.url) {
      throw new Error('ApplicationTile config must have a valid url string');
    }

    if (config.target !== undefined && config.target !== 'new' && config.target !== 'same') {
      throw new Error('ApplicationTile config target must be "new" or "same" if provided');
    }

    if (config.availabilityUrl !== undefined && typeof config.availabilityUrl !== 'string') {
      throw new Error('ApplicationTile config availabilityUrl must be a string if provided');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    renderApplication(tileElement, {
      image: this.config.image,
      label: this.config.label,
      url: this.config.url,
      target: this.config.target ?? 'same',
      availabilityUrl: this.config.availabilityUrl
    });

    return tileElement;
  }
}

