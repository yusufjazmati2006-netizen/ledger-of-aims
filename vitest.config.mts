import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolve = (_root: string, path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('', './src/shared'),
      '@main': resolve('', './src/main'),
      '@renderer': resolve('', './src/renderer'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    // Domain maths is date-sensitive; pin a zone with DST transitions so bugs surface.
    env: { TZ: 'Europe/London' },
  },
});
