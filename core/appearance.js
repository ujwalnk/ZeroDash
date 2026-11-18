// core/appearance.js
//
// Per-tile look, stored on the tile itself (not inside `config`, so it works for every tile type):
//
//   { "type": "...", "layout": {...}, "config": {...},
//     "appearance": { "mode": "glass", "distortion": 40, "textColor": "#fff" } }
//
//   mode        "opaque" (default, white card) | "glass" | "transparent"
//   distortion  0-100, glass only. 0 = plain frosted blur; higher = the backdrop is warped like thick glass
//   textColor   any CSS colour for the tile's text (optional)
//
// Glass refracts whatever is *behind* the tile, so give the layout a `background` (colour, gradient or image).
// The warping effect uses an SVG filter inside backdrop-filter, which only Chromium-based browsers
// support; Safari/Firefox get the frosted blur without the warp.

export const APPEARANCE_MODES = ['opaque', 'glass', 'transparent'];

export function validateAppearance(a) {
  if (a === undefined) return;
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    throw new Error('Tile appearance must be an object if provided');
  }
  const unknown = Object.keys(a).filter(k => !['mode', 'distortion', 'textColor'].includes(k));
  if (unknown.length) throw new Error(`Unknown keys in tile appearance: ${unknown.join(', ')}`);
  if (a.mode !== undefined && !APPEARANCE_MODES.includes(a.mode)) {
    throw new Error(`Tile appearance mode must be one of: ${APPEARANCE_MODES.join(', ')}`);
  }
  if (a.distortion !== undefined && (typeof a.distortion !== 'number' || a.distortion < 0 || a.distortion > 100)) {
    throw new Error('Tile appearance distortion must be a number from 0 to 100');
  }
  if (a.textColor !== undefined && (typeof a.textColor !== 'string' || !a.textColor.trim())) {
    throw new Error('Tile appearance textColor must be a non-empty string if provided');
  }
}

const canWarp = typeof navigator !== 'undefined' &&
  /Chrom(e|ium)|Edg\//.test(navigator.userAgent) && !/OPR\/|Firefox/.test(navigator.userAgent);

function ensureWarpFilter(distortion) {
  const step = Math.round(distortion / 5) * 5; // limit how many filters exist
  const id = `zd-glass-${step}`;
  if (document.getElementById(id)) return id;

  let defs = document.getElementById('zd-glass-defs');
  if (!defs) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;pointer-events:none';
    defs = document.createElementNS(NS, 'defs');
    defs.id = 'zd-glass-defs';
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  const NS = 'http://www.w3.org/2000/svg';
  const f = document.createElementNS(NS, 'filter');
  f.id = id;
  f.setAttribute('x', '0'); f.setAttribute('y', '0');
  f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  const turb = document.createElementNS(NS, 'feTurbulence');
  turb.setAttribute('type', 'fractalNoise');
  turb.setAttribute('baseFrequency', '0.011 0.016');
  turb.setAttribute('numOctaves', '2');
  turb.setAttribute('seed', '7');
  turb.setAttribute('result', 'noise');
  const disp = document.createElementNS(NS, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'noise');
  disp.setAttribute('scale', String(Math.round(step * 0.6)));
  disp.setAttribute('xChannelSelector', 'R');
  disp.setAttribute('yChannelSelector', 'G');
  f.append(turb, disp);
  defs.appendChild(f);
  return id;
}

/** Apply (or clear) the appearance on a rendered tile element. */
export function applyAppearance(el, appearance) {
  el.removeAttribute('data-appearance');
  el.style.removeProperty('--zd-glass-filter');
  el.style.removeProperty('color');

  const mode = appearance?.mode || 'opaque';
  if (mode !== 'opaque') el.setAttribute('data-appearance', mode);

  if (mode === 'glass') {
    const d = appearance.distortion ?? 30;
    const base = 'blur(8px) saturate(1.5)';
    if (d > 0 && canWarp) {
      el.style.setProperty('--zd-glass-filter', `url(#${ensureWarpFilter(d)}) ${base}`);
    } else {
      el.style.setProperty('--zd-glass-filter', base);
    }
  }
  if (appearance?.textColor) el.style.color = appearance.textColor;
}
