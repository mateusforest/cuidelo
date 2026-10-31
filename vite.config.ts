import { defineConfig } from 'vitest/config';
import { tvDevelopmentRelay } from './server/dev-relay.mjs';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tvDevelopmentRelay()],
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.mjs'], environment: 'node' },
});
