// core/configStore.js
//
// Loads and saves the dashboard config.
//
//   load : GET  /user/data/dashboard.json   (a built-in empty dashboard is used if the file does not exist yet)
//   save : PUT  /user/data/dashboard.json   (nginx `dav_methods PUT` / Caddy webdav, see DOCKER.md)
//
// Shape: { "layouts": [ ... ], "search": { "prefixes": { "@": ["application"] } } }   ("search" is optional)

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

/** Starting point when no dashboard.json exists yet. Saving from the editor creates the file. */
export function defaultConfig() {
  return { layouts: [{ name: 'default', rows: 6, columns: 8, tiles: [] }] };
}

export async function loadConfig() {
  let res;
  try {
    res = await fetch(CONFIG_URL, { cache: 'no-store' });
  } catch (err) {
    console.warn(`[ZeroDash] Could not fetch ${CONFIG_URL}:`, err.message);
    return { config: defaultConfig(), source: 'default' };
  }

  const isJson = (res.headers.get('Content-Type') || '').includes('json');
  if (!res.ok || !isJson) {
    // Missing file (404), or an SPA fallback answering with index.html: start from an empty dashboard.
    return { config: defaultConfig(), source: 'default' };
  }

  try {
    const config = await res.json();
    loadedLastModified = res.headers.get('Last-Modified');
    return { config, source: 'json' };
  } catch (err) {
    // Do not fall back to an empty dashboard here: saving would overwrite a file that is only broken, not gone.
    throw new Error(`${CONFIG_URL} is not valid JSON (${err.message}). Fix or restore the file (a previous version may be at ${BACKUP_URL}).`);
  }
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

  // Trust, but verify: some servers answer PUT with 200 without storing anything
  // (e.g. a static server with an SPA fallback). Read the file back.
  let check;
  try {
    check = await fetch(CONFIG_URL, { cache: 'no-store' });
  } catch (err) {
    throw new SaveError(`Saved, but could not read the file back: ${err.message}`, 0);
  }
  const echoed = check.ok ? await check.text() : '';
  if (echoed !== body) {
    throw new SaveError(
      'The server answered the save request but did not store the file. ' +
      'Write support (PUT) is probably not enabled for ' + CONFIG_URL + ' (see DOCKER.md, "Using your own server config").', 0);
  }
  loadedLastModified = check.headers.get('Last-Modified') || loadedLastModified;
}

function explain(status) {
  switch (status) {
    case 401:
    case 403:
      return 'The server refused the write (HTTP ' + status + '). Check the allow/auth rules on the PUT location.';
    case 404:
      return 'The server returned 404. Does the directory user/data/ exist next to the dashboard files?';
    case 405:
      return 'The server does not accept PUT here (HTTP 405). Enable PUT for ' + CONFIG_URL + ' (see DOCKER.md, "Using your own server config").';
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
