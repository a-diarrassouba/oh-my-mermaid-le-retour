import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The new front, served by `prisme view` at /. The map keeps the classic
// viewer at /map until it moves here too.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    // npm run dev:web next to `prisme view` on port 3000
    proxy: { '/api': 'http://localhost:3000', '/map': 'http://localhost:3000', '/events': 'http://localhost:3000' },
  },
});
