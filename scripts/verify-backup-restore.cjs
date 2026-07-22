#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

function fail(message) {
  console.error(`Restore verification aborted: ${message}`);
  process.exit(1);
}

const backupPath = process.argv[2];
const databaseUrl = process.env.BACKUP_RESTORE_DATABASE_URL;

if (!backupPath || !fs.existsSync(backupPath)) fail('provide an existing SQL backup path');
if (!databaseUrl) fail('BACKUP_RESTORE_DATABASE_URL is required');
if (process.env.ESWAKE_RESTORE_CONFIRM !== 'STAGING_ONLY') {
  fail('set ESWAKE_RESTORE_CONFIRM=STAGING_ONLY');
}
if (process.env.PRODUCTION_DATABASE_URL && databaseUrl === process.env.PRODUCTION_DATABASE_URL) {
  fail('target matches PRODUCTION_DATABASE_URL');
}

const checksumPath = `${backupPath}.sha256`;
if (!fs.existsSync(checksumPath)) fail(`checksum sidecar is missing: ${checksumPath}`);
const expectedChecksum = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0]?.toLowerCase();
if (!/^[a-f0-9]{64}$/.test(expectedChecksum)) fail('checksum sidecar is invalid');
const actualChecksum = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
if (actualChecksum !== expectedChecksum) fail('backup SHA-256 does not match its sidecar');

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
if (!localHosts.has(parsedUrl.hostname)
  && process.env.ESWAKE_ALLOW_REMOTE_STAGING_RESTORE !== 'YES') {
  fail('remote targets require ESWAKE_ALLOW_REMOTE_STAGING_RESTORE=YES');
}

const sql = fs.readFileSync(backupPath, 'utf8');
const manifestMatch = sql.match(/^-- ESWAKE_BACKUP_MANIFEST: (.+)$/m);
if (!manifestMatch) fail('backup manifest is missing');

let manifest;
try {
  manifest = JSON.parse(manifestMatch[1]);
} catch {
  fail('backup manifest is invalid JSON');
}
if (manifest.formatVersion !== 3) fail(`unsupported format version ${manifest.formatVersion}`);

function psql(args) {
  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) fail(`cannot run psql: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr || `psql exited with ${result.status}`);
  return result.stdout.trim();
}

console.log(`Restoring ${backupPath} into guarded staging target ${parsedUrl.hostname}...`);
psql(['-f', backupPath]);

const mismatches = [];
for (const table of manifest.tables) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) fail(`invalid table in manifest: ${table}`);
  const actual = Number(psql(['-Atc', `SELECT COUNT(*) FROM public.${table};`]));
  const expected = Number(manifest.stats[table] || 0);
  if (actual !== expected) mismatches.push(`${table}: ${actual}/${expected}`);
}

if (mismatches.length > 0) fail(`row counts differ: ${mismatches.join(', ')}`);
console.log(`Restore verified: ${manifest.tables.length} tables, ${manifest.totalRecords} rows.`);
