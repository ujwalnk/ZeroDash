// core/editor/editor.js — WYSIWYG editor shell. Loaded lazily when the pencil is clicked.

import { TileFactory } from '../TileFactory.js';
import { validateLayout } from '../renderer.js';
import { saveConfig, downloadConfig, ConflictError, CONFIG_URL } from '../configStore.js';
import { h, clamp } from './dom.js';
import { TILE_TYPES, SCREEN_PRESETS, parseMQ, buildMQ, suggestPreview } from './schema.js';
import { createCanvas } from './canvas.js';
import { createInspector } from './inspector.js';

const NAME_RE = /^[A-Za-z0-9_-]+$/;

const PREVIEWS = [
  ['auto', 'Match layout query'],
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
  document.body.append(toolbar, workspace, toasts);

  const ed = {
    stage,
    draft: () => state.draft,
    layout: () => state.draft.layouts[state.current],
    selected: () => state.selected,
    snapshot, commit, mutate,
    select, addTile, deleteTile, duplicateTile,
    onGeometry: t => { inspector.syncPosition(); },
    openTypeMenu, applyStageSize, refreshToolbar,
    tileError: t => canvas.errorOf(t),
    remountTile: t => canvas.remountTile(t),
    setGrid, switchLayout, moveLayout, duplicateLayout, deleteLayout,
    nameError, activeIndexForWindow
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
    toast(`${def.label} tile added — edit it in the panel`);
  }

  function deleteTile(t) {
    const layout = ed.layout();
    mutate(() => { layout.tiles.splice(layout.tiles.indexOf(t), 1); });
    canvas.removeTile(t);
    if (state.selected === t) select(null);
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
      if (state.zoom === 'fit') s = Math.min(1, availW / w, availH / hgt);
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

    const layoutSel = h('select', { class: 'zd-sel', title: 'Layout being edited', value: String(state.current) },
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

    const zoomSel = h('select', { class: 'zd-sel zd-narrow', title: 'Zoom', value: state.zoom },
      h('option', { value: 'fit' }, 'Fit'), h('option', { value: '100' }, '100%'));
    zoomSel.addEventListener('change', () => { state.zoom = zoomSel.value; applyStageSize(); canvas.refit(); });

    undoBtn = h('button', { class: 'zd-tb', title: 'Undo (Ctrl+Z)', onclick: undo }, '↶');
    redoBtn = h('button', { class: 'zd-tb', title: 'Redo (Ctrl+Shift+Z)', onclick: redo }, '↷');
    statusEl = h('span', { class: 'zd-status' });
    saveBtn = h('button', { class: 'zd-tb zd-primary', title: 'Save (Ctrl+S)', onclick: onSave }, 'Save');

    toolbar.replaceChildren(
      h('strong', { class: 'zd-brand' }, '✎ Edit'),
      h('div', { class: 'zd-group' }, layoutSel,
        h('button', { class: 'zd-tb', onclick: openNewLayoutDialog, title: 'Create a layout for another screen size' }, '+ Layout')),
      h('div', { class: 'zd-group' }, previewSel, custom, zoomSel, h('span', { class: 'zd-sizeinfo' })),
      h('div', { class: 'zd-group' },
        h('button', { class: 'zd-tb', id: 'zd-add', onclick: ev => { const r = ev.currentTarget.getBoundingClientRect(); openTypeMenu(r.left, r.bottom + 4, t => addTile(t)); } }, '+ Tile')),
      h('div', { class: 'zd-group' }, undoBtn, redoBtn),
      h('span', { class: 'zd-spacer' }),
      statusEl,
      h('button', { class: 'zd-tb', title: 'Download dashboard.json', onclick: () => downloadConfig(state.draft) }, 'Export'),
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
    statusEl.textContent = state.dirty ? '● unsaved changes' : (source === 'config.js' ? 'from config.js (not saved yet)' : 'saved');
    statusEl.classList.toggle('dirty', state.dirty);
  }

  // -------------------------------------------------------------------- menus & dialogs
  let openMenu = null;
  function closeMenu() { openMenu?.remove(); openMenu = null; }

  function openTypeMenu(x, y, pick) {
    closeMenu();
    const menu = h('div', { class: 'zd-menu' },
      Object.entries(TILE_TYPES).map(([type, def]) =>
        h('button', { onclick: () => { closeMenu(); pick(type); } }, h('strong', {}, def.label), h('small', {}, def.hint))));
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
    menu.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
    openMenu = menu;
    setTimeout(() => window.addEventListener('pointerdown', function away(e) {
      if (!menu.contains(e.target)) { closeMenu(); window.removeEventListener('pointerdown', away, true); }
    }, true), 0);
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

    const t = state.selected;
    if (!t) return;
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateTile(t); return; }
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
  fullRender();
  if (source === 'config.js') {
    toast('Editing the layout from user/config.js. Saving creates user/data/dashboard.json, which then takes over.', 'info', 7000);
  }
}
