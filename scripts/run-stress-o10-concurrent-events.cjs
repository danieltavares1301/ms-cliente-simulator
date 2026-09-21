const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, '.generated', 'o10-cjs');
const compiledScript = path.join(
  outDir,
  'scripts',
  'stress-o10-concurrent-events.js',
);

function runOrThrow(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });

runOrThrow(
  process.execPath,
  [
    require.resolve('typescript/bin/tsc'),
    '--ignoreConfig',
    '--ignoreDeprecations',
    '6.0',
    'scripts/stress-o10-concurrent-events.ts',
    '--outDir',
    '.generated/o10-cjs',
    '--module',
    'commonjs',
    '--moduleResolution',
    'node10',
    '--target',
    'es2022',
    '--lib',
    'dom,dom.iterable,esnext',
    '--types',
    'node',
    '--esModuleInterop',
    '--strict',
    '--skipLibCheck',
    '--resolveJsonModule',
    '--allowImportingTsExtensions',
    '--rewriteRelativeImportExtensions',
  ],
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }),
  'utf8',
);

runOrThrow(process.execPath, [compiledScript, ...process.argv.slice(2)]);
