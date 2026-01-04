import { Tile } from './Tile.js';
import { renderToggle } from '../../widgets/toggle.js';

export class ToggleTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('ToggleTile config must be an object');
    }

    const allowedKeys = ['label', 'displayLabel', 'method', 'payload', 'targetUrl', 'statusCheckUrl'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in ToggleTile config: ${unknownKeys.join(', ')}`);
    }

    if (typeof config.label !== 'string' || !config.label) {
      throw new Error('ToggleTile config must have a valid label string');
    }

    if (typeof config.displayLabel !== 'boolean') {
      throw new Error('ToggleTile config displayLabel must be a boolean');
    }

    if (config.method !== 'GET' && config.method !== 'POST') {
      throw new Error('ToggleTile config method must be GET or POST');
    }

    if (config.payload !== undefined && (typeof config.payload !== 'object' || Array.isArray(config.payload))) {
      throw new Error('ToggleTile config payload must be an object if provided');
    }

    if (!config.targetUrl || typeof config.targetUrl !== 'object') {
      throw new Error('ToggleTile config must have a targetUrl object');
    }

    const targetUrlKeys = Object.keys(config.targetUrl);
    const allowedTargetUrlKeys = ['trueUrl', 'falseUrl', 'trueImage', 'falseImage'];
    const unknownTargetUrlKeys = targetUrlKeys.filter(key => !allowedTargetUrlKeys.includes(key));
    
    if (unknownTargetUrlKeys.length > 0) {
      throw new Error(`Unknown keys in ToggleTile targetUrl: ${unknownTargetUrlKeys.join(', ')}`);
    }

    if (typeof config.targetUrl.trueUrl !== 'string' || !config.targetUrl.trueUrl) {
      throw new Error('ToggleTile targetUrl.trueUrl must be a valid string');
    }

    if (typeof config.targetUrl.falseUrl !== 'string' || !config.targetUrl.falseUrl) {
      throw new Error('ToggleTile targetUrl.falseUrl must be a valid string');
    }

    if (typeof config.targetUrl.trueImage !== 'string' || !config.targetUrl.trueImage) {
      throw new Error('ToggleTile targetUrl.trueImage must be a valid string');
    }

    if (typeof config.targetUrl.falseImage !== 'string' || !config.targetUrl.falseImage) {
      throw new Error('ToggleTile targetUrl.falseImage must be a valid string');
    }

    if (typeof config.statusCheckUrl !== 'string' || !config.statusCheckUrl) {
      throw new Error('ToggleTile config must have a valid statusCheckUrl string');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    renderToggle(tileElement, {
      label: this.config.label,
      displayLabel: this.config.displayLabel,
      method: this.config.method,
      payload: this.config.payload,
      targetUrl: this.config.targetUrl,
      statusCheckUrl: this.config.statusCheckUrl
    });

    return tileElement;
  }
}

