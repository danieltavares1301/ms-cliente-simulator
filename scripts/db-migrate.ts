import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
let parsedUrl: URL | undefined;

try {
  parsedUrl = databaseUrl === undefined ? undefined : new URL(databaseUrl);
} catch {
  parsedUrl = undefined;
}

if (
  parsedUrl === undefined ||
  !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
  parsedUrl.password === ''
) {
  console.error(
    'DATABASE_URL must be a password-protected PostgreSQL URL before migration',
  );
  process.exit(1);
}

const drizzleKit = join(
  process.cwd(),
  'node_modules',
  'drizzle-kit',
  'bin.cjs',
);
const result = spawnSync(process.execPath, [drizzleKit, 'migrate'], {
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
