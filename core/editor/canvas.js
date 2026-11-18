// core/editor/canvas.js
//
// The editable surface. Tiles are rendered by the real TileFactory (so what you
// see is what the dashboard renders). On top of the tiles two layers are added:
//   .zd-gridlines  – purely visual cell outlines
//   .zd-overlay    – one transparent "cover" per tile (drag / resize / select)
//                    plus pointer handling for drawing new tiles on empty cells.
// Covers live outside .tile so the dashboard's .tile CSS / text fitting never touch them.

import { TileFactory } from '../TileFactory.js';
import { applyGrid, destroyTiles } from '../renderer.js';
import { fitAllLabels } from '../textFitter.js';
import { applyAppearance } from '../appearance.js';
import { h, clamp, icon } from './dom.js';

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const MAX_GRID_CELLS = 4000;

export function createCanvas(ed) {
  const stage = ed.stage;
  const gridlines = h('div', { class: 'zd-gridlines' });
  const overlay = h('div', { class: 'zd-overlay' });
  const entries = new Map(); // tile object -> { el, inst, cover, error }
  const emptyHint = h('div', { class: 'zd-empty' },
    h('strong', {}, 'Empty layout'),
    h('span', {}, 'Drag on the grid to draw a tile, or use + Tile')) ;
  overlay.append(emptyHint);

  // ------------------------------------------------------------------ geometry

  function geom() {
    const layout = ed.layout();
    const cs = getComputedStyle(stage);
    const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const gap = parseFloat(cs.columnGap) || 0;
    const W = stage.clientWidth - pl - pr, H = stage.clientHeight - pt - pb;
    const cw = (W - gap * (layout.columns - 1)) / layout.columns;
    const ch = (H - gap * (layout.rows - 1)) / layout.rows;
    return { pl, pt, gap, cw, ch, px: cw + gap, py: ch + gap, cols: layout.columns, rows: layout.rows };
  }

  function toStage(ev) {
    const r = stage.getBoundingClientRect();
    const s = r.width / stage.offsetWidth || 1;
    return { x: (ev.clientX - r.left) / s, y: (ev.clientY - r.top) / s };
  }

  function cellAt(ev) {
    const g = geom(), p = toStage(ev);
    return {
      x: clamp(Math.floor((p.x - g.pl) / g.px), 0, g.cols - 1),
      y: clamp(Math.floor((p.y - g.pt) / g.py), 0, g.rows - 1)
    };
  }

  function place(el, l) {
    if (!l || ![l.x, l.y, l.width, l.height].every(Number.isFinite)) return;
    el.style.gridColumn = `${l.x + 1} / ${l.x + 1 + l.width}`;
    el.style.gridRow = `${l.y + 1} / ${l.y + 1 + l.height}`;
  }

  // ------------------------------------------------------------------ layers

  function syncLayers() {
    const layout = ed.layout();
    const cs = getComputedStyle(stage);
    for (const layer of [gridlines, overlay]) {
      layer.style.padding = cs.padding;
      layer.style.gridTemplateColumns = stage.style.gridTemplateColumns;
      layer.style.gridTemplateRows = stage.style.gridTemplateRows;
      layer.style.gap = stage.style.gap;
    }
    const wanted = layout.columns * layout.rows;
    if (wanted > MAX_GRID_CELLS) { gridlines.replaceChildren(); return; }
    gridlines.replaceChildren(...Array.from({ length: wanted }, () => h('div', { class: 'zd-cell' })));
  }

  /** Called when rows/columns changed (no tile re-render needed). */
  function syncGrid() {
    applyGrid(stage, ed.layout());
    ed.applyStageSize();
    syncLayers();
    for (const [t, e] of entries) { place(e.el, t.layout); place(e.cover, t.layout); }
    refreshFlags();
    refit();
  }

  function refit() {
    requestAnimationFrame(() => fitAllLabels(stage));
  }

  // ------------------------------------------------------------------ tiles

  function mount(t) {
    let inst = null, el, error = null;
    try {
      inst = TileFactory.create(t);
      el = inst.render(stage);
    } catch (err) {
      error = err.message;
      el = h('div', { class: 'zd-invalid-tile' },
        h('strong', {}, `Invalid ${t.type || 'tile'}`),
        h('small', {}, error));
      place(el, t.layout);
      stage.append(el);
    }

    const cover = h('div', { class: 'zd-cover' },
      h('span', { class: 'zd-chip' }, ''),
      h('div', { class: 'zd-acts' },
        h('button', { class: 'zd-act', title: 'Duplicate (Ctrl+D)', onclick: ev => { ev.stopPropagation(); ed.duplicateTile(t); } }, icon('copy', 12)),
        h('button', { class: 'zd-act zd-act-del', title: 'Delete (Del)', onclick: ev => { ev.stopPropagation(); ed.deleteTile(t); } }, icon('x', 12))),
      HANDLES.map(d => h('i', { class: `zd-handle zd-h-${d}`, 'data-h': d })));
    place(cover, t.layout);
    cover.addEventListener('pointerdown', ev => onCoverDown(ev, t));
    cover.addEventListener('dblclick', () => ed.focusPanel());
    cover.addEventListener('contextmenu', ev => { ev.preventDefault(); ed.select(t); ed.openContextMenu(ev.clientX, ev.clientY, t); });
    cover.addEventListener('pointermove', ev => ed.setCursor(cellAt(ev)));
    overlay.append(cover);

    entries.set(t, { el, inst, cover, error });
    updateChip(t);
    applyOrder();
  }

  function unmount(t) {
    const e = entries.get(t);
    if (!e) return;
    try { e.inst?.destroy?.(); } catch { /* ignore */ }
    e.el.remove();
    e.cover.remove();
    entries.delete(t);
  }

  function updateChip(t) {
    const e = entries.get(t);
    if (!e) return;
    const l = t.layout;
    e.cover.querySelector('.zd-chip').textContent = `${t.config?.label || (t.config?.text ? String(t.config.text).slice(0, 18) : t.type)} · ${l.width}×${l.height}`;
    e.cover.classList.toggle('zd-error', !!e.error);
  }

  function renderAll() {
    for (const t of [...entries.keys()]) unmount(t);
    destroyTiles();
    stage.replaceChildren();
    const layout = ed.layout();
    applyGrid(stage, layout);
    ed.applyStageSize();
    stage.append(gridlines, overlay);
    overlay.querySelectorAll('.zd-cover').forEach(c => c.remove());
    syncLayers();
    for (const t of layout.tiles) mount(t);
    refreshFlags();
    setSelected(ed.selected());
    refit();
  }

  function addTile(t) { mount(t); refreshFlags(); refit(); }
  function removeTile(t) { unmount(t); refreshFlags(); }
  function remountTile(t) {
    const old = entries.get(t);
    const wasSelected = old?.cover.classList.contains('zd-selected');
    unmount(t);
    mount(t);
    if (wasSelected) { entries.get(t).cover.classList.add('zd-selected'); applyOrder(); }
    refreshFlags();
    refit();
  }
  function restyle(t) {
    const e = entries.get(t);
    if (e) applyAppearance(e.el, t.appearance);
  }
  function errorOf(t) { return entries.get(t)?.error || null; }

  let selectedTile = null;
  function setSelected(t) {
    selectedTile = t;
    for (const [tile, e] of entries) e.cover.classList.toggle('zd-selected', tile === t);
    applyOrder();
  }

  /** Stacking follows array order (same as DOM order at runtime); the selected cover is raised so its handles stay reachable. */
  function applyOrder() {
    const list = ed.layout().tiles;
    for (const [t, e] of entries) {
      const z = list.indexOf(t) + 1;
      e.el.style.zIndex = z;
      e.cover.style.zIndex = t === selectedTile ? 9000 : z;
    }
  }

  function geometryChanged(t) {
    const e = entries.get(t);
    if (!e) return;
    place(e.el, t.layout);
    place(e.cover, t.layout);
    updateChip(t);
    refreshFlags();
    refit();
  }

  function refreshFlags() {
    const layout = ed.layout();
    const list = layout.tiles;
    emptyHint.style.display = list.length ? 'none' : 'grid';
    for (const t of list) {
      const e = entries.get(t);
      if (!e) continue;
      const a = t.layout;
      const oob = a.x < 0 || a.y < 0 || a.x + a.width > layout.columns || a.y + a.height > layout.rows;
      const overlap = list.some(o => o !== t &&
        a.x < o.layout.x + o.layout.width && o.layout.x < a.x + a.width &&
        a.y < o.layout.y + o.layout.height && o.layout.y < a.y + a.height);
      e.cover.classList.toggle('zd-oob', oob);
      e.cover.classList.toggle('zd-overlap', overlap);
    }
  }

  // ------------------------------------------------------------------ gestures

  function onCoverDown(ev, t) {
    if (ev.button !== 0 || ev.target.closest('.zd-act')) return;
    ev.preventDefault();
    ev.stopPropagation();

    // Alt+click: cycle through tiles stacked under the pointer.
    if (ev.altKey) {
      const stack = document.elementsFromPoint(ev.clientX, ev.clientY).filter(n => n.classList.contains('zd-cover'));
      if (stack.length > 1) {
        const cur = stack.findIndex(n => n.classList.contains('zd-selected'));
        const next = stack[(cur + 1) % stack.length];
        for (const [tile, e] of entries) if (e.cover === next) { ed.select(tile); return; }
      }
    }

    ed.select(t);
    const handle = ev.target.closest('[data-h]')?.dataset.h || null;

    const g = geom();
    const start = toStage(ev);
    const orig = { ...t.layout };
    const snap = ed.snapshot();
    let changed = false;

    const move = e => {
      const p = toStage(e);
      const dx = Math.round((p.x - start.x) / g.px);
      const dy = Math.round((p.y - start.y) / g.py);
      let { x, y, width, height } = orig;

      if (!handle) {
        x = clamp(orig.x + dx, 0, Math.max(0, g.cols - orig.width));
        y = clamp(orig.y + dy, 0, Math.max(0, g.rows - orig.height));
      } else {
        if (handle.includes('e')) width = clamp(orig.width + dx, 1, g.cols - orig.x);
        if (handle.includes('s')) height = clamp(orig.height + dy, 1, g.rows - orig.y);
        if (handle.includes('w')) {
          x = clamp(orig.x + dx, 0, orig.x + orig.width - 1);
          width = orig.width - (x - orig.x);
        }
        if (handle.includes('n')) {
          y = clamp(orig.y + dy, 0, orig.y + orig.height - 1);
          height = orig.height - (y - orig.y);
        }
      }

      if (x !== t.layout.x || y !== t.layout.y || width !== t.layout.width || height !== t.layout.height) {
        Object.assign(t.layout, { x, y, width, height });
        changed = changed || x !== orig.x || y !== orig.y || width !== orig.width || height !== orig.height;
        geometryChanged(t);
        ed.onGeometry(t);
      }
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('zd-dragging');
      if (changed) ed.commit(snap);
    };

    document.body.classList.add('zd-dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // Draw a rectangle on empty space to create a tile.
  overlay.addEventListener('pointerdown', ev => {
    if (ev.target !== overlay || ev.button !== 0) return;
    ev.preventDefault();
    ed.select(null);
    const a = cellAt(ev);
    const sx = ev.clientX, sy = ev.clientY;
    let rect = { x: a.x, y: a.y, width: 1, height: 1 };
    let moved = false;
    const band = h('div', { class: 'zd-band' });
    place(band, rect);

    const move = e => {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      if (!moved) { moved = true; overlay.append(band); }
      const b = cellAt(e);
      rect = {
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1
      };
      place(band, rect);
    };
    const up = e => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      band.remove();
      if (moved) ed.openTypeMenu(e.clientX, e.clientY, type => ed.addTile(type, rect));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  overlay.addEventListener('pointermove', ev => ed.setCursor(ev.target === overlay ? cellAt(ev) : cellAt(ev)));
  overlay.addEventListener('pointerleave', () => ed.setCursor(null));

  overlay.addEventListener('dblclick', ev => {
    if (ev.target !== overlay) return;
    const c = cellAt(ev);
    ed.openTypeMenu(ev.clientX, ev.clientY, type => ed.addTile(type, { x: c.x, y: c.y, width: 1, height: 1 }));
  });

  /** First free w×h rectangle (row-major), or null. */
  function findFreeSpot(w, h2) {
    const layout = ed.layout();
    const used = Array.from({ length: layout.rows }, () => new Array(layout.columns).fill(false));
    for (const t of layout.tiles) {
      const l = t.layout;
      for (let y = l.y; y < Math.min(layout.rows, l.y + l.height); y++)
        for (let x = l.x; x < Math.min(layout.columns, l.x + l.width); x++) used[y][x] = true;
    }
    for (let y = 0; y + h2 <= layout.rows; y++) {
      for (let x = 0; x + w <= layout.columns; x++) {
        let free = true;
        for (let yy = y; free && yy < y + h2; yy++)
          for (let xx = x; xx < x + w; xx++) if (used[yy][xx]) { free = false; break; }
        if (free) return { x, y };
      }
    }
    return null;
  }

  return {
    renderAll, syncGrid, addTile, removeTile, remountTile, setSelected,
    geometryChanged, refreshFlags, errorOf, findFreeSpot, refit, applyOrder, restyle
  };
}
