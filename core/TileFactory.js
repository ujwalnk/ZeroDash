import { TileType } from './TileType.js';
import { WidgetTile } from './tiles/WidgetTile.js';
import { WebhookTile } from './tiles/WebhookTile.js';
import { ButtonTile } from './tiles/ButtonTile.js';
import { ToggleTile } from './tiles/ToggleTile.js';
import { LinkTile } from './tiles/LinkTile.js';
import { ApplicationTile } from './tiles/ApplicationTile.js';

export class TileFactory {
  static create(tileConfig) {
    switch (tileConfig.type) {
      case TileType.WIDGET:
        return new WidgetTile(tileConfig);
      case TileType.WEBHOOK:
        return new WebhookTile(tileConfig);
      case TileType.BUTTON:
        return new ButtonTile(tileConfig);
      case TileType.TOGGLE:
        return new ToggleTile(tileConfig);
      case TileType.LINK:
        return new LinkTile(tileConfig);
      case TileType.APPLICATION:
        return new ApplicationTile(tileConfig);
      default:
        throw new Error(`Unknown tile type: ${tileConfig.type}`);
    }
  }

  static createAll(tileConfigs, container) {
    const tiles = [];
    
    for (const tileConfig of tileConfigs) {
      try {
        const tile = TileFactory.create(tileConfig);
        const element = tile.render(container);
        tiles.push({ tile, element });
      } catch (error) {
        console.error('Failed to create tile:', error.message, tileConfig);
        // Continue with other tiles - don't crash the dashboard
      }
    }
    
    return tiles;
  }
}

