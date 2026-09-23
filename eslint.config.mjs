import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'next-env.d.ts',
    // Standalone CommonJS build output and diagnostic scripts for the O10
    // concurrency-stress tool (Fase 6). Not part of the Next.js production
    // application; intentionally uses require() (CommonJS), which the
    // TypeScript/ESM-oriented config below forbids elsewhere.
    '.generated/**',
    'scripts/*.cjs',
  ]),
]);
