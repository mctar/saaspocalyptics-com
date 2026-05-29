import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the domain root on gh-pages, so base stays '/'.
export default defineConfig({
  plugins: [react()],
})
