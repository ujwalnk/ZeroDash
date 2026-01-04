import { Tile } from './Tile.js';
import { renderLink } from '../../widgets/link.js';

export class LinkTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('LinkTile config must be an object');
    }

    const allowedKeys = ['image', 'label', 'url', 'target', 'statusCheckUrl'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in LinkTile config: ${unknownKeys.join(', ')}`);
    }

    if (config.image !== undefined && typeof config.image !== 'string') {
      throw new Error('LinkTile config image must be a string if provided');
    }

    if (typeof config.label !== 'string' || !config.label) {
      throw new Error('LinkTile config must have a valid label string');
    }

    if (typeof config.url !== 'string' || !config.url) {
      throw new Error('LinkTile config must have a valid url string');
    }

    if (config.target !== 'new' && config.target !== 'same') {
      throw new Error('LinkTile config target must be "new" or "same"');
    }

    if (config.statusCheckUrl !== undefined && typeof config.statusCheckUrl !== 'string') {
      throw new Error('LinkTile config statusCheckUrl must be a string if provided');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    renderLink(tileElement, {
      image: this.config.image,
      label: this.config.label,
      url: this.config.url,
      target: this.config.target,
      statusCheckUrl: this.config.statusCheckUrl
    });

    return tileElement;
  }
}

