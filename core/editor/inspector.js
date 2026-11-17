// core/editor/inspector.js — right-hand panel: Tile properties / Layout settings.

import { h, getPath, setPath, clamp } from './dom.js';
import { TILE_TYPES, parseMQ, buildMQ } from './schema.js';

const ICON_CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

export function createInspector(ed) {
  const root = h('aside', { class: 'zd-panel' });
  let tab = 'tile';
  let posInputs = null; // { x, y, width, height } inputs of the current tile form

  function setTab(name) { tab = name; render(); }

  // ------------------------------------------------------------------ shell

  function render() {
    posInputs = null;
    const tabs = h('div', { class: 'zd-tabs' },
      ['tile', 'layout'].map(n =>
        h('button', { class: n === tab ? 'on' : '', onclick: () => setTab(n) }, n === 'tile' ? 'Tile' : 'Layout')));
    const body = h('div', { class: 'zd-panel-body' }, tab === 'tile' ? tileTab() : layoutTab());
    root.replaceChildren(tabs, body);
  }

  // ------------------------------------------------------------------ tile tab

  function tileTab() {
    const t = ed.selected();
    if (!t) {
      return [
        h('p', { class: 'zd-muted' }, 'Select a tile to edit it, or add one:'),
        h('div', { class: 'zd-palette' },
          Object.entries(TILE_TYPES).map(([type, def]) =>
            h('button', { class: 'zd-palette-item', onclick: () => ed.addTile(type) },
              h('strong', {}, '+ ' + def.label), h('small', {}, def.hint)))),
        h('p', { class: 'zd-muted' }, 'Tip: drag on empty space to draw a tile, or double-click an empty cell.')
      ];
    }

    const def = TILE_TYPES[t.type];
    const errBox = h('div', { class: 'zd-error-box' });
    const refreshError = () => {
      const msg = ed.tileError(t);
      errBox.textContent = msg || '';
      errBox.style.display = msg ? 'block' : 'none';
    };

    let rerenderTimer = null;
    const scheduleRemount = () => {
      clearTimeout(rerenderTimer);
      rerenderTimer = setTimeout(() => { ed.remountTile(t); refreshError(); }, 350);
    };

    const onConfigChange = (path, value, coalesceKey) => {
      ed.mutate(() => setPath(t.config, path, value), coalesceKey);
      scheduleRemount();
    };

    // Position & size (shown 1-based like a spreadsheet; stored 0-based)
    posInputs = {};
    const L = t.layout;
    const posField = (key, label, offset, min) => {
      const input = h('input', { type: 'number', min, value: L[key] + offset });
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        const layout = ed.layout();
        const next = { ...t.layout, [key]: Math.round(v - offset) };
        next.width = clamp(next.width, 1, layout.columns);
        next.height = clamp(next.height, 1, layout.rows);
        next.x = clamp(next.x, 0, layout.columns - next.width);
        next.y = clamp(next.y, 0, layout.rows - next.height);
        ed.mutate(() => Object.assign(t.layout, next), 'pos-' + key);
        ed.canvas.geometryChanged(t);
      });
      posInputs[key] = input;
      return h('label', { class: 'zd-mini' }, h('span', {}, label), input);
    };

    const form = h('div', { class: 'zd-form' },
      h('div', { class: 'zd-tilehead' },
        h('span', { class: 'zd-badge' }, def.label),
        h('small', {}, def.hint)),
      h('div', { class: 'zd-grid4' },
        posField('x', 'Column', 1, 1), posField('y', 'Row', 1, 1),
        posField('width', 'Width', 0, 1), posField('height', 'Height', 0, 1)),
      def.fields.map(f => fieldRow(t, f, onConfigChange)),
      errBox,
      h('div', { class: 'zd-row' },
        h('button', { class: 'zd-btn', onclick: () => ed.duplicateTile(t) }, 'Duplicate'),
        h('button', { class: 'zd-btn zd-danger', onclick: () => ed.deleteTile(t) }, 'Delete')));
    refreshError();
    return form;
  }

  function fieldRow(t, f, onChange) {
    const current = getPath(t.config, f.key);
    const label = h('span', {}, f.label);
    let control;

    if (f.kind === 'bool') {
      control = h('input', { type: 'checkbox', checked: !!current });
      control.addEventListener('change', () => onChange(f.key, control.checked, null));
      return h('label', { class: 'zd-field zd-check' }, control, label);
    }

    if (f.kind === 'select') {
      control = h('select', { value: current ?? '' },
        f.optional ? h('option', { value: '' }, '(default)') : null,
        f.options.map(([v, text]) => h('option', { value: v }, text)));
      control.addEventListener('change', () => onChange(f.key, control.value === '' ? undefined : control.value, null));
    } else if (f.kind === 'number') {
      control = h('input', { type: 'number', min: f.min ?? 0, value: current ?? 0 });
      control.addEventListener('input', () => {
        const v = Number(control.value);
        if (control.value !== '' && Number.isFinite(v)) onChange(f.key, v, 'f-' + f.key);
      });
    } else if (f.kind === 'json') {
      control = h('textarea', { rows: 3, spellcheck: 'false', placeholder: '{ }' },
        current === undefined ? '' : JSON.stringify(current, null, 2));
      control.addEventListener('input', () => {
        const raw = control.value.trim();
        if (raw === '') { control.classList.remove('bad'); onChange(f.key, undefined, 'f-' + f.key); return; }
        try {
          const v = JSON.parse(raw);
          if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('must be an object');
          control.classList.remove('bad');
          onChange(f.key, v, 'f-' + f.key);
        } catch { control.classList.add('bad'); }
      });
    } else {
      control = h('input', { type: 'text', value: current ?? '', spellcheck: 'false', autocomplete: 'off' });
      control.addEventListener('input', () => {
        const v = control.value;
        // Optional keys are removed when emptied; required ones keep the empty string so the validator reports it.
        onChange(f.key, v === '' && f.optional ? undefined : v, 'f-' + f.key);
        if (f.kind === 'image') preview.src = v;
      });
    }

    const extras = [];
    let preview;
    if (f.kind === 'image') {
      preview = h('img', { class: 'zd-iconprev', src: current || '', alt: '' });
      preview.addEventListener('error', () => { preview.style.visibility = 'hidden'; });
      preview.addEventListener('load', () => { preview.style.visibility = 'visible'; });
      const slug = h('input', { type: 'text', placeholder: 'dashboard-icons name, e.g. immich', spellcheck: 'false' });
      const use = ext => () => {
        const s = slug.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (!s) return;
        const url = `${ICON_CDN}/${ext}/${s}.${ext}`;
        control.value = url;
        preview.src = url;
        onChange(f.key, url, null);
      };
      extras.push(h('div', { class: 'zd-iconhelp' }, slug,
        h('button', { class: 'zd-btn zd-sm', onclick: use('svg'), title: 'svg' }, 'svg'),
        h('button', { class: 'zd-btn zd-sm', onclick: use('png'), title: 'png' }, 'png')));
    }

    return h('label', { class: 'zd-field' }, label,
      f.kind === 'image' ? h('div', { class: 'zd-imgrow' }, control, preview) : control,
      extras, f.help ? h('small', { class: 'zd-muted' }, f.help) : null);
  }

  /** Update the numeric position inputs without rebuilding the form (used while dragging). */
  function syncPosition() {
    const t = ed.selected();
    if (!t || !posInputs) return;
    const map = { x: 1, y: 1, width: 0, height: 0 };
    for (const [k, off] of Object.entries(map)) {
      if (posInputs[k] && document.activeElement !== posInputs[k]) posInputs[k].value = t.layout[k] + off;
    }
  }

  // ------------------------------------------------------------------ layout tab

  function layoutTab() {
    const layout = ed.layout();
    const mq = parseMQ(layout.mediaQuery);

    const nameInput = h('input', { type: 'text', value: layout.name, spellcheck: 'false' });
    const nameErr = h('small', { class: 'zd-bad' });
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim();
      const err = ed.nameError(v, layout);
      nameErr.textContent = err || '';
      if (err) return;
      ed.mutate(() => { layout.name = v; });
      ed.refreshToolbar();
      render();
    });

    // --- media query builder
    const raw = h('input', { type: 'text', value: layout.mediaQuery || '', spellcheck: 'false',
      placeholder: 'empty = fallback layout (matches everything)' });
    const num = key => {
      const i = h('input', { type: 'number', min: 0, value: mq[key], placeholder: '—', disabled: !mq.ok });
      i.addEventListener('input', () => applyBuilder());
      return i;
    };
    const orient = h('select', { value: mq.orientation, disabled: !mq.ok },
      h('option', { value: '' }, 'any'), h('option', { value: 'portrait' }, 'portrait'), h('option', { value: 'landscape' }, 'landscape'));
    orient.addEventListener('change', () => applyBuilder());
    const fields = { minW: num('minW'), maxW: num('maxW'), minH: num('minH'), maxH: num('maxH') };

    const setQuery = q => {
      ed.mutate(() => { if (q) layout.mediaQuery = q; else delete layout.mediaQuery; }, 'mq');
      ed.refreshToolbar();
      refreshMatchList();
    };
    const applyBuilder = () => {
      const q = buildMQ({ orientation: orient.value, minW: fields.minW.value, maxW: fields.maxW.value, minH: fields.minH.value, maxH: fields.maxH.value });
      raw.value = q;
      setQuery(q);
    };
    raw.addEventListener('input', () => {
      const p = parseMQ(raw.value);
      for (const k of Object.keys(fields)) { fields[k].value = p[k]; fields[k].disabled = !p.ok; }
      orient.value = p.orientation; orient.disabled = !p.ok;
      setQuery(raw.value.trim());
    });

    const matchNote = h('small', { class: 'zd-muted' });
    const updateMatch = () => {
      let m = null;
      try { m = layout.mediaQuery ? window.matchMedia(layout.mediaQuery).matches : null; } catch { m = 'bad'; }
      matchNote.textContent = m === null ? 'No query: this layout is the fallback.'
        : m === 'bad' ? 'This media query is not valid.'
        : m ? `Matches this browser window (${innerWidth}×${innerHeight}).` : `Does not match this browser window (${innerWidth}×${innerHeight}).`;
    };
    updateMatch();

    // --- grid size
    const gridInput = key => {
      const i = h('input', { type: 'number', min: 1, max: 60, value: layout[key] });
      i.addEventListener('change', () => {
        const v = clamp(Math.round(Number(i.value)) || layout[key], 1, 60);
        i.value = v;
        ed.setGrid(key, v);
      });
      return i;
    };

    // --- ordered list of layouts
    const list = h('div', { class: 'zd-layouts' });
    function refreshMatchList() {
      updateMatch();
      const layouts = ed.draft().layouts;
      const active = ed.activeIndexForWindow();
      list.replaceChildren(...layouts.map((l, i) => {
        const dot = i === active ? h('span', { class: 'zd-dot', title: 'Chosen for this browser window' }, '●') : h('span', { class: 'zd-dot off' }, '○');
        return h('div', { class: 'zd-lrow' + (l === layout ? ' on' : '') },
          dot,
          h('button', { class: 'zd-lname', onclick: () => ed.switchLayout(i) },
            h('strong', {}, l.name), h('small', {}, l.mediaQuery || 'fallback (always matches)')),
          h('button', { class: 'zd-btn zd-sm', disabled: i === 0, title: 'Move up (higher priority)', onclick: () => ed.moveLayout(i, -1) }, '↑'),
          h('button', { class: 'zd-btn zd-sm', disabled: i === layouts.length - 1, title: 'Move down', onclick: () => ed.moveLayout(i, 1) }, '↓'));
      }));
    }
    refreshMatchList();

    return h('div', { class: 'zd-form' },
      h('label', { class: 'zd-field' }, h('span', {}, 'Name'), nameInput, nameErr,
        h('small', { class: 'zd-muted' }, 'Reachable at /name or ?layout=name')),
      h('div', { class: 'zd-sec' }, 'Show this layout when…'),
      h('label', { class: 'zd-field' }, h('span', {}, 'Orientation'), orient),
      h('div', { class: 'zd-grid2' },
        h('label', { class: 'zd-mini' }, h('span', {}, 'Min width (px)'), fields.minW),
        h('label', { class: 'zd-mini' }, h('span', {}, 'Max width (px)'), fields.maxW),
        h('label', { class: 'zd-mini' }, h('span', {}, 'Min height (px)'), fields.minH),
        h('label', { class: 'zd-mini' }, h('span', {}, 'Max height (px)'), fields.maxH)),
      h('label', { class: 'zd-field' }, h('span', {}, 'CSS media query'), raw, matchNote,
        !mq.ok ? h('small', { class: 'zd-muted' }, 'Custom query — edit it as text.') : null),
      h('div', { class: 'zd-sec' }, 'Grid'),
      h('div', { class: 'zd-grid2' },
        h('label', { class: 'zd-mini' }, h('span', {}, 'Columns'), gridInput('columns')),
        h('label', { class: 'zd-mini' }, h('span', {}, 'Rows'), gridInput('rows'))),
      h('div', { class: 'zd-sec' }, 'All layouts — first match wins'),
      list,
      h('div', { class: 'zd-row' },
        h('button', { class: 'zd-btn', onclick: () => ed.duplicateLayout() }, 'Duplicate layout'),
        h('button', { class: 'zd-btn zd-danger', onclick: () => ed.deleteLayout() }, 'Delete layout')));
  }

  return { el: root, render, setTab, syncPosition, getTab: () => tab };
}
