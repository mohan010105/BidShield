import crypto from 'node:crypto';
if (typeof (crypto as any).hash !== 'function') {
  (crypto as any).hash = function (algorithm: string, data: any, outputEncoding?: any) {
    const h = crypto.createHash(algorithm).update(data);
    return outputEncoding ? h.digest(outputEncoding) : h.digest();
  };
}

import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 5173;
const basePath = process.env.BASE_PATH || '/';
const backendPort = process.env.PORT || '5000';
const apiUrl = process.env.VITE_API_URL || `http://localhost:${backendPort}`;

export default defineConfig({
  base: basePath,
  envDir: path.resolve(import.meta.dirname, '../../'),
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
