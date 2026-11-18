// core/urlResolver.js
//
// "$" in the HOST position of a tile URL stands for the host the dashboard itself is opened from:
//
//   dashboard at xyz.com        "$:5003"              ->  http://xyz.com:5003
//   dashboard at 192.168.1.1    "$:5003"              ->  http://192.168.1.1:5003
//   dashboard at https://xyz.com "$:5003"             ->  https://xyz.com:5003
//   any dashboard               "https://$:8443/app"  ->  https://<host>:8443/app   (explicit scheme wins)
//   any dashboard               "https://example.com" ->  unchanged                 (static URL, no "$")
//
// "$" is the hostname only (the dashboard's own port is not copied). With no scheme written, the
// dashboard's own scheme (http/https) is used, so an https dashboard doesn't get blocked as mixed content.
// A "$" anywhere else (path, query, text) is left alone, so static URLs never change by accident.
//
// Resolution happens when a URL is used, never in the stored config, so dashboard.json keeps the "$".

const HOST_VAR = /^((?:[a-z][a-z0-9+.-]*:)?\/\/)?\$(?=$|[:/?#])/i;

export function resolveUrl(url, loc = globalThis.location) {
  if (typeof url !== 'string' || !url.includes('$')) return url;
  const m = HOST_VAR.exec(url);
  if (!m || !loc) return url;
  return (m[1] ?? `${loc.protocol}//`) + loc.hostname + url.slice(m[0].length);
}
