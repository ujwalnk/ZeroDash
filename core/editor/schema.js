// Editor schema: what each tile type needs, derived from the validators in core/tiles/*.js
// (the validators remain the source of truth — the editor runs them on every change).

const EX = 'https://example.com/';

export const TILE_TYPES = {
  application: {
    label: 'Application',
    hint: 'Opens a service; greys out when unreachable',
    size: [1, 1],
    defaults: () => ({ label: 'New app', url: EX, target: 'same' }),
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'image', optional: true, label: 'Icon', kind: 'image' },
      { key: 'url', label: 'URL', kind: 'text' },
      { key: 'target', label: 'Open in', kind: 'select', optional: true,
        options: [['same', 'Same tab'], ['new', 'New tab']] },
      { key: 'availabilityUrl', optional: true, label: 'Availability check URL', kind: 'text', help: 'Defaults to the URL' }
    ]
  },
  link: {
    label: 'Link',
    hint: 'Plain shortcut',
    size: [1, 1],
    defaults: () => ({ label: 'New link', url: EX, target: 'new' }),
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'image', optional: true, label: 'Icon', kind: 'image' },
      { key: 'url', label: 'URL', kind: 'text' },
      { key: 'target', label: 'Open in', kind: 'select',
        options: [['same', 'Same tab'], ['new', 'New tab']] },
      { key: 'statusCheckUrl', optional: true, label: 'Status check URL', kind: 'text' }
    ]
  },
  button: {
    label: 'Button',
    hint: 'Sends an HTTP request on click',
    size: [1, 1],
    defaults: () => ({ label: 'New button', url: EX, method: 'GET' }),
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'image', optional: true, label: 'Icon', kind: 'image' },
      { key: 'url', label: 'Request URL', kind: 'text' },
      { key: 'method', label: 'Method', kind: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
      { key: 'payload', label: 'JSON payload', kind: 'json' }
    ]
  },
  toggle: {
    label: 'Toggle',
    hint: 'On/off control backed by a status URL',
    size: [1, 1],
    defaults: () => ({
      label: 'New toggle',
      displayLabel: true,
      method: 'GET',
      statusCheckUrl: EX,
      targetUrl: {
        trueUrl: EX,
        falseUrl: EX,
        trueImage: '/user/icons/generic-play.png',
        falseImage: '/user/icons/generic-stop.png'
      }
    }),
    fields: [
      { key: 'label', label: 'Label', kind: 'text' },
      { key: 'displayLabel', label: 'Show label', kind: 'bool' },
      { key: 'statusCheckUrl', label: 'Status URL', kind: 'text' },
      { key: 'targetUrl.trueUrl', label: 'URL when turning on', kind: 'text' },
      { key: 'targetUrl.falseUrl', label: 'URL when turning off', kind: 'text' },
      { key: 'targetUrl.trueImage', label: 'On icon', kind: 'image' },
      { key: 'targetUrl.falseImage', label: 'Off icon', kind: 'image' },
      { key: 'method', label: 'Method', kind: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
      { key: 'payload', label: 'JSON payload', kind: 'json' },
      { key: 'tag', optional: true, label: 'Radio group tag', kind: 'text', help: 'Toggles sharing a tag act like radio buttons' }
    ]
  },
  widget: {
    label: 'Widget',
    hint: 'Embeds a page (iframe)',
    size: [3, 2],
    defaults: () => ({ url: 'about:blank', RefreshInterval: 0 }),
    fields: [
      { key: 'url', label: 'Page URL', kind: 'text' },
      { key: 'RefreshInterval', label: 'Refresh every (seconds)', kind: 'number', min: 0, help: '0 = never' }
    ]
  },
  text: {
    label: 'Text',
    hint: 'Static text, or live text from any URL',
    size: [3, 2],
    defaults: () => ({ text: 'Hello, ZeroDash', css: 'font-size: 26cqmin; font-weight: 600;' }),
    fields: [
      { key: 'text', label: 'Text', kind: 'textarea', optional: true, rows: 3,
        help: 'With a URL below, use {{path}} for values from a JSON response ({{data.items[0].name}}) or {{$}} for the whole response.' },
      { key: 'url', label: 'Fetch from URL', kind: 'text', optional: true,
        help: 'Optional. The response is shown as text. The server must allow cross-origin requests (CORS).' },
      { key: 'method', label: 'Method', kind: 'select', optional: true, options: [['GET', 'GET'], ['POST', 'POST']] },
      { key: 'payload', label: 'JSON payload', kind: 'json' },
      { key: 'jsonPath', label: 'JSON path', kind: 'text', optional: true, help: 'e.g. main.temp. Used when Text is empty.' },
      { key: 'refreshInterval', label: 'Refresh every (seconds)', kind: 'number', optional: true, min: 0, help: '0 = load once' },
      { key: 'css', label: 'CSS style', kind: 'textarea', optional: true, rows: 4,
        help: 'Any CSS declarations for the text, e.g. color: #fff; font-family: serif. Tip: cqmin / cqw / cqh units scale with the tile.' }
    ]
  },
  webhook: {
    label: 'Webhook',
    hint: 'Calls a URL and shows the response',
    size: [2, 1],
    defaults: () => ({ targetUrl: EX, method: 'GET' }),
    fields: [
      { key: 'targetUrl', label: 'URL', kind: 'text' },
      { key: 'method', label: 'Method', kind: 'select', options: [['GET', 'GET'], ['POST', 'POST']] },
      { key: 'payload', label: 'JSON payload', kind: 'json' },
      { key: 'statusCheckUrl', optional: true, label: 'Status check URL', kind: 'text' }
    ]
  }
};

// ---------------------------------------------------------------------------
// Screen-size presets (used for previewing and for "new layout" suggestions)
// ---------------------------------------------------------------------------

export const SCREEN_PRESETS = [
  { id: 'phone',    label: 'Phone portrait',   w: 390,  h: 844,  mq: '(max-width: 600px)',                                               cols: 4,  rows: 8 },
  { id: 'phone-l',  label: 'Phone landscape',  w: 844,  h: 390,  mq: '(orientation: landscape) and (max-height: 500px)',                 cols: 8,  rows: 4 },
  { id: 'tablet',   label: 'Tablet portrait',  w: 820,  h: 1180, mq: '(orientation: portrait) and (min-width: 601px)',                   cols: 6,  rows: 9 },
  { id: 'tablet-l', label: 'Tablet landscape', w: 1180, h: 820,  mq: '(orientation: landscape) and (min-width: 601px) and (max-width: 1279px)', cols: 9, rows: 6 },
  { id: 'laptop',   label: 'Laptop 1366×768',  w: 1366, h: 768,  mq: '(orientation: landscape) and (min-width: 1280px)',                 cols: 12, rows: 7 },
  { id: 'desktop',  label: 'Desktop 1920×1080',w: 1920, h: 1080, mq: '(orientation: landscape) and (min-width: 1600px)',                 cols: 16, rows: 9 },
  { id: 'wide',     label: 'Ultrawide 2560×1080', w: 2560, h: 1080, mq: '(min-width: 2200px)',                                           cols: 24, rows: 8 }
];

// ---------------------------------------------------------------------------
// Media query helpers (only the simple forms the builder understands)
// ---------------------------------------------------------------------------

const EMPTY_MQ = { orientation: '', minW: '', maxW: '', minH: '', maxH: '', ok: true };

export function parseMQ(query) {
  const out = { ...EMPTY_MQ };
  if (!query || !query.trim()) return out;
  for (const part of query.split(/\s+and\s+/i).map(s => s.trim())) {
    let m;
    if ((m = part.match(/^\(\s*orientation\s*:\s*(portrait|landscape)\s*\)$/i))) {
      out.orientation = m[1].toLowerCase();
    } else if ((m = part.match(/^\(\s*(min|max)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/i))) {
      out[m[1].toLowerCase() + (m[2].toLowerCase() === 'width' ? 'W' : 'H')] = m[3];
    } else {
      out.ok = false;
    }
  }
  return out;
}

export function buildMQ(o) {
  const parts = [];
  if (o.orientation) parts.push(`(orientation: ${o.orientation})`);
  if (o.minW !== '') parts.push(`(min-width: ${o.minW}px)`);
  if (o.maxW !== '') parts.push(`(max-width: ${o.maxW}px)`);
  if (o.minH !== '') parts.push(`(min-height: ${o.minH}px)`);
  if (o.maxH !== '') parts.push(`(max-height: ${o.maxH}px)`);
  return parts.join(' and ');
}

/** Guess a sensible preview size for a layout from its media query. */
export function suggestPreview(query) {
  const p = parseMQ(query);
  const n = v => (v === '' ? null : Number(v));
  const minW = n(p.minW), maxW = n(p.maxW);
  let w;
  if (minW && maxW) w = Math.round((minW + maxW) / 2);
  else if (maxW) w = maxW;
  else if (minW) w = Math.max(minW, p.orientation === 'portrait' ? 820 : 1366);
  else w = p.orientation === 'portrait' ? 390 : 1366;
  let h;
  if (p.orientation === 'portrait') h = Math.round(w * (w < 600 ? 2.16 : 1.44));
  else h = Math.round(w * 0.5625);
  const maxH = n(p.maxH);
  if (maxH) h = Math.min(h, maxH);
  return { w, h };
}
