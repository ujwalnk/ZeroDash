# ZeroDash

**ZeroDash** is a **lightweight, fully static Homelab dashboard** designed for fast navigation to services and applications, with optional visual monitoring — all **without running a backend, database, or plugins**.

It is a **static replacement for dashboards like Homarr and Dashy**, built with a different philosophy: keep the server simple, push intelligence to the browser, and remain easy to deploy and maintain long-term.

---

## Getting Started

ZeroDash requires no installation, build step, or backend.  
A minimal setup consists of serving the files and defining a basic `config.js`.

---

### 1. Minimal `config.js`

Create or edit `config.js` with the following content:

```javascript
// --- Layout configuration ---

const desktopConfig = {
  cols: 6,
  rows: 4,
  tiles: [
    {
      type: "new",
      label: "Example App",
      image: "https://via.placeholder.com/128",
      url: "https://example.com",
      x: 1,
      y: 1,
      width: 2,
      height: 2,
    },
  ],
};

// --- Media query mapping ---

const breakpointConfigs = [
  {
    name: "Desktop",
    mediaQuery: "(min-width: 0px)",
    config: desktopConfig,
  },
];

// Fallback configuration
const landscapeConfig = desktopConfig;
```

This defines:
- A single 6×4 grid layout
- One application tile
- A media query that always matches

Opening the dashboard with this configuration will immediately render a working page.

---

### 2. Tile Configuration Options

Each tile in the `tiles` array is a JavaScript object.  
Different tile types use different fields, but all tiles share a common structure.

#### Common Fields (All Tiles)

- type  
  The tile type. One of: new, same, widget, button, toggle, webhook

- x  
  Grid column start position (1-based)

- y  
  Grid row start position (1-based)

- width  
  Number of grid columns spanned

- height  
  Number of grid rows spanned

- label  
  Text label shown below the icon

- image  
  Icon or image URL

- displayLabel  
  Whether the label is shown (mainly used for toggle tiles)

#### List of all Fields

| Parameter        | Type            | Required       | Description                                                                         |
| ---------------- | --------------- | -------------- | ----------------------------------------------------------------------------------- |
| `type`           | string          | ✅ Yes          | Tile type. Supported values: `new`, `same`, `widget`, `button`, `toggle`, `webhook` |
| `x`              | number          | ✅ Yes          | Grid column start position (1-based)                                                |
| `y`              | number          | ✅ Yes          | Grid row start position (1-based)                                                   |
| `width`          | number          | ✅ Yes          | Number of grid columns the tile spans                                               |
| `height`         | number          | ✅ Yes          | Number of grid rows the tile spans                                                  |
| `label`          | string          | ⚠️ Optional    | Text label displayed below the icon (used by most tile types)                       |
| `image`          | string          | ⚠️ Optional    | Icon or image URL for the tile                                                      |
| `url`            | string          | ⚠️ Conditional | URL used for navigation tiles and iframe widgets                                    |
| `method`         | string          | ⚠️ Optional    | HTTP method for webhook, button, and toggle actions (`GET` or `POST`)               |
| `payload`        | object          | ⚠️ Optional    | JSON payload sent with POST requests                                                |
| `targetUrl`      | string | object | ⚠️ Conditional | Primary action URL. For toggles, this is an object containing URLs and images       |
| `statusCheckUrl` | string          | ⚠️ Optional    | URL used to check reachability or current state                                     |
| `displayLabel`   | boolean         | ⚠️ Optional    | Whether the label should be displayed (mainly for toggle tiles)                     |

---

#### Navigation Tiles (type: "new" or "same")

Used to open applications or links.

Additional fields:
- url  
  Target URL

- statusCheckUrl  
  Optional URL used to check reachability

Behavior:
- new opens the link in a new tab
- same opens the link in the current tab
- If unreachable, the icon is rendered in grayscale

---

#### Iframe Widgets (type: "widget")

Used to embed dashboards, graphs, or status pages.

Additional fields:
- url  
  URL loaded inside the iframe

The iframe fills the entire tile.

---

#### Button Tiles (type: "button")

Used to trigger webhooks or actions.

Additional fields:
- url  
  Endpoint to call

- method  
  HTTP method (GET or POST)

- payload  
  Optional JSON payload (used with POST)

---

#### Webhook Tiles (type: "webhook")

Used to display and trigger webhook-based responses.

Additional fields:
- targetUrl  
  URL triggered when the tile is clicked

- statusCheckUrl  
  URL fetched when the tile loads

- method  
  HTTP method

- payload  
  Optional JSON payload

The response is rendered directly inside the tile.

---

#### Toggle Tiles (type: "toggle")

Used for binary on/off controls.

Additional fields:
- statusCheckUrl  
  URL that returns the current state (true / false)

- targetUrl.trueUrl  
  URL called when toggling on

- targetUrl.falseUrl  
  URL called when toggling off

- targetUrl.trueImage  
  Icon shown when state is on

- targetUrl.falseImage  
  Icon shown when state is off

- method  
  HTTP method

- payload  
  Optional JSON payload

Toggle tiles are stateless; the source of truth lives outside ZeroDash.

---

### 3. Serve the Files

Serve the ZeroDash files as static assets using any web server or reverse proxy.

Once served:
- Open the dashboard URL in your browser
- Resize the window to test layout changes
- Start typing to use keyboard navigation

You now have a working ZeroDash setup.


---

## Editing in the Browser

ZeroDash ships a WYSIWYG editor. Click the small pencil in the top-right corner (or open `/#edit`).

- **Move / resize**: drag a tile; drag its handles; arrow keys move, Shift+arrows resize
- **Create**: `+ Tile`, or drag a rectangle on empty cells, or double-click an empty cell
- **Edit**: select a tile and use the right-hand panel (the same validators as the renderer run on every change)
- **Screen sizes**: `+ Layout` creates a layout for another screen size; the Layout tab edits its media query, grid size and priority (first match wins). The size selector previews any device size regardless of your window
- **Undo / redo**: Ctrl+Z / Ctrl+Shift+Z. **Save**: Ctrl+S

Saving `PUT`s `user/data/dashboard.json` back to the server. It has the same shape as the object exported by `user/config.js`, and **takes over from `config.js` once it exists** (delete the JSON to go back). The previous version is kept as `dashboard.json.bak`.

Serving needs one writable directory and one nginx location — see [`deploy/nginx.conf`](deploy/nginx.conf):

```bash
mkdir -p user/data && chown nginx:nginx user/data   # www-data on Debian/Ubuntu
```

The `PUT` location is restricted to trusted networks (or a password). The editor button itself is only UI; the server rule is what protects the config. A Caddy sketch (needs `caddy-webdav`, untested) is in [`deploy/Caddyfile`](deploy/Caddyfile).

---

## Why ZeroDash?

| Feature / Property          | **ZeroDash** | Dashy      | Heimdall  | Homarr     |
| --------------------------- | ------------ | ---------- | --------- | ---------- |
| Backend Required            | ❌ No         | ✅ Yes      | ✅ Yes     | ✅ Yes      |
| Runs as a Container         | ❌ No         | ✅ Yes      | ✅ Yes     | ✅ Yes      |
| Static Files Only           | ✅ Yes        | ❌ No       | ❌ No      | ❌ No       |
| Database Required           | ❌ No         | ❌ No*      | ❌ No*     | ❌ No*      |
| Plugin System               | ❌ No         | ✅ Yes      | ❌ No      | ✅ Yes      |
| Background Services         | ❌ No         | ✅ Yes      | ✅ Yes     | ✅ Yes      |
| Server-Side State           | ❌ No         | ✅ Yes      | ✅ Yes     | ✅ Yes      |
| Keyboard-First Navigation   | ✅ Yes        | ⚠️ Partial | ❌ No      | ⚠️ Partial |
| UI-Driven (Mouse Friendly)  | ✅ Yes        | ✅ Yes      | ✅ Yes     | ✅ Yes      |
| Visual Monitoring (Iframes) | ✅ Yes        | ✅ Yes      | ❌ No      | ✅ Yes      |
| Layouts per Device          | ✅ Explicit   | ⚠️ Limited | ❌ No      | ⚠️ Limited |
| Server Resource Usage       | ⭐ Minimal    | 🔸 Medium  | 🔸 Medium | 🔸 Medium  |
| Reverse-Proxy Friendly      | ✅ Native     | ⚠️ Yes     | ⚠️ Yes    | ⚠️ Yes     |
| Configuration Complexity    | ⭐ Low        | 🔸 Medium  | ⭐ Low     | 🔸 Medium  |
| Plugin / Feature Bloat Risk | ❌ None       | ⚠️ Medium  | ❌ Low     | ⚠️ Medium  |


---

## What ZeroDash Is

- A general-purpose Homelab dashboard
- A navigation hub for:
  - Internal services
  - External applications
  - Web interfaces
- A visual monitoring surface using embedded iframes
- A tile-based UI where everything is a widget
- Designed to work across multiple layouts & devices
  - Full desktop
  - Half-screen desktop
  - Tablets
  - Phones (portrait and landscape)
  - And more

---

## What ZeroDash Is Not

- Not a backend-driven dashboard
- Not a plugin-based platform
- Not a metrics collection system
- Not a real-time monitoring or alerting stack
- Not a service orchestrator
- Not a replacement for Prometheus or Grafana
- Not an authentication or authorization system

ZeroDash only surfaces what already exists — it does not manage or secure it.

---

## Core Concepts

### Everything Is a Tile

Every visible element on the dashboard is a tile:
- Application launchers
- Buttons and toggles
- Links
- Embedded iframes (graphs, dashboards, status pages)

Tiles are rendered dynamically into a CSS Grid layout.

---

### Single Configuration File

All dashboard behavior is defined in a single JavaScript configuration file.

This includes:
- Layout definitions
- Tile definitions
- Widget behavior
- URLs and actions

The configuration file is pure JavaScript using JSON-style objects. Users are encouraged to define factory functions for tiles so the same tile definition can be reused across multiple layouts.

---

## Layout System

ZeroDash uses explicit, user-defined layouts.

Layout selection is based on CSS media queries, allowing different configurations for:
- Full desktop
- Half desktop
- Tablet (portrait and landscape)
- Phone (portrait and landscape)
- And more

Each layout explicitly defines:
- Grid structure
- Tile placement
- Tile sizing

Layouts are intentional and predictable. There is no automatic inference.

### Planned Feature: Manual Layout Override

A future enhancement will allow users to explicitly select a layout configuration, overriding media-query-based selection when needed.

---

## Keyboard-First Navigation

ZeroDash is designed to be keyboard-driven while remaining fully usable with a mouse.

- Typing anywhere (unless focused inside an iframe input or textarea) opens search
- No reserved keys
- No fuzzy search
- Fast, direct matching

This enables quick access to services without ever leaving the keyboard.

---

## Application Reachability Checks

ZeroDash can visually indicate whether an application is reachable.

- Reachability checks run entirely in the browser
- Each application can define:
  - A primary URL
  - An optional status check URL
- Status check URLs can be routed through a reverse proxy
- A successful 200 OK response marks the app as reachable
- Unreachable apps appear grayed out

This is a best-effort UI hint, not a monitoring system.

CORS must be handled by the target application or proxy.

---

## Buttons and Toggle Widgets

ZeroDash supports interactive tiles for controlling services.

### Buttons
- Trigger URLs such as webhooks or control endpoints
- Display responses directly inside the tile

### Toggle Buttons
- Two icons representing on and off states
- Two action URLs
- A required state check URL
- Stateless by design

Because ZeroDash does not store state, external changes may require a page refresh.

---

## Stateless by Design

ZeroDash stores no state:
- No cookies
- No localStorage
- No sessions

This ensures predictable behavior, easy debugging, and safe refreshes.

---

## Security Model

ZeroDash provides no built-in security.

- No authentication
- No authorization
- No access control

All security must be handled by your reverse proxy, network isolation, or external authentication layers.

ZeroDash assumes a trusted environment.

---

## Deployment

ZeroDash is deployed by serving static files.

- Place the files behind your existing reverse proxy
- Serve them as static assets
- Open the dashboard URL in your browser

No containers, no services, and no dependencies are required.

### Example Caddy config
```caddyfile
http://:80 {
    # /srv should containe the `index.html`, `config.js` & other files from this repository
    root * /srv
    file_server

    try_files {path} {path}/ /index.html
    encode gzip
}
```

---

## Project Structure

```bash
.
├── index.html
├── style.css
├── dashboard.js
├── search.js
├── config.js
└── widgets/
    ├── widget.js # Contains the function to generate iframe widgets
    ├── applications.js # Contains function to generate application tiles
    ├── buttons.js # Functions to generate button tiles
    └── links.js # Functions to generate link tiles
```

Each widget type is implemented independently to keep the system simple and extensible.

---

## Philosophy

ZeroDash is intentionally opinionated:

- Simplicity over features
- Predictability over flexibility
- Static over dynamic
- Keyboard-first workflows
- Zero server-side burden

It is designed to stay small, understandable, and easy to remove if you ever outgrow it.
