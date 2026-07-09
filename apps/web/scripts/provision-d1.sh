#!/usr/bin/env bash
# Provisioning D1 untuk nazhir.id — jalankan SEKALI setelah CLOUDFLARE_API_TOKEN valid.
# Token butuh scope: D1:Edit, Workers Scripts:Edit, Pages:Edit.
set -euo pipefail
cd "$(dirname "$0")/.."   # -> apps/web

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: export CLOUDFLARE_API_TOKEN dulu (scope D1:Edit)."; exit 1
fi

echo "==> 1. Buat D1 database 'nazhir-id' (skip jika sudah ada)"
DBID=$(npx wrangler d1 create nazhir-id 2>/dev/null | grep -oE '"database_id": *"[^"]+"' | grep -oE '[0-9a-f-]{36}' || true)
if [ -z "$DBID" ]; then
  echo "    (mungkin sudah ada) ambil id dari 'd1 list'..."
  DBID=$(npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const m=a.find(x=>x.name==="nazhir-id");console.log(m?m.uuid||m.database_id:"")})')
fi
[ -n "$DBID" ] || { echo "ERROR: gagal dapat database_id"; exit 1; }
echo "    database_id = $DBID"

echo "==> 2. Tulis database_id ke wrangler.jsonc"
sed -i "s/REPLACE_WITH_D1_ID/$DBID/" wrangler.jsonc

echo "==> 3. Terapkan migrations (remote)"
npx wrangler d1 execute nazhir-id --remote --file=migrations/0001_init.sql
npx wrangler d1 execute nazhir-id --remote --file=migrations/0002_akuntansi_psak412.sql

echo "==> 4. Build + deploy"
npm run build
npx wrangler deploy

echo "DONE. Cek https://nazhir.id — Demo Mode seharusnya sudah hilang."
