const { appendFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

const root = resolve(__dirname, '..');
loadEnvConfig(root, true);

if (!process.env.DATABASE_URL) {
  const databaseUrl = 'file:../dev.db';
  appendFileSync(resolve(root, '.env'), `\nDATABASE_URL="${databaseUrl}"\n`);
  process.env.DATABASE_URL = databaseUrl;
  console.log('Created local SQLite database configuration in .env.');
}

// Apply committed migrations without resetting existing presentation data.
const result = spawnSync(process.execPath, [require.resolve('prisma'), 'migrate', 'deploy'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
