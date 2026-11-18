#!/bin/sh
# Runs from /docker-entrypoint.d/ before nginx starts: prepares the config directory and the save login.
set -eu

DATA=/usr/share/nginx/html/user/data
DEFAULT=/usr/share/zerodash/default-dashboard.json
AUTH=/etc/nginx/zerodash-write-auth.conf

# First run (empty volume / empty bind mount): create the data dir and seed a starter dashboard.json.
mkdir -p "$DATA"
[ -e "$DATA/dashboard.json" ] || cp "$DEFAULT" "$DATA/dashboard.json"

# nginx workers run as "nginx"; saving from the editor must be able to create files here.
chown -R nginx:nginx "$DATA" 2>/dev/null ||
  echo "zerodash: WARNING: could not chown $DATA to nginx; saving from the editor may fail (check the volume's permissions)." >&2

# Who may save? Everybody can read the dashboard; PUT is open unless a password is set.
if [ -n "${ZERODASH_EDIT_PASSWORD:-}" ]; then
  # Store only an apr1 (salted MD5) hash; the password is passed on stdin so it never shows up in `ps`.
  hash=$(printf '%s' "$ZERODASH_EDIT_PASSWORD" | openssl passwd -apr1 -stdin)
  printf '%s:%s\n' "${ZERODASH_EDIT_USER:-admin}" "$hash" > /etc/nginx/zerodash.htpasswd
  chown root:nginx /etc/nginx/zerodash.htpasswd
  chmod 640 /etc/nginx/zerodash.htpasswd
  printf 'auth_basic "ZeroDash editor";\nauth_basic_user_file /etc/nginx/zerodash.htpasswd;\n' > "$AUTH"
else
  printf 'allow all;\n' > "$AUTH"
  echo "zerodash: WARNING: ZERODASH_EDIT_PASSWORD is not set, so anyone who can reach this server can edit the dashboard." >&2
fi
