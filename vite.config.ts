import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteBasicSslPlugin from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), viteBasicSslPlugin(), tailwindcss()],
  server: {
    host: true,
    https: {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      '@app': '/src/app',
      '@pages': '/src/pages',
      '@widgets': '/src/widgets',
      '@features': '/src/features',
      '@entities': '/src/entities',
      '@shared': '/src/shared',
    },
  },
})
