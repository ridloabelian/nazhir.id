#!/usr/bin/env bash
# Loop verify untuk nazhir.id. Dipakai manusia/cron/agent sebelum commit+deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  TOK=$(grep -oP '^\s*export CLOUDFLARE_API_TOKEN=\K\S+' /home/ridlo/.bashrc | tail -1 | tr -d '"'"'"'' || true)
  export CLOUDFLARE_API_TOKEN="$TOK"
fi

node scripts/audit-site.mjs
node scripts/akuntansi.selfcheck.mjs
npm run build >/tmp/nazhir-build.log

echo "OK: build pass"

# Live smoke checks. Non-fatal if network flaky, fatal if HTTP bukan expected.
home=$(curl -4 -s -o /dev/null -w '%{http_code}' https://nazhir.id/ -m 20)
getme=$(curl -4 -s -o /dev/null -w '%{http_code}' 'https://nazhir.id/api/trpc/auth.getMe?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' -m 20)
dash=$(curl -4 -s -o /dev/null -w '%{http_code}' https://nazhir.id/dashboard -m 20)

[ "$home" = "200" ] || { echo "FAIL: home HTTP=$home"; exit 1; }
[ "$getme" = "200" ] || { echo "FAIL: getMe HTTP=$getme"; exit 1; }
[ "$dash" = "302" ] || { echo "FAIL: dashboard unauth HTTP=$dash"; exit 1; }

echo "OK: live smoke pass (home=$home getMe=$getme dashboard=$dash)"
