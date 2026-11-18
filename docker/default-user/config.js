// Starter ZeroDash config baked into the Docker image.
//
// Replace it by mounting your own `user/` directory over the one in the container
// (see DOCKER.md). Mount the whole directory: your config.js may import helper
// files (application.js, button.js, ...) that must live next to it.

import { TileType } from "../core/TileType.js";

export const dashboardConfig = {
  layouts: [
    {
      name: "default",
      rows: 4,
      columns: 6,
      tiles: [
        {
          type: TileType.APPLICATION,
          layout: { x: 0, y: 0, width: 2, height: 2 },
          config: {
            label: "Edit me",
            url: "https://example.com",
            target: "new",
          },
        },
      ],
    },
  ],
};
