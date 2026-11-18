// core/editor/editor.js — WYSIWYG editor shell. Loaded lazily when the pencil is clicked.

import { TileFactory } from '../TileFactory.js';
import { validateLayout } from '../renderer.js';
import { saveConfig, downloadConfig, ConflictError, CONFIG_URL } from '../configStore.js';
import { h, clamp, icon } from './dom.js';
import { TILE_TYPES, SCREEN_PRESETS, parseMQ, buildMQ, suggestPreview } from './schema.js';
import { createCanvas } from './canvas.js';
import { createInspector } from './inspector.js';
import { DEFAULT_SEARCH_PREFIXES, SEARCH_TYPES } from '../search.js';

const NAME_RE = /^[A-Za-z0-9_-]+$/;

const PREVIEWS = [
  ['auto', 'Auto (from layout query)'],
  ['fit', 'Fill editor area'],
  ...SCREEN_PRESETS.map(p => [p.id, `${p.label} (${p.w}×${p.h})`]),
  ['custom', 'Custom size…']
];

export function startEditor({ config, layoutName, container, source }) {
  if (document.body.classList.contains('zd-editing')) return;

  // -------------------------------------------------------------------- state
  const state = {
    draft: JSON.parse(JSON.stringify(config)),
    current: 0,
    selected: null,
    undo: [], redo: [],
    dirty: false,
    preview: { mode: 'auto', w: 1280, h: 720 },
    zoom: 'fit',
    grid: true,
    lastKey: null, lastTime: 0
  };
  state.current = Math.max(0, state.draft.layouts.findIndex(l => l.name === layoutName));

  // Stylesheet
  document.head.append(h('link', { rel: 'stylesheet', href: new URL('./editor.css', import.meta.url).href, id: 'zd-editor-css' }));
  document.body.classList.add('zd-editing');

  // -------------------------------------------------------------------- DOM skeleton
  const stage = container;
  const stageWrap = h('div', { class: 'zd-stagewrap' });
  const workspace = h('div', { class: 'zd-workspace' }, stageWrap);
  stageWrap.append(stage);
  const toolbar = h('header', { class: 'zd-toolbar' });
  const toasts = h('div', { class: 'zd-toasts' });
  const statusbar = h('footer', { class: 'zd-statusbar' });
  document.body.append(toolbar, workspace, statusbar, toasts);
  let clipboard = null;

  const ed = {
    stage,
    draft: () => state.draft,
    layout: () => state.draft.layouts[state.current],
    selected: () => state.selected,
    snapshot, commit, mutate,
    select, addTile, deleteTile, duplicateTile,
    onGeometry: t => { inspector.syncPosition(); setCursor(null, t); },
    openTypeMenu, openContextMenu, applyStageSize, refreshToolbar,
    copyTile, pasteTile, moveZ, setCursor,
    setAppearance, applyAppearanceToAll, setBackground,
    focusPanel: () => inspector.focusFirst(),
    refreshLayers: () => inspector.refreshLayers(),
    tileError: t => canvas.errorOf(t),
    remountTile: t => canvas.remountTile(t),
    setGrid, switchLayout, moveLayout, duplicateLayout, deleteLayout,
    nameError, activeIndexForWindow,
    getSearchPrefixes, setSearchPrefixes
  };
  const canvas = createCanvas(ed);
  const inspector = createInspector(ed);
  ed.canvas = canvas;
  document.body.append(inspector.el);

  // -------------------------------------------------------------------- history
  function snapshot() { return JSON.stringify(state.draft); }

  function commit(prevSnap) {
    state.undo.push(prevSnap);
    if (state.undo.length > 150) state.undo.shift();
    state.redo = [];
    markDirty();
  }

  /** Run fn as one undoable change. Same `key` within 1.2s coalesces (typing). */
  function mutate(fn, key = null) {
    const prev = snapshot();
    fn();
    const now = Date.now();
    if (key && key === state.lastKey && now - state.lastTime < 1200) {
      state.redo = [];
      markDirty();
    } else {
      commit(prev);
    }
    state.lastKey = key;
    state.lastTime = now;
  }

  function markDirty() {
    state.dirty = true;
    updateButtons();
  }

  function restore(snap) {
    state.draft = JSON.parse(snap);
    state.current = clamp(state.current, 0, state.draft.layouts.length - 1);
    state.selected = null;
    state.lastKey = null;
    fullRender();
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot());
    restore(state.undo.pop());
    state.dirty = true;
    updateButtons();
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot());
    restore(state.redo.pop());
    state.dirty = true;
    updateButtons();
  }

  // -------------------------------------------------------------------- selection & tiles
  function select(t) {
    state.selected = t;
    canvas.setSelected(t);
    if (t) inspector.setTab('tile');
    else if (inspector.getTab() === 'tile') inspector.render();
  }

  function addTile(type, rect) {
    const def = TILE_TYPES[type];
    const layout = ed.layout();
    let [w, hgt] = def.size;
    let x, y;
    if (rect) {
      ({ x, y } = rect);
      w = rect.width; hgt = rect.height;
    } else {
      w = Math.min(w, layout.columns); hgt = Math.min(hgt, layout.rows);
      const spot = canvas.findFreeSpot(w, hgt) || canvas.findFreeSpot(1, 1) || { x: 0, y: 0 };
      if (!canvas.findFreeSpot(w, hgt) && canvas.findFreeSpot(1, 1)) { w = 1; hgt = 1; }
      ({ x, y } = spot);
    }
    const tile = { type, layout: { x, y, width: w, height: hgt }, config: def.defaults() };
    mutate(() => layout.tiles.push(tile));
    canvas.addTile(tile);
    select(tile);
    inspector.refreshLayers();
    toast(`${def.label} tile added — edit it in the panel`);
  }

  function deleteTile(t) {
    const layout = ed.layout();
    mutate(() => { layout.tiles.splice(layout.tiles.indexOf(t), 1); });
    canvas.removeTile(t);
    if (state.selected === t) select(null);
    inspector.refreshLayers();
  }

  function duplicateTile(t) {
    const layout = ed.layout();
    const copy = JSON.parse(JSON.stringify(t));
    const { width: w, height: hgt } = copy.layout;
    const spot = canvas.findFreeSpot(w, hgt);
    if (spot) Object.assign(copy.layout, spot);
    else copy.layout.x = Math.min(layout.columns - w, copy.layout.x + 1);
    mutate(() => layout.tiles.push(copy));
    canvas.addTile(copy);
    select(copy);
    inspector.refreshLayers();
  }

  function copyTile(t) {
    clipboard = JSON.parse(JSON.stringify(t));
    toast('Tile copied. Ctrl+V pastes it into any layout.');
  }

  function pasteTile() {
    if (!clipboard) { toast('Nothing copied yet. Select a tile and press Ctrl+C.', 'warn'); return; }
    const layout = ed.layout();
    const copy = JSON.parse(JSON.stringify(clipboard));
    const l = copy.layout;
    l.width = Math.min(l.width, layout.columns);
    l.height = Math.min(l.height, layout.rows);
    const spot = canvas.findFreeSpot(l.width, l.height);
    if (spot) Object.assign(l, spot);
    else { l.x = Math.min(l.x, layout.columns - l.width); l.y = Math.min(l.y, layout.rows - l.height); }
    mutate(() => layout.tiles.push(copy));
    canvas.addTile(copy);
    select(copy);
    inspector.refreshLayers();
  }

  function setAppearance(t, patch, key = null) {
    mutate(() => {
      const a = { ...(t.appearance || {}), ...patch };
      for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
      if (a.mode !== 'glass') delete a.distortion;
      if (a.mode === 'glass' && a.distortion === undefined) a.distortion = 30;
      if ((!a.mode || a.mode === 'opaque') && !a.textColor) delete t.appearance;
      else t.appearance = a;
    }, key);
    canvas.restyle(t);
  }

  function applyAppearanceToAll(src) {
    const tiles = ed.layout().tiles;
    mutate(() => {
      for (const o of tiles) {
        if (src.appearance) o.appearance = JSON.parse(JSON.stringify(src.appearance));
        else delete o.appearance;
      }
    });
    tiles.forEach(o => canvas.restyle(o));
    toast(`Appearance applied to ${tiles.length} tile(s)`);
  }

  function setBackground(v) {
    const layout = ed.layout();
    mutate(() => { if (v) layout.background = v; else delete layout.background; }, 'bg');
    canvas.syncGrid();
  }

  // Search prefixes are dashboard-wide: stored as draft.search.prefixes, omitted while equal to the defaults.
  function samePrefixes(a, b) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) &&
      a[k].length === b[k].length && a[k].every(t => b[k].includes(t)));
  }

  function getSearchPrefixes() {
    return JSON.parse(JSON.stringify(state.draft.search?.prefixes ?? DEFAULT_SEARCH_PREFIXES));
  }

  function setSearchPrefixes(prefixes) {
    mutate(() => {
      if (samePrefixes(prefixes, DEFAULT_SEARCH_PREFIXES)) delete state.draft.search;
      else state.draft.search = { prefixes };
    }, 'search');
  }

  /** dir: 'front' | 'back' | +1 | -1 — stacking order equals order in the tiles array. */
  function moveZ(t, dir) {
    const arr = ed.layout().tiles;
    const i = arr.indexOf(t);
    const j = dir === 'front' ? arr.length - 1 : dir === 'back' ? 0 : clamp(i + dir, 0, arr.length - 1);
    if (i < 0 || i === j) return;
    mutate(() => { arr.splice(i, 1); arr.splice(j, 0, t); });
    canvas.applyOrder();
    inspector.refreshLayers();
  }

  // -------------------------------------------------------------------- layouts
  function nameError(name, except) {
    if (!name) return 'Name is required';
    if (!NAME_RE.test(name)) return 'Use letters, digits, - and _ only (it becomes part of the URL)';
    if (state.draft.layouts.some(l => l !== except && l.name === name)) return 'Another layout already uses this name';
    return '';
  }

  function uniqueName(base) {
    let n = 2, name = base;
    while (state.draft.layouts.some(l => l.name === name)) name = `${base}-${n++}`;
    return name;
  }

  function switchLayout(i) {
    state.current = clamp(i, 0, state.draft.layouts.length - 1);
    state.selected = null;
    fullRender();
  }

  function moveLayout(i, dir) {
    const arr = state.draft.layouts, j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const cur = arr[state.current];
    mutate(() => { [arr[i], arr[j]] = [arr[j], arr[i]]; });
    state.current = arr.indexOf(cur);
    refreshToolbar();
    inspector.render();
  }

  function duplicateLayout() {
    const copy = JSON.parse(JSON.stringify(ed.layout()));
    copy.name = uniqueName(copy.name + '-copy');
    mutate(() => state.draft.layouts.push(copy));
    switchLayout(state.draft.layouts.length - 1);
    toast(`Duplicated as "${copy.name}"`);
  }

  function deleteLayout() {
    if (state.draft.layouts.length < 2) { toast('A dashboard needs at least one layout', 'warn'); return; }
    const l = ed.layout();
    if (!confirm(`Delete layout "${l.name}" and its ${l.tiles.length} tile(s)?`)) return;
    mutate(() => state.draft.layouts.splice(state.current, 1));
    switchLayout(Math.max(0, state.current - 1));
  }

  function setGrid(key, value) {
    const layout = ed.layout();
    if (layout[key] === value) return;
    let clamped = 0;
    mutate(() => {
      layout[key] = value;
      for (const t of layout.tiles) {
        const l = t.layout;
        const before = JSON.stringify(l);
        l.width = Math.min(l.width, layout.columns);
        l.height = Math.min(l.height, layout.rows);
        l.x = Math.min(l.x, layout.columns - l.width);
        l.y = Math.min(l.y, layout.rows - l.height);
        if (JSON.stringify(l) !== before) clamped++;
      }
    });
    canvas.syncGrid();
    inspector.syncPosition();
    if (clamped) toast(`${clamped} tile(s) were moved/shrunk to fit the smaller grid. Undo with Ctrl+Z.`, 'warn');
  }

  function activeIndexForWindow() {
    const ls = state.draft.layouts;
    for (let i = 0; i < ls.length; i++) {
      try { if (ls[i].mediaQuery && matchMedia(ls[i].mediaQuery).matches) return i; } catch { /* invalid */ }
    }
    return ls.findIndex(l => !l.mediaQuery);
  }

  // -------------------------------------------------------------------- stage sizing
  function previewSize() {
    const p = state.preview;
    if (p.mode === 'fit') return null;
    if (p.mode === 'custom') return { w: p.w, h: p.h };
    if (p.mode === 'auto') return suggestPreview(ed.layout().mediaQuery);
    const preset = SCREEN_PRESETS.find(s => s.id === p.mode);
    return preset ? { w: preset.w, h: preset.h } : null;
  }

  function applyStageSize() {
    const r = workspace.getBoundingClientRect();
    const availW = Math.max(200, r.width - 40), availH = Math.max(200, r.height - 40);
    const size = previewSize();
    let w, hgt, s = 1;
    if (!size) { w = availW; hgt = availH; }
    else {
      w = size.w; hgt = size.h;
      s = state.zoom === 'fit' ? Math.min(1, availW / w, availH / hgt) : Number(state.zoom) / 100;
    }
    stage.style.width = w + 'px';
    stage.style.height = hgt + 'px';
    stage.style.transform = s === 1 ? '' : `scale(${s})`;
    stageWrap.style.width = Math.round(w * s) + 'px';
    stageWrap.style.height = Math.round(hgt * s) + 'px';
    const info = toolbar.querySelector('.zd-sizeinfo');
    if (info) info.textContent = `${Math.round(w)}×${Math.round(hgt)}${s < 1 ? ` @ ${Math.round(s * 100)}%` : ''}`;
  }

  // -------------------------------------------------------------------- toolbar
  let undoBtn, redoBtn, saveBtn, statusEl;

  function refreshToolbar() {
    const layouts = state.draft.layouts;
    const active = activeIndexForWindow();

    const layoutSel = h('select', { class: 'zd-sel', title: 'Layout being edited (● = used by this browser window)', value: String(state.current) },
      layouts.map((l, i) => h('option', { value: String(i) }, `${i === active ? '● ' : ''}${l.name}`)));
    layoutSel.addEventListener('change', () => switchLayout(Number(layoutSel.value)));

    const previewSel = h('select', { class: 'zd-sel', title: 'Preview screen size', value: state.preview.mode },
      PREVIEWS.map(([v, l]) => h('option', { value: v }, l)));
    previewSel.addEventListener('change', () => {
      state.preview.mode = previewSel.value;
      if (previewSel.value === 'custom') {
        const cur = previewSize() || { w: stage.offsetWidth, h: stage.offsetHeight };
        state.preview.w = Math.round(cur.w); state.preview.h = Math.round(cur.h);
      }
      refreshToolbar();
      applyStageSize();
      canvas.refit();
    });

    const custom = state.preview.mode === 'custom' ? [
      sizeInput('w'), h('span', { class: 'zd-x' }, '×'), sizeInput('h')
    ] : null;

    const zoomSel = h('select', { class: 'zd-sel zd-narrow', title: 'Zoom: use 150% or 200% for precise work on dense grids', value: state.zoom },
      [['fit', 'Fit'], ['100', '100%'], ['150', '150%'], ['200', '200%']].map(([v, l]) => h('option', { value: v }, l)));
    zoomSel.addEventListener('change', () => { state.zoom = zoomSel.value; applyStageSize(); canvas.refit(); });

    undoBtn = h('button', { class: 'zd-tb zd-icon', title: 'Undo (Ctrl+Z)', onclick: undo }, icon('undo'));
    redoBtn = h('button', { class: 'zd-tb zd-icon', title: 'Redo (Ctrl+Shift+Z)', onclick: redo }, icon('redo'));
    const gridBtn = h('button', { class: 'zd-tb zd-icon' + (state.grid ? ' on' : ''), title: 'Show / hide grid lines' }, icon('grid'));
    gridBtn.addEventListener('click', () => {
      state.grid = !state.grid;
      gridBtn.classList.toggle('on', state.grid);
      stage.classList.toggle('zd-nogrid', !state.grid);
    });
    stage.classList.toggle('zd-nogrid', !state.grid);

    statusEl = h('span', { class: 'zd-status' });
    saveBtn = h('button', { class: 'zd-tb zd-primary', title: 'Save (Ctrl+S)', onclick: onSave }, 'Save');

    toolbar.replaceChildren(
      h('strong', { class: 'zd-brand' }, 'ZeroDash ', h('em', {}, 'editor')),
      h('div', { class: 'zd-group' },
        h('label', { class: 'zd-lbl' }, 'Layout'), layoutSel,
        h('button', { class: 'zd-tb', onclick: openNewLayoutDialog, title: 'Create a layout for another screen size' }, icon('plus'), 'New')),
      h('div', { class: 'zd-group' },
        h('label', { class: 'zd-lbl' }, 'Preview'), previewSel, custom, zoomSel, h('span', { class: 'zd-sizeinfo' })),
      h('div', { class: 'zd-group' },
        h('button', { class: 'zd-tb zd-accent', id: 'zd-add', onclick: ev => { const r = ev.currentTarget.getBoundingClientRect(); openTypeMenu(r.left, r.bottom + 4, t => addTile(t)); } }, icon('plus'), 'Tile')),
      h('div', { class: 'zd-group' }, undoBtn, redoBtn, gridBtn,
        h('button', { class: 'zd-tb zd-icon', title: 'Shortcuts & help (?)', onclick: openHelp }, icon('help'))),
      h('span', { class: 'zd-spacer' }),
      statusEl,
      h('button', { class: 'zd-tb', title: 'Download dashboard.json', onclick: () => downloadConfig(state.draft) }, icon('download'), 'Export'),
      h('button', { class: 'zd-tb', onclick: onCancel }, 'Close'),
      saveBtn);
    updateButtons();
    applyStageSize();
  }

  function sizeInput(key) {
    const i = h('input', { type: 'number', class: 'zd-sizein', min: 100, max: 8000, value: state.preview[key] });
    i.addEventListener('change', () => {
      state.preview[key] = clamp(Math.round(Number(i.value)) || 800, 100, 8000);
      applyStageSize(); canvas.refit();
    });
    return i;
  }

  function updateButtons() {
    if (!undoBtn) return;
    undoBtn.disabled = !state.undo.length;
    redoBtn.disabled = !state.redo.length;
    statusEl.textContent = state.dirty ? 'unsaved changes' : (source === 'default' ? 'new dashboard (not saved yet)' : 'saved');
    statusEl.classList.toggle('dirty', state.dirty);
  }

  // -------------------------------------------------------------------- menus & dialogs
  let openMenu = null;
  function closeMenu() { openMenu?.remove(); openMenu = null; }

  /** items: [{ label, hint?, run, danger?, sep? }] */
  function showMenu(x, y, items, cls = '') {
    closeMenu();
    const menu = h('div', { class: 'zd-menu ' + cls },
      items.map(it => it.sep ? h('hr', {}) :
        h('button', { class: it.danger ? 'zd-danger' : '', onclick: () => { closeMenu(); it.run(); } },
          h('strong', {}, it.label), it.hint ? h('small', {}, it.hint) : null)));
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
    menu.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
    openMenu = menu;
    setTimeout(() => window.addEventListener('pointerdown', function away(ev) {
      if (!menu.contains(ev.target)) { closeMenu(); window.removeEventListener('pointerdown', away, true); }
    }, true), 0);
  }

  function openTypeMenu(x, y, pick) {
    showMenu(x, y, Object.entries(TILE_TYPES).map(([type, def]) => ({ label: def.label, hint: def.hint, run: () => pick(type) })));
  }

  function openContextMenu(x, y, t) {
    showMenu(x, y, [
      { label: 'Duplicate', hint: 'Ctrl+D', run: () => duplicateTile(t) },
      { label: 'Copy', hint: 'Ctrl+C — paste into any layout', run: () => copyTile(t) },
      { sep: true },
      { label: 'Bring to front', hint: ']  (one step; Shift+] to the top)', run: () => moveZ(t, 'front') },
      { label: 'Send to back', hint: '[  (one step; Shift+[ to the bottom)', run: () => moveZ(t, 'back') },
      { sep: true },
      { label: 'Delete', hint: 'Del', danger: true, run: () => deleteTile(t) }
    ], 'zd-ctx');
  }

  const HINT = 'Drag on empty cells to draw a tile  ·  Alt+click cycles overlapped tiles  ·  Right-click for more  ·  ? for shortcuts';
  function setCursor(c, tile) {
    if (!c && !tile) { statusbar.replaceChildren(h('span', { class: 'zd-hint' }, HINT)); return; }
    const l = ed.layout();
    const under = tile || (c && [...l.tiles].reverse().find(t =>
      c.x >= t.layout.x && c.x < t.layout.x + t.layout.width && c.y >= t.layout.y && c.y < t.layout.y + t.layout.height));
    statusbar.replaceChildren(
      c ? h('strong', {}, `Col ${c.x + 1}, Row ${c.y + 1}`) : null,
      under ? h('span', {}, `${c ? '  ·  ' : ''}${under.config.label || under.type} (${under.type})  ${under.layout.width}×${under.layout.height} at ${under.layout.x + 1},${under.layout.y + 1}`) : null,
      h('span', { class: 'zd-hint' }, `    ${HINT}`));
  }

  function openHelp() {
    const rows = [
      ['Draw a tile', 'Drag over empty cells'],
      ['1×1 tile', 'Double-click an empty cell'],
      ['Move / resize', 'Drag the tile / its handles'],
      ['Nudge / resize by 1', '← ↑ → ↓  /  Shift + arrows'],
      ['Pick an overlapped tile', 'Alt+click (repeat to cycle), or use the Layers list'],
      ['Edit a tile’s label', 'Double-click the tile'],
      ['Stack order', '] forward, [ back, Shift+] / Shift+[ to top/bottom'],
      ['Duplicate / Copy / Paste', 'Ctrl+D / Ctrl+C / Ctrl+V (paste works across layouts)'],
      ['Delete', 'Delete or Backspace'],
      ['Undo / Redo', 'Ctrl+Z / Ctrl+Shift+Z'],
      ['Save', 'Ctrl+S'],
      ['Deselect / close menu', 'Esc']
    ];
    dialog('Shortcuts', h('table', { class: 'zd-help' }, rows.map(([a, b]) => h('tr', {}, h('th', {}, a), h('td', {}, b)))), [{ label: 'Close', primary: true }]);
  }

  function dialog(title, body, actions) {
    const back = h('div', { class: 'zd-modal-back' });
    const box = h('div', { class: 'zd-modal' }, h('h3', {}, title), body,
      h('div', { class: 'zd-row zd-end' }, actions.map(a =>
        h('button', { class: 'zd-btn' + (a.primary ? ' zd-primary' : ''), onclick: () => { if (a.run?.() !== false) back.remove(); } }, a.label))));
    back.append(box);
    back.addEventListener('pointerdown', e => { if (e.target === back) back.remove(); });
    document.body.append(back);
    box.querySelector('input,select')?.focus();
    return back;
  }

  function openNewLayoutDialog() {
    const name = h('input', { type: 'text', value: uniqueName('layout'), spellcheck: 'false' });
    const base = h('select', {},
      h('option', { value: 'copy' }, `Copy of "${ed.layout().name}"`),
      h('option', { value: 'empty' }, 'Empty layout'));
    const screen = h('select', {},
      h('option', { value: '' }, 'Any screen (fallback, no query)'),
      h('option', { value: 'window' }, `This window (${innerWidth}×${innerHeight})`),
      SCREEN_PRESETS.map(p => h('option', { value: p.id }, p.label)));
    const err = h('small', { class: 'zd-bad' });

    dialog('New layout for another screen size', h('div', { class: 'zd-form' },
      h('label', { class: 'zd-field' }, h('span', {}, 'Name'), name, err),
      h('label', { class: 'zd-field' }, h('span', {}, 'Start from'), base),
      h('label', { class: 'zd-field' }, h('span', {}, 'Target screen'), screen,
        h('small', { class: 'zd-muted' }, 'Sets a starting media query and grid size; you can fine-tune both afterwards. New layouts are added last — move them up if a broader layout above would match first.'))),
    [
      { label: 'Cancel' },
      { label: 'Create', primary: true, run: () => {
        const n = name.value.trim();
        const e = nameError(n);
        if (e) { err.textContent = e; return false; }
        const src = ed.layout();
        const preset = SCREEN_PRESETS.find(p => p.id === screen.value);
        const layout = base.value === 'copy'
          ? JSON.parse(JSON.stringify(src))
          : { name: n, rows: preset?.rows ?? src.rows, columns: preset?.cols ?? src.columns, tiles: [] };
        layout.name = n;
        if (preset) {
          layout.mediaQuery = preset.mq;
          if (base.value === 'copy') { layout.columns = preset.cols; layout.rows = preset.rows; }
        } else if (screen.value === 'window') {
          layout.mediaQuery = buildMQ({ orientation: innerWidth >= innerHeight ? 'landscape' : 'portrait',
            minW: '', maxW: String(innerWidth), minH: '', maxH: '' });
        } else delete layout.mediaQuery;
        // keep tiles inside the (possibly smaller) grid
        for (const t of layout.tiles) {
          const l = t.layout;
          l.width = Math.min(l.width, layout.columns); l.height = Math.min(l.height, layout.rows);
          l.x = Math.min(l.x, layout.columns - l.width); l.y = Math.min(l.y, layout.rows - l.height);
        }
        mutate(() => state.draft.layouts.push(layout));
        if (preset) state.preview.mode = preset.id;
        switchLayout(state.draft.layouts.length - 1);
        inspector.setTab('layout');
      } }
    ]);
  }

  // -------------------------------------------------------------------- toasts
  function toast(msg, kind = 'info', ms = 3500) {
    const t = h('div', { class: `zd-toast ${kind}` }, msg);
    toasts.append(t);
    setTimeout(() => t.remove(), ms);
  }

  // -------------------------------------------------------------------- save / close
  function validateAll() {
    const errors = [], warnings = [];
    const seen = new Set();
    for (const l of state.draft.layouts) {
      try { validateLayout(l); } catch (e) { errors.push(`Layout "${l.name}": ${e.message}`); continue; }
      if (!NAME_RE.test(l.name)) errors.push(`Layout "${l.name}": name may only use letters, digits, - and _`);
      if (seen.has(l.name)) errors.push(`Layout name "${l.name}" is used twice`);
      seen.add(l.name);
      if (l.mediaQuery) { try { matchMedia(l.mediaQuery); } catch { errors.push(`Layout "${l.name}": invalid media query`); } }
      l.tiles.forEach((t, i) => {
        try { TileFactory.create(t); }
        catch (e) { errors.push(`Layout "${l.name}", tile ${i + 1} (${t.type}): ${e.message}`); }
      });
    }
    const sp = state.draft.search;
    if (sp !== undefined) {
      if (!sp || typeof sp !== 'object' || Array.isArray(sp)) errors.push('Search settings must be an object');
      else for (const [k, types] of Object.entries(sp.prefixes ?? {})) {
        if ([...k].length !== 1 || /[\p{L}\p{N}\s]/u.test(k)) errors.push(`Search prefix "${k}" must be a single symbol (not a letter, digit or space)`);
        if (!Array.isArray(types) || !types.length || !types.every(t => SEARCH_TYPES.includes(t))) {
          errors.push(`Search prefix "${k}" needs at least one tile type (${SEARCH_TYPES.join(', ')})`);
        }
      }
    }
    if (!state.draft.layouts.some(l => !l.mediaQuery)) {
      warnings.push('No layout is a fallback (empty media query). Screens that match no layout will show an error instead of the dashboard.');
    }
    return { errors, warnings };
  }

  async function onSave() {
    const { errors, warnings } = validateAll();
    if (errors.length) {
      dialog('Fix these before saving', h('ul', { class: 'zd-errlist' }, errors.map(e => h('li', {}, e))), [{ label: 'OK', primary: true }]);
      return;
    }
    for (const w of warnings) toast(w, 'warn', 9000);

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      try {
        await saveConfig(state.draft);
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        if (!confirm(err.message + '\n\nOverwrite the newer version? (the previous one is kept as dashboard.json.bak)')) {
          saveBtn.disabled = false; saveBtn.textContent = 'Save'; return;
        }
        await saveConfig(state.draft, { force: true });
      }
      state.dirty = false;
      updateButtons();
      toast(`Saved to ${CONFIG_URL}`, 'ok');
      setTimeout(() => { window.removeEventListener('beforeunload', beforeUnload); location.reload(); }, 700);
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      dialog('Could not save', h('div', {}, h('p', {}, err.message),
        h('p', { class: 'zd-muted' }, 'Your changes are still here. Use Export to download dashboard.json and place it at user/data/ manually.')),
        [{ label: 'Export JSON', run: () => { downloadConfig(state.draft); return false; } }, { label: 'Close', primary: true }]);
    }
  }

  function onCancel() {
    if (state.dirty && !confirm('Discard unsaved changes?')) return;
    window.removeEventListener('beforeunload', beforeUnload);
    location.reload();
  }

  function beforeUnload(e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } }
  window.addEventListener('beforeunload', beforeUnload);

  // -------------------------------------------------------------------- keyboard
  window.addEventListener('keydown', e => {
    // Keep the dashboard's "type anywhere to search" from firing while editing.
    e.stopPropagation();
    const tag = e.target?.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); onSave(); return; }
    if (typing) return; // native text undo etc.
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') { closeMenu(); select(null); return; }
    if (e.key === '?') { openHelp(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteTile(); return; }

    const t = state.selected;
    if (!t) return;
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateTile(t); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copyTile(t); return; }
    if (e.key === ']' || e.key === '}') { e.preventDefault(); moveZ(t, e.shiftKey ? 'front' : 1); return; }
    if (e.key === '[' || e.key === '{') { e.preventDefault(); moveZ(t, e.shiftKey ? 'back' : -1); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteTile(t); return; }

    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault();
      const layout = ed.layout(), l = t.layout;
      const next = { ...l };
      if (e.shiftKey) {
        next.width = clamp(l.width + dir[0], 1, layout.columns - l.x);
        next.height = clamp(l.height + dir[1], 1, layout.rows - l.y);
      } else {
        next.x = clamp(l.x + dir[0], 0, layout.columns - l.width);
        next.y = clamp(l.y + dir[1], 0, layout.rows - l.height);
      }
      mutate(() => Object.assign(l, next), 'nudge');
      canvas.geometryChanged(t);
      inspector.syncPosition();
    }
  }, true);

  let raf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { applyStageSize(); canvas.refit(); });
  }).observe(workspace);

  // -------------------------------------------------------------------- go
  function fullRender() {
    refreshToolbar();
    canvas.renderAll();
    inspector.setTab(inspector.getTab());
    updateButtons();
  }

  state.preview.mode = 'auto';
  setCursor(null);
  fullRender();
  if (source === 'default') {
    toast('No dashboard file found yet, starting with an empty dashboard. Saving creates ' + CONFIG_URL + '.', 'info', 7000);
  }
}
