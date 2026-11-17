// core/configStore.js
//
// Loads and saves the dashboard config.
//
//   load : GET  /user/data/dashboard.json   (falls back to user/config.js if absent)
//   save : PUT  /user/data/dashboard.json   (nginx `dav_methods PUT`, see deploy/nginx.conf)
//
// The JSON file has exactly the same shape as the object exported by
// user/config.js ({ layouts: [...] }), so the two sources are interchangeable.

export const CONFIG_URL = '/user/data/dashboard.json';
const BACKUP_URL = CONFIG_URL + '.bak';

let loadedLastModified = null;

export class ConflictError extends Error {
  constructor() {
    super('The config on the server changed after this editor was opened.');
    this.name = 'ConflictError';
  }
}

export class SaveError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SaveError';
    this.status = status;
  }
}

export async function loadConfig() {
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (res.ok) {
      const config = await res.json(); // throws on HTML fallbacks / corrupt files
      loadedLastModified = res.headers.get('Last-Modified');
      return { config, source: 'json' };
    }
  } catch (err) {
    console.warn(`[ZeroDash] ${CONFIG_URL} not usable, falling back to user/config.js:`, err.message);
  }

  const mod = await import('../user/config.js');
  // Evaluating the helper functions yields plain data; clone so nothing is shared.
  return { config: JSON.parse(JSON.stringify(mod.dashboardConfig)), source: 'config.js' };
}

export function serialize(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

export async function saveConfig(config, { force = false } = {}) {
  const body = serialize(config);

  // Detect edits made elsewhere (another tab/device) since we loaded.
  let previousText = null;
  try {
    const head = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (head.ok) {
      const ct = head.headers.get('Content-Type') || '';
      if (ct.includes('json')) {
        const lm = head.headers.get('Last-Modified');
        if (!force && loadedLastModified && lm && lm !== loadedLastModified) {
          throw new ConflictError();
        }
        previousText = await head.text();
      }
    }
  } catch (err) {
    if (err instanceof ConflictError) throw err;
    // Network hiccup on the pre-check: let the PUT below report the real problem.
  }

  // Keep the previous version next to the config (best effort).
  if (previousText) {
    try {
      await fetch(BACKUP_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: previousText
      });
    } catch { /* ignore */ }
  }

  let res;
  try {
    res = await fetch(CONFIG_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (err) {
    throw new SaveError(`Network error: ${err.message}`, 0);
  }

  if (!res.ok) {
    throw new SaveError(explain(res.status), res.status);
  }

  try {
    const check = await fetch(CONFIG_URL, { method: 'HEAD', cache: 'no-store' });
    loadedLastModified = check.headers.get('Last-Modified') || loadedLastModified;
  } catch { /* ignore */ }
}

function explain(status) {
  switch (status) {
    case 401:
    case 403:
      return 'The server refused the write (HTTP ' + status + '). Check the allow/auth rules on the PUT location.';
    case 404:
      return 'The server returned 404. Does the directory user/data/ exist next to the dashboard files?';
    case 405:
      return 'The server does not accept PUT here (HTTP 405). Enable WebDAV PUT for ' + CONFIG_URL + ' (see deploy/nginx.conf).';
    case 409:
      return 'HTTP 409: the target directory does not exist or is not writable by the web server user.';
    case 413:
      return 'The config is larger than the server allows (HTTP 413). Raise client_max_body_size.';
    case 500:
    case 507:
      return 'HTTP ' + status + ': the web server could not write the file. Make user/data/ writable by the nginx user.';
    default:
      return 'Save failed (HTTP ' + status + ').';
  }
}

export function downloadConfig(config) {
  const blob = new Blob([serialize(config)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dashboard.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
