import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  build: { target: 'es2022', sourcemap: true },
});
