import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteBasicSslPlugin from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteBasicSslPlugin()],
  server: {
    host: true,
    https: true
  }
})
