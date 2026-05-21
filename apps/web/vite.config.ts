import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@home-link/marketer-pro-contract': path.resolve(
        __dirname,
        '../../packages/marketer-pro-contract/src/index.ts',
      ),
    },
  },
})
