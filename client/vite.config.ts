import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.VITE_DEV_API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // The shared package ships TypeScript source, so point Vite straight at
      // it rather than letting the dep optimiser try to pre-bundle it.
      '@leadpilot/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Same-origin in production; proxied in dev so the auth cookie behaves
    // identically in both environments (first-party, SameSite=Lax).
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
    fs: {
      allow: [path.resolve(import.meta.dirname, '..')],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
