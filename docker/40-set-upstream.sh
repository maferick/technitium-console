#!/bin/sh
# Render the nginx config, substituting ONLY ${TECHNITIUM_UPSTREAM} so nginx's own
# runtime variables ($host, $uri, ...) are left untouched.
set -e
: "${TECHNITIUM_UPSTREAM:=technitium:5380}"
envsubst '${TECHNITIUM_UPSTREAM}' \
  < /etc/nginx/technitium-console.conf.template \
  > /etc/nginx/conf.d/default.conf
echo "technitium-console: proxying /api -> ${TECHNITIUM_UPSTREAM}"
