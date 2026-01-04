import { Tile } from './Tile.js';
import { renderWebhook } from '../../widgets/webhook.js';

export class WebhookTile extends Tile {
  constructor(tileConfig) {
    super(tileConfig);
    this.validateConfig(tileConfig.config);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('WebhookTile config must be an object');
    }

    const allowedKeys = ['targetUrl', 'method', 'payload', 'statusCheckUrl'];
    const keys = Object.keys(config);
    const unknownKeys = keys.filter(key => !allowedKeys.includes(key));
    
    if (unknownKeys.length > 0) {
      throw new Error(`Unknown keys in WebhookTile config: ${unknownKeys.join(', ')}`);
    }

    if (typeof config.targetUrl !== 'string' || !config.targetUrl) {
      throw new Error('WebhookTile config must have a valid targetUrl string');
    }

    if (config.method !== 'GET' && config.method !== 'POST') {
      throw new Error('WebhookTile config method must be GET or POST');
    }

    if (config.payload !== undefined && (typeof config.payload !== 'object' || Array.isArray(config.payload))) {
      throw new Error('WebhookTile config payload must be an object if provided');
    }

    if (config.statusCheckUrl !== undefined && typeof config.statusCheckUrl !== 'string') {
      throw new Error('WebhookTile config statusCheckUrl must be a string if provided');
    }
  }

  render(container) {
    const tileElement = super.render(container);
    
    renderWebhook(tileElement, {
      targetUrl: this.config.targetUrl,
      method: this.config.method,
      payload: this.config.payload,
      statusCheckUrl: this.config.statusCheckUrl
    });

    return tileElement;
  }
}

