#!/usr/bin/env node
// Audit cepat nazhir.id: build-independent checks. Exit non-zero kalau ada temuan fatal.
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const issues = [];

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

for (const f of files(src)) {
  const s = readFileSync(f, 'utf8');
  if (s.includes('@lucia-auth/adapter-postgresql') || s.includes('from "postgres"') || s.includes("from 'postgres'")) issues.push(`${f}: sisa Postgres import`);
  if (s.includes('ctx.sql.end')) issues.push(`${f}: sisa sql.end() Postgres`);
  if (s.includes('dbReady = false') && s.includes('DEMO MODE PATCH')) issues.push(`${f}: demo mode hardcode`);
}

const wrangler = readFileSync(join(root, 'wrangler.jsonc'), 'utf8');
if (!wrangler.includes('"binding": "DB"')) issues.push('wrangler.jsonc: binding DB hilang');
if (wrangler.includes('REPLACE_WITH_D1_ID')) issues.push('wrangler.jsonc: database_id belum diisi');

const dashboard = readFileSync(join(src, 'pages/dashboard.astro'), 'utf8');
assert(!dashboard.includes('demo_mode=true'), 'dashboard masih redirect demo_mode');
assert(dashboard.includes('AkuntansiDashboard'), 'panel AkunWakaf belum dipasang');

if (issues.length) {
  console.error('AUDIT FAIL');
  for (const i of issues) console.error(`- ${i}`);
  process.exit(1);
}
console.log('OK: audit-site bersih');
