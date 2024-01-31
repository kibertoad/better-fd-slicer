// eslint-disable-next-line import/no-unresolved
import {defineConfig} from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2022',
  },
  test: {
    root: './',
    maxConcurrency: 1,
    watch: false,
    coverage: {
      provider: 'v8',
      clean: true,
      include: ['src/**'],
    },
  },
});
