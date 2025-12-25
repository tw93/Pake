import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'bin/**/*.{test,spec}.ts',
      'tests/unit/**/*.{test,spec}.{ts,js}',
      'tests/integration/**/*.{test,spec}.{ts,js}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './bin'),
    },
  },
});
