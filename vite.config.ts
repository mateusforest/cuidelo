import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { tvDevelopmentRelay } from './server/dev-relay.mjs';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const dataMode = loadEnv(mode, process.cwd(), 'VITE_DATA_MODE').VITE_DATA_MODE;
  if (dataMode && dataMode !== 'demo')
    throw new Error('Esta versão só admite o modo demo com dados fictícios.');
  return {
    envPrefix: [],
    plugins: [react(), tvDevelopmentRelay()],
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    test: { include: ['src/**/*.test.ts', 'server/**/*.test.mjs'], environment: 'node' },
  };
});
