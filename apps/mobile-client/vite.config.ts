import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@marketer-pro/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@marketer-pro/cinematic-engine': path.resolve(__dirname, '../../packages/cinematic-engine/src/index.ts'),
      '@marketer-pro/scene-engine': path.resolve(__dirname, '../../packages/scene-engine/src/index.ts'),
      '@marketer-pro/reward-engine': path.resolve(__dirname, '../../packages/reward-engine/src/index.ts'),
      '@marketer-pro/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
});
