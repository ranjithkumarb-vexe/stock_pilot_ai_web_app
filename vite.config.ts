/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: false },
  build: {
    // Production decision (FE-12): NO source maps in the deployed bundle (they would be public next to the JS and expose
    // the source). Opt in with BUILD_SOURCEMAP=hidden when an error tracker is wired up: `hidden` writes .map files without
    // the //# sourceMappingURL comment, upload them to the tracker and delete them from dist before publishing.
    sourcemap: process.env.BUILD_SOURCEMAP === 'hidden' ? 'hidden' : false,
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
