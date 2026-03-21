import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'path';

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    environmentMatchGlobs: [
      ['src/renderer/**/__tests__/**/*.spec.ts', 'jsdom'],
      ['src/renderer/**/__tests__/**/*.test.ts', 'jsdom'],
    ],
    include: [
      'tests/**/*.test.ts',
      'src/**/__tests__/**/*.spec.ts',
      'src/**/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/renderer/**/*.svelte',
        'src/renderer/main.ts',
        'src/renderer/app.css',
        'src/**/__tests__/**',
        'tests/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
