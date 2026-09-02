import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'web',
  build: { outDir: '../public', emptyOutDir: true },
  plugins: [react()],
})
