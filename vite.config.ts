// eslint-disable-next-line import/no-unresolved
import {defineConfig} from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2022',
  },
  test: {
    maxConcurrency: 1,
    watch: false,
    coverage: {
      provider: 'v8',
      include: ['index.ts'],
    },
  },
});
