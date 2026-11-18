# Running ZeroDash with Docker

Two prebuilt images, published to GHCR on every push to `main`:

| Variant | Image | Web root | Port |
| --- | --- | --- | --- |
| nginx | `ghcr.io/<owner>/zerodash:latest-nginx` | `/usr/share/nginx/html` | 80 |
| Caddy | `ghcr.io/<owner>/zerodash:latest-caddy` | `/srv` | 80 |

Both are multi-arch (`linux/amd64`, `linux/arm64`). Pin a build with `:sha-<short>-nginx` / `:sha-<short>-caddy`.

There are no config files to write. The dashboard is configured in the browser (click the pencil), and the
result is saved to one JSON file, `user/data/dashboard.json`, on the server.

## Quick start

Pick the server you prefer, replace `<owner>` in the file with your GitHub user/org, and start it:

```bash
docker compose -f compose.nginx.yaml up -d     # or: compose.caddy.yaml
```

Open `http://localhost:8080`, click the pencil, build your dashboard, Save. The compose files keep your data in a
named volume; each has a commented-out bind-mount alternative if you prefer a visible `./user` folder.

To set a password for saving, copy `.env.example` to `.env` and fill in `ZERODASH_EDIT_PASSWORD` (see
"Who can edit?" below).

## Your data: the `user/` directory

Mount a volume or directory at `user/` (see paths above). It holds everything that is yours:

| Path | Contents |
| --- | --- |
| `user/data/dashboard.json` | Layouts, tiles and search shortcuts. Written by the editor's Save button. |
| `user/data/dashboard.json.bak` | The previous version, kept on every save. |
| `user/icons/` | Optional: your own images, referenced in tiles as `/user/icons/<file>`. |

On first start, if `user/data/dashboard.json` does not exist, a small starter dashboard is created. An existing
file is never touched. To move an existing setup into the container, mount the directory that contains your
`data/dashboard.json`.

- Mount the **directory**, not the single file: saves replace the file, which fails on a bind-mounted file.
- With a bind mount (`./user:/usr/share/nginx/html/user`) the container sets the owner of `user/data/` to the
  server's user (UID 101 for nginx) so saving works. With a named volume this happens automatically.
- Edit `dashboard.json` by hand if you like; the page picks it up on refresh. If the file is not valid JSON the page
  shows an error instead of replacing it, and the last good copy is in `dashboard.json.bak`.

## Who can edit?

Anyone can *view* the dashboard. Saving is a `PUT` to `/user/data/`, controlled by one optional setting:

| Variable | Meaning |
| --- | --- |
| `ZERODASH_EDIT_PASSWORD` | **Empty or unset (default):** saving asks for no password, so anyone who can reach the container can change the dashboard (the container logs a warning). **Set:** saving requires HTTP basic auth with this password. Viewing always stays open. |
| `ZERODASH_EDIT_USER` | Login name for the above. Default `admin`. |

The password is hashed when the container starts (apr1 for nginx, bcrypt for Caddy) and only the hash is written to
the server's config. It is still visible to whoever can read your compose file, `.env` or `docker inspect`. The browser
asks for the login on the first Save. (nginx: avoid `:` in the user name.)

ZeroDash has no accounts, so for anything beyond a trusted network, set a password or put your reverse proxy's
authentication in front of it.

## Using your own server config (optional)

Mount a file over the default one:

| Variant | Mount to |
| --- | --- |
| nginx | `/etc/nginx/conf.d/default.conf` |
| Caddy | `/etc/caddy/Caddyfile` |

Your file replaces the default entirely (including the `ZERODASH_EDIT_*` login), so it must contain the parts below.
The same snippets are all you need to serve ZeroDash without Docker: put the repository's files in the web root
and add them to your existing nginx or Caddy config.
Without the first two, layout URLs (`/portrait`, `/layout/portrait`, `?layout=`) break; without the third, the
editor's Save fails.

### nginx: add to your `server { }` block

```nginx
root /usr/share/nginx/html;
index index.html;

# 1. /layout/<name> serves index.html, so ./main.js etc. resolve to /layout/main.js. Map them back.
rewrite ^/layout/(.+\.[A-Za-z0-9]+)$ /$1 last;

# 2. SPA fallback: /<layoutName> and /layout/<layoutName> must serve index.html
location / {
    try_files $uri $uri/ /index.html;
}

# 3. Saving from the editor (needs ngx_http_dav_module, included in the official image)
location /user/data/ {
    dav_methods PUT;
    dav_access user:rw group:r all:r;
    client_max_body_size 1m;
    default_type application/json;
    add_header Cache-Control "no-store" always;

    limit_except GET HEAD {
        # your own rule for who may save, e.g.
        # allow 192.168.0.0/16; deny all;
        # or: auth_basic "ZeroDash editor"; auth_basic_user_file /etc/nginx/htpasswd;
    }
}
```

### Caddy: add to your site block

Saving needs the `caddy-webdav` module, which the ZeroDash Caddy image includes (stock Caddy does not) and a global
`order` line.

```caddyfile
{
	order webdav before file_server
}

http://:80 {
	root * /srv

	# 3. Saving from the editor
	@save {
		method PUT
		path /user/data/*
	}
	handle @save {
		# your own rule for who may save, e.g.
		# basic_auth { admin <hash from: caddy hash-password> }
		webdav {
			root /srv
		}
	}

	handle /user/data/* {
		header Cache-Control "no-store"
		file_server
	}

	handle {
		# 1. /layout/<name> serves index.html, so ./main.js etc. resolve to /layout/main.js. Map them back.
		@layoutAssets path_regexp layoutAsset ^/layout/(.+\.[A-Za-z0-9]+)$
		rewrite @layoutAssets /{re.layoutAsset.1}

		# 2. SPA fallback: /<layoutName> and /layout/<layoutName> must serve index.html
		try_files {path} {path}/ /index.html
		file_server
	}
}
```

Reachability checks and button/toggle requests run in the visitor's browser, so CORS for those services is
configured on those services, not here.

## Publishing (maintainers)

`.github/workflows/docker-publish.yml` builds both variants in parallel and pushes to
`ghcr.io/<repo owner>/zerodash` with `GITHUB_TOKEN`; no secrets to set up. Tags per push to `main`:
`latest-nginx`, `latest-caddy`, `sha-<short>-nginx`, `sha-<short>-caddy`.

The first push creates the package as **private**. Make it public once in the package's settings on GitHub.

`.dockerignore` is an allow-list so your local `user/` folder (personal config) can never end up in an image.
