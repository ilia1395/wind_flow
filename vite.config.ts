import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteBasicSslPlugin from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), viteBasicSslPlugin()],
  server: {
    host: true,
    https: true,
  },
  resolve: {
    alias: {
      '@app': '/src/app',
      '@pages': '/src/pages',
      '@widgets': '/src/widgets',
      '@features': '/src/features',
      '@entities': '/src/entities',
      '@shared': '/src/shared',
    },
  },
})
