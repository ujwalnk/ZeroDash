#!/bin/sh
# Prepares the config directory and the save login, then starts Caddy (CMD).
set -eu

DATA=/srv/user/data
DEFAULT=/usr/share/zerodash/default-dashboard.json
AUTHDIR=/etc/caddy/zerodash.d

# First run (empty volume / empty bind mount): create the data dir and seed a starter dashboard.json.
mkdir -p "$DATA" "$AUTHDIR"
[ -e "$DATA/dashboard.json" ] || cp "$DEFAULT" "$DATA/dashboard.json"

# Who may save? Everybody can read the dashboard; PUT is open unless a password is set.
if [ -n "${ZERODASH_EDIT_PASSWORD:-}" ]; then
  hash=$(caddy hash-password --plaintext "$ZERODASH_EDIT_PASSWORD")
  printf 'basic_auth {\n\t%s %s\n}\n' "${ZERODASH_EDIT_USER:-admin}" "$hash" > "$AUTHDIR/write-auth.caddy"
else
  : > "$AUTHDIR/write-auth.caddy"
  echo "zerodash: WARNING: ZERODASH_EDIT_PASSWORD is not set, so anyone who can reach this server can edit the dashboard." >&2
fi

exec "$@"
