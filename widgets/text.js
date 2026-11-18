// widgets/text.js — static text, or text pulled from any URL ("webhook").
//
// Rendering uses textContent only: whatever a remote server returns is shown as text, never as HTML.

function getPath(obj, path) {
  const tokens = String(path).trim().replace(/^\$\.?/, '').match(/[^.\[\]]+/g) || [];
  let cur = obj;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[t];
  }
  return cur;
}

function str(v) {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function fillTemplate(template, bodyText, json) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
    if (path === '$') return bodyText.trim();
    return json === undefined ? '' : str(getPath(json, path));
  });
}

export function renderText(tileElement, config) {
  const { text, url, method = 'GET', payload, jsonPath, refreshInterval = 0, css } = config;

  tileElement.classList.add('tile-text');

  const el = document.createElement('div');
  el.className = 'text-content';
  if (css) el.style.cssText = css; // invalid declarations are ignored by the browser
  tileElement.appendChild(el);

  if (!url) {
    el.textContent = text ?? '';
    return { destroy() {} };
  }

  el.textContent = '…';
  let timer = null;
  let loadedOnce = false;
  let stopped = false;

  async function load() {
    try {
      const options = { method, headers: {} };
      if (method === 'POST' && payload) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      }
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();

      let json;
      try { json = JSON.parse(body); } catch { /* plain text response */ }

      let out;
      if (text) out = fillTemplate(text, body, json);
      else if (jsonPath && json !== undefined) out = str(getPath(json, jsonPath));
      else out = body.trim();

      if (stopped) return;
      el.classList.remove('text-error');
      el.removeAttribute('title');
      el.textContent = out;
      loadedOnce = true;
    } catch (err) {
      if (stopped) return;
      if (loadedOnce) { el.title = `Last refresh failed: ${err.message}`; return; } // keep last good value
      el.classList.add('text-error');
      el.textContent = `Error: ${err.message}`;
    }
  }

  load();
  if (refreshInterval > 0) timer = setInterval(load, refreshInterval * 1000);

  return { destroy() { stopped = true; if (timer) clearInterval(timer); } };
}
