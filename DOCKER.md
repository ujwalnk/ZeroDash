# Running ZeroDash with Docker

Two prebuilt images, published to GHCR on every push to `main`:

| Variant | Image | Serves from |
| --- | --- | --- |
| nginx | `ghcr.io/<owner>/zerodash:latest-nginx` | `/usr/share/nginx/html` |
| Caddy | `ghcr.io/<owner>/zerodash:latest-caddy` | `/srv` |

Both are multi-arch (`linux/amd64`, `linux/arm64`), listen on port 80 and contain every file the dashboard
needs, plus a starter dashboard and a default server config. Pin a build with `:sha-<short>-nginx` / `:sha-<short>-caddy`.

```bash
docker run -d -p 8080:80 ghcr.io/<owner>/zerodash:latest-nginx
```

## Using your own dashboard config

Mount your whole `user/` directory over the one in the image. Mount the directory, not just `config.js`:
`config.js` imports `application.js`, `button.js`, etc., which must sit next to it, and `searchConfig.js` lives there too.

```yaml
services:
  zerodash:
    image: ghcr.io/<owner>/zerodash:latest-nginx
    ports: ["8080:80"]
    volumes:
      - ./user:/usr/share/nginx/html/user:ro      # Caddy image: ./user:/srv/user:ro
```

`.js` and `.html` are served with `Cache-Control: no-cache`, so edits show up on the next refresh.

## Using your own server config (optional)

Mount a file over the default one:

| Variant | Mount to |
| --- | --- |
| nginx | `/etc/nginx/conf.d/default.conf` |
| Caddy | `/etc/caddy/Caddyfile` |

```yaml
    volumes:
      - ./my-default.conf:/etc/nginx/conf.d/default.conf:ro   # nginx
      # - ./Caddyfile:/etc/caddy/Caddyfile:ro                 # Caddy
```

Your config replaces the default entirely, so it must include these parts. Without them, layout URLs such as
`/portrait`, `/layout/portrait` and `?layout=` break.

### nginx: add to your `server { }` block

```nginx
root /usr/share/nginx/html;
index index.html;

# /layout/<name> serves index.html, so ./main.js etc. resolve to /layout/main.js. Map them back.
rewrite ^/layout/(.+\.[A-Za-z0-9]+)$ /$1 last;

# SPA fallback: /<layoutName> and /layout/<layoutName> must serve index.html
location / {
    try_files $uri $uri/ /index.html;
}

# Recommended: pick up config edits on refresh
add_header Cache-Control "no-cache" always;
```

### Caddy: add to your site block

```caddyfile
root * /srv
file_server

# /layout/<name> serves index.html, so ./main.js etc. resolve to /layout/main.js. Map them back.
@layoutAssets path_regexp layoutAsset ^/layout/(.+\.[A-Za-z0-9]+)$
rewrite @layoutAssets /{re.layoutAsset.1}

# SPA fallback: /<layoutName> and /layout/<layoutName> must serve index.html
try_files {path} {path}/ /index.html

# Recommended: pick up config edits on refresh
header Cache-Control "no-cache"
```

If you terminate TLS or serve under a different port, adjust the site address (the default is `http://:80`).
Reachability checks run in the browser, so CORS/proxying for your other services is configured on those services.

## Publishing (maintainers)

`.github/workflows/docker-publish.yml` builds both variants in parallel and pushes to
`ghcr.io/<repo owner>/zerodash` with `GITHUB_TOKEN`; no secrets to set up. Tags per push to `main`:
`latest-nginx`, `latest-caddy`, `sha-<short>-nginx`, `sha-<short>-caddy`.

The first push creates the package as **private**. Make it public once under the package's settings on GitHub,
then it can be pulled without logging in.
